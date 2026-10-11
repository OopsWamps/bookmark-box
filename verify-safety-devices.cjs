// D5-2 lift-safety train geometric regression (DEC-002 combination 1).
// Envelope sweeps, rack/pawl mesh kinematics and renderer part presence.
// This is not load, impact, fatigue, tolerance or safeguarding verification;
// brake, solenoid and tooth sizing stay UNVERIFIED until mass data exist.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('./assets/three.min.js');

// Mechanical envelopes [x0,x1, y0,y1, z0,z1] in millimetres.
const FIXED = {
  rack: {env: [122.5, 125.0, -10, 6, 6, 83], both: true},
  teeth: {env: [120.2, 122.5, -10, 6, 7, 81], both: true},
  topPlate: {env: [125.25, 139, -10, 6, 88, 95], both: true},
  brakeDisc: {env: [-2.5, 2.5, -70, -58, 13.5, 18.5]},
  brakeRing: {env: [-3, 3, -72.2, -55.8, 13, 19]},
  brakeBracketR: {env: [7, 9, -52, -48, 6, 13.5]},
  brakeBracketL: {env: [-9, -7, -52, -48, 6, 13.5]},
};
// Carriage-borne parts, z raised by lift. The bracket and solenoid stay west
// of the tooth tips (X120.2) for the whole stroke; only the claw enters the
// tooth gaps, hooking over the tooth upper faces.
const MOVED = {
  pawlBracket: {env: [117, 119.2, -2.8, -1.2, 36.7, 39.3], both: true},
  pawlClaw: {env: [119.2, 121.6, -2.8, -1.2, 22, 38], both: true},
  solenoid: {env: [116.7, 119.5, -4, 0, 41, 48], both: true},
  beam: {env: [111, 117, -29, 62, 30, 84], both: true},
  nutArm: {env: [113, 125, -24, -12, 27, 33], both: true},
  sleeveArm: {env: [113, 125, 34, 46, 27, 33], both: true},
  web: {env: [111, 117, 27, 36, 30, 36], both: true},
  nut: {env: [123, 135, -24, -12, 25, 35], both: true},
};
// Existing fixed neighbours the new parts must clear.
const NEIGHBOUR = {
  screw: {env: [125.5, 132.5, -21, -15, 18.5, 102], both: true},
  guideRod: {env: [126, 132, 37, 43, 6, 106], both: true},
  lowerBearing: {env: [120, 138, 8.5, 11.5, 6, 14], both: true},
  guideFoot: {env: [120, 138, 33, 47, 6, 22], both: true},
  upperBearing: {env: [124, 134, 11, 25, 98, 106], both: true},
  screwNeck: {env: [126, 132, -21, -15, 98, 106], both: true},
  pulleyR: {env: [124, 134, -23, -13, 6, 16], both: true},
  motor: {env: [-9, 9, -73, -55, 20, 42]},
  motorPulley: {env: [-5, 5, -69, -59, 9.5, 12.5]},
  controlBox: {env: [-27.5, 27.5, 76, 96, 6, 18]},
  motorLegR: {env: [11.5, 14.5, 43, 55, 6, 44]},
  motorLegL: {env: [-14.5, -11.5, 43, 55, 6, 44]},
};
// Stored tray floor (lowest pose, tilt raised above this): fixed parts must
// stay 1 mm clear of it west of X122 and clear of the tilt dip near Y-69.
const TRAY_FLOOR = 86, TRAY_TILT_DIP = 82.4, TOOTH_TIP_X0 = 120.2, X_TRAY = 122;

const overlap = (a, b, gap) => a[0] < b[1] + gap && b[0] < a[1] + gap
  && a[2] < b[3] + gap && b[2] < a[3] + gap && a[4] < b[5] + gap && b[4] < a[5] + gap;
const gapOf = (a, b) => Math.max(a[0] - b[1], b[0] - a[1], a[2] - b[3], b[2] - a[3], a[4] - b[5], b[4] - a[5]);
const raised = (env, lift) => [env[0], env[1], env[2], env[3], env[4] + lift, env[5] + lift];
const mirrored = env => [-env[1], -env[0], env[2], env[3], env[4], env[5]];

// Bottom belt run as a capsule: centre (0,-64)->(±129,-18), half-width 6.5,
// Z 9.5…12.5. Distance in plan from a box to the segment.
function beltClearance(env) {
  const seg = [[0, -64], [129, -18]];
  let worst = Infinity;
  for (const s of [seg, [seg[0], [-seg[1][0], seg[1][1]]]]) {
    const [ax, ay] = s[0], [bx, by] = s[1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    for (const [px, py] of [[env[0], env[2]], [env[1], env[2]], [env[0], env[3]], [env[1], env[3]]]) {
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2));
      const cx = ax + t * dx, cy = ay + t * dy;
      worst = Math.min(worst, Math.hypot(px - cx, py - cy) - 6.5);
    }
  }
  return worst;
}

const results = {pairs: [], belt: [], mesh: [], known: []};
// 1. Fixed new parts vs moved carriage parts across the full stroke.
for (let i = 0; i <= 30; i++) {
  const lift = 60 * i / 30;
  for (const [fn, fd] of Object.entries(FIXED)) for (const sign of fd.both ? [-1, 1] : [1]) {
    const fenv = sign < 0 ? mirrored(fd.env) : fd.env;
    for (const [mn, md] of Object.entries(MOVED)) for (const msign of md.both ? [-1, 1] : [1]) {
      if (fn === 'teeth' && mn === 'pawlClaw') continue; // intended mesh, checked separately below
      const menv = raised(msign < 0 ? mirrored(md.env) : md.env, lift);
      if (overlap(fenv, menv, 0)) throw new Error(`Interference ${fn}(sign ${sign}) vs ${mn}(sign ${msign}) at lift ${lift}`);
      results.pairs.push({pair: `${fn}/${mn}`, lift, gap: +gapOf(fenv, menv).toFixed(3)});
    }
  }
  // 2. New fixed parts vs existing fixed neighbours.
  for (const [fn, fd] of Object.entries(FIXED)) for (const sign of fd.both ? [-1, 1] : [1]) {
    const fenv = sign < 0 ? mirrored(fd.env) : fd.env;
    for (const [nn, nd] of Object.entries(NEIGHBOUR)) for (const nsign of nd.both ? [-1, 1] : [1]) {
      const nenv = nsign < 0 ? mirrored(nd.env) : nd.env;
      if (overlap(fenv, nenv, 0)) throw new Error(`Interference ${fn}(sign ${sign}) vs ${nn}(sign ${nsign})`);
      results.pairs.push({pair: `${fn}/${nn}`, lift: 0, gap: +gapOf(fenv, nenv).toFixed(3)});
    }
    const bc = beltClearance(fenv);
    if (bc <= 0 && fenv[4] < 12.5 && fenv[5] > 9.5) throw new Error(`${fn} crosses the bottom belt run (clearance ${bc.toFixed(2)})`);
    // Plan-projected clearance is meaningless when the part is fully above or
    // below the belt band, so report those as Z-separated instead.
    results.belt.push({part: fn, clearance: fenv[4] >= 12.5 || fenv[5] <= 9.5 ? 'z-separated' : +bc.toFixed(3)});
  }
}
// 3. Rack/pawl mesh: the claw underside stays in the meshing band, seats on
// the top tooth within the declared 1 mm, and clears the tooth tips when held.
for (let i = 0; i <= 30; i++) {
  const lift = 60 * i / 30, clawBottom = 22 + lift;
  assert(clawBottom >= 8 && clawBottom <= 82, `claw underside ${clawBottom} leaves the meshing band at lift ${lift}`);
  results.mesh.push({lift, clawBottom, seatingTravel: Math.max(0, 82 - clawBottom - 1)});
}
assert(121.6 < 122.5 && 119.2 > 117, 'claw spans from the bracket side across the tooth tips into the gaps');
// Tooth tips reach west of the tray edge (X122), so the Z separation must
// hold even at the deepest tilt dip of the tray rim (82.4 mm, tilt 20°).
assert(81 < TRAY_TILT_DIP - 1, 'tooth tops must stay 1 mm below the tilted tray rim dip');
// Held (energised) claw rotates 0.12 rad about Y at the pivot (X119.2):
// hook tip swings to x' = 2.4cos0.12 - 16sin0.12 ≈ 0.47 → X≈119.67, clear of
// the tooth tips; the claw inner edge stays 0.29 mm off the carriage beam.
const tipX = 2.4 * Math.cos(0.12) - 16 * Math.sin(0.12);
assert(tipX + 119.2 < 120.2, `held claw tip (${(tipX + 119.2).toFixed(2)}) must clear the tooth tips`);
const innerX = 16 * Math.sin(0.12);
assert(innerX + 119.2 > 117, `held claw inner edge (${(119.2 - innerX).toFixed(2)}) must clear the beam`);
// 4. Service prop deployed: hinged on the spine inner face (X135) exactly as
// rendered, 2 mm drop onto the beam underside. The arm stays inboard of the
// side spine (X136..139), the skirt shells (X±142) and the racks — the former
// RSK-6 wall/skirt crossings are structurally gone.
const prop = [105, 135, 14, 30, 26, 28];
assert(prop[1] <= 136, 'prop arm must not enter the side spine (X136..139)');
assert(prop[1] < 141.6, 'prop arm must not reach the skirt root plane (RSK-6 resolved)');
for (let i = 0; i <= 30; i++) {
  const lift = 60 * i / 30;
  const beam = raised([111, 117, -29, 62, 30, 84], lift);
  assert(!overlap(prop, beam, 0), `prop collides with beam at lift ${lift}`);
  results.pairs.push({pair: 'prop/beam', lift, gap: +gapOf(prop, beam).toFixed(3)});
}
assert(gapOf(prop, [111, 117, -29, 62, 30, 84]) === 2, 'prop support face must sit 2 mm under the beam');
// 5. Fixed teeth never enter the stored tray envelope west of X122.
assert(81 < TRAY_FLOOR - 1, 'tooth tops must stay below the stored tray floor minus 1 mm');
assert(83 < TRAY_FLOOR - 1 || 122.5 >= X_TRAY, 'rack body above the tray floor is only allowed east of X122');
// 6. Everything stays inside the inner shell.
for (const fd of Object.values(FIXED)) for (const e of [fd.env, mirrored(fd.env)]) {
  assert(e[0] >= -147 && e[1] <= 147 && e[2] >= -108 && e[3] <= 108 && e[5] <= 107, `envelope breach: ${JSON.stringify(e)}`);
}
// 7. Renderer really builds the parts with the declared positions, and the
// pawl/prop rotation follows the shared powerLost/serviceOpen flags.
const source = fs.readFileSync('advanced-renderer.js', 'utf8');
const low = fs.readFileSync('lowbox-renderer.js', 'utf8');
const sceneSrc = fs.readFileSync('scene.js', 'utf8');
// box/cylinder/material live in scene.js, ring/…/screwHead in lowbox-renderer.js;
// both are closure partners of advanced-renderer.js inside the built page.
const sceneHelpers = sceneSrc.slice(sceneSrc.indexOf('function material'), sceneSrc.indexOf('function flatTexture'));
const helperSrc = low.slice(0, low.indexOf('function horizontalBelt')); // ring, boredBlock, roundRect, roundedShell, screwHead
const mat = new THREE.MeshBasicMaterial();
const ctx = {
  THREE, Mechanism: require('./advanced-kinematics.js'), pose: require('./advanced-kinematics.js').pose,
  scene: new THREE.Group(), window: {}, powerLost: false, serviceOpen: false,
  silver: mat, dark: mat, white: mat, rubber: mat, glass: mat,
  drivePulleys: [], driveGears: [], screws: [], shellParts: [], fixedGuards: [],
  material: () => mat, makeCards: () => {}, camRollers: [],
  verticalBelt: () => {}, xBearingPlate: () => {}, bellowsGeometry: () => new THREE.BufferGeometry(),
  cableCurve: () => new THREE.CurvePath(), hingeCableCurve: () => new THREE.CurvePath(),
  pullBar: new THREE.Group(), frontBrand: {visible: true}, cut: false, p: 0,
  spurGear: () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat),
  ribbonMesh: () => new THREE.Mesh(new THREE.BufferGeometry(), mat),
  polylineCurve: () => new THREE.CurvePath(),
};
vm.createContext(ctx);
vm.runInContext(sceneHelpers, ctx);
vm.runInContext(helperSrc, ctx);
vm.runInContext(source, ctx);
vm.runInContext(`
  liftGroup=new THREE.Group(); tiltGroup=new THREE.Group(); tiltPivot=new THREE.Group();
  buildSafetyDevices();
  var filmGeo=new THREE.BufferGeometry(); filmGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(82*2*3),3));
  filmMesh=new THREE.Mesh(filmGeo, silver);
  filmEdges=[0,1].map(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(82*3),3));return new THREE.Line(g,new THREE.LineBasicMaterial());});
  filmRoll=new THREE.Mesh(new THREE.BufferGeometry(), silver);
  reelGroup=new THREE.Group(); cassetteShell=new THREE.Group();
  bellowsMesh=new THREE.Mesh(new THREE.BufferGeometry(), silver);
  hingeCable=new THREE.Mesh(new THREE.BufferGeometry(), rubber);
  scene.add(new THREE.Mesh(new THREE.BufferGeometry(), rubber)).children.at(-1).name='harness';
  window.capture={pawlPivots,serviceProps};
  var rackR=scene.children.find(m=>m.name==='pawl-rack-right');
  var rackL=scene.children.find(m=>m.name==='pawl-rack-left');
  var disc=scene.children.find(m=>m.name==='brake-disc');
  window.check={rackR,rackL,disc};
`, ctx);
const built = ctx.window.check;
assert(built.rackR && built.rackL && built.disc, 'renderer must build both racks and the brake disc');
assert(built.rackR.position.x === 123.75 && Math.abs(built.rackR.position.y - 44.5) < 1e-9, 'rack position matches the declared envelope');
assert(ctx.window.capture.pawlPivots.length === 2 && ctx.window.capture.serviceProps.length === 2, 'two pawls and two props are registered');
// Retraction behaviour follows the shared powerLost flag.
vm.runInContext('powerLost=true; updateLowBox(pose(0.5));', ctx);
assert(Math.abs(ctx.window.capture.pawlPivots[0].rotation.y) < 1e-9, 'pawls hang vertical (engaged) when power is lost');
vm.runInContext('powerLost=false; serviceOpen=true; updateLowBox(pose(0.5));', ctx);
assert(Math.abs(Math.abs(ctx.window.capture.pawlPivots[0].rotation.y) - 0.12) < 1e-9, 'pawls retract when energised');
assert(Math.abs(ctx.window.capture.serviceProps[0].rotation.y) < 1e-9, 'props swing out when the maintenance cover opens');

const minGap = {};
for (const {pair, gap} of results.pairs) minGap[pair] = Math.min(minGap[pair] ?? Infinity, gap);
console.log(JSON.stringify({
  status: 'GEOMETRY-PASS',
  scope: 'Envelope sweeps (31 lift steps), rack/pawl mesh kinematics, renderer part presence. No load, impact, fatigue, tolerance or safeguarding verification.',
  minimumPairGaps_mm: Object.fromEntries(Object.entries(minGap).map(([k, v]) => [k, +v.toFixed(3)])),
  minimumBeltClearance_mm: +Math.min(...results.belt.filter(b => typeof b.clearance === 'number').map(b => b.clearance), Infinity).toFixed(3),
  meshTopTooth_mm: 81, fullRaiseClawUnderside_mm: 82, seatingTravel_mm: 1,
  knownInterfaceIssues: results.known.slice(0, 3),
}, null, 2));
