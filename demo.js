import * as THREE from 'three';

const data = await (await fetch('./extracted.json')).json();
const scene = new THREE.Scene();
scene.background = new THREE.Color('#102d2b');
scene.fog = new THREE.FogExp2('#102d2b', 0.018);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
document.body.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(39, innerWidth / innerHeight, 0.1, 140);
camera.fov=innerWidth<700?60:39;camera.updateProjectionMatrix();
camera.up.set(0, 0, 1);
scene.add(new THREE.HemisphereLight('#def5fc', '#3e7048', 2.5));
const sun = new THREE.DirectionalLight('#ffe8be', 4.0);
sun.position.set(-7, -7, 13);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 45 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.025;
scene.add(sun);
const fill = new THREE.DirectionalLight('#78bfff', 1.2); fill.position.set(7, 4, 5); scene.add(fill);

// The environment is authored for this demo. All player geometry and joint keys
// come from extracted.json. Native game coordinates are preserved throughout.
const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: '#205239', roughness: 1 }));
ground.receiveShadow = true; ground.position.z = -0.012; scene.add(ground);
for (let i = -7; i < 7; i++) {
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(30, 2.5), new THREE.MeshStandardMaterial({ color: i % 2 ? '#2f6948' : '#326f4d', roughness: 1 }));
  strip.position.set(0, i * 2.5, -0.008); strip.receiveShadow = true; scene.add(strip);
}
function line(points, color = '#e0eacf', width = .035) {
  for (let i = 1; i < points.length; i++) {
    const a = new THREE.Vector3(...points[i-1]), b = new THREE.Vector3(...points[i]);
    const geo = new THREE.CylinderGeometry(width, width, a.distanceTo(b), 6);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
    m.position.copy(a).lerp(b, .5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), b.sub(a).normalize()); scene.add(m);
  }
}
line([[-15,-17,.004],[15,-17,.004],[15,17,.004],[-15,17,.004],[-15,-17,.004]]);
line([[-15,4,.004],[15,4,.004]]);
const circle = []; for(let i=0;i<=100;i++){const a=i/100*Math.PI*2;circle.push([Math.cos(a)*4.5,4+Math.sin(a)*4.5,.004]);} line(circle);
line([[-7.2,-17,.004],[-7.2,-11,.004],[7.2,-11,.004],[7.2,-17,.004]]);
// Low stadium surround and pitch boards.
for (const x of [-19,19]) {
  for (let i=0; i<4; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.5,65,.65), new THREE.MeshStandardMaterial({color:i%2?'#213d3b':'#294a44',roughness:1}));
    mesh.position.set(x + Math.sign(x)*i*1.2,0,.35+i*.55);mesh.receiveShadow=true;scene.add(mesh);
  }
}

const geometries = {};
for (const [name, mesh] of Object.entries(data.meshes)) {
  geometries[name] = mesh.parts.map(part=>{
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(part.vertices.flat(), 3));
    g.setIndex(part.indices); g.computeVertexNormals(); return {name:part.name,geometry:g};
  });
}
function player(color, number) {
  const root = new THREE.Group(); root.name = 'player';
  const nodes = {}, meshes = [];
  const kit = new THREE.MeshStandardMaterial({color,roughness:.83,side:THREE.DoubleSide});
  const shorts = new THREE.MeshStandardMaterial({color:'#e1e7dd',roughness:.9,side:THREE.DoubleSide});
  const skin = new THREE.MeshStandardMaterial({color:number===4?'#c88c66':'#a9714b',roughness:.9,side:THREE.DoubleSide});
  const boot = new THREE.MeshStandardMaterial({color:'#14232a',roughness:.65,side:THREE.DoubleSide});
  const hairMaterial = new THREE.MeshStandardMaterial({color:number===4?'#30291f':'#191f1b',roughness:1,side:THREE.DoubleSide});
  function node(def,parent) {
    const group = new THREE.Group(); group.name = def.name; group.position.fromArray(def.position);
    nodes[def.name] = group; parent.add(group);
    for(const part of geometries[def.mesh]){
      let material = skin;
      if (['trunk','shirt','sock'].includes(part.name)) material = kit;
      if (['pelvis','trunks'].includes(part.name)) material = shorts;
      if (def.mesh === 'foot') material = boot;
      if(part.name==='hair')material=hairMaterial;
      const mesh = new THREE.Mesh(part.geometry, material); mesh.name=part.name+'_mesh';mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);meshes.push(mesh);
    }
    for(const child of def.children) node(child,group);
  }
  node(data.skeleton,root);
  // A simple jersey number on the original torso; purely presentation.
  const cv=document.createElement('canvas');cv.width=128;cv.height=128;const ctx=cv.getContext('2d');ctx.clearRect(0,0,128,128);ctx.fillStyle='#f2f5e9';ctx.font='bold 95px Arial';ctx.textAlign='center';ctx.fillText(String(number),64,104);
  const num=new THREE.Mesh(new THREE.PlaneGeometry(.19,.19),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),transparent:true,side:THREE.DoubleSide,depthWrite:false}));
  num.rotation.x=Math.PI/2;num.position.set(0,.118,.30);nodes.middle.add(num);
  const edges=[]; for(const n of Object.values(nodes)) for(const c of n.children.filter(c=>nodes[c.name])){
    const l = new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,1,6),new THREE.MeshBasicMaterial({color:'#ddff86',depthTest:false,depthWrite:false}));l.renderOrder=99;l.frustumCulled=false;scene.add(l);edges.push([n,c,l]);
  }
  scene.add(root); return {root,nodes,meshes,edges};
}
const defender=player('#2f82ed',4), attacker=player('#e7523e',9);
let showBones=false;
function sample(keys,frame,quaternion=false) {
  if(frame<=keys[0][0]) return keys[0].slice(1);
  if(frame>=keys.at(-1)[0]) return keys.at(-1).slice(1);
  const i=keys.findIndex(k=>k[0]>=frame),a=keys[i-1],b=keys[i],t=(frame-a[0])/(b[0]-a[0]);
  if(quaternion) return new THREE.Quaternion(...a.slice(1)).normalize().slerp(new THREE.Quaternion(...b.slice(1)).normalize(),t).toArray();
  return a.slice(1).map((v,j)=>v+(b[j+1]-v)*t);
}
function pose(clip,frame) {
  const c=data.clips[clip];const tracks={};
  for(const [name,keys] of Object.entries(c.tracks)) tracks[name]=sample(keys,frame,name!=='player');
  return tracks;
}
function runPose(frame){
  const phase=((frame%48)+48)%48, p=pose('run',phase%24);
  if(phase<24)return p;
  const out={};for(const [name,v]of Object.entries(p)){
    const other=name.startsWith('left_')?name.replace('left_','right_'):name.startsWith('right_')?name.replace('right_','left_'):name;
    out[other]=name==='player'?[-v[0],v[1],v[2]]:[v[0],-v[1],-v[2],v[3]];
  }return out;
}
function blended(a,b,t) {
  const out={};t=Math.max(0,Math.min(1,t));t=t*t*(3-2*t);
  for(const key of Object.keys(b)) {
    if(key==='player') out[key]=b[key];
    else out[key]=new THREE.Quaternion(...a[key]).slerp(new THREE.Quaternion(...b[key]),t).normalize().toArray();
  }
  return out;
}
function apply(p,tracks,x,y,angle=0) {
  const v=tracks.player;const c=Math.cos(angle),s=Math.sin(angle);
  p.root.position.set(x+v[0]*c-v[1]*s,y+v[0]*s+v[1]*c,v[2]);
  p.root.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),angle);
  for(const [name,q]of Object.entries(tracks)) if(name!=='player') p.nodes[name].quaternion.fromArray(q).normalize();
}
const ball=new THREE.Mesh(new THREE.IcosahedronGeometry(.11,2),new THREE.MeshStandardMaterial({color:'#fbf7df',roughness:.7,flatShading:true}));ball.castShadow=true;scene.add(ball);
const black=new THREE.MeshStandardMaterial({color:'#1c2a29',roughness:.8});
for(let i=0;i<10;i++){const a=i*2.39996,z=1-2*(i+.5)/10,r=Math.sqrt(1-z*z);const patch=new THREE.Mesh(new THREE.CircleGeometry(.027,5),black);patch.position.set(Math.cos(a)*r*.1105,Math.sin(a)*r*.1105,z*.1105);patch.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),patch.position.clone().normalize());ball.add(patch);}
const contactRing = new THREE.Mesh(new THREE.RingGeometry(.22,.24,64),new THREE.MeshBasicMaterial({color:'#d9ff85',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));contactRing.position.z=.018;scene.add(contactRing);

// Source slide's extension carries a ball-touch event at frame 32 (0.32 s).
// Our two-character staging/contact timing is authored, not the native match AI.
const slideStart=.72,contact=slideStart+.32,fallStart=contact-.035,duration=2.5;
let timeline=0,playing=true,speed=.35,cameraMode='broadcast';
const $=id=>document.getElementById(id);
function renderAt(t,mode=cameraMode) {
  cameraMode=mode;$('camera').value=mode;
  timeline=Math.max(0,Math.min(duration,t));
  let dp,ap;const slideTime=Math.max(0,timeline-slideStart),fallTime=Math.max(0,timeline-fallStart);
  // During the run-up, use the source sprint cycle's actual distance (7m/s).
  if(timeline<slideStart){dp=runPose(timeline*100);dp.player=[0,0,dp.player[2]];apply(defender,dp,-.29,3.55+7*(slideStart-timeline));}
  else{dp=pose('slide',Math.min(62,slideTime*100));if(slideTime<.10)dp=blended(runPose(slideStart*100),dp,slideTime/.1);apply(defender,dp,-.29,3.55);}
  if(timeline<fallStart){ap=runPose(timeline*100+10);ap.player=[0,0,ap.player[2]];apply(attacker,ap,.04,.95+5.4*(fallStart-timeline));}
  else{ap=pose('fall',Math.min(73,fallTime*100));if(fallTime<.08)ap=blended(runPose(fallStart*100+10),ap,fallTime/.08);apply(attacker,ap,.04,.95);}
  const pre = timeline<contact;
  if(pre)ball.position.set(.09,.15+5.4*Math.max(0,fallStart-timeline),.12+Math.abs(Math.sin(timeline*24))*.035);
  else{const dt=timeline-contact;ball.position.set(.09+dt*1.2,.15-dt*4,.12+Math.max(0,Math.sin(dt*9))*.12*Math.exp(-dt*3));}
  ball.rotation.set(timeline*17,timeline*4,0);
  const ringTime=timeline-contact;contactRing.visible=ringTime>=0&&ringTime<.3;contactRing.position.x=.09;contactRing.position.y=.15;contactRing.scale.setScalar(1+Math.max(0,ringTime)*6);contactRing.material.opacity=Math.max(0,1-ringTime/.3)*.7;
  scene.updateMatrixWorld(true);
  for(const p of [defender,attacker])for(const [a,b,l]of p.edges){l.visible=showBones;if(showBones){const va=a.getWorldPosition(new THREE.Vector3()),vb=b.getWorldPosition(new THREE.Vector3());l.position.copy(va).lerp(vb,.5);l.scale.set(1,va.distanceTo(vb),1);l.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vb.sub(va).normalize());}}
  const targetY=(defender.root.position.y+attacker.root.position.y)*.5-.4;
  if(mode==='side'){camera.position.set(6.7,targetY-1.3,2.8);camera.lookAt(-.25,targetY,.55);}
  else if(mode==='top'){camera.position.set(7,targetY+2,12);camera.lookAt(0,targetY,0);}
  else{camera.position.set(5,targetY-6.7,4.4);camera.lookAt(-.7,targetY,.5);}
  $('stage').textContent=timeline<slideStart?'01 / Approach':timeline<contact?'02 / Slide tackle':timeline<contact+.22?'03 / Contact':'04 / Fall & settle';
  $('detail').textContent=timeline<slideStart?'Sprint animation · original skeleton':timeline<contact?'sliding/sprint/000.anim':timeline<contact+.22?'Source ball-touch marker · frame 32':'trip/trip_t3/sprint/000.anim';
  $('event').style.display=timeline>=contact&&timeline<contact+.12?'block':'none';
  $('time').textContent=timeline.toFixed(2)+' s';$('scrub').value=timeline;
  renderer.render(scene,camera);
}
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';};
$('replay').onclick=()=>{timeline=0;playing=true;$('play').textContent='Pause';};
$('speed').onchange=e=>speed=Number(e.target.value);
$('camera').onchange=e=>{cameraMode=e.target.value;renderAt(timeline);};
$('bones').onclick=()=>{showBones=!showBones;$('bones').textContent=showBones?'Hide skeleton':'Skeleton';renderAt(timeline);};
$('scrub').oninput=e=>{playing=false;$('play').textContent='Play';renderAt(Number(e.target.value));};
onresize=()=>{camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<700?60:39;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderAt(timeline);};
let previous=performance.now();
function tick(now){const dt=Math.min(.05,(now-previous)/1000);previous=now;if(playing)renderAt((timeline+dt*speed)%duration);requestAnimationFrame(tick);}
window.demo={data,renderAt,pause(){playing=false;$('play').textContent='Play';},setSkeleton(value){showBones=value;$('bones').textContent=value?'Hide skeleton':'Skeleton';renderAt(timeline);},setSpeed(value){speed=value;$('speed').value=String(value);},
  async exportGLB(){
    const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
    const p=player('#2f82ed',4);p.root.position.set(0,0,0);p.root.quaternion.identity();
    const clips=Object.entries(data.clips).map(([name,c])=>new THREE.AnimationClip(name==='run'?'run_half_cycle_source':name,c.lastFrame/100,Object.entries(c.tracks).map(([node,keys])=>{
      const times=keys.map(k=>k[0]/100),values=keys.flatMap(k=>k.slice(1));
      return node==='player'?new THREE.VectorKeyframeTrack('player.position',times,values):new THREE.QuaternionKeyframeTrack(node+'.quaternion',times,values);
    })));
    const runTracks=Object.keys(data.clips.run.tracks).map(node=>{
      const times=[],values=[];for(let f=0;f<=48;f++){
        const p=runPose(f),v=p[node];times.push(f/100);
        values.push(...(node==='player'?[v[0],-.07*f,v[2]]:v));
      }
      return node==='player'?new THREE.VectorKeyframeTrack('player.position',times,values):new THREE.QuaternionKeyframeTrack(node+'.quaternion',times,values);
    });clips.push(new THREE.AnimationClip('run_full_cycle',.48,runTracks));
    const gltfRoot=new THREE.Group();gltfRoot.name='Z_UP_TO_Y_UP';gltfRoot.rotation.x=-Math.PI/2;gltfRoot.add(p.root);
    const result=await new GLTFExporter().parseAsync(gltfRoot,{binary:true,animations:clips});for(const e of p.edges)scene.remove(e[2]);
    return Array.from(new Uint8Array(result));
  },ready:true,contact,slideStart,fallStart,duration};
$('loading').remove();renderAt(0);requestAnimationFrame(tick);
