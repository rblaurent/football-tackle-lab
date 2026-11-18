# Start here: football animation handoff

This is the complete handoff for the friend building a small football manager/referee game and for the AI helping them. It describes the result actually running in this repository, the extraction we proved, the tools and equations behind it, and the remaining game work.

**[Play the latest viewer](https://rblaurent.github.io/football-tackle-lab/)** · [Watch the 18-second capture](../evidence/fc-lite-human-motion.mp4) · [Try the earlier collision prototype](https://rblaurent.github.io/football-tackle-lab/collision-lab.html)

## Choose the right starting point

| Your goal | Start with |
| --- | --- |
| Play or show the result | The live page above. No installation/account is needed. |
| Change the viewer or build a game around these clips | Clone this repository and run the static server below. Extraction is not needed to start. |
| Extract the same clips from your own installed game | [Reproducing the result](REPRODUCING.md), using the provided `tools/fc27/` pipeline. |
| Understand every binary layer and the retargeting | [Format and runtime notes](FORMATS.md). |
| Know exactly which tools and references were used | [Tools, versions and sources](TOOLS-AND-SOURCES.md). |
| Hand the project to an AI | [AI handoff and acceptance criteria](AI-HANDOFF.md). |
| Understand the older open-source collision experiment | [Gameplay Football technical notes](../GAMEPLAY-FOOTBALL.md), `physics.js`, `physics.test.mjs` and `demo.js`. |

Read [third-party terms](../THIRD_PARTY.md) before reusing assets. The original code is Unlicense, Quaternius models are CC0, and Three.js is MIT. FC-derived motion/rig data is separate and is not covered by those licenses. No redistribution permission is asserted for it. The privately adapted reference codec is not vendored in this repository; the extractor downloads a pinned upstream copy into your work folder when needed.

## Run the existing result in five minutes

```sh
git clone https://github.com/rblaurent/football-tackle-lab.git
cd football-tackle-lab
python -m http.server 8080 --bind 127.0.0.1
```

On macOS, use `python3` if `python` is unavailable. Open `http://127.0.0.1:8080` in a WebGL-capable browser. Keep the terminal open; Ctrl+C stops the server. Opening the HTML through `file://` will fail because browsers restrict loading modules, glTF and JSON that way.

No Node/npm install is required for playback. All viewer dependencies, models, textures and selected motion tracks are already in the repository. Use the public site for testing from a phone on another device.

The selector offers eight scenes. Play/pause, scrub, switch between 0.5× and 1× speed, and drag/pinch to orbit/zoom. A link at the bottom opens the earlier ball/contact demo.

## What has actually been achieved

- Selected native motion clips were read from an installed **FC 27 Lite PC** build and played independently in a browser.
- Eleven clips were decoded: eight gameplay clips, two actors from a matching cinematic tackle, and standing idle.
- Their channels were mapped onto the actual 369-bone player render skeleton.
- The motion was retargeted onto a continuous, skinned 65-bone human model with face, fingers, hair and a football kit.
- Native front and side shirt-pull pairs retain their shared timing and trajectories. A gameplay recovery visibly rises from the ground to standing.
- Deterministic browser footage and screenshots were recorded. Desktop and phone viewport controls, skin matrices and replay looping were checked.
- A cleaned extraction pipeline was rerun from an empty work directory. Its runtime data matched the published reference exactly on this machine, across every numeric sample and channel name. The comparator ignores only historical `removeAt`/`padding` probe bookkeeping.

## What this is not yet

This is an animation study, not a complete football match. It does not run EA's native collision solver, animation search/selection, match AI, foul rules, physics or foot placement. It does not bend/deform the shirt where the hand grabs it. The recovery is a separate clip; the new viewer does not automatically blend a fall into that recovery.

The kit is a shader on the existing skinned body, plus simple attached boots. It is not a separate simulated garment. The human proportions differ from the source player, so perfect hand contact and foot placement require additional work.

The earlier `collision-lab.html` uses an independent contact solver with older Gameplay Football motions. It has clean/late/missed outcomes and seven physics checks. That solver has not been integrated into the new FC motion viewer.

## Tested baseline

The extraction was tested on Windows x64 with Steam FC 27 Lite, app `4407750`, Steam build `22116598`, game version `1.0.142.20665`, on 18 November 2026. The installation folder happened to be named `EA SPORTS FC 27 Demo`. Use your actual folder rather than copying that path blindly.

Extraction currently requires Windows x64 because it loads `oo2core_9_win64.dll` from the installed game. The extracted viewer is static browser code. A 412×915 touch viewport was checked in headless Chrome; actual phone hardware and Mac/Safari were not tested. Do not turn viewport emulation into a claim of Safari compatibility.

The full archive research index contained 1,448,373 unique named EBX/RES records after overlays. The core gameplay archives contained 23,107 named motion resources. Only eleven selected clips were decoded and visually reviewed. The cleaned tool deliberately retains a smaller dependency/motion index, so its retained count is not supposed to equal 1,448,373.

## File map

| Path | Purpose |
| --- | --- |
| `index.html`, `app.js` | Latest interactive motion viewer and retargeting implementation. |
| `data.json` | Source skeleton, eleven decoded motion clips and named channel arrays. |
| `character/` | Quaternius glTF/bin/textures, hair and included CC0 notice. |
| `vendor/` | Vendored Three.js r187, loader, skeleton utilities, controls and exporter. |
| `tools/fc27/extract_fc27.py` | Portable archive → selected assets → rig binding → decoding → JSON pipeline. |
| `tools/fc27/formats.py` | Bounded DB/EFIX/relative-array readers. |
| `tools/fc27/bootstrap_decoder.py` | Hash-verified upstream codec fetch and one-line storage adaptation. |
| `tools/fc27/decode/` | Original C# host/adapter, with validation and error exit codes. |
| `tools/fc27/fc27-lite-profile.json` | Tested asset names, DOF GUID/name dependencies and expected clip shapes. |
| `tools/fc27/compare_output.py` | Compare all runtime fields/samples against a reference extraction. |
| `tools/fc27/list_clips.py` | Search indexed motion names before selecting another clip. |
| `tools/capture-motion.cjs`, `tools/verify-viewer.cjs` | Portable capture and browser verification tools. |
| `evidence/` | Recorded video and screenshots; includes the earlier and latest studies. |
| `collision-lab.html`, `physics.js`, `demo.js` | Earlier independent contact demonstration. |
| `docs/` | Setup, implementation understanding, tools and AI handoff. |

## Recommended first game

Build a tiny referee scenario game first: choose one of a few authored incidents, play approach/contact/reaction/recovery, then let the child decide play-on, foul or card. Use clear, deliberately designed incidents with known answers. This can become enjoyable before there is a full 22-player match.

Then add action selection, aligned paired playback, collision/contact checks and recovery transitions. A full manager simulation can use a lightweight match simulation and display selected incidents. Do not make a full FIFA-quality animation system the first milestone.
