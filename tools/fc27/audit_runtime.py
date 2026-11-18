"""Audit every shipped runtime slice, binding, hash and source range."""
import argparse, collections, gzip, hashlib, json, re, struct
from pathlib import Path
import numpy as np

def audit(root, source=None):
    manifest=json.loads(gzip.decompress((root/'manifest.json.gz').read_bytes()))
    seen=set(); total=0; roles=collections.Counter(); source_checks=0
    for e in manifest['entries']:
        ident=e['id']; assert re.fullmatch(r'[0-9a-f]{24}_[0-9]+_[0-9]+',ident), ident
        assert ident not in seen,ident
        seen.add(ident); path=root/'clips'/(ident+'.bin.gz'); compressed=path.read_bytes()
        assert len(compressed)==e['bytes'] and hashlib.sha256(compressed).hexdigest()==e['sha256'],ident
        raw=gzip.decompress(compressed)
        assert hashlib.sha256(raw).hexdigest()==e['payloadSha256'],ident
        magic,n,q,v,f,fps=struct.unpack_from('<4s5i',raw); width=4*q+3*v+f
        assert magic==b'FCL1' and fps==30 and n==e['frames'] and len(raw)==24+4*n*width,ident
        b=manifest['bindings'][e['binding']]
        assert [q,v,f]==[len(b['qNames']),len(b['vNames']),len(b['fNames'])],ident
        samples=np.frombuffer(raw,offset=24,dtype='<f4').reshape(n,width)
        assert np.isfinite(samples).all(),ident
        norms=np.linalg.norm(samples[:,:4*q].reshape(n,q,4),axis=2)
        assert np.all((norms>=.9)&(norms<=1.1)),ident
        if source:
            original=gzip.decompress((source/'extracted'/(e['sourceId']+'.motion.bin.gz')).read_bytes())
            _,sn,sq,sv,sf,sfps=struct.unpack_from('<4s5i',original); start,end=e['range']
            assert (sq,sv,sf,sfps)==(q,v,f,fps) and 0<=start<=end<sn and end-start+1==n,ident
            assert raw[24:]==original[24+4*width*start:24+4*width*(end+1)],ident
            source_checks+=1
        total+=len(compressed); roles[e['family']]+=1
    assert total==manifest['bytes'] and dict(roles)==manifest['roles']
    files={p.name[:-7] for p in (root/'clips').glob('*.bin.gz')}
    assert files==seen, {'missing':sorted(seen-files),'unreferenced':sorted(files-seen)}
    return {'entries':len(seen),'families':dict(roles),'compressedPayloadBytes':total,'hashesVerified':len(seen),'finiteAndQuaternionChecks':len(seen),'exactSourceSlices':source_checks,'unreferencedFiles':0,'manifestSha256':hashlib.sha256((root/'manifest.json.gz').read_bytes()).hexdigest()}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--runtime',type=Path,default=Path('runtime'));p.add_argument('--source',type=Path);p.add_argument('--report',type=Path,required=True);a=p.parse_args()
    result=audit(a.runtime,a.source);a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result))
