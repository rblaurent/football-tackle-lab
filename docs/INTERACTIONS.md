# Interactions in the current playable system

All five controls are in the [main demo](https://rblaurent.github.io/football-tackle-lab/). Choose an Interaction and press Do interaction. Challenge selects a standing push/front pull/side pull from relative angle, distance and pace. Stop or a movement request cancels the approach/action through the same pose transition system. No separate Contact lab is required.

| Action | Body performance and adaptation | Outcome |
| --- | --- | --- |
| Front shirt pull | Shared-clock native two-player capture | Approach, reach/hold/contact event, release and locomotion |
| Side shirt pull | Shared-clock native two-player capture | Side approach, hold/contact event, release and locomotion |
| Push | Native pusher plus separately selected native pushed reaction | Reaction starts at measured hand/torso contact, then recovery/release |
| Arm grab | Native shirt-pair body base with authored forearm targets and native hand reference | Present/reach forearm, nearby hand/arm contact, hold and release |
| Handball | Native block body base with authored arm target and free ballistic ball | Hand/forearm collision may produce the deliberate-scenario incident event; a miss remains a miss |

The live pack includes 62 shirt-pair actor clips, two pushers, 31 push reactions and 119 blocks. They are part of the 2,313-clip selector, not the original seventeen-clip prototype. [All families/counts](ANIMATIONS.md) and [selection architecture](ANIMATION-SYSTEM.md) describe how the remaining actions connect.

## One scheduler and clock

`interactions.js` has approach, active and done phases. Ordinary navigation/start/move/stop moves the actors into reach, including backing away if a preceding action leaves them too close. A bounded timeout cancels unreachable staging. During active motion, external pose/root goals use the same simulation clock. Inertial transition handles entry; native pose/sole correction, rendering, ball contacts and event recording continue on the same actors. Release aligns the actor frame continuously and rejoins braking/idle or requested locomotion.

For a native pair, let P0/P1 be the initial captured trajectories in metres. The common capture origin is their midpoint. One common yaw aligns their inter-player direction to the current encounter; one common translation places the midpoint. Both actors sample the same time:

```text
captureOrigin = (P0 + P1) / 2
worldRoot_i(t) = worldMidpoint + commonYaw * (capturedRoot_i(t) - captureOrigin)
```

Do not independently zero trajectories or canonicalize each actor's heading. Preserve the capture spacing, roles and common clock. Stream the selected pair together and pin active payloads until release. Roots/poses blend into staging; full boundary-aware encounter planning is not implemented.

## Contacts, hands and feet

Shirt contact checks attacking wrists/hands against the partner's torso proxy. Arm-grab targets the presented forearm. Swept hand/forearm/ball tests decide the deliberate handball contact; an animation timer alone cannot report an offence. The ball remains free, with gravity, drag, rebound and ground bounce, rather than being attached to a hand. These are incident heuristics, not a complete referee ruleset.

The bounded two-bone hand solve operates on the native pose before transition. Missing finger channels use a native relaxed-hand reference; grip blends toward a native captured grip including the thumb. Tracked native finger channels are preserved. `human.js` copies the final native pose directly; there is no second rendering-only arm solve. [NATIVE-RIG.md](NATIVE-RIG.md) covers exact joint/contact agreement, shoulder/elbow/wrist bind fitting, the single sole proxy/correction and remaining skin-surface limitations.

Idle presentation keeps neutral gaze near the horizon. Its support locks use smooth acquisition/release and the same rendered boot sole geometry. Extreme low falls/side pulls can still penetrate the pitch because standing support IK is not a complete full-body collision solver.

## Reproduce and verify

Playback requires only the supplied static files. For extraction, follow [FULL-LIBRARY.md](FULL-LIBRARY.md), then compile the runtime pack as documented in [ANIMATION-SYSTEM.md](ANIMATION-SYSTEM.md). Regenerating the small fallback profile alone does not reproduce the live corpus.

```sh
npm ci
npm test
node tools/verify-runtime.cjs http://127.0.0.1:8080/ /path/to/evidence/runtime
node tools/verify-native-rig.cjs http://127.0.0.1:8080/ /path/to/evidence/rig
node tools/verify-arm-fit.cjs http://127.0.0.1:8080/ /path/to/evidence/arms
```

The runtime browser verifier performs all five actions consecutively on desktop/touch, requires actual contacts and release, and checks input, kicks, goals, skin matrices and request errors. The native-rig verifier checks eight action scenarios against the final simulated contact anchors. Node regressions include handball misses, cancellation, consecutive interactions and complete release. The arm tool captures repeatable idle/jog/reaching poses.

[Current continuous gameplay video](../evidence/runtime-gameplay.mp4) includes native shot/goal/celebration and push in one world. Older interaction evidence is historical, not current renderer acceptance. Exact hand-to-fabric contact, cloth gripping/deformation, force-based balance and complete incident adjudication remain work.
