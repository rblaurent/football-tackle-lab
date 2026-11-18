/** Our deterministic football controller. Simulation units are metres, seconds, Y-up. */
import * as T from './vendor/three.module.js';
import {MotionLibrary,PoseTransition} from './animation.js';
import {FootPlanting} from './foot-planting.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const up=new T.Vector3(0,1,0),zero=new T.Vector3();
function approach(a,b,amount){return a<b?Math.min(b,a+amount):Math.max(b,a-amount);}
export class FootballActor {
 constructor(library,position,color,network=null){this.lib=library;this.position=position.clone();this.velocity=new T.Vector3();this.heading=0;this.color=color;this.speed=0;this.phase=0;this.state='idle';this.action='idle';this.time=0;this.age=0;this.intent={mode:'idle',direction:new T.Vector3(1,0,0),pace:3};this.target=library.createPose();library.sample('idle',0,this.target);this.mixer=new PoseTransition(this.target);this.planting=new FootPlanting(library,network);this.renderPose=this.mixer.output;this.weights={idle:1};this.history=[];this.eventSequence=0;this.cooldown=0;this.feet=[new T.Vector3(),new T.Vector3()];this.oldFeet=this.feet.map(p=>p.clone());this.knees=this.feet.map(p=>p.clone());this.updateFeet();this.oldFeet.forEach((p,i)=>p.copy(this.feet[i]));}
 enter(state,action=state){const previous=this.state;this.state=state;this.action=action;this.age=0;this.time=0;let entry={time:0,cost:0};
  if(state==='move'){entry=this.lib.match('jog',this.mixer.output);this.phase=entry.time/this.lib.motions.jog.duration;this.lib.locomotion(this.speed,this.phase,this.target);}
  else {if(state==='recover'){entry=this.lib.recovery(this.mixer.output);this.action=entry.id;}else if(state==='stop')entry=this.lib.match('stop',this.mixer.output,{max:.75});else if(state==='start')entry=this.lib.match('start',this.mixer.output,{max:.12});this.time=entry.time;this.lib.sample(this.action,this.time,this.target);}
  const next=this.lib.createPose();if(state==='move')this.lib.locomotion(this.speed,this.phase+(1/120)/this.lib.motions.jog.duration,next);else this.lib.sample(this.action,this.time+(1/120)*(state==='stop'?1.65:state==='start'||state==='idle'?1.25:1),next);this.mixer.begin(this.target,state==='recover'?.27:state==='tackle'?.13:.22,next);this.history.push({from:previous,to:state,action:this.action,entry:this.time,cost:entry.cost});if(this.history.length>32)this.history.shift();
 }
 requestTackle(ball=this.lastBall){if(['tackle','recover','fall'].includes(this.state)||this.cooldown>0)return false;this.enter('tackle');this.planTackle(ball);this.eventSequence++;return true;}
 fall(){if(['fall','recover','tackle'].includes(this.state))return;this.enter('fall');this.cooldown=1;}
 planTackle(ball){this.tacklePlan=null;if(!ball||this.position.distanceTo(ball.position)>3.2)return;const pose=this.lib.createPose();let best=null;for(let t=.16;t<=.48;t+=.025){this.lib.sample('tackle',t,pose);const fk=this.lib.forwardKinematics(pose),root=this.lib.rootDelta('tackle',0,t).multiplyScalar(.72);for(let foot=0;foot<2;foot++){const local=fk[this.lib.index[foot?'RightFoot':'LeftFoot']];if(local.y>.26)continue;const predicted=ball.position.clone().addScaledVector(ball.velocity,(1-Math.exp(-.6*t))/.6).sub(this.position).applyAxisAngle(up,-this.heading);predicted.y=0;const correction=predicted.sub(root).sub(local);correction.y=0;const cost=correction.length();if(!best||cost<best.cost)best={time:t,foot,correction,cost};}}if(best&&best.cost<=1.55)this.tacklePlan=best;}
 step(dt,ball){this.lastBall=ball;
  this.oldFeet.forEach((p,i)=>p.copy(this.feet[i]));this.cooldown=Math.max(0,this.cooldown-dt);this.age+=dt;
  let direction=this.intent.direction.clone(),desired=this.intent.mode==='idle'?0:this.intent.pace;
  if(this.intent.mode==='chase'){
   const lead=clamp(this.position.distanceTo(ball.position)/Math.max(this.intent.pace,1),0,.65);direction.copy(ball.position).addScaledVector(ball.velocity,lead).sub(this.position);direction.y=0;const distance=direction.length();
   if(this.chaseWaiting&&distance>1.15)this.chaseWaiting=false;else if(distance<.62)this.chaseWaiting=true;if(this.chaseWaiting)desired=0;else desired*=clamp((distance-.48)/1.2,.25,1);
  }
  if(direction.lengthSq()<.001)desired=0;else direction.normalize();
  const desiredHeading=desired>0?Math.atan2(-direction.z,direction.x):this.heading,angle=wrap(desiredHeading-this.heading);
  if(!['tackle','recover','fall'].includes(this.state))this.heading+=clamp(angle,-dt*3.8,dt*3.8);
  if(this.state==='idle'&&desired>.1)this.enter('start');
  else if(['start','move','turn'].includes(this.state)&&desired<.1)this.enter('stop');
  else if(this.state==='stop'&&desired>.1)this.enter('move');
  else if(this.state==='move'&&Math.abs(angle)>1.0&&this.speed>1.7&&this.cooldown===0){this.enter('turn');this.cooldown=2;}
  const locked=['tackle','recover','fall'].includes(this.state),m=this.lib.motions[this.action];
  if(locked){const last=this.time;this.time=Math.min(m.duration,this.time+dt);const delta=this.lib.rootDelta(this.action,last,this.time).applyAxisAngle(up,this.heading);delta.y=0;if(this.state==='tackle'){delta.multiplyScalar(.72);if(this.tacklePlan){const smooth=t=>{const u=clamp(t/this.tacklePlan.time,0,1);return u*u*(3-2*u);};delta.addScaledVector(this.tacklePlan.correction.clone().applyAxisAngle(up,this.heading),smooth(this.time)-smooth(last));}}delta.clampLength(0,dt*12);this.position.add(delta);this.velocity.copy(delta).multiplyScalar(1/dt);this.speed=this.velocity.length();this.lib.sample(this.action,this.time,this.target);this.weights={[this.action]:1};
   if(this.time>=m.duration){if(this.state==='recover'){this.cooldown=.45;this.enter(desired>.1?'move':'idle');}else this.enter('recover');}
  }else{
   this.speed=approach(this.speed,desired,dt*(desired>this.speed?5.5:8.5));this.velocity.set(Math.cos(this.heading)*this.speed,0,-Math.sin(this.heading)*this.speed);this.position.addScaledVector(this.velocity,dt);
   if(this.state==='move'){
    const s=this.speed;let frequency=s<2.91?T.MathUtils.lerp(1/this.lib.motions.walk.duration,1/this.lib.motions.jog.duration,clamp((s-1.37)/1.54,0,1)):T.MathUtils.lerp(1/this.lib.motions.jog.duration,1/this.lib.motions.sprint.duration,clamp((s-2.91)/4.89,0,1));if(s<1.37)frequency*=s/1.37;this.phase=(this.phase+dt*frequency)%1;this.weights=this.lib.locomotion(s,this.phase,this.target);
   }else{
    this.time+=dt*(this.state==='stop'?1.65:1.25);this.lib.sample(this.action,this.time,this.target);this.weights={[this.action]:1};
    if(this.state==='start'&&this.time>=Math.min(.95,m.duration))this.enter('move');else if(this.state==='turn'&&this.age>.65)this.enter('move');else if(this.state==='stop'&&this.time>=m.duration&&this.speed<.08)this.enter('idle');
   }
  }
  this.position.x=clamp(this.position.x,-17,17);this.position.z=clamp(this.position.z,-10,10);this.mixer.advance(this.target,dt);this.renderPose=this.planting.solve(this.mixer.output,this.position,this.heading,this.state,dt);this.updateFeet();
 }
 updateFeet(){const p=this.lib.forwardKinematics(this.renderPose);['LeftFoot','RightFoot'].forEach((name,i)=>{this.feet[i].copy(p[this.lib.index[name]]).applyAxisAngle(up,this.heading).add(this.position);this.knees[i].copy(p[this.lib.index[i?'RightLeg':'LeftLeg']]).applyAxisAngle(up,this.heading).add(this.position);});}
}
function closestT(a,b){const d=b.clone().sub(a),len=d.lengthSq();return len?clamp(-a.dot(d)/len,0,1):0;}
export function segmentDistance(p1,q1,p2,q2){const d1=q1.clone().sub(p1),d2=q2.clone().sub(p2),r=p1.clone().sub(p2),a=d1.lengthSq(),e=d2.lengthSq(),f=d2.dot(r);let s=0,t=0;if(a<1e-12&&e<1e-12)return r.length();if(a<1e-12)t=clamp(f/e,0,1);else{const c=d1.dot(r);if(e<1e-12)s=clamp(-c/a,0,1);else{const b=d1.dot(d2),den=a*e-b*b;s=den>1e-12?clamp((b*f-c*e)/den,0,1):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a,0,1);}else if(t>1){t=1;s=clamp((b-c)/a,0,1);}}}return p1.clone().addScaledVector(d1,s).distanceTo(p2.clone().addScaledVector(d2,t));}
export class FootballWorld {
 constructor(data,networks=null){this.library=new MotionLibrary(data);this.actors=[new FootballActor(this.library,new T.Vector3(-4,0,0),'#2d9ce0',networks?.knee_loco_dnn),new FootballActor(this.library,new T.Vector3(2,0,-1.8),'#e56b3e',networks?.knee_loco_dnn)];this.ball={position:new T.Vector3(1,.11,0),velocity:new T.Vector3(),radius:.11};this.time=0;this.events=[];this.lastContacts=new Map();this.demo=true;this.demoTackle=false;this.demoKick=false;this.demoTurn=false;this.fixedStep=1/120;this.accumulator=0;}
 record(type,details={}){this.events.push({time:this.time,type,...details});if(this.events.length>80)this.events.shift();}
 demoIntent(){const a=this.actors[0],t=this.time;
  if(t<1.1)a.intent.mode='idle';else if(t<4.0){a.intent.mode='chase';a.intent.pace=4.2;}else if(t<5.8)a.intent.mode='idle';else if(t<9&&!this.demoTackle){if(!this.demoTurn){this.demoTurn=true;this.ball.position.set(a.position.x-2,.11,a.position.z+3.5);this.ball.velocity.set(-.7,0,.1);this.record('ball rolled into a new direction');}a.intent.mode='chase';a.intent.pace=4.8;if(t>6.3&&a.position.distanceTo(this.ball.position)<2.15){this.demoTackle=true;a.intent.mode='idle';a.requestTackle();this.record('tackle requested');}}else if(!this.demoTackle){this.demoTackle=true;a.intent.mode='idle';a.requestTackle();this.record('tackle requested');}else if(t>10.5&&t<13){a.intent.mode='move';a.intent.direction.set(1,0,-.4);a.intent.pace=1.4;}else a.intent.mode='idle';
  if(t>1.1&&!this.demoKick){this.demoKick=true;this.ball.velocity.set(1.0,0,0);}
 }
 step(dt=this.fixedStep){this.time+=dt;if(this.demo)this.demoIntent();const ball=this.ball,oldBall=ball.position.clone();ball.position.addScaledVector(ball.velocity,dt);ball.velocity.multiplyScalar(Math.exp(-.6*dt));ball.position.y=ball.radius;
  if(Math.abs(ball.position.x)>17){ball.position.x=clamp(ball.position.x,-17,17);ball.velocity.x*=-.65;}if(Math.abs(ball.position.z)>10){ball.position.z=clamp(ball.position.z,-10,10);ball.velocity.z*=-.65;}
  for(const a of this.actors)a.step(dt,ball);
  // Kinematic body separation, with animation-driven tackle contact evaluated independently.
  const [a,b]=this.actors,d=b.position.clone().sub(a.position);d.y=0;const distance=d.length(),minDistance=.55;
  if(distance<minDistance){const normal=distance>.001?d.multiplyScalar(1/distance):new T.Vector3(1,0,0);const depth=minDistance-distance;a.position.addScaledVector(normal,-depth/2);b.position.addScaledVector(normal,depth/2);if(a.state==='tackle'&&b.state!=='recover'&&b.state!=='fall'){b.fall();this.record('player contact',{actor:0,target:1});}a.updateFeet();b.updateFeet();}
  for(const [attacker,victim] of [[a,b],[b,a]])if(attacker.state==='tackle'&&!['fall','recover','tackle'].includes(victim.state)){let hit=false;for(let i=0;i<2;i++)for(let j=0;j<2;j++)if(segmentDistance(attacker.oldFeet[i],attacker.feet[i],victim.knees[j],victim.feet[j])<.22)hit=true;if(hit){victim.fall();this.record('leg contact',{actor:this.actors.indexOf(attacker),target:this.actors.indexOf(victim)});}}
  this.actors.forEach((actor,ai)=>actor.feet.forEach((foot,fi)=>{
   const old=actor.oldFeet[fi],r0=old.clone().sub(oldBall),r1=foot.clone().sub(ball.position),t=closestT(r0,r1),near=r0.lerp(r1,t),key=ai+':'+fi;
   if(near.length()<ball.radius+.105&&(this.time-(this.lastContacts.get(key)??-10))>.12){
    const footVelocity=foot.clone().sub(old).multiplyScalar(1/dt),normal=ball.position.clone().sub(foot);normal.y=0;if(normal.lengthSq()<.0001)normal.copy(actor.velocity);if(normal.lengthSq()<.0001)normal.set(1,0,0);normal.normalize();
    const closing=footVelocity.clone().sub(ball.velocity).dot(normal);if(closing>.15){ball.velocity.addScaledVector(normal,clamp(closing*1.05,.35,actor.state==='tackle'?11:5));ball.velocity.y=0;ball.velocity.clampLength(0,13);const depth=ball.radius+.105-Math.hypot(ball.position.x-foot.x,ball.position.z-foot.z);if(depth>0)ball.position.addScaledVector(normal,Math.min(depth,.15));this.lastContacts.set(key,this.time);this.record('ball contact',{actor:ai,foot:fi,closing});}
   }
  }));
 }
 advance(dt){this.accumulator+=Math.min(dt,.1);let steps=0;while(this.accumulator>=this.fixedStep&&steps++<12){this.step();this.accumulator-=this.fixedStep;}}
 duel(){this.demo=false;this.isDuel=true;const [a,b]=this.actors;a.position.set(-2,0,0);b.position.set(0,0,1);b.heading=Math.PI;this.ball.position.set(.25,.11,.45);this.ball.velocity.set(0,0,0);for(const actor of this.actors){actor.updateFeet();actor.oldFeet.forEach((p,i)=>p.copy(actor.feet[i]));}a.requestTackle(this.ball);this.record('player tackle scenario');}
 manual(mode){this.demo=false;this.actors[0].intent.mode=mode;}
 snapshot(){return {time:this.time,demo:this.demo,ball:this.ball.position.toArray(),ballVelocity:this.ball.velocity.toArray(),actors:this.actors.map(a=>({state:a.state,action:a.action,position:a.position.toArray(),speed:a.speed,heading:a.heading,weights:a.weights,blend:Math.min(1,a.mixer.age/a.mixer.duration),history:a.history})),events:this.events};}
}
