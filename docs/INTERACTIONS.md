# Connected interactions and corrected idle

Open [the lab](https://rblaurent.github.io/football-tackle-lab/). Choose an **Interaction**, then press **Do interaction**. The same two players approach one another, perform the action, release and return to movement. You can use another interaction afterward without resetting. **Stop**, steering or **Chase ball** cancels the current interaction through a pose transition. The original tackle/recovery controls remain.

[Watch all five interactions in one simulation](../evidence/interaction-showcase.mp4). [Setup and updating an existing copy](START-HERE.md).

## Available actions and provenance

| Action | Animation source | Runtime behavior |
| --- | --- | --- |
| Front shirt pull | Native front capture selected from matching compiled actor pairs; original front pair is a fallback | Shared capture frame and clock, pose transitions, hand-to-torso contact event, release |
| Side shirt pull | Native side capture selected by approach context; original side pair is a fallback | Same scheduler, native side-on motion and paths |
| Arm grab | Native paired full-body base with authored forearm targets and finger curl | Reach toward a presented forearm, register nearby hand/arm contact, hold and release |
| Push | Native full-body pusher plus a separately selected native pushed reaction | Tight approach, measured hand/torso capsule contact, reaction trajectory and return; no fixed retreat |
| Handball offence | Native block body base with an authored deliberate arm target | Serve a free aerial ball, detect hand/forearm contact, rebound and record the scenario offence |

The push now uses native full-body motion and a contact-triggered native reaction, combined by our scheduler rather than claimed as an original paired capture. Grab/handball use native body bases with authored hand adaptations; a dedicated native handball performance remains unverified. See [the live animation-system guide](ANIMATION-SYSTEM.md) for source provenance, selection, streaming and current validation. The old interaction video above predates this update.

The runtime uses **17 native clips**, selected from the same **22 decoded candidates**. Four shirt-pull actor clips were added to the previous thirteen-clip runtime subset. The baseline eleven-clip source viewer and its unmodified captured head/body motion remain available at `clips.html`.

## Action lifecycle

`InteractionDirector` in `interactions.js` uses the world's existing fixed 120 Hz clock. `FootballWorld.requestInteraction(type)` accepts `shirtFront`, `shirtSide`, `grab`, `push` or `handball`. It returns false for an unknown/busy request or while a tackle/fall/get-up locks either actor. The main page exposes all five through its dropdown/button. A rejected request does not reset the actors.

The director has approach, active and done phases. Approach adjusts distance in either direction, including backing away when a previous action left the partners too close for the next pair. It uses the ordinary navigation/start/move/stop machinery rather than placing the players immediately. A bounded timeout cancels an unreachable approach. The target partner waits.

During active motion, each actor has an external pose/root target sampled by this same clock. The existing inertial pose transition handles entry. The renderer, source-rig IK, ball contacts and event recorder continue using the same actors and simulation. At release, the actor frame is aligned without resetting the world pose, then the actors brake to idle or resume an input request. Explicit movement/Stop commands cancel the paired state first, preserving the current displayed pose for the next transition.

This is a small curated scheduler. It does not automatically classify arbitrary match situations or choose the best action from a huge motion database. The selected captures can translate several metres. Keep interaction staging away from touchlines; full boundary-aware interaction planning is not implemented.

## Preserve the native pair frame

For each shirt capture, both actor clips are sampled at one shared time. Let `P0` and `P1` be their initial captured trajectories in metres. The capture origin is their midpoint. One common yaw aligns the captured inter-player direction with the current world inter-player direction; one common translation places that midpoint at the current partners' midpoint.

```text
captureOrigin = (P0 + P1) / 2
worldRoot_i(t) = worldMidpoint + commonYaw * (capturedRoot_i(t) - captureOrigin)
worldBody_i(t) = commonYaw * capturedTrajectoryRotation_i(t) * capturedBoneChain_i(t)
```

Do not separately zero the two trajectories: that loses the captured spacing. Do not independently canonicalize each actor's yaw. The actor's current frame is rebased with the counter-rotation used by the tackle correction so displayed world pose stays continuous. Root positions blend into the capture over 0.32 seconds. The pose transition uses 0.30 seconds. Those are our tuning values.

Roles are selected deliberately: the front pair uses p01 as blue; the side pair uses p03 as blue. Filename numbering alone does not identify the grabber in every capture.

Shirt contact uses the attacking hands against the victim's hips-to-upper-spine torso segment. The threshold approximates torso thickness plus hand volume. This creates a gameplay contact event; there is no separate simulated shirt mesh or fabric stretch. Retargeted hands can still differ from the skin surface. Captured pair motion and contact heuristics should not be described as a full cloth-grab solver.

## Authored hand actions and IK

`reachHand()` solves the source upper-arm/forearm chain to a bounded hand target, preserving limb lengths. A smooth reach/hold/release envelope drives the goals. Arm grabbing also presents the victim's forearm and adds a finger-curl layer. Pushing waits for close hand/body contact, then adds a bounded 0.65 m retreat, a balance lean and a short gait blend to the victim. These are authored kinematic reactions, not force-based rigid-body balance.

The target human model receives a second arm solve after retargeting, so the source hand goal is also used by the rendered skin. Two-bone solving clamps unreachable targets rather than stretching the arms. Exact finger-to-fabric contact and hand morphology remain approximate.

For the handball scenario, the actor extends the right arm. A ball is served from nearby at an airborne position. Its initial horizontal speed accounts for drag; its vertical speed targets a ballistic flight under 9.81 m/s² gravity. The ball remains free after launch. It can miss, rebound from a hand/forearm, fall and bounce. It is never attached to the hand.

A swept hand test and forearm capsule test decide actual contact. The authored deliberate-arm scenario emits one **handball offence** event only after such contact. The negative regression moves the ball away and checks that no offence appears merely because the animation timer completed. This is an incident/gameplay heuristic, not complete IFAB adjudication or EA's referee policy.

## Why idle looked wrong

The selected idle capture holds a pronounced downward head pose. Treating it as neutral made the character stare at the grass. Bone-axis direction also cannot be confused with the face direction of a skinned model: the bind rotation must be accounted for when measuring it.

`MotionLibrary.neutralGaze()` now keeps the idle face near the horizontal body-facing direction. It distributes the correction through the neck and head in source world space, then converts back to local bone rotations. Other captured actions keep their own head motion. The original clip JSON is unchanged; the correction is a controller presentation layer, not a claim that a new FC idle was extracted.

Source foot planting alone did not guarantee that the retargeted boots rested on the pitch, because target proportions and attached boot geometry differ. `human.js` now measures each rendered sole's world-space lower bound. For low support feet on an upright character, it applies bounded pelvis-height correction and a target-leg two-bone solve while retaining foot orientation. Lifted feet and low fall poses are not flattened to the ground.

In the checked idle pose, the face's vertical forward component is effectively zero and the two sole clearances are about 4.2 mm and 0 mm. `verify-interactions.cjs` checks these on both desktop and phone emulation. This is flat-pitch support, not terrain adaptation or full physical balance.

## Reproduce and verify

The setup, pinned decoder hash, partial-block correction, archive/channel formats and weight extraction remain in [START-HERE.md](START-HERE.md), [REPRODUCING.md](REPRODUCING.md), [FORMATS.md](FORMATS.md) and [CONTROLLER.md](CONTROLLER.md). To export the current seventeen-clip subset from an existing decoded expanded work folder:

```powershell
python tools/fc27/extract_controller.py --game $gamePath --work $workPath --out $outputPath
```

The exporter checks one runtime clip per configured stem instead of hardcoding thirteen. The 33 controller assets and three neural models are unchanged. Compare exported JSON structurally; keep local raw payloads and the downloaded reference codec out of Git.

```sh
npm ci
npm test
python -m http.server 8080 --bind 127.0.0.1
```

In another terminal:

```sh
node tools/verify-controller.cjs --url http://127.0.0.1:8080/ --out controller-check --channel chrome
node tools/verify-interactions.cjs --url http://127.0.0.1:8080/ --out interaction-check --channel chrome
node tools/verify-viewer.cjs --url http://127.0.0.1:8080/clips.html --out viewer-check --channel chrome
node tools/capture-controller.cjs --url http://127.0.0.1:8080/ --out interaction-capture --channel chrome --sequence interactions
ffmpeg -framerate 30 -i interaction-capture/frame-%05d.jpg -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart interactions.mp4
```

Run browser jobs sequentially if software WebGL contexts contend. The interaction capture runs all five actions in one world, including approaches and returns to idle. It does not reset between actions. `capture.json` records the frame ranges and final states.

The **31 Node tests** include all previous tackle/codec/state/physics regressions, five full interaction lifecycles, consecutive actions without a reset, a missed-ball negative case, approach/active cancellation and idle gaze over the full loop. The browser verifier uses the actual dropdown/button, checks all five actions consecutively, validates finite skin matrices, idle face direction and rendered sole clearance, and captures desktop/phone layouts. These are Chromium and phone-emulation checks, not physical Android/iOS or Mac/Safari acceptance.
