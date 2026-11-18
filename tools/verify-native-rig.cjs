/** Browser acceptance for native skin, visible contact endpoints and sole grounding. */
const {chromium}=require('playwright');
const fs=require('node:fs/promises');const path=require('node:path');
(async()=>{
 const url=process.argv[2],out=process.argv[3];if(!url||!out)throw Error('Usage: node tools/verify-native-rig.cjs <URL> <evidence directory>');
 await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.waitForFunction(()=>window.ready,null,{timeout:60000});
  const report=await page.evaluate(async()=>{
   const {Vector3}=await import('./vendor/three.module.js');lab.pause();const result={units:'metres',joints:lab.rigs[0].bones.length,cases:[]};
   if(result.joints!==369)throw Error('Expected native skin hierarchy');
   for(const type of ['idle','jog','duel','shirtFront','shirtSide','push','grab','handball']){
    lab.reset();lab.pause();world.demo=false;world.playMode=false;
    if(type==='jog'){world.manual('move');world.actors[0].intent.direction.set(1,0,0);world.actors[0].intent.pace=3;}
    else if(type==='duel')world.duel();
    else if(type!=='idle'){if(type==='shirtFront'||type==='shirtSide'||type==='grab')await lab.database.preparePair(type==='grab'?'shirtFront':type);world.requestInteraction(type);}
    const seconds=type==='idle'?2:type==='jog'?3:9,metrics={type,samples:0,maxHandError:0,maxAnkleError:0,minSole:Infinity,maxIdleSole:0,nonfiniteVertices:0,verticesChecked:0,maxJointStep:0},prior=new Map();
    for(let frame=0;frame<seconds*30;frame++){
     for(let step=0;step<4;step++)world.step();lab.updateCharacters();metrics.samples++;
     for(let actor=0;actor<2;actor++){
      const a=world.actors[actor],r=lab.rigs[actor];
      for(let side=0;side<2;side++){
       const suffix=side?'r':'l',hand=r.target['hand_'+suffix].getWorldPosition(new Vector3()),ankle=r.target['foot_'+suffix].getWorldPosition(new Vector3());
       metrics.maxHandError=Math.max(metrics.maxHandError,hand.distanceTo(a.hands[side]));metrics.maxAnkleError=Math.max(metrics.maxAnkleError,ankle.distanceTo(a.feet[side]));
       for(const [part,p] of [['hand',hand],['ankle',ankle]]){const key=actor+suffix+part;if(prior.has(key))metrics.maxJointStep=Math.max(metrics.maxJointStep,p.distanceTo(prior.get(key)));prior.set(key,p);}
      }
      const soles=r.soleHeights();metrics.minSole=Math.min(metrics.minSole,...soles);if(type==='idle'&&frame>30)metrics.maxIdleSole=Math.max(metrics.maxIdleSole,...soles.map(Math.abs));
      if(frame%30===0)r.model.traverse(mesh=>{if(!mesh.isSkinnedMesh)return;mesh.skeleton.update();if(mesh.skeleton!==r.skeleton)throw Error('Mesh bound to a second skeleton');for(let i=0;i<mesh.geometry.attributes.position.count;i++){const p=mesh.getVertexPosition(i,new Vector3());metrics.verticesChecked++;if(!p.toArray().every(Number.isFinite))metrics.nonfiniteVertices++;}});
     }
    }
    if(metrics.maxHandError>1e-7||metrics.maxAnkleError>1e-7||metrics.nonfiniteVertices)throw Error('Visible contact/skin mismatch '+JSON.stringify(metrics));
    if(type==='idle'&&metrics.maxIdleSole>.003)throw Error('Idle sole grounding '+JSON.stringify(metrics));
    lab.render();metrics.events=world.events.filter(e=>e.type.includes('contact'));result.cases.push(metrics);
   }
   return result;
  });
  report.url=url;report.date=new Date().toISOString();await fs.writeFile(path.join(out,'native-rig-verification.json'),JSON.stringify(report,null,2));
  await page.evaluate(()=>{lab.reset();lab.pause();world.demo=false;world.playMode=false;world.actors[0].position.set(0,0,0);world.actors[1].position.set(5,0,5);lab.stepFor(2);lab.setFollow(false);lab.controls.target.set(0,.95,0);lab.camera.position.set(2,1.5,3);lab.controls.update();lab.render();});
  await page.screenshot({timeout:60000,path:path.join(out,'native-rig-character.png')});
  await page.evaluate(async()=>{const {Vector3}=await import('./vendor/three.module.js'),r=lab.rigs[0],p=r.byName.LeftHand.getWorldPosition(new Vector3()),tip=r.byName.LeftHandMiddle3.getWorldPosition(new Vector3());p.lerp(tip,.6);lab.controls.target.copy(p);lab.controls.minDistance=.1;lab.camera.position.copy(p).add(new Vector3(.5,.1,.45));lab.controls.update();lab.render();});
  await page.screenshot({timeout:60000,path:path.join(out,'native-rig-hand.png')});
  await page.evaluate(async()=>{const {Vector3}=await import('./vendor/three.module.js'),r=lab.rigs[0],p=r.byName.LeftFoot.getWorldPosition(new Vector3()).lerp(r.byName.RightFoot.getWorldPosition(new Vector3()),.5);lab.controls.target.copy(p).add(new Vector3(0,.05,0));lab.camera.position.copy(p).add(new Vector3(.8,.35,1.1));lab.controls.update();lab.render();});
  await page.screenshot({timeout:60000,path:path.join(out,'native-rig-feet.png')});
  if(errors.length)throw Error(errors.join('\n'));report.url=url;report.date=new Date().toISOString();report.errors=errors;await fs.writeFile(path.join(out,'native-rig-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
