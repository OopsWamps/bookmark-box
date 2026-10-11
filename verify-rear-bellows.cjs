// Regression for the actual rendered rear bellows triangles against rear parts.
// This is a geometry-only check, with neither fabrication tolerances nor loads.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const THREE=require('./assets/three.min.js'),M=require('./advanced-kinematics.js');
const base=fs.readFileSync('lowbox-renderer.js','utf8'),source=fs.readFileSync('advanced-renderer.js','utf8');
const helpers=base.slice(0,base.indexOf('function buildLowBox(){'))+base.slice(base.indexOf('function xBearingPlate'),base.indexOf('function updateLowBox'));
const mat=new THREE.MeshBasicMaterial(),parts=[];
const ctx={THREE,Mechanism:M,D:M.D,pose:M.pose,scene:new THREE.Group(),window:{},silver:mat,dark:mat,white:mat,rubber:mat,glass:mat,screws:[],shellParts:[],material:()=>mat,makeCards:()=>{}};
ctx.box=(p,w,h,d,x,z,yy)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,z,yy);o.userData.check={kind:'box',parent:p,x,y:-yy,z,w,h,d};p.add(o);parts.push(o);return o;};
ctx.cylinder=(p,r,h,x,z,yy,m,axis='y')=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,64),mat);o.position.set(x,z,yy);if(axis==='x')o.rotation.z=Math.PI/2;o.userData.check={kind:'cylinder',parent:p,x,y:-yy,z,r,h,axis};p.add(o);parts.push(o);return o;};
vm.createContext(ctx);vm.runInContext(helpers+source+`
 const oldXPlate=xPlate,oldRing=ring,oldShell=roundedShell,oldRibbon=ribbonMesh;
 xPlate=function(parent,x,t,points,holes,mat){const o=oldXPlate(parent,x,t,points,holes,mat);o.userData.check={kind:'plate',parent,x,t,points,holes};window.parts.push(o);return o;};
 ring=function(parent,inner,outer,h,x,z,yy,mat,axis){const o=oldRing(parent,inner,outer,h,x,z,yy,mat,axis);o.userData.check={kind:'ring',parent,x,y:-yy,z,inner,outer,h,axis:axis||'y'};window.parts.push(o);return o;};
 roundedShell=function(parent,w,d,bottom,top,t,r,mat){const o=oldShell(parent,w,d,bottom,top,t,r,mat);o.userData.check={kind:'shell',parent,w,d,bottom,top,t,r};window.parts.push(o);return o;};
 ribbonMesh=function(points,width,mat){const o=oldRibbon(points,width,mat);o.userData.check={kind:'ribbon',points,width};window.parts.push(o);return o;};
 buildAdvancedParts();window.capture={liftGroup,tiltPivot,tiltGroup,bellowsGeometry,cassetteShell};
`,Object.assign(ctx,{window:{parts}}));
const C=ctx.window.capture,eps=1e-5;
function geomFaces(g){const a=g.attributes.position,i=g.index,tris=[];for(let k=0;k<(i?i.count:a.count);k+=3){const tri=[];for(let j=0;j<3;j++){const n=i?i.getX(k+j):k+j;tri.push({x:a.getX(n),y:a.getY(n),z:a.getZ(n)});}tris.push(tri);}return tris;}
function clip(poly,axis,v,sign){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],d1=sign*(a[axis]-v),d2=sign*(b[axis]-v),aa=d1>=-eps,bb=d2>=-eps;if(aa)out.push(a);if(aa!==bb){const t=d1/(d1-d2);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});}}return out;}
function clipBand(poly,axis,min,max){return clip(clip(poly,axis,min,1),axis,max,-1);}
function area(poly){let sum=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];sum+=a.x*b.y-b.x*a.y;}return Math.abs(sum)/2;}
function signedArea(poly){let sum=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];sum+=a.x*b.y-b.x*a.y;}return sum/2;}
function clip2(poly,tri){const sg=signedArea(tri)>0?1:-1;for(let k=0;k<3&&poly.length;k++){const a=tri[k],b=tri[(k+1)%3],out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dp=sg*((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)),dq=sg*((b.x-a.x)*(q.y-a.y)-(b.y-a.y)*(q.x-a.x));if(dp>=0)out.push(p);if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}}poly=out;}return poly;}
function polygonDistance(p,poly){let inside=false,best=Infinity;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));best=Math.min(best,Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy));}return inside?0:best;}
function inverse(p,q){const dy=p.y-M.D.pivotY,dz=p.z-M.D.pivotZ-q.lift,c=Math.cos(q.tilt),s=Math.sin(q.tilt);return{x:p.x,y:M.D.pivotY+dy*c+dz*s,z:M.D.pivotZ-dy*s+dz*c};}
function center(poly){return{x:poly.reduce((s,p)=>s+p.x,0)/poly.length,y:poly.reduce((s,p)=>s+p.y,0)/poly.length};}
function outlineMargin(p,poly){let inside=false,best=Infinity;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));best=Math.min(best,Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy));}return inside?best:-best;}
function triBounds(t){return{x0:Math.min(...t.map(p=>p.x)),x1:Math.max(...t.map(p=>p.x)),y0:Math.min(...t.map(p=>p.y)),y1:Math.max(...t.map(p=>p.y)),z0:Math.min(...t.map(p=>p.z)),z1:Math.max(...t.map(p=>p.z))};}
function boundsOverlap(a,b){return a.x1>=b.x0&&a.x0<=b.x1&&a.y1>=b.y0&&a.y0<=b.y1&&a.z1>=b.z0&&a.z0<=b.z1;}
function segmentTriangle(a,b,t){const p=new THREE.Vector3(a.x,a.y,a.z),d=new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z),v=t.map(v=>new THREE.Vector3(v.x,v.y,v.z)),e1=v[1].clone().sub(v[0]),e2=v[2].clone().sub(v[0]),h=d.clone().cross(e2),det=e1.dot(h);if(Math.abs(det)<1e-8)return null;const inv=1/det,s=p.clone().sub(v[0]),u=s.dot(h)*inv;if(u<=eps||u>=1-eps)return null;const q=s.clone().cross(e1),vv=d.dot(q)*inv;if(vv<=eps||u+vv>=1-eps)return null;const f=e2.dot(q)*inv;
 // Intended attachment seams occur at edge endpoints. Detect a strict crossing
 // in an edge interior, and do not count coplanar mating faces as penetration.
 return f>1e-4&&f<1-1e-4?{x:a.x+f*d.x,y:a.y+f*d.y,z:a.z+f*d.z}:null;}
function trianglesCross(a,b,ignore=()=>false){for(let i=0;i<3;i++){const p=segmentTriangle(a[i],a[(i+1)%3],b);if(p&&!ignore(p))return p;}for(let i=0;i<3;i++){const p=segmentTriangle(b[i],b[(i+1)%3],a);if(p&&!ignore(p))return p;}return null;}
function segmentDistance3(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy,p.z-a.z-t*dz);}
const targets=[];
for(const o of parts){const d=o.userData.check;if(!d)continue;
 if(d.kind==='plate'&&d.parent===C.tiltGroup&&d.holes.some(h=>h.y===72&&h.z===66)){
  targets.push({name:(d.x<0?'左':'右')+'后侧共用轴承板',kind:'plate',d,faces:geomFaces(o.geometry).filter(t=>t.every(v=>Math.abs(v.z)<eps)).map(t=>t.map(v=>({x:v.x,y:v.y})))});
 }
 if(d.kind==='cylinder'&&d.parent===C.tiltGroup&&d.y===92&&d.z===94&&d.r>10)targets.push({name:'后侧导辊',kind:'disk',d});
 if(d.kind==='ring'&&o.parent===C.cassetteShell)targets.push({name:(d.x<0?'左':'右')+'卷盒端盖',kind:'ring',d});
 if(d.kind==='ring'&&d.parent===C.tiltGroup&&d.y===72&&d.z===66&&d.outer===17)targets.push({name:'卷簧罩 '+d.x+'/'+d.h,kind:'ring',d});
 if(d.kind==='ribbon'&&o.parent===C.cassetteShell)targets.push({name:'卷盒弧形壳',kind:'ribbon',d});
 if(d.kind==='box'&&d.parent===C.tiltGroup&&d.y>70&&d.z-d.h/2>=79&&d.w>200)targets.push({name:'后罩 '+d.y+'/'+d.z,kind:'box',d});
 if(d.kind==='shell'&&d.parent===C.liftGroup)targets.push({name:'竖直裙/下环 '+d.bottom+'/'+d.top,kind:'shell',d,faces:geomFaces(o.geometry).filter(t=>t.every(v=>Math.abs(v.z)<eps)).map(t=>t.map(v=>({x:v.x,y:v.y})))});
}
ctx.scene.traverse(o=>{if(o.isMesh&&/^(rear-upper-flange|rear-lower-flange|rear-upper-clamp|rear-side-hood--?1|rear-hood-ramp|rear-corner-closure--?1--?1)$/.test(o.name))targets.push({name:o.name,kind:'surface',object:o,faces:geomFaces(o.geometry)});});
assert(targets.some(t=>t.kind==='plate')&&targets.some(t=>t.name==='后侧导辊'),'must inspect actual rear plate and guide');
const metrics=Object.fromEntries(targets.map(t=>[t.name,{hits:0,first:null,worst:0,minimumRadialGap:null}]));
function record(target,q,poly,severity,detail){const m=metrics[target.name];m.hits++;m.worst=Math.max(m.worst,severity);if(!m.first)m.first={lift:q.lift,tiltDegrees:q.tilt*180/Math.PI,...detail};}
const samples=601;
for(let k=0;k<samples;k++){
 const lift=k/10,q={lift,tilt:M.angleAtLift(lift)},g=C.bellowsGeometry(q),a=g.attributes.position,index=g.index;
 C.liftGroup.position.y=lift;C.tiltPivot.position.y=100+lift;C.tiltPivot.rotation.x=q.tilt;ctx.scene.updateMatrixWorld(true);
 const triangles=[];for(let i=0;i<index.count;i+=3){const tri=[];for(let j=0;j<3;j++){const n=index.getX(i+j);tri.push({x:a.getX(n),y:-a.getZ(n),z:a.getY(n)});}if(Math.max(...tri.map(p=>p.y))>45)triangles.push(tri);}
 const perimeterCount=a.count/33;assert(Number.isInteger(perimeterCount),'32 half-fold mesh is expected');const seams=[];
 for(const row of [0,32])for(let i=0;i<perimeterCount;i++){const n=row*perimeterCount+i,m=row*perimeterCount+(i+1)%perimeterCount;seams.push([{x:a.getX(n),y:-a.getZ(n),z:a.getY(n)},{x:a.getX(m),y:-a.getZ(m),z:a.getY(m)}]);}
 for(const target of targets){const d=target.d;
  if(target.kind==='surface'){
   const faces=target.faces.map(tri=>{const t=tri.map(v=>{const p=new THREE.Vector3(v.x,v.y,v.z).applyMatrix4(target.object.matrixWorld);return{x:p.x,y:-p.z,z:p.y};});return{t,b:triBounds(t)};});
   for(const t of triangles){const b=triBounds(t);for(const f of faces){if(!boundsOverlap(b,f.b))continue;const point=trianglesCross(t,f.t,p=>seams.some(([a,b])=>segmentDistance3(p,a,b)<1e-4));if(point){
    // A continuous clamp is meant to meet the first/last bellows perimeter.
    // Ignore only an intersection on those actual line segments (1e-4 mm),
    // not the whole endpoint triangle or a band around the nominal ring plane.
    record(target,q,t,1,{world:point});break;
   }}}continue;
  }
  for(const world of triangles){let tri=world.map(p=>target.kind==='shell'?{...p,z:p.z-lift}:inverse(p,q));
   if(target.kind==='plate'){
    tri=clipBand(tri,'x',d.x-d.t/2,d.x+d.t/2);if(tri.length<3)continue;const poly=tri.map(p=>({x:p.y,y:p.z}));
    for(const face of target.faces){const overlap=clip2(poly,face);if(!overlap.length)continue;const c=center(overlap),amount=area(overlap),span=Math.max(...overlap.map(p=>Math.hypot(p.x-c.x,p.y-c.y)));
     // Rear face triangles can project to a line in YZ while retaining a finite
     // width in X. An area-only test would miss the original plate collision.
     const margin=Math.min(outlineMargin(c,d.points.map(p=>({x:p.y,y:p.z}))),...d.holes.map(h=>Math.hypot(c.x-h.y,c.y-h.z)-h.r));
     if((amount>1e-4||span>.001)&&margin>.001){record(target,q,poly,Math.max(amount,span),{local:{x:d.x,y:c.x,z:c.y},overlapArea:amount,projectedSpan:span,materialMargin:margin});break;}}
   }else if(target.kind==='disk'||target.kind==='ring'){
    const h=d.h;tri=clipBand(tri,'x',d.x-h/2,d.x+h/2);if(tri.length<3)continue;const poly=tri.map(p=>({x:p.y,y:p.z})),gap=polygonDistance({x:d.y,y:d.z},poly)-(d.r||d.outer);
    const metric=metrics[target.name];metric.minimumRadialGap=metric.minimumRadialGap===null?gap:Math.min(metric.minimumRadialGap,gap);
    if(gap<-.001&&(!d.inner||poly.some(p=>Math.hypot(p.x-d.y,p.y-d.z)>d.inner+.001)))record(target,q,poly,-gap,{localTriangle:tri,radialPenetration:-gap});
   }else if(target.kind==='box'){
    tri=clipBand(clipBand(clipBand(tri,'x',d.x-d.w/2+.001,d.x+d.w/2-.001),'y',d.y-d.d/2+.001,d.y+d.d/2-.001),'z',d.z-d.h/2+.001,d.z+d.h/2-.001);
    if(tri.length>=3)record(target,q,tri,1,{localTriangle:tri});
   }else if(target.kind==='shell'){
    tri=clipBand(tri,'z',d.bottom+.001,d.top-.001);if(tri.length<3)continue;const poly=tri.map(p=>({x:p.x,y:-p.y}));
    for(const face of target.faces){const overlap=clip2(poly,face),amount=area(overlap);if(amount>1e-4){record(target,q,poly,amount,{carriagePlane:center(overlap),overlapArea:amount});break;}}
   }else if(target.kind==='ribbon'){
    tri=clipBand(tri,'x',-d.width/2,d.width/2);if(tri.length<3)continue;const poly=tri.map(p=>({x:p.y,y:p.z}));
    for(let j=1;j<d.points.length;j++){const a=d.points[j-1],b=d.points[j];let lo=0,hi=1;const sg=signedArea(poly)>0?1:-1;for(let i=0;i<poly.length&&lo<=hi;i++){const p=poly[i],r=poly[(i+1)%poly.length],fa=sg*((r.x-p.x)*(a.z-p.y)-(r.y-p.y)*(a.y-p.x)),fb=sg*((r.x-p.x)*(b.z-p.y)-(r.y-p.y)*(b.y-p.x));if(fa<0&&fb<0){lo=2;break;}if((fa<0)!==(fb<0)){const t=fa/(fa-fb);if(fa<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);}}
     if(hi-lo>.001&&lo<=1&&hi>=0){record(target,q,poly,(hi-lo)*Math.hypot(b.y-a.y,b.z-a.z),{local:{y:a.y+(b.y-a.y)*(lo+hi)/2,z:a.z+(b.z-a.z)*(lo+hi)/2}});break;}}
   }
  }
 }
 g.dispose();
}
const failures=Object.entries(metrics).filter(([,m])=>m.hits);
const result={scope:'601 actual bellows triangle configurations against extruded plate material faces (holes preserved), guide disk, cassette surfaces, rear rigid hood and vertical skirt. Nominal geometry only.',samples,passed:!failures.length,faceCounts:targets.filter(t=>t.faces).map(t=>({name:t.name,faces:t.faces.length})),metrics};
fs.mkdirSync('output',{recursive:true});fs.writeFileSync('output/高级版-柔性罩相交回归.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
if(failures.length){console.error('Rear bellows intersections: '+failures.map(([n])=>n).join(', '));process.exitCode=1;}
