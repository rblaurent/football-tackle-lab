# Handoff to the next AI and developer

Latest required scope: extract the entire installed motion library, including celebrations and victory. Read [FULL-LIBRARY.md](FULL-LIBRARY.md) first for all tools, stages, codec counts, remaining work and acceptance criteria. The old controller subset is not the extraction scope.


Read `docs/START-HERE.md`, `docs/INTERACTIONS.md`, `docs/CONTROLLER.md`, `docs/REPRODUCING.md`, `docs/FORMATS.md`, `docs/TOOLS-AND-SOURCES.md`, `README.md` and `THIRD_PARTY.md` before proposing a rewrite. Inspect `controller-core.js`, `animation.js`, `foot-planting.js`, `neural-ik.js`, `human.js`, `controller-view.js`, `app.js`, `tools/fc27/`, `physics.js` and the existing evidence. The project is a working prototype with a verified extraction path, not a blank design exercise.

## Paste this into your AI session

> We are building a small football manager/referee game for a child, starting from https://github.com/rblaurent/football-tackle-lab. Read docs/START-HERE.md, docs/INTERACTIONS.md, docs/CONTROLLER.md and docs/TACKLE-DIAGNOSIS.md, then inspect the actual source and evidence. The home page already has a controllable state/transition system using seventeen FC Lite clips and a recovered knee-IK network, with foot planting, ball chase, tackles and automatic recovery. All five hand interactions are actionable in the main lab: native front/side shirt pairs and authored arm grab/push/handball. They approach, act and release in one world. Idle gaze and target-skin boot grounding are corrected. clips.html preserves the original eleven-clip capture viewer; collision-lab.html is the earlier Gameplay Football study. The new controller and contacts are ours, not EA native runtime code. Three complete locomotion IK models and 33 inspected controller/weight assets are supplied. Do not claim full PTM search, match AI, rule logic, ML-Flow or HyperMotion was recovered. Preserve the working system and run its thirty-one tests plus browser verifier before changing it. Use the expanded Windows extractor profile for reproduction. Keep game archives, raw caches, decompression/SDK binaries, downloaded codec source and credentials out of Git. Build the smallest complete referee incident/decision/replay loop on the existing controller. Ask only for information you cannot determine from the repo or installed files.

## Ground truth to preserve

- Source units: native skeleton rest offsets are meters; selected motion translations are feet. Convert animated positions once with 0.3048. Quaternions are XYZW.
- Current viewer is Y-up. Earlier physics/demo is Z-up. Convert explicitly when integrating them.
- Source frames are sampled at 30 Hz in this proof. EndFrame is a last index, not a duration.
- Main source render skeleton has 369 bones; target skin has 65. Gameplay channels are 34/12/8; cinematic/idle 74/14/8.
- Native paired captures need shared time and a shared origin. Do not independently zero the actor trajectories.
- World-space rest/bind-direction correction matters. Copying local quaternions by similar names is insufficient.
- A hand near a shirt is not cloth deformation. The shirt is currently a material region on the skin, not simulated cloth.
- Recovery is now selected and blended automatically in the new controller. The old capture viewer still treats it as a separate clip. Do not replace the working chain with an end-frame hold.
- Indexed motion-resource count is not an export count. The expanded profile decodes 22 candidates; seventeen drive the new controller and eleven remain in the original viewer. Several overlap.
- The original idle name contains getup but plays standing idle. Inspect before labeling or selecting clips.

## First milestones, in order

1. **Preserve a runnable baseline.** Clone, run local HTTP server, run the controller browser verifier, old-viewer verifier and thirty-one Node tests. Save screenshots and the tested revision. Do not redesign everything before this passes.
2. **Author three complete referee incidents.** One clear clean challenge, one clear late trip, one clear holding/pulling incident. Choose clips deliberately; do not pretend the cinematic tackle pair itself dynamically distinguishes clean from late contact.
3. **Extend the existing controller.** Preserve its action locks, current-pose inertial transitions, gait phases, bounded root correction and automatic recoveries. Extend interactions.js and its existing shared-clock paired states; do not start a second animation clock. Preserve native pair origins and the source-versus-authored distinction. Add more variants and better surface contact instead of replacing the working scheduler.
4. **Add interaction metadata.** For each usable clip/pair, annotate approach angle, relative speed, actor roles, ball state, contact interval, hand/foot target, reaction direction, ending posture and compatible recovery. Keep annotations separate from source keys.
5. **Integrate bounded collisions.** Reuse/adapt the earlier swept sphere/capsule ideas with an explicit coordinate conversion. Tie foul decisions to measured contacts and authored scenario rules. Avoid frame-rate-dependent contact guesses.
6. **Improve retarget contact.** Preserve source foot planting and its neural knee hint; add target-rig foot correction and a limited hand constraint where proportions cause visible gaps. Root warp within bounded ranges; select another clip if alignment exceeds those ranges. Start with plausible contact before attempting cloth deformation.
7. **Make the child's decision loop enjoyable.** Replay/slow motion, a clear play-on/foul/card choice, understandable feedback and a restart. Keep real implementation details out of the child's interface.
8. **Only then expand the match.** Add manager decisions or a lightweight match simulation that selects incidents. Full 22-player real-time AI and FIFA parity are later work.

These are recommendations, not claims about EA's proprietary implementation.

## Acceptance evidence for the next change

| Area | Required evidence |
| --- | --- |
| Extraction | Every source payload size/hash checked; unresolved channels fail; raw quaternion validity checked before normalization. |
| Decode reproduction | `compare_output.py` or an explicit versioned fixture comparison; explain any expected build/clip differences. |
| Poses | Source and target checked at start, contact and end; no invalid matrices or unexplained unit/axis changes. |
| Paired contact | Original relative trajectories preserved before warping; hands/feet/contact alignment inspected visually. |
| Sequence/recovery | Complete replay shows fall, settle/get-up and return to useful movement; no frozen ending or large root teleport. |
| Ball/player collisions | Fast ball crossing, near miss, moving-foot impulse, degenerate/crossed capsules and ground support checked. |
| Timing | Source clock is independent of rendering; normal and slow playback show the same event order. |
| Browser | Desktop and phone-sized touch viewport, controls, network requests and page errors checked. State honestly whether actual Safari/mobile hardware was tested. |
| Deployment | Intended commit built; public URL and assets verified after publishing. |

Do not add tests that merely mirror the implementation. Prefer observable failure cases: a ball tunnels through a shin, a paired actor loses their shared origin, a recovery finishes below ground, or a replay clock never resets.

## Avoid these shortcuts

- Do not invent a successful game export from a modding tool's support table.
- Do not normalize exploding quaternion values until they look finite.
- Do not iterate a sentinel DOF index as a count; stop on invalid ranges.
- Do not hardcode one EBX absolute offset or assume import 0 is the channel map.
- Do not replace a proper skinned human with stick/capsule art as the final presentation. Capsules remain useful invisible collision/debug proxies.
- Do not use generated video as evidence that extracted runtime motion works.
- Do not add heavy server infrastructure to a static prototype unless a concrete game feature needs it.
- Do not commit game installations, proprietary decompression DLLs, downloaded FMT binaries, private upstream codec copies or credentials.
- Do not claim the manager/referee game's rules are complete from a ball-first heuristic.
- Do not use FC26 field offsets blindly on FC27, convert internal RIFF references as unsigned displacements, or ignore the extractor's unresolved fields.
- Do not call the recovered knee network an animation selector. Its coordinate conventions are inferred and its measured scope is documented; the native 31-feature PTM search is not running in our controller.

## Working with another game build

First record title, platform, install/build IDs and source file hashes. Rebuild route metadata after updates. Inspect one motion EBX/RES and one source skeleton/rig. Validate codec type, object/relative pointer rules, compressed block boundaries, channel maps, units and timebase. Decode one clip, compare against in-game movement where possible, then test a native pair. Extend the profile only after those checks pass. A bounded failure is preferable to silently corrupting a large library.

## Where to leave your work

Keep reusable implementation and documentation in the repository. Keep generated output in an ignored work directory. Store small validation summaries and intentional screenshots/videos with the corresponding change. Write down the exact revision, what actually passed, what still looks wrong and which assumptions remain unverified. The next person should not need access to the original chat or the original machine.
