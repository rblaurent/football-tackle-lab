"""Publish the complete lightweight catalogue and selected static-host previews.
The complete raw/decoded library stays in the user's local export folder.
"""
import argparse,gzip,json,shutil,re,collections
from pathlib import Path
from extract_fc27 import read_json,write_json

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--work',type=Path,required=True);p.add_argument('--out',type=Path,default=Path('library'));a=p.parse_args()
 rows=read_json(a.work/'catalog.json');summary=read_json(a.work/'summary.json');out=a.out;out.mkdir(parents=True,exist_ok=True);(out/'previews').mkdir(exist_ok=True)
 public=[];bindings={};clips=[]
 for row in rows:
  ident=row['id'];binding=row.get('channelMapGuid');bound=row.get('bindingStatus')=='bound';decoded=row.get('decodeStatus')=='decoded'
  full_body=bound and 'Hips' in row.get('qNames',[]) and len(row.get('qNames',[]))>=30
  # Publish named victory/celebration performances and the native two-handed push.
  # This is a hosting selection, never an extraction limit: every row remains listed.
  preview=full_body and decoded and bool(re.search(r'victory|celebr|stand_two_hands_push_off',row['name'],re.I))
  if preview:
   shutil.copyfile(a.work/'extracted'/(ident+'.motion.bin.gz'),out/'previews'/(ident+'.motion.bin.gz'));public.append(ident)
  if bound:
   entry={key:row[key] for key in ('qNames','vNames','fNames')}
   if binding in bindings:assert bindings[binding]==entry,'Context-dependent binding needs a separate key'
   bindings[binding]=entry
  clips.append({key:row[key] for key in ('id','name','codec','frames','rawStatus','bindingStatus','decodeStatus') if key in row}|{'binding':binding,'fullBody':full_body,'online':preview})
 payload={'summary':{k:v for k,v in summary.items() if k!='coverage'},'clips':clips,'bindings':bindings,'publicPreviewCount':len(public)}
 with gzip.open(out/'catalog.json.gz','wb',compresslevel=9) as f:f.write(json.dumps(payload,separators=(',',':')).encode())
 shutil.copyfile(a.work/'shared/skeleton.json',out/'skeleton.json')
 write_json(out/'extraction-summary.json',summary)
 print('Catalogue',len(rows),'clips;',len(public),'online previews;',sum(p.stat().st_size for p in (out/'previews').glob('*')),'preview bytes')
if __name__=='__main__':main()