# Evidence index

The current product has only the playable demo and full catalogue. The old Contact lab and source scene viewer were removed on 19 November; dated evidence from those experiments is retained as history, not as an active alternative demo or current renderer acceptance. See [current setup](../docs/START-HERE.md) and [generated full availability](../docs/ANIMATIONS.md).

Current cleanup and documentation acceptance:

- `cleanup-navigation.json`: main navigation plus all three old-URL redirects; no retired module/data requests or page errors.
- `cleanup-runtime.json`, `cleanup-library.json`: current desktop/touch gameplay and catalogue preview acceptance after removal.
- `python tools/fc27/document_inventory.py --check` checks the generated guide, all 2,313 runtime payload hashes and 338 preview paths. The 52 active Node tests pass; seven cases exclusive to the removed standalone physics implementation were retired with it.

Arm fitting correction:

- `arm-fit-before-{idle,jog,shirtFrontA}.png`: previous rigid arm fit.
- `arm-fit-{idle,jog,shirtFrontA}.png`, `arm-fit-visual.json`: corrected arm length fit, repeatable native poses and identical camera on the low-quality profile.
- `arm-fit-native.json`, `arm-fit-runtime.json`, `arm-fit-mobile.json`: native contact/skin, desktop/touch gameplay and emulated phone acceptance after the correction.
- [Exact fitting defect, regression and limits](../docs/NATIVE-RIG.md#shoulder-to-elbow-fitting-correction-19-november).

Current phone stability correction:

- `mobile-before.json`: previous public build's phone-sized texture/framebuffer/heap measurements; no physical-device crash reproduction claim.
- `mobile-verification.json`, `mobile-stable.png`: constrained 40-second real-loop soak and deliberate WebGL loss/restoration with the same playable world. Texture storage estimates exclude framebuffer/compositor/driver overhead.
- [Phone implementation and qualification](../docs/MOBILE-STABILITY.md).

Native skin correction:

- `native-rig-verification.json`: eight rendered/posed scenarios, native skeleton binding, visible wrist/ankle versus simulation errors, finite skinned vertices and sole measurements. It also records remaining extreme fall/side-pull ground intersections; these are not hidden by the passing endpoint checks.
- `rig-contact-before.json`: prior separate-rig measurements for the same defect, including the grab's 32 cm wrist discrepancy.
- `native-rig-character.png`, `native-rig-hand.png`, `native-rig-feet.png`: current close-up screenshots.
- `native-rig-runtime-browser.json`: desktop/touch runtime acceptance after the native skin change.

Automatic native animation system:

- `runtime-gameplay.mp4`, `runtime-capture.json`: one continuous 16-second, 480-frame sequence, approach/native shot, physical goal, celebration, then native push and contact-triggered reaction without resetting the world.
- `runtime-play.jpg`, `runtime-desktop.png`, `runtime-phone.png`: current rendered gameplay and controls.
- `runtime-browser-verification.json`: desktop and emulated-touch acceptance of native kicks and all five consecutive standing interactions, goals, input, finite skin matrices, layout and asset requests.
- `runtime-corpus-audit.json`: every one of the 2,313 shipped clips checked for compressed/raw hashes, binding/shape, finite samples/quaternion norms and exact equality to its decoded source frame range. No orphan payloads.
- `runtime-native-angles.json`: eight rotated native two-player tackle encounters and recovery; `runtime-play-goal.json`: normal approach/shot/goal/queued-celebration sequence with an active opponent.

Earlier evidence is preserved as historical investigation, not current acceptance. `interaction-*` predates native push selection; `controller-*` describes the original seventeen-clip controller; `tackle-*` records its root/orientation corrections. `library-*` records the complete extraction catalogue and native previews. `fc-lite-*` is the earlier source viewer; collision and numbered images show the original Gameplay Football baseline. Each report retains its own revision/timestamp.
