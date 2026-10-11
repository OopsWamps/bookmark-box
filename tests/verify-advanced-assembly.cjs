// Selected assembly envelopes and actual guide-arm mesh attachment checks.
// This is not complete solid-body collision,
// load, tolerance, manufacturing, safeguarding, or endurance verification.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../assets/three.min.js');
const M = require('../advanced-kinematics.js');
const source = fs.readFileSync('advanced-renderer.js', 'utf8');
const parts = [];
const mat = new THREE.MeshBasicMaterial();
const ctx = {
  THREE, Mechanism: M, pose: M.pose, scene: new THREE.Group(), window: {},
  silver: mat, dark: mat, white: mat, rubber: mat, glass: mat,
  drivePulleys: [], driveGears: [], screws: [], shellParts: [], fixedGuards: [],
  partTag: null, tagMesh: m => m,
  material: () => mat, makeCards: () => {}, screwHead: () => {},
  verticalBelt: () => {}, xBearingPlate: () => {},
  spurGear: () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat),
  cableCurve: () => new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 1, 0)),
  polylineCurve: points => {
    const c = new THREE.CurvePath();
    for (let i = 1; i < points.length; i++) c.add(new THREE.LineCurve3(points[i - 1], points[i]));
    return c;
  },
};
function primitive(parent, info, w = 1, h = 1, d = 1) {
  const obj = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  obj.position.set(info.x || 0, info.z || 0, -(info.y || 0));
  obj.userData = info;
  parent.add(obj); parts.push(obj); return obj;
}
ctx.box = (p, w, h, d, x, z, yy) => primitive(p, {kind: 'box', w, h, d, x, y: -yy, z}, w, h, d);
ctx.cylinder = (p, r, h, x, z, yy, m, axis = 'y') => primitive(p, {kind: 'cylinder', r, h, x, y: -yy, z, axis});
ctx.ring = (p, inner, outer, h, x, z, yy, m, axis = 'y') => primitive(p, {kind: 'ring', inner, outer, h, x, y: -yy, z, axis});
ctx.boredBlock = (p, w, h, d, x, z, yy) => primitive(p, {kind: 'boredBlock', w, h, d, x, y: -yy, z});
ctx.roundedShell = (p, w, d, bottom, top, t, r) => primitive(p, {kind: 'shell', w, d, bottom, top, t, r});
ctx.ribbonMesh = () => new THREE.Mesh(new THREE.BufferGeometry(), mat);
vm.createContext(ctx);
// Use the production annular solid for the guide sleeve. A unit-box stand-in
// would miss its curved outside surface and could falsely claim an attachment.
const sharedRenderer=fs.readFileSync('lowbox-renderer.js','utf8');
vm.runInContext(sharedRenderer.slice(sharedRenderer.indexOf('function ring('),sharedRenderer.indexOf('function boredBlock(')),ctx);
const productionRing=ctx.ring;
ctx.ring=(parent,inner,outer,h,x,z,yy,material,axis='y')=>{
  const obj=productionRing(parent,inner,outer,h,x,z,yy,material,axis);
  obj.userData={kind:'ring',inner,outer,h,x,y:-yy,z,axis};parts.push(obj);return obj;
};
vm.runInContext(source + '\nbuildAdvancedParts(); window.capture={liftGroup,tiltGroup,bellowsGeometry,cableCurve,hingeCableCurve};', ctx);
const capture = ctx.window.capture;
const boxes = group => parts.filter(p => p.parent === group && p.userData.kind === 'box').map(p => p.userData);
const rings = group => parts.filter(p => p.parent === group && p.userData.kind === 'ring').map(p => p.userData);
const cylinders = group => parts.filter(p => p.parent === group && p.userData.kind === 'cylinder').map(p => p.userData);
const eps = 1e-7;
const near = (a, b) => Math.abs(a - b) < eps;
function find(list, predicate, name) {const p = list.find(predicate); assert(p, name + ' is present in renderer'); return p;}
const cBoxes = boxes(capture.liftGroup), tBoxes = boxes(capture.tiltGroup);
const cRings = rings(capture.liftGroup), tRings = rings(capture.tiltGroup);
const tCylinders = cylinders(capture.tiltGroup);
const innerEar = find(cRings, p => near(p.x,120.5) && near(p.outer,5) && near(p.z,100), 'inner round ear');
const outerEar = find(cRings, p => near(p.x,128.5) && near(p.outer,5) && near(p.z,100), 'outer round ear');
const pillar = find(cBoxes, p => near(p.x,120.5) && near(p.y,-76) && near(p.z,91), 'rear inner pillar');
const rearBar = find(cBoxes, p => near(p.x,124) && near(p.z,102) && near(p.w,11), 'rear fork bar');
const connector = find(tBoxes, p => near(p.x,122) && near(p.y,-62) && near(p.z,89), 'rearward tilted frame connector');
const tongue = find(tBoxes, p => near(p.x,125.5) && near(p.y,-72) && near(p.z,89), 'tilted longitudinal tongue');
const m2 = find(tCylinders, p => near(p.x,121) && near(p.y,-92) && near(p.z,93) && near(p.r,6), 'M2 motor');
const wheel = find(tRings, p => near(p.x,132) && near(p.y,-82) && near(p.z,35) && near(p.outer,5), 'cam roller');
const stud = find(tCylinders, p => near(p.x,130.1) && near(p.z,35) && near(p.r,1.5), 'roller shoulder stud');
const innerHead = find(tCylinders, p => near(p.x,123.2) && near(p.z,35) && near(p.r,2.6), 'stud inner retaining head');
const outerHead = find(tCylinders, p => near(p.x,136.25) && near(p.z,35) && near(p.r,2.6), 'stud outer retaining head');
const axle = find(tCylinders, p => near(p.x,126) && near(p.z,100) && near(p.r,2), 'front pivot axle');
const carriageClip = find(cBoxes, p => near(p.x,108) && near(p.y,-68) && near(p.z,82), 'carriage strain relief');
const carriageClipTab = find(cBoxes, p => near(p.x,110.5) && near(p.y,-68) && near(p.z,82), 'carriage strain-relief tab');
const tiltClip = find(tBoxes, p => near(p.x,108) && near(p.y,-68) && near(p.z,89), 'tilt strain relief');
const tiltClipTab = find(tBoxes, p => near(p.x,110.5) && near(p.y,-68) && near(p.z,89), 'tilt strain-relief tab');
const fixedBoxes = boxes(ctx.scene);
const fixedCablePost = find(fixedBoxes, p => near(p.h,74) && near(p.d,3) && near(p.y,-103), 'fixed cable support post');
const fixedCableBeam = find(fixedBoxes, p => near(p.h,3) && near(p.d,37) && near(p.y,-86.5), 'fixed cable support beam');
// The rear guide arm previously ended five mm behind the carriage stem. Check
// actual chamfered surfaces, including the sleeve's annulus, at both ends of
// the added bridge rather than accepting bounding-box contact as a joint.
ctx.scene.updateMatrixWorld(true);
function meshSolid(mesh){
  const a=mesh.geometry.attributes.position,indices=mesh.geometry.index;
  const vertices=Array.from({length:a.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld));
  const faces=[];for(let i=0,n=indices?indices.count:a.count;i<n;i+=3)faces.push([0,1,2].map(j=>vertices[indices?indices.getX(i+j):i+j]));
  return{vertices,faces};
}
function convexPlanes(solid){
  const center=solid.vertices.reduce((sum,v)=>sum.add(v),new THREE.Vector3()).divideScalar(solid.vertices.length),planes=[],seen=new Set();
  for(const [a,b,c]of solid.faces){
    const normal=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a));if(normal.lengthSq()<1e-12)continue;
    const plane=new THREE.Plane().setFromCoplanarPoints(a,b,c);if(plane.distanceToPoint(center)>0)plane.negate();
    const key=[plane.normal.x,plane.normal.y,plane.normal.z,plane.constant].map(v=>Math.round(v*1e6)).join(',');
    if(!seen.has(key)){seen.add(key);planes.push(plane);}
  }return planes;
}
function surfaceEntersConvex(sourceSolid,targetSolid){
  const planes=convexPlanes(targetSolid);
  for(const tri of sourceSolid.faces){
    let poly=tri.map(v=>v.clone());
    for(const plane of planes){
      const out=[];for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length],da=plane.distanceToPoint(a),db=plane.distanceToPoint(b),insideA=da<=1e-8,insideB=db<=1e-8;
        if(insideA)out.push(a);if(insideA!==insideB)out.push(a.clone().lerp(b,da/(da-db)));
      }poly=out;if(poly.length<3)break;
    }
    if(poly.length<3)continue;
    const center=poly.reduce((sum,v)=>sum.add(v),new THREE.Vector3()).divideScalar(poly.length);
    if(planes.every(plane=>plane.distanceToPoint(center)<-1e-6))return true;
  }return false;
}
function meshPart(group,predicate,name){const m=parts.find(m=>m.parent===group&&predicate(m.userData));assert(m,name+' is present in renderer');return m;}
const guideBridges=[];
for(const sign of [-1,1]){
  const stem=meshPart(capture.liftGroup,p=>p.kind==='box'&&near(p.x,sign*114)&&p.h>50,'rear guide carriage stem');
  const arm=meshPart(capture.liftGroup,p=>p.kind==='box'&&near(p.x,sign*119)&&near(p.y,40),'rear guide connection arm');
  const sleeve=meshPart(capture.liftGroup,p=>p.kind==='ring'&&near(p.x,sign*129)&&near(p.y,40)&&near(p.z,30),'rear guide sliding sleeve');
  const bridge=meshPart(capture.liftGroup,p=>p.kind==='box'&&near(p.x,sign*114)&&p.y>29&&p.y<34&&p.h<10,'rear guide arm bridge');
  const bridgeSolid=meshSolid(bridge);
  assert(surfaceEntersConvex(bridgeSolid,meshSolid(stem)),'actual bridge solid joins carriage stem');
  assert(surfaceEntersConvex(bridgeSolid,meshSolid(arm)),'actual bridge solid joins rear guide arm');
  assert(surfaceEntersConvex(meshSolid(sleeve),meshSolid(arm)),'actual annular sleeve surface joins rear guide arm');
  const b=new THREE.Box3().setFromPoints(bridgeSolid.vertices);
  guideBridges.push({x0:b.min.x,x1:b.max.x,y0:-b.max.z,y1:-b.min.z,z0:b.min.y,z1:b.max.y});
}
assert(bounds(carriageClip).x1>bounds(carriageClipTab).x0,'carriage clip touches captive support tab');
assert(bounds(tiltClip).x1>bounds(tiltClipTab).x0,'tilt clip touches captive support tab');
assert(bounds(fixedCablePost).x1<96-1.1,'fixed cable clears rear vertical support post');
assert(bounds(fixedCableBeam).x1<96-1.1,'fixed cable clears horizontal support beam');
assert(innerEar.x + innerEar.h/2 <= 122, 'inner fork ends at 122');
assert(outerEar.x - outerEar.h/2 >= 127.5, 'outer fork starts at 127.5');
assert(outerEar.x + outerEar.h/2 <= 129.5, 'outer fork stays inside fixed cam plane 130');
assert(rearBar.x + rearBar.w/2 <= 129.5, 'rear bar stays inside fixed cam plane');
assert(innerHead.x - innerHead.h/2 > innerEar.x + innerEar.h/2, 'inner head clears inner pillar axially');
assert(stud.x - stud.h/2 > innerEar.x + innerEar.h/2, 'shoulder stud does not reach inner pillar');
assert(wheel.x - wheel.h/2 <= 130 && wheel.x + wheel.h/2 >= 134, 'roller spans full four-mm cam plate');
assert(outerHead.x - outerHead.h/2 >= wheel.x + wheel.h/2, 'outer head retains outer wheel face');
assert(axle.x - axle.h/2 < innerEar.x - innerEar.h/2 && axle.x + axle.h/2 > outerEar.x + outerEar.h/2, 'pivot axle passes both ears');
for (const sign of [-1,1]) {
  assert(cRings.some(p => near(p.x,sign*innerEar.x) && near(p.h,innerEar.h) && near(p.outer,innerEar.outer)), 'mirrored inner ear');
  assert(cRings.some(p => near(p.x,sign*outerEar.x) && near(p.h,outerEar.h) && near(p.outer,outerEar.outer)), 'mirrored outer ear');
  assert(tRings.some(p => near(p.x,sign*wheel.x) && near(p.h,wheel.h) && near(p.outer,wheel.outer)), 'mirrored cam roller');
}
function bounds(p) {return {x0:p.x-p.w/2,x1:p.x+p.w/2,y0:p.y-p.d/2,y1:p.y+p.d/2,z0:p.z-p.h/2,z1:p.z+p.h/2};}
function corners(p) {const b=bounds(p);return [{y:b.y0,z:b.z0},{y:b.y1,z:b.z0},{y:b.y1,z:b.z1},{y:b.y0,z:b.z1}];}
function inverse(p,q) {const dy=p.y-M.D.pivotY,dz=p.z-M.D.pivotZ-q.lift,c=Math.cos(q.tilt),s=Math.sin(q.tilt);return {y:M.D.pivotY+dy*c+dz*s,z:M.D.pivotZ-dy*s+dz*c};}
function project(poly,axis) {const v=poly.map(p=>p.y*axis.y+p.z*axis.z);return [Math.min(...v),Math.max(...v)];}
function polygonsOverlap(a,b) {
  for (const poly of [a,b]) for(let i=0;i<poly.length;i++) {
    const p=poly[i],r=poly[(i+1)%poly.length],axis={y:r.z-p.z,z:p.y-r.y};
    const x=project(a,axis),y=project(b,axis);if(x[1]<=y[0]+eps||y[1]<=x[0]+eps)return false;
  } return true;
}
function circleRectGap(center,r,p,L) {const b=bounds(p),y=Math.max(b.y0,Math.min(b.y1,center.y)),z=Math.max(b.z0+L,Math.min(b.z1+L,center.z));return Math.hypot(center.y-y,center.z-z)-r;}
function clipZ(poly,z,keepAbove) {
  const out=[];for(let i=0;i<poly.length;i++) {const a=poly[i],b=poly[(i+1)%poly.length],aa=keepAbove?a.z>=z:a.z<=z,bb=keepAbove?b.z>=z:b.z<=z;
    if(aa)out.push(a);if(aa!==bb){const t=(z-a.z)/(b.z-a.z);out.push({y:a.y+(b.y-a.y)*t,z});}}
  return out;
}
function clipX(poly,x,keepAbove) {
  const out=[];for(let i=0;i<poly.length;i++) {const a=poly[i],b=poly[(i+1)%poly.length],aa=keepAbove?a.x>=x:a.x<=x,bb=keepAbove?b.x>=x:b.x<=x;
    if(aa)out.push(a);if(aa!==bb){const t=(x-a.x)/(b.x-a.x);out.push({x,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});}}
  return out;
}
function pointSegmentDist(p,a,b) {const dy=b.y-a.y,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.y-a.y)*dy+(p.z-a.z)*dz)/(dy*dy+dz*dz||1)));return Math.hypot(p.y-a.y-t*dy,p.z-a.z-t*dz);}
function pointPolygonDist(p,poly) {
  let inside=false,best=Infinity;for(let i=0,j=poly.length-1;i<poly.length;j=i++) {const a=poly[j],b=poly[i];
    if((a.z>p.z)!==(b.z>p.z)&&p.y<(b.y-a.y)*(p.z-a.z)/(b.z-a.z)+a.y)inside=!inside;
    best=Math.min(best,pointSegmentDist(p,a,b));}
  return inside?0:best;
}
const metrics={samples:601,minimumM2RoundEarGap:Infinity,minimumM2PillarGap:Infinity,maximumForkInsideTrayY:-Infinity,minimumTongueRearBarVerticalGap:Infinity,maximumBellowsX:0,minimumBellowsSpringRadialGap:Infinity,minimumRearGuideBridgeCassetteGap:Infinity,minimumLiftCableLength:Infinity,maximumLiftCableLength:0};
for(let i=0;i<=600;i++) {
  const lift=i/10,tilt=M.angleAtLift(lift),q={lift,tilt};
  const reel=M.transformPoint(0,M.D.spoolY,M.D.spoolZ,q);
  for(const b of guideBridges){
    const y=Math.max(b.y0,Math.min(b.y1,reel.y)),z=Math.max(b.z0+lift,Math.min(b.z1+lift,reel.z));
    const gap=Math.hypot(reel.y-y,reel.z-z)-M.D.cassetteRadius;
    metrics.minimumRearGuideBridgeCassetteGap=Math.min(metrics.minimumRearGuideBridgeCassetteGap,gap);
    assert(gap>1,'rear guide bridge actual mesh envelope clears the tilted cassette');
  }
  const motor=M.transformPoint(m2.x,m2.y,m2.z,q),pivot={y:M.D.pivotY,z:M.D.pivotZ+lift};
  const roundGap=Math.hypot(motor.y-pivot.y,motor.z-pivot.z)-m2.r-innerEar.outer;
  metrics.minimumM2RoundEarGap=Math.min(metrics.minimumM2RoundEarGap,roundGap);assert(roundGap>.5,'round ear clears M2');
  const pillarGap=circleRectGap(motor,m2.r,pillar,lift);
  metrics.minimumM2PillarGap=Math.min(metrics.minimumM2PillarGap,pillarGap);assert(pillarGap>.5,'rear pillar clears M2');
  const framePoly=corners(connector).map(p=>M.transformPoint(0,p.y,p.z,q));
  const pillarPoly=corners(pillar).map(p=>({...p,z:p.z+lift}));
  const barPoly=corners(rearBar).map(p=>({...p,z:p.z+lift}));
  assert(!polygonsOverlap(framePoly,pillarPoly),'rearward tilted frame connector clears inner pillar');
  assert(!polygonsOverlap(framePoly,barPoly),'rearward tilted frame connector clears rear fork bar');
  const tonguePoly=corners(tongue).map(p=>M.transformPoint(0,p.y,p.z,q));
  const tongueGap=bounds(rearBar).z0+lift-Math.max(...tonguePoly.map(p=>p.z));
  metrics.minimumTongueRearBarVerticalGap=Math.min(metrics.minimumTongueRearBarVerticalGap,tongueGap);
  assert(tongueGap>.5,'tilted tongue remains below rear fork bar');
  assert(bounds(tongue).x0>bounds(pillar).x1,'tongue stays outside inner pillar axially');
  // Clip inverse-transformed carriage fork pieces to the tray's 92..98 slab.
  for(const p of [pillar,rearBar]) {
    const local=corners(p).map(p=>inverse({...p,z:p.z+lift},q));
    const slab=clipZ(clipZ(local,92,true),98,false);
    if(slab.length){const maxY=Math.max(...slab.map(p=>p.y));metrics.maximumForkInsideTrayY=Math.max(metrics.maximumForkInsideTrayY,maxY);assert(maxY<-65.5,'side notch to -65 clears fork slab envelope');}
  }
  // Round-ear outline has its own inverse slab envelope.
  for(let k=0;k<144;k++) {const a=k*Math.PI/72,p=inverse({y:pivot.y+5*Math.cos(a),z:pivot.z+5*Math.sin(a)},q);
    if(p.z>=92&&p.z<=98)assert(p.y<-65.5,'side notch clears round ear');}
  const cam=M.camAtLift(lift),roller=M.transformPoint(132,-82,35,q);
  assert(Math.hypot(cam.y-roller.y,cam.z-roller.z)<1e-8,'cam roller follows fixed slot centerline');
  const liftCable=capture.cableCurve(lift),hinge=capture.hingeCableCurve(q);
  const a0=liftCable.getPoint(0),a1=liftCable.getPoint(1),h0=hinge.getPoint(0),h1=hinge.getPoint(1),hc=M.transformPoint(108,-68,89,q);
  assert(a0.distanceTo(new THREE.Vector3(96,80,68))<1e-8,'U-loop fixed end matches fixed clip');
  assert(a1.distanceTo(new THREE.Vector3(108,82+lift,68))<1e-8,'U-loop moving end matches carriage clip');
  assert(h0.distanceTo(a1)<1e-8,'hinge flex begins at same carriage clip');
  assert(h1.distanceTo(new THREE.Vector3(hc.x,hc.z,-hc.y))<1e-8,'hinge flex ends at supported tilted clip');
  const cableLength=liftCable.getLength();
  metrics.minimumLiftCableLength=Math.min(metrics.minimumLiftCableLength,cableLength);
  metrics.maximumLiftCableLength=Math.max(metrics.maximumLiftCableLength,cableLength);
  assert(Math.abs(cableLength-(96+6*Math.PI))<.01,'sampled half-circle U-loop retains nominal 114.85 mm length');
  const g=capture.bellowsGeometry(q),a=g.attributes.position,index=g.index;
  for(let k=0;k<a.count;k++)metrics.maximumBellowsX=Math.max(metrics.maximumBellowsX,Math.abs(a.getX(k)));
  // Conservative filled cylindrical spring envelope, X -141.8..-134.2/R17.
  // Clip each actual bellows triangle to the cylinder's axial band, then measure
  // the closest projected YZ distance. This covers triangle interiors, not just vertices.
  const spring=M.transformPoint(-138,72,66,q);
  for(let k=0;k<index.count;k+=3) {
    let tri=[];for(let j=0;j<3;j++){const n=index.getX(k+j);tri.push({x:a.getX(n),y:-a.getZ(n),z:a.getY(n)});}
    tri=clipX(clipX(tri,-141.8,true),-134.2,false);if(!tri.length)continue;
    const gap=pointPolygonDist(spring,tri)-17;
    metrics.minimumBellowsSpringRadialGap=Math.min(metrics.minimumBellowsSpringRadialGap,gap);
    assert(gap>.15,'bellows triangle clears conservative left spring envelope');
  }
  g.dispose();
}
assert(metrics.maximumBellowsX<145,'bellows side envelope stays inside nominal sleeve inner face 145');
assert(metrics.maximumLiftCableLength-metrics.minimumLiftCableLength<1e-8,'lift U-loop length stays constant through stroke');
assert(source.includes('const perimeter=[],r=4,hw=142,hd=100'),'bellows attachment width matches checked layout');
assert(source.includes('[115,-65]')&&source.includes('[-115,-65]'),'both front side notches extend to -65');
assert(source.includes('depth:2')&&source.includes('floor.position.y=92'),'blind pocket floor remains two mm');
for(const x of [-114,-58,0,58,114])assert(tBoxes.some(p=>near(p.x,x)&&near(p.h,6)&&near(p.d,162)),'five under-tray stiffening rails');
for(const x of [-87,-29,29,87]) {
  assert(tBoxes.some(p=>near(p.x,x+1)&&near(p.y,62.5)&&near(p.w,48)&&near(p.d,1.2)),'rear compliant positive locator');
  assert(tBoxes.some(p=>near(p.x,x-25)&&near(p.y,-12)&&near(p.w,2.1)&&near(p.d,140)),'side compliant positive locator');
}
const result={scope:'Selected assembly envelopes and actual guide-arm mesh attachments. Not a full solid collision, load, tolerance, guarding or endurance certification.',...metrics,axial:{innerForkToCrank:124-(innerEar.x+innerEar.h/2),crankToOuterFork:(outerEar.x-outerEar.h/2)-127,outerForkToFixedCam:130-(outerEar.x+outerEar.h/2),retainingHeadToInnerPillar:(innerHead.x-innerHead.h/2)-bounds(pillar).x1},pockets:{floor:2,stiffeningRails:5,retainingDirections:2}};
fs.mkdirSync('output',{recursive:true});
fs.writeFileSync('output/高级版-装配包络校核.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
