# Native rig, skin and contact corrections

**Phone stability update:** phones now use smaller textures/framebuffers, bounded compact streaming and a compact GPU palette while retaining the full native rig. The main demo handles WebGL loss/restoration. [Measurements, tools and limits](MOBILE-STABILITY.md).

The playable character now uses the extracted **369-bone native hierarchy directly**. The CC0 Quaternius mesh is fitted and rebound at load time; it no longer follows a separate 65-bone target through runtime rotation retargeting. The source model and its original 65-joint asset remain unchanged on disk.

## What was wrong

The old display arm segments were 16.7% and 7.7% shorter than the corresponding source segments. Collision code used native wrists/ankles, while the screen showed independently retargeted joints. In the recorded diagnostic, wrist disagreements reached 15 cm during jogging/shirt pulls and 32 cm during the grab sequence. This was an endpoint mismatch, not a claim about exact visible mesh-surface distance.

Foot planting ran in the simulation and again on the target character during rendering. The target correction could immediately shift the pelvis by up to 10 cm at support thresholds. The visible pitch also sat 3.5 cm below the physics floor. Finger channels were absent from 2,136 of 2,313 admitted clips, and the grab added uncalibrated local-axis curls.

The original tests proved numerical skeleton validity, action/contact events and root continuity. They did not assert equality between visible and simulated contact joints. The new regressions cover that gap.

## Mesh fitting and binding

`native-skin.js` creates Three.js `Bone` objects with the original native names, hierarchy and rest transforms. `humanBoneMap` maps the original model's weighted joints to those bones. Every nonzero skin influence must map successfully; an unknown weighted bone fails with its name rather than silently deforming against another joint.

For each correspondence, the fitting transform moves the old joint centre to the native joint centre and aligns its anatomical bind frame. Limb directions establish the principal axis; finger/palm frames use the direction across index/pinky bases for the secondary axis. This fixes palm twist ambiguity and includes terminal finger directions. Positions and normals are fitted using the original normalized vertex influences. Skin indices are then remapped to the native hierarchy and native inverse-bind matrices are computed. Eyes and eyebrows follow the same binding. Hair is attached to the native head; the boots attach to the native feet.

The input mesh, topology, UVs and weights are preserved as the source of this fit. A separate `kitPosition` attribute keeps the original material-region coordinates, so proportion fitting does not move the shirt/shorts/sock colour boundaries. Fitting happens once per character creation. Runtime playback copies native local positions/quaternions directly into the bound skeleton.

This is a deterministic fitting/weight-transfer procedure, not an artist-approved deformation pass or recovered EA player model. Native helper/twist bones remain available; transferring the original mesh's influences does not invent missing corrective deformation weights. Extreme poses and close-up deformation still need visual review. The mesh remains CC0; original motion/rig data retains its existing provenance.

## One final pose

The pipeline is now:

```text
native sample + missing-hand-track reference
 -> state/gait blend and inertial transition
 -> one native foot/sole correction
 -> final renderPose
 -> gameplay hand/ankle/knee/elbow points AND native skinned rendering
```

Standing-interaction hand reaching occurs on the native action pose before its transition. Rendering does not run an extra hand IK or pelvis/leg correction. `FootballActor.updateFeet()` derives contact points from the same final local transforms that `human.js` applies to the mesh skeleton. World translation and heading are shared.

Contact volumes remain approximate wrist/forearm, ankle/leg and torso spheres/capsules. Equality of their joint anchors does not establish precise palm/cloth or boot-triangle collision. Shirt deformation, cloth gripping, finger-surface collision and a complete full-body collision solver are not implemented.

## Ground and soles

`foot-contact.js` defines the rigid boot sole ellipsoid in native foot coordinates. The same local centre and three scaled axes build the rendered sole and calculate its required ankle clearance under rotation. `FootPlanting` uses this clearance for support goals, adds smoothly weighted near-ground correction and preserves leg lengths through its existing two-bone solver. Ground correction has continuous support weights instead of the removed rendering-only pelvis snap.

Idle locks persist while valid rather than expiring every 0.42 seconds. Moving locks still release with their age, reach and height limits, using the existing smooth weight decay. Hip/foot-height ramps reduce standing correction as a player lifts a foot or falls. There is no arbitrary global skeleton scale adjustment. The rendered pitch is now at the simulation's `y=0`; pitch markings sit slightly above it.

The recovered knee network remains a bend hint. This change does not recover a complete native foot-contact policy or ragdoll solver.

## Hands and gait changes

`hand-poses.js` preserves animated native finger/metacarpal tracks when present. Missing tracks use a fixed native relaxed-hand reference from the baseline idle capture. An authored grip blends toward a native shirt-pull hand reference, including the thumb. References are normalized in the native joint frames. It no longer adds the same guessed local-Z rotation repeatedly to every finger.

These references are project choices, not reconstructed FC hand-controller logic. A clip without finger tracks still does not become a complete native finger performance.

When a newly selected gait replaces another, `MotionLibrary.matchGait` samples candidate phases and scores outgoing pelvis-relative foot positions and velocities before starting the existing inertial blend. It includes the original phase as a candidate, so its measured score cannot worsen. This improves phase agreement; it does not guarantee every source clip is visually smooth. Native action quality and transition tuning remain observable work.

## Reproduce and verify

Normal playback needs no Blender, new download or separate character conversion. Clone the repo and serve it over HTTP as described in [START-HERE.md](START-HERE.md).

```sh
npm ci
npm test
node tools/verify-runtime.cjs http://127.0.0.1:8080/ /path/to/evidence/runtime
node tools/verify-native-rig.cjs http://127.0.0.1:8080/ /path/to/evidence/rig
```

The current 52 Node tests include actual CC0 geometry/skin rebinding, source immutability, weight normalization, native joint/contact agreement under different headings/actions, tracked/missing fingers, nonaccumulating grip references, shared sole geometry/idle support continuity and gait phase score improvement. The Node skin fixture reads the committed glTF/bin directly; it does not substitute a synthetic stick figure.

The native-rig browser verifier measures visible native wrists/ankles against simulated endpoints through idle, jogging, tackle/fall/get-up and all five standing interactions. It checks actual skinned vertex positions for finite values, a shared native skeleton and settled idle soles, then captures character/hand/foot close-ups. The existing runtime browser verifier also checks desktop and touch controls, native kicks, contacts, goals and release. See [the evidence index](../evidence/README.md).

Further work should measure contact surfaces and transition velocity/acceleration, visually inspect a broader source sample, tune or reject unsuitable clips, and refine skin weights around wrists/shoulders/fingers. Do not declare the entire library artist-validated because its binary data and endpoint tests pass.

## Measured boundary of this correction

In the recorded eight-scenario browser check, visible wrists and ankles match the simulation to numerical precision (maximum below `6e-15` metres). Settled idle soles are within a fraction of a millimetre of the floor; sampled jogging penetration is below a millimetre. These are joint/proxy measurements, not artist approval of the mesh surface.

The same report deliberately records remaining ground intersections: an extreme side-pull and the tackle/fall sequence can put a sole roughly 18–20 cm below the pitch while the body is low. Standing support IK is not a full-body ground collision solver. Those poses need a constrained full-body/recovery policy or exclusion from automatic selection. Fast source limb motion also remains in the measured maximum step values. Do not label all source motions jitter-free or ground-safe based on the native skin correction.


## Shoulder-to-elbow fitting correction (19 November)

A second close-up review found that the original bind fit aligned segment directions and proximal joint centres, but used a rigid transform with no length adjustment. The native upper arms are about 20% longer than this model's upper arms. Consequently, transforming the model's elbow with its upper-arm fit missed the native elbow by 50.285 mm on each side. The forearm fit missed the wrist by 20.406 mm, and the clavicle fit missed the shoulder by 32.428 mm. These are **bind-fitting endpoint errors**, not measured visible triangle-to-joint distances during gameplay.

`native-skin.js` now adds an axial affine stretch for clavicle, upper arm and forearm only. For source segment unit direction `a` and target/source length ratio `r`, its linear part is `I + (r - 1) a a^T`, followed by the existing anatomical rotation and translation. This maps both endpoints exactly while preserving distances perpendicular to the segment. It does not scale the entire character or change source animation, native bone lengths, contact anchors, original geometry, or original skin weights. Normals use the inverse transpose of the complete fitting transform. Fitting still happens once at character creation; there is no extra per-frame pass or GPU palette expansion.

The regression uses the committed character's actual joints. Both sides must map clavicle-to-shoulder, shoulder-to-elbow and elbow-to-wrist endpoints within `1e-8` metres, preserve a 5 cm radial offset, and avoid axial/radial shear. The previous implementation fails the distal endpoint assertion. Existing actual-vertex tests continue to compare the compact phone palette with the full native palette.

```sh
npm test
node tools/verify-arm-fit.cjs http://127.0.0.1:8080/?quality=low evidence
node tools/verify-native-rig.cjs http://127.0.0.1:8080/?quality=low /path/to/evidence/rig
```

`verify-arm-fit.cjs` captures the same camera and native idle/jog/front-pull samples for repeatable comparison. `evidence/arm-fit-before-*.png` preserves the previous fit; `arm-fit-*.png` shows the correction. The native rig browser check still passes all eight scenarios, preserving rendered/contact joint equality to numerical precision. The separate 40-second phone check covers resource limits and deliberate context restoration in emulation, not physical device certification.

This fixes the verified length-fit defect. The CC0 superhero model still has sculpted deltoids/biceps, limited original shoulder weights, and no artist-authored native helper-bone deformation transfer. Close-up shoulder/underarm shapes can remain stylized or pinched in extreme poses. We did not identify and fix a decoder or axial-twist defect in this investigation, and should not claim otherwise. A less muscular model with carefully painted weights/corrective shapes remains the route to a more natural silhouette.

The serial phone verification passed: 40 seconds at about 30 fps, 4.34 MiB estimated 2D texture storage, 24 resident streamed clips, no page/request errors or natural context loss; forced loss restored the same world. A preceding parallel invocation timed out at startup without preserving its page state, so its exact cause is unknown. `verify-mobile.cjs` now saves `mobile-failure.json` with page status/error and available database/graphics state when a future run fails. This diagnostic change is not a claimed fix for that startup timeout.

The obsolete standalone Contact lab and fixed source viewer have been retired. Seven tests belonging only to that removed Z-up solver were removed with it; the active controller/codec/native-skin regressions, including arm endpoint/radial assertions, remain. Use START-HERE.md and ANIMATIONS.md for current setup/corpus counts. Historical counts in dated investigation notes describe their original revisions.
