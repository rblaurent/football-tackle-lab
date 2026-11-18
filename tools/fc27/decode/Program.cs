using System.Text.Json;
using System.IO.Compression;
using FrostyAnimationEditor.Core.Anim;

if (args.Length < 2) throw new ArgumentException("Usage: Decoder <work-directory> <clip-stem> ...");
var root = Path.GetFullPath(args[0]);
var failed = false;
var binary = args.Contains("--binary");
var resume = args.Contains("--resume");
var requested = args[1].StartsWith("@") ? File.ReadAllLines(args[1][1..]) : args.Skip(1).Where(x => !x.StartsWith("--")).ToArray();
var completed = 0;
void Require(bool condition, string message) { if (!condition) throw new InvalidDataException(message); }
foreach (var name in requested) {
    var prefix = Path.Combine(root, "extracted", name);
    try {
        Require(name == Path.GetFileName(name), "Clip stem must not contain a path");
        if (resume && File.Exists(prefix + ".validation.json") && File.Exists(prefix + ".motion.bin.gz")) continue;
        var ebx = File.ReadAllBytes(prefix + ".ebx");
        var res = File.ReadAllBytes(prefix + ".res");
        // Python has already checked that this marker belongs to exactly one EFIX object.
        int offset = ebx.AsSpan().IndexOf(new byte[] { 0x20, 0x52, 0x42, 0x56 }) - 40;
        Require(offset >= 0 && offset + 166 <= ebx.Length, "Missing/truncated VBR object");
        float F(int p) => BitConverter.ToSingle(ebx, offset + p);
        ushort U(int p) => BitConverter.ToUInt16(ebx, offset + p);
        int I(int p) => BitConverter.ToInt32(res, p);
        Require(res.Length >= 48, "Truncated RES header");
        byte[] Slice(int p, int n) {
            Require(p >= 0 && n >= 0 && p <= res.Length && n <= res.Length - p, "RES array outside file");
            return res.AsSpan(p, n).ToArray();
        }
        var fields = new Dictionary<string, object>();
        var floats = new[] { ("QuatMin",96), ("TrajMin",100), ("Vec3Min",104), ("FloatMin",108),
            ("QuatMax",112), ("TrajMax",116), ("Vec3Max",120), ("FloatMax",124),
            ("VectorOffsetScale",128), ("FloatOffsetScale",132), ("Dct",136) };
        foreach (var (key, p) in floats) {
            Require(float.IsFinite(F(p)), "Non-finite codec metadata");
            fields[key] = F(p);
        }
        var shorts = new[] { "QuaternionCount", "Vector3Count", "FloatCount", "ConstQuaternionCount",
            "ConstVector3Count", "ConstFloatCount", "KeyTimeSize", "NumKeys", "ConstChanMapSize",
            "ConstPaletteSize", "VectorOffsetSize", "FloatOffsetSize", "Flags" };
        for (int i = 0; i < shorts.Length; i++) fields[shorts[i]] = U(140 + 2 * i);
        Require(U(56) < 36000 && U(154) > 0 && U(154) <= 36000, "Frame/key count limit");
        Require(U(140) + U(142) + U(144) + U(146) + U(148) + U(150) <= 2048, "Channel limit");
        Require(I(0) >= 0 && I(0) <= 1000000 && I(12) >= 0 && I(12) <= 100000, "RES array count limit");
        var palette = new float[I(0)];
        Buffer.BlockCopy(Slice(I(4), checked(palette.Length * 4)), 0, palette, 0, palette.Length * 4);
        var blocks = new ushort[I(12)];
        Buffer.BlockCopy(Slice(I(16), checked(blocks.Length * 2)), 0, blocks, 0, blocks.Length * 2);
        var raw = Slice(I(28), I(24));
        fields["ConstantPalette"] = palette;
        fields["FrameBlockSizes"] = blocks;
        fields["__base"] = new Dictionary<string, object> { { "EndFrame", (int)U(56) } };
        int expected = checked(U(152) + (4 * U(146) + 3 * U(148) + U(150)) * (U(158) > 256 ? 2 : 1) + U(156) +
            4 * (4 * U(140) + 3 * U(142) + U(144)) + U(160) + U(162) + blocks.Sum(x => (int)x));
        int padding = raw.Length - expected;
        Require(padding >= 0 && padding <= 16, "Unrecognised resource tail size");
        Require(raw.AsSpan(expected).ToArray().All(x => x == 0), "Nonzero resource tail");
        fields["Data"] = raw.AsSpan(0, expected).ToArray();
        var clip = new VbrClip(key => fields.GetValueOrDefault(key));
        long values = (long)(U(56) + 1) * (4L * (U(140)+U(146)) + 3L * (U(142)+U(148)) + U(144)+U(150));
        Require(values <= 64000000, "Per-clip decoded sample memory limit");
        clip.KeyChannels(out var q, out var v, out var f);
        var norms = q.SelectMany(frame => frame).Select(value => Math.Sqrt(value.Sum(x => x * x))).ToArray();
        Require(norms.All(double.IsFinite), "Invalid quaternion output");
        var errors = norms.Select(x => Math.Abs(x - 1)).Order().ToArray();
        var p95 = errors.Length > 0 ? errors[(int)((errors.Length - 1) * .95)] : 0;
        double? minimum = norms.Length > 0 ? norms.Min() : null, maximum = norms.Length > 0 ? norms.Max() : null;
        Require(p95 <= .02 && (minimum == null || minimum >= .95 && maximum <= 1.05), "Raw quaternion validation failed; do not hide this with normalization");
        Require(v.SelectMany(x => x).SelectMany(x => x).All(float.IsFinite) && f.SelectMany(x => x).All(float.IsFinite), "Non-finite vectors/scalars");
        clip.SampleFrames(null, out var qs, out var vs, out var fs);
        Require(qs.Length == clip.FrameCount() && vs.Length == qs.Length && fs.Length == qs.Length, "Sampled frame count mismatch");
        Require(qs.SelectMany(x=>x).SelectMany(x=>x).All(float.IsFinite) && vs.SelectMany(x=>x).SelectMany(x=>x).All(float.IsFinite) && fs.SelectMany(x=>x).All(float.IsFinite), "Non-finite sampled output");
        var validation = new { name, decoderVersion = 2, padding, frames = clip.FrameCount(), keys = q.Length,
            quats = q[0].Length, vectors = v[0].Length, p95NormError = p95,
            normMin = minimum, normMax = maximum };
        File.WriteAllText(prefix + ".validation.json", JsonSerializer.Serialize(validation));
        if (binary) {
            using (var output = File.Create(prefix + ".motion.bin.gz.partial"))
            using (var zip = new GZipStream(output, CompressionLevel.Fastest))
            using (var writer = new BinaryWriter(zip)) {
                writer.Write(new byte[] { 70, 67, 76, 49 }); // FCL1, little endian, frame-major float32
                writer.Write(qs.Length); writer.Write(qs[0].Length); writer.Write(vs[0].Length); writer.Write(fs[0].Length); writer.Write(30);
                for (int frame = 0; frame < qs.Length; frame++) {
                    foreach (var value in qs[frame]) foreach (var x in value) writer.Write(x);
                    foreach (var value in vs[frame]) foreach (var x in value) writer.Write(x);
                    foreach (var x in fs[frame]) writer.Write(x);
                }
            }
            File.Move(prefix + ".motion.bin.gz.partial", prefix + ".motion.bin.gz", true);
        } else File.WriteAllText(prefix + ".motion.json", JsonSerializer.Serialize(new {
            name, frameCount = clip.FrameCount(), fps = 30, quaternions = qs, vectors = vs, floats = fs, padding }));
        File.Delete(prefix + ".error.json");
        completed++;
        if (!binary || completed % 250 == 0) Console.WriteLine(JsonSerializer.Serialize(new { completed, validation }));
    } catch (Exception error) {
        failed = true;
        File.WriteAllText(prefix + ".error.json", JsonSerializer.Serialize(new { name, error = error.Message, exception = error.GetType().Name, stack = error.StackTrace }));
        Console.Error.WriteLine(name + " FAILED: " + error.Message);
    }
}
Console.WriteLine(JsonSerializer.Serialize(new { completed, failed }));
if (failed && !binary) Environment.ExitCode = 1;
