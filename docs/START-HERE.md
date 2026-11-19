# Football animation project: start here

Updated 19 November 2026. This is the current handoff for the friend and their AI.

[Play football](https://rblaurent.github.io/football-tackle-lab/) · [Browse every extracted resource](https://rblaurent.github.io/football-tackle-lab/library.html) · [All animation availability](ANIMATIONS.md) · [Download source and playable data](https://github.com/rblaurent/football-tackle-lab/archive/refs/heads/main.zip).

There are two current browser pages: the playable two-player demo and the complete motion catalogue. The obsolete Gameplay Football Contact lab and the small source-clip viewer have been retired. Their old URLs redirect to the current demo/catalogue; their implementations and dedicated tools/assets are no longer shipped. Useful extraction research, reproducible tools and dated diagnostic evidence remain.

## Run on a phone, Mac or Windows

The public links work without an account or installed game. To run a copy locally:

```sh
git clone https://github.com/rblaurent/football-tackle-lab.git
cd football-tackle-lab
python -m http.server 8080 --bind 127.0.0.1
```

On Mac use `python3` if necessary. Open `http://127.0.0.1:8080/` for play or `http://127.0.0.1:8080/library.html` for the catalogue. Keep the terminal open; Ctrl+C stops the server. Use HTTP rather than opening the HTML file. Playback needs no npm build, FC install, Windows extraction tools or remote CDN. A ZIP includes the playable pack and public previews, but not the complete private local export.

For an existing checkout, preserve personal edits and run `git pull --ff-only`, then reload. For a ZIP, unpack the new copy separately and transfer your changes deliberately. Phones automatically use the smaller texture/framebuffer/cache profile. `?quality=low` forces it; [phone budgets and recovery](MOBILE-STABILITY.md) documents the behavior.

## Play and inspect

Steer blue with the touch pad, WASD or arrows. Shift sprints; the pace menu also selects walk/jog/sprint. Pass/E and Shoot/F approach the ball and use native kicks. Space/Tackle challenges; Player tackle stages a repeatable two-person tackle/fall/get-up. Stop cancels an approach or interaction and brakes into idle. Chase ball follows the ball.

Challenge selects a standing interaction from the players' situation. The Interaction menu gives front/side shirt pulls, arm grabbing, pushing and deliberate handball; press Do interaction. The same actors approach, contact, release and return to locomotion. Play match enables the simple opponent. Goals queue celebration after shooting follow-through; Celebrate requests one directly. Tap the pitch to place the ball and drag/pinch to orbit/zoom. Motion inspector shows source names, state, weights and streaming/cache information.

## Which animations are available?

| Layer | Current measured content | Where to use it |
| --- | ---: | --- |
| Complete discovered extraction | 46,351 original resources | Search all names/statuses in the catalogue; raw EBX/RES live in a full local export. |
| Decoded channel data | 44,037 resources; 44,005 also have named bindings | Full export; includes body, facial/scalar, camera and prop channels. |
| Automatic live field system | 2,313 native body clips in 17 families | Included `runtime/` pack, lazy streamed by the playable demo. |
| Whole-capture browser previews | 338 selected body resources | Included `library/previews/`, selectable in the catalogue. |
| Preserved but not decoded | 2,314 resources | Explicit codec/layout status; original raw payloads retained locally. |

**[ANIMATIONS.md](ANIMATIONS.md) lists every live family, exact counts, access paths, raw/decode/binding limits and machine-readable inventories.** It is generated from the committed catalogue and runtime manifest. The 338 whole-capture previews are a separate hosting selection from the 2,313 runtime segments; they are not additive and do not limit what the live controller can choose. Not all 46,351 resources are playable body animations.

The public site and source ZIP contain every admitted runtime payload. The approximately 3.55 GiB decoded full export is outside Git. To give the friend all decoded local files, copy the entire `native-library/` folder alongside the project, or reproduce it using [FULL-LIBRARY.md](FULL-LIBRARY.md). Never claim a source ZIP includes that export.

## Read the right guide

| Task | Guide |
| --- | --- |
| Understand available motions and browse all names | [Animation inventory](ANIMATIONS.md) |
| Understand selection, transitions, states, contacts and streaming | [Live animation system](ANIMATION-SYSTEM.md) |
| Re-extract all discoverable installed resources | [Full-library extraction](FULL-LIBRARY.md) |
| Windows prerequisites, bootstrap and low-level extraction troubleshooting | [Extraction setup](REPRODUCING.md) |
| Archive, codec, channel and coordinate math | [Formats](FORMATS.md) |
| Recover controller metadata and three neural IK networks | [Controller/weight research](CONTROLLER.md) |
| Work on shirt pulls, hands, pushes or handball | [Interactions](INTERACTIONS.md) |
| Fix character binding, shoulders, hands or feet | [Native rig](NATIVE-RIG.md) |
| Keep phone rendering bounded and test context recovery | [Mobile stability](MOBILE-STABILITY.md) |
| Find tools, exact versions, pins and provenance | [Tools and sources](TOOLS-AND-SOURCES.md) |
| Give the project to another AI | [AI handoff and invariants](AI-HANDOFF.md) |

## Current architecture and files

`controller-core.js` owns a 120 Hz world/state scheduler. `motion-database.js` scores and streams compatible clips from `runtime/manifest.json.gz`; `motion-codec.js` validates/reads them. `animation.js` samples native poses, aligns gaits and performs inertial transitions. `interactions.js` stages shared-clock actions. `foot-planting.js`, `foot-contact.js` and `neural-ik.js` produce one final pose/support correction. `native-skin.js` fits the CC0 mesh once to the native 369-bone hierarchy; `human.js` renders that same hierarchy and final pose. The original template's 65 joints are not a second runtime retarget skeleton. Arm fitting includes the shoulder/elbow/wrist length correction.

`controller-view.js` and `index.html` provide play/input/rendering. `library.js` and `library.html` provide catalogue search and source capture previews using the current native-bound human. `render-profile.js` controls phone/desktop budgets. `controller-data.json` is the small fallback/bootstrap corpus, not the complete library or live selection scope. `data.json` is retained as a baseline extraction comparison fixture. `research/` preserves controller settings and neural data; `tools/fc27/` contains archive, codec, binding, extraction, publication, compilation and audit tools.

## What was extracted and what we implemented

The source is the installed Windows Steam FC27 Demo/Lite, app 4407750, build 22116598, game 1.0.142.20665. Archive reads do not run or modify the game/anti-cheat. This is a verified-build pipeline, not a universal FC exporter.

Native motions, rig/channel data, selected serialized controller settings and three locomotion IK networks were recovered. The live system uses the knee network as a bounded analytic-solver hint. Arm/chest networks are inspectable but are not enabled as a native contact controller. Selection weights, scheduler, transitions, navigation, physics, incident heuristics and simple opponent are our code. EA's full PTM search, normalization, match AI, ML-Flow/HyperMotion runtime and referee engine were not recovered.

Native shirt pairs retain shared capture time/origin. Push combines a native pusher and separately selected native reaction at contact. Arm grab and handball combine native body bases with authored hand targets. They are not all verified native paired interactions. Contact is checked with joint/proxy sweeps; exact finger-to-shirt cloth, garment deformation, ragdolls, full-body ground collision and complete football-law decisions are absent. Some extreme low falls still intersect the pitch. The superhero silhouette and shoulder weights still need artistic refinement. A complete team game, keepers and richer airborne actions remain work.

## Verify and extend

Install development tools only when changing/verifying the project:

```sh
npm ci
npm test
node tools/verify-runtime.cjs http://127.0.0.1:8080/ /path/to/evidence/runtime
node tools/verify-library.cjs http://127.0.0.1:8080/library.html /path/to/evidence/library
node tools/verify-native-rig.cjs http://127.0.0.1:8080/ /path/to/evidence/rig
node tools/verify-mobile.cjs http://127.0.0.1:8080/ /path/to/evidence/mobile
python tools/fc27/document_inventory.py --check
```

Browser scripts use Playwright and installed Chrome. Run browser jobs sequentially if software WebGL contexts contend. The current 52 Node tests cover the active system; seven tests belonging exclusively to the removed Z-up contact experiment were retired. Desktop/touch browser checks and constrained phone emulation are available; these are not physical-device or Mac/Safari certification. See the dated [evidence index](../evidence/README.md).

For a new motion family, follow the admission/entry/contact/exit instructions in [ANIMATION-SYSTEM.md](ANIMATION-SYSTEM.md), extend the state graph and add meaningful success/miss/release checks. Importing or decoding a clip alone does not connect it to play.

Read [THIRD_PARTY.md](../THIRD_PARTY.md). Original code is Unlicense, Quaternius is CC0, Three.js is MIT. FC-derived data/weights retain separate rights; no redistribution permission is asserted. Do not commit installed-game binaries, Oodle, downloaded reference codec, raw export, credentials or personal paths.
