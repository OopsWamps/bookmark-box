// Cam-profile candidate comparison for DEC-003, second pass.
// v = 1/(1-b) exactly as implemented in advanced-kinematics.js (the shipped
// curve is NOT the 25/50/25 trapezoid the notes describe — documentation
// discrepancy logged separately). Independent re-implementation used as a
// cross-check of the production formulas.
// Units: mm, rad.
const D2R = Math.PI / 180;
const clamp = v => Math.max(0, Math.min(1, v));
function angleMotion(t, b) {
  t = clamp(t); const v = 1 / (1 - b);
  if (t === 0 || t === 1) return t;
  if (t < b) return v / 2 * (t - b / Math.PI * Math.sin(Math.PI * t / b));
  if (t <= 1 - b) return v * (t - b / 2);
  return 1 - angleMotion(1 - t, b);
}
function angleDerivatives(t, b) {
  if (t <= 0 || t >= 1) return {position: clamp(t), velocity: 0, acceleration: 0};
  const v = 1 / (1 - b);
  if (t < b) return {position: angleMotion(t, b), velocity: v / 2 * (1 - Math.cos(Math.PI * t / b)), acceleration: v * Math.PI / (2 * b) * Math.sin(Math.PI * t / b)};
  if (t <= 1 - b) return {position: angleMotion(t, b), velocity: v, acceleration: 0};
  const r = angleDerivatives(1 - t, b);
  return {position: 1 - r.position, velocity: r.velocity, acceleration: -r.acceleration};
}
function camAtLift(lift, {arm, dwell, stroke, b, tiltMax = 20 * D2R}) {
  lift = Math.max(0, Math.min(60, lift));
  const u = (lift - dwell) / stroke, tilt = tiltMax * angleMotion(u, b), a = angleDerivatives(u, b);
  const da = tiltMax * a.velocity / stroke, dda = tiltMax * a.acceleration / (stroke * stroke);
  const c = Math.cos(tilt), s = Math.sin(tilt);
  const dy = arm * c * da, dz = 1 + arm * s * da;
  const ddy = arm * (c * dda - s * da * da), ddz = arm * (s * dda + c * da * da);
  const speed = Math.hypot(dy, dz);
  const curvature = (dy * ddz - dz * ddy) / (speed ** 3);
  const pa = Math.acos(Math.max(-1, Math.min(1, (c * dz - s * dy) / speed)));
  return {tilt, dy, dz, speed, curvature, radius: Math.abs(curvature) > 1e-12 ? 1 / Math.abs(curvature) : Infinity, pa, y: -82 + arm * s, z: 100 + lift - arm * c, nY: -dz / speed, nZ: dy / speed, acc: Math.abs(dda)};
}
function evaluate({arm, dwell, stroke, b}) {
  let peakPa = 0, peakAt = 0, minR = Infinity, slotTop = -Infinity, peakAcc = 0;
  const N = 3000;
  for (let i = 0; i <= N; i++) {
    const lift = 60 * i / N, k = camAtLift(lift, {arm, dwell, stroke, b});
    if (k.pa > peakPa) {peakPa = k.pa; peakAt = lift;}
    minR = Math.min(minR, k.radius);
    slotTop = Math.max(slotTop, k.z + 8.15 * Math.abs(k.nZ));
    peakAcc = Math.max(peakAcc, k.acc);
  }
  // Mouth-clearance check for shortened dwell: hood top corners must be at or
  // above the mouth plane (Z110) whenever a box-interior |Y| applies.
  let mouthGap = Infinity;
  for (let i = 0; i <= 300; i++) {
    const lift = 60 * i / 300, k = camAtLift(lift, {arm, dwell, stroke, b});
    if (k.tilt <= 0) continue;
    for (const dy of [188.5, -188.5]) {
      const y = -82 + dy * Math.cos(k.tilt) + 10 * Math.sin(k.tilt);
      const z = 100 + lift + dy * Math.sin(k.tilt) + 10 * Math.cos(k.tilt);
      if (Math.abs(y) <= 111) mouthGap = Math.min(mouthGap, z - 110);
    }
  }
  return {peakPa: peakPa / D2R, peakAt, minR, slotTop, peakAcc, mouthGap};
}
const CANDIDATES = [
  {name: 'baseline b.25 d18 s42', b: .25, dwell: 18, stroke: 42, arm: 65},
  {name: 'A b.15 d18 s42', b: .15, dwell: 18, stroke: 42, arm: 65},
  {name: 'B b.15 d10 s50', b: .15, dwell: 10, stroke: 50, arm: 65},
  {name: 'C b.10 d8 s52', b: .10, dwell: 8, stroke: 52, arm: 65},
];
const baseAcc = evaluate(CANDIDATES[0]).peakAcc;
for (const c of CANDIDATES) {
  const r = evaluate(c);
  console.log(JSON.stringify({
    candidate: c.name,
    peakPressureAngle_deg: +r.peakPa.toFixed(2),
    peakAtLift_mm: +r.peakAt.toFixed(1),
    minCenterlineRadius_mm: +r.minR.toFixed(2),
    minInnerFlankRadius_mm: +(r.minR - 5.15).toFixed(2),
    cuspFree: r.minR > 5.15,
    slotTop_mm: +r.slotTop.toFixed(2),
    slotTopWithinBox: r.slotTop <= 110,
    mouthGap_mm: r.mouthGap === Infinity ? 'no interior points' : +r.mouthGap.toFixed(2),
    peakAcc_vs_baseline: +(r.peakAcc / baseAcc).toFixed(2),
  }));
}
// Coarse grid scan: smallest reachable peak pressure angle under dwell>=8,
// b>=0.08 (C2 smoothing retained), stroke = 60 - dwell, arm = 65.
let best = null;
for (let dwell = 8; dwell <= 20; dwell += 1) for (let bT = 8; bT <= 25; bT += 1) {
  const b = bT / 100, r = evaluate({arm: 65, dwell, stroke: 60 - dwell, b});
  if (r.minR > 5.15 && r.slotTop <= 110 && (!best || r.peakPa < best.peakPa)) best = {dwell, b, ...r};
}
console.log('grid-best:', JSON.stringify({dwell: best.dwell, b: best.b, peakPressureAngle_deg: +best.peakPa.toFixed(2), minCenterlineRadius_mm: +best.minR.toFixed(2), slotTop_mm: +best.slotTop.toFixed(2), peakAcc_vs_baseline: +(best.peakAcc / baseAcc).toFixed(2)}));
