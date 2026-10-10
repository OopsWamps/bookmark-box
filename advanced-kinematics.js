/* Advanced mechanism. Mechanical axes X right, Y rear, Z up; millimetres.
 * The lift carriage stays vertical. Only the tray/cover cassette tilts.
 * Cam slots are fixed to the box, with one locating master and one clearance backup.
 */
const Mechanism=(()=>{
 const D=Object.freeze({boxW:300,boxD:222,boxH:110,wall:3,floor:6,trayWidth:244,trayDepth:172,trayY:-12,trayZ:98,lift:60,lidWidth:254,filmThickness:.3,filmLength:360,coverSpan:184,coverZ:106,guideY:92,guideZ:94,guideRadius:12,spoolY:72,spoolZ:66,coreRadius:14,cassetteRadius:18,screwX:129,screwY:-18,guideRodY:40,threadBottom:22,threadTop:98,nutZ:30,nutHeight:10,bearingBottom:14,bearingTop:22,spineInner:136,bearingOuter:138,skirtX:145.8,skirtY:106.5,skirtBottom:8,skirtTop:80,beltX:142,beltOuter:144,skirtThickness:.8,sideGuardTop:110,pivotY:-82,pivotZ:100,camArm:65,camRoller:5,slotWidth:10.3,displayP:.36,tiltMax:20*Math.PI/180,tiltDwell:8,tiltStroke:52});
 const advancedConstants=Object.freeze({pivotY:D.pivotY,pivotZ:D.pivotZ,camArm:D.camArm,camRollerRadius:D.camRoller,slotWidth:D.slotWidth,slotWall:3,slotHalfWidth:D.slotWidth/2,slotOuterOffset:D.slotWidth/2+3,backupSlotWidth:12.6,masterSide:1,backupSide:-1,frontHoodBottom:91,collarTop:80,displayDegrees:20,dwell:8,angleRampFraction:.25,pocketWidth:52,pocketLength:152,pocketDepth:4,pocketCount:4,stackMaximum:3,pocketFloor:2,pivotAxle:'two short supported side trunnions; no through shaft across cards',constraint:'one locating master cam, opposite cam with clearance and axial float'});
 const clamp=v=>Math.max(0,Math.min(1,v));
 const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
 // Integral of a velocity curve with quarter-stroke half-cosine acceleration/deceleration.
 // C2 position profile: zero angular speed and acceleration at either end of the tilt segment.
 function angleMotion(t){
  t=clamp(t);const b=.25,v=1/(1-b);
  if(t===0||t===1)return t;
  if(t<b)return v/2*(t-b/Math.PI*Math.sin(Math.PI*t/b));
  if(t<=1-b)return v*(t-b/2);
  return 1-angleMotion(1-t);
 }
 function angleDerivatives(t){
  if(t<=0||t>=1)return {position:clamp(t),velocity:0,acceleration:0};
  const b=.25,v=1/(1-b);
  if(t<b)return {position:angleMotion(t),velocity:v/2*(1-Math.cos(Math.PI*t/b)),acceleration:v*Math.PI/(2*b)*Math.sin(Math.PI*t/b)};
  if(t<=1-b)return {position:angleMotion(t),velocity:v,acceleration:0};
  const r=angleDerivatives(1-t);return {position:1-r.position,velocity:r.velocity,acceleration:-r.acceleration};
 }
 const angleAtLift=lift=>D.tiltMax*angleMotion((Math.max(0,Math.min(D.lift,lift))-D.tiltDwell)/D.tiltStroke);
 function transformPoint(x,y,z,q){
  const c=Math.cos(q.tilt),s=Math.sin(q.tilt),ry=y-D.pivotY,rz=z-D.pivotZ;
  return {x,y:D.pivotY+ry*c-rz*s,z:D.pivotZ+q.lift+ry*s+rz*c};
 }
 function camAtLift(lift){
  lift=Math.max(0,Math.min(D.lift,lift));const tilt=angleAtLift(lift),a=angleDerivatives((lift-D.tiltDwell)/D.tiltStroke);
  const da=D.tiltMax*a.velocity/D.tiltStroke,dda=D.tiltMax*a.acceleration/(D.tiltStroke*D.tiltStroke),c=Math.cos(tilt),s=Math.sin(tilt);
  const dy=D.camArm*c*da,dz=1+D.camArm*s*da,ddy=D.camArm*(c*dda-s*da*da),ddz=D.camArm*(s*dda+c*da*da),speed=Math.hypot(dy,dz);
  const curvature=(dy*ddz-dz*ddy)/(speed*speed*speed);
  const torqueProjection=(c*dz-s*dy)/speed;
  return {lift,tilt,tiltDegrees:tilt*180/Math.PI,y:D.pivotY+D.camArm*s,z:D.pivotZ+lift-D.camArm*c,dy,dz,ddy,ddz,curvature,radius:Math.abs(curvature)>1e-12?1/Math.abs(curvature):Infinity,normalY:-dz/speed,normalZ:dy/speed,pressureAngle:Math.acos(Math.max(-1,Math.min(1,torqueProjection)))};
 }
 function camCenterline(n=240){n=Math.max(2,Math.round(n));return Array.from({length:n+1},(_,i)=>camAtLift(D.lift*i/n));}
 function rollGeometry(retract){
  retract=Math.max(0,Math.min(D.coverSpan,retract));
  const dy=D.spoolY-D.guideY,dz=D.spoolZ-D.guideZ,d=Math.hypot(dy,dz),flat=D.coverSpan-retract;
  let radius=15,arc,tangent,nY,nZ,theta,wound;
  for(let i=0;i<50;i++){
   const u=(D.guideRadius-radius)/d,v=Math.sqrt(1-u*u);
   nY=u*dy/d-v*dz/d;nZ=u*dz/d+v*dy/d;theta=Math.atan2(nZ,nY);
   arc=D.guideRadius*(Math.PI/2-theta);tangent=Math.sqrt(d*d-(D.guideRadius-radius)**2);wound=D.filmLength-flat-arc-tangent;
   radius=Math.sqrt(D.coreRadius*D.coreRadius+D.filmThickness*wound/Math.PI);
  }
  return {rollRadius:radius,rollDiameter:2*radius,rollRadiusDiameter:2*radius,flatLength:flat,arcLength:arc,tangentLength:tangent,woundLength:wound,nY,nZ,contactAngle:theta};
 }
 const initial=rollGeometry(0).rollRadius;
 function pose(progress){
  const p=clamp(progress),lift=D.lift*ease(p/D.displayP),tilt=angleAtLift(lift),retract=D.coverSpan*ease((p-D.displayP)/(1-D.displayP)),r=rollGeometry(retract);
  const q={p,lift,tilt,tiltDegrees:tilt*180/Math.PI,retract,...r,frontY:D.guideY-D.coverSpan+retract,nutZ:D.nutZ+lift,skirtBottom:D.skirtBottom+lift,skirtOverlap:D.boxH-D.skirtBottom-lift,rollAngle:2*Math.PI*(r.rollRadius-initial)/D.filmThickness,
   guideContact:{y:D.guideY+D.guideRadius*r.nY,z:D.guideZ+D.guideRadius*r.nZ},spoolContact:{y:D.spoolY+r.rollRadius*r.nY,z:D.spoolZ+r.rollRadius*r.nZ},
   phase:p===0?0:p<D.displayP?1:p<=D.displayP+.00000001?2:p<1?3:4};
  q.cam=camAtLift(lift);q.pivotWorld={x:0,y:D.pivotY,z:D.pivotZ+lift};
  q.trayWorld=transformPoint(0,D.trayY,D.trayZ,q);q.trayZ=q.trayWorld.z;
  q.coverWorld=transformPoint(0,D.trayY,D.coverZ,q);q.coverZ=q.coverWorld.z;
  q.spoolWorld=transformPoint(0,D.spoolY,D.spoolZ,q);q.cassetteBottom=q.spoolWorld.z-D.cassetteRadius;q.cassetteTop=q.spoolWorld.z+D.cassetteRadius;
  q.guideWorldContact=transformPoint(0,q.guideContact.y,q.guideContact.z,q);q.spoolWorldContact=transformPoint(0,q.spoolContact.y,q.spoolContact.z,q);
  return q;
 }
 // Entire film path in the rigid cassette's local mechanical frame.
 function coverPath(q){
  const points=[{y:q.frontY,z:D.coverZ},{y:D.guideY,z:D.coverZ}];
  for(let i=1;i<=40;i++){const a=Math.PI/2+(q.contactAngle-Math.PI/2)*i/40;points.push({y:D.guideY+D.guideRadius*Math.cos(a),z:D.guideZ+D.guideRadius*Math.sin(a)});}
  points.push(q.spoolContact);return points;
 }
 return {D,advancedConstants,clamp,ease,angleMotion,angleAtLift,camAtLift,camCenterline,rollGeometry,pose,coverPath,transformPoint};
})();
if(typeof module!=='undefined')module.exports=Mechanism;
