/** Fit the CC0 mesh to the native bind skeleton once; animate that skeleton directly. */
import * as T from './vendor/three.module.js';
export const humanBoneMap={root:'Reference',pelvis:'Hips',spine_01:'Spine',spine_02:'Spine1',spine_03:'Spine3',neck_01:'Neck',Head:'Head',clavicle_l:'LeftShoulder',upperarm_l:'LeftArm',lowerarm_l:'LeftForeArm',hand_l:'LeftHand',clavicle_r:'RightShoulder',upperarm_r:'RightArm',lowerarm_r:'RightForeArm',hand_r:'RightHand',thigh_l:'LeftUpLeg',calf_l:'LeftLeg',foot_l:'LeftFoot',ball_l:'LeftToeBase',ball_leaf_l:'LeftToeEnd',thigh_r:'RightUpLeg',calf_r:'RightLeg',foot_r:'RightFoot',ball_r:'RightToeBase',ball_leaf_r:'RightToeEnd'};
for(const [side,long] of [['l','Left'],['r','Right']])for(const [finger,native] of [['index','Index'],['middle','Middle'],['ring','Ring'],['pinky','Pinky'],['thumb','Thumb']]){for(let i=1;i<=3;i++)humanBoneMap[`${finger}_0${i}_${side}`]=`${long}Hand${native}${i}`;humanBoneMap[`${finger}_04_leaf_${side}`]=`${long}Hand${native}End`;}
const children={pelvis:'spine_01',spine_01:'spine_02',spine_02:'spine_03',spine_03:'neck_01',neck_01:'Head',hand_l:'middle_01_l',hand_r:'middle_01_r',clavicle_l:'upperarm_l',upperarm_l:'lowerarm_l',lowerarm_l:'hand_l',clavicle_r:'upperarm_r',upperarm_r:'lowerarm_r',lowerarm_r:'hand_r',thigh_l:'calf_l',calf_l:'foot_l',foot_l:'ball_l',ball_l:'ball_leaf_l',thigh_r:'calf_r',calf_r:'foot_r',foot_r:'ball_r',ball_r:'ball_leaf_r'};
for(const s of ['l','r'])for(const f of ['index','middle','ring','pinky','thumb'])for(let i=1;i<=3;i++)children[`${f}_0${i}_${s}`]=i===3?`${f}_04_leaf_${s}`:`${f}_0${i+1}_${s}`;
function frame(primary,secondary){const x=primary.clone().normalize(),y=secondary.clone().addScaledVector(x,-secondary.dot(x));if(y.lengthSq()<1e-8)throw Error('Degenerate anatomical bind frame');y.normalize();const z=new T.Vector3().crossVectors(x,y).normalize();return new T.Matrix4().makeBasis(x,y,z);}
export function createNativeBinding(data,template,{compactPalette=false}={}){
 const root=new T.Group(),bones=data.skeleton.BoneNames.map(name=>{const b=new T.Bone();b.name=name;return b;}),byName=Object.fromEntries(bones.map(b=>[b.name,b]));
 bones.forEach((b,i)=>{const m=new T.Matrix4().fromArray(data.skeleton.LocalPose[i]);m.elements[15]=1;m.decompose(b.position,b.quaternion,b.scale);b.scale.set(1,1,1);const p=data.skeleton.Hierarchy[i];(p<0?root:bones[p]).add(b);});root.updateMatrixWorld(true);template.updateMatrixWorld(true);
 const old={};template.traverse(o=>{if(o.isBone)old[o.name]=o;});const position=o=>o.getWorldPosition(new T.Vector3()),oldSide=position(old.thigh_r).sub(position(old.thigh_l)),newSide=position(byName.RightUpLeg).sub(position(byName.LeftUpLeg));const facing=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.atan2(-newSide.z,newSide.x)-Math.atan2(-oldSide.z,oldSide.x));
 const transforms={},rotations={},aliases={},index=Object.fromEntries(bones.map((b,i)=>[b.name,i]));
 for(const [name,native] of Object.entries(humanBoneMap)){
  const a=old[name],b=byName[native];if(!a||!b)continue;aliases[name]=b;let rotation=facing.clone(),child=children[name];const lengthFit=new T.Matrix4();
  if(child&&old[child]&&byName[humanBoneMap[child]]){
   const pa=position(old[child]).sub(position(a)),pb=position(byName[humanBoneMap[child]]).sub(position(b));let sa=new T.Vector3(0,0,1),sb=sa.clone().applyQuaternion(facing);
   // The arm mesh must reach both native endpoints, not just the proximal joint.
   // Preserve cross-sectional thickness; do not globally scale the character.
   if(/^(clavicle|upperarm|lowerarm)_/.test(name)){const axis=pa.clone().normalize(),stretch=pb.length()/pa.length()-1,{x,y,z}=axis;lengthFit.set(1+stretch*x*x,stretch*x*y,stretch*x*z,0,stretch*y*x,1+stretch*y*y,stretch*y*z,0,stretch*z*x,stretch*z*y,1+stretch*z*z,0,0,0,0,1);}
   const side=name.endsWith('_l')?'l':name.endsWith('_r')?'r':null;
   if(side&&(name.startsWith('hand_')||/^(index|middle|ring|pinky|thumb)_/.test(name))){const long=side==='l'?'Left':'Right';sa=position(old['pinky_01_'+side]).sub(position(old['index_01_'+side]));sb=position(byName[long+'HandPinky1']).sub(position(byName[long+'HandIndex1']));}
   if(name.startsWith('foot_')||name.startsWith('ball_')){sa.set(0,1,0);sb.copy(sa);}
   if(pa.clone().cross(sa).lengthSq()>1e-8&&pb.clone().cross(sb).lengthSq()>1e-8)rotation.setFromRotationMatrix(frame(pb,sb).multiply(frame(pa,sa).invert()));
   else rotation.premultiply(new T.Quaternion().setFromUnitVectors(pa.normalize().applyQuaternion(facing),pb.normalize()));
  }else if(a.parent?.isBone&&rotations[a.parent.name])rotation.copy(rotations[a.parent.name]);
  rotations[name]=rotation;transforms[name]=new T.Matrix4().compose(position(b),rotation,new T.Vector3(1,1,1)).multiply(lengthFit).multiply(new T.Matrix4().makeTranslation(...position(a).negate().toArray()));
 }
 const weighted=new Set();template.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;for(let i=0;i<si.count;i++)for(let k=0;k<4;k++)if(sw.getComponent(i,k)>0){const name=humanBoneMap[mesh.skeleton.bones[si.getComponent(i,k)].name];if(index[name]===undefined)throw Error('Unmapped weighted bone');weighted.add(index[name]);}});
 const palette=compactPalette?[...weighted].sort((a,b)=>a-b).map(i=>bones[i]):bones,paletteIndex=Object.fromEntries(palette.map((b,i)=>[b.name,i]));
 const skeleton=new T.Skeleton(palette);skeleton.calculateInverses();
 function fit(mesh){
  const geometry=mesh.geometry.clone();geometry.setAttribute('kitPosition',mesh.geometry.attributes.position.clone());const p=geometry.attributes.position,n=geometry.attributes.normal,si=geometry.attributes.skinIndex,sw=geometry.attributes.skinWeight;
  if(!si||!sw)throw Error('Expected weighted character mesh');const skin=mesh.skeleton.bones,map=skin.map(b=>paletteIndex[humanBoneMap[b.name]]),weights=new Float32Array(sw.count*4),indices=new Uint16Array(si.count*4),v=new T.Vector3(),normal=new T.Vector3(),out=new T.Vector3(),nout=new T.Vector3(),normalMatrices=skin.map(b=>transforms[b.name]?new T.Matrix3().getNormalMatrix(transforms[b.name]):null),meshNormal=new T.Matrix3().getNormalMatrix(mesh.matrixWorld);
  for(let i=0;i<p.count;i++){
   v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);normal.fromBufferAttribute(n,i).applyMatrix3(meshNormal).normalize();out.set(0,0,0);nout.set(0,0,0);let sum=0;
   for(let k=0;k<4;k++){const j=si.getComponent(i,k),w=sw.getComponent(i,k);if(w<=0)continue;if(map[j]===undefined||!transforms[skin[j].name])throw Error('Unmapped weighted bone '+skin[j].name);sum+=w;indices[i*4+k]=map[j];weights[i*4+k]=w;out.addScaledVector(v.clone().applyMatrix4(transforms[skin[j].name]),w);nout.addScaledVector(normal.clone().applyMatrix3(normalMatrices[j]),w);}
   if(sum<1e-8)throw Error('Unweighted character vertex');out.multiplyScalar(1/sum);nout.normalize();p.setXYZ(i,out.x,out.y,out.z);n.setXYZ(i,nout.x,nout.y,nout.z);for(let k=0;k<4;k++)weights[i*4+k]/=sum;
  }
  geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geometry.computeBoundingBox();geometry.computeBoundingSphere();const fitted=new T.SkinnedMesh(geometry,mesh.material.clone());fitted.name=mesh.name;root.add(fitted);fitted.bind(skeleton,new T.Matrix4());fitted.frustumCulled=false;return fitted;
 }
 return {root,bones,byName,target:aliases,skeleton,fit,transforms,rotations};
}
