"""Audit source checksums, all decoded headers/bindings, and legacy float32 parity."""
import argparse,gzip,hashlib,struct,collections,json
from pathlib import Path
import numpy as np
from extract_fc27 import read_json,write_json
from formats import require

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--work',type=Path,required=True);p.add_argument('--baseline',type=Path);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
 rows=read_json(a.work/'catalog.json');counts=collections.Counter();raw_bytes=0;binary_bytes=0;by_name={r['name']:r for r in rows}
 require(len({r['id'] for r in rows})==len(rows),'ID collision')
 for r in rows:
  require(r['rawStatus']=='verified','Failed source asset remains')
  for kind in ('ebx','res'):
   path=a.work/'extracted'/(r['id']+'.'+kind);data=path.read_bytes();raw_bytes+=len(data)
   require(hashlib.sha1(data).hexdigest()==r[kind+'Checks']['sha1Decoded'],'Local raw checksum changed: '+r['id'])
   counts['verifiedRawFiles']+=1
  counts['resources/'+r['codec']]+=1
  if r.get('decodeStatus')!='decoded':continue
  path=a.work/'extracted'/(r['id']+'.motion.bin.gz');binary_bytes+=path.stat().st_size
  with gzip.open(path,'rb') as h:head=h.read(24)
  magic,frames,q,v,f,fps=struct.unpack('<4s5i',head)
  require(magic==b'FCL1' and fps==30 and frames==r['frames'],'Header mismatch '+r['id'])
  if r['bindingStatus']=='bound':
   require((q,v,f)==(len(r['qNames']),len(r['vNames']),len(r['fNames'])),'Decoded binding mismatch '+r['id'])
   counts['decodedAndBound']+=1
  counts['decodedHeaders']+=1
 parity=[]
 if a.baseline:
  bindings=read_json(a.baseline/'bindings.json')
  for stem,b in bindings.items():
   r=by_name[b['assetName']];old=read_json(a.baseline/'extracted'/(stem+'.motion.json'))
   with gzip.open(a.work/'extracted'/(r['id']+'.motion.bin.gz'),'rb') as h:data=h.read()
   magic,frames,q,v,f,fps=struct.unpack_from('<4s5i',data);actual=np.frombuffer(data[24:],dtype='<f4').reshape(frames,4*q+3*v+f)
   expected=np.concatenate((np.asarray(old['quaternions'],np.float32).reshape(frames,4*q),np.asarray(old['vectors'],np.float32).reshape(frames,3*v),np.asarray(old['floats'],np.float32).reshape(frames,f)),axis=1)
   require(np.array_equal(actual,expected),'Previously validated clip changed: '+stem)
   parity.append({'name':stem,'values':actual.size,'maxFloat32Difference':0})
 result={'counts':dict(counts),'rawBytes':raw_bytes,'decodedCompressedBytes':binary_bytes,'baselineParity':parity,'scope':'All raw bytes SHA1 checked against extraction manifest; every decoded header/frame/channel binding checked; full decompression and float32 parity for baseline clips. Native facial interpolation remains unverified.'}
 write_json(a.out,result);print(json.dumps(result,indent=2))
if __name__=='__main__':main()