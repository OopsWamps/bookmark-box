// Box-mouth clearance for shortened-dwell candidates (DEC-003 supporting calc).
const D2R = Math.PI / 180;
const clamp = x => Math.max(0, Math.min(1, x));
function am(t, b) {
  t = clamp(t); const v = 1 / (1 - b);
  if (t === 0 || t === 1) return t;
  if (t < b) return v / 2 * (t - b / Math.PI * Math.sin(Math.PI * t / b));
  if (t <= 1 - b) return v * (t - b / 2);
  return 1 - am(1 - t, b);
}
function vel(t, b) {
  if (t <= 0 || t >= 1) return 0;
  const v = 1 / (1 - b);
  if (t < b) return v / 2 * (1 - Math.cos(Math.PI * t / b));
  if (t <= 1 - b) return v;
  return vel(1 - t, b);
}
function tiltAt(lift, dwell, stroke, b) { return 20 * D2R * am((lift - dwell) / stroke, b); }
function slopeAt(lift, dwell, stroke, b) { return 20 * D2R * vel((lift - dwell) / stroke, b) / stroke; }
for (const [n, d, s] of [['D0', 0, 60], ['D4', 4, 56], ['D8', 8, 52], ['baseline', 18, 42]]) {
  let mouth = 1e9, trayLow = 1e9, filmFrontMin = 1e9;
  for (let i = 0; i <= 3000; i++) {
    const l = 60 * i / 3000, tilt = tiltAt(l, d, s, .25), da = slopeAt(l, d, s, .25);
    if (tilt <= 0) continue; // pure translation segment: hood top slides flush with the shell top by design
    const c = Math.cos(tilt), si = Math.sin(tilt);
    for (const dy of [188.5, -188.5]) {
      const y = -82 + dy * c + 10 * si, z = 100 + l + dy * si + 10 * c;
      if (Math.abs(y) <= 111) mouth = Math.min(mouth, z - 110);
    }
    for (const dy of [13, 175]) {
      const y = -82 + dy * c - 14 * si, z = 100 + l + dy * si - 14 * c;
      if (Math.abs(y) <= 108) trayLow = Math.min(trayLow, z);
    }
    const fy = -92 + 82, fz = 106 - 100; // film front edge vs pivot
    const y = -82 + fy * c + fz * si, z = 100 + l + fy * si + fz * c;
    filmFrontMin = Math.min(filmFrontMin, z);
  }
  console.log(JSON.stringify({
    candidate: n,
    mouthCornerGap_mm: mouth > 1e8 ? 'corners always above plane' : +mouth.toFixed(2),
    trayLowestInBox_mm: +trayLow.toFixed(2),
    trayStaysInsideShell: trayLow > 6 && trayLow < 110,
    filmFrontLowest_mm: +filmFrontMin.toFixed(2),
  }));
}
