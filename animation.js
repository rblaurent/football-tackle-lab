/** Native motion sampling and our own transition system. No EA runtime code. */
import * as T from './vendor/three.module.js';
import {HandPoses} from './hand-poses.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>x*x*(3-2*x);
const V=new T.Vector3(),Q=new T.Quaternion(),Q2=new T.Quaternion(),UP=new T.Vector3(0,1,0);
const yawOf=q=>{const v=new T.Vector3(1,0,0).applyQuaternion(q);return Math.atan2(-v.z,v.x);};
export const clonePose=p=>({positions:p.positions.map(v=>v.clone()),quaternions:p.quaternions.map(q=>q.clone())});
export function copyPose(out,p){out.positions.forEach((v,i)=>v.copy(p.positions[i]));out.quaternions.forEach((q,i)=>q.copy(p.quaternions[i]));return out;}
export function blendPose(out,a,b,w){out.positions.forEach((v,i)=>v.copy(a.positions[i]).lerp(b.positions[i],w));out.quaternions.forEach((q,i)=>q.copy(a.quaternions[i]).slerp(b.quaternions[i],w));return out;}
function rotationVector(q,out){const sign=q.w<0?-1:1,w=clamp(q.w*sign,-1,1),len=Math.hypot(q.x,q.y,q.z);return len<1e-8?out.set(0,0,0):out.set(q.x,q.y,q.z).multiplyScalar(sign*2*Math.atan2(len,w)/len);}
function rotationQuaternion(v,out){const angle=v.length();return angle<1e-8?out.identity():out.setFromAxisAngle(V.copy(v).multiplyScalar(1/angle),angle);}

export class MotionLibrary {
 constructor(data){
  this.data=data;this.names=data.skeleton.BoneNames;this.index=Object.fromEntries(this.names.map((n,i)=>[n,i]));
  this.rest={positions:[],quaternions:[]};for(const m of data.skeleton.LocalPose){const mat=new T.Matrix4().fromArray(m);mat.elements[15]=1;const p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();mat.decompose(p,q,s);this.rest.positions.push(p);this.rest.quaternions.push(q);}
  this.handPoses=new HandPoses(data,this.rest,this.index);
  this.scratch=clonePose(this.rest);this.endPose=clonePose(this.rest);this.startPose=clonePose(this.rest);
  const find=s=>{const key=Object.keys(data.clips).find(k=>k.includes(s));if(!key)throw Error('Missing motion '+s);return data.clips[key];};
  this.motions={idle:{clip:find('idle_front_getup'),loop:true,start:0,end:8},walk:{clip:find('cycle_walkom'),loop:true,start:151/30,end:183/30},jog:{clip:find('cycle_jogke'),loop:true,start:11/30,end:33/30},sprint:{clip:find('cycle_sprintal'),loop:true,start:7/30,end:25/30},start:{clip:find('start_idle_to_jog'),start:0,end:1.3},stop:{clip:find('stop_jog_to_idle_0_0'),start:.7,end:2.5},turn:{clip:find('jog_to_jog_90_rfoot'),start:0,end:49/30},tackle:{clip:find('basic_near_sprint'),start:.3,end:1.12},fall:{clip:find('charplayerh04'),start:.55,end:1.6},recoverSlide:{clip:find('11a395p1'),start:0,end:32/30},recoverSide:{clip:find('getups_fromslide_tojog'),start:0,end:35/30},recoverBack:{clip:find('11a382a1'),start:0,end:29/30},recoverFront:{clip:find('fall45r'),start:0,end:29/30},shirtFrontA:{clip:find('stand_front_v1__p01'),start:0,end:46/30,capture:true},shirtFrontB:{clip:find('stand_front_v1__p02'),start:0,end:46/30,capture:true},shirtSideA:{clip:find('jog_in90__p01'),start:0,end:2,capture:true},shirtSideB:{clip:find('jog_in90__p03'),start:0,end:2,capture:true}};
  for(const [id,m] of Object.entries(this.motions)){
   m.id=id;m.end=Math.min(m.end,(m.clip.frameCount-1)/30);m.duration=m.end-m.start;
   m.q=m.clip.qNames.map(n=>this.index[n]);m.v=m.clip.vNames.map(n=>({i:this.index[n.split('.')[0]],scale:n.endsWith('.s')}));
   const ti=m.clip.vNames.indexOf('AITrajectory.t');m.trajectory=m.clip.vectors.map(f=>new T.Vector3().fromArray(f[ti]).multiplyScalar(.3048));
   // Action poses and displacement share one capture frame, canonicalized once at entry.
   m.preserveTrajectory=!!m.capture||['tackle','fall','recoverSlide','recoverSide','recoverBack','recoverFront'].includes(id);
   const qi=m.clip.qNames.indexOf('AITrajectory'),sf=m.start*30,si=Math.floor(sf);
   const entryQ=new T.Quaternion().fromArray(m.clip.quaternions[si][qi]).normalize().slerp(new T.Quaternion().fromArray(m.clip.quaternions[Math.min(si+1,m.clip.frameCount-1)][qi]).normalize(),sf-si);
   m.referenceYaw=m.preserveTrajectory&&!m.capture?yawOf(entryQ):0;
   m.nativeSpeed=m.trajectory[Math.round(m.end*30)].distanceTo(m.trajectory[Math.round(m.start*30)])/m.duration;
   if(m.loop){m.first=clonePose(this.rest);m.last=clonePose(this.rest);this.sampleRaw(m,m.start,m.first);this.sampleRaw(m,m.end,m.last);m.phaseOffset=0;
    if(id!=='idle'){let min=Infinity;for(let f=Math.ceil(m.start*30);f<m.end*30;f++){const fi=m.clip.fNames.indexOf('LeftFoot.height'),h=m.clip.floats[f][fi];if(h<min){min=h;m.phaseOffset=(f/30-m.start)/m.duration;}}}
   }
  }
  this.poseJoints=['Hips','Spine1','Spine3','LeftUpLeg','RightUpLeg','LeftLeg','RightLeg','LeftFoot','RightFoot','LeftArm','RightArm'].map(n=>this.index[n]);
  this.fkP=this.names.map(()=>new T.Vector3());this.fkQ=this.names.map(()=>new T.Quaternion());this.forwardKinematics(this.rest);this.restWorldQ=this.fkQ.map(q=>q.clone());
 }
 registerNative(meta,clip){
  if(this.motions[meta.id])return this.motions[meta.id];
  const m={id:meta.id,clip,family:meta.family,meta,start:0,end:(clip.frameCount-1)/30,duration:(clip.frameCount-1)/30,loop:['idle','walk','jog','sprint'].includes(meta.family),capture:meta.family==='shirtPair'};
  m.q=clip.qNames.map(n=>this.index[n]);m.v=clip.vNames.map(n=>({i:this.index[n.split('.')[0]],scale:n.endsWith('.s')}));
  const ti=clip.vNames.indexOf('AITrajectory.t'),qi=clip.qNames.indexOf('AITrajectory');if(ti<0||qi<0)throw Error('Runtime body clip lacks root channels');m.trajectory=clip.vectors.map(f=>new T.Vector3().fromArray(f[ti]).multiplyScalar(.3048));
  m.preserveTrajectory=m.capture||!['idle','walk','jog','sprint','start','stop','turn'].includes(meta.family);m.referenceYaw=m.preserveTrajectory&&!m.capture?yawOf(new T.Quaternion().fromArray(clip.quaternions[0][qi]).normalize()):0;m.nativeSpeed=meta.speed;
  if(m.loop){m.first=clonePose(this.rest);m.last=clonePose(this.rest);this.sampleRaw(m,0,m.first);this.sampleRaw(m,m.duration,m.last);m.phaseOffset=0;const fi=clip.fNames.indexOf('LeftFoot.height');if(fi>=0&&meta.family!=='idle'){let low=Infinity;clip.floats.forEach((f,i)=>{if(f[fi]<low){low=f[fi];m.phaseOffset=i/Math.max(1,clip.frameCount-1);}});}}
  this.motions[meta.id]=m;return m;
 }
 createPose(){return clonePose(this.rest);}
 sampleRaw(m,t,out){
  copyPose(out,this.rest);const f=clamp(t*30,0,m.clip.frameCount-1),i=Math.floor(f),j=Math.min(i+1,m.clip.frameCount-1),w=f-i;
  m.q.forEach((n,k)=>{if(n===undefined)return;out.quaternions[n].fromArray(m.clip.quaternions[i][k]).normalize().slerp(Q.fromArray(m.clip.quaternions[j][k]).normalize(),w);});
  m.v.forEach(({i:n,scale},k)=>{if(n===undefined||scale)return;out.positions[n].fromArray(m.clip.vectors[i][k]).lerp(V.fromArray(m.clip.vectors[j][k]),w).multiplyScalar(.3048);});
  // Navigation consumes translation; action-body yaw remains relative to its entry frame.
  this.handPoses.fill(out,m);
  const ai=this.index.AITrajectory;out.positions[ai].set(0,0,0);
  if(m.preserveTrajectory)out.quaternions[ai].premultiply(Q.setFromAxisAngle(UP,-m.referenceYaw)).normalize();else out.quaternions[ai].identity();return out;
 }
 sample(id,time,out){const m=this.motions[id];if(!m)throw Error('Unknown motion '+id);
  if(!m.loop)return this.sampleRaw(m,m.start+clamp(time,0,m.duration),out);
  let phase=((time/m.duration+(m.phaseOffset||0))%1+1)%1;this.sampleRaw(m,m.start+phase*m.duration,out);
  // Close small capture seams with a distributed, zero-slope correction, rather than snapping at wrap.
  const w=smooth(phase);out.positions.forEach((p,i)=>p.addScaledVector(V.copy(m.first.positions[i]).sub(m.last.positions[i]),w));
  out.quaternions.forEach((q,i)=>{Q.copy(m.last.quaternions[i]).invert().multiply(m.first.quaternions[i]);Q2.identity().slerp(Q,w);q.multiply(Q2).normalize();});if(id==='idle'||m.family==='idle')this.neutralGaze(out);return out;
 }
 neutralGaze(pose){
  this.forwardKinematics(pose);const hi=this.index.Hips,forward=new T.Vector3(0,0,1).applyQuaternion(this.fkQ[hi].clone().multiply(this.restWorldQ[hi].clone().invert()));forward.y=0;forward.normalize();const facing=new T.Quaternion().setFromAxisAngle(UP,Math.atan2(forward.x,forward.z));
  for(const [name,weight] of [['Neck',.7],['Head',1]]){const i=this.index[name],parent=this.data.skeleton.Hierarchy[i],desired=facing.clone().multiply(this.restWorldQ[i]);this.fkQ[i].slerp(desired,weight);pose.quaternions[i].copy(this.fkQ[parent]).invert().multiply(this.fkQ[i]).normalize();this.forwardKinematics(pose);}return pose;
 }
 rootDelta(id,t0,t1){const m=this.motions[id],at=t=>{const f=clamp((m.start+t)*30,0,m.clip.frameCount-1),i=Math.floor(f);return m.trajectory[i].clone().lerp(m.trajectory[Math.min(i+1,m.clip.frameCount-1)],f-i);};return at(t1).sub(at(t0)).applyAxisAngle(UP,-m.referenceYaw);}
 forwardKinematics(pose){for(let i=0;i<this.names.length;i++){const parent=this.data.skeleton.Hierarchy[i];if(parent<0){this.fkP[i].copy(pose.positions[i]);this.fkQ[i].copy(pose.quaternions[i]);}else{this.fkP[i].copy(pose.positions[i]).applyQuaternion(this.fkQ[parent]).add(this.fkP[parent]);this.fkQ[i].copy(this.fkQ[parent]).multiply(pose.quaternions[i]);}}return this.fkP;}
 cost(a,b){let cost=0;for(const i of this.poseJoints){const dot=Math.min(1,Math.abs(a.quaternions[i].dot(b.quaternions[i])));const angle=2*Math.acos(dot);cost+=angle*angle*(i===this.index.Hips?2:1);}return cost+25*(a.positions[this.index.Hips].y-b.positions[this.index.Hips].y)**2;}
 match(id,current,{min=0,max,steps=24}={}){const m=this.motions[id];max??=m.loop?m.duration:m.duration*.18;let best={time:min,cost:Infinity};for(let i=0;i<=steps;i++){const time=min+(max-min)*i/steps;this.sample(id,time,this.scratch);const cost=this.cost(current,this.scratch);if(cost<best.cost)best={time,cost};}return best;}
 alignment(a,b){
  // Fit a horizontal rotation using hips-relative anatomical landmarks, including the trajectory parent.
  const points=p=>{const fk=this.forwardKinematics(p),h=fk[this.index.Hips];return ['Head','Spine3','LeftHand','RightHand','LeftLeg','RightLeg','LeftFoot','RightFoot'].map(n=>fk[this.index[n]].clone().sub(h));};
  const ap=points(a),bp=points(b);let c=0,s=0;for(let i=0;i<ap.length;i++){c+=ap[i].x*bp[i].x+ap[i].z*bp[i].z;s+=ap[i].x*bp[i].z-ap[i].z*bp[i].x;}const yaw=Math.atan2(s,c);let cost=0;for(let i=0;i<ap.length;i++)cost+=ap[i].distanceToSquared(bp[i].applyAxisAngle(UP,yaw));
  return {yaw,cost:cost+8*(a.positions[this.index.Hips].y-b.positions[this.index.Hips].y)**2};
 }
 alignedMatch(id,current,{min=0,max=.14,steps=6}={}){let best={time:min,cost:Infinity,yaw:0};for(let i=0;i<=steps;i++){const time=min+(max-min)*i/steps;this.sample(id,time,this.scratch);const fit=this.alignment(current,this.scratch);if(fit.cost<best.cost)best={time,...fit};}return best;}
 recovery(current){const ids=['recoverSlide','recoverSide','recoverBack','recoverFront'];if(this.database){const ranked=this.database.rank('recover',this.database.context(current,{speed:1}));ranked.slice(0,2).forEach(r=>this.database.ensure(r.entry));ids.push(...ranked.filter(r=>this.database.loaded.has(r.entry.id)).slice(0,8).map(r=>r.entry.id));}return ids.map(id=>({id,...this.alignedMatch(id,current,{max:Math.min(.14,this.motions[id].duration*.2),steps:6})})).sort((a,b)=>a.cost-b.cost)[0];}
 matchGait(speed,phase,current,previous,dt,frequency){
  const points=pose=>{this.forwardKinematics(pose);const hip=this.fkP[this.index.Hips];return ['LeftFoot','RightFoot'].map(n=>this.fkP[this.index[n]].clone().sub(hip));};
  const now=points(current),before=points(previous),velocity=now.map((v,i)=>v.clone().sub(before[i]).multiplyScalar(1/Math.max(dt,1e-5))),candidate=this.createPose(),next=this.createPose();let best={phase,cost:Infinity},originalCost=0;
  for(let i=-1;i<20;i++){const p=i<0?phase:i/20;this.locomotion(speed,p,candidate);const at=points(candidate);this.locomotion(speed,(p+dt*frequency)%1,next);const after=points(next);let cost=0;
   for(let f=0;f<2;f++){cost+=40*at[f].distanceToSquared(now[f]);const v=after[f].sub(at[f]).multiplyScalar(1/Math.max(dt,1e-5));cost+=.012*v.distanceToSquared(velocity[f]);if((at[f].y<-.7)!==(now[f].y<-.7))cost+=.03;}
   if(i<0)originalCost=cost;if(cost<best.cost)best={phase:p,cost};
  }return {...best,originalCost};
 }
 locomotion(speed,phase,out){let a,b,w;if(speed<1.37){a='idle';b='walk';w=clamp(speed/1.37,0,1);}else if(speed<2.91){a='walk';b='jog';w=(speed-1.37)/(2.91-1.37);}else{a='jog';b='sprint';w=clamp((speed-2.91)/(7.8-2.91),0,1);}if(this.database){a=this.database.gait(a,speed,this.selectionPose||out,this.selectionActor||0);b=this.database.gait(b,speed,this.selectionPose||out,this.selectionActor||0);}this.sample(a,phase*this.motions[a].duration,this.startPose);this.sample(b,phase*this.motions[b].duration,this.endPose);blendPose(out,this.startPose,this.endPose,w);return {[a]:1-w,[b]:w};}
}

/** Finite-duration inertial offsets. Interrupted blends start from the actual displayed pose. */
export class PoseTransition {
 constructor(pose){this.output=clonePose(pose);this.previous=clonePose(pose);this.offset=clonePose(pose);this.velocity=pose.positions.map(()=>new T.Vector3());this.angular=pose.positions.map(()=>new T.Vector3());this.blendVelocity=pose.positions.map(()=>new T.Vector3());this.blendAngular=pose.positions.map(()=>new T.Vector3());this.qOffset=pose.positions.map(()=>new T.Vector3());this.age=1;this.duration=.24;}
 begin(target,duration=.24,nextTarget=null,step=1/120){this.age=0;this.duration=duration;this.blendVelocity.forEach((v,i)=>v.copy(this.velocity[i]));this.blendAngular.forEach((v,i)=>v.copy(this.angular[i]));if(nextTarget){this.blendVelocity.forEach((v,i)=>v.sub(V.copy(nextTarget.positions[i]).sub(target.positions[i]).multiplyScalar(1/step)));this.blendAngular.forEach((v,i)=>{rotationVector(Q.copy(target.quaternions[i]).invert().multiply(nextTarget.quaternions[i]),V);v.addScaledVector(V,-1/step);});}this.offset.positions.forEach((p,i)=>{p.copy(this.output.positions[i]).sub(target.positions[i]);rotationVector(Q.copy(target.quaternions[i]).invert().multiply(this.output.quaternions[i]),this.qOffset[i]);});}
 advance(target,dt){copyPose(this.previous,this.output);this.age=Math.min(this.duration,this.age+dt);const u=clamp(this.age/this.duration,0,1),h=2*u**3-3*u*u+1,hv=(u**3-2*u*u+u)*this.duration;
  this.output.positions.forEach((p,i)=>p.copy(target.positions[i]).addScaledVector(this.offset.positions[i],h).addScaledVector(this.blendVelocity[i],hv));
  this.output.quaternions.forEach((q,i)=>{V.copy(this.qOffset[i]).multiplyScalar(h).addScaledVector(this.blendAngular[i],hv);rotationQuaternion(V,Q2);q.copy(target.quaternions[i]).multiply(Q2).normalize();});
  if(dt>0){this.velocity.forEach((v,i)=>v.copy(this.output.positions[i]).sub(this.previous.positions[i]).multiplyScalar(1/dt).clampLength(0,3));this.angular.forEach((v,i)=>{rotationVector(Q.copy(this.previous.quaternions[i]).invert().multiply(this.output.quaternions[i]),v).multiplyScalar(1/dt).clampLength(0,12);});}return this.output;
 }
}
