"""Compile measured, context-tagged native gameplay motions from the complete export.
Original selector/feature code. No FC animation controller runtime is claimed.
"""
import argparse,collections,gzip,hashlib,io,json,math,re,shutil,struct
from pathlib import Path
import numpy as np
from extract_fc27 import read_json,write_json
JOINTS=['Hips','Spine1','Spine3','LeftUpLeg','RightUpLeg','LeftLeg','RightLeg','LeftFoot','RightFoot','LeftArm','RightArm','Head']
UP=np.array([0.,1.,0.])
def mul(a,b):
 av,bv=a[...,:3],b[...,:3];return np.concatenate((a[...,3:4]*bv+b[...,3:4]*av+np.cross(av,bv),a[...,3:4]*b[...,3:4]-np.sum(av*bv,axis=-1,keepdims=True)),axis=-1)
def rotate(q,v):
 t=2*np.cross(q[...,:3],v);return v+q[...,3:4]*t+np.cross(q[...,:3],t)
def yaw(q):
 x=rotate(q,np.broadcast_to(np.array([1.,0.,0.]),q.shape[:-1]+(3,)));return np.arctan2(-x[...,2],x[...,0])
def matq(m):
 # Rest matrices use column-major storage, as in the Three.js source sampler.
 m=np.array(m).reshape(4,4,order='F');r=m[:3,:3];r=r/np.linalg.norm(r,axis=0)
 tr=np.trace(r)
 if tr>0:
  s=math.sqrt(tr+1)*2;q=[(r[2,1]-r[1,2])/s,(r[0,2]-r[2,0])/s,(r[1,0]-r[0,1])/s,s/4]
 else:
  i=int(np.argmax(np.diag(r)));j=(i+1)%3;k=(i+2)%3;s=math.sqrt(1+r[i,i]-r[j,j]-r[k,k])*2;q=[0.,0.,0.,0.];q[i]=s/4;q[3]=(r[k,j]-r[j,k])/s;q[j]=(r[j,i]+r[i,j])/s;q[k]=(r[k,i]+r[i,k])/s
 return m[:3,3],np.array(q)
def family(name):
 n=name.rsplit('/',1)[-1]
 if any(x in n for x in ('dancecard','hybrid','goalie','_gk_','crouch','female','fem_','warmup','camera')):return None
 if 'shirtpull' in n and re.search(r'__p0\d',n):return 'shirtPair'
 if 'stand_two_hands_push_off' in n:return 'push'
 if re.search(r'(pushed|push_react|pushback_react|react.*push|pp_.*reaction)',n):return 'pushReaction'
 if 'getup' in n or 'get_up' in n:return 'recover'
 if 'slidetackle' in n or 'slide_tackle' in n:return 'tackle'
 if 'fall' in n and not any(x in n for x in ('roll','somersault','aerial','header','dive','stunt','jump')):return 'fall'
 if 'cycle' in n and any(x in n for x in ('walk','jog','sprint')):
  if any(x in n for x in ('back','side','strafe','cross','_45_','_90_','_135_','_180_')):return None
  return 'sprint' if 'sprint' in n else 'jog' if 'jog' in n else 'walk'
 if 'start_idle_to' in n:return 'start'
 if re.search(r'stop_.*to_idle',n):return 'stop'
 if re.search(r'(walk|jog|sprint)_to_(walk|jog|sprint)_.*(45|90|135|180)',n):return 'turn'
 if ('celebrations/' in name or 'victory' in n or 'fistpumpair' in n) and not any(x in n for x in ('_entry','_exit')):return 'celebrate'
 if 'block' in n and not any(x in n for x in ('header','head','keeper','cross')):return 'block'
 if '/shotspasses' in name and 'pass' in n and not any(x in n for x in ('fake','head','backheel','volley','jump','skill','lob','receive','trap')):return 'pass'
 if '/shotspasses' in name and ('shot' in n or 'shoot' in n) and not any(x in n for x in ('fake','header','head','volley','jump','bicycle','lob','skill')):return 'shoot'
 if ('idle' in n or 'stand_breath' in n) and '/gameplay/' in name and not any(x in n for x in ('getup','turn','to_','celebr','footik','_face','sitting','squat','ball')):return 'idle'
 return None

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--work',type=Path,required=True);p.add_argument('--out',type=Path,default=Path('runtime'));a=p.parse_args()
 rows=read_json(a.work/'catalog.json');sk=read_json(a.work/'shared/skeleton.json');names=sk['BoneNames'];ix={n:i for i,n in enumerate(names)};parents=sk['Hierarchy'];rest=[matq(m) for m in sk['LocalPose']];rp=np.array([x[0] for x in rest]);rq=np.array([x[1] for x in rest]);ji=[ix[n] for n in JOINTS]
 needed=set(ji+[ix[n] for n in ['LeftHand','RightHand','LeftForeArm','RightForeArm']])
 for i in list(needed):
  while parents[i]>=0:i=parents[i];needed.add(i)
 needed=sorted(needed)
 out=a.out;previous=[]
 if (out/'manifest.json.gz').exists():previous=json.loads(gzip.decompress((out/'manifest.json.gz').read_bytes())).get('entries',[])
 (out/'clips').mkdir(parents=True,exist_ok=True);entries=[];bindings={};rejects=collections.Counter();roles=collections.Counter();total_bytes=0
 candidates=[r for r in rows if r.get('decodeStatus')=='decoded' and r.get('bindingStatus')=='bound' and 'Hips' in r.get('qNames',[]) and len(r.get('qNames',[]))>=30 and family(r['name'])]
 for number,row in enumerate(candidates,1):
  role=family(row['name']);ident=row['id']
  try:
   with gzip.open(a.work/'extracted'/(ident+'.motion.bin.gz'),'rb') as h:data=h.read()
   magic,n,q,v,f,fps=struct.unpack_from('<4s5i',data);assert magic==b'FCL1' and fps==30
   values=np.frombuffer(data,offset=24,dtype='<f4').reshape(n,4*q+3*v+f);qs=values[:,:4*q].reshape(n,q,4);vs=values[:,4*q:4*q+3*v].reshape(n,v,3)
   qi={x:i for i,x in enumerate(row['qNames'])};vi={x:i for i,x in enumerate(row['vNames'])}
   if 'AITrajectory.t' not in vi or 'AITrajectory' not in qi:raise ValueError('no trajectory')
   if n<12:raise ValueError('too short')
   if role not in ('walk','jog','sprint','idle','celebrate','shirtPair') and n>300:raise ValueError('long unsegmented action')
   # Bound offline analysis and emitted segments, retaining original files separately.
   n=min(n,240 if role not in ('walk','jog','sprint') else 210);qs=qs[:n];vs=vs[:n];values=values[:n]
   positions=np.broadcast_to(rp,(n,len(names),3)).copy();quats=np.broadcast_to(rq,(n,len(names),4)).copy()
   for name,k in qi.items():
    if name in ix:quats[:,ix[name]]=qs[:,k]/np.linalg.norm(qs[:,k],axis=1)[:,None]
   for name,k in vi.items():
    bone,_,kind=name.partition('.')
    if bone in ix and kind!='s':positions[:,ix[bone]]=vs[:,k]*.3048
   trajectory=vs[:,vi['AITrajectory.t']]*.3048;positions[:,ix['AITrajectory']]=0
   original_yaw=yaw(quats[:,ix['AITrajectory']]);reference=original_yaw[0]
   canonical=np.array([0.,math.sin(-reference/2),0.,math.cos(-reference/2)])
   if role=='shirtPair':canonical=np.array([0.,0.,0.,1.])
   if role in ('walk','jog','sprint','idle','start','stop','turn'):quats[:,ix['AITrajectory']]=[0,0,0,1]
   else:quats[:,ix['AITrajectory']]=mul(np.broadcast_to(canonical,(n,4)),quats[:,ix['AITrajectory']])
   wp=np.zeros_like(positions);wq=np.zeros_like(quats)
   for i in needed:
    parent=parents[i]
    if parent<0:wp[:,i]=positions[:,i];wq[:,i]=quats[:,i]
    else:wp[:,i]=wp[:,parent]+rotate(wq[:,parent],positions[:,i]);wq[:,i]=mul(wq[:,parent],quats[:,i])
   hips=wp[:,ix['Hips'],1];feet=wp[:,[ix['LeftFoot'],ix['RightFoot']]];start,end=0,n-1;seam=0.
   vel=np.diff(trajectory,axis=0)*30;speed=np.linalg.norm(vel[:,[0,2]],axis=1)
   if np.max(speed)>18:raise ValueError('root speed spike')
   if role in ('walk','jog','sprint'):
    best=None
    for st in range(0,max(1,n-15),3):
     for en in range(st+14,min(n,st+49)):
      if hips[st]<.7 or hips[en]<.7:continue
      dot=np.abs(np.sum(quats[st,ji]*quats[en,ji],axis=1)).clip(0,1)
      cost=float(np.mean(1-dot)+.1*(hips[st]-hips[en])**2)
      if best is None or cost<best[0]:best=(cost,st,en)
    if best is None:raise ValueError('no cycle')
    seam,start,end=best
    if seam>.035:raise ValueError('cycle seam mismatch')
   duration=(end-start)/30;delta=trajectory[end]-trajectory[start];delta_local=rotate(canonical,delta);mean_speed=float(np.mean(speed[start:end]));travel=float(np.linalg.norm(delta[[0,2]]));angle=float(math.atan2(-delta_local[2],delta_local[0]))
   turn=float(math.atan2(math.sin(original_yaw[end]-original_yaw[start]),math.cos(original_yaw[end]-original_yaw[start])))
   hip_rotation=wq[start:end+1,ix['Hips']];hip_rotation=hip_rotation/np.linalg.norm(hip_rotation,axis=1)[:,None]
   hip_steps=2*np.arccos(np.abs(np.sum(hip_rotation[1:]*hip_rotation[:-1],axis=1)).clip(0,1));hip_turn=float(np.sum(hip_steps));hip_step=float(np.max(hip_steps))
   local_steps=2*np.arccos(np.abs(np.sum(quats[start+1:end+1,ji]*quats[start:end,ji],axis=2)).clip(0,1));joint_step=float(np.max(local_steps))
   if joint_step>1.4:raise ValueError('joint angular discontinuity')
   if role=='fall' and (hip_turn>4.5 or hip_step>.5):raise ValueError('rolling or discontinuous fall')
   if role=='recover' and (hip_turn>7.5 or hip_step>.65):raise ValueError('rolling or discontinuous recovery')
   if role=='tackle' and (hip_turn>5.5 or hip_step>.6):raise ValueError('rolling or discontinuous tackle')
   entry_height=float(hips[start]);exit_height=float(hips[end]);support=(feet[:,:,1]<.18).astype(int);ground=float(np.mean(np.any(support[start:end+1],axis=1)))
   if role in ('walk','jog','sprint') and (abs(angle)>.65 or mean_speed<.35 or ground<.25):raise ValueError('not forward grounded gait')
   if role=='idle' and (mean_speed>.35 or entry_height<.75 or exit_height<.75):raise ValueError('not standing idle')
   if role in ('start','stop','turn','pass','shoot','push','pushReaction','block') and (entry_height<.65 or exit_height<.65 or ground<.35):raise ValueError('action posture incompatible')
   if role=='turn' and abs(turn)<.3:raise ValueError('no measured turn')
   if role=='tackle' and not (entry_height>.55 and exit_height<.75 and travel>.25):raise ValueError('not standing-to-slide')
   if role=='fall' and not (entry_height>.55 and exit_height<.65 and abs(turn)<1.3):raise ValueError('not stable standing-to-ground fall')
   if role=='recover' and not (entry_height<.72 and exit_height>.78):raise ValueError('not complete get-up')
   if role=='celebrate' and not (entry_height>.65 and exit_height>.65 and hips[start:end+1].max()<2.4):raise ValueError('celebration needs special recovery')
   # Most modern native pair clips share the same capture frame; keep full pairing identity.
   pair=re.sub(r'__p0\d', '__actor',row['name']) if role=='shirtPair' else None
   # Contact candidate: low striking foot with the strongest forward velocity.
   foot_vel=np.diff(feet,axis=0)*30
   low=feet[1:,:,1]<.38;forward=foot_vel[:,:,0];contact_score=np.where(low,np.abs(forward),-1.)
   ci,cfoot=np.unravel_index(np.argmax(contact_score[start:end]),contact_score[start:end].shape);contact=(start+int(ci)+1)/30
   indices=list(range(start,min(end,start+12)+1,3))
   feature=[]
   for frame in indices:
    feature.append({'time':round((frame-start)/30,5),'q':np.round(quats[frame,ji],6).reshape(-1).tolist(),'height':round(float(hips[frame]),5),'support':support[frame].tolist()})
   segment=values[start:end+1].astype('<f4').copy();sid=ident+'_'+str(start)+'_'+str(end)
   path=out/'clips'/(sid+'.bin.gz')
   payload=struct.pack('<4s5i',b'FCL1',len(segment),q,v,f,30)+segment.tobytes()
   with path.open('wb') as output:
    with gzip.GzipFile(filename='',mode='wb',fileobj=output,compresslevel=6,mtime=0) as h:h.write(payload)
   size=path.stat().st_size;total_bytes+=size
   binding=row['channelMapGuid'];bindings[binding]={k:row[k] for k in ('qNames','vNames','fNames')}
   entries.append({'id':sid,'sourceId':ident,'name':row['name'],'family':role,'binding':binding,'frames':len(segment),'duration':round(duration,6),'speed':round(mean_speed,5),'travel':round(travel,5),'direction':round(angle,5),'turn':round(turn,5),'entryHeight':round(entry_height,5),'exitHeight':round(exit_height,5),'ground':round(ground,5),'hipAngularTravel':round(hip_turn,6),'maxHipStep':round(hip_step,6),'maxJointStep':round(joint_step,6),'seam':round(seam,6),'contactTime':round(max(0,contact-start/30),5),'contactFoot':int(cfoot),'entry':feature,'pair':pair,'bytes':size,'range':[start,end],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'payloadSha256':hashlib.sha256(payload).hexdigest()})
   roles[role]+=1
  except Exception as error:rejects[role+'/'+str(error)]+=1
  if number%250==0:print('MEASURE',number,'/',len(candidates),'admitted',len(entries),flush=True)
 manifest={'schema':1,'sourceResources':len(rows),'candidateResources':len(candidates),'joints':JOINTS,'entries':entries,'bindings':bindings,'bytes':total_bytes,'roles':dict(roles),'rejected':dict(rejects),'policy':'Original semantic labels plus measured root speed/direction, support, entry/exit height cycle seams and angular discontinuity/roll limits. Unknown actions and incompatible poses are excluded from automatic field play, retained in full catalogue.'}
 with (out/'manifest.json.gz').open('wb') as output:
  with gzip.GzipFile(filename='',mode='wb',fileobj=output,compresslevel=9,mtime=0) as h:h.write(json.dumps(manifest,separators=(',',':')).encode())
 current={e['id'] for e in entries}
 for old in previous:
  if old['id'] not in current and re.fullmatch(r'[0-9a-f]{24}_[0-9]+_[0-9]+',old['id']):
   target=out/'clips'/(old['id']+'.bin.gz');assert target.resolve().is_relative_to((out/'clips').resolve());target.unlink(missing_ok=True)
 write_json(out/'build-report.json',{k:v for k,v in manifest.items() if k not in ('entries','bindings')})
 print(json.dumps({k:v for k,v in manifest.items() if k not in ('entries','bindings')},indent=2),flush=True)
if __name__=='__main__':main()