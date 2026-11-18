// Small deterministic contact solver. Metres, seconds, kilograms, Z-up.
// It deliberately has no rendering dependency so the collision rules are testable.
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const sub=(a,b)=>a.map((v,i)=>v-b[i]);
export const mul=(a,s)=>a.map(v=>v*s);
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const length=a=>Math.sqrt(dot(a,a));
export const unit=(a,fallback=[1,0,0])=>length(a)>1e-9?mul(a,1/length(a)):fallback;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function closestOnSegment(p,a,b){const ab=sub(b,a),n=dot(ab,ab);return add(a,mul(ab,n<1e-12?0:clamp(dot(sub(p,a),ab)/n)));}
export function closestSegments(p1,q1,p2,q2){
  const d1=sub(q1,p1),d2=sub(q2,p2),r=sub(p1,p2),a=dot(d1,d1),e=dot(d2,d2),f=dot(d2,r);let s=0,t=0;
  if(a<=1e-12&&e<=1e-12)return[p1,p2];
  if(a<=1e-12)t=clamp(f/e);
  else{const c=dot(d1,r);if(e<=1e-12)s=clamp(-c/a);else{const b=dot(d1,d2),den=a*e-b*b;s=den>1e-12?clamp((b*f-c*e)/den):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}}}
  return[add(p1,mul(d1,s)),add(p2,mul(d2,t))];
}
export function capsuleContact(a,b){
  const [pa,pb]=closestSegments(a.a,a.b,b.a,b.b),delta=sub(pa,pb),distance=length(delta),depth=a.radius+b.radius-distance;
  if(depth<0)return null;
  return{point:mul(add(pa,pb),.5),normal:unit(delta),depth};
}
// Conservative advancement against a capsule: the point-to-segment distance is
// 1-Lipschitz. Advancing by gap / speed cannot cross the surface unnoticed.
export function sweepSphereCapsule(p,delta,radius,capsule){
  const speed=length(delta),r=radius+capsule.radius;let fraction=0;
  for(let i=0;i<64;i++){
    const point=add(p,mul(delta,fraction)),nearest=closestOnSegment(point,capsule.a,capsule.b),difference=sub(point,nearest),gap=length(difference)-r;
    if(gap<=1e-6)return{fraction,point,normal:unit(difference,unit(mul(delta,-1))),depth:Math.max(0,-gap)};
    if(speed<1e-10)return null;
    fraction+=gap/speed;if(fraction>1)return null;
  }
  return null;
}
export function stepBall(ball,dt,colliders){
  ball.velocity[2]-=9.81*dt;const hits=[];let remaining=dt;
  for(let iteration=0;iteration<6&&remaining>1e-7;iteration++){
    let first=null;
    for(const c of colliders){
      const velocity=c.velocity||[0,0,0],relative=sub(ball.velocity,velocity);
      const hit=sweepSphereCapsule(ball.position,mul(relative,remaining),ball.radius,c);
      if(hit&&dot(relative,hit.normal)<-1e-5&&(!first||hit.fraction<first.fraction))first={...hit,collider:c,velocity};
    }
    if(!first){ball.position=add(ball.position,mul(ball.velocity,remaining));break;}
    ball.position=add(ball.position,mul(ball.velocity,remaining*first.fraction));
    ball.position=add(ball.position,mul(first.normal,first.depth+1e-4));
    const relative=sub(ball.velocity,first.velocity),closing=dot(relative,first.normal);
    ball.velocity=sub(ball.velocity,mul(first.normal,(1+(ball.restitution??.42))*closing));
    hits.push({...first,closingSpeed:-closing});remaining*=1-first.fraction;
  }
  if(ball.position[2]<ball.radius){ball.position[2]=ball.radius;if(ball.velocity[2]<-.55)ball.velocity[2]*=-.42;else ball.velocity[2]=0;}
  const damping=Math.exp(-(ball.position[2]<=ball.radius+.003?1.4:.12)*dt);ball.velocity[0]*=damping;ball.velocity[1]*=damping;
  return hits;
}
// A deliberately limited gameplay heuristic, NOT an implementation of football's
// official foul rules. Winning the ball does not excuse a high or forceful hit.
export function classifyTackle({ballFirst,contactHeight,closingSpeed}){
  if(contactHeight>.48||closingSpeed>9)return'dangerous';
  return ballFirst?'ball-first':'late-contact';
}
