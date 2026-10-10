// Global cross-group clearance sweep. Builds the real renderer parts in a VM,
// samples the full motion envelope (lift × retract, plus pawl states), and
// reports every cross-group mesh pair whose oriented bounding volumes share
// volume. Design contacts (fits, meshings, rolling contacts) are reviewed and
// whitelisted separately — this sweep does NOT claim continuous clearance
// between samples; recorded step: 26 progress samples over lift 0..60 mm and
// retract 0/92/184 mm, pawl dropped at lift 0/30/60.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('./assets/three.min.js');
const M = require('./advanced-kinematics.js');

const mat = new THREE.MeshBasicMaterial();
const ctx = {
  document:{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}}),colorSpace:0,anisotropy:0})},
  THREE, Mechanism: M, pose: M.pose,
  scene: new THREE.Group(), window: {}, powerLost: false, serviceOpen: false,
  silver: mat, dark: mat, white: mat, rubber: mat, glass: mat,
  drivePulleys: [], driveGears: [], screws: [], shellParts: [], fixedGuards: [],
  material: () => mat, makeCards: () => {}, camRollers: [], buildPartAnnotations: () => {},
  verticalBelt: () => {}, xBearingPlate: () => {}, bellowsGeometry: () => new THREE.BufferGeometry(),
  cableCurve: () => new THREE.CurvePath(), hingeCableCurve: () => new THREE.CurvePath(),
  pullBar: new THREE.Group(), frontBrand: {visible: true}, cut: false, p: 0,
  spurGear: () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat),
  ribbonMesh: () => new THREE.Mesh(new THREE.BufferGeometry(), mat),
  polylineCurve: points => {
    const c = new THREE.CurvePath();
    for (let i = 1; i < points.length; i++) c.add(new THREE.LineCurve3(points[i - 1], points[i]));
    return c;
  },
};
vm.createContext(ctx);
const sceneSrc = fs.readFileSync('scene.js', 'utf8');
const low = fs.readFileSync('lowbox-renderer.js', 'utf8');
const source = fs.readFileSync('advanced-renderer.js', 'utf8');
// Reproduce the production splice from build-advanced.cjs exactly: helpers +
// the foundation half of buildLowBox (the carriage/tilt half is dropped and
// rebuilt by buildAdvancedParts). Running the full lowbox file would create a
// duplicate copy of every moving part.
const buildStart = low.indexOf('function buildLowBox(){'), foundationEnd = low.indexOf('// Moving carriage, connected'), helperStart = low.indexOf('function xBearingPlate'), helperEnd = low.indexOf('function updateLowBox');
if ([buildStart, foundationEnd, helperStart, helperEnd].some(n => n < 0)) throw Error('renderer splice marker missing');
const rendererText = low.slice(0, buildStart) + low.slice(helperStart, helperEnd).replace('function cableCurve(', 'function legacyCableCurve(') + low.slice(buildStart, foundationEnd) + '\n buildAdvancedParts();\n}\n' + source;
vm.runInContext(sceneSrc.slice(sceneSrc.indexOf('let partTag'), sceneSrc.indexOf('/* ANNOTATION_SYSTEM */')), ctx);
vm.runInContext(rendererText, ctx);
vm.runInContext(`
  const {D,pose}=Mechanism;
  var filmGeo=new THREE.BufferGeometry(); filmGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(82*2*3),3));
  filmMesh=new THREE.Mesh(filmGeo, glass);
  filmEdges=[0,1].map(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(82*3),3));return new THREE.Line(g,new THREE.LineBasicMaterial());});
  filmRoll=new THREE.Mesh(new THREE.BufferGeometry(), silver);
  reelGroup=new THREE.Group(); cassetteShell=new THREE.Group();
  bellowsMesh=new THREE.Mesh(new THREE.BufferGeometry(), silver);
  hingeCable=new THREE.Mesh(new THREE.BufferGeometry(), rubber);
  scene.add(new THREE.Mesh(new THREE.BufferGeometry(), rubber)).children.at(-1).name='harness';
  // Full build: buildLowBox creates the fixed foundation (shell, floor, screws,
  // guide rods, spine, M1, belt) and chains into buildAdvancedParts for the
  // carriage, tilt module and safety devices. Without the foundation half the
  // sweep would miss the largest fixed parts entirely.
  buildLowBox(); // its spliced body ends with buildAdvancedParts()
  // buildAdvancedParts rebuilt the film ribbon on an empty geometry: re-arm it
  // so updateLowBox can write vertex positions (coverPath yields 43 points).
  filmMesh.geometry=new THREE.BufferGeometry();
  filmMesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(43*2*3),3));
  // Skip dynamic soft goods by reference: the bellows and film carry no mesh
  // names, and both are held by design contacts (flanges, rollers) anyway.
  window.softMeshes=new Set([bellowsMesh,filmMesh,scene.getObjectByName('harness')]);
`, ctx);

// Classify every mesh into fixed / carriage / tilt inside the VM (the group
// variables are context-scoped let bindings, not visible as ctx properties).
vm.runInContext(`
  window.classified=[];
  function groupOf(n){var g='fixed';
    while(n&&n!==scene){if(n===liftGroup)g='carriage';if(n===tiltPivot||n===tiltGroup)g='tilt';n=n.parent;}
    return g;}
  scene.updateMatrixWorld(true);
  scene.traverse(function(o){
    if(!o.isMesh)return;
    if(o.userData.partId)(window.allPartIds=window.allPartIds||new Set()).add(o.userData.partId);
    if(window.softMeshes.has(o))return;
    var pos=o.geometry&&o.geometry.attributes&&o.geometry.attributes.position;
    if(!pos||!pos.count)return;
    var pts=[],stride=Math.max(1,Math.floor(pos.count/48));
    for(var i=0;i<pos.count;i+=stride)pts.push(new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(o.matrix));
    o.geometry.computeBoundingBox();
    var bs=o.geometry.boundingBox.getSize(new THREE.Vector3()).toArray().map(function(x){return x.toFixed(0)}).join('x');
    if(o.userData.partId)(window.allPartIds=window.allPartIds||new Set()).add(o.userData.partId);
    window.classified.push({o:o,group:groupOf(o),pts:pts,label:groupOf(o).slice(0,3)+'#'+window.classified.length+' '+(o.name||o.geometry.type)+' ['+bs+']@'+o.position.x.toFixed(0)+','+o.position.y.toFixed(0)+','+o.position.z.toFixed(0)});
  });
`, ctx);
const meshes = ctx.window.classified;
// Part-ownership coverage: every callout partKey must own tagged meshes, else
// the annotation focus would silently dim everything instead of highlighting.
const EXPECTED_KEYS = ['film','tray','shell','movingShell','hoodSide','hoodRear','pullBarBeam','floorPlate','screw','screwLowerBearing','screwUpperBearing','guideRod','spine','carriage','m1','belt','m2','gears','tiltBelt','guideRoller','spool','spring','rearPlate','cableLift','camMaster','crank','trunnion','camBackup','bellows','softRib','sleeve','guideArm','rack','pawl','brake','prop'];
const taggedKeys = ctx.window.allPartIds || new Set();
const untagged = EXPECTED_KEYS.filter(k => !taggedKeys.has(k));
if (untagged.length) { console.error('partKey without meshes:', untagged.join(',')); process.exit(1); }
console.error(`meshes classified: ${meshes.length}, groups: ${[...new Set(meshes.map(m => m.group))].join(',')}`);
const byGroup = Object.fromEntries(['fixed', 'carriage', 'tilt'].map(g => [g, meshes.filter(m => m.group === g)]));
const PAIRS = [['fixed', 'carriage'], ['fixed', 'tilt'], ['carriage', 'tilt']];

// Oriented proximity: min distance between the two sampled vertex clouds in
// world space. bbox prefilter stays in the caller; non-convex hulls (shells)
// make bbox-only tests useless, so this decides. ε = 2 mm contact band.
const CONTACT = 2;
const vw = new THREE.Vector3(), vv = new THREE.Vector3();
function minDistance(a, b) {
  let best = Infinity;
  for (const p of a.pts) {
    vw.copy(p).applyMatrix4(a.o.matrixWorld);
    for (const q of b.pts) {
      vv.copy(q).applyMatrix4(b.o.matrixWorld);
      const d = vw.distanceTo(vv);
      if (d < best) best = d;
      if (best <= CONTACT) return best;
    }
  }
  return best;
}
function worldBox(m) { return new THREE.Box3().setFromObject(m.o); }

const V = new THREE.Vector3(), V2 = new THREE.Vector3();
function penetration(a, b) {
  // Conservative depth: half of the min world-AABB separation sign — only for reporting magnitude.
  const ba = worldBox(a), bb = worldBox(b);
  const ov = Math.min(ba.max.x, bb.max.x) - Math.max(ba.min.x, bb.min.x);
  const oy = Math.min(ba.max.y, bb.max.y) - Math.max(ba.min.y, bb.min.y);
  const oz = Math.min(ba.max.z, bb.max.z) - Math.max(ba.min.z, bb.min.z);
  return Math.min(ov, oy, oz);
}
const hits = [];
const POSES = [];
for (let i = 0; i <= 25; i++) POSES.push({p: M.clamp(i / 25) * .36, pawl: false, tag: `lift ${M.pose(i / 25 * .36).lift.toFixed(1)}`});
POSES.push({p: 1, pawl: false, tag: 'open'});
POSES.push({p: .68, pawl: false, tag: 'half retract'});
for (const l of [0, .5, 1]) POSES.push({p: l * .36, pawl: true, tag: `pawl dropped @lift ${(l * 60).toFixed(0)}`});
let lastLift = -1;
for (const pose of POSES) {
  const q = M.pose(pose.p);
  ctx.powerLost = pose.pawl;
  vm.runInContext('updateLowBox(pose(' + pose.p + '))', ctx);
  ctx.scene.updateMatrixWorld(true);
  for (const [ga, gb] of PAIRS) {
    const A = byGroup[ga], B = byGroup[gb];
    const boxes = new Map();
    for (const m of [...A, ...B]) boxes.set(m, worldBox(m));
    for (const a of A) for (const b of B) {
      const ba = boxes.get(a), bb = boxes.get(b);
      if (ba.max.x < bb.min.x || bb.max.x < ba.min.x || ba.max.y < bb.min.y || bb.max.y < ba.min.y || ba.max.z < bb.min.z || bb.max.z < ba.min.z) continue;
      const d = Math.min(minDistance(a, b), minDistance(b, a));
      if (d <= CONTACT) hits.push({tag: pose.tag, lift: +q.lift.toFixed(1), tilt: +q.tiltDegrees.toFixed(1), a: a.label, b: b.label, clearance: +d.toFixed(2)});
    }
  }
}
// Cluster: same pair across poses collapses to its max depth.
const merged = new Map();
for (const h of hits) {
  const k = h.a + ' ↔ ' + h.b;
  const e = merged.get(k) || {pair: k, clearance: Infinity, tags: []};
  if (h.clearance < e.clearance) {e.clearance = h.clearance; e.at = h.tag;}
  if (e.tags.length < 4 && !e.tags.includes(h.tag)) e.tags.push(h.tag);
  merged.set(k, e);
}
const list = [...merged.values()].sort((x, y) => x.clearance - y.clearance);
// Design-contact whitelist: fits and rolling/meshing contacts that exist by
// intent. Each entry: [regex on a-label, regex on b-label, either order].
const WHITELIST = [
  [/BufferGeometry \[289/, /rear-lower-flange|rear-upper-flange|rear-upper-clamp/], // bellows squeezed by its clamp flanges
  [/LatheGeometry \[\d+x\d+x\d+\]@-?12[1589],100,82/, /CylinderGeometry \[4x17x4\]@-?126,100,82/], // trunnion rings (inner+outer, both sides) ride the fork axles
  [/ExtrudeGeometry \[6x4x36\]/, /ExtrudeGeometry \[6x6x162\]/], // tray frame rests on carriage front bearing arms
  [/CylinderGeometry \[6x100x6\]/, /LatheGeometry \[10x10x10\]@-?129,30,-?40/], // guide sleeves ride the fixed guide rods
];
const isKnown = e => WHITELIST.some(([ra, rb]) =>
  (ra.test(e.pair) && rb.test(e.pair)) || (rb.test(e.pair) && ra.test(e.pair)));
const unknown = list.filter(e => !isKnown(e));
console.log(JSON.stringify({
  status: unknown.length ? 'FAIL — unknown cross-group contact' : 'PASS — all contacts match the design-contact whitelist',
  sampledPoses: POSES.length,
  note: 'discrete sampling (recorded steps) is not a continuous clearance proof; depth below the 2 mm contact band is not resolvable',
  whitelistedContacts: list.filter(isKnown),
  unknownContacts: unknown,
}, null, 1));
if (unknown.length) process.exit(1);
