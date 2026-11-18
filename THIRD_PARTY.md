# Third-party assets and code

The repository contains components with different licenses. The root Unlicense applies to Nova's original viewer, kit shader, retargeting/orchestration and extraction scripts, not to third-party materials.

| Files | Source | License / status |
| --- | --- | --- |
| `character/` | Quaternius, Universal Base Characters Standard, athletic male and buzzed hair | CC0 1.0. Included `character/LICENSE-QUATERNIUS.txt`. https://quaternius.com/packs/universalbasecharacters |
| `vendor/` | Three.js r187 and official example loaders, utilities, controls/exporter | MIT, included `vendor/LICENSE-THREE.txt`. https://github.com/mrdoob/three.js |
| `data.json`, `controller-data.json`, `research/fc27-controller-assets.json`, `research/fc27-neural-ik.json` (FC rig, motions, serialized controller data and trained IK weights) | Owner-installed EA SPORTS FC 27 Lite, Steam app 4407750, game build 1.0.142.20665 | Copyright remains with the respective rights holders. No open-source license or redistribution permission is asserted for these game-derived assets. The root Unlicense does not apply. |
| Earlier Gameplay Football assets, including `upstream/`, `extracted.json`, `animation-library.json` and `football-player-animations.glb` | Bastiaan Konings Schuiling; google-research/football at 3d9e754720a95621bba6475c4d3b0d56fe919014, third_party/gfootball_engine | Unlicense; included `LICENSE-GAMEPLAY-FOOTBALL.txt`. |

The baseline FC viewer uses eleven selected clips. The expanded extractor decodes 22 candidates, the continuous controller uses thirteen, and the research files contain selected controller metadata and three locomotion IK models; it does not include the installed game, the full motion library, game executables, Oodle, FMT binaries or the privately adapted reference codec. Screenshots/videos identify the study they capture. This project is an independent experiment and is not affiliated with or endorsed by EA, FIFA or Quaternius.

The extraction helper fetches an external reference VbrClip.cs locally at a pinned commit and SHA256; its license was not established. It is not vendored here or covered by the root Unlicense. See docs/TOOLS-AND-SOURCES.md. New tools/fc27/decode host/adapter code is original project glue. Playwright is an optional npm development dependency, not a browser runtime asset.
