# Tools, versions, provenance and research history

This document covers the original eleven-clip extraction baseline. For the new continuous controller, expanded extraction profile, 33 parameter/weight assets and recovered neural IK, also read [CONTROLLER.md](CONTROLLER.md). The source capture viewer now lives at `clips.html`; the home page runs the controller.

This inventory separates the minimum reproduction path from optional tools used while investigating it. Download from the named project/vendor. Versions below are the ones observed in this session, not a claim that they are the latest releases.

## Tools used for the successful path

| Tool/data | Tested version or identity | Role and necessity |
| --- | --- | --- |
| FC 27 Lite PC | Steam app 4407750, build 22116598; game 1.0.142.20665 | Owner-installed source assets. Windows extraction input, not a browser runtime dependency. |
| Python x64 | 3.11.9 | Archive readers, decompression binding, EFIX/rig mapping, JSON preparation and local HTTP server. |
| Python lz4 | 4.4.5 | Frostbite codec 9 blocks. Pinned in requirements.txt. https://pypi.org/project/lz4/ |
| Python zstandard | 0.25.0 | Codec 15 blocks. Pinned in requirements.txt. https://pypi.org/project/zstandard/ |
| Installed Oodle DLL | oo2core_9_win64.dll from that game | Decompression of codec 17/21/25 blocks via ctypes. Not copied/distributed by this project. |
| .NET SDK | 9.0.303, net9.0 target | Compile/run original metadata host plus the fetched reference VBR codec. |
| FIFA17 reference codec | Pinned commit and SHA256 below | Core VBR reconstruction, adapted locally for FC27 block storage. It is not bundled under the project's license. |
| Three.js | r187 | Browser rendering, skeletons/skin, quaternion/matrix math, glTF loader, SkeletonUtils, OrbitControls and legacy GLTFExporter. Vendored with MIT notice. |
| Quaternius Universal Base Characters | Standard free archive, CC0 | Human body, eyes/brows and buzzed hair. Official archive SHA256 in handoff evidence. |
| Git | Local command-line client | Source versioning; not needed if downloading the repo ZIP. |
| GitHub CLI | 2.89.0 | Repository/Pages status and deployment verification. Playback/extraction do not need it. |
| GitHub Pages | main branch, root /, .nojekyll | Static hosting; no server code or secrets. |

The human model's football kit is an original shader using rest-position regions for cloth colors, plus attached original simple boot meshes. No EA player mesh, face texture or branded shirt is used by the new human viewer.

## Capture and verification tools

| Tool | Tested version | Role |
| --- | --- | --- |
| Node.js | 22.23.4 | Browser automation scripts and independent physics tests. |
| Playwright | 1.65.1 | Headless browser, deterministic frame stepping, screenshots and desktop/touch viewport verification. |
| Installed Chrome | Headless Chrome channel used | Original rendering/captures. Scripts also support Playwright Chromium; install it with `npx playwright install chromium`. |
| FFmpeg/ffprobe | 8.0, Gyan Windows full build | JPEG sequence to H.264 MP4 and media metadata verification. |
| Leaf Asset storage | Original local delivery only | Stored screenshots/video/private research package in the original conversation. Not required by the public project or your friend's setup. No Leaf execution token is required. |

## Optional research tools actually used

- **FMT public release 26.10.9654.14105**, downloaded release ZIP about 261 MB. [Official release repository](https://github.com/FMTDev/FMT.Releases). Its public bundle contained FC26 rather than the required FC27 profile. The README's FC27 support note described read-only Pro access at research time; we did not patch a license check or use a Pro profile. FMT format/SDK/codec inspection was useful, but opening a title in a mod tool is not proof of independent animation export.
- **FMT.Core NuGet 2026.16.4**, plus an earlier core from the public bundle. [NuGet package](https://www.nuget.org/packages/FMT.Core). Used to compare readers and inspect schema fields. Its decoder did not successfully decode these samples as-is. The cleaned reproduction pipeline does not reference its assemblies or require a NuGet FMT package.
- **ILSpy command-line 9.1.0.7988**. [Official ILSpy project](https://github.com/icsharpcode/ILSpy). Read managed types from the downloaded public binaries to understand routing, EFIX and animation metadata. A local .NET tool installation was used. The installed machine needed `DOTNET_ROLL_FORWARD=Major` for that inspection tool's runtime. This is not a requirement of the final decoder.
- **Portable .NET runtime 10.0.15**, checksum-verified download from Microsoft's .NET distribution, used to inspect/test FMT.Core's net10 assembly. [Official .NET downloads](https://dotnet.microsoft.com/download/dotnet). A separate initial download was only a host pack rather than a complete runtime, so it was not usable. Neither download is part of the minimum reproduction path.
- **Small .NET single-file bundle inspector** written in Python. It located the bundle manifest and extracted public managed assemblies for inspection; it did not execute an installer or modify FMT. The successful pipeline replaces that research dependency with explicit format readers and the pinned codec reference.
- **PowerShell, curl/HTTP and the GitHub API** for reading release metadata, obtaining official files and checking deployment. These did not require transferring private execution tokens to third-party websites.

A separate private historical research archive retains machine-specific probe scripts, bounded selected raw samples, the private adapted reference codec and manifests. It is an audit trail, not the supported entry point. The portable tool and guide in this repository supersede the scratch scripts for reproduction.

## Pinned reference decoder

Author/project: [sadistaaa14-sketch / Frosty-Toolsuite-FIFA-17-edition](https://github.com/sadistaaa14-sketch/Frosty-Toolsuite-FIFA-17-edition).

Exact source: [VbrClip.cs at 8a9868a5649aa5b296b1c6e66c7c583469d7a017](https://github.com/sadistaaa14-sketch/Frosty-Toolsuite-FIFA-17-edition/blob/8a9868a5649aa5b296b1c6e66c7c583469d7a017/FrostyAnimationEditor/Core/Anim/VbrClip.cs).

SHA256 of the original downloaded bytes:

```text
7344e3275871c34ac5618bf731b92a5e503ecf1092d9ba786420111f32bd1809
```

The original codec source is not vendored here and its license was not established. `bootstrap_decoder.py` downloads it into an ignored/local work directory, checks that exact hash, changes the block-body copy to forward order, and corrects final overlapping-block rows and offset ramps for the tested FC27 resources. The adapter and host in this repository are original glue; they do not imply ownership of the fetched reference. Do not relabel the downloaded source as Unlicense.

Our original .NET host supplies VBR metadata, strips only the validated zero tail, checks raw rotation norms and samples frames. [FORMATS.md](FORMATS.md) describes the storage change and metadata fields. No FIFA game executable or closed EA animation runtime is included.

## Model and browser sources

- [Quaternius Universal Base Characters, creator's page](https://quaternius.com/packs/universalbasecharacters).
- [Creator's Standard download on itch.io](https://quaternius.itch.io/universal-base-characters). The normal zero-price option was used; no Source-pack purchase was needed.
- Downloaded `Universal Base Characters[Standard].zip` SHA256 is recorded in the handoff evidence manifest. Its license notice is copied into `character/LICENSE-QUATERNIUS.txt`.
- [Three.js official source](https://github.com/mrdoob/three.js/tree/r187) and [official docs](https://threejs.org/docs/). Relevant components are SkinnedMesh, Skeleton, Matrix4/Quaternion, GLTFLoader, SkeletonUtils and OrbitControls. Custom shader regions are project code, not a replacement for garment topology/cloth simulation.
- [Playwright documentation](https://playwright.dev/docs/intro).
- [FFmpeg documentation](https://ffmpeg.org/documentation.html).
- [GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Prior approaches and negative results

These explain the choices; they are not extra installation steps.

| Approach | What was established | What was not established |
| --- | --- | --- |
| Gameplay Football / Google Research Football | Extracted 293 open-source clips and original articulated meshes, built the independent contact demo. Source revision 3d9e754720a95621bba6475c4d3b0d56fe919014; upstream author Bastiaan Konings Schuiling. | It did not provide the visual quality requested for the latest human study; the old demo clamps its fall/slide instead of transitioning into recovery. |
| Dedicated FIFA17 Frosty fork | Source contains actual animation decoding/export and multi-actor infrastructure; supplied the useful VBR reference. | No FIFA17 game installation/export was tested here; do not buy a costly key just for this proof. |
| PES gani decoder | [jhnzbdev/pes-gani](https://github.com/jhnzbdev/pes-gani), MIT; two provided hash self-tests passed. Named interaction families looked useful. | No PES game asset decoding was performed; named clip metadata is not a motion library. |
| PES shared research attachments | Original ResHax research page readable. | Downloads returned HTTP 403; no samples obtained, no access bypass. |
| Old FIFA mesh extractors | Mesh/skeleton-oriented tooling was found. | That did not establish animation-system export. |
| FMT VBR decoding as-is | Format/SDK insights were useful. | Output raw quaternion norms were invalid for these FC27 resources. Normalizing them was not an acceptable fix. |
| Original reference's reversed block body | Appropriate to its older source format. | Wrong for selected FC27 standalone resources; forward body order was the decisive correction. |
| Filename-only semantics | Useful for finding tackle, shirt-pull and recovery candidates. | Misleading for the idle file containing getup in its name; every scene needed visual inspection. |
| Direct bone-name copy to the new model | Could associate main joints. | Different bind directions raised the arms; explicit world-space rest corrections were required. |

No conclusion here proves that all later FIFA/FC games share this exact format. Game updates, different skeletons and other codecs need their own evidence.

## Optional: reproduce the managed-format investigation

This is unnecessary for the tested extraction. It is useful when researching another version.

1. Download the named public FMT release from its official repository and unzip it into a local research folder.
2. Extract selected managed assemblies with the original-project helper:

```powershell
python tools\research\inspect_dotnet_bundle.py --exe "D:\Research\FMT\FMT.exe" --out "D:\Research\fmt-assemblies"
dotnet tool install ilspycmd --version 9.1.0.7988 --tool-path "D:\Research\ilspy"
$env:DOTNET_ROLL_FORWARD = 'Major'
```

3. Inspect classes from the extracted assembly, writing your own local output files:

```powershell
& "D:\Research\ilspy\ilspycmd.exe" -t FMT.Core.Resources.AssetBank.VbrAnimation "D:\Research\fmt-assemblies\FMT.Core.dll"
& "D:\Research\ilspy\ilspycmd.exe" -t FMT.Core.Resources.AssetBank.Ant.VbrAnimationAsset "D:\Research\fmt-assemblies\FMT.Core.dll"
```

The inspected SDK class was `FMT.Ebx.VbrAnimationAsset`; routing inspection included `FC26Plugin.FC26TOCFile`. Use ILSpy's type listing to find which assembly owns a type in your downloaded release. Do not assume those assembly layouts are stable or that FC26 routing is sufficient for FC27. For the latest inspected core, the NuGet archive URL was `https://api.nuget.org/v3-flatcontainer/fmt.core/2026.16.4/fmt.core.2026.16.4.nupkg`; a nupkg is a ZIP containing assemblies. Do not publish those extracted binaries or decompiled sources under this project's Unlicense.

The tested FMT bundle was .NET bundle format 6.0 with 629 entries. The helper extracts only selected FMT/Frosty/runtime metadata files and checks file bounds and output paths. This is binary inspection, not a way to enable a missing or paid profile. Stop there if another build's format differs; the runtime/codec proof remains the independent validation step.


## Complete installed-library export

[Full-library guide](FULL-LIBRARY.md) documents every new command and limitation. Original tools: `extract_library.py` (complete archive inventory, hash-checked raw extraction, resumable batch orchestration and reporting), `bind_library.py` (installed ANT dependency/GUID discovery and named channel resolution), `decode_other.py` (NumPy2.2.6 RAW, static frame and Eclipse scalar decoding), `publish_library.py` (complete catalogue plus bounded public previews), `audit_library.py` (all raw checksum/header/binding audits and baseline float32 parity), `verify-library.cjs` (real browser desktop/touch acceptance), and `library.js` (lazy binary loader and skinned human preview). The extended original C# host writes gzip float32 payloads, accepts an ID manifest, checks finite values/norms/counts and records failures per clip. The existing hash-pinned VBR reference bootstrap additionally adapts wide constant indices and constant-only seeking. No additional third-party codec source or SDK binary is vendored. NumPy is pinned separately in `requirements-library.txt`.

The full-library capture helper is `tools/capture-library.cjs`. Reference inspection also included the pinned fork's [RawClip.cs](https://github.com/sadistaaa14-sketch/Frosty-Toolsuite-FIFA-17-edition/blob/8a9868a5649aa5b296b1c6e66c7c583469d7a017/FrostyAnimationEditor/Core/Anim/RawClip.cs) and [DctClip.cs](https://github.com/sadistaaa14-sketch/Frosty-Toolsuite-FIFA-17-edition/blob/8a9868a5649aa5b296b1c6e66c7c583469d7a017/FrostyAnimationEditor/Core/Anim/DctClip.cs). They are not vendored or called by the original RAW decoder. The old DCT layout did not establish compatibility with the installed FC27 DCT payloads.


## Live automatic animation system

[ANIMATION-SYSTEM.md](ANIMATION-SYSTEM.md) covers the original runtime compiler (`compile_runtime.py`), shared FCL1 decoder, feature scorer/streaming cache, native motion registration, expanded gameplay graph, adapted/native interactions, runtime corpus,47 tests, browser verifier (`verify-runtime.cjs`) and continuous gameplay capture (`capture-runtime.cjs`). No additional third-party runtime or FC executable was introduced. The existing native knee network remains the only recovered neural model used by the character controller.

- `tools/fc27/audit_runtime.py`: every runtime compressed/raw SHA256, binding/header, finite/quaternion check and optional exact source-frame comparison.
