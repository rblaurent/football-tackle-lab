import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {MotionLibrary} from '../animation.js';
import {inferIK,validateNetwork} from '../neural-ik.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {values}=parseArgs({options:{data:{type:'string',default:path.join(root,'controller-data.json')},networks:{type:'string',default:path.join(root,'research/fc27-neural-ik.json')},out:{type:'string'}}});
const lib=new MotionLibrary(JSON.parse(fs.readFileSync(values.data))),networks=JSON.parse(fs.readFileSync(values.networks)),pose=lib.createPose(),report={samplesPerModel:240,units:'metres',interpretation:'Reconstruction against decoded native clips, not against EA runtime outputs. Hip-local coordinates in feet; input-major dense weights and min/max [0,1] normalization are inferred conventions.',models:{}};
for(const [name,model] of Object.entries(networks)){
 validateNetwork(model);let squared=0,count=0,maxJointError=0;
 for(const id of ['idle','walk','jog','sprint'])for(let i=0;i<60;i++){
  lib.sample(id,i/60*lib.motions[id].duration,pose);const fk=lib.forwardKinematics(pose),hip=fk[lib.index.Hips],inverse=lib.fkQ[lib.index.Hips].clone().invert(),local={};
  const component=n=>{if(n==='HipsY')return hip.y/.3048;const bone=n.slice(0,-1),axis=n.at(-1).toLowerCase();if(!local[bone])local[bone]=fk[lib.index[bone]].clone().sub(hip).applyQuaternion(inverse).multiplyScalar(1/.3048);return local[bone][axis];};
  const output=inferIK(model,model.InputNames.map(component)),expected=model.OutputNames.map(component);
  for(let j=0;j<output.length;j++){squared+=((output[j]-expected[j])*.3048)**2;count++;}
  for(let j=0;j<output.length;j+=3)maxJointError=Math.max(maxJointError,Math.hypot(...output.slice(j,j+3).map((v,k)=>(v-expected[j+k])*.3048)));
 }
 report.models[name]={inputs:model.NumInputs,outputs:model.NumOutputs,layers:model.NumLayers,coordinateRMSE:Math.sqrt(squared/count),maxJointError};
}
if(values.out)fs.writeFileSync(values.out,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
