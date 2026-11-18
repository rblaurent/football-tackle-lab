# Tackle orientation, fall rotation and recovery rubber band

**Historical diagnosis:** measurements and twenty-two tests below refer to the tackle correction at `282a13e`. The current runtime has seventeen clips, thirty-one tests, neutral idle/support corrections and a connected interaction scheduler described in [INTERACTIONS.md](INTERACTIONS.md).

This investigation corrects the controller published at commit `5c0f865`. All observations below are from our decoded source data and prototype, not a comparison against EA's running engine. [Play the current controller](https://rblaurent.github.io/football-tackle-lab/) and press **Player tackle**. [Watch the corrected 4.5-second sequence](../evidence/tackle-corrected.mp4).

## What went wrong

There were four interacting defects, not a shortage of captured poses.

1. **Corrupt recovery endpoint.** The reference decoder port copied the beginning of the final partial DCT block. That block is an overlapping eight-key window ending at the last key. In `11a395p1_slidetacklegetups_jog_0`, there are 33 keys: the final block contains keys 25-32. Only row 7 is the new key 32. Our old row 0 replayed key 25. The trajectory went backward about 0.48 m in the last 30 Hz interval, and the controller hit its 12 m/s safety cap. Quaternion norms were still plausible.
2. **Body and path used incompatible frames.** We removed `AITrajectory` rotation every sample but retained the hips rotation relative to that parent. The hips counter-rotate as the captured trajectory changes heading. Losing the parent makes the entire player twist, and the tackling legs no longer follow the captured travel direction. The tackle's root yaw changes from about -22 degrees at source frame 9 to +157 degrees at frame 24. This is not a constant mesh-facing offset that can be fixed with a single arbitrary 90-degree model rotation.
3. **Recovery velocity was discarded.** Navigation rebuilt its velocity from actor heading and scalar speed. A get-up can finish moving in a different direction, so the next idle tick reversed or redirected movement. A shortened last simulation tick also understated exit velocity because it divided the partial displacement by a full tick.
4. **Wrong reaction for ordinary contact.** Every victim used the standalone `slidet_stunt_2p` capture. Its source genuinely contains a dramatic tumble. The paired tackle's `charplayerh04_body` is a more appropriate victim reaction. Its source window 0.55-1.60 s covers the trip/fall before its own rise begins. It remains a generic reaction, not a physically synthesized response for every impact.

## Decoder correction

`tools/fc27/bootstrap_decoder.py` still verifies the pristine reference source SHA256 before applying local changes. The original reference is not vendored. It applies forward block-body storage, correct final-row selection, matching offset-ramp selection, and a guard that skips padded keys. For each block:

```text
valid = min(8, NumKeys - blockIndex*8)
rowStart = NumKeys >= 8 ? 8-valid : 0
newKeys[blockIndex*8 + j] = decodedBlock[rowStart + j]
```

The vector/float offset ramp needs the same `rowStart`; fixing only quaternion/translation DCT rows leaves another endpoint error. The tested clips all have at least eight keys. Smaller clips have not been validated. Full eight-key blocks retain row offset zero.

The independently inspected block rows in the 33-key get-up overlap the previous keys 25-31. The corrected final trajectory key is `[16.748318, 0.00007081032, -3.6295667]` in source feet, not the old `[15.130395, ..., -2.5810256]`. The committed regression checks that native endpoint and continuing displacement, rather than comparing two runs of the same decoder.

All 22 selected clips were decoded/packed again. Both `data.json` and `controller-data.json` were regenerated. The latter still contains thirteen clips, with the paired victim replacing the unused stunt. The original eleven-clip viewer retains both captures. The three networks and 33 controller reports are unchanged. [Reproduction result](../evidence/controller-reproduction.json).

## One action frame for both pose and displacement

Let `R0` be the constant yaw at the clip window's entry. For tackle, fall and get-ups:

```text
localTrajectoryRotation(t) = inverse(R0) * capturedTrajectoryRotation(t)
localRootDelta = inverse(R0) * (capturedPosition(t1)-capturedPosition(t0))
worldRootDelta = actorHeading * localRootDelta
worldBoneRotation = actorHeading * localTrajectoryRotation(t) * capturedBoneChain(t)
```

Translations are converted from source feet to metres. Root translation is consumed by simulation; captured trajectory rotation stays in the pose. This preserves the original relationship between hips, limbs and travel path. Ordinary locomotion cycles still use navigation heading. The controller's 0.72 slide-distance scale and bounded ball-target warp remain explicit artistic/gameplay choices.

A horizontal least-squares fit aligns hips-relative head, spine, hands, knees and feet at an action transition. Candidate get-ups are scored after this alignment plus a hips-height penalty. On changing actor heading by `deltaYaw`, the displayed trajectory parent is counter-rotated by `-deltaYaw`, including the prior/displayed pose buffers. This preserves the world pose while changing its coordinate frame. Inertial pose offsets then handle residual limb differences. There is no world-position reset.

Recovery and fall velocity blend from the outgoing world vector for 0.18 s. On leaving a moving get-up with no movement intent, the actor enters **stop**, then **idle**. Braking approaches zero velocity at 8.5 m/s², retaining direction. At an action's last partial simulation tick, velocity uses the actual sampled interval; the remaining fraction coasts at that velocity. No final-pose hold or teleport is introduced.

The arranged opponent moved from `(0,0,1)` to `(0.5,0,0.6)` metres because the corrected foot path passed outside the old leg capsule. The capsule threshold was not widened to manufacture a hit. The fixed scenario records ball contact around 0.308 s and leg contact around 0.350 s.

## Evidence and reproducible checks

At 120 Hz, over six simulated seconds:

| Measure | Old arranged duel | Corrected arranged duel |
| --- | ---: | ---: |
| Blue largest one-tick velocity change | 13.71 m/s | 0.482 m/s |
| Blue largest root step | 0.100 m | 0.0398 m |
| Red largest hips rotation step | 8.79 degrees | 4.95 degrees |
| Blue recovery exit | Direct idle and heading-based velocity reset | Stop with preserved velocity vector |
| Red path | Stunt fall, recovery, idle | Victim fall, recovery, stop, idle |

These are operational before/after measurements. Reaction content and opponent placement changed, so the aggregate values are not a controlled same-input ablation or proof of full physical realism. [Before/after report](../evidence/tackle-correction.json), [current transition and peak trace](../evidence/tackle-corrected-trace.json).

```sh
npm ci
npm test
node tools/trace-controller.mjs --out tackle-trace.json
# Add --full to include every sampled pose/root record.
python -m http.server 8080 --bind 127.0.0.1
```

In a second terminal:

```sh
node tools/verify-controller.cjs --url http://127.0.0.1:8080/ --out controller-check --channel chrome
node tools/verify-viewer.cjs --url http://127.0.0.1:8080/clips.html --out viewer-check --channel chrome
node tools/capture-controller.cjs --url http://127.0.0.1:8080/ --out capture --channel chrome --sequence duel --duel-duration 4.5
ffmpeg -framerate 30 -i capture/frame-%05d.jpg -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart tackle.mp4
```

Use sequential browser runs if the machine cannot allocate multiple software WebGL contexts. Omit `--channel chrome` to use Playwright-managed Chromium.

The 22 tests include the original controller/physics cases and new regressions for the native final key, shared pose/path frame, world-pose preservation when rebasing, velocity continuity into braking, victim selection, and rotating the whole encounter while retaining matching feet, root movement and contact events. Browser checks cover desktop and phone emulation, finite 65-bone skin matrices, actual touch-pad events and complete recoveries. The original viewer also passed 24 skin checks per viewport. These are not Android, iOS or Mac hardware tests.

The original sixteen tests and raw-norm checks missed the bugs: valid transforms and no catastrophic root teleport do not guarantee correct facing or an ordered decoded tail. Future clips need endpoint, world-space contact and transition checks as well as structural validation.

## Remaining scope

This still uses a small curated vocabulary and our own controller. Contact-specific reactions, multiple approach angles, synchronized paired interactions, target-skin foot/hand constraints and better locomotion coverage remain. Restoring native trajectory orientation does not recreate EA's PTM search or collision scheduler. The victim reaction here is taken from a paired capture but is dispatched independently; its native partner synchronization is not running.
