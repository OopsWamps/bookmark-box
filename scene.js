(() => {
'use strict';
const $=id=>document.getElementById(id), {D,pose}=Mechanism;
const host=$('sceneHost');
let p=0,target=0,moving=false,queue=[],hold=0,last=0,cut=false,dirty=true,obstacle=false,serviceOpen=false,restartRequired=false;
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
let scene,renderer,camera,liftGroup,frontBrand,pullBar,filmMesh,filmEdges,filmRoll,reelGroup,cassetteShell;
// Part-ownership tag: while set, every mesh created by the shared helpers
// carries userData.partId so the annotation focus can select parts exactly.
let partTag=null;
const tagMesh=m=>{if(partTag)m.userData.partId=partTag;return m;};
const shellParts=[],screws=[],tags=[];
let azimuth=.73,elevation=.50,zoom=1,viewMode='iso';
const states=['平放收纳','升起展示','开盖取用'];
const titles=['平放收纳','承托盘正在上升','升起展示','柔性盖正在弯折卷收','开盖取用'];
const descriptions=[
'四列书签平放于 300 × 222 × 110 mm 紧凑盒体内。丝杠、皮带和卷簧由外壳与随动套筒包覆。',
'M1 同步带驱动两根侧置丝杠，托盘和整组卷盖机构一起竖直上升。',
'承托盘上升 60 mm，透明膜保持展开。升降上位确认后才允许卷收开盖。',
'M2 通过两侧同步带向后牵引前横梁，薄膜沿导辊连续弯折，卷簧卷轴随动收膜。',
'184 mm 平面膜段已卷收，机构静止后取用。套筒与箱体仍搭接 42 mm；复位时先闭盖，再下降。'
];

function material(color,opts={}) {return new THREE.MeshStandardMaterial({color,roughness:.6,metalness:.12,...opts});}
let dark,white,silver,rubber,glass;
function box(parent,w,h,d,x,y,z,mat,edges=false) {
  const geometry=new THREE.BoxGeometry(w,h,d), mesh=new THREE.Mesh(geometry,mat);
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true;parent.add(mesh);
  if(edges){ const e=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:0x777777,transparent:true,opacity:.33}));mesh.add(e);}
  return tagMesh(mesh);
}
function cylinder(parent,r,h,x,y,z,mat,axis='y',r2=r){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r2,h,24),mat);
  if(axis==='x')mesh.rotation.z=Math.PI/2;
  if(axis==='z')mesh.rotation.x=Math.PI/2;
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return tagMesh(mesh);
}
function threaded(parent,x,z,bottom,top,r,pitch){
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  cylinder(g,r-.5,top-bottom,0,(top+bottom)/2,0,silver);
  const pts=[];
  for(let a=0;a<=(top-bottom)/pitch*Math.PI*2;a+=.35)pts.push(new THREE.Vector3(Math.cos(a)*r,bottom+a/(2*Math.PI)*pitch,Math.sin(a)*r));
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x515151})));
  return g;
}
function flatTexture(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
function makeCards(){
  const phrases=[['好奇','让提问成为起点','Curiosity'],['思考','在思辨中建立自我','Thinking'],['探索','让学习连接真实世界','Explore'],['成长','看见每一次微小进步','Growth']];
  [-87,-29,29,87].forEach((x,i)=>{
    box(liftGroup,50,3,150,x,99.5,12,material(0xe8e8e8));
    const tx=flatTexture(256,768,(ctx,w,h)=>{
      ctx.fillStyle='#fafafa';ctx.fillRect(0,0,w,h);ctx.fillStyle='#151515';
      ctx.font='22px "Microsoft YaHei",sans-serif';ctx.textAlign='left';ctx.fillText('拾页 · 教育',25,50);
      ctx.fillRect(25,79,w-50,2);ctx.font='54px "Microsoft YaHei",sans-serif';
      [...phrases[i][0]].forEach((ch,j)=>ctx.fillText(ch,27,210+j*75));
      ctx.font='20px "Microsoft YaHei",sans-serif';ctx.fillText(phrases[i][2],27,374);
      ctx.fillStyle='#737373';ctx.font='18px "Microsoft YaHei",sans-serif';
      const chars=[...phrases[i][1]];chars.forEach((c,j)=>ctx.fillText(c,28+(j%8)*23,570+Math.floor(j/8)*31));
      ctx.strokeStyle='#aaa';ctx.beginPath();ctx.moveTo(25,655);ctx.lineTo(w-25,655);ctx.stroke();ctx.fillStyle='#444';ctx.font='18px "Microsoft YaHei",sans-serif';ctx.fillText('与每一种可能相遇',25,702);
    });
    const face=tagMesh(new THREE.Mesh(new THREE.PlaneGeometry(50,150),new THREE.MeshBasicMaterial({map:tx,toneMapped:false})));face.rotation.x=-Math.PI/2;face.position.set(x,101.1,12);liftGroup.add(face);
  });
}
/* ANNOTATION_SYSTEM */
/* MECHANISM_RENDERER */

function init3D(){
  scene=new THREE.Scene(); scene.background=new THREE.Color(0xf5f5f3);
  camera=new THREE.OrthographicCamera(-350,350,300,-300,1,2500);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
  const canvas=renderer.domElement;canvas.setAttribute('aria-label','可旋转的书签盒三维模型；可通过状态按钮、进度条和视角按钮操作');canvas.setAttribute('role','img');canvas.style.touchAction='pan-y';canvas.className='model-canvas';host.prepend(canvas);
  scene.add(new THREE.HemisphereLight(0xffffff,0xb3b3b3,2.5));
  const key=new THREE.DirectionalLight(0xffffff,3.3);key.position.set(-400,700,450);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-430,right:430,top:600,bottom:-350,near:1,far:1600});key.shadow.normalBias=1;key.shadow.bias=-.0002;key.shadow.radius=4;scene.add(key);
  const fill=new THREE.DirectionalLight(0xffffff,2);fill.position.set(450,200,-400);scene.add(fill);
  dark=material(0x181818,{roughness:.74,metalness:.24});white=material(0xf2f2f0,{roughness:.74});silver=material(0xb4b4b4,{metalness:.76,roughness:.31});rubber=material(0x303030,{roughness:.95});
  glass=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.10,metalness:0,transparent:true,opacity:.17,side:THREE.DoubleSide,depthWrite:false});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(3000,3000),material(0xf5f5f3,{metalness:0,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-1;floor.receiveShadow=true;scene.add(floor);
  buildLowBox();
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&viewMode==='top')return;drag={x:e.clientX,y:e.clientY,a:azimuth,e:elevation};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;azimuth=drag.a-(e.clientX-drag.x)*.006;elevation=Math.min(1.48,Math.max(.12,drag.e+(e.clientY-drag.y)*.005));viewMode='free';updateCamera();});
  canvas.addEventListener('pointerup',()=>{drag=null;canvas.style.cursor='grab';});canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.62,Math.min(1.6,zoom*Math.exp(-e.deltaY*.001)));updateCamera();},{passive:false});
  new ResizeObserver(resize).observe(host);resize();
}
function resize(){if(!renderer)return;const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);const span=Math.max(390,480*h/w);camera.left=-span*w/h/2;camera.right=span*w/h/2;camera.top=span/2;camera.bottom=-span/2;updateCamera();}
function updateCamera(){if(!camera)return;const radius=850,focus=76;camera.position.set(Math.sin(azimuth)*Math.cos(elevation)*radius,focus+Math.sin(elevation)*radius,Math.cos(azimuth)*Math.cos(elevation)*radius);camera.up.set(0,1,0);camera.lookAt(0,focus,0);camera.zoom=zoom;camera.updateProjectionMatrix();dirty=true;}
function update3D(q){
  if(!renderer)return;updateCamera();updateLowBox(q);
  scene.updateMatrixWorld();
  updateAnnotations();
  renderer.render(scene,camera);
}
function sync(){
  const q=pose(p);$('progress').value=String(p*100);$('progressValue').textContent=Math.round(p*100)+'%';
  $('liftValue').textContent=q.lift.toFixed(0);$('angleValue').textContent=q.rollDiameter.toFixed(1);$('slideValue').textContent=q.retract.toFixed(0);
  $('phaseTitle').textContent=titles[q.phase];$('phaseDescription').textContent=descriptions[q.phase];$('sceneStatus').textContent=titles[q.phase];
  const endpoint=Math.abs(p)<.001?0:Math.abs(p-.36)<.001?1:Math.abs(p-1)<.001?2:-1;
  document.querySelectorAll('[data-state]').forEach(b=>{const active=+b.dataset.state===endpoint;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('[data-phase]').forEach(e=>{const i=+e.dataset.phase;e.classList.toggle('is-active',i===(p<.36?0:p<1?1:2));});
  $('pauseBtn').textContent=moving?'暂停':'继续';$('pauseBtn').disabled=!moving&&Math.abs(p-target)<.0001&&!queue.length;
  drawLowSection(q);update3D(q);
  $('safetyStatus').textContent=obstacle?'遮挡触发 · 已停止，禁止运动':serviceOpen?'维护盖未锁 · 驱动禁用':restartRequired?'信号已解除 · 请重新选择动作':'联锁就绪 · 实物由成人操作';
  $('obstacleBtn').textContent=obstacle?'解除遮挡':'模拟遮挡';$('obstacleBtn').setAttribute('aria-pressed',String(obstacle));
  window.bookmarkDesignState={progress:p,...q,moving,cutaway:cut,obstacle,serviceOpen,restartRequired};
}
function go(value){if(obstacle||serviceOpen)return;restartRequired=false;queue=[];hold=0;target=value;if(reduce){p=target;moving=false;}else moving=Math.abs(p-target)>.00001;sync();}
function tick(t){
  const dt=last?Math.min((t-last)/1000,.05):0;last=t;
  const wasMoving=moving;
  if(moving){
    if(hold>0)hold-=dt;
    else {const step=dt*.095*Number($('speed').value||1),delta=target-p;
      if(Math.abs(delta)<=step){p=target;if(queue.length){target=queue.shift();hold=.65;}else moving=false;}
      else p+=Math.sign(delta)*step;
    }
  }
  if(wasMoving||dirty){sync();dirty=false;}requestAnimationFrame(tick);
}
document.querySelectorAll('[data-state]').forEach(b=>b.addEventListener('click',()=>go([0,.36,1][+b.dataset.state])));
$('playBtn').addEventListener('click',()=>{if(obstacle||serviceOpen)return;restartRequired=false;if(reduce){go(1);return;}queue=[.36,1];if(p>.001){queue.unshift(0);}target=queue.shift();hold=0;moving=true;sync();});
$('pauseBtn').addEventListener('click',()=>{if(obstacle||serviceOpen||restartRequired)return;moving=!moving;sync();});
$('resetBtn').addEventListener('click',()=>go(0));
$('progress').addEventListener('input',e=>{if(obstacle||serviceOpen){sync();return;}restartRequired=false;p=Math.max(0,Math.min(1,Number(e.target.value)/100));target=p;moving=false;queue=[];hold=0;sync();});
function stopOnInterlock(){moving=false;target=p;queue=[];hold=0;restartRequired=true;sync();}
$('obstacleBtn').addEventListener('click',()=>{obstacle=!obstacle;stopOnInterlock();});
$('serviceOpen').addEventListener('change',e=>{serviceOpen=e.target.checked;stopOnInterlock();});
$('cutaway').addEventListener('change',e=>{cut=e.target.checked;$('annotationGroup').value='view';sync();});$('labels').addEventListener('change',sync);
function setView(mode){viewMode=mode;zoom=1;azimuth=mode==='side'?Math.PI/2:mode==='top'?0:.73;elevation=mode==='side'?.05:mode==='top'?Math.PI/2-.001:.50;['viewIso','viewSide','viewTop'].forEach((id,i)=>{$(id).classList.toggle('is-active',['iso','side','top'][i]===mode);$(id).setAttribute('aria-pressed',String(['iso','side','top'][i]===mode));});updateCamera();sync();}
$('viewIso').addEventListener('click',()=>setView('iso'));$('viewSide').addEventListener('click',()=>setView('side'));$('viewTop').addEventListener('click',()=>setView('top'));
try {init3D();} catch(error){
  const warning=document.createElement('p');warning.className='webgl-warning';warning.textContent='当前浏览器无法启用 3D 图形。下方的侧剖动画与所有状态控制仍可使用。';host.appendChild(warning);console.error('3D initialization failed:',error);renderer=null;
}
requestAnimationFrame(tick);
})();
