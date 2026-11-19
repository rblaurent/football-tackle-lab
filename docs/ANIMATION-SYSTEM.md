# Live native animation system

**Phone stability update:** phones now use smaller textures/framebuffers, bounded compact streaming and a compact GPU palette while retaining the full native rig. The main demo handles WebGL loss/restoration. [Measurements, tools and limits](MOBILE-STABILITY.md).

**Native rig update:** the CC0 mesh now binds directly to the native 369-bone hierarchy, sharing its final pose with gameplay contacts. One sole correction replaces the second render-time IK pass; native hand references and foot-phase matching improve missing fingers and gait changes. [Implementation, measurements and reproduction](NATIVE-RIG.md).

[Play the current demo](https://rblaurent.github.io/football-tackle-lab/). The home page now runs a context-driven animation system, not just the small fixed clip playlist or the separate catalogue. The controller selects and streams suitable native performances, transitions between them, and returns to useful movement after each action.

This is our independent two-player animation/gameplay controller using extracted FC motion data. It does not run FC's executable animation engine or claim complete football-game parity. The full extraction remains 46,351 resources, 44,037 decoded. The automatic field-play database admits 2,313 measured body clips across 17 families; cameras, facial weights, unsupported codecs, unsuitable cinematics and unknown actions remain in the full catalogue.

## Play

- **Play match** starts a new round, keeps the score and enables the opponent's pursuit/interception behavior. Steer blue with the touch pad, WASD or arrow keys. Hold Shift to sprint, or select Walk/Jog/Sprint.
- **Chase ball** pursues the moving ball. **Stop** cancels an approach/interaction and brakes into idle.
- **Pass** / **E** and **Shoot** / **F** approach the ball, turn toward the target, select a native kick and finish its follow-through. A strike is recorded only when the animated foot contacts the ball. A ball moved away during the animation does not count as kicked.
- **Tackle** / **Space** selects a slide challenge. Actual ball/leg contact drives outcomes; falls choose compatible get-ups and brake or resume moving afterward. **Player tackle** is the repeatable two-player laboratory scenario.
- **Challenge** selects a standing push, front pull or side pull from relative angle, distance and pace. The Interaction dropdown still gives direct access to front/side shirt pulls, arm grabbing, pushing and deliberate handball. Actions approach, contact, release and rejoin the same controller.
- A ball crossing the goal opening updates the score and queues a native celebration. A shooting follow-through finishes before celebration starts. **Celebrate** also requests one directly; movement can interrupt celebration.
- Tap the pitch to place the ball. Drag/pinch to orbit/zoom. **Replay demo** runs the old scripted movement exercise through the new selector. Open **Motion inspector** for selected original asset names, blend weights, score, streaming state and cache estimate.

The pitch contains one blue and one red player. Pass is a short forward kick into space in this experiment; there is no teammate roster. The opponent is simple pursuit/interception AI. This is an animation foundation for the manager/referee project, not a finished match simulator or official foul adjudicator.

## Actual admitted corpus

| Family | Native clips |
| --- | ---: |
| Idle | 466 |
| Walk / jog / sprint cycles | 23 / 102 / 65 |
| Starts / stops / turns | 32 / 30 / 92 |
| Slide tackles / ordinary falls / complete get-ups | 13 / 23 / 376 |
| Passes / shots | 512 / 263 |
| Pushers / pushed reactions | 2 / 31 |
| Blocks | 119 |
| Shirt-pair actor clips | 62 |
| Standing-ending celebrations | 102 |
| **Total** | **2,313** |

The compiler considered3,067 name-tagged, decoded, bound full-body resources and admitted2,313 after physical/continuity checks. The complete source index is still preserved; this admission policy is not an extraction limit. The field system does not blindly play an arbitrary extracted clip in the wrong situation.

The public runtime pack is95,403,500 compressed bytes, approximately91MiB, plus a roughly2.4MB compressed feature manifest. The browser loads a small core first and fetches individual candidates as needed. It does not download the entire pack or the3.8GB local extraction at startup. A checkout/source ZIP includes this playable pack, so the friend can run it on a Mac without installing FC or the extraction tools.

## Architecture and source files

| File | Responsibility |
| --- | --- |
| `tools/fc27/compile_runtime.py` | Classify known action families, measure native trajectories/FK/poses, find gait loops, reject incompatible or discontinuous clips, emit deterministic segment payloads and shared metadata. |
| `runtime/manifest.json.gz` | Every admitted candidate, source resource ID/name, source frame range, binding, motion features, entry pose samples, contact hint and payload hashes. |
| `runtime/clips/<source-id>_<first-frame>_<last-frame>.bin.gz` | Streamable native segment, still using the documented FCL1 frame/channel format. |
| `runtime/build-report.json` | Counts, measured policy and every rejection reason. |
| `motion-codec.js` | Gzip loading and strict binary/header/channel/finite/quaternion validation. |
| `motion-database.js` | Context/pose scoring, candidate ranking, look-ahead prefetch, native pair preparation and bounded streaming cache. |
| `animation.js` | Native registration/sampling, phase-aligned closed loops, mixed gaits, pose matching, capture-frame/root transforms and inertial transitions. |
| `controller-core.js` | Deterministic120Hz state graph, navigation, predicted contact placement, native kicks, challenge/fall/get-up, simple opponent play, scoring and queued celebrations. |
| `interactions.js` | Shared-clock native shirt captures, native pusher plus collision-triggered native reaction, and native body bases with authored hand targets for grabbing/handball. |
| `foot-planting.js`, `neural-ik.js`, `human.js` | Recovered knee network as bend hint, bounded source foot locks, native-bound skinned human and a single simulated sole-support correction. |
| `controller-view.js`, `index.html` | Phone/desktop controls, rendering, camera, visible goals, score and inspector. |
| `runtime.test.mjs` | Real native corpus, state/selection, contact/miss, streaming, continuity, recovery, goal and cache regressions. |
| `tools/verify-runtime.cjs`, `tools/capture-runtime.cjs` | Real browser acceptance and portable deterministic capture. |

The earlier [controller guide](CONTROLLER.md) documents the source skeleton, recovered controller settings and three IK networks. The native31-component PTM search and its original normalization/runtime are not reconstructed here. The new feature scorer and state graph are ours. The extracted knee network remains in use; arm/chest network weights are preserved but are not being silently substituted for our hand-target solver.

## How a motion becomes eligible

The compiler starts from the complete `native-library/catalog.json`, requires a successfully decoded named binding with Hips and a full player body, and looks for known action families. Naming proposes a role; measurements then determine whether it is acceptable.

It reconstructs the source hierarchy and measures root speed/direction, trajectory turn, pelvis height, foot support, pose samples, joint rotation continuity and beginning/end posture. A normal fall must begin standing and end grounded. A recovery must begin grounded and finish standing. A gait must be forward-moving with plausible support and an acceptable loop seam. A generic block or pass cannot start already lying on the ground. Very long unsegmented actions and known hybrid/dancecard/camera/keeper/special-action names are rejected for this outfield graph.

For gait cycles, it searches windows14–48 frames long for a small weighted pose seam, rather than assuming the entire recording is a clean loop. The emitted loop is phase aligned and its remaining seam is corrected smoothly by the sampler. Other emitted segments are bounded to the first240 frames after the admission checks; their original complete clips remain in the extracted library.

Cumulative world hip rotation and per-frame joint change are checked explicitly. Ordinary falls cannot exceed 4.5 radians of cumulative hip rotation or 0.5 radians of hip rotation per30Hz frame. Recoveries use 7.5/0.65; tackles use 5.5/0.6. Every admitted clip is also limited to 1.4 radians of per-frame joint change. This removed native rolling/stunt or discontinuous motions from ordinary foul reactions without deleting those resources from the catalogue.

Each candidate stores speed, travel, local direction, turn, entry/exit height, support fraction, loop seam, angular measurements, several entry-pose samples and a low striking-foot contact hint. Source frame ranges are inclusive. The emitted float32 channel data is a slice of the decoded source; gameplay corrections happen at runtime, not by overwriting the original capture.

## Selection, transitions and root ownership

The selector first restricts the query to the requested role. It then scores speed mismatch, turn magnitude/sign, current pose, hip height, foot support, loop quality and continuity bias. Pose comparison uses 12 anatomical joints with extra weight on the hips. The exact weights live in `MotionDatabase.score`: speed weight 2 for locomotion/starts/stops, pose weight 8, hip-height weight 5, support weight 0.12, seam weight 12, plus turn/direction terms and a 0.25 current-candidate bias. They are original project tuning, not recovered FC weights.

Only resident valid candidates may enter the simulation. Missing better candidates are fetched asynchronously; the existing valid motion stays available. There are at most three concurrent fetches, checksum and decoded shape checks, a 12-second clip-fetch timeout, up to 64 resident streamed clips and a 32MiB desktop or 8MiB phone resident-size estimate target. Active clips and mandatory fallbacks are protected from eviction. The estimate excludes the feature manifest, baseline clips, scene, textures and GPU allocations; it is not a claim about total browser memory. An artificially tiny custom cache can remain above its estimate target when required clips are pinned.

Gait selection hysteresis uses simulation time, not wall time. Cadence follows the selected cycle and measured speed with bounded time scaling. A newly streamed gait entering continuous running starts an inertial pose transition; it does not instantly replace the current pose. State changes, interruptions, paired-action release and recovery use the same transition machinery. The actual outgoing velocity is carried into braking rather than recomputed from heading.

Navigation owns the world path during ordinary locomotion. Locked actions integrate the native trajectory in the same constant capture frame as their body pose, with bounded predicted contact adjustment. Heading rebases counter-rotate the displayed pose so changes of capture frame do not rotate the whole body unexpectedly. Get-ups are matched against the actual grounded pose, and suitable candidates are prefetched before landing. The prior decoder-tail and root-frame regressions remain covered.

The core flow is:

```text
idle <-> start / move / turn / stop
                 |
                 +-> kick -> follow-through -> move / stop / idle
                 +-> tackle -> grounded pose -> compatible get-up -> move / stop / idle
                 +-> contact fall -> compatible get-up -> move / stop / idle
                 +-> interaction approach -> contact/action -> release -> move / stop / idle
                 +-> goal -> finish current locked action -> celebration -> stop / idle
```

## Native contacts and action provenance

Shirt pulls can select matching actor clips from the compiled paired captures. Both retain one capture frame and one clock. The preparing step scores the pair by approach pace/context and estimates which actor is reaching toward the other by measured hand extension/contact proximity. The approach uses the pair's separation; pinned actor clips remain resident until release.

The new push uses a native full-body pusher and a separately selected native pushed reaction. The hands must meet the opponent's torso capsule before the reaction starts. Collider width derives from the source shoulder span and hand radius. Approach placement is tighter than the old generic setup, and hand correction is bounded. The victim's movement comes from the reaction trajectory, not a fixed0.65m retreat. These performances are combined by our controller; they are not claimed to be an original synchronized two-person mocap pair.

Arm grabbing uses a native paired body base adapted with authored forearm targeting and finger curl. Deliberate handball uses a native block body base plus authored arm positioning and an actual free ball/hand-or-forearm collision. A dedicated native handball performance has not been established. These adaptations remain explicitly identified in events and [INTERACTIONS.md](INTERACTIONS.md). Cloth/jersey deformation is not implemented.

Passing/shooting uses predicted low-foot placement, with bounded alignment, then waits for measured foot/ball contact. Goal detection uses the opening of the visible goal. A goal queues celebration through any remaining kick/fall/recovery follow-through, so it cannot freeze or interrupt a locked pose mid-action. A missed ball is not converted into a successful kick by an animation timer.

## Build, run and reproduce

For normal playback:

```sh
git clone https://github.com/rblaurent/football-tackle-lab.git
cd football-tackle-lab
python3 -m http.server 8080 --bind 127.0.0.1
```

Use `python` on Windows if appropriate. Open `http://127.0.0.1:8080/`. No npm build or FC installation is needed to play the committed data. The public URL works directly on a phone. Do not open via `file://`.

To compile a changed or larger library, first reproduce [the full extraction](FULL-LIBRARY.md), then:

```powershell
python -m pip install -r tools\fc27\requirements-library.txt
python tools\fc27\compile_runtime.py --work native-library --out runtime
```

Use the same verified game build and pinned tools for reproduction. Review `runtime/build-report.json`, inspect rejected families, and reload after the build finishes. Payload and manifest gzip streams use a zero timestamp and no embedded filename. Every clip has compressed and uncompressed SHA256 hashes; runtime verifies the uncompressed payload so ordinary HTTP content-encoding does not change the integrity check. The compiler removes stale files only when the previous manifest identifies them as its generated segments and the output path/name passes its checks.

To add a new behavior, extend `family()` with a defensible role, measure its entry/exit/contact requirements, add a state/query/event path and a safe transition back into play, then test actual successes and misses. Do not map a new action to idle plus arbitrary limb rotations and label it extracted. Unknown semantics stay outside automatic field selection until characterized. To replace our scorer with native PTM or another learned policy, first establish its complete feature layout and normalization; the recovered scalar arrays alone do not establish that runtime.

## Verification and evidence

```powershell
npm ci
npm test
python tools/fc27/audit_runtime.py --source native-library --report evidence/runtime-corpus-audit.json
node tools\verify-runtime.cjs http://127.0.0.1:8080/ D:\Evidence
node tools\capture-runtime.cjs http://127.0.0.1:8080/ D:\Evidence\frames
```

The 58 tests cover the previous decoder-tail/root-frame/velocity/IK regressions and the new selector, native contact/miss behavior, every connected interaction, eight rotated tackle encounters, angular admission, newly streamed gait continuity, checksum failure fallback, cache eviction with pinned actions, and a complete normal-play approach/shot/goal/queued-celebration/idle sequence. The normal-play test includes the opponent; it does not place a ball at the goal line to manufacture the outcome.

Real browser checks exercise skinned native passes/shots, consecutive shirt pulls/push/grab/handball, goal selection, mouse and actual emulated touch-pad input, finite skin matrices, layout and asset/page failures on desktop and 412x915 touch viewports. This does not claim testing on physical phone hardware or Mac Safari, or visual approval of every admitted clip.

[Watch one uninterrupted playable sequence](../evidence/runtime-gameplay.mp4): native approach and shot, physical goal, celebration, then a native push/reaction in the same world. The portable capture steps the same 120Hz simulation and saves 30fps frames; it is not a generated animation or a montage of extracted source videos.

The broader match still needs additional teammates, goalkeeper/header/airborne-action policies, richer tactics, full referee rules and continued visual tuning. Unsupported codecs and unclassified cinematic/face/prop resources retain their complete original data in the extraction catalogue. This delivered system is the live two-player animation foundation for that work.
