// Native skeleton skinning. Mesh fitting happens once; rendered and contact joints share one pose.
import * as T from './vendor/three.module.js';
import {clone as cloneSkeleton} from './vendor/addons/utils/SkeletonUtils.js';
import {createNativeBinding} from './native-skin.js';
import {bootContact,proxyMatrix} from './foot-contact.js';
export function createHuman(data,humanTemplate,hairTemplate,color,scene,options={}){
 const template=cloneSkeleton(humanTemplate.scene),binding=createNativeBinding(data,template,options),{root,bones,byName,target,skeleton}=binding;scene.add(root);
 const meshes=[];template.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});for(const old of meshes){const mesh=binding.fit(old);mesh.castShadow=!options.simpleMaterials;if(options.simpleMaterials)mesh.material=simpleMaterial(mesh.material);mesh.material.roughness=.87;if(mesh.name==='SuperHero_Male')dress(mesh,color);}
 const hair=hairTemplate.scene.clone(true);hair.applyMatrix4(binding.transforms.Head);root.add(hair);root.updateMatrixWorld(true);byName.Head.attach(hair);hair.traverse(o=>{if(o.isMesh){o.castShadow=true;o.material=options.simpleMaterials?simpleMaterial(o.material):o.material.clone();o.material.roughness=.9;o.material.color.set('#382820');}});
 const soles={};for(const side of ['l','r']){const foot=target['foot_'+side],proxy=bootContact(foot.getWorldPosition(new T.Vector3()),foot.getWorldQuaternion(new T.Quaternion()),target['ball_'+side].getWorldPosition(new T.Vector3()));
  for(const [part,color,roughness] of [['shoe','#eabd36',.65],['sole','#1d2730',.8]]){const mesh=new T.Mesh(new T.SphereGeometry(1,24,16),options.simpleMaterials?new T.MeshLambertMaterial({color}):new T.MeshStandardMaterial({color,roughness}));mesh.matrixAutoUpdate=false;mesh.matrix.copy(proxyMatrix(proxy[part]));mesh.castShadow=true;foot.add(mesh);if(part==='sole')soles[side]=mesh;}
 }
 const initial=bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()})),qa=new T.Quaternion(),v=new T.Vector3(),headRest=byName.Head.getWorldQuaternion(new T.Quaternion());
 function pose(clip,t,origin){
  bones.forEach((b,i)=>{b.position.copy(clip.positions?clip.positions[i]:initial[i].p);b.quaternion.copy(clip.positions?clip.quaternions[i]:initial[i].q);});
  if(!clip.positions){const f=Math.min(clip.frameCount-1,Math.max(0,t*30)),i=Math.floor(f),j=Math.min(i+1,clip.frameCount-1),w=f-i;
   clip.qNames.forEach((n,k)=>{const b=byName[n];if(b)b.quaternion.fromArray(clip.quaternions[i][k]).normalize().slerp(qa.fromArray(clip.quaternions[j][k]).normalize(),w);});
   clip.vNames.forEach((n,k)=>{const [name,type]=n.split('.'),b=byName[name];if(b&&type!=='s')b.position.fromArray(clip.vectors[i][k]).lerp(v.fromArray(clip.vectors[j][k]),w).multiplyScalar(.3048);});
  }
  root.position.copy(origin).negate();root.updateMatrixWorld(true);skeleton.update();
 }
 function soleY(side){const e=soles[side].matrixWorld.elements;return e[13]-Math.hypot(e[1],e[5],e[9]);}
 return {root,model:root,bones,byName,target,skeleton,binding,pose,soleHeights:()=>['l','r'].map(soleY),faceDirection:()=>new T.Vector3(0,0,1).applyQuaternion(byName.Head.getWorldQuaternion(new T.Quaternion()).multiply(headRest.clone().invert())),applySample:sample=>pose(sample,0,new T.Vector3())};
}
function simpleMaterial(material){return new T.MeshLambertMaterial({color:material.color,map:material.map,transparent:material.transparent,opacity:material.opacity,alphaTest:material.alphaTest,side:material.side});}
function dress(mesh,color){
 let geo=mesh.geometry.clone();geo.clearGroups();geo.addGroup(0,geo.index?geo.index.count:geo.attributes.position.count,0);let mat=mesh.material.clone();mat.normalMap=null;mat.roughness=.88;const kit=new T.Color(color),shorts=new T.Color('#182938'),socks=new T.Color('#e5ece4'),boots=new T.Color('#ddb735');
 mat.onBeforeCompile=shader=>{shader.uniforms.kitColor={value:kit};shader.uniforms.shortsColor={value:shorts};shader.uniforms.socksColor={value:socks};shader.uniforms.bootColor={value:boots};shader.vertexShader='attribute vec3 kitPosition; varying vec3 vRestPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRestPosition=kitPosition;');shader.fragmentShader='varying vec3 vRestPosition; uniform vec3 kitColor; uniform vec3 shortsColor; uniform vec3 socksColor; uniform vec3 bootColor;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float px=abs(vRestPosition.x), py=vRestPosition.y;
 bool shirt=(py>=1.015 && py<1.535 && px<.285) || (px>=.24 && px<.485 && py>1.33 && py<1.6);
 if(py<.13)diffuseColor.rgb=bootColor;
 else if(py<.45)diffuseColor.rgb=socksColor;
 else if(py>.63 && py<1.015 && px<.35)diffuseColor.rgb=shortsColor;
 else if(shirt){diffuseColor.rgb=kitColor;if((py>1.335 && py<1.36)||(px>.455&&px<.48))diffuseColor.rgb=socksColor;}
 `)};mat.customProgramCacheKey=()=>color;mesh.geometry=geo;mesh.material=mat;mesh.normalizeSkinWeights();
}
