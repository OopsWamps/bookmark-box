// Mechanical coordinates are X right, Y rear, Z up. Three uses (X,Z,-Y).
let tiltGroup,tiltPivot,bellowsMesh,hingeCable,advanceFixed=[],advanceMoving=[],camRollers=[],reelShell,pawlPivots=[],serviceProps=[],obstacleDemo;
const mechanicalToThree=p=>new THREE.Vector3(p.x,p.z,-p.y);
// Local edge treatment only. The chamfer removes material inside the original
// box envelope; central flat mating faces and all original locations are kept.
function insetChamferGeometry(w,h,d,c){
 const sh=new THREE.Shape([[-w/2+c,-d/2+c],[w/2-c,-d/2+c],[w/2-c,d/2-c],[-w/2+c,d/2-c]].map(p=>new THREE.Vector2(...p)));sh.closePath();
 const g=new THREE.ExtrudeGeometry(sh,{depth:h-2*c,steps:1,bevelEnabled:true,bevelThickness:c,bevelSize:c,bevelSegments:1});
 g.translate(0,0,c-h/2);g.rotateX(-Math.PI/2);g.computeBoundingBox();return g;
}
function chamferMesh(m,w,h,d,c=.3){
 m.geometry.dispose();m.geometry=insetChamferGeometry(w,h,d,c);m.userData.edgeTreatment={type:'inward-chamfer',size:c,envelope:{w,h,d}};return m;
}
function chamferBox(parent,w,h,d,x,z,yy,mat,c=.3){return chamferMesh(box(parent,w,h,d,x,z,yy,mat),w,h,d,c);}
function supportRootFillet(parent,x,z,yy,sign,depth,r=2){
 // A tangent quarter-circle fills the foot/post re-entrant corner. It joins
 // both faces continuously rather than decorating the edge with a line.
 const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(r,0);sh.absarc(r,r,r,-Math.PI/2,-Math.PI,true);sh.lineTo(0,0);sh.closePath();
 const g=new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:false,curveSegments:16}),m=new THREE.Mesh(g,silver);
 m.position.set(x,z,yy-depth/2);m.scale.x=sign;m.name='support-root-fillet';m.userData.edgeTreatment={type:'root-fillet',radius:r};parent.add(m);m.castShadow=true;return m;
}
function finishFoundationEdges(){
 // Foundation parts come from the unchanged shared renderer. Select only its
 // free outer block corners, preserving bores and the principal mating flats.
 scene.traverse(m=>{
  if(!m.isMesh||m.material!==silver)return;const g=m.geometry,p=g.parameters;
  if(g.type==='BoxGeometry'&&p&&((p.width===3&&p.height===100)||(p.width===18&&p.height===3)||(p.width===18&&p.height===8&&p.depth===3)||(p.width===6&&p.height===8)||(p.width===3&&p.height===38)||(p.width===29&&p.height===4)))chamferMesh(m,p.width,p.height,p.depth,.3);
  if(g.type==='ExtrudeGeometry'&&Math.abs(m.position.x)===129){
   const low=m.position.y===22,upper=m.position.y===106,guide=m.position.z===-40;
   if(!low&&!upper)return;
   const w=upper?10:18,h=upper?8:guide?16:8,d=upper?14:guide?14:20,r=guide?3.1:upper?4.05:5.15,sh=roundRect(w,d,1);
   const hole=new THREE.Path();hole.absarc(0,0,r,0,Math.PI*2,true);sh.holes.push(hole);g.dispose();m.geometry=new THREE.ExtrudeGeometry(sh,{depth:h,bevelEnabled:false,curveSegments:24});m.userData.edgeTreatment={type:'outer-profile-fillet',radius:1,boreRadius:r};
  }
 });
 for(const sign of [-1,1])supportRootFillet(scene,sign*136,9,-11,-sign,82,2);
}
// Both rigid clamp rings and the soft enclosure share this stepped attachment.
// Dropping the rear 11 mm puts the enclosure below the rear guide roller.
function bellowsRearDrop(y){const u=Math.max(0,Math.min(1,(y-70)/26));return 11*u*u*(3-2*u);}
function guardPerimeter(hw,hd,r){
 const p=[],sideYs=[94,90,86,82,78,74,70,0];
 for(const [i,[cx,cy,start]]of [[hw-r,hd-r,0],[-hw+r,hd-r,Math.PI/2],[-hw+r,-hd+r,Math.PI],[hw-r,-hd+r,Math.PI*1.5]].entries()){
  for(let k=0;k<=8;k++){const a=start+k*Math.PI/16;p.push({x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)});}
  if(i===1)for(const y of sideYs)p.push({x:-hw,y});
  if(i===3)for(const y of [...sideYs].reverse())p.push({x:hw,y});
 }return p;
}
function formedGuardRing(parent,w,d,iw,id,bottom,top,name,ramped=false){
 const outer=guardPerimeter(w/2,d/2,4+(w-iw)/2),inner=guardPerimeter(iw/2,id/2,4),pos=[],idx=[],n=inner.length;
 for(const [contour,z]of [[outer,bottom],[outer,top],[inner,bottom],[inner,top]])for(const p of contour)pos.push(p.x,z-bellowsRearDrop(p.y)+(ramped?Math.max(0,p.y-100)*4/6.5:0),-p.y);
 const quad=(a,b,c,d)=>idx.push(a,b,c,b,d,c);
 for(let i=0;i<n;i++){const k=(i+1)%n;quad(i,k,n+i,n+k);quad(2*n+k,2*n+i,3*n+k,3*n+i);quad(n+i,n+k,3*n+i,3*n+k);quad(k,i,2*n+k,2*n+i);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
 const m=new THREE.Mesh(g,white);m.name=name;parent.add(m);m.castShadow=true;return m;
}
function rearHoodTransition(){
 // The upper formed flange supplies the ramp; this wall continues it to Z91.
 const yz=[{y:105.5,z:84},{y:106.5,z:84},{y:106.5,z:91},{y:105.5,z:91}];
 const sh=new THREE.Shape(yz.map(p=>new THREE.Vector2(p.y,p.z)));sh.closePath();
 const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:291.6,bevelEnabled:false}),white);m.rotation.y=Math.PI/2;m.position.x=-145.8;m.name='rear-hood-ramp';tiltGroup.add(m);return m;
}
function upperCornerClosures(){
 // The rounded clamp meets rectangular rigid walls. Fill the four arc-to-corner
 // patches so the enclosure has no open bottom at the rigid hood corners.
 const r=7.8,hw=145.8,hd=106.5;
 for(const [sx,sy,start]of [[1,1,0],[-1,1,Math.PI/2],[-1,-1,Math.PI],[1,-1,Math.PI*1.5]]){
  const points=[];for(let k=0;k<=8;k++){const a=start+k*Math.PI/16;points.push({x:sx*(hw-r)+r*Math.cos(a),y:sy*(hd-r)+r*Math.sin(a)});}points.push({x:sx*hw,y:sy*hd});
  const pos=[],idx=[],n=points.length;
  for(const h of [0,.7])for(const p of points)pos.push(p.x,91-bellowsRearDrop(p.y)+Math.max(0,p.y-100)*4/6.5+h,-p.y);
  for(let i=0;i<n-2;i++){idx.push(n-1,i,i+1,2*n-1,n+i+1,n+i);}
  for(let i=0;i<n;i++){const k=(i+1)%n;idx.push(i,n+i,k,k,n+i,n+k);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,white);m.name='rear-corner-closure-'+sx+'-'+sy;tiltGroup.add(m);m.castShadow=true;advanceMoving.push(m);
 }
}
function xPlate(parent,x,t,points,holes,mat){
 const sh=new THREE.Shape();
 if(points.some(p=>p.r)){
  const corners=points.map((p,i)=>{
   const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length],ua=new THREE.Vector2(a.y-p.y,a.z-p.z),ub=new THREE.Vector2(b.y-p.y,b.z-p.z),la=ua.length(),lb=ub.length();ua.divideScalar(la);ub.divideScalar(lb);
   const angle=Math.acos(Math.max(-1,Math.min(1,ua.dot(ub)))),tangent=Math.min((p.r||0)/Math.tan(angle/2),la*.45,lb*.45),r=tangent*Math.tan(angle/2),bisector=ua.clone().add(ub).normalize(),center=new THREE.Vector2(p.y,p.z).addScaledVector(bisector,r/Math.sin(angle/2));
   const start=new THREE.Vector2(p.y,p.z).addScaledVector(ua,tangent),end=new THREE.Vector2(p.y,p.z).addScaledVector(ub,tangent),clockwise=(-ua.x*ub.y+ua.y*ub.x)<0;
   return{p,start,end,center,r,clockwise};
  });
  sh.moveTo(corners[0].start.x,corners[0].start.y);
  for(const c of corners){sh.lineTo(c.start.x,c.start.y);if(c.r>0)sh.absarc(c.center.x,c.center.y,c.r,Math.atan2(c.start.y-c.center.y,c.start.x-c.center.x),Math.atan2(c.end.y-c.center.y,c.end.x-c.center.x),c.clockwise);else sh.lineTo(c.p.y,c.p.z);}
 }else{sh.setFromPoints(points.map(p=>new THREE.Vector2(p.y,p.z)));}
 sh.closePath();
 for(const h of holes){const hp=new THREE.Path();hp.absarc(h.y,h.z,h.r,0,Math.PI*2,true);sh.holes.push(hp);}
 const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:t,bevelEnabled:false,curveSegments:32}),mat);m.rotation.y=Math.PI/2;m.position.x=x-t/2;parent.add(m);m.castShadow=true;return m;
}
function camOutline(points,r){
 const normals=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],dy=b.y-a.y,dz=b.z-a.z,d=Math.hypot(dy,dz);return {y:dz/d,z:-dy/d};});
 const out=points.map((p,i)=>({y:p.y+r*normals[i].y,z:p.z+r*normals[i].z}));
 for(let k=1;k<=24;k++){const p=points.at(-1),n=normals.at(-1),a=Math.atan2(n.z,n.y)+Math.PI*k/24;out.push({y:p.y+r*Math.cos(a),z:p.z+r*Math.sin(a)});}
 for(let i=points.length-2;i>=0;i--)out.push({y:points[i].y-r*normals[i].y,z:points[i].z-r*normals[i].z});
 for(let k=1;k<=24;k++){const p=points[0],n=normals[0],a=Math.atan2(n.z,n.y)+Math.PI+Math.PI*k/24;out.push({y:p.y+r*Math.cos(a),z:p.z+r*Math.sin(a)});}return out;
}
function camPlate(sign){
 const pts=Mechanism.camCenterline(400),half=sign>0?5.15:6.3,outer=camOutline(pts,half+3),inner=camOutline(pts,half).reverse();
 const sh=new THREE.Shape(outer.map(p=>new THREE.Vector2(p.y,p.z)));sh.closePath();const hole=new THREE.Path(inner.map(p=>new THREE.Vector2(p.y,p.z)));hole.closePath();sh.holes.push(hole);
 const plate=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:4,bevelEnabled:false,curveSegments:32}),silver);plate.rotation.y=Math.PI/2;plate.position.x=sign*132-2;scene.add(plate);plate.castShadow=true;
 // Bottom foot and upper side brace tie the narrow cam strip into the fixed frame.
 chamferBox(scene,18,3,24,sign*132,7.5,93,silver);
 // Its top inside corner has only 1.15 mm nominal overlap with the cam strip.
 // Keep that narrow connecting land square; the foot carries the free-edge C.3.
 box(scene,4,29,14,sign*132,20.5,96,silver);
 for(const side of [-1,1])supportRootFillet(scene,sign*132+side*2,9,96,side,14,2);
 chamferBox(scene,8,4,4,sign*134,100,51,silver);
 chamferBox(scene,2,4,24,sign*137.5,100,39,silver);
 for(const y of [-98,-86])screwHead(scene,sign*132,9.4,-y);
 cylinder(scene,1.2,8,sign*134,100,51,dark,'x');
 cylinder(scene,1.2,5,sign*137.5,100,29,dark,'x');
}
function trayPockets(){
 const outline=[[-115,-98],[115,-98],[115,-65],[122,-65],[122,74],[-122,74],[-122,-65],[-115,-65]];
 const sh=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p)));sh.closePath();
 const roundedHole=(x,y,w,h,r)=>{const hp=new THREE.Path();hp.moveTo(x-w/2+r,y-h/2);hp.lineTo(x+w/2-r,y-h/2);hp.quadraticCurveTo(x+w/2,y-h/2,x+w/2,y-h/2+r);hp.lineTo(x+w/2,y+h/2-r);hp.quadraticCurveTo(x+w/2,y+h/2,x+w/2-r,y+h/2);hp.lineTo(x-w/2+r,y+h/2);hp.quadraticCurveTo(x-w/2,y+h/2,x-w/2,y+h/2-r);hp.lineTo(x-w/2,y-h/2+r);hp.quadraticCurveTo(x-w/2,y-h/2,x-w/2+r,y-h/2);hp.closePath();return hp;};
 for(const x of [-87,-29,29,87]){
  // Add a blind rear finger scoop to the same opening, with the 2 mm floor retained.
  // Union is represented by one simple contour, avoiding overlapping shape holes.
  const pth=new THREE.Path();pth.moveTo(x-24,-88);pth.lineTo(x+24,-88);pth.quadraticCurveTo(x+26,-88,x+26,-86);pth.lineTo(x+26,62);pth.quadraticCurveTo(x+26,64,x+24,64);pth.lineTo(x+8,64);pth.absarc(x,64,8,0,Math.PI,false);pth.lineTo(x-24,64);pth.quadraticCurveTo(x-26,64,x-26,62);pth.lineTo(x-26,-86);pth.quadraticCurveTo(x-26,-88,x-24,-88);pth.closePath();sh.holes.push(pth);
 }
 const top=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:4,bevelEnabled:false,curveSegments:16}),white);top.rotation.x=-Math.PI/2;top.position.y=94;tiltGroup.add(top);
 // Blind pockets have a continuous 2 mm floor, reinforced by the frame below.
 const floorSh=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p)));floorSh.closePath();
 const floor=new THREE.Mesh(new THREE.ExtrudeGeometry(floorSh,{depth:2,bevelEnabled:false}),white);floor.rotation.x=-Math.PI/2;floor.position.y=92;tiltGroup.add(floor);
 for(const x of [-87,-29,29,87]){
  box(tiltGroup,48,2.4,1.2,x+1,95.8,-62.5,rubber);
  box(tiltGroup,2.1,2.4,140,x-25,95.8,12,rubber);
 }
 // The low end remains continuous; local motor-notch wall gets a captive steel angle.
 box(tiltGroup,1,7,15,113.5,89.5,91,silver);
 box(tiltGroup,5,1,15,116,86.5,91,silver);
}
function buildAdvancedParts(){
 finishFoundationEdges();
 camPlate(1);camPlate(-1);
 liftGroup=new THREE.Group();scene.add(liftGroup);
 // Vertical carriage: stems and nut arms remain aligned with the fixed screws/guides.
 for(const sign of [-1,1]){
  chamferBox(liftGroup,6,54,91,sign*114,57,16.5,silver,.5);
  boredBlock(liftGroup,12,10,12,sign*129,30,18,3.6,dark);
  ring(liftGroup,3,5,10,sign*129,30,-40,dark);
  for(const y of [-18,40])chamferBox(liftGroup,12,6,12,sign*119,30,-y,silver,.5);
  // The rear arm starts at mechanical Y34, but the vertical stem ends at Y29.
  // This short web overlaps both parts and closes the former 5 mm load-path gap.
  chamferBox(liftGroup,6,6,9,sign*114,33,-31.5,silver,.3);
  // Front bearing arm joins the vertical stem without crossing a bookmark pocket.
  chamferBox(liftGroup,6,4,36,sign*114,82,70,silver);
  chamferBox(liftGroup,6.5,4,8,sign*117.25,82,76,silver);
  chamferBox(liftGroup,3,18,4,sign*120.5,91,76,silver);
  for(const [cx,t] of [[120.5,3],[128.5,2]]){
   ring(liftGroup,4.05,5,t,sign*cx,100,82,silver,'x');
   ring(liftGroup,2,4,t,sign*cx,100,82,dark,'x');
   chamferBox(liftGroup,t,4,8,sign*cx,102,74,silver);
  }
  chamferBox(liftGroup,11,4,10,sign*124,102,73,silver);
 }
 advanceMoving.push(roundedShell(liftGroup,291.6,213,8,80,.8,3,white));
 // Continuous formed flange connects the soft enclosure to the vertical skirt.
 advanceMoving.push(formedGuardRing(liftGroup,291.6,213,284,200,75.3,76,'rear-lower-flange'));
 tiltPivot=new THREE.Group();tiltPivot.position.set(0,100,82);scene.add(tiltPivot);
 tiltGroup=new THREE.Group();tiltGroup.position.set(0,-100,-82);tiltPivot.add(tiltGroup);
 trayPockets();
 // Continuous U-shaped torsion frame under the pocket floors connects both trunnions.
 for(const x of [-114,-58,0,58,114])chamferBox(tiltGroup,6,6,162,x,89,12,silver,.5);
 for(const y of [-82,-6,66])chamferBox(tiltGroup,228,6,6,0,89,-y,silver,.5);
 for(const sign of [-1,1]){
  chamferBox(tiltGroup,12,6,8,sign*122,89,62,silver);
  chamferBox(tiltGroup,3,6,20,sign*125.5,89,72,silver);
  cylinder(tiltGroup,2,17,sign*126,100,82,silver,'x');
  const armPts=[];for(let i=0;i<=24;i++){const a=Math.PI*i/24;armPts.push({y:-82+3*Math.cos(a),z:100+3*Math.sin(a)});}for(let i=0;i<=24;i++){const a=Math.PI+Math.PI*i/24;armPts.push({y:-82+3*Math.cos(a),z:35+3*Math.sin(a)});}
  xPlate(tiltGroup,sign*125.5,3,armPts,[{y:-82,z:100,r:2.05},{y:-82,z:35,r:1.55}],silver);
  const wheel=ring(tiltGroup,1.5,5,7,sign*132,35,82,silver,'x');camRollers.push(wheel);
  cylinder(tiltGroup,1.5,12.8,sign*130.1,35,82,silver,'x');
  cylinder(tiltGroup,2.6,1,sign*123.2,35,82,dark,'x');
  cylinder(tiltGroup,2.6,1.5,sign*136.25,35,82,dark,'x');
 }
 const carriage=liftGroup;liftGroup=tiltGroup;
 makeCards();
 for(const x of [-142,142]){
  const sign=Math.sign(x);verticalBelt(x);
  for(const y of [-92,92]){
   drivePulleys.push(cylinder(tiltGroup,3,4,x,103,-y,silver,'x'));
   if(y===-92){if(sign<0){box(tiltGroup,16,4,12,-128,92,92,silver);xBearingPlate(-134,94,107,-92,[{z:103,r:3.25}]);}else{box(tiltGroup,16,4,10,128,91,80,silver);box(tiltGroup,4,2,24,134,89,86,silver);xBearingPlate(134,88,107,-92,[{z:103,r:3.25},{z:93,r:1.6}]);}}
   ring(tiltGroup,1.5,3.2,4,sign*134,103,-y,silver,'x');cylinder(tiltGroup,1.5,15,sign*136.5,103,-y,silver,'x');
  }
 }
 cylinder(tiltGroup,1.5,288,0,103,92,silver,'x');
 cylinder(tiltGroup,6,10,121,93,92,dark,'x');cylinder(tiltGroup,1.5,14,133,93,92,silver,'x');box(tiltGroup,2,14,14,115,93,92,silver);
 driveGears.push(spurGear(93,0),spurGear(103,Math.PI/20));
 pullBar=new THREE.Group();pullBar.position.z=92;tiltGroup.add(pullBar);
 box(pullBar,284,1.4,3,0,107.2,0,dark);box(pullBar,254,.2,2,0,106.2,0,silver);box(pullBar,250,1.2,1.4,0,107.1,2,rubber);
 for(const x of [-142,142])box(pullBar,3,1,3,x,106.5,0,silver);
 cylinder(tiltGroup,11.85,254,0,94,-92,material(0x575757,{roughness:.85}),'x');cylinder(tiltGroup,3,272,0,94,-92,silver,'x');
 cylinder(tiltGroup,3,278,-3,66,-72,silver,'x');
 for(const x of [-132,132]){
  const rearPlate=xPlate(tiltGroup,x,4,[{y:54,z:49,r:1},{y:82,z:49,r:1},{y:82,z:78,r:2},{y:100,z:88,r:1},{y:100,z:107,r:1},{y:78,z:107,r:1},{y:78,z:88,r:2},{y:54,z:88,r:1}],[{y:72,z:66,r:5.05},{y:92,z:94,r:5.05},{y:92,z:103,r:3.25}],dark);rearPlate.name='rear-bearing-plate';rearPlate.userData.edgeTreatment={type:'profile-fillet',internalRadius:2,externalRadius:1};
  ring(tiltGroup,3,5,6,x,94,-92,silver,'x');ring(tiltGroup,3,5,6,x,66,-72,silver,'x');
  chamferBox(tiltGroup,22,5,12,Math.sign(x)*122,91,-73,silver);
 }
 reelGroup=new THREE.Group();reelGroup.position.set(0,66,-72);tiltGroup.add(reelGroup);
 cylinder(reelGroup,14,254,0,0,0,dark,'x');filmRoll=cylinder(reelGroup,1,254,0,0,0,material(0xc3c3c3,{roughness:.4}),'x');
 for(const x of [-128.2,128.2])cylinder(reelGroup,16,2,x,0,0,silver,'x');
 box(tiltGroup,3,6,6,-134.5,66,-89,silver);
 springHousing=ring(tiltGroup,15.5,17,7,-138,66,-72,white,'x');
 advanceMoving.push(springHousing);for(const x of [-141.5,-134.5])advanceMoving.push(ring(tiltGroup,3.1,17,.6,x,66,-72,white,'x'));
 const sp=[];for(let i=0;i<220;i++){const a=i/219*Math.PI*8,r=5+i/219*9;sp.push(new THREE.Vector3(-138,66+r*Math.sin(a),-72+r*Math.cos(a)));}
 tiltGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(sp),new THREE.LineBasicMaterial({color:0x777777})));
 box(tiltGroup,5,3,3,-138,66,-56,dark);box(tiltGroup,.8,1.2,2,-138,66,-68,silver);box(tiltGroup,.8,1.2,2,-138,66,-57,silver);
 cassetteShell=new THREE.Group();tiltGroup.add(cassetteShell);
 const shellPts=[];for(let i=0;i<=120;i++){const a=(9+351*i/120)*Math.PI/180;shellPts.push({y:72+18*Math.cos(a),z:66+18*Math.sin(a)});}
 cassetteShell.add(ribbonMesh(shellPts,258,white));for(const x of [-130,130])ring(cassetteShell,3,18,1,x,66,-72,white,'x');
 const points=Mechanism.coverPath(pose(0));filmMesh=ribbonMesh(points,254,glass);filmMesh.renderOrder=3;filmMesh.castShadow=false;tiltGroup.add(filmMesh);
 filmEdges=[];for(const x of [-127,127]){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(v=>new THREE.Vector3(x,v.z,-v.y))),new THREE.LineBasicMaterial({color:0x777777,transparent:true,opacity:.65}));tiltGroup.add(line);filmEdges.push(line);}
 // Rigid cover guards rotate with the tray; their lower edges clear the skirt.
 for(const sign of [-1,1]){
  advanceMoving.push(box(tiltGroup,17.3,1,202,sign*136.15,109.5,0,white));
  advanceMoving.push(box(tiltGroup,1,19,213,sign*145.3,100.5,0,white));
  const wall=[{y:70,z:91},{y:74,z:91-bellowsRearDrop(74)},{y:78,z:91-bellowsRearDrop(78)},{y:82,z:91-bellowsRearDrop(82)},{y:86,z:91-bellowsRearDrop(86)},{y:90,z:91-bellowsRearDrop(90)},{y:94,z:91-bellowsRearDrop(94)},{y:96,z:80},{y:100,z:80},{y:106.5,z:84},{y:106.5,z:91}];
  const extension=xPlate(tiltGroup,sign*145.3,1,wall,[],white);extension.name='rear-side-hood-'+sign;advanceMoving.push(extension);
  advanceMoving.push(box(tiltGroup,.8,13.5,162,sign*123,97.75,3,white));
  advanceMoving.push(box(tiltGroup,5.5,.6,176,sign*125.5,108.6,0,rubber));
  advanceMoving.push(box(tiltGroup,.5,1.5,166,sign*123,105.25,5,rubber));
 }
 advanceMoving.push(box(tiltGroup,291.6,1,18,0,109.5,97.5,white));advanceMoving.push(box(tiltGroup,291.6,19,1,0,100.5,106,white));
 advanceMoving.push(box(tiltGroup,230,13.5,1,0,97.75,89,white));advanceMoving.push(box(tiltGroup,13,1,20,121.5,109.5,92,white));advanceMoving.push(box(tiltGroup,1,12.5,20,114.5,98.25,92,white));
 advanceMoving.push(box(tiltGroup,291.6,1,28,0,109.5,-93,white));advanceMoving.push(box(tiltGroup,291.6,19,1,0,100.5,-106.5,white));
 advanceMoving.push(box(tiltGroup,258,13.5,1,0,97.75,-78.5,white));advanceMoving.push(box(tiltGroup,258,1.5,1,0,109.25,-78.5,white));advanceMoving.push(box(tiltGroup,255,1,4,0,108.5,-77.5,rubber));
 box(tiltGroup,244,3,5,0,93.5,-76.5,white);
 advanceMoving.push(rearHoodTransition());
 advanceMoving.push(formedGuardRing(tiltGroup,291.6,213,284,200,91,91.7,'rear-upper-flange',true));
 advanceMoving.push(formedGuardRing(tiltGroup,286.4,201.4,284,200,91,94,'rear-upper-clamp',true));
 upperCornerClosures();
 liftGroup=carriage;
 buildSafetyDevices();
 const bellowsMat=material(0xa8a8a5,{roughness:1,side:THREE.DoubleSide});
 bellowsMesh=new THREE.Mesh(bellowsGeometry(pose(0)),bellowsMat);scene.add(bellowsMesh);
 // Original constant-length lift U-loop and an independent hinge bend segment.
 box(scene,5,3,37,92,80,86.5,silver);box(scene,5,74,3,92,43,103,silver);
 const cable=new THREE.Mesh(new THREE.TubeGeometry(cableCurve(0),48,1.1,8,false),rubber);cable.name='harness';scene.add(cable);
 const fixed=[new THREE.Vector3(25,12,86),new THREE.Vector3(96,18,99),new THREE.Vector3(96,18,102),new THREE.Vector3(96,80,102),new THREE.Vector3(96,80,68)];scene.add(new THREE.Mesh(new THREE.TubeGeometry(polylineCurve(fixed),32,1.1,8,false),rubber));
 box(scene,4,4,5,96,80,68,rubber);
 box(liftGroup,3,4,5,110.5,82,68,silver);box(liftGroup,4,4,5,108,82,68,rubber);
 box(tiltGroup,3,3,5,110.5,89,68,silver);box(tiltGroup,4,3,5,108,89,68,rubber);
 hingeCable=new THREE.Mesh(new THREE.TubeGeometry(hingeCableCurve(pose(0)),32,1.1,8,false),rubber);scene.add(hingeCable);
}
// D5-2 lift safety train, approved as combination 1 (DEC-002): energised brake
// for holding, sprung pawls on fixed racks for run-away arrest independent of
// the drive, and swing-out service props. Concept geometry only: tooth
// profiles, solenoid and brake sizing, prop stiffness and impact behaviour
// stay UNVERIFIED until mass and duty data exist.
function buildSafetyDevices(){
 for(const sign of [-1,1]){
  // Fixed rack beside each lead screw: X122.5…125.0, Y-10…6, Z6…83. Teeth stop
  // at Z83 so nothing fixed enters the stored tray envelope (floor Z86) west of
  // X122; the top plate reaches over the screw to the side spine. Both gaps
  // avoid the nut and guide arms, the belt run and the bearing blocks
  // (verify-safety-devices).
  box(scene,2.5,77,16,sign*123.75,44.5,2,silver).name='pawl-rack-'+(sign>0?'right':'left');
  for(let z=8;z<=80;z+=4)box(scene,2.3,2,16,sign*121.35,z,2,silver);
  screwHead(scene,sign*123.75,7,8);screwHead(scene,sign*123.75,7,-4);
  box(scene,13.8,7,16,sign*132.1,91.5,2,silver);
  screwHead(scene,sign*137,95,4);
  // Carriage pawl: a fixed bracket carries the pivot outboard of the tooth
  // tips (bracket stays west of X120.2 for the whole stroke), the hooked claw
  // hangs from it and drops onto the tooth upper faces on power loss. The
  // holding solenoid is a placeholder mounted on the bracket face.
  box(liftGroup,2.2,2.6,1.6,sign*118.1,38,2,silver);
  cylinder(liftGroup,1,6,sign*119.2,38,2,dark,'y');
  box(liftGroup,2.8,7,4,sign*118.1,44.5,2,dark);
  const pawl=new THREE.Group();pawl.position.set(sign*119.2,38,2);liftGroup.add(pawl);
  box(pawl,2.4,16,1.6,1.2,-8,0,silver);
  pawl.userData.pawlSign=sign;pawlPivots.push(pawl);
  // Service prop hinged at the inner wall; stowed vertical, swung out flat
  // beneath the carriage beams when the maintenance cover is opened.
  const prop=new THREE.Group();prop.position.set(sign*146,27,-22);scene.add(prop);
  box(prop,40,2,16,-sign*20,0,0,silver);
  prop.rotation.y=sign*Math.PI/2;serviceProps.push(prop);
 }
 // Fail-safe brake disc between the M1 output pulley and the motor body,
 // on fixed brackets clear of the belt run.
 cylinder(scene,6,5,0,16,64,dark,'x').name='brake-disc';
 ring(scene,6.4,8.2,6,0,16,64,silver,'x').name='brake-armature';
 for(const x of [-8,8])box(scene,2,7.5,4,x,9.75,50,silver);
 // Interlock demo prop: a translucent marker hovering over the take area.
 // It slides in only while the obstacle interlock is simulated and carries no
 // mechanical meaning — the real machine stops on its sensors instead.
 obstacleDemo=new THREE.Group();scene.add(obstacleDemo);obstacleDemo.visible=false;
 box(obstacleDemo,56,22,28,0,205,15,material(0x8a2f2f,{transparent:true,opacity:.5})).name='obstacle-block';
}
function bellowsGeometry(q){
 const perimeter=[],r=4,hw=142,hd=100;
 perimeter.push(...guardPerimeter(hw,hd,r));
 const pos=[],idx=[],rings=32,leg=Math.hypot(2.6,15/32);
 for(let j=0;j<=rings;j++)for(const p of perimeter){
  const drop=bellowsRearDrop(p.y),base={x:p.x,y:p.y,z:76-drop+q.lift},top=Mechanism.transformPoint(p.x,p.y,91-drop,q),t=j/rings,dist=Math.hypot(top.y-base.y,top.z-base.z);
  // The last pleat returns inward beneath the continuous upper flange.
  const amp=Math.sqrt(Math.max(0,leg*leg-(dist/rings)**2)),fold=j%2?amp*(j===rings-1?-1:1):0,n=Math.hypot(p.x/hw,p.y/hd),nx=(p.x/hw)/n,ny=(p.y/hd)/n;
  // Fold displacement is perpendicular to the local expansion axis, so every
  // sampled half-fold keeps its developed length as the top frame rotates.
  const dy=top.y-base.y,dz=top.z-base.z,dot=ny*dy/(dist*dist),fy=ny-dot*dy,fz=-dot*dz,nn=Math.hypot(nx,fy,fz);
  pos.push(p.x+nx/nn*fold,base.z+dz*t+fz/nn*fold,-(base.y+dy*t+fy/nn*fold));
 }
 const n=perimeter.length;for(let j=0;j<rings;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n,d=(j+1)*n+i,e=(j+1)*n+(i+1)%n;idx.push(a,b,d,b,e,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function cableCurve(lift){
 const z=33+lift/2,path=new THREE.CurvePath();path.add(new THREE.LineCurve3(new THREE.Vector3(96,80,68),new THREE.Vector3(96,z,68)));
 const pts=[];for(let i=0;i<=40;i++){const a=Math.PI+Math.PI*i/40;pts.push(new THREE.Vector3(102+6*Math.cos(a),z+6*Math.sin(a),68));}
 for(let i=1;i<pts.length;i++)path.add(new THREE.LineCurve3(pts[i-1],pts[i]));path.add(new THREE.LineCurve3(new THREE.Vector3(108,z,68),new THREE.Vector3(108,82+lift,68)));return path;
}
function hingeCableCurve(q){
 const end=Mechanism.transformPoint(108,-68,89,q),start=new THREE.Vector3(108,82+q.lift,68);
 const pts=[start,new THREE.Vector3(104,74+q.lift,77),new THREE.Vector3(104,82+q.lift,88),mechanicalToThree(end)];
 return new THREE.CatmullRomCurve3(pts);
}
function updateLowBox(q){
 liftGroup.position.y=q.lift;tiltPivot.position.y=100+q.lift;tiltPivot.rotation.x=q.tilt;pullBar.position.z=-q.frontY;
 const points=Mechanism.coverPath(q),a=filmMesh.geometry.attributes.position;
 points.forEach((v,i)=>{a.setXYZ(i*2,-127,v.z,-v.y);a.setXYZ(i*2+1,127,v.z,-v.y);});a.needsUpdate=true;filmMesh.geometry.computeVertexNormals();filmMesh.geometry.computeBoundingSphere();
 filmEdges.forEach((line,k)=>{const a=line.geometry.attributes.position;points.forEach((v,i)=>a.setXYZ(i,k===0?-127:127,v.z,-v.y));a.needsUpdate=true;line.geometry.computeBoundingSphere();});
 filmRoll.scale.set(q.rollRadius,1,q.rollRadius);reelGroup.rotation.x=-q.rollAngle;cassetteShell.visible=!cut;
 screws.forEach(s=>s.rotation.y=q.lift/2*Math.PI*2);driveGears.forEach((g,i)=>g.rotation.x=(i?-1:1)*q.retract/3);
 shellParts.forEach(s=>s.visible=!cut);fixedGuards.forEach(s=>s.visible=!cut);frontBrand.visible=!cut;advanceMoving.forEach(s=>s.visible=!cut);bellowsMesh.visible=!cut;
 bellowsMesh.geometry.dispose();bellowsMesh.geometry=bellowsGeometry(q);
 const cable=scene.getObjectByName('harness');cable.geometry.dispose();cable.geometry=new THREE.TubeGeometry(cableCurve(q.lift),48,1.1,8,false);
 hingeCable.geometry.dispose();hingeCable.geometry=new THREE.TubeGeometry(hingeCableCurve(q),32,1.1,8,false);
 // Pawls hang engaged only while power is lost; props stay folded until the
 // maintenance interlock opens. Both are fail-safe displays, not validated
 // retention behaviour.
 pawlPivots.forEach(g=>g.rotation.y=g.userData.pawlSign*(powerLost?0:.12));
 serviceProps.forEach(g=>g.rotation.y=Math.sign(g.position.x)*(serviceOpen?0:Math.PI/2));
 window.advancedScene={tiltPivot,tiltGroup,liftGroup,camRollers,bellowsMesh,pawlPivots,serviceProps};
}
function drawLowSection(q){
 const canvas=$('sectionCanvas');if(!canvas)return;const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio,2);canvas.width=w*dpr;canvas.height=h*dpr;
 const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);const s=Math.min((w-70)/280,(h-35)/245),ox=w*.46,oy=h-18,xy=(y,z)=>[ox+y*s,oy-z*s];
 const line=(pts,color='#666',width=1)=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...xy(p.y,p.z)):c.moveTo(...xy(p.y,p.z)));c.strokeStyle=color;c.lineWidth=width;c.stroke();};
 line([{y:-111,z:110},{y:-111,z:3},{y:111,z:3},{y:111,z:110}],'#222',4);
 line(Mechanism.camCenterline(100),'#aaa',8*s);line(Mechanism.camCenterline(100),'#fff',5*s);
 line([{y:-82,z:100+q.lift},q.cam],'#222',2);
 line([{y:-106.5,z:8+q.lift},{y:-106.5,z:80+q.lift}]);line([{y:106.5,z:8+q.lift},{y:106.5,z:80+q.lift}]);
 line([{y:-98,z:98},{y:74,z:98}].map(p=>Mechanism.transformPoint(0,p.y,p.z,q)),'#777',5);
 line(Mechanism.coverPath(q).map(p=>Mechanism.transformPoint(0,p.y,p.z,q)),'#222',1.5);
 const reel=Mechanism.transformPoint(0,72,66,q);c.beginPath();c.arc(...xy(reel.y,reel.z),18*s,0,Math.PI*2);c.strokeStyle='#888';c.lineWidth=1;c.stroke();
 c.font='11px "Microsoft YaHei",sans-serif';c.fillStyle='#777';c.fillText('升程 '+q.lift.toFixed(0)+' mm · 倾角 '+q.tiltDegrees.toFixed(1)+'° · 主槽联动',12,18);
}
