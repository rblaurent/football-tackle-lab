# All animation availability

Generated from the committed catalogue and runtime manifest by `python tools/fc27/document_inventory.py`. Run with `--check` to detect stale documentation and verify every shipped runtime payload hash and whole-capture preview path. Counts describe the tested installed build, not another FC installation.

[Play](https://rblaurent.github.io/football-tackle-lab/) · [Search all original names/statuses](https://rblaurent.github.io/football-tackle-lab/library.html) · [Setup and handoff](START-HERE.md).

## Extraction, decoding and actual playback

| Layer | Count | Availability |
| --- | ---: | --- |
| Discovered, raw-extracted resources | 46,351 | Complete searchable catalogue; original EBX/RES in local export. |
| Decoded numeric channel resources | 44,037 | Full export; includes nonbody scalar/face/camera/prop data. |
| Resources with named channel bindings | 46,314 | A binding does not imply a decoded or humanoid performance. |
| Decoded and named-bound resources | 44,005 | Full export. |
| Decoded/bound body candidates | 33,387 | Catalogue full-body heuristic, not visual approval or automatic-play admission. |
| Live gameplay body clips | 2,313 | Every payload included in Git, ZIP and public site; streamed on demand. |
| Whole-capture online body previews | 338 | Selectable in the catalogue; separate hosting selection. |
| Raw resources not yet decoded | 2,314 | Explicit failure/unsupported status; original payload preserved locally. |

The 2,313 live entries reference 2,313 source resources. 104 of those resources also have a whole-capture online preview, so these collections overlap. The catalogue browser currently plays its 338 bundled whole-capture previews, or decoded/bound body files from a complete local export. It does not offer every trimmed runtime segment as a standalone preview; those segments are used by the playable controller.

The runtime payloads total 95,403,500 compressed bytes. The complete decoded local export totals 3,815,002,718 bytes and is not in Git/Pages/the ZIP. Copy the entire `native-library/` folder beside the project or follow [FULL-LIBRARY.md](FULL-LIBRARY.md) to reproduce it.

## Every live family

| Native family | Clips | How it becomes actionable |
| --- | ---: | --- |
| Idle (`idle`) | 466 | Stop; quiet waiting after actions |
| Walk cycles (`walk`) | 23 | Pace Walk; slow navigation |
| Jog cycles (`jog`) | 102 | Pace Jog; pursuit/navigation |
| Sprint cycles (`sprint`) | 65 | Shift or Pace Sprint |
| Starts (`start`) | 32 | Automatic idle-to-movement entry |
| Stops (`stop`) | 30 | Stop or arrival/braking |
| Turns (`turn`) | 92 | Large moving direction changes |
| Slide tackles (`tackle`) | 13 | Tackle/Space; Player tackle scenario |
| Falls (`fall`) | 23 | Actual player contact; ordinary fall admission rules |
| Get-ups (`recover`) | 376 | Automatic pose-matched recovery after fall/tackle |
| Passes (`pass`) | 512 | Pass/E; actual foot/ball contact |
| Shots (`shoot`) | 263 | Shoot/F; actual foot/ball contact |
| Pushers (`push`) | 2 | Push interaction or Challenge |
| Pushed reactions (`pushReaction`) | 31 | Selected separately at push contact |
| Blocks (`block`) | 119 | Native body base for deliberate handball scenario |
| Shirt-pair actor performances (`shirtPair`) | 62 | Front/side shirt pull; paired body base for arm grab |
| Celebrations (`celebrate`) | 102 | Goal queues celebration; Celebrate requests directly |
| **Total** | **2,313** | **17 connected families** |

Victory/celebration resources are preserved in the full catalogue and represented in online previews. Only measured celebrations compatible with the field controller are admitted to `celebrate`; not every cinematic victory is appropriate during play. Search `victory` or `celebr` in the catalogue. Search `shirt`, `push`, `ref`, `keeper`, `header` or any original-name substring to inspect other resources and their real status. A name match alone does not prove its behavior is implemented.

The 62 shirt entries are individual actor performances, not 62 complete paired encounters. Arm grab and deliberate handball adapt native body bases with authored hand goals. Push composes a native pusher with a separately selected native reaction at measured contact; it is not claimed as an original paired capture. [Interaction provenance and lifecycle](INTERACTIONS.md).

## Complete codec coverage

| Codec | Extracted | Decoded | Pending |
| --- | ---: | ---: | ---: |
| VBR | 34,876 | 34,876 | 0 |
| RAW | 4,289 | 4,289 | 0 |
| ECLIPSE | 4,893 | 4,826 | 67 |
| FRAM | 46 | 46 | 0 |
| DCT | 2,234 | 0 | 2,234 |
| CURVE | 13 | 0 | 13 |

2,314 resources remain undecoded; the table above gives every codec total. The pending Eclipse variants in this build are quaternion/vector layouts. Decoded Eclipse data is scalar curves, not automatically a body animation. 37 resources lack named bindings; 32 of those have decoded numeric data. Inspect each row independently instead of treating extraction, decoding, binding and visual support as the same status.

## Machine-readable access for the friend and their AI

| File | Contents |
| --- | --- |
| [`library/catalog.json.gz`](../library/catalog.json.gz) | Every original ID/name, codec, frame count, raw/decode/binding status, fullBody/online flags and named bindings. |
| [`runtime/manifest.json.gz`](../runtime/manifest.json.gz) | Every admitted segment ID/source ID/name/family, source frame range, named binding, measured features, hashes and compressed bytes. |
| [`runtime/build-report.json`](../runtime/build-report.json) | Admission totals and rejection reasons. |
| [`library/extraction-summary.json`](../library/extraction-summary.json) | Full installed scan/decode/binding totals and archive coverage. |
| `native-library/catalog.json`, `summary.json`, `coverage.json` | Full local export metadata, original hashes and archive errors. Not bundled in the public project. |

From the repository root:

```python
import gzip, json
from pathlib import Path
catalog = json.loads(gzip.decompress(Path('library/catalog.json.gz').read_bytes()))
runtime = json.loads(gzip.decompress(Path('runtime/manifest.json.gz').read_bytes()))
victories = [r for r in catalog['clips'] if 'victory' in r['name'].lower()]
for clip in runtime['entries']:
    print(clip['family'], clip['name'], clip['range'], clip['id'])
```

Public/checkout paths: whole captures use `library/previews/<source-id>.motion.bin.gz`; runtime segments use `runtime/clips/<segment-id>.bin.gz`; full local bodies use `native-library/extracted/<source-id>.motion.bin.gz`. These are gzip FCL1 frame/channel payloads, not FBX/GLB files. Use the matching named binding and native rig, convert animated feet to metres once, and preserve the common capture frame for a pair. [Binary format](FULL-LIBRARY.md#validation-and-formats), [runtime sampler](ANIMATION-SYSTEM.md), [native skin](NATIVE-RIG.md).

## Add a supported action without pretending all data is playable

Follow [the runtime compiler/admission guide](ANIMATION-SYSTEM.md#how-a-motion-becomes-eligible): characterize the source, entry/exit posture, contact and root motion; extend the family policy and scheduler; compile; inspect; test success/miss/release and phone budgets. Unclassified/unsupported resources stay in the complete catalogue. Keeper, heading, aerial, cinematic, face and prop resources are not automatically wired into outfield play. A decoded clip is not an extracted FC policy or an artist-validated performance.
