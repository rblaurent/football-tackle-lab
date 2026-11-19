# Phone stability and WebGL recovery

Laurent reported that the native-rig demo lost WebGL on his Android phone after a few seconds. The exact phone/browser and physical-device failure have not yet been reproduced. Desktop touch emulation alone did not establish mobile GPU safety.

## Evidence and likely pressure

An instrumented Chrome phone-sized run of the previous public build used approximately **136.7 MiB of allocated 2D texture storage**, excluding browser framebuffers/compositor and driver overhead. Its canvas was 721x1601 at a 412x915 CSS viewport, with antialiasing and preserved drawing buffers enabled, soft shadows and full-size character maps. The animation cache reached 64 resident clips; sampled JavaScript heap use peaked around 68 MiB in that short run.

The revised constrained run recorded approximately **4.34 MiB** of texture storage, a 412x915 drawing buffer, 24 resident clips and sampled heap values around 23–33 MiB. It ran for 40 real seconds at device scale factor 3, emulated device memory 2 GiB, CPU throttling 4x and a 192 MiB JavaScript old-space limit. No natural context loss or page error occurred. The test then deliberately lost WebGL and restored the same playable world.

These are instrumented browser estimates, not direct GPU memory telemetry or proof of the exact physical-phone cause. Different sampling durations and garbage collection affect heap comparisons. GPU driver, tab eviction and whole-browser failures can have additional causes.

## Rendering profiles

`render-profile.js` selects the mobile profile for phone user agents, smaller coarse-pointer devices or reported memory <=4 GiB. `?quality=low` forces it; `?quality=high` explicitly opts into desktop settings.

| Setting | Mobile | Desktop |
| --- | --- | --- |
| Maximum pixel ratio | 1 | 1.5 |
| Target render rate | 30 fps | 60 fps |
| MSAA / dynamic shadows | Disabled | Enabled |
| Preserve drawing buffer | Disabled | Disabled |
| Character maps | 512 diffuse; 256 eye; no normal/roughness maps | Original maps |
| Character shading | Lambert | Original standard material |
| Streamed clip estimate target | 8 MiB | 32 MiB |
| Resident clip target | 24 | 64 |
| Concurrent clip fetches | 1 | 3 |
| Maximum pending clip jobs | 24 | 64 |
| Candidate prefetch count | 1 | 2 |

The streamed size target excludes the baseline JSON clips, manifest, scene, textures and other browser overhead. Mandatory and active motions are pinned, so pathological custom budgets may remain above a configured estimate. These are not total-memory guarantees.

`character/mobile/` glTF variants reuse the original geometry buffers. Only diffuse maps are resized; normal and roughness material references are removed. Generate them reproducibly with:

```sh
node tools/build-mobile-assets.cjs
```

This requires the FFmpeg CLI used by the existing evidence pipeline. The generated build report records asset hashes. Source/derived character art retains its CC0 provenance. No image generation or new character model is involved.

The main demo, catalogue and original source viewer use the lighter phone asset/render limits. The main playable controller additionally owns the context-loss recovery/status handling described below.

## The native rig and performances remain intact

The full **369-bone native hierarchy** still calculates the animation. On phones only the **62 bones referenced by nonzero vertex weights** are uploaded in the GPU palette. Palette entries reference those same native bone objects. Remapping skin indices reduces the bone texture without adding a retargeting stage or changing deformation; a regression compares actual skinned vertices against the full palette.

Streamed motion data now stays in one validated packed Float32Array per clip. Sampling reads offsets directly instead of retaining a separate typed-array view for every frame/channel. Quaternion validation, source checksums, float32 samples, interpolation, phase and contact logic are preserved. Tests compare packed/expanded sampled quaternion components exactly and positions numerically. The original expanded decoder remains available for compatibility.

## Recovery behavior

The main canvas handles `webglcontextlost`, prevents its default destruction path and pauses rendering/simulation while retaining the world. It shows a recovery notice. On `webglcontextrestored`, rendering resumes with shadows disabled and a pixel-ratio cap of 0.75. If restoration does not arrive within eight seconds, a visible link reloads the lighter demo. There is no automatic reload loop.

Hidden documents stop the main animation loop and reset the render clock on return. A tab/browser process killed by the operating system cannot run its own recovery handler. This is why reducing allocation pressure is necessary alongside context recovery.

## Verification

```sh
npm ci
npm test
node tools/verify-mobile.cjs http://127.0.0.1:8080/ /path/to/evidence/mobile
node tools/verify-runtime.cjs http://127.0.0.1:8080/ /path/to/evidence/runtime
```

There are 52 active Node tests, including compact GPU-palette equivalence, exact packed animation sampling, phone profile limits and bounded single-fetch streaming. The mobile verifier runs a timed constrained soak, checks resource limits and absence of original large-texture requests, then uses the real `WEBGL_lose_context` extension and verifies restoration preserves the same world and resumes frames. `mobile-verification.json` records constraints, every measurement, resource estimate scope and recovery outcome.

Desktop/touch gameplay acceptance still covers native passing/shooting, every standing interaction, goals and input. Catalogue and source-clip viewers are also checked. Successful emulation does not replace Laurent retrying on the physical phone; the device/driver-specific crash remains unconfirmed until that happens.

This change follows the smaller-buffer/resource-budget and context-loss guidance in [MDN's WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) and the renderer/context options in the [Three.js renderer documentation](https://threejs.org/docs/pages/WebGLRenderer).
