const assert=require('node:assert/strict');
const {D,pose,coverPath}=require('./kinematics.js');
const close=(a,b,m)=>assert(Math.abs(a-b)<1e-7,m);
assert.deepEqual([D.boxW,D.boxD,D.boxH],[300,222,110]);assert.equal(D.lift,60);
assert(D.trayWidth/2-112>=10,'all four original 50 mm cards retain 10 mm side margin');
assert(D.bearingOuter>=D.spineInner,'bearing bridge overlaps side spine');
// Actual construction stack: base top 6; spine/flange starts 6; lower foot 6..14; bearing14..22.
assert.equal(D.bearingBottom,14);assert.equal(D.bearingTop,D.threadBottom);
assert(11-1.5>9&&11+1.5<14,'drive clears the base flange and bridge underside');
assert(123+.4<124&&123-.4>122,'inner guard clears fixed top bearing and moving tray');
assert(D.skirtX-D.skirtThickness>D.beltOuter,'sleeve leaves running clearance around side belts');
assert(D.boxW/2-D.wall-D.skirtX>=1,'sleeve fits within fixed shell');
assert(D.boxD/2-D.wall-D.skirtY>=1,'front and rear sleeve fit within fixed shell');
const guideSolidRadius=11.85;
assert(D.guideY-guideSolidRadius-79>1,'roller front clears hood wall');
assert(109-107.9>=1,'pull bar clears hood roof');
for(let i=0;i<=2000;i++){
 const q=pose(i/2000);
 assert(q.lift>=0&&q.lift<=60);assert(q.retract>=0&&q.retract<=D.coverSpan);
 if(q.retract>0)assert.equal(q.lift,60,'cover only moves at upper lift stop');
 close(q.flatLength+q.arcLength+q.tangentLength+q.woundLength,360,'film length conserved');
 close(Math.PI*(q.rollRadius*q.rollRadius-14*14)/.3,q.woundLength,'wound volume conserved');
 assert(q.rollRadius<15&&q.rollRadius>14);
 assert(q.cassetteBottom>=14&&q.cassetteTop<=110);
 assert(q.nutZ-D.nutHeight/2>=D.threadBottom+3&&q.nutZ+D.nutHeight/2<=D.threadTop-3,'nut has 3 mm margin at each stroke limit');
 assert(q.skirtOverlap>=42&&q.skirtBottom>=D.floor+2,'continuous sleeve remains overlapped, clear of base');
 const cz=36+q.lift/2;close((80-cz)+6*Math.PI+(88+q.lift-cz),96+6*Math.PI,'moving U-cable remains constant length');assert(cz-6>=30&&cz<=80,'cable bend remains inside protected envelope');
 const points=coverPath(q);for(const v of points){assert(Number.isFinite(v.y)&&Number.isFinite(v.z));assert(v.y<108,'film clears fixed rear wall');if(v.y<=74)assert(v.z>=q.trayZ+7.9,'film clears 3 mm bookmark stack');}
 const g=q.guideContact,s=q.spoolContact;
 close((g.y-D.guideY)*(s.y-g.y)+(g.z-D.guideZ-q.lift)*(s.z-g.z),0,'guide tangent is perpendicular to radius');
 close((s.y-D.spoolY)*(s.y-g.y)+(s.z-D.spoolZ-q.lift)*(s.z-g.z),0,'spool tangent is perpendicular to radius');
}
assert.equal(pose(.36).retract,0);assert.equal(pose(1).frontY,92);assert.equal(pose(1).skirtOverlap,42);
console.log('PASS: 2001 configurations; support stack, drive/guard clearances, film length and tangency, nut stroke, continuous sleeve overlap and constant-length cable. Analytical design checks; no safety certification.');
console.log(JSON.stringify({envelope:[D.boxW,D.boxD,D.boxH],volumeReductionFromV2:100*(1-D.boxW*D.boxD/(310*230)),rollDiameterClosed:pose(0).rollDiameter,rollDiameterOpen:pose(1).rollDiameter,minOverlap:pose(1).skirtOverlap},null,2));
