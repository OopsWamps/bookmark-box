// Geometry uses Three axes (X, height, -mechanical Y); all dimensions in mm.
let movingGuards=[],fixedGuards=[],drivePulleys=[],guardTags=[],driveGears=[],springHousing;
function ring(parent,inner,outer,h,x,y,z,mat,axis='y'){
 const pts=[[inner,-h/2],[outer,-h/2],[outer,h/2],[inner,h/2],[inner,-h/2]].map(p=>new THREE.Vector2(...p));
 const m=new THREE.Mesh(new THREE.LatheGeometry(pts,40),mat);m.position.set(x,y,z);
 if(axis==='x')m.rotation.z=Math.PI/2;parent.add(m);m.castShadow=true;return m;
}
function boredBlock(parent,w,h,d,x,y,z,r,mat){
 const sh=new THREE.Shape();sh.moveTo(-w/2,-d/2);sh.lineTo(w/2,-d/2);sh.lineTo(w/2,d/2);sh.lineTo(-w/2,d/2);sh.closePath();
 const hole=new THREE.Path();hole.absarc(0,0,r,0,Math.PI*2,true);sh.holes.push(hole);
 const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:h,bevelEnabled:false,curveSegments:24}),mat);m.rotation.x=Math.PI/2;m.position.set(x,y+h/2,z);parent.add(m);return m;
}
function roundRect(w,d,r){const s=new THREE.Shape(),x=-w/2,y=-d/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+d-r);s.quadraticCurveTo(x+w,y+d,x+w-r,y+d);s.lineTo(x+r,y+d);s.quadraticCurveTo(x,y+d,x,y+d-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
function roundedShell(parent,w,d,bottom,top,t,r,mat){
 const s=roundRect(w,d,r),hole=roundRect(w-2*t,d-2*t,Math.max(.3,r-t));s.holes.push(hole);
 const m=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:top-bottom,bevelEnabled:false,curveSegments:10}),mat);m.rotation.x=Math.PI/2;m.position.y=top;parent.add(m);m.castShadow=true;m.receiveShadow=true;return m;
}
function screwHead(parent,x,y,z){return cylinder(parent,1.3,.7,x,y,z,dark);}
function horizontalBelt(centers,r,z){
 const points=[];for(let i=0;i<centers.length;i++){
  const a=centers[(i+centers.length-1)%centers.length],b=centers[i],c=centers[(i+1)%centers.length];
  let a1=Math.atan2(-(b.x-a.x),b.y-a.y),a2=Math.atan2(-(c.x-b.x),c.y-b.y);while(a2<a1)a2+=Math.PI*2;
  for(let k=0;k<=24;k++){const t=a1+(a2-a1)*k/24;points.push(new THREE.Vector3(b.x+r*Math.cos(t),z,-(b.y+r*Math.sin(t))));}
 }points.push(points[0].clone());
 const pos=[],idx=[];points.forEach(p=>pos.push(p.x,z-1.5,p.z,p.x,z+1.5,p.z));for(let i=0;i<points.length-1;i++){const j=i*2;idx.push(j,j+1,j+2,j+1,j+3,j+2);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();const m=new THREE.Mesh(g,material(0x292929,{side:THREE.DoubleSide}));scene.add(m);
}
function verticalBelt(x){
 const pts=[];for(let k=0;k<=28;k++){let a=Math.PI/2-Math.PI*k/28;pts.push({y:D.guideY+3*Math.cos(a),z:103+3*Math.sin(a)});}
 for(let k=0;k<=28;k++){let a=-Math.PI/2-Math.PI*k/28;pts.push({y:-92+3*Math.cos(a),z:103+3*Math.sin(a)});}pts.push(pts[0]);
 const m=ribbonMesh(pts,4,material(0x282828,{side:THREE.DoubleSide}));m.position.x=x;liftGroup.add(m);
}
function buildLowBox(){
 buildPartAnnotations();
 box(scene,D.boxW,6,D.boxD,0,3,0,dark);
 shellParts.push(roundedShell(scene,D.boxW,D.boxD,6,110,3,6,dark));
 // Continuous soft wiping lip; dimensions are running clearances, not finger-safety claims.
 fixedGuards.push(roundedShell(scene,294,216,108.5,110,1.2,3,rubber));
 for(const x of [-126,126])for(const y of [-86,86])box(scene,24,1,18,x,-.5,-y,rubber);
 const tx=flatTexture(1024,256,(ctx,w,h)=>{ctx.clearRect(0,0,w,h);ctx.fillStyle='#f3f3f3';ctx.font='54px "Microsoft YaHei",sans-serif';ctx.fillText('拾 页',54,104);ctx.font='25px "Microsoft YaHei",sans-serif';ctx.fillText('让每一种好奇，都有生长的空间',55,179);});
 frontBrand=new THREE.Mesh(new THREE.PlaneGeometry(240,60),new THREE.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false,toneMapped:false}));frontBrand.position.set(0,57,111.06);scene.add(frontBrand);
 // Side spines transfer both upper and lower bearing loads into a bolted base flange.
 for(const x of [-129,129]){
  const sign=Math.sign(x);
  box(scene,3,100,82,sign*137.5,56,-11,silver);box(scene,18,3,86,sign*130,7.5,-11,silver);
  for(const yy of [-27,48])screwHead(scene,sign*130,9.4,-yy);
  // Lower fixed bearing bridges the drive belt; its rear foot and outer spine leave the pulley unobstructed.
  box(scene,18,8,3,x,10,10,silver);
  boredBlock(scene,18,8,20,x,18,18,5.15,silver);
  ring(scene,3,5.1,7,x,18,18,dark);
  screws.push(threaded(scene,x,18,22,98,3.5,2));
  cylinder(scene,3,14,x,15,18,silver);cylinder(scene,3,8,x,102,18,silver);
  const pl=cylinder(scene,5,3,x,11,18,rubber);drivePulleys.push(pl);
  boredBlock(scene,10,8,14,x,102,18,4.05,silver);box(scene,6,8,10,sign*136,102,18,silver);ring(scene,3,4,6,x,102,18,dark);
  // Rear guide rod: a clamped foot touches the base; the upper collar attaches to the same spine.
  boredBlock(scene,18,16,14,x,14,-40,3.1,silver);cylinder(scene,3,100,x,56,-40,silver);
  boredBlock(scene,10,8,14,x,102,-40,3.1,silver);box(scene,6,8,10,sign*136,102,-40,silver);
  for(const yy of [-18,40])for(const zz of [18,102])cylinder(scene,1.2,4,sign*137,zz,-yy,dark,'x');
 }
 horizontalBelt([{x:129,y:-18},{x:-129,y:-18},{x:0,y:-64}],5,11);
 // M1 has a real bridge bracket, continuous output shaft, and a closed three-pulley belt.
 for(const x of [-13,13])box(scene,3,38,12,x,25,49,silver);
 box(scene,29,4,32,0,44,58,silver);cylinder(scene,9,22,0,31,64,dark);cylinder(scene,2.5,13,0,15.5,64,silver);cylinder(scene,5,3,0,11,64,rubber);
 box(scene,55,12,20,0,12,86,dark); // sealed low-voltage control module
 // Moving carriage, connected by continuous stems and nut/guide arms.
 liftGroup=new THREE.Group();scene.add(liftGroup);
 const trayShape=new THREE.Shape([[-122,-98],[115,-98],[115,-84],[122,-84],[122,74],[-122,74]].map(v=>new THREE.Vector2(...v)));trayShape.closePath();const tray=new THREE.Mesh(new THREE.ExtrudeGeometry(trayShape,{depth:6,bevelEnabled:false}),white);tray.rotation.x=-Math.PI/2;tray.position.y=92;liftGroup.add(tray);
 box(liftGroup,237,4,2,-3.5,100,97,white);box(liftGroup,244,4,2,0,100,-73,white);
 box(liftGroup,2,4,168,-121,100,12,white);box(liftGroup,2,4,156,121,100,6,white);
 for(const x of [-58,0,58])box(liftGroup,1.2,3,150,x,99.5,12,white);
 for(const x of [-129,129]){
  const sign=Math.sign(x);box(liftGroup,6,62,100,sign*114,61,12,silver);
  boredBlock(liftGroup,12,10,12,x,30,18,3.6,dark);ring(liftGroup,3,5,10,x,30,-40,dark);
  box(liftGroup,12,6,12,sign*119,30,18,silver);box(liftGroup,12,6,12,sign*119,30,-40,silver);

 }
 makeCards();
 for(const x of [-142,142]){
  const sign=Math.sign(x);verticalBelt(x);
  for(const yy of [-92,92]){
   const pulley=cylinder(liftGroup,3,4,x,103,-yy,silver,'x');drivePulleys.push(pulley);
   if(yy===-92){
    if(sign<0){box(liftGroup,16,4,12,sign*128,92,92,silver);xBearingPlate(sign*134,94,107,-92,[{z:103,r:3.25}]);}
    else{box(liftGroup,16,4,10,128,91,80,silver);box(liftGroup,4,2,24,134,89,86,silver);xBearingPlate(134,88,107,-92,[{z:103,r:3.25},{z:93,r:1.6}]);}
    ring(liftGroup,1.5,3.2,4,sign*134,103,92,silver,'x');
   }else ring(liftGroup,1.5,3.2,4,sign*132,103,-92,silver,'x');
   cylinder(liftGroup,1.5,15,sign*136.5,103,-yy,silver,'x');

  }
 }
 cylinder(liftGroup,1.5,288,0,103,92,silver,'x');
 // M2 motor is bolted to the carrier; two equal pitch gears join its axis to the front shaft.
 cylinder(liftGroup,6,10,121,93,92,dark,'x');cylinder(liftGroup,1.5,14,133,93,92,silver,'x');
 box(liftGroup,2,14,14,115,93,92,silver);
 driveGears.push(spurGear(93,0),spurGear(103,Math.PI/20));
 pullBar=new THREE.Group();pullBar.position.z=92;liftGroup.add(pullBar);
 box(pullBar,284,1.4,3,0,107.2,0,dark,true);box(pullBar,254,.2,2,0,106.2,0,silver);
 box(pullBar,250,1.2,1.4,0,107.1,2,rubber); // soft leading edge
 for(const x of [-142,142])box(pullBar,3,1,3,x,106.5,0,silver);
 // Guide and spool journals pass through supported bearings; end hardware is outside the film.
 cylinder(liftGroup,11.85,254,0,94,-92,material(0x575757,{roughness:.85}),'x');
 cylinder(liftGroup,3,272,0,94,-92,silver,'x');cylinder(liftGroup,3,278,-3,32,-86,silver,'x');
 for(const x of [-132,132]){
  const sh=new THREE.Shape();sh.moveTo(78,25);sh.lineTo(100,25);sh.lineTo(100,107);sh.lineTo(78,107);sh.closePath();for(const yz of [[86,32],[92,94],[92,103]]){const h=new THREE.Path();h.absarc(yz[0],yz[1],yz[1]===103?3.25:5.05,0,Math.PI*2,true);sh.holes.push(h);}const hp=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:4,bevelEnabled:false}),dark);hp.rotation.y=Math.PI/2;hp.position.x=x-2;liftGroup.add(hp);
  ring(liftGroup,3,5,6,x,94,-92,silver,'x');ring(liftGroup,3,5,6,x,32,-86,silver,'x');
  box(liftGroup,22,5,12,Math.sign(x)*122,91,-73,silver);
 }
 reelGroup=new THREE.Group();reelGroup.position.set(0,32,-86);liftGroup.add(reelGroup);
 cylinder(reelGroup,14,254,0,0,0,dark,'x');filmRoll=cylinder(reelGroup,1,254,0,0,0,material(0xc3c3c3,{roughness:.4,metalness:.15}),'x');filmRoll.castShadow=false;
 for(const x of [-128.2,128.2])cylinder(reelGroup,16,2,x,0,0,silver,'x');
 // Fixed spring cartridge provides the reaction torque; only the arbor/film drum rotates.
 box(liftGroup,3,6,6,-134.5,32,-100,silver);springHousing=ring(liftGroup,15.5,17,7,-138,32,-86,white,'x');for(const x of [-141.5,-134.5])movingGuards.push(ring(liftGroup,3.1,17,.6,x,32,-86,white,'x'));movingGuards.push(springHousing);
 const springPoints=[];for(let i=0;i<220;i++){const a=i/219*Math.PI*8,r=5+i/219*9;springPoints.push(new THREE.Vector3(-138,32+r*Math.sin(a),-86+r*Math.cos(a)));}
 liftGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(springPoints),new THREE.LineBasicMaterial({color:0x777777})));box(liftGroup,5,3,3,-138,32,-70,dark);box(liftGroup,.8,1.2,2,-138,32,-82,silver);box(liftGroup,.8,1.2,2,-138,32,-71,silver);
 cassetteShell=new THREE.Group();liftGroup.add(cassetteShell);
 const shellPts=[];for(let i=0;i<=96;i++){const a=(42+343*i/96)*Math.PI/180;shellPts.push({y:86+18*Math.cos(a),z:32+18*Math.sin(a)});}
 cassetteShell.add(ribbonMesh(shellPts,258,white));for(const x of [-130,130])ring(cassetteShell,3,18,1,x,32,-86,white,'x');
 const points=Mechanism.coverPath(pose(0));filmMesh=ribbonMesh(points,254,glass);filmMesh.renderOrder=3;filmMesh.castShadow=false;liftGroup.add(filmMesh);
 filmEdges=[];for(const x of [-127,127]){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(v=>new THREE.Vector3(x,v.z,-v.y))),new THREE.LineBasicMaterial({color:0x777777,transparent:true,opacity:.75}));liftGroup.add(line);filmEdges.push(line);}
 // Continuous telescoping sleeve: 80 mm wall, 42 mm minimum overlap at full extension.
 movingGuards.push(roundedShell(liftGroup,291.6,213,8,88,.8,3,white));
 movingGuards.push(roundedShell(liftGroup,291.6,213,88,103.5,1,3,white));
 for(const sign of [-1,1]){
  movingGuards.push(box(liftGroup,17.3,1,202,sign*136.15,109.5,0,white));
  movingGuards.push(box(liftGroup,1,22,213,sign*145.3,99,0,white));
  movingGuards.push(box(liftGroup,.8,16.5,sign>0?162:167,sign*123,96.25,sign>0?3:5.5,white));
  movingGuards.push(box(liftGroup,5.5,.6,176,sign*125.5,108.6,0,rubber));
  // Inward facing labyrinth lip, above side rail, yields to the moving crossbar.
  movingGuards.push(box(liftGroup,.5,1.5,166,sign*123,105.25,5,rubber));
 }
 movingGuards.push(box(liftGroup,291.6,1,18,0,109.5,97.5,white));
 movingGuards.push(box(liftGroup,291.6,5.5,1,0,106.25,106,white));
 movingGuards.push(box(liftGroup,230,16.5,1,0,96.25,89,white));
 movingGuards.push(box(liftGroup,13,1,20,121.5,109.5,92,white));
 movingGuards.push(box(liftGroup,1,12.5,20,114.5,98.25,92,white));
 // Rear hood encloses roller and its entry; both upper/lower lips remain clear of the film path.
 movingGuards.push(box(liftGroup,291.6,1,28,0,109.5,-93,white));
 movingGuards.push(box(liftGroup,291.6,24,1,0,98,-106.5,white));
 movingGuards.push(box(liftGroup,258,19.5,1,0,95.75,-78.5,white));
 movingGuards.push(box(liftGroup,258,1.5,1,0,109.25,-78.5,white));
 movingGuards.push(box(liftGroup,255,1,4,0,108.5,-77.5,rubber));
 box(liftGroup,244,3,5,0,93.5,-76.5,white); // closes recess between rear tray and hood
 // Constant-length U-loop in a dedicated front pocket; both ends have strain relief.
 box(scene,5,3,37,96,80,86.5,silver);box(scene,5,74,3,96,43,103,silver);
 const cable=new THREE.Mesh(new THREE.TubeGeometry(cableCurve(0),48,1.1,8,false),rubber);cable.name='harness';scene.add(cable);
 const fixedCable=[new THREE.Vector3(25,12,86),new THREE.Vector3(100,18,102),new THREE.Vector3(100,80,102),new THREE.Vector3(100,80,68)];scene.add(new THREE.Mesh(new THREE.TubeGeometry(polylineCurve(fixedCable),32,1.1,8,false),rubber));
 box(scene,4,4,5,100,80,68,rubber);box(liftGroup,4,4,5,112,88,68,rubber);box(liftGroup,5,5,14,112,90,68,silver);
}
function xBearingPlate(x,bottom,top,y,holes){const sh=new THREE.Shape();sh.moveTo(-4,bottom);sh.lineTo(4,bottom);sh.lineTo(4,top);sh.lineTo(-4,top);sh.closePath();for(const {z,r} of holes){const h=new THREE.Path();h.absarc(0,z,r,0,Math.PI*2,true);sh.holes.push(h);}const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:4,bevelEnabled:false}),dark);m.rotation.y=Math.PI/2;m.position.set(x-2,0,-y);liftGroup.add(m);}
function spurGear(z,phase){
 const N=20,rp=5,rb=rp*Math.cos(Math.PI/9),ra=5.5,rd=4.375,half=Math.PI/(2*N),ip=Math.tan(Math.PI/9)-Math.PI/9,pts=[];
 const inv=r=>{const a=Math.acos(rb/r);return Math.tan(a)-a;};
 for(let k=0;k<N;k++){const c=k*2*Math.PI/N+phase,ang=half+ip;pts.push(new THREE.Vector2(rd*Math.cos(c-ang),rd*Math.sin(c-ang)));
  for(let i=0;i<=7;i++){const r=rb+(ra-rb)*i/7,a=c-(half+ip-inv(r));pts.push(new THREE.Vector2(r*Math.cos(a),r*Math.sin(a)));}
  for(let i=7;i>=0;i--){const r=rb+(ra-rb)*i/7,a=c+(half+ip-inv(r));pts.push(new THREE.Vector2(r*Math.cos(a),r*Math.sin(a)));}
  pts.push(new THREE.Vector2(rd*Math.cos(c+ang),rd*Math.sin(c+ang)));
 }
 const sh=new THREE.Shape(pts);sh.closePath();const hole=new THREE.Path();hole.absarc(0,0,1.5,0,Math.PI*2,true);sh.holes.push(hole);
 const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:2,bevelEnabled:false}),silver);mesh.rotation.y=Math.PI/2;mesh.position.set(137.5,z,92);liftGroup.add(mesh);return mesh;
}
function ribbonMesh(points,width,mat){
 const pos=[],indices=[];points.forEach(v=>pos.push(-width/2,v.z,-v.y,width/2,v.z,-v.y));
 for(let i=0;i<points.length-1;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geom.setIndex(indices);geom.computeVertexNormals();return new THREE.Mesh(geom,mat);
}
function polylineCurve(points){const c=new THREE.CurvePath();for(let i=1;i<points.length;i++)c.add(new THREE.LineCurve3(points[i-1],points[i]));return c;}
function cableCurve(lift){const z=36+lift/2,path=new THREE.CurvePath();path.add(new THREE.LineCurve3(new THREE.Vector3(100,80,68),new THREE.Vector3(100,z,68)));const pts=[];for(let i=0;i<=40;i++){const a=Math.PI+Math.PI*i/40;pts.push(new THREE.Vector3(106+6*Math.cos(a),z+6*Math.sin(a),68));}for(let i=1;i<pts.length;i++)path.add(new THREE.LineCurve3(pts[i-1],pts[i]));path.add(new THREE.LineCurve3(new THREE.Vector3(112,z,68),new THREE.Vector3(112,88+lift,68)));return path;}
function updateLowBox(q){
 liftGroup.position.y=q.lift;pullBar.position.z=-q.frontY;
 const points=Mechanism.coverPath(q),a=filmMesh.geometry.attributes.position;
 points.forEach((v,i)=>{a.setXYZ(i*2,-127,v.z-q.lift,-v.y);a.setXYZ(i*2+1,127,v.z-q.lift,-v.y);});a.needsUpdate=true;filmMesh.geometry.computeVertexNormals();filmMesh.geometry.computeBoundingSphere();
 filmEdges.forEach((line,k)=>{const a=line.geometry.attributes.position;points.forEach((v,i)=>a.setXYZ(i,k===0?-127:127,v.z-q.lift,-v.y));a.needsUpdate=true;line.geometry.computeBoundingSphere();});
 filmRoll.scale.set(q.rollRadius,1,q.rollRadius);reelGroup.rotation.x=-q.rollAngle;cassetteShell.visible=!cut;
 screws.forEach(s=>s.rotation.y=q.lift/2*Math.PI*2);driveGears.forEach((g,i)=>g.rotation.x=(i?-1:1)*q.retract/3);shellParts.forEach(s=>s.visible=!cut);frontBrand.visible=!cut;
 movingGuards.forEach(s=>s.visible=!cut);fixedGuards.forEach(s=>s.visible=!cut);
 const cable=scene.getObjectByName('harness');cable.geometry.dispose();cable.geometry=new THREE.TubeGeometry(cableCurve(q.lift),48,1.1,8,false);
}
function drawLowSection(q){
 const c=$('sectionCanvas');if(!c)return;const w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;const dpr=Math.min(devicePixelRatio,2);if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
 const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const s=Math.min((h-54)/185,(w-74)/320),ox=w*.44,oy=h-28,xy=(y,z)=>[ox+y*s,oy-z*s];
 function line(y1,z1,y2,z2,color,width=1,dash=[]){ctx.beginPath();ctx.setLineDash(dash);ctx.moveTo(...xy(y1,z1));ctx.lineTo(...xy(y2,z2));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.setLineDash([]);}
 function rect(y,z,ww,hh,color){const a=xy(y,z+hh);ctx.fillStyle=color;ctx.fillRect(a[0],a[1],ww*s,hh*s);}
 function text(str,y,z,align='left'){ctx.textAlign=align;ctx.fillStyle='#666';ctx.font='11px "Microsoft YaHei",sans-serif';ctx.fillText(str,...xy(y,z));}
 function circle(y,z,r,color,width=1){ctx.beginPath();ctx.arc(...xy(y,z),r*s,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
 rect(-111,0,222,6,'#222');rect(-111,6,3,104,'#222');rect(108,6,3,104,'#222');
 rect(-106.5,8+q.lift,1.2,95.5,'#999');rect(105.3,8+q.lift,1.2,102,'#999');rect(79,109+q.lift,28,1,'#777');
 line(-119,110,125,110,'#bbb',1,[3,4]);text('盒口 110',-111,117);
 rect(-98,q.trayZ-6,172,6,'#aaa');rect(-87,q.trayZ,150,3,'#444');circle(92,94+q.lift,12,'#999');circle(86,32+q.lift,18,'#aaa');circle(86,32+q.lift,q.rollRadius,'#222',2);
 const points=Mechanism.coverPath(q);ctx.beginPath();points.forEach((v,i)=>i?ctx.lineTo(...xy(v.y,v.z)):ctx.moveTo(...xy(v.y,v.z)));ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.stroke();
 line(123,q.skirtBottom,123,110,'#666');line(120,q.skirtBottom,126,q.skirtBottom,'#666');line(120,110,126,110,'#666');text('搭接 '+q.skirtOverlap.toFixed(0),130,(110+q.skirtBottom)/2);
 text('前',-100,-19);text('后侧封闭卷盒',85,-19,'center');ctx.fillStyle='#777';ctx.textAlign='left';ctx.font='11px "Microsoft YaHei",sans-serif';ctx.fillText('侧剖 · 连续套筒包覆升降区',12,18);
}
