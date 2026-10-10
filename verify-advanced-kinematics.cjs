// Independent checks of the implemented single-input advanced motion. No physical safety certification.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {D,advancedConstants:A,pose,coverPath,transformPoint,camAtLift,camCenterline,rollGeometry}=require('./advanced-kinematics.js');
const close=(a,b,m)=>assert(Math.abs(a-b)<1e-8,m+': '+a+' vs '+b);
assert.deepEqual([D.boxW,D.boxD,D.boxH],[300,222,110]);
assert.equal(D.spoolY,72);assert.equal(D.spoolZ,66);
assert.equal(A.slotOuterOffset,8.15);assert(A.backupSlotWidth>A.slotWidth,'backup is clearanced rather than a second rigid cam constraint');
assert.equal(A.backupSlotWidth,12.6);assert.equal(A.masterSide,1);assert.equal(A.backupSide,-1);
assert.equal(camCenterline(100).length,101);close(camCenterline(100)[0].z,35,'cam start');
let minRadius=Infinity,maxPressure=0,rearMax=-Infinity,minFrontGap=Infinity,maxLengthError=0;
for(let i=0;i<=6000;i++){
 const lift=i/100,q={lift,tilt:camAtLift(lift).tilt},c=camAtLift(lift);
 const expectedY=-82+65*Math.sin(q.tilt),expectedZ=100+lift-65*Math.cos(q.tilt);
 close(c.y,expectedY,'cam closure y');close(c.z,expectedZ,'cam closure z');
 const camLocal=transformPoint(0,D.pivotY,D.pivotZ-D.camArm,q);
 close(camLocal.y,c.y,'rigid cam arm y');close(camLocal.z,c.z,'rigid cam arm z');
 if(lift<=8)close(q.tilt,0,'clearance dwell');
 const front=transformPoint(0,-106.5,91,q),reel=transformPoint(0,72,66,q);
 minFrontGap=Math.min(minFrontGap,front.z-(80+lift));rearMax=Math.max(rearMax,reel.y+18);
 assert(c.z-A.slotOuterOffset>6&&c.z+A.slotOuterOffset<110,'fixed cam plate clears floor and shell height');
 assert(c.z-(A.backupSlotWidth/2+A.slotWall)>6&&c.z+(A.backupSlotWidth/2+A.slotWall)<110,'backup wider slot plate clears floor and shell height');
 assert(front.z>80+lift+3,'front hard hood keeps over 3 mm clearance from vertical collar');
 assert(reel.y+18<105.3,'tilting reel clears rear sleeve');
 minRadius=Math.min(minRadius,c.radius);maxPressure=Math.max(maxPressure,c.pressureAngle*180/Math.PI);
 assert(c.radius>A.slotHalfWidth,'slot wall offset has no planar cusp');
 assert(Math.abs(c.normalY*c.dy+c.normalZ*c.dz)<1e-9,'cam normal perpendicular to tangent');
}
for(let i=0;i<=2000;i++){
 const q=pose(i/2000),r=rollGeometry(q.retract);
 assert(q.lift>=0&&q.lift<=60);assert(q.tilt>=0&&q.tilt<=20*Math.PI/180);assert(q.retract>=0&&q.retract<=184);
 if(q.retract>0){close(q.lift,60,'film only opens at upper lift stop');close(q.tiltDegrees,20,'film only opens at upper tilt stop');}
 const length=r.flatLength+r.arcLength+r.tangentLength+Math.PI*(r.rollRadius*r.rollRadius-14*14)/.3;
 close(length,360,'film length conserved');maxLengthError=Math.max(maxLengthError,Math.abs(length-360));
 assert(r.rollDiameter<34,'film coil fits cassette');
 assert(q.nutZ-5>=25&&q.nutZ+5<=95,'lead nut end margins');assert(q.skirtOverlap>=42,'vertical skirt overlap');
 const g=q.guideContact,s=q.spoolContact;
 close((g.y-92)*(s.y-g.y)+(g.z-94)*(s.z-g.z),0,'guide tangent');
 close((s.y-72)*(s.y-g.y)+(s.z-66)*(s.z-g.z),0,'spool tangent');
 const points=coverPath(q);close(points[0].z,106,'film local path does not double lift');
 for(const point of points){const world=transformPoint(0,point.y,point.z,q);assert(Number.isFinite(world.y)&&Number.isFinite(world.z));}
 const a=transformPoint(0,-92,106,q),b=transformPoint(0,92,106,q);close(Math.hypot(a.y-b.y,a.z-b.z),184,'rigid path stays full length when tilted');
}
close(pose(0).tiltDegrees,0,'flat closed');close(pose(.36).tiltDegrees,20,'display tilt');close(pose(1).frontY,92,'fully open front');
const independentPath='output/高级版-几何校核.json';
if(fs.existsSync(independentPath)){
 const r=JSON.parse(fs.readFileSync(independentPath,'utf8'));
 close(rearMax,r.reel.maximumTiltedRearExtent,'independent planar reel check');close(minFrontGap,r.frontGuardMinimumSleeveGap,'independent planar hood check');
 close(pose(0).rollDiameter,r.film.closed.diameter,'independent closed roll');close(pose(1).rollDiameter,r.film.open.diameter,'independent open roll');
 assert(Math.abs(minRadius-r.cam.minimumCenterlineRadius)<.02,'independent numerical cam curvature');
 assert(Math.abs(maxPressure-r.cam.maximumPressureDegrees)<.02,'independent pressure angle');
}
const result={liftSamples:6001,animationSamples:2001,minimumCamCenterlineRadius:minRadius,minimumCamWallOffsetRadius:minRadius-5.15,maximumPressureDegrees:maxPressure,minimumFrontCollarGap:minFrontGap,maximumReelRearExtent:rearMax,closedFilmDiameter:pose(0).rollDiameter,openFilmDiameter:pose(1).rollDiameter,maximumFilmLengthError:maxLengthError,scope:'Analytical selected envelopes, cam closure/offset and film conservation; final 3D collisions, tolerance, load, braking, access and endurance need physical validation.'};
fs.mkdirSync('output',{recursive:true});
fs.writeFileSync('output/高级版-运动校核.json',JSON.stringify(result,null,2));
console.log('PASS: advanced cam-linked lift and tilt, 6001 lift samples and 2001 full animation samples.');
console.log(JSON.stringify(result,null,2));
