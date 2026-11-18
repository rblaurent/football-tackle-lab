// Shared skinned character and native-rig retargeting. See docs/FORMATS.md.
import * as T from './vendor/three.module.js';
import {clone as cloneSkeleton} from './vendor/addons/utils/SkeletonUtils.js';
const tmp=new T.Vector3();
export function createHuman(data,humanTemplate,hairTemplate,color,scene){
 const root=new T.Group();scene.add(root);const bones=data.skeleton.BoneNames.map(()=>new T.Object3D()),byName={};
 bones.forEach((o,i)=>{o.name=data.skeleton.BoneNames[i];byName[o.name]=o;let m=new T.Matrix4().fromArray(data.skeleton.LocalPose[i]);m.elements[15]=1;m.decompose(o.position,o.quaternion,o.scale);o.scale.set(1,1,1);(data.skeleton.Hierarchy[i]<0?root:bones[data.skeleton.Hierarchy[i]]).add(o)});
 root.updateMatrixWorld(true);const srcRest={};bones.forEach(b=>srcRest[b.name]=b.getWorldQuaternion(new T.Quaternion()));
 const model=cloneSkeleton(humanTemplate.scene);root.add(model);model.updateMatrixWorld(true);const target={},rest=[];
 model.traverse(o=>{if(o.isBone){target[o.name]=o;rest.push({o,p:o.position.clone(),q:o.quaternion.clone(),world:o.getWorldQuaternion(new T.Quaternion())})}if(o.isMesh){o.castShadow=true;o.frustumCulled=false;o.material=o.material.clone();o.material.roughness=.87;if(o.name==='SuperHero_Male')dress(o,color);}});
 const hair=hairTemplate.scene.clone(true);target.Head.attach(hair);hair.traverse(o=>{if(o.isMesh){o.castShadow=true;o.material=o.material.clone();o.material.roughness=.9;o.material.color.set('#382820');}});
 for(let side of ['l','r']){const foot=target['foot_'+side],wp=foot.getWorldPosition(new T.Vector3()),group=new T.Group();model.add(group);let shoe=new T.Mesh(new T.SphereGeometry(1,24,16),new T.MeshStandardMaterial({color:'#eabd36',roughness:.65}));shoe.scale.set(.078,.069,.153);shoe.position.set(wp.x,.075,wp.z+.065);shoe.castShadow=true;group.add(shoe);let sole=new T.Mesh(new T.SphereGeometry(1,24,12),new T.MeshStandardMaterial({color:'#1d2730',roughness:.8}));sole.scale.set(.08,.015,.156);sole.position.copy(shoe.position);sole.position.y=.03;group.add(sole);model.updateMatrixWorld(true);foot.attach(group);}
 const map={pelvis:'Hips',spine_01:'Spine',spine_02:'Spine1',spine_03:'Spine3',neck_01:'Neck',Head:'Head',clavicle_l:'LeftShoulder',upperarm_l:'LeftArm',lowerarm_l:'LeftForeArm',hand_l:'LeftHand',clavicle_r:'RightShoulder',upperarm_r:'RightArm',lowerarm_r:'RightForeArm',hand_r:'RightHand',thigh_l:'LeftUpLeg',calf_l:'LeftLeg',foot_l:'LeftFoot',ball_l:'LeftToeBase',thigh_r:'RightUpLeg',calf_r:'RightLeg',foot_r:'RightFoot',ball_r:'RightToeBase'};
 for(let [side,long] of [['l','Left'],['r','Right']])for(let [finger,longFinger] of [['index','Index'],['middle','Middle'],['ring','Ring'],['pinky','Pinky'],['thumb','Thumb']])for(let i=1;i<=3;i++){let tn=`${finger}_0${i}_${side}`,sn=`${long}Hand${longFinger}${i}`;if(byName[sn]&&target[tn])map[tn]=sn;}
 const childTargets={hand_l:'middle_01_l',hand_r:'middle_01_r',clavicle_l:'upperarm_l',upperarm_l:'lowerarm_l',lowerarm_l:'hand_l',clavicle_r:'upperarm_r',upperarm_r:'lowerarm_r',lowerarm_r:'hand_r',thigh_l:'calf_l',calf_l:'foot_l',foot_l:'ball_l',thigh_r:'calf_r',calf_r:'foot_r',foot_r:'ball_r',spine_01:'spine_02',spine_02:'spine_03'};
 for(let side of ['l','r'])for(let finger of ['index','middle','ring','pinky','thumb'])for(let i=1;i<3;i++)childTargets[`${finger}_0${i}_${side}`]=`${finger}_0${i+1}_${side}`;
 for(let r of rest){r.align=new T.Quaternion();let child=childTargets[r.o.name];if(!child)continue;let sn=map[r.o.name],cn=map[child];if(!sn||!cn)continue;let from=target[child].getWorldPosition(new T.Vector3()).sub(r.o.getWorldPosition(new T.Vector3())).normalize(),to=byName[cn].getWorldPosition(new T.Vector3()).sub(byName[sn].getWorldPosition(new T.Vector3())).normalize();r.align.setFromUnitVectors(from,to);}
 const depth=o=>{let n=0;while(o.parent){n++;o=o.parent}return n};const retarget=rest.filter(r=>map[r.o.name]).sort((a,b)=>depth(a.o)-depth(b.o));
 const initial=bones.map(o=>({p:o.position.clone(),q:o.quaternion.clone()}));const inverse=new T.Quaternion(),desired=new T.Quaternion(),parentQ=new T.Quaternion(),hip=new T.Vector3(),qa=new T.Quaternion();
 function pose(clip,t,origin){if(clip.positions){bones.forEach((o,k)=>{o.position.copy(clip.positions[k]);o.quaternion.copy(clip.quaternions[k])});}else{const f=Math.min(clip.frameCount-1,Math.max(0,t*30)),i=Math.floor(f),j=Math.min(i+1,clip.frameCount-1),w=f-i;
 bones.forEach((o,k)=>{o.position.copy(initial[k].p);o.quaternion.copy(initial[k].q)});
 clip.qNames.forEach((n,k)=>{let o=byName[n];if(!o)return;o.quaternion.fromArray(clip.quaternions[i][k]).normalize();qa.fromArray(clip.quaternions[j][k]).normalize();o.quaternion.slerp(qa,w)});
 clip.vNames.forEach((n,k)=>{let [name,type]=n.split('.');let o=byName[name];if(!o||type==='s')return;o.position.fromArray(clip.vectors[i][k]).lerp(tmp.fromArray(clip.vectors[j][k]),w).multiplyScalar(.3048)});
 }
 root.position.copy(origin).multiplyScalar(-1);root.updateMatrixWorld(true);rest.forEach(r=>{r.o.position.copy(r.p);r.o.quaternion.copy(r.q)});model.updateMatrixWorld(true);
 for(let r of retarget){let sn=map[r.o.name];desired.copy(byName[sn].getWorldQuaternion(qa)).multiply(inverse.copy(srcRest[sn]).invert()).multiply(r.align).multiply(r.world);r.o.parent.getWorldQuaternion(parentQ);r.o.quaternion.copy(parentQ.invert()).multiply(desired).normalize();if(r.o.name==='pelvis'){byName.Hips.getWorldPosition(hip);r.o.parent.worldToLocal(hip);r.o.position.copy(hip);}r.o.updateMatrixWorld(true)}
 }
 return {root,pose,bones,byName,model,target,applySample:sample=>pose(sample,0,new T.Vector3())};
}
function dress(mesh,color){
 let geo=mesh.geometry.clone();geo.clearGroups();geo.addGroup(0,geo.index?geo.index.count:geo.attributes.position.count,0);let mat=mesh.material.clone();mat.normalMap=null;mat.roughness=.88;const kit=new T.Color(color),shorts=new T.Color('#182938'),socks=new T.Color('#e5ece4'),boots=new T.Color('#ddb735');
 mat.onBeforeCompile=shader=>{shader.uniforms.kitColor={value:kit};shader.uniforms.shortsColor={value:shorts};shader.uniforms.socksColor={value:socks};shader.uniforms.bootColor={value:boots};shader.vertexShader='varying vec3 vRestPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRestPosition=position;');shader.fragmentShader='varying vec3 vRestPosition; uniform vec3 kitColor; uniform vec3 shortsColor; uniform vec3 socksColor; uniform vec3 bootColor;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float px=abs(vRestPosition.x), py=vRestPosition.y;
 bool shirt=(py>=1.015 && py<1.535 && px<.285) || (px>=.24 && px<.485 && py>1.33 && py<1.6);
 if(py<.13)diffuseColor.rgb=bootColor;
 else if(py<.45)diffuseColor.rgb=socksColor;
 else if(py>.63 && py<1.015 && px<.35)diffuseColor.rgb=shortsColor;
 else if(shirt){diffuseColor.rgb=kitColor;if((py>1.335 && py<1.36)||(px>.455&&px<.48))diffuseColor.rgb=socksColor;}
 `)};mat.customProgramCacheKey=()=>color;mesh.geometry=geo;mesh.material=mat;mesh.normalizeSkinWeights();
}
