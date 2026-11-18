"""Original bounded RAW and Eclipse scalar-curve decoder for the FC27 library.
Needs NumPy 2.2.6. Unknown layouts fail explicitly; original EBX/RES stay intact.
"""
import argparse,bisect,collections,gzip,json,struct
from pathlib import Path
import numpy as np
from extract_fc27 import read_json,write_json
from extract_library import animation_base
from formats import unpack,span,require

def descriptor(res,at,stride):
    count,offset=unpack(res,at,'<II');require(count<=64000000,'Array limit')
    return count,span(res,offset,count*stride)

def raw_clip(row,d,res,base):
    q,v,f,cq,cv,cf=[unpack(d,base+p,'<H')[0] for p in (104,102,100,110,108,106)]
    require(q+v+f+cq+cv+cf<=2048,'Channel limit')
    nkt,kt=descriptor(res,0,2);nm,mp=descriptor(res,12,2);ni,ip=descriptor(res,24,2)
    nd,raw=descriptor(res,36,16);nc,const=descriptor(res,48,16)
    groups=q+v+(f+3)//4;cg=cq+cv+(cf+3)//4
    require(groups>0 or nd==0,'Unexpected dynamic data')
    nk=nd//groups if groups else max(1,nkt)
    require((groups==0 or nd==nk*groups) and nc==cg,'RAW vector-row counts mismatch')
    require(1<=nk<=36000 and nm==q+v+f+cq+cv+cf and ni==nm,'RAW channel/map counts')
    mapping=np.frombuffer(mp,dtype='<u2');inv=np.frombuffer(ip,dtype='<u2')
    require(sorted(mapping.tolist())==list(range(nm)),'RAW mapping is not a permutation')
    require(all(int(inv[int(target)])==i for i,target in enumerate(mapping)),'RAW inverse mapping mismatch')
    values=np.frombuffer(raw,dtype='<f4').reshape(nk,groups,4)
    constants=np.frombuffer(const,dtype='<f4').reshape(cg,4)
    channels=[]
    for i in range(q):channels.append(('q',values[:,i,:]))
    for i in range(v):channels.append(('v',values[:,q+i,:3]))
    for i in range(f):channels.append(('f',values[:,q+v+i//4,i%4:i%4+1]))
    for i in range(cq):channels.append(('q',np.repeat(constants[i][None,:],nk,axis=0)))
    for i in range(cv):channels.append(('v',np.repeat(constants[cq+i,:3][None,:],nk,axis=0)))
    for i in range(cf):channels.append(('f',np.full((nk,1),constants[cq+cv+i//4,i%4],dtype=np.float32)))
    ordered=sorted(zip(mapping.tolist(),channels))
    keys=[]
    for kind,width in [('q',4),('v',3),('f',1)]:
        subset=[a for _,(k,a) in ordered if k==kind]
        keys.append(np.stack(subset,axis=1) if subset else np.empty((nk,0,width),dtype=np.float32))
    qs,vs,fs=keys;fs=fs[:,:,0]
    norms=np.linalg.norm(qs,axis=2)
    require(np.isfinite(norms).all() and (norms.size==0 or (norms.min()>=.95 and norms.max()<=1.05)),'RAW quaternion norm failure')
    times=np.frombuffer(kt,dtype='<i2').astype(float) if nkt else np.arange(nk,dtype=float)
    require(len(times)==nk and (nk==1 or np.all(np.diff(times)>0)),'RAW key-time table invalid')
    frames=row['frames'];require(frames<=36000 and frames*(4*(q+cq)+3*(v+cv)+f+cf)<=64000000,'Sample memory limit')
    wanted=np.arange(frames,dtype=float);b=np.clip(np.searchsorted(times,wanted,side='right'),0,nk-1);a=np.maximum(0,b-1)
    a[wanted>=times[-1]]=nk-1
    weight=np.divide(wanted-times[a],times[b]-times[a],out=np.zeros(frames),where=times[b]!=times[a]).clip(0,1).astype(np.float32)
    qa,qb=qs[a],qs[b].copy();qb*=np.where(np.sum(qa*qb,axis=2)<0,-1,1)[:,:,None]
    qo=qa+(qb-qa)*weight[:,None,None]
    if qo.size:qo/=np.linalg.norm(qo,axis=2)[:,:,None]
    vo=vs[a]+(vs[b]-vs[a])*weight[:,None,None];fo=fs[a]+(fs[b]-fs[a])*weight[:,None]
    return qo,vo,fo,{'keys':nk,'keyTimes':nkt,'normMin':float(norms.min()) if norms.size else None,'normMax':float(norms.max()) if norms.size else None}

def eclipse_clip(row,d,res,base):
    q,v,f=unpack(d,base+96,'<III');require(q==0 and v==0,'Eclipse quaternion/vector curves need another decoder')
    count,table=descriptor(res,24,20);require(count==f and f<=2048,'Eclipse scalar count mismatch')
    require(unpack(res,36,'<II')==(1,1),'Unsupported Eclipse curve flags')
    size,offset=unpack(res,56,'<II');data=span(res,offset,size)
    frames=row['frames'];require(frames<=36000 and frames*f<=64000000,'Eclipse sample limit')
    target=np.arange(frames,dtype=float);out=np.zeros((frames,f),dtype=np.float32)
    for i in range(f):
        nk,to,vo,low,high=unpack(table,20*i,'<IIIff');require(0<nk<=36000,'Eclipse key count')
        if nk <= 2:
            # The compact 1/2-key form stores times and endpoint values directly
            # in the descriptor; these are not offsets into the data array.
            out[:,i]=np.interp(target,[to,vo] if nk==2 and vo>to else [to],[low,high] if nk==2 and vo>to else [low])
            continue
        if low == high:
            out[:,i]=low
            continue
        time_width=2 if unpack(res,48,'<I')[0] else 1
        time_data=span(data,to,nk*time_width)
        times=np.frombuffer(time_data,dtype='>u2' if time_width==2 else 'u1').astype(float)
        cursor=to+nk*time_width
        require(cursor<=vo,'Eclipse time/value overlap')
        require(all(b>a for a,b in zip(times,times[1:])),'Eclipse times not increasing')
        values=np.frombuffer(span(data,vo,nk),dtype=np.uint8).astype(np.float32)
        values=low+(high-low)*(values/255)
        require(np.isfinite(values).all(),'Eclipse nonfinite weights')
        out[:,i]=np.interp(target,times,values)
    return np.empty((frames,0,4),np.float32),np.empty((frames,0,3),np.float32),out,{'keys':'per-curve','interpolation':'linear decoded scalar curves; native curve interpolation not yet verified'}

def save(prefix,row,qs,vs,fs,validation):
    require(qs.shape[0]==vs.shape[0]==fs.shape[0]==row['frames'],'Frame count')
    if row.get('bindingStatus')=='bound':
        require((qs.shape[1],vs.shape[1],fs.shape[1])==(len(row['qNames']),len(row['vNames']),len(row['fNames'])),'Binding channel counts disagree')
    flat=np.concatenate((qs.reshape(row['frames'],qs.shape[1]*4),vs.reshape(row['frames'],vs.shape[1]*3),fs),axis=1).astype('<f4')
    require(np.isfinite(flat).all(),'Nonfinite output')
    output=prefix.with_suffix('.motion.bin.gz');partial=output.with_suffix('.partial')
    with gzip.open(partial,'wb',compresslevel=1) as h:
        h.write(struct.pack('<4s5i',b'FCL1',row['frames'],qs.shape[1],vs.shape[1],fs.shape[1],30));h.write(flat.tobytes())
    partial.replace(output)
    write_json(prefix.with_suffix('.validation.json'),dict(name=row['id'],codec=row['codec'],frames=row['frames'],quats=qs.shape[1],vectors=vs.shape[1],floats=fs.shape[1],**validation))
    prefix.with_suffix('.error.json').unlink(missing_ok=True)

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--work',type=Path,required=True);p.add_argument('--redo',choices=['ECLIPSE','RAW','FRAM']);a=p.parse_args()
    rows=read_json(a.work/'catalog.json');counts=collections.Counter()
    for row in rows:
        if row['codec'] not in ('RAW','ECLIPSE','FRAM'):continue
        prefix=a.work/'extracted'/row['id']
        if a.redo!=row['codec'] and prefix.with_suffix('.motion.bin.gz').exists() and prefix.with_suffix('.validation.json').exists():counts['resumed']+=1;continue
        try:
            d=prefix.with_suffix('.ebx').read_bytes();res=prefix.with_suffix('.res').read_bytes();base,_=animation_base(d)
            if row['codec']=='RAW':qs,vs,fs,val=raw_clip(row,d,res,base)
            elif row['codec']=='ECLIPSE':qs,vs,fs,val=eclipse_clip(row,d,res,base)
            else:
                f,v,q=unpack(res,0,'<III');count,raw=descriptor(res,12,16)
                require(count==q+v+(f+3)//4 and q+v+f<=2048,'Frame pose row count mismatch')
                pose=np.frombuffer(raw,dtype='<f4').reshape(count,4)
                qs=np.repeat(pose[:q][None,:,:],row['frames'],axis=0)
                vs=np.repeat(pose[q:q+v,:3][None,:,:],row['frames'],axis=0)
                fs=np.repeat(pose[q+v:].reshape(-1)[:f][None,:],row['frames'],axis=0)
                norms=np.linalg.norm(qs,axis=2);require(not norms.size or (.95<=norms.min() and norms.max()<=1.05),'Frame quaternion norm failure')
                val={'staticPose':True,'normMin':float(norms.min()) if norms.size else None,'normMax':float(norms.max()) if norms.size else None}
            save(prefix,row,qs,vs,fs,val);counts['decoded/'+row['codec']]+=1
        except Exception as e:
            write_json(prefix.with_suffix('.error.json'),{'name':row['id'],'error':str(e),'codec':row['codec']});counts['failed/'+row['codec']+'/'+str(e)]+=1
        if sum(counts.values())%500==0:print(dict(counts),flush=True)
    print('OTHER CODECS COMPLETE',dict(counts),flush=True)
if __name__=='__main__':main()