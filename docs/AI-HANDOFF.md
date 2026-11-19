# Handoff to the next AI and developer

**Phone stability update:** phones now use smaller textures/framebuffers, bounded compact streaming and a compact GPU palette while retaining the full native rig. The main demo handles WebGL loss/restoration. [Measurements, tools and limits](MOBILE-STABILITY.md).

**Native rig update:** the CC0 mesh now binds directly to the native 369-bone hierarchy, sharing its final pose with gameplay contacts. One sole correction replaces the second render-time IK pass; native hand references and foot-phase matching improve missing fingers and gait changes. [Implementation, measurements and reproduction](NATIVE-RIG.md).

## Ready-to-use brief

> Build on https://github.com/rblaurent/football-tackle-lab for a small football manager/referee game for a child. Read docs/START-HERE.md, docs/ANIMATIONS.md, docs/NATIVE-RIG.md and docs/ANIMATION-SYSTEM.md, then docs/FULL-LIBRARY.md and docs/TACKLE-DIAGNOSIS.md. Inspect the actual source and evidence. The playable home page selects and streams from 2,313 measured native body clips across 17 families. It has continuous state/gait transitions, pursuit, contact-driven passing/shooting, tackles/falls/get-ups, native shirt-pull pairs, a native pusher composed with a native reaction at contact, arm grab and handball using native body bases with authored hand targeting, simple opponent pursuit/interception, goals and queued celebrations. The selector, transitions, navigation and physics are original code. Recovered knee-IK weights provide an analytic solver hint. No complete FC engine, PTM feature policy, ML-Flow, HyperMotion or match AI was recovered. Preserve the controller and run all 52 tests plus the runtime browser verifier. The complete installed extraction contains 46,351 resources, of which 44,037 decode; the automatic gameplay subset has measured admission gates and is not the entire library. Keep complete raw export/SDK/game binaries, codec reference source and credentials out of Git. Read provenance and qualifications before making claims. Build the smallest complete referee incident/decision/replay loop on this foundation.

The two current pages are `index.html` (play) and `library.html` (complete catalogue). The old Contact lab and small scene viewer are removed; their URLs redirect. Do not revive `demo.js`, `app.js` or the separate Z-up physics system from Git history. Use `python tools/fc27/document_inventory.py --check` to verify all runtime payload hashes and current availability documentation.

## Source map

- `controller-core.js`: fixed-step world, actor scheduler, navigation, kicks, tackle/fall/recovery, goals and simple opponent.
- `animation.js`: native registration, source sampling, gait phases/blends, inertial transitions, capture frames and recovery matching.
- `motion-database.js`, `motion-codec.js`: role/pose/context scoring, asynchronous integrity-checked streaming, cache/pinning and validated binary reader.
- `interactions.js`: shared-clock pairs, approaches, actual hand/torso/ball contact and release into the actor controller.
- `foot-planting.js`, `foot-contact.js`, `neural-ik.js`: one final native support pose/sole proxy and recovered knee hint.
- `native-skin.js`, `human.js`: native-bound skin and arm-length endpoint fitting, preserving phone/full palette equivalence.
- `controller-view.js`, `index.html`: desktop/touch input, rendering, score, action controls and inspector.
- `runtime/`: compiled measured metadata and 2,313 lazy native payloads. `controller-data.json` remains the small safe baseline, not the extraction scope.
- `tools/fc27/compile_runtime.py`, `audit_runtime.py`: build and validate the gameplay pack, including exact source-frame comparison.
- [Full extraction pipeline](FULL-LIBRARY.md), [all tools/provenance](TOOLS-AND-SOURCES.md), [binary formats](FORMATS.md), [original IK/controller research](CONTROLLER.md).

## Preserve these invariants

1. Source rest offsets are metres; selected animated translations are feet, converted once by 0.3048. XYZW quaternions, Y-up. The retired standalone Z-up experiment is no longer shipped.
2. Native captures sample at 30Hz; simulation runs at 120Hz. Frame ranges are inclusive. The source and live skin both use the native 369-bone hierarchy. The original CC0 template has 65 joints before fitting/rebinding. Channel counts vary by binding; do not assume one universal 34/12/8 layout.
3. Paired performers share a capture origin, frame and clock. Never independently zero the actor trajectories or run a second animation clock.
4. Navigation owns ordinary movement; locked actions use their native root in a fixed capture frame with bounded corrections. Heading changes must preserve rendered pose continuity. Never restore the old whole-body-spin or end-of-tackle snap.
5. Start from the actual outgoing pose/velocity. Preserve phase and inertial transitions when a newly streamed gait replaces another. Match get-ups to the grounded pose and rejoin useful movement.
6. Ball/leg/hand outcomes require measured contact. Moving the ball away must produce a miss. A goal during a locked shooting follow-through queues celebration rather than interrupting or losing it.
7. Missing, corrupted or pending streamed candidates must leave a valid resident/baseline action available. Keep active/pair clips pinned; do not block simulation on network fetches.
8. Complete source extraction, decoded/bound status, admission into automatic play and visual approval are separate facts. Unsupported/unknown motions remain explicitly indexed. Do not claim every resource is playable.
9. Hand/shirt proximity is not cloth simulation. Arm grab and deliberate handball retain authored hand targeting; the push is a composition of separate native performances, not a verified original paired capture.
10. Native learned scalar arrays alone do not establish feature layout, normalization or an executable motion-matching policy. Original scorer weights must not be attributed to EA.

## Verify before changing or publishing

```sh
npm ci
npm test
python -m http.server 8080 --bind 127.0.0.1
```

In another terminal:

```sh
node tools/verify-runtime.cjs http://127.0.0.1:8080/ /path/to/evidence
python tools/fc27/audit_runtime.py --report /path/to/evidence/runtime-audit.json
```

Use `python3` on Mac. The optional audit `--source native-library` additionally compares every byte against the complete decoded source export; install the pinned library requirements for NumPy. Browser verification uses installed Chrome and Playwright. Physical phone and Mac/Safari acceptance remain unverified.

The 52 tests include every connected standing interaction, real kick/contact misses, rotated native tackle encounters, get-up/release, cache/pinning/failure fallback, angular quality and newly streamed gait continuity. A normal-play test includes the opponent and scores from an actual approach/native shot, then completes celebration and returns to idle. `evidence/runtime-gameplay.mp4` is one continuous rendered sequence.

## Next useful work

Implement referee incidents and explicit outcome/replay metadata on this scheduler. Clean/late/missed challenges and holding/pushing rules should derive from contact timing and scenario rules. Add teammates, pass targets and goalkeepers as bounded behaviors, each with measured motion admission, correct entry/exit and negative tests. Expand airborne/header actions deliberately instead of assigning unknown clips by filename alone.

The [complete animation inventory](ANIMATIONS.md), full extraction pipeline and 2,314 pending codec/layout resources are documented in FULL-LIBRARY.md. A larger decoded catalogue does not automatically create appropriate live behavior: characterize the role/contact/ending posture and connect it to the scheduler. Preserve the known working game build/tool pins and original source hashes when extending extraction.
