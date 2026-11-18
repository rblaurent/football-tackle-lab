# Reproducing the extraction and viewer

Read [Start here](START-HERE.md) first. All commands below are run from the repository root unless stated otherwise. They use your own installed game and write generated files to a separate work folder. No game executable or anti-cheat component needs to be started or modified.

## 1. Install the minimum tools

For extraction, use Windows x64 and:

- Git, or download/unzip the repository through GitHub.
- Python x64. Tested: Python 3.11.9.
- .NET SDK 9. Tested: 9.0.303. The supplied host targets `net9.0`. A runtime alone does not compile it. Porting the target framework to a newer SDK has not been separately validated here.
- A legitimate installed FC 27 Lite PC copy with `Data`, `Patch` and `oo2core_9_win64.dll`.
- Python `lz4==4.4.5` and `zstandard==0.25.0`, installed in the virtual environment below.

For viewing only, Python and a browser are sufficient. Node, Playwright, FFmpeg, FMT, ILSpy and .NET 10 are **not** playback dependencies. [The full tools inventory](TOOLS-AND-SOURCES.md) explains which were research/capture tools and which remain necessary.

Check versions:

```powershell
python --version
python -c "import struct; print(struct.calcsize('P') * 8)"
dotnet --list-sdks
git --version
```

The pointer-size command must print `64` for Windows Oodle loading.

## 2. Clone and prepare isolated Python dependencies

```powershell
git clone https://github.com/rblaurent/football-tackle-lab.git
cd football-tackle-lab
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r tools\fc27\requirements.txt
```

Using the environment's executable directly avoids PowerShell activation-policy issues. The virtual environment and `fc27-work/` are ignored by Git.

## 3. Locate the game

Use Steam's installed-files/browse-local-files control or your installation manager. Choose the folder containing the game files, not the Steam library parent.

The tested installation had these paths:

```text
<game>/Data/layout.toc
<game>/Data/Win32/globals.toc
<game>/Data/Win32/fc/fcgame/fcgame.toc
<game>/Patch/Win32/...
<game>/oo2core_9_win64.dll
```

The local folder was called `EA SPORTS FC 27 Demo`, despite the store name being Lite. Its physical drive is irrelevant to the format. Do not put an output folder inside the game installation.

## 4. Run the complete extraction

Replace the example game path:

```powershell
.\.venv\Scripts\python.exe tools\fc27\extract_fc27.py `
  --game "D:\SteamLibrary\steamapps\common\EA SPORTS FC 27 Demo" `
  --work ".\fc27-work"
```

This is the supported reproduction command. It performs:

1. Parse `Data/layout.toc` to map catalog IDs to install-package paths.
2. Scan the eight known TOCs in Data, then Patch, so Patch replaces older entries.
3. Retain the selected assets/rig dependencies plus motion-resource metadata for discovery.
4. Read/decompress selected CAS ranges; check decoded lengths and archive SHA1s.
5. Parse the source skeleton and compiled rig DOF layouts.
6. Resolve each VBR object's explicit ChannelToDofAsset reference and bind channel IDs to names/types.
7. Fetch the pinned public reference codec into the work folder, verify SHA256, apply the tested forward-storage adaptation and compile the original C# host/adapter.
8. Decode/validate raw keys, sample source frames and write `fc27-work/data.json`.

The bootstrap fetches `VbrClip.cs` at commit `8a9868a5649aa5b296b1c6e66c7c583469d7a017`. Expected original SHA256:

```text
7344e3275871c34ac5618bf731b92a5e503ecf1092d9ba786420111f32bd1809
```

A changed source file fails closed. Do not replace the checksum merely to get past an error. The upstream codec's license was not established; it is fetched locally and is excluded from the project's Unlicense. See [attribution and source details](TOOLS-AND-SOURCES.md).

An offline run can supply the same pristine file:

```powershell
.\.venv\Scripts\python.exe tools\fc27\extract_fc27.py `
  --game "D:\SteamLibrary\steamapps\common\EA SPORTS FC 27 Demo" `
  --work ".\fc27-work" `
  --codec-source "D:\Reference\VbrClip.cs"
```

The provided source must match the original checksum, not an already patched copy. .NET may still require installed targeting packs/restore access. This is not a promise that an unprepared offline computer can compile .NET projects.

## 5. Check the generated files

```text
fc27-work/
  asset-index.json           filtered archive routes and metadata
  index-report.json         counts per scanned TOC
  motion-candidates.json    named motion resources for discovery
  layout-data.json          parsed install-package map
  source-manifest.json      source routes, archive hash and decoded/packed hashes
  bindings.json             each clip's explicit channel-map GUID and names/types
  extracted/
    skeleton.json
    dof-map.json
    rig-dependencies.json
    <clip>.ebx
    <clip>.res
    <clip>.motion.json
    <clip>.validation.json
  decoder/                  local downloaded codec + host, build/cache outputs
  data.json                 final viewer input
```

Expected source skeleton: 369 named bones. Expected eleven-clip frame/channel counts are in `tools/fc27/fc27-lite-profile.json`. The cinematic pair has 56 frames each. Front shirt-pull pair: 47 each; side shirt-pull pair: 61 each; angled slide: 45; sprint slide: 62; recovery: 30; stunt: 50; standing idle: 243.

Run the strict runtime-data comparison:

```powershell
.\.venv\Scripts\python.exe tools\fc27\compare_output.py `
  --actual fc27-work\data.json `
  --reference data.json
```

This compares the skeleton, all names, frame counts, quaternion/vector/scalar samples and runtime metadata. Only historical probe fields `removeAt` and `padding` are ignored. The default numeric tolerance is `1e-6`. On the tested machine the regenerated runtime values matched exactly, with maximum absolute difference zero. Another game build need not match; investigate rather than loosening the tolerance indiscriminately.

Important checks already built into extraction:

- Every selected decompressed asset matches its expected original length.
- Its archive SHA1 matches either the packed bytes or decoded bytes, whichever that entry hashes.
- All channel IDs resolve, and named counts equal decoded channel counts.
- The resource prefix plus compressed blocks accounts for the data length. Only a bounded all-zero tail is removed; all selected samples had eight bytes.
- Raw key quaternion norms are checked before the viewer normalizes them. The host rejects p95 norm error above 0.02 or a raw norm outside 0.95–1.05.
- Vectors/scalars must be finite; malformed input produces a nonzero exit code.

## 6. Put regenerated data into the viewer

Keep a backup/commit of your existing `data.json`, then:

```powershell
Copy-Item -LiteralPath fc27-work\data.json -Destination data.json
python -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080`. Inspect all scene starts, contact frames and endings. Check both players' relative positions, wrists, knees, soles and source root motion. Numeric validity does not establish that the right clip pair or the right semantic incident was chosen.

The source file named `f16_idle_front_getup_02` is standing idle, not recovery. The actual recovery is `f22_d012011trej002_atcp_fall45r_jogsl_getup`. File names are discovery hints, not proof.

## 7. Rerun individual stages

Use the same `--game` and `--work` arguments with one stage:

```powershell
# Scan routes and discover motion names:
.\.venv\Scripts\python.exe tools\fc27\extract_fc27.py --game "<game-folder>" --work fc27-work --stage index
# Read selected assets, skeleton and channel mappings:
.\.venv\Scripts\python.exe tools\fc27\extract_fc27.py --game "<game-folder>" --work fc27-work --stage assets
# Compile/bootstrap if necessary and decode:
.\.venv\Scripts\python.exe tools\fc27\extract_fc27.py --game "<game-folder>" --work fc27-work --stage decode
# Assemble the final JSON:
.\.venv\Scripts\python.exe tools\fc27\extract_fc27.py --game "<game-folder>" --work fc27-work --stage pack
```

Stages depend on earlier outputs. A game update invalidates old route caches; rerun the index before extracting. The cleaned tool's filtered index intentionally differs from the original 442 MB research index. It avoids materializing the complete 1.4-million-record library.

## 8. Explore another animation

```powershell
.\.venv\Scripts\python.exe tools\fc27\list_clips.py --work fc27-work --contains shirt --limit 50
```

Copy an exact full asset name from that list and rerun extraction with `--clip`:

```powershell
.\.venv\Scripts\python.exe tools\fc27\extract_fc27.py `
  --game "<game-folder>" --work fc27-work `
  --clip "antifreeze/assets/gameplay/.../exact_asset_name"
```

The default eleven clips remain included. Indexing is rerun so the additional clip's EBX metadata is retained too. A new clip may use another rig, channel layout or codec; unsupported inputs should fail. Extend the profile/reader only after inspecting them. This is not a generic exporter for every FC version or every animation resource.

Adding a clip to JSON does not add a UI scene. Add its selection to the `scenes` array in `app.js`. Keep paired actors at the same source time and subtract one shared origin, not each player's individual starting position. Preserve the source pair before introducing gameplay offsets or warping.

## 9. Human model setup

The repository already includes the required assets and included CC0 notice. To repeat original acquisition, visit [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters), follow the creator's itch.io download, choose the normal zero-price Standard option, and download that archive. No paid Source pack was used.

Used assets:

- `Base Characters/Godot - UE/Superhero_Male_FullBody.gltf` and its `.bin`/textures.
- `Hairstyles/Origin at 0/glTF (Godot)/Hair_Buzzed.gltf` and its `.bin`/textures.
- `License_Standard.txt` retained as `character/LICENSE-QUATERNIUS.txt`.

Some exported image URIs used `_png.png` names while files had `.png`. Match each URI to the actual file rather than creating missing-texture guesses. The bundled copies already contain those URI corrections.

The viewer clones the skinned body with SkeletonUtils, attaches static hair to Head while preserving its rest-world placement, maps source/target bones, fixes bind-direction differences, and adds kit shading/boots. It does not need Blender or an FBX conversion.

## 10. Browser checks and video

Optional authoring dependencies:

```sh
npm ci
npx playwright install chromium
```

Serve the repository in another terminal, then:

```sh
node tools/verify-viewer.cjs --url http://127.0.0.1:8080/ --out fc27-work/browser-checks
node tools/capture-motion.cjs --url http://127.0.0.1:8080/ --out fc27-work/capture
```

The capture tool writes JPEG frames and a manifest for scenes 0, 2, 3, 5 and 6 at half speed. Encode them with FFmpeg:

```sh
ffmpeg -y -framerate 30 -i fc27-work/capture/frames/%05d.jpg -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -movflags +faststart fc27-work/capture/motion.mp4
```

Then verify:

```sh
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate -of json fc27-work/capture/motion.mp4
```

The original capture was 543 frames, 18.1 seconds, 1280×800 at 30 fps. Deterministic screenshot sampling makes video timing independent of the speed of the test computer. Inspect the video; a finite skeleton matrix does not guarantee good-looking motion.

## 11. Publish a fork on GitHub Pages

The current demo uses Pages publishing from `main`, repository root `/`, with `.nojekyll`. It is static: no server, secrets, Leaf APIs or user accounts are needed. Relative URLs make it work below a repository path.

For your own repository, choose Settings → Pages → Deploy from a branch → `main` and `/ (root)`. Follow [GitHub's publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). Commit only the intended public files. Keep the work folder, downloaded decoder, venv, game archives, Oodle DLL and research tool binaries out of source control.

Before committing, review `git status`, `git diff` and [THIRD_PARTY.md](../THIRD_PARTY.md). Publishing authorization is not an asset license. Keep the differing asset/code terms explicit.

After pushing, confirm the Pages build references your intended commit, then load the actual public URL in a fresh browser and test the controls and model requests. A successful local render is not proof of a correct deployment. The exact original public implementation baseline before this handbook is commit `6dea11b0ec43debcfd9a52426817648a2c3b7e00`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Missing layout/CAS files | Wrong game folder, incomplete install, changed build or stale route index. |
| Unknown route/header values | This is a tested-build reader; inspect new format before extending bounds. Routing flag 0x84 must satisfy `flag & 128`. |
| Oodle cannot load | Windows x64 Python, original installed DLL at the game root, correct game/version. Do not download a random replacement DLL. |
| SHA1 mismatch | Wrong route, block sizes, codec, overlay or source build. Check packed and decoded hashes. |
| No VBR object | Selected resource may use another codec or schema; don't search arbitrary offsets until something looks plausible. |
| Huge DOF count / RAM growth | 0xffffffff is a sentinel, not a valid range end. Bound every interval. |
| Recovery binds to wrong map | Follow the VBR object's reference at +64. Its first EBX import may be something else. |
| Exploding/distorted skeleton | Raw quaternion norms, byte order, bitstream storage, channel ordering, XYZW order and vector units. Do not normalize corrupt values to conceal decode failure. |
| Arms stick upward | Different source/target bind directions. Apply the alignment correction described in FORMATS.md. |
| Shirt-pull actors overlap or drift | Wrong pair, independent recentering, mismatched time/fps or modified shared trajectory. |
| Hands miss the shirt / feet slide | Different proportions and no contact IK. Fix retargeting/contact constraints, not source timing at random. |
| Viewer freezes at the end | Playback time must keep advancing through the hold before resetting. Do not clamp the clock itself to the final frame. |
| JSON/GLTF fails in browser | Use HTTP, correct relative paths/import map and inspect failed network responses. |
| Old public page appears | Confirm Pages built the intended commit, then reload with a fresh context/cache-busting query. |
