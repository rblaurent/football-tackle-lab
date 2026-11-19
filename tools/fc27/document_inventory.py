"""Generate/check the animation availability guide from shipped manifests, verifying payload coverage."""
import argparse, collections, gzip, hashlib, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
ROLES = [
 ('idle','Idle','Stop; quiet waiting after actions'),
 ('walk','Walk cycles','Pace Walk; slow navigation'),
 ('jog','Jog cycles','Pace Jog; pursuit/navigation'),
 ('sprint','Sprint cycles','Shift or Pace Sprint'),
 ('start','Starts','Automatic idle-to-movement entry'),
 ('stop','Stops','Stop or arrival/braking'),
 ('turn','Turns','Large moving direction changes'),
 ('tackle','Slide tackles','Tackle/Space; Player tackle scenario'),
 ('fall','Falls','Actual player contact; ordinary fall admission rules'),
 ('recover','Get-ups','Automatic pose-matched recovery after fall/tackle'),
 ('pass','Passes','Pass/E; actual foot/ball contact'),
 ('shoot','Shots','Shoot/F; actual foot/ball contact'),
 ('push','Pushers','Push interaction or Challenge'),
 ('pushReaction','Pushed reactions','Selected separately at push contact'),
 ('block','Blocks','Native body base for deliberate handball scenario'),
 ('shirtPair','Shirt-pair actor performances','Front/side shirt pull; paired body base for arm grab'),
 ('celebrate','Celebrations','Goal queues celebration; Celebrate requests directly'),
]

def build():
 catalog_bytes=(ROOT/'library/catalog.json.gz').read_bytes()
 manifest_bytes=(ROOT/'runtime/manifest.json.gz').read_bytes()
 catalog=json.loads(gzip.decompress(catalog_bytes)); manifest=json.loads(gzip.decompress(manifest_bytes))
 rows=catalog['clips']; entries=manifest['entries']; by_id={r['id']:r for r in rows}
 assert len(by_id)==len(rows)==catalog['summary']['total'], 'Catalogue counts/IDs disagree'
 assert all(r['rawStatus']=='verified' for r in rows), 'Unverified raw status'
 assert len({e['id'] for e in entries})==len(entries), 'Duplicate runtime segment'
 families=collections.Counter(e['family'] for e in entries)
 assert dict(families)==manifest['roles'] and set(families)=={r[0] for r in ROLES}, 'Update documented families'
 for e in entries:
  source=by_id[e['sourceId']]
  assert source['name']==e['name'] and source['decodeStatus']=='decoded' and source['bindingStatus']=='bound' and source['fullBody'], 'Runtime source mismatch'
  payload=(ROOT/'runtime/clips'/(e['id']+'.bin.gz')).read_bytes()
  assert len(payload)==e['bytes'] and hashlib.sha256(payload).hexdigest()==e['sha256'], 'Missing/corrupt runtime '+e['id']
 assert sum(e['bytes'] for e in entries)==manifest['bytes'], 'Runtime byte total mismatch'
 previews=[r for r in rows if r['online']]
 assert len(previews)==catalog['publicPreviewCount']
 for row in previews:
  assert row['decodeStatus']=='decoded' and row['bindingStatus']=='bound' and row['fullBody']
  assert (ROOT/'library/previews'/(row['id']+'.motion.bin.gz')).is_file(), 'Missing preview '+row['id']
 decoded=sum(r['decodeStatus']=='decoded' for r in rows)
 bound=sum(r['bindingStatus']=='bound' for r in rows)
 decoded_bound=sum(r['decodeStatus']=='decoded' and r['bindingStatus']=='bound' for r in rows)
 body=sum(r['decodeStatus']=='decoded' and r['bindingStatus']=='bound' and r['fullBody'] for r in rows)
 overlap=len({e['sourceId'] for e in entries}&{r['id'] for r in previews})
 codecs=collections.defaultdict(lambda:[0,0])
 for row in rows:
  codecs[row['codec']][0]+=1;codecs[row['codec']][1]+=row['decodeStatus']=='decoded'
 lines=['# All animation availability','',
 'Generated from the committed catalogue and runtime manifest by `python tools/fc27/document_inventory.py`. Run with `--check` to detect stale documentation and verify every shipped runtime payload hash and whole-capture preview path. Counts describe the tested installed build, not another FC installation.','',
 '[Play](https://rblaurent.github.io/football-tackle-lab/) · [Search all original names/statuses](https://rblaurent.github.io/football-tackle-lab/library.html) · [Setup and handoff](START-HERE.md).','',
 '## Extraction, decoding and actual playback','',
 '| Layer | Count | Availability |','| --- | ---: | --- |',
 f'| Discovered, raw-extracted resources | {len(rows):,} | Complete searchable catalogue; original EBX/RES in local export. |',
 f'| Decoded numeric channel resources | {decoded:,} | Full export; includes nonbody scalar/face/camera/prop data. |',
 f'| Resources with named channel bindings | {bound:,} | A binding does not imply a decoded or humanoid performance. |',
 f'| Decoded and named-bound resources | {decoded_bound:,} | Full export. |',
 f'| Decoded/bound body candidates | {body:,} | Catalogue full-body heuristic, not visual approval or automatic-play admission. |',
 f'| Live gameplay body clips | {len(entries):,} | Every payload included in Git, ZIP and public site; streamed on demand. |',
 f'| Whole-capture online body previews | {len(previews):,} | Selectable in the catalogue; separate hosting selection. |',
 f'| Raw resources not yet decoded | {len(rows)-decoded:,} | Explicit failure/unsupported status; original payload preserved locally. |','',
 f'The {len(entries):,} live entries reference {len({e["sourceId"] for e in entries}):,} source resources. {overlap:,} of those resources also have a whole-capture online preview, so these collections overlap. The catalogue browser currently plays its {len(previews):,} bundled whole-capture previews, or decoded/bound body files from a complete local export. It does not offer every trimmed runtime segment as a standalone preview; those segments are used by the playable controller.','',
 f'The runtime payloads total {sum(e["bytes"] for e in entries):,} compressed bytes. The complete decoded local export totals {catalog["summary"]["decodedCompressedBytes"]:,} bytes and is not in Git/Pages/the ZIP. Copy the entire `native-library/` folder beside the project or follow [FULL-LIBRARY.md](FULL-LIBRARY.md) to reproduce it.','',
 '## Every live family','',
 '| Native family | Clips | How it becomes actionable |','| --- | ---: | --- |']
 for key,label,control in ROLES:lines.append(f'| {label} (`{key}`) | {families[key]:,} | {control} |')
 lines += [f'| **Total** | **{len(entries):,}** | **{len(families)} connected families** |','',
 'Victory/celebration resources are preserved in the full catalogue and represented in online previews. Only measured celebrations compatible with the field controller are admitted to `celebrate`; not every cinematic victory is appropriate during play. Search `victory` or `celebr` in the catalogue. Search `shirt`, `push`, `ref`, `keeper`, `header` or any original-name substring to inspect other resources and their real status. A name match alone does not prove its behavior is implemented.','',
 f'The {families["shirtPair"]} shirt entries are individual actor performances, not 62 complete paired encounters. Arm grab and deliberate handball adapt native body bases with authored hand goals. Push composes a native pusher with a separately selected native reaction at measured contact; it is not claimed as an original paired capture. [Interaction provenance and lifecycle](INTERACTIONS.md).','',
 '## Complete codec coverage','',
 '| Codec | Extracted | Decoded | Pending |','| --- | ---: | ---: | ---: |']
 for codec in ['VBR','RAW','ECLIPSE','FRAM','DCT','CURVE']:
  total,done=codecs[codec];lines.append(f'| {codec} | {total:,} | {done:,} | {total-done:,} |')
 lines += ['',
 f'{len(rows)-decoded:,} resources remain undecoded; the table above gives every codec total. The pending Eclipse variants in this build are quaternion/vector layouts. Decoded Eclipse data is scalar curves, not automatically a body animation. {len(rows)-bound:,} resources lack named bindings; {decoded-decoded_bound:,} of those have decoded numeric data. Inspect each row independently instead of treating extraction, decoding, binding and visual support as the same status.','',
 '## Machine-readable access for the friend and their AI','',
 '| File | Contents |','| --- | --- |',
 '| [`library/catalog.json.gz`](../library/catalog.json.gz) | Every original ID/name, codec, frame count, raw/decode/binding status, fullBody/online flags and named bindings. |',
 '| [`runtime/manifest.json.gz`](../runtime/manifest.json.gz) | Every admitted segment ID/source ID/name/family, source frame range, named binding, measured features, hashes and compressed bytes. |',
 '| [`runtime/build-report.json`](../runtime/build-report.json) | Admission totals and rejection reasons. |',
 '| [`library/extraction-summary.json`](../library/extraction-summary.json) | Full installed scan/decode/binding totals and archive coverage. |',
 '| `native-library/catalog.json`, `summary.json`, `coverage.json` | Full local export metadata, original hashes and archive errors. Not bundled in the public project. |','',
 'From the repository root:','',
 '```python','import gzip, json','from pathlib import Path',
 "catalog = json.loads(gzip.decompress(Path('library/catalog.json.gz').read_bytes()))",
 "runtime = json.loads(gzip.decompress(Path('runtime/manifest.json.gz').read_bytes()))",
 "victories = [r for r in catalog['clips'] if 'victory' in r['name'].lower()]",
 "for clip in runtime['entries']:",
 "    print(clip['family'], clip['name'], clip['range'], clip['id'])",'```','',
 'Public/checkout paths: whole captures use `library/previews/<source-id>.motion.bin.gz`; runtime segments use `runtime/clips/<segment-id>.bin.gz`; full local bodies use `native-library/extracted/<source-id>.motion.bin.gz`. These are gzip FCL1 frame/channel payloads, not FBX/GLB files. Use the matching named binding and native rig, convert animated feet to metres once, and preserve the common capture frame for a pair. [Binary format](FULL-LIBRARY.md#validation-and-formats), [runtime sampler](ANIMATION-SYSTEM.md), [native skin](NATIVE-RIG.md).','',
 '## Add a supported action without pretending all data is playable','',
 'Follow [the runtime compiler/admission guide](ANIMATION-SYSTEM.md#how-a-motion-becomes-eligible): characterize the source, entry/exit posture, contact and root motion; extend the family policy and scheduler; compile; inspect; test success/miss/release and phone budgets. Unclassified/unsupported resources stay in the complete catalogue. Keeper, heading, aerial, cinematic, face and prop resources are not automatically wired into outfield play. A decoded clip is not an extracted FC policy or an artist-validated performance.','']
 return '\n'.join(lines)

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
 path=ROOT/'docs/ANIMATIONS.md';text=build()
 if args.check:
  assert path.read_text(encoding='utf-8')==text, 'Animation guide stale; run document_inventory.py'
 else:path.write_text(text,encoding='utf-8')
 print('Animation inventory current; all runtime payload hashes and preview paths verified.')
if __name__=='__main__':main()
