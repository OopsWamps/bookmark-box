/* Mechanical axes: X right, Y rearward, Z upward; millimetres. */
const Mechanism=(()=>{
 const D=Object.freeze({boxW:300,boxD:222,boxH:110,wall:3,floor:6,trayWidth:244,trayDepth:172,trayY:-12,trayZ:98,lift:60,lidWidth:254,filmThickness:.3,filmLength:360,coverSpan:184,coverZ:106,guideY:92,guideZ:94,guideRadius:12,spoolY:86,spoolZ:32,coreRadius:14,cassetteRadius:18,screwX:129,screwY:-18,guideRodY:40,threadBottom:22,threadTop:98,nutZ:30,nutHeight:10,bearingBottom:14,bearingTop:22,spineInner:136,bearingOuter:138,skirtX:145.8,skirtY:106.5,skirtBottom:8,skirtTop:88,beltX:142,beltOuter:144,skirtThickness:.8,sideGuardTop:110});
 const clamp=v=>Math.max(0,Math.min(1,v));const ease=v=>{v=clamp(v);return v*v*(3-2*v);};
 function rollGeometry(retract){
  const dy=D.spoolY-D.guideY,dz=D.spoolZ-D.guideZ,d=Math.hypot(dy,dz),flat=D.coverSpan-retract;
  let radius=14.5,arc,tangent,nY,nZ,theta,wound;
  for(let i=0;i<24;i++){
   const u=(12-radius)/d,v=Math.sqrt(1-u*u);
   nY=u*dy/d+v*(-dz/d);nZ=u*dz/d+v*dy/d;theta=Math.atan2(nZ,nY);
   arc=12*(Math.PI/2-theta);tangent=Math.sqrt(d*d-(12-radius)**2);wound=360-flat-arc-tangent;
   radius=Math.sqrt(14*14+.3*wound/Math.PI);
  }
  return {rollRadius:radius,rollDiameter:2*radius,flatLength:flat,arcLength:arc,tangentLength:tangent,woundLength:wound,nY,nZ,contactAngle:theta};
 }
 const initial=rollGeometry(0).rollRadius;
 function pose(progress){
  const p=clamp(progress),lift=D.lift*ease(p/.36),retract=D.coverSpan*ease((p-.36)/.64),r=rollGeometry(retract);
  return {p,lift,retract,...r,trayZ:D.trayZ+lift,coverZ:D.coverZ+lift,frontY:D.guideY-D.coverSpan+retract,nutZ:D.nutZ+lift,cassetteBottom:D.spoolZ-D.cassetteRadius+lift,cassetteTop:D.spoolZ+D.cassetteRadius+lift,skirtBottom:D.skirtBottom+lift,skirtOverlap:D.boxH-D.skirtBottom-lift,
   rollAngle:2*Math.PI*(r.rollRadius-initial)/.3,
   guideContact:{y:D.guideY+12*r.nY,z:D.guideZ+lift+12*r.nZ},
   spoolContact:{y:D.spoolY+r.rollRadius*r.nY,z:D.spoolZ+lift+r.rollRadius*r.nZ},
   phase:p===0?0:p<.36?1:p<=.36000001?2:p<1?3:4};
 }
 function coverPath(q){
  const points=[{y:q.frontY,z:q.coverZ},{y:D.guideY,z:q.coverZ}];
  for(let i=1;i<=40;i++){const a=Math.PI/2+(q.contactAngle-Math.PI/2)*i/40;points.push({y:D.guideY+12*Math.cos(a),z:D.guideZ+q.lift+12*Math.sin(a)});}
  points.push(q.spoolContact);return points;
 }
 return {D,pose,coverPath};
})();
if(typeof module!=='undefined')module.exports=Mechanism;
