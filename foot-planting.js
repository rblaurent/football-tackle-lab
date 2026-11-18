import * as T from './vendor/three.module.js';
import {copyPose} from './animation.js';
import {inferIK,validateNetwork} from './neural-ik.js';
import {bootContact,soleClearance} from './foot-contact.js';
const up=new T.Vector3(0,1,0),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
/** Bounded world-space foot planting; recovered knee IK supplies the bend hint.
 * Two-bone solving preserves the source skeleton's limb lengths exactly.
 */
export class FootPlanting {
 constructor(lib,network=null){this.lib=lib;this.network=network;if(network)validateNetwork(network);this.output=lib.createPose();this.locks=[null,null];this.previous=[null,null];this.targets=[null,null];this.weights=[0,0];this.groundWeights=[0,0];lib.forwardKinematics(lib.rest);this.proxies=['Left','Right'].map(side=>bootContact(lib.fkP[lib.index[side+'Foot']],lib.fkQ[lib.index[side+'Foot']],lib.fkP[lib.index[side+'ToeBase']]).sole);}
 solve(pose,position,heading,state,dt){const lib=this.lib;copyPose(this.output,pose);const fk=lib.forwardKinematics(pose),hip=fk[lib.index.Hips].clone(),hipQ=lib.fkQ[lib.index.Hips].clone(),footQ=['LeftFoot','RightFoot'].map(n=>lib.fkQ[lib.index[n]].clone()),goals=[];
  for(let i=0;i<2;i++){const index=lib.index[i?'RightFoot':'LeftFoot'],local=fk[index].clone(),world=local.clone().applyAxisAngle(up,heading).add(position),speed=this.previous[i]?world.distanceTo(this.previous[i])/dt:0;this.previous[i]=world.clone();const allowed=['idle','start','move','stop','turn'].includes(state),lock=this.locks[i];
   if(lock&&(local.y>.19||world.distanceTo(lock.point)>.24||(lock.age>.42&&state!=='idle')||!allowed))this.locks[i]=null;
   if(!this.locks[i]&&this.weights[i]<.1&&allowed&&local.y<.135&&speed<1.25)this.locks[i]={point:new T.Vector3(world.x,soleClearance(this.proxies[i],footQ[i])+position.y,world.z),age:0};
   const plant=this.locks[i];if(plant){plant.age+=dt;plant.point.y=soleClearance(this.proxies[i],footQ[i])+position.y;this.targets[i]=plant.point.clone();}this.weights[i]=T.MathUtils.damp(this.weights[i],plant?1:0,30,dt);
   const target=this.targets[i]?this.targets[i].clone().sub(position).applyAxisAngle(up,-heading):local;const goal=local.lerp(target,this.weights[i]),height=soleClearance(this.proxies[i],footQ[i]),standing=T.MathUtils.smoothstep(hip.y,.55,.8),near=1-T.MathUtils.smoothstep(local.y-height,.025,.12);
   this.groundWeights[i]=T.MathUtils.damp(this.groundWeights[i],standing*near,25,dt);goal.y+=Math.min(.24,Math.max(0,height-goal.y))*this.groundWeights[i];goals.push(goal);
  }
  if(this.weights.every((w,i)=>w<.001&&this.groundWeights[i]<.001))return this.output;
  let knees=null;if(this.network){const inverse=hipQ.clone().invert(),input=goals.flatMap(g=>g.clone().sub(hip).applyQuaternion(inverse).multiplyScalar(1/.3048).toArray());input.push(hip.y/.3048);const predicted=inferIK(this.network,input);knees=[new T.Vector3().fromArray(predicted,0),new T.Vector3().fromArray(predicted,3)].map(p=>p.multiplyScalar(.3048).applyQuaternion(hipQ).add(hip));}
  for(let side=0;side<2;side++){
   if(this.weights[side]<.001&&this.groundWeights[side]<.001)continue;lib.forwardKinematics(this.output);const long=side?'Right':'Left',ui=lib.index[long+'UpLeg'],ki=lib.index[long+'Leg'],fi=lib.index[long+'Foot'],h=lib.fkP[ui].clone(),k=lib.fkP[ki].clone(),f=lib.fkP[fi].clone(),footQ=lib.fkQ[fi].clone(),a=h.distanceTo(k),b=k.distanceTo(f),direction=goals[side].clone().sub(h),distance=clamp(direction.length(),Math.abs(a-b)+.001,a+b-.001);direction.normalize();const target=h.clone().addScaledVector(direction,distance),along=(a*a+distance*distance-b*b)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));let bend=(knees?knees[side]:k).clone().sub(h);bend.addScaledVector(direction,-bend.dot(direction));if(bend.lengthSq()<1e-8)bend=k.clone().sub(h).addScaledVector(direction,-k.clone().sub(h).dot(direction));bend.normalize();const desiredKnee=h.clone().addScaledVector(direction,along).addScaledVector(bend,height);
   let delta=new T.Quaternion().setFromUnitVectors(k.clone().sub(h).normalize(),desiredKnee.sub(h).normalize()),worldQ=delta.multiply(lib.fkQ[ui]);this.output.quaternions[ui].copy(lib.fkQ[lib.data.skeleton.Hierarchy[ui]]).invert().multiply(worldQ).normalize();lib.forwardKinematics(this.output);
   delta=new T.Quaternion().setFromUnitVectors(lib.fkP[fi].clone().sub(lib.fkP[ki]).normalize(),target.clone().sub(lib.fkP[ki]).normalize());worldQ=delta.multiply(lib.fkQ[ki]);this.output.quaternions[ki].copy(lib.fkQ[lib.data.skeleton.Hierarchy[ki]]).invert().multiply(worldQ).normalize();lib.forwardKinematics(this.output);this.output.quaternions[fi].copy(lib.fkQ[lib.data.skeleton.Hierarchy[fi]]).invert().multiply(footQ).normalize();
  }
  return this.output;
 }
}
