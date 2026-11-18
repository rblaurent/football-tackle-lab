/** Original interaction scheduler. Native shirt pairs; authored grab/push/handball poses. */
import * as T from './vendor/three.module.js';
const up=new T.Vector3(0,1,0),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const interactionTypes=['shirtFront','shirtSide','grab','push','handball'];
export const interactionLabels={shirtFront:'Front shirt pull',shirtSide:'Side shirt pull',grab:'Arm grab',push:'Push',handball:'Handball offence'};
export function reachHand(lib,pose,side,goal){
 lib.forwardKinematics(pose);const ui=lib.index[side+'Arm'],ki=lib.index[side+'ForeArm'],fi=lib.index[side+'Hand'],h=lib.fkP[ui].clone(),k=lib.fkP[ki].clone(),f=lib.fkP[fi].clone(),a=h.distanceTo(k),b=k.distanceTo(f),dir=goal.clone().sub(h),d=clamp(dir.length(),Math.abs(a-b)+.001,a+b-.001);dir.normalize();const along=(a*a+d*d-b*b)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along)),bend=k.clone().sub(h);bend.addScaledVector(dir,-bend.dot(dir));if(bend.lengthSq()<1e-8)bend.set(0,-1,0).addScaledVector(dir,dir.y);bend.normalize();const desiredK=h.clone().addScaledVector(dir,along).addScaledVector(bend,height),rotate=(i,from,to)=>{const q=new T.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()).multiply(lib.fkQ[i]);pose.quaternions[i].copy(lib.fkQ[lib.data.skeleton.Hierarchy[i]]).invert().multiply(q).normalize();lib.forwardKinematics(pose);};
 rotate(ui,k.clone().sub(h),desiredK.sub(h));rotate(ki,lib.fkP[fi].clone().sub(lib.fkP[ki]),h.addScaledVector(dir,d).sub(lib.fkP[ki]));return pose;
}
function curl(lib,pose,side,w){for(const finger of ['Index','Middle','Ring','Pinky'])for(let i=1;i<=3;i++){const n=lib.index[side+'Hand'+finger+i];if(n!==undefined)pose.quaternions[n].multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),(side==='Left'?1:-1)*w*.65));}}
export class InteractionDirector {
 constructor(world,type){this.world=world;this.type=type;this.phase='approach';this.age=0;this.started=false;this.contact=false;this.flight=false;this.a=world.actors[0];this.b=world.actors[1];this.lib=world.library;this.ids=type==='shirtFront'?['shirtFrontA','shirtFrontB']:type==='shirtSide'?['shirtSideB','shirtSideA']:null;
  this.separation=this.ids?this.lib.motions[this.ids[0]].trajectory[0].distanceTo(this.lib.motions[this.ids[1]].trajectory[0]):type==='handball'?2.3:type==='grab'?.45:.48;this.separation=Math.max(.45,this.separation);this.startAt=world.time;world.record('interaction requested',{interaction:type});
 }
 update(dt){this.age+=dt;if(this.phase==='approach'){
  const d=this.b.position.clone().sub(this.a.position);d.y=0;const distance=d.length();const error=distance-this.separation;this.a.intent={mode:'move',direction:d.normalize().multiplyScalar(error>=0?1:-1),pace:Math.min(3,Math.max(.1,Math.abs(error)*2.5))};this.b.intent.mode='idle';
  if(Math.abs(distance-this.separation)<.09&&this.a.speed<.8)this.begin();else if(this.age>9){this.cancel('target out of reach');}return;
 }
 if(this.phase!=='active')return;this.time=Math.min(this.duration,this.time+dt);const t=this.time;
 if(this.ids)this.nativePair(t);else this.authored(t);
 if(t>=this.duration)this.finish();
 }
 begin(){this.phase='active';this.time=0;this.duration=this.ids?Math.min(...this.ids.map(id=>this.lib.motions[id].duration)):this.type==='handball'?2:1.8;this.origin=this.a.position.clone().lerp(this.b.position,.5);const direction=this.b.position.clone().sub(this.a.position).normalize();this.direction=direction;this.starts=[this.a.position.clone(),this.b.position.clone()];
  if(this.ids){const p=this.ids.map(id=>this.lib.motions[id].trajectory[0].clone());this.captureOrigin=p[0].clone().lerp(p[1],.5);const native=p[1].clone().sub(p[0]);this.heading=Math.atan2(-direction.z,direction.x)-Math.atan2(-native.z,native.x);}else this.heading=this.a.heading;
  if(!this.ids){const yaw=Math.atan2(-direction.z,direction.x);this.a.rebase(yaw-this.a.heading);this.b.rebase(yaw+Math.PI-this.b.heading);}
  for(const actor of [this.a,this.b]){actor.intent.mode='idle';actor.handTargets=null;actor.external={pose:this.lib.createPose(),position:actor.position.clone()};actor.enterExternal(interactionLabels[this.type]);}
  this.world.record('interaction started',{interaction:this.type,source:this.ids?'native paired capture':'authored pose and contact logic'});
  if(this.ids)this.nativePair(0);else this.authored(0);
 }
 nativePair(t){const w=smooth(t/.32);[this.a,this.b].forEach((actor,i)=>{const id=this.ids[i],m=this.lib.motions[id];this.lib.sample(id,t,actor.external.pose);const f=clamp(t*30,0,m.clip.frameCount-1),fi=Math.floor(f),p=m.trajectory[fi].clone().lerp(m.trajectory[Math.min(fi+1,m.trajectory.length-1)],f-fi).sub(this.captureOrigin).applyAxisAngle(up,this.heading).add(this.origin);p.y=0;actor.external.position.copy(this.starts[i]).lerp(p,w);actor.external.heading=this.heading;actor.external.motion=id;});}
 authored(t){const envelope=smooth(t/.45)*(1-smooth((t-1.25)/.5)),push=this.type==='push',grab=this.type==='grab',handball=this.type==='handball';
  for(const [i,actor] of [this.a,this.b].entries()){this.lib.sample('idle',this.world.time,actor.external.pose);actor.external.position.copy(this.starts[i]);actor.external.motion='authored '+this.type;actor.handTargets=null;}
  if(push&&this.contact){const retreat=smooth((t-this.contactAt)/.65)*.65;this.b.external.position.addScaledVector(this.direction,retreat);const p=this.b.external.pose,jog=this.lib.createPose();this.lib.locomotion(1.2,(t-this.contactAt)/.8,jog);const tilt=Math.sin(Math.PI*clamp((t-this.contactAt)/.95))*.2;this.lib.forwardKinematics(p);const joint=this.lib.index.Spine1,parent=this.lib.data.skeleton.Hierarchy[joint],axis=new T.Vector3().crossVectors(up,this.direction).applyAxisAngle(up,-this.b.heading),q=new T.Quaternion().setFromAxisAngle(axis,tilt).multiply(this.lib.fkQ[joint]);p.quaternions[joint].copy(this.lib.fkQ[parent]).invert().multiply(q);const blend=.6*Math.sin(Math.PI*clamp((t-this.contactAt)/.8));p.quaternions.forEach((q,i)=>q.slerp(jog.quaternions[i],blend));}
  if(grab){const pose=this.b.external.pose;this.lib.forwardKinematics(pose);const goal=this.lib.fkP[this.lib.index.LeftHand].clone().add(new T.Vector3(.24,.05,0).multiplyScalar(envelope));reachHand(this.lib,pose,'Left',goal);this.b.handTargets={Left:goal};}
  const actor=this.a,pose=actor.external.pose;this.lib.forwardKinematics(pose);const base=this.lib.fkP.map(p=>p.clone()),goals={};
  if(handball){const shoulder=base[this.lib.index.RightArm],out=new T.Vector3(0,0,.52);const goal=shoulder.clone().add(out);goal.x+=.14;goals.Right=base[this.lib.index.RightHand].clone().lerp(goal,envelope);}
  else {const targetPose=this.b.external.pose;this.lib.forwardKinematics(targetPose);const chest=this.lib.fkP[this.lib.index.Spine3].clone().applyAxisAngle(up,this.b.heading).add(this.b.external.position);const arm=this.lib.fkP[this.lib.index.LeftForeArm].clone().lerp(this.lib.fkP[this.lib.index.LeftHand],.6).applyAxisAngle(up,this.b.heading).add(this.b.external.position);for(const side of grab?['Right']:['Left','Right']){const point=(grab?arm:chest.clone().add(new T.Vector3(0,0,side==='Left'?.13:-.13).applyAxisAngle(up,actor.heading))).sub(actor.external.position).applyAxisAngle(up,-actor.heading);goals[side]=base[this.lib.index[side+'Hand']].clone().lerp(point,envelope);}}
  for(const [side,goal] of Object.entries(goals)){reachHand(this.lib,pose,side,goal);if(grab)curl(this.lib,pose,side,envelope);}
  actor.handTargets=goals;
  // Handball is an authored deliberate arm block; the ball remains a free projectile.
  if(handball&&!this.flight&&t>.42){this.flight=true;this.lib.forwardKinematics(pose);const target=this.lib.fkP[this.lib.index.RightHand].clone().applyAxisAngle(up,actor.heading).add(actor.position),flight=.55,ball=this.world.ball;ball.position.copy(target).addScaledVector(this.direction,2.3);ball.position.y=target.y-.12;ball.velocity.copy(target).sub(ball.position);const dy=ball.velocity.y;ball.velocity.multiplyScalar(.6/(1-Math.exp(-.6*flight)));ball.velocity.y=dy/flight+9.81*flight/2;ball.airborne=true;this.world.record('ball served',{interaction:this.type});}
 }
 contacts(){if(this.phase!=='active'||this.contact||this.type==='handball')return;const [a,b]=[this.a,this.b];const chest=this.worldPoint(b,'Spine3'),hips=this.worldPoint(b,'Hips'),arm=this.worldPoint(b,'LeftForeArm').lerp(this.worldPoint(b,'LeftHand'),.6);let best=Infinity,offender=0;
  for(const [index,attacker,victim] of [[0,a,b]])for(const hand of attacker.hands){let target=this.type==='grab'?arm:chest;if(this.ids){const axis=chest.clone().sub(hips),u=clamp(hand.clone().sub(hips).dot(axis)/axis.lengthSq());target=hips.clone().addScaledVector(axis,u);}const distance=hand.distanceTo(target);if(distance<best){best=distance;offender=index;}}
  const threshold=this.ids?.3:this.type==='grab'?.15:.23;if(best<threshold&&this.time>(this.type==='push'?.42:.15)){this.contact=true;this.contactAt=this.time;this.world.record(this.type==='push'?'push contact':this.type==='grab'?'arm grab contact':'shirt pull contact',{interaction:this.type,actor:offender,target:1-offender,distance:best});}
 }
 worldPoint(actor,name){const fk=this.lib.forwardKinematics(actor.renderPose);return fk[this.lib.index[name]].clone().applyAxisAngle(up,actor.heading).add(actor.position);}
 handballContact(actor){if(this.type==='handball'&&this.phase==='active'&&this.time>.42&&!this.contact){this.contact=true;this.world.record('handball offence',{actor,interaction:this.type,reason:'deliberate extended-arm block in this authored scenario'});}}
 finish(){if(this.phase==='done')return;this.phase='done';for(const actor of [this.a,this.b]){actor.external=null;actor.handTargets=null;actor.enter(actor.intent.mode!=='idle'?'move':actor.speed>.2?'stop':'idle');}this.world.record('interaction ended',{interaction:this.type,contact:this.contact});this.world.lastInteraction={type:this.type,contact:this.contact};this.world.interaction=null;}
 cancel(reason='cancelled'){if(this.phase==='active')this.finish();else {this.a.intent.mode='idle';this.world.interaction=null;}this.world.record('interaction cancelled',{interaction:this.type,reason});}
}
