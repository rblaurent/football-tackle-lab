# Start here: football game handoff

This repository is a working starting point for a small football manager/referee game for a child. It includes a controllable animation system, extracted native motions and neural IK weights, proper skinned human characters, portable extraction tools and documentation for the friend and their AI.

**[Play the latest system](https://rblaurent.github.io/football-tackle-lab/)** · [Original source-clip viewer](https://rblaurent.github.io/football-tackle-lab/clips.html) · [Earlier contact experiment](https://rblaurent.github.io/football-tackle-lab/collision-lab.html)

## Pick your route

| Goal | Read/use |
| --- | --- |
| Test it on a phone or Mac | Open the live system. No account or installation required. |
| Run or modify the project | Clone and start the static server below. All runtime data is included. |
| Understand transitions, locomotion, contact and recovered weights | **[Controller and neural IK guide](CONTROLLER.md)**. This is the main new technical handoff. |
| Reproduce the original eleven-clip extraction | [Windows setup and reproduction](REPRODUCING.md) with the baseline profile. |
| Reproduce the expanded clips/controller/weight extraction | [Expanded extraction commands](CONTROLLER.md#reproduce-the-expanded-extraction), using `controller-profile.json`. |
| Understand archive, compression, codec, rig and retargeting details | [Binary formats and runtime math](FORMATS.md). |
| Obtain every tool/source/version | [Tool inventory](TOOLS-AND-SOURCES.md) and the new controller guide's file map. |
| Hand work to another AI | [AI brief and acceptance criteria](AI-HANDOFF.md). |
| Understand the old open-source solver | [Gameplay Football notes](../GAMEPLAY-FOOTBALL.md). |

## Run it

```sh
git clone https://github.com/rblaurent/football-tackle-lab.git
cd football-tackle-lab
python -m http.server 8080 --bind 127.0.0.1
```

On macOS use `python3` if necessary. Open `http://127.0.0.1:8080` in a WebGL-capable browser. Keep the terminal running; Ctrl+C stops it. Do not open through `file://`. No Node/npm install, extraction, installed FC game or remote CDN is needed for playback. Use the public URL for another device.

The automatic demo shows chase, stop, tackle, get-up, walking and idle. Use **Player tackle** for the two-person fall/recovery scenario. Steer with the touch pad or WASD/arrows, select the pace, hold Shift to sprint, press Space/Tackle, or use Chase ball and Stop. Tap the grass to place the ball. Motion inspector reveals state, blend and foot-plant information.

## What is established

Native selected FC27 Lite clips drive an independent browser controller through a 369-bone source rig and a 65-bone Quaternius human skin. The mesh has a continuous body, face, fingers, hair, kit and boots. The controller can start, walk/jog/sprint, stop, turn, chase, tackle, fall and recover. The original eight-scene source-capture viewer, including paired shirt pulls, is preserved separately.

The expanded pipeline decodes 22 clips, uses thirteen in the controller, and inspects 33 controller/feature/weight EBX assets. It recovers three complete locomotion neural IK models. Our standalone inference reconstructs native knee coordinates with approximately 2.47 cm per-coordinate RMSE over 240 sampled gait poses. The live controller uses the knee weights as a bend hint for bounded foot planting; it does not use the arm/chest models yet.

A fresh extraction matched all committed controller motion data, neural data and parameter reports after JSON parsing. Sixteen Node tests and desktop/touch browser verification cover the integrated action chains, contacts, input and valid skins. Exact reports are in `evidence/`.

## Keep the limits clear

The intent/state controller, gait blending, pose selection, transition offsets, ball chase, foot planting and collision responses are our implementation. **EA's full PTM motion-search runtime, match AI and rule engine have not been extracted.** Recovered controller settings and feature weights are supplied as inspectable data; our matcher does not claim to apply FC's full feature cost. A generic captured fall is dispatched after a contact, so it is not yet an impact-specific physical reaction.

The new simulation has a rolling planar ball, two actors and flat-ground planting. It does not yet provide a complete match, aerial ball flight, target-rig perfect contacts, paired shirt-pull scheduling, garment deformation, ragdolls or referee decisions. More action variants and stronger interaction alignment are required for diverse challenge angles. [The controller guide](CONTROLLER.md#what-to-build-next-for-a-real-game) describes those next steps.

The source-clip viewer preserves pair timing and trajectories, and remains useful for inspecting what was actually captured. Its standalone recovery and lack of runtime selection should not be confused with the new integrated controller.

## Tested platform and reproduction baseline

Extraction was tested on Windows x64 with Steam FC27 Lite app 4407750, Steam build 22116598, game version 1.0.142.20665, on 18 November 2026. The installation folder was named `EA SPORTS FC 27 Demo`. Use your own actual path.

The extractor loads the installed game's Windows Oodle library read-only. It does not run the game or change executables/anti-cheat. The provided browser result runs independently of Windows/game installation. Chrome desktop and a 412×915 touch viewport were tested, including touch events. Physical phones and Mac/Safari hardware have not been tested.

The full historical index contained 1,448,373 named EBX/RES entries after overlays. There are 35,511 named ANT motion resources across the surveyed archives; 23,107 are in the core gameplay set. Those are indexed candidates, **not validated exported clips**. The cleaned expanded profile retains 35,762 index entries and decodes 22 chosen clips.

## Runtime file map

| Files | Purpose |
| --- | --- |
| `index.html`, `controller-view.js` | Latest controllable WebGL/touch scene |
| `controller-core.js`, `animation.js` | Fixed-step simulation, state logic, native sampling and transitions |
| `neural-ik.js`, `foot-planting.js` | Recovered-network inference, foot constraints and two-bone solving |
| `human.js`, `character/` | Human skin, native rig retargeting and CC0 model/hair |
| `controller-data.json` | Thirteen native runtime clips and source rig |
| `research/fc27-neural-ik.json` | Three recovered, ordered neural IK models |
| `research/fc27-controller-assets.json` | Inspected controller/feature/weight data and unresolved fields |
| `clips.html`, `app.js`, `data.json` | Preserved original eleven-clip viewer |
| `tools/fc27/` | Portable archive/codec/channel and controller/weight extractors, schemas and profiles |
| `tools/verify-controller.cjs`, `tools/verify-neural-ik.mjs` | Browser acceptance and numerical network reconstruction |
| `tools/capture-controller.cjs` | Deterministic rendered controller footage |
| `collision-lab.html`, `physics.js`, `demo.js` | Earlier Gameplay Football contact study |
| `docs/`, `evidence/` | Complete handoff and intentional verification artifacts |

## Terms

Read [THIRD_PARTY.md](../THIRD_PARTY.md). Original code is Unlicense; Quaternius meshes/hair are CC0 and Three.js is MIT. FC-derived motion, rig, controller data and neural weights retain separate rights and are not covered by those licenses. No redistribution permission is asserted for them. The pinned third-party reference codec is downloaded into the extractor's local work folder rather than vendored in Git. No game installation, Oodle/FMT binaries or credentials belong in the repository.
