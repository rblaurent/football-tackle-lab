# Recovered controller metadata and neural IK

This guide documents source evidence and reproduction of the controller/IK bootstrap. For current play, streaming, transitions, roots and contacts read [ANIMATION-SYSTEM.md](ANIMATION-SYSTEM.md). For all available animations read [ANIMATIONS.md](ANIMATIONS.md); the full extraction is [FULL-LIBRARY.md](FULL-LIBRARY.md). The obsolete Contact lab and fixed scene viewer are no longer shipped.

Native rig/motions, selected PTM controller settings, feature schemas/weights and three IK networks were recovered. We did not reconstruct FC's full PTM search, complete trajectory-feature order/normalization, ML-Flow/HyperMotion, team AI or contact policy. State/selection/transition/physics code is ours. Recovered scalar arrays are not executable policy weights for an unrelated feature vector.

## What FC's data actually shows

The read-only probe used the installed PC Lite build described in [REPRODUCING.md](REPRODUCING.md): Steam build 22116598, game 1.0.142.20665. No game process, anti-cheat component, or executable patch is involved.

The expanded extraction profile decodes **22 selected clips**: the original eleven plus eleven locomotion/recovery candidates. Seventeen form the small fallback/bootstrap corpus; the live selector streams the separately compiled 2,313-clip pack. Some other candidates were useful to inspect but are not chosen by the running controller. `data.json` remains the original eleven-clip dataset; `controller-data.json` is the seventeen-clip fallback/bootstrap subset.

The optional controller extraction reads **33 named EBX assets** and resolves their embedded objects. The exact names, decoded/packed SHA1s, class GUIDs, fields, references and unresolved fields are in [`research/fc27-controller-assets.json`](../research/fc27-controller-assets.json). The report's `rawFile` fields refer to private local extraction outputs, not public repository files. No raw game archives, native SDK binaries or Oodle library are shipped.

Concrete recovered structures include:

- `antifreeze/assets/gameplay/locomotion/ptm/ptm_locomotion_controller`, with references to motion-database, scaling, blend, interrupt, phase-filter, locomotion-filter, time-scale, foot-warp, motion-warp, joint and pose-correction parameter objects.
- `.../locomotion/ptm/database/ptm_db/ptm_database_normal_f27_foundation`, containing a master database and five embedded PTM database objects. This is data, not an independently executing search engine.
- `.../ptm_database_normal_fwd_weights_f25`, `.../ptm_database_normal_start_weights_f21` and `.../ptm_database_drasticturn_weights_f25`, with feature-component weight vectors and current-animation biases.
- `_af/154bb3f3-5446-b997/pfa_ptm_database_normal_upgrader`, defining 31 valid feature components, padded to 32, with seven schema references.
- Native locomotion knee, arm and chest DNN IK models.

The tested embedded `PTMBlendParamsAsset` contains `BlendTicks=24`, `MaxActiveBlends=3`, `PoseFeaturesBlendTicks=8`, `BlendType=0` and `VelocityWeight` approximately 0.3. Crucially, it also points to `float_loco_blend_ticks`, whose stored default is **14**. The max/min time-scale overrides have stored defaults of approximately **1.05** and **0.85**. These are serialized defaults and override relationships; they are not a recording of the effective values during a running match. We have not established the tick unit, so do not casually convert 14 or 24 to seconds using the clip's 30 Hz timebase.

The forward/start/drastic-turn weight assets use a serialized squared-L2 metric enum. The observed current-animation biases are approximately **0.05 / 1.5 / 1.0**, respectively. These are evidence that retaining the current motion is explicitly controlled, rather than jumping to whichever clip happens to have the lowest instantaneous pose error. The report preserves duplicate named families under both normal and `_af` paths; do not assume they are interchangeable instances.

The seven feature ranges are:

| Component indices | Schema |
| --- | --- |
| 0-1 | Motion-type fields |
| 2-15 | Retained trajectory components |
| 16-18 | Left-foot position |
| 19-21 | Left-foot velocity |
| 22-24 | Right-foot position |
| 25-27 | Right-foot velocity |
| 28-30 | Hips heading-Y schema |

The offsets are directly stored as `[0,2,16,19,22,25,28]`. Foot and heading schemas also preserve their joint/reference-joint pointers and stripped-component flags. The trajectory schema keeps fourteen components and strips eight others. **The exact order, normalization and meaning of every trajectory scalar has not been reconstructed.** Do not copy these 31 weights onto a different feature vector and claim equivalent selection. Our runtime scorer uses its own measured context/pose features; see ANIMATION-SYSTEM.md.

### A schema trap we found

The public FMT FC26 SDK identifies many matching class GUIDs and useful field layouts. **A matching GUID does not guarantee that FC27 has the same layout.** FC27's root locomotion-controller object grew relative to the older schema. Reading its old scalar offsets produced plausible-looking nonsense, including integer bit patterns interpreted as tiny floats.

The portable reader therefore deliberately skips interpreting that root object's fields. It still identifies the root class and decodes the separate embedded parameter structures where the structural checks work. Unknown classes and unsupported/bad fields remain explicit in `unresolved`. The current report has 46 unresolved fields, including the skipped root layout. This is a bounded, partial inspector, not a complete universal EBX SDK.

Class metadata was inspected using public FMT release 26.10.9654.14105's FC26 SDK and ILSpy 9.1.0.7988. Only factual field metadata is packaged in `tools/fc27/controller-schema.json`; SDK/decompiler binaries and decompiled third-party source are not vendored. The original archive/codec pipeline, versions and pinned source are documented in [TOOLS-AND-SOURCES.md](TOOLS-AND-SOURCES.md).

## The recovered neural weights are usable

[`research/fc27-neural-ik.json`](../research/fc27-neural-ik.json) includes complete ordered layer data:

| Model | Dense dimensions | Dense coefficients | Inputs / outputs |
| --- | --- | --- | --- |
| `knee_loco_dnn` | 7 → 16 → 16 → 16 → 6 | 720 | Both foot XYZ positions and hips height → both knee XYZ positions |
| `arm1_loco_dnn` | 16 → 28 → 24 → 20 → 6 | 1,720 | Both hands, both upper arms, Spine3 XYZ and hips height → both elbow XYZ positions |
| `chest_loco_dnn` | 7 → 16 → 8 → 8 → 3 | 328 | Both upper arms XYZ and hips height → Spine3 XYZ |

Each network has eight ordered layers: four dense layers and four LeakyReLU layers, including an output activation. Biases, per-node slopes, input/output bounds, and names are included separately from the coefficient counts. The observed negative slopes are approximately 0.2. Native layer enum 0 is dense and 1 is LeakyReLU. Do not label it a PReLU layer just because slopes are stored per node.

RIFF internal object references required special care: the low word holds a **signed 32-bit relative offset**. A negative reference read as an unsigned 64-bit displacement appeared to point 4 GiB past the file. The cleaned reader validates every internal pointer against the EFIX object-offset list, then follows the network's `Layers` array in its stored order. Disk order is not execution order.

The following convention was inferred experimentally and is implemented in [`neural-ik.js`](../neural-ik.js):

1. Convert the relevant joint world positions into the animated hips' local coordinate frame: `inverse(hipsWorldRotation) * (jointWorldPosition - hipsWorldPosition)`.
2. Convert metres to native feet by dividing by 0.3048. Append hips world Y in feet for the named `HipsY` input.
3. Normalize each input with `(x - inputMin) / (inputMax - inputMin)`. There is no automatic clamp to [0,1].
4. For a dense layer, use **input-major** coefficients: `out[j] = bias[j] + sum(input[i] * weights[i * numNodes + j])`.
5. Apply `x < 0 ? alpha * x : x` for LeakyReLU.
6. Denormalize with `out * (outputMax - outputMin) + outputMin`. Convert the resulting hips-local points back through the hips transform and feet-to-metres scale.

We compared candidate matrix orientations and normalization ranges against decoded native gait poses. Knee reconstruction with this convention has **0.0247088 m RMSE per coordinate** across 240 sampled idle/walk/jog/sprint poses. The same convention gives approximately **0.0394835 m** for elbows and **0.0203679 m** for Spine3. Full results, including maximum joint errors, are in [`evidence/neural-ik-reconstruction.json`](../evidence/neural-ik-reconstruction.json). Knee maximum joint error is about 0.235 m; a low aggregate error is not a guarantee for every pose.

This is reconstruction against extracted clips, **not a comparison with EA runtime outputs**. Limb placement can be ambiguous, the evaluation is small, and training coverage is unknown. The live controller uses only the knee model, as a bounded bend hint; exact limb lengths and final foot placement come from our analytic two-bone solve. The arm and chest models are supplied for further investigation, not silently applied in the demo.

Reproduce the numerical check:

```sh
node tools/verify-neural-ik.mjs --out neural-check.json
```

## Reproduce the expanded extraction

Start with the Windows prerequisites and virtual environment from [REPRODUCING.md](REPRODUCING.md). Use your own installed game's folder and an output folder outside it. The examples below use placeholders, not paths from the original machine:

```powershell
$gamePath = 'D:\SteamLibrary\steamapps\common\EA SPORTS FC 27 Demo'
$workPath = 'D:\FootballWork\controller'
$outputPath = 'D:\FootballWork\controller-output'

python tools/fc27/extract_fc27.py --game $gamePath --work $workPath --profile tools/fc27/controller-profile.json --stage all
python tools/fc27/extract_controller.py --game $gamePath --work $workPath --out $outputPath
```

The first command indexes the installed archives with the extended clip/dependency profile, extracts and verifies payloads, binds all channels, downloads/verifies the pinned external codec if needed, decodes 22 selected clips and writes the work `data.json`. It retains the 33 controller assets in the filtered index through the new `researchAssets` profile field. The baseline profile remains compatible.

The second command writes:

- `raw/`: locally extracted EBX samples, with collision-resistant filenames.
- `controller-assets.json`: decoded object/parameter/dependency report with explicit unresolved fields.
- `neural-ik.json`: the three complete, ordered locomotion IK networks.
- `controller-data.json`: seventeen fallback motion clips selected from the first command's packed data.
- `validation.json`: asset counts, network dimensions/coefficient counts and unresolved-field total.

To use a new extraction locally, copy `controller-data.json` to the repository root and `neural-ik.json` to `research/fc27-neural-ik.json`. Keep the extraction report and raw payloads for your own evidence; the browser does not need raw EBX or installed-game access. The provided sample files already let your friend run the demo on a Mac without extraction.

The initial expanded pipeline was run from an **empty work folder**. After the tackle investigation, all 22 clips were decoded/packed again with corrected overlapping-tail indexing, and the current seventeen-clip controller export was rerun using that verified index/extracted input. All seventeen fallback/bootstrap clips, all three networks and the complete controller report match the committed JSON after parsing. The runtime victim clip replaces the stunt clip, and the current subset adds the four shirt-pull actor clips; the expanded 22 and baseline eleven selections are unchanged. The filtered index retained 35,762 entries on this tested build; it is intentionally much smaller than the historical all-asset research index. See [`evidence/controller-reproduction.json`](../evidence/controller-reproduction.json) for the authoritative count if a later profile changes it.

The profile is tied to the tested build. On another patch/game, reject missing assets, hash/size failures, invalid pointers, missing DOFs, unsupported codecs, bad quaternion norms or neural dimensions. Do not suppress failures or replace missing values with zero. The scalar sampling and codec timebase details remain in [FORMATS.md](FORMATS.md).


## Current runtime and verification

The native 369-bone hierarchy drives both the final simulated contact anchors and fitted CC0 skin. There is one support/sole solve and no second target-rig IK pass. The shoulder/elbow/wrist length fit, missing native finger references and remaining extreme-pose limits are documented in [NATIVE-RIG.md](NATIVE-RIG.md). [ANIMATION-SYSTEM.md](ANIMATION-SYSTEM.md) owns the current states, gait/entry matching, inertial transitions, bounded root warping, streaming and contact events.

```sh
npm ci
npm test
node tools/verify-neural-ik.mjs --out neural-check.json
node tools/verify-runtime.cjs http://127.0.0.1:8080/ /path/to/evidence/runtime
node tools/verify-native-rig.cjs http://127.0.0.1:8080/ /path/to/evidence/rig
```

The fallback bootstrap above is not the full extraction. After [FULL-LIBRARY.md](FULL-LIBRARY.md), compile the complete admitted gameplay pack with `python tools/fc27/compile_runtime.py --work native-library --out runtime`, audit it, then regenerate/check [the inventory](ANIMATIONS.md). The supplied committed data already supports normal playback without any extraction.
