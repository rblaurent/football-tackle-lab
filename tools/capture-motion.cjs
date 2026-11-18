const {chromium}=require('playwright');
const {parseArgs}=require('node:util');
const fs=require('node:fs/promises');
const path=require('node:path');
const {values}=parseArgs({options:{url:{type:'string'},out:{type:'string'},channel:{type:'string'},scenes:{type:'string',default:'0,2,3,5,6'},fps:{type:'string',default:'30'},speed:{type:'string',default:'0.5'}}});
(async()=>{
  if(!values.url||!values.out)throw Error('Usage: node tools/capture-motion.cjs --url <viewer URL> --out <output folder> [--channel chrome] [--scenes 0,2,3,5,6]');
  const url=new URL(values.url),out=path.resolve(values.out),fps=Number(values.fps),speed=Number(values.speed),scenes=values.scenes.split(',').map(Number);
  if(!['http:','https:'].includes(url.protocol)||!(fps>0&&fps<=60)||!(speed>0&&speed<=2)||!scenes.every(x=>Number.isInteger(x)&&x>=0&&x<8))throw Error('Invalid capture arguments');
  await fs.mkdir(path.join(out,'frames'),{recursive:true});
  // A previous sequence must not leave stale trailing frames in a new video.
  if((await fs.readdir(path.join(out,'frames'))).length)throw Error('Use an empty frames directory for each capture');
  const browser=await chromium.launch({headless:true,...(values.channel?{channel:values.channel}:{}),args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url.href,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ready,null,{timeout:60000});await page.evaluate(()=>window.pause());
    let frame=0;const manifest={url:url.href,browser:browser.version(),fps,speed,viewport:{width:1280,height:800},segments:[]};
    for(const scene of scenes){
      await page.evaluate(({scene,speed})=>{window.setScene(scene);document.querySelector('#speed').textContent=speed+'×';}, {scene,speed});
      const state=await page.evaluate(()=>window.previewState()),count=Math.ceil((state.duration/speed+.5)*fps),startFrame=frame;
      for(let j=0;j<count;j++){
        await page.evaluate(t=>window.setTime(t),Math.min(j/fps*speed,state.duration));
        await page.screenshot({path:path.join(out,'frames',String(frame++).padStart(5,'0')+'.jpg'),type:'jpeg',quality:90});
      }
      await page.evaluate(t=>window.setTime(t),state.duration/2);await page.screenshot({path:path.join(out,`scene-${scene}.png`)});
      manifest.segments.push({scene,sourceDuration:state.duration,startFrame,frames:count});
      console.log('Captured scene',scene,'total frames',frame);
    }
    if(errors.length)throw Error(errors.join('\n'));
    manifest.frames=frame;manifest.duration=frame/fps;manifest.errors=errors;
    await fs.writeFile(path.join(out,'capture-manifest.json'),JSON.stringify(manifest,null,2));console.log('Capture complete:',frame,'frames. Encode with FFmpeg; see docs/REPRODUCING.md.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
