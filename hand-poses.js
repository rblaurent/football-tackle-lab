/** Missing hand tracks use native reference poses; grips blend, never accumulate rotations. */
export class HandPoses {
 constructor(data,rest,index){
  this.indices=data.skeleton.BoneNames.map((n,i)=>/^(Left|Right)(Hand(Thumb|Index|Middle|Ring|Pinky)[123]|InHand(Index|Middle|Ring|Pinky))$/.test(n)?i:-1).filter(i=>i>=0);this.names=data.skeleton.BoneNames;this.relaxed=rest.quaternions.map(q=>q.clone().normalize());this.closed=rest.quaternions.map(q=>q.clone().normalize());
  const clips=Object.entries(data.clips),idle=clips.find(([n])=>n.includes('idle_front_getup'))?.[1],grip=clips.find(([n])=>n.includes('stand_front_v1__p01'))?.[1];
  for(const [clip,bank,time] of [[idle,this.relaxed,0],[grip,this.closed,.65]])if(clip){const frame=Math.min(clip.frameCount-1,Math.round(time*30));for(const i of this.indices){const j=clip.qNames.indexOf(this.names[i]);if(j>=0)bank[i].fromArray(clip.quaternions[frame][j]).normalize();}}
 }
 fill(pose,motion){if(!motion.handChannels)motion.handChannels=new Set(motion.clip.qNames);for(const i of this.indices)if(!motion.handChannels.has(this.names[i]))pose.quaternions[i].copy(this.relaxed[i]);}
 grip(pose,side,weight){const w=Math.max(0,Math.min(1,weight));for(const i of this.indices)if(this.names[i].startsWith(side))pose.quaternions[i].slerp(this.closed[i],w).normalize();return pose;}
}
