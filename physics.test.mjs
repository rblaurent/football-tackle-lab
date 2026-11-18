import test from 'node:test';
import assert from 'node:assert/strict';
import {capsuleContact,sweepSphereCapsule,stepBall,classifyTackle} from './physics.js';
const leg={a:[0,0,.1],b:[0,0,.8],radius:.08};
test('continuous sweep catches a fast ball that crosses an entire leg in one step',()=>{
 const hit=sweepSphereCapsule([-1,0,.4],[2,0,0],.11,leg);
 assert.ok(hit);assert.ok(Math.abs(hit.fraction-.405)<1e-5);assert.ok(hit.normal[0]<-.99);
});
test('a nearby fast ball outside the capsule stays a miss',()=>assert.equal(sweepSphereCapsule([-1,.3,.4],[2,0,0],.11,leg),null));
test('capsule contact handles crossed limbs and zero length feet',()=>{
 assert.ok(capsuleContact(leg,{a:[-.2,0,.3],b:[.2,0,.3],radius:.07}));
 assert.ok(capsuleContact(leg,{a:[.1,0,.3],b:[.1,0,.3],radius:.07}));
 assert.equal(capsuleContact(leg,{a:[.5,0,.3],b:[.5,0,.3],radius:.07}),null);
});
test('ball impulse rebounds instead of tunneling through a stationary leg',()=>{
 const b={position:[-1,0,.4],velocity:[100,0,0],radius:.11};const hits=stepBall(b,.02,[leg]);
 assert.ok(hits.length);assert.ok(b.velocity[0]<0);assert.ok(b.position[0]<-.19);
});
test('a foot moving into a ball transfers momentum',()=>{
 const b={position:[.18,0,.4],velocity:[0,0,0],radius:.11};stepBall(b,.01,[{...leg,velocity:[5,0,0]}]);assert.ok(b.velocity[0]>5);
});
test('ground contact cannot leave the ball below the pitch',()=>{
 const b={position:[0,0,.111],velocity:[0,0,-20],radius:.11};stepBall(b,.02,[]);assert.equal(b.position[2],.11);assert.ok(b.velocity[2]>=0);
});
test('ball first does not excuse dangerous contact',()=>{
 assert.equal(classifyTackle({ballFirst:true,contactHeight:.15,closingSpeed:4}),'ball-first');
 assert.equal(classifyTackle({ballFirst:false,contactHeight:.15,closingSpeed:4}),'late-contact');
 assert.equal(classifyTackle({ballFirst:true,contactHeight:.6,closingSpeed:4}),'dangerous');
});
