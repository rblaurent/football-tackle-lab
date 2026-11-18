const {chromium}=require('playwright');
const {parseArgs}=require('node:util');
const fs=require('node:fs/promises');
const path=require('node:path');
const {values}=parseArgs({options:{url:{type:'string'},out:{type:'string'},channel:{type:'string'}}});
(async()=>{
  if(!values.url||!values.out)throw Error('Usage: node tools/verify-viewer.cjs --url <viewer URL> --out <output folder> [--channel chrome]');
  const out=path.resolve(values.out);await fs.mkdir(out,{recursive:true});
  const browser=await chromium.launch({headless:true,...(values.channel?{channel:values.channel}:{}),args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const result={url:values.url,browser:browser.version(),date:new Date().toISOString(),viewports:[]};
  try{
    for(const mobile of [false,true]){
      const page=await browser.newPage({viewport:mobile?{width:412,height:915}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});const errors=[],failed=[];
      page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('favicon'))failed.push({url:r.url(),status:r.status()});});
      await page.goto(values.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.ready,null,{timeout:60000});await page.evaluate(()=>window.pause());
      const checks=await page.evaluate(()=>{
        const checks=[];
        for(let scene=0;scene<8;scene++){
          window.setScene(scene);const duration=window.previewState().duration;
          for(const time of [0,duration/2,duration]){
            window.setTime(time);
            for(const player of window.__players){if(!player.root.visible)continue;player.model.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();if(!Array.from(o.skeleton.boneMatrices).every(Number.isFinite))throw Error('Invalid skin matrix');}});}
            checks.push({scene,time});
          }
        }
        return checks;
      });
      await page.getByRole('combobox',{name:'Animation scene'}).selectOption('2');await page.getByRole('slider',{name:'Playback time'}).fill('0.5');
      await page.getByRole('button',{name:'0.5×',exact:true}).click();await page.getByRole('button',{name:'1×',exact:true}).waitFor();
      await page.screenshot({path:path.join(out,mobile?'phone.png':'desktop.png')});
      await page.evaluate(()=>{window.setScene(0);window.setTime(window.previewState().duration+.95);});await page.getByRole('button',{name:'Play',exact:true}).click();
      await page.waitForFunction(()=>window.previewState().time<.5,null,{timeout:5000});
      await page.getByRole('link',{name:'Earlier ball & contact demo'}).click();await page.waitForFunction(()=>window.demo?.ready,null,{timeout:30000});
      await page.getByRole('combobox',{name:'Tackle scenario'}).selectOption('clean');
      if(errors.length||failed.length)throw Error(JSON.stringify({errors,failed}));
      result.viewports.push({mobile,skinChecks:checks.length,loopVerified:true,sceneSelect:true,scrub:true,speed:true,legacyDemo:true,errors,failed});
      await page.close();
    }
    await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
