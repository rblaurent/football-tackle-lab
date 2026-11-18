# Full installed animation library

The old 22-clip extraction was a prototype selection. It was not the complete library. The weak main-lab push was an authored arm-IK placeholder, not an extracted native push. This update removes the extraction selection limit and preserves every discovered motion resource from the installed copy.

[Open the complete catalogue](https://rblaurent.github.io/football-tackle-lab/library.html). Search original names, including `victory`, `celebr`, `push`, `shirt`, `ref`, `idle` and `getup`. The public page includes 338 real native full-body previews, including four victory performances and two two-handed push clips. The complete local export supplies all decoded body clips on demand. The original gameplay controller is a separate consumer of this library; importing thousands of clips does not automatically wire them into playable interactions.

## Measured result for this installation

Source: installed Windows Steam FC27 Demo/Lite, app 4407750, build 22116598, game 1.0.142.20665. These counts describe this build, not a fixed filter or a promise about another installation.

| Codec | Original resources extracted | Decoded to frame/channel data | Remaining |
| --- | ---: | ---: | ---: |
| VBR | 34,876 | 34,876 | 0 |
| RAW | 4,289 | 4,289 | 0 |
| Eclipse | 4,893 | 4,826 scalar curve clips | 67 quaternion/vector variants |
| Frame pose | 46 | 46 | 0 |
| DCT | 2,234 | 0 | 2,234 |
| Curve | 13 | 0 | 13 |
| **Total** | **46,351** | **44,037** | **2,314** |

All 46,351 EBX/RES pairs were extracted and passed archive hash checks. The local export has 92,702 original files, plus decoded files, metadata and logs. Named channel binding succeeds for 46,314 resources; 37 remain unresolved (31 VBR, 5 DCT, 1 RAW). Of the decoded resources, 44,005 also have named bindings. Binding a camera, facial control or prop does not make it a player body animation.

The scanner visits all 94 recursively discovered Data/Win32 and Patch/Win32 TOCs. Seven commentary TOCs refer to CAS files absent from this installation. Their exact paths and errors remain in `coverage.json`; there is no silent skip. The count covers discoverable named `AnimationAssetRelocResource` resources (type `0x4088bf7e`) in readable installed archives after Data/Patch overlays. It does not include uninstalled content or unidentified resource types.

The compact decoded files total 3,815,002,718 bytes, approximately 3.55 GiB. They are intentionally outside Git and the Pages deployment. The repository supplies the complete searchable catalogue, 338 native preview payloads, every extraction tool and reproducible instructions. The local export is not included in the GitHub source ZIP. A friend with the installed game can recreate it; someone receiving your exported `native-library` folder can use it directly without re-extraction.

## Windows setup and extraction

Extraction uses Windows x64 Python 3.11+, .NET 9 SDK, the installed game's Oodle DLL and the pinned upstream VBR reference described in [TOOLS-AND-SOURCES.md](TOOLS-AND-SOURCES.md). Playback is browser JavaScript and also runs from macOS. The game is read only; the extractor does not run the game, modify its files, or interact with anti-cheat.

From a current checkout:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r tools\fc27\requirements-library.txt
$game = 'G:\SteamLibrary\steamapps\common\EA SPORTS FC 27 Demo'
```

First generate the known skeleton, player DOF layout and baseline bindings. This small pass is a dependency bootstrap, not the scope of the subsequent extraction:

```powershell
python tools\fc27\extract_fc27.py --game $game --work fc27-work --stage all
```

Then run the complete workflow. There is no clip keyword filter or maximum-count setting:

```powershell
python tools\fc27\extract_library.py --game $game --work native-library --dependency-work fc27-work --seed-index fc27-work\asset-index.json --stage all
```

The first pass discovers all motion resources and retains matching EBX metadata, channel maps and nonmotion ANT dependencies. If the seed did not contain all names, a second pass collects their companion EBX records. Data is visited before Patch, so patched records override base records. The dependency pass builds its own GUID index from the installed files and validates GUIDs before use. It does not require the original private research cache.

The VBR source is fetched by the existing hash-pinned bootstrap. For offline operation, provide the pristine matching source with `--codec-source D:\Research\VbrClip.cs`. The checksum and adaptation logic are in `bootstrap_decoder.py`; never patch an unknown upstream revision.

Keep the output folder outside the game. Use a local disk with several GiB free. The output is persistent and ignored by Git. Each motion uses the first 24 SHA256 hex characters of its full asset name as its ID, avoiding duplicate basenames, parentheses and unsafe path characters. The complete export checks IDs for collisions.

## Resume and inspect failures

Stages are independent:

```powershell
python tools\fc27\extract_library.py --game $game --work native-library --stage index --seed-index native-library\asset-index.json
python tools\fc27\extract_library.py --game $game --work native-library --dependency-work fc27-work --stage extract
python tools\fc27\extract_library.py --game $game --work native-library --stage bind
python tools\fc27\extract_library.py --game $game --work native-library --stage decode
python tools\fc27\extract_library.py --game $game --work native-library --stage report
```

Raw extraction resumes matching source hashes. A changed build invalidates prior decoded files for that asset name. Decoding resumes completed per-clip payload/validation pairs and retries failures. It passes clip IDs through a manifest file rather than a Windows command line containing tens of thousands of arguments. Each failure is recorded without aborting later clips. A successful process exit does not mean every codec succeeded: **read `summary.json`**.

Output map:

| File/folder | Meaning |
| --- | --- |
| `coverage.json` | Every TOC visited, counts and errors; precise scope. |
| `asset-index.json` | Motion EBX/RES and channel-map CAS routes, hashes and overlays. |
| `dependency-index.json`, `dependency-guid-index.json` | Reproducible metadata discovery for rigs and DOF layouts. |
| `catalog.json` | Every motion, source hashes, codec, named bindings and separate extraction/decode/binding status. |
| `extraction-log.jsonl` | Incremental extraction journal. |
| `binding-dependency-report.json` | Verified binding dependencies and probe errors. |
| `shared/` | Skeleton, original and expanded DOF maps. |
| `extracted/<id>.ebx`, `.res` | Complete original motion descriptor and resource payload. |
| `extracted/<id>.motion.bin.gz` | Decoded frame/channel values for supported layouts. |
| `extracted/<id>.validation.json` | Frame/channel counts, codec validation and qualification. |
| `extracted/<id>.error.json` | Explicit unsupported-layout or decode failure. |
| `summary.json` | Actual totals grouped by raw extraction, codec, binding and decode outcome. |

`decoded` means numeric channel data was recovered and passed the applicable checks. It does not mean the whole performance was visually approved, or that every character/face/prop can be rendered by the supplied human. Eclipse scalar curves are recovered with explicit compact endpoint and quantized-key handling; their exported 30Hz sampling uses linear interpolation. Native facial interpolation has not been independently verified. Preserve the EBX/RES as the authority for future work.

## Browse everything locally or give it to a friend

After exporting, regenerate the lightweight website catalogue:

```powershell
python tools\fc27\publish_library.py --work native-library
python -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080/library.html`. Select a decoded, bound body clip and the viewer fetches only its local binary payload. The controller's existing 369-bone source rig and proper skinned human handle the body preview. Search and pagination include unsupported resources too; they remain visible with their real status. There is no giant eager animation JSON load.

To hand over the existing export, copy the project and the entire `native-library` folder together. Keep their relative paths. On a Mac the friend can use `python3 -m http.server 8080 --bind 127.0.0.1`; no Windows extraction dependencies are needed for playback. For testing from another device on the same trusted LAN, serve with `--bind 0.0.0.0`, allow the chosen local server through the firewall, and open `http://<computer-LAN-IP>:8080/library.html?local=1`. The query opts into local payload loading on a LAN host. Do not expose the local development server to the Internet.

The public Pages viewer can browse all 46,351 names and play the 338 bundled previews on a phone or Mac. Full local files are not secretly fetched from your PC or included in the source ZIP. Public delivery and bulk local extraction are separate artifacts.

## Validation and formats

```powershell
python tools\fc27\audit_library.py --work native-library --baseline fc27-work --out library-audit.json
npm ci
npm test
node tools\verify-library.cjs http://127.0.0.1:8080/library.html D:\Evidence
```

The audit rechecks every original local EBX/RES against its decoded SHA1, verifies all decoded headers and named binding counts, and compares baseline samples as exact float32 values. It does not claim a complete visual review of44,037 clips. Browser acceptance samples native victory, celebration and push on desktop and touch-sized layouts, seeks their beginning/middle/end, checks finite skin matrices, exercises search, and captures screenshots. Physical phone hardware and Mac Safari have not been tested.

Binary payload layout, inside gzip:

| Offset | Encoding |
| --- | --- |
| 0 | ASCII `FCL1` |
| 4,8,12,16,20 | Five little-endian int32 values: frame count, quaternion count, vector count, scalar count, fps 30. |
| 24 onward | Per frame: quaternion float32 XYZW values, vector float32 XYZ values, scalar float32 values. Names are shared through the channel-map binding in the catalogue. |

The viewer validates byte length, finite values, counts and binding agreement before playback. Quaternions follow native ordering; source translations use the existing 0.3048 scale into metres. Source capture orientation and root trajectory are retained. The target model's grounding is a presentation correction, not an alteration of original data.

Full-library decoding found two additional VBR cases absent from the prototype: palettes larger than 256 entries need uint16 constant indices, and constant-only clips should not run sparse key-time seeking. The old partial-DCT-tail correction remains in place. All 34,876 VBR resources now pass. RAW decoding checks channel-map permutations and their inverses, stored vector-row counts, key-time monotonicity, finite values and quaternion norms before interpolating. Frame assets store one pose; Eclipse scalar assets store either compact endpoints or quantized keys with byte/big-endian-uint16 times. [FORMATS.md](FORMATS.md) describes the earlier archive, hierarchy and retargeting investigation.

## Handoff to the friend's AI

Read this file, `AI-HANDOFF.md`, `INTERACTIONS.md` and `FORMATS.md`, then inspect the actual source. Keep original resource data and count every status. Do not reintroduce a curated extraction limit.

1. Run the full pipeline and inspect the catalogue. Preserve failed/unsupported entries and original payloads. Re-index a changed game build rather than reusing another build's GUID cache.
2. Finish the remaining 2,234 DCT, 13 Curve and 67 Eclipse quaternion/vector codecs with independent validation. The older FIFA17 DCT reference is not a tested decoder for this installed layout. Resolve the remaining 37 channel bindings separately from decoding.
3. Inspect candidate action families as complete performances. Native clips include locomotion, falls, get-ups, shirt pulls, pushes, referee actions, celebrations, facial weights, cameras and props. Filenames are discovery aids; a word match is not evidence of a correctly paired interaction.
4. Replace the weak main-lab authored push only after choosing and checking actual native pusher/reaction clips. The two-handed native push previews prove better pusher motion is available; they do not prove an automatically aligned, synchronized two-player pair. Arm grab and deliberate handball in the main controller also remain authored placeholders.
5. Connect verified clips through the existing navigation/action/recovery graph, with collision-triggered events, bounded alignment, preserved root frames and continuous outgoing velocity. Do not substitute arbitrary limb rotations or a fixed retreat distance and call it extracted motion. Use paired source timing when available; recover and transition after the action.
6. Check body weight transfer, foot support, approach angles, hand contact, fall, recovery and interruption. Keep the native data separate from gameplay selection and physical contact logic. No complete FC motion-search controller or neural selection system has been recovered.

All original tools in this repository remain under its stated code license. Native game clips, rig data and recovered parameters are outside that license, as already documented in the project.

Portable native clip capture: `node tools/capture-library.cjs http://127.0.0.1:8080/library.html D:\Evidence\frames`, then encode the numbered JPEGs with FFmpeg as in [REPRODUCING.md](REPRODUCING.md). The committed `evidence/library-native-showcase.mp4` shows victory, a fist-pump celebration and a solo two-handed pusher performance. It is not a paired-contact demonstration.
