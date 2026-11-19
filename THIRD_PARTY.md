# Third-party assets and code

The repository contains components with different licenses. The root Unlicense applies to Nova's original viewer, kit shader, retargeting/orchestration and extraction scripts, not to third-party materials.

| Files | Source | License / status |
| --- | --- | --- |
| `character/` | Quaternius, Universal Base Characters Standard, athletic male and buzzed hair | CC0 1.0. Included `character/LICENSE-QUATERNIUS.txt`. https://quaternius.com/packs/universalbasecharacters |
| `vendor/` | Three.js r187 and official example loaders, utilities, controls/exporter | MIT, included `vendor/LICENSE-THREE.txt`. https://github.com/mrdoob/three.js |
| `data.json`, `controller-data.json`, `research/fc27-controller-assets.json`, `research/fc27-neural-ik.json` (FC rig, motions, serialized controller data and trained IK weights) | Owner-installed EA SPORTS FC 27 Lite, Steam app 4407750, game build 1.0.142.20665 | Copyright remains with the respective rights holders. No open-source license or redistribution permission is asserted for these game-derived assets. The root Unlicense does not apply. |
| Historical Gameplay Football screenshots/video retained in `evidence/`; obsolete source assets/viewer removed | Bastiaan Konings Schuiling; google-research/football at 3d9e754720a95621bba6475c4d3b0d56fe919014, third_party/gfootball_engine | Unlicense; included `LICENSE-GAMEPLAY-FOOTBALL.txt`. |

The current playable pack contains 2,313 native body segments; the complete searchable catalogue lists 46,351 discovered resources, with 338 whole-capture body previews online. `data.json` is the eleven-clip extraction comparison fixture; `controller-data.json` is the seventeen-clip fallback/bootstrap corpus. Neither defines the full runtime selection scope. `research/` includes selected serialized controller settings and three locomotion IK networks. The complete raw/decoded `native-library/` export, game installation/executables, Oodle, FMT binaries and privately adapted reference codec are not in Git/Pages. [Current animation availability](docs/ANIMATIONS.md).

Screenshots/videos identify the dated study they capture. This project is an independent experiment and is not affiliated with or endorsed by EA, FIFA or Quaternius.

The extraction helper fetches an external reference VbrClip.cs locally at a pinned commit and SHA256; its license was not established. It is not vendored here or covered by the root Unlicense. See docs/TOOLS-AND-SOURCES.md. New tools/fc27/decode host/adapter code is original project glue. Playwright is an optional npm development dependency, not a browser runtime asset.
