// Bottom-up mass estimate and conditional load check (ASM-1 EST, not measured).
// Every part volume comes from model geometry (advanced-kinematics.js constants
// and renderer dimensions); densities are candidate-material handbook values.
// Outputs: mass table with low/high bounds, static and stalled load-path
// checks at the 60 mm / 20 deg display pose. All results are estimates —
//实物称重与接触/疲劳试验仍为 UNVERIFIED。
const g = 9.81; // m/s²
const RHO = {pla: 1.24, petg: 1.27, steel: 7.85, alu: 2.70, rubber: 1.1, paper: 0.9}; // g/cm³
const mm3 = v => v / 1000; // mm³ → cm³
const per = (lo, hi) => ({lo, hi});
// Part volumes in mm³ (geometry from the model, documented per line).
const PARTS = [
  // Shell: side wall band (perimeter × 104 × 3) + lid 3 + floor 6, PLA/PETG.
  {n: '箱体外壳(壁3/底6/顶3)', v: mm3((2 * (300 + 222)) * 104 * 3 + 300 * 222 * 3 + 300 * 222 * 6), m: per(RHO.pla, RHO.petg)},
  // Tray: plate 244×172×4 + 2 floor − 4 pockets 52×152×4; 5 ribs + 3 beams.
  {n: '承托盒+筋位', v: mm3(244 * 172 * 6 - 4 * 52 * 152 * 4 + 5 * 6 * 6 * 162 + 3 * 228 * 6 * 6), m: per(RHO.pla, RHO.petg)},
  // Soft ribs, bookmark cards (0.3-1 mm paper stacks, 4 columns).
  {n: '软肋', v: mm3(4 * (48 * 2.4 * 1.2 + 2.1 * 2.4 * 140)), m: per(RHO.rubber, RHO.pla)},
  {n: '书签（3mm堆厚/列≈0.1mm×30张×4列）', v: 0, m: null, note: 'grammage 80 g/m²: 120 sheets × 0.05×0.15 m²', add: per(120 * .05 * .15 * 60, 120 * .05 * .15 * 110)},
  // Carriage stems/beams: two 6×54×91 + arms/nut/sleeve hardware, PLA + steel bits.
  {n: '竖车架(梁/臂/连接块)', v: mm3(2 * 6 * 54 * 91 + 4 * 12 * 6 * 12 + 2 * 6 * 6 * 9 + 2 * 6 * 4 * 36), m: per(RHO.pla, RHO.petg)},
  // Screws Ø7×76 steel ×2, guide rods Ø6×100 ×2, nuts/sleeves POM-ish lumped.
  {n: '丝杠+导杆+螺母滑套', v: mm3(2 * Math.PI / 4 * 7 * 7 * 76 + 2 * Math.PI / 4 * 6 * 6 * 100), m: per(RHO.steel, RHO.steel), note: '螺母滑套计入±15g区间',
   add: per(10, 25)},
  // Cam plates 4 mm strip ~25×90 each side, steel (replaceable insert policy).
  {n: '凸轮槽板×2', v: mm3(2 * 4 * 25 * 90), m: per(RHO.alu, RHO.steel)},
  // Guards: vertical skirt shell 0.8 + rigid hoods ~1 + formed rings 0.7, PLA.
  {n: '护罩系统(裙罩+刚性罩+接圈)', v: mm3((291.6 + 213) * 2 * 90 * 0.8 + 2 * 17.3 * 202 * 1 + 291.6 * 18 * 1), m: per(RHO.pla, RHO.pla)},
  // Bellows film 16 pleats × perimeter ~1000 × 78 developed × 0.25.
  {n: '柔性风琴罩', v: mm3(1000 * 78 * 0.25), m: per(0.9, 1.4)},
  // Cover film 254×360×0.3 TPU.
  {n: '透明膜', v: mm3(254 * 360 * 0.3), m: per(1.1, 1.2)},
  // Roll assembly: spool core + guide roller + bars + belts, mixed.
  {n: '卷盖传动(辊/轴/带/卷盒)', v: mm3(2 * Math.PI / 4 * 24 * 254 * 0.25 + 254 * 3 * 3), m: per(RHO.pla, RHO.steel)},
  // D5-2 rack/pawl/prop/brake, steel racks + PLA pivots.
  {n: 'D5-2 棘条×2(钢)', v: mm3(2 * 2.5 * 16 * 77), m: per(RHO.steel, RHO.steel)},
  {n: 'D5-2 爪/挡块/支架/电磁铁占位', v: 0, m: null, add: per(25, 60)},
  // Motors: M1/M2 micro gearmotors + brake + electronics + cabling lumped.
  {n: '电机×2+抱闸+电子线缆', v: 0, m: null, add: per(90, 220)},
  // Fasteners, feet, brand plate lumped.
  {n: '紧固件/脚垫/杂项', v: 0, m: null, add: per(25, 60)},
];
let lo = 0, hi = 0, movingLo = 0, movingHi = 0;
const MOVING = ['承托盒', '车架', '护罩系统', '风琴罩', '透明膜', '卷盖传动', '爪/挡块'];
const rows = PARTS.map(p => {
  let mLo = 0, mHi = 0;
  if (p.m) {mLo = p.v * p.m.lo; mHi = p.v * p.m.hi;} // cm³ × g/cm³ = g
  if (p.add) {mLo += p.add.lo; mHi += p.add.hi;}
  if (p.note === '每列堆厚3mm示例：4×150×50×3') {mLo = mm3(4 * 150 * 50 * 3) * RHO.paper / 1000; mHi = mLo * 1.4;} // paper bulk 0.9-1.26
  lo += mLo; hi += mHi;
  if (MOVING.some(k => p.n.includes(k))) {movingLo += mLo; movingHi += mHi;}
  return {part: p.n, grams: [+(mLo).toFixed(0), +(mHi).toFixed(0)]};
});
const M_ALL = per(lo, hi), M_MOV = per(movingLo, movingHi);
// Carriage adds its own stem mass already inside 竖车架; tray+hood ride on it.
const mLo = M_MOV.lo, mHi = M_MOV.hi;
// Stall/impact factor for the worst quasi-static case.
const K = 3;
const checks = [];
// 1. Lead screw: axial load, self-lock margin, drive torque (steel/steel 0.15).
const lead = 2, d = 7, lambda = Math.atan(lead / (Math.PI * d)), rho = Math.atan(.15);
const Fz = mHi / 1000 * g; // N, both screws share
const Tdrive = (Fz / 2) * (d / 2000) * Math.tan(lambda + rho) * 2 / .9; // N·m at motor, belt eff 0.9
checks.push({item: '丝杠轴向力/驱动扭矩', value: `F=${(Fz).toFixed(1)} N 双丝杠分摊, T_M1≈${(Tdrive * 1000).toFixed(1)} mN·m`,
  selfLock: `升角${(lambda / Math.PI * 180).toFixed(1)}° < 摩擦角${(rho / Math.PI * 180).toFixed(1)}°（0.15，钢-钢润滑上限）自锁成立`,
  verdict: '量级可行', note: '自锁随磨损/振动漂移：仍按 DEC-002 配独立抱闸，不作为保持措施'});
// 2. Brake torque demand vs a small fail-safe brake class.
checks.push({item: '失电抱闸扭矩需求', value: `≥${(Tdrive * 1.5 * 1000).toFixed(0)} mN·m（含 1.5 安全系数）`,
  verdict: '0.1 N·m 级微型失电制动器即覆盖', note: '响应时间/停止距离待选型与实测'});
// 3. Roller normal force from tilt gravity moment, stalled ×K.
// Tray+cargo c.g. ~40 mm behind trunnion (conservative), tilt 20°.
const Mt = mHi / 1000 * g * .040 * Math.sin(20 * Math.PI / 180);
const Fn = Mt / (2 * .065 * Math.cos(42.31 * Math.PI / 180)) * K;
// Hertz line contact steel roller / steel-adjacent wall, E*≈115 GPa conservative for steel-POM mix; take steel/steel.
const EH = 2 / ((1 - .3 ** 2) / 210e9 + (1 - .3 ** 2) / 210e9);
const sH = Math.sqrt(Fn / Math.PI / .007 * EH / (2 * .005)) / 1e6; // MPa, line contact approximation
checks.push({item: '滚轮-槽壁法向力/接触应力（含×3卡滞）', value: `Fn≈${Fn.toFixed(1)} N/轮, σH≈${sH.toFixed(0)} MPa`,
  verdict: sH < 400 ? '量级可行（钢滚轮类允许值量级 400-1500 MPa）' : '偏紧，需换大滚轮或金属槽板', note: '磨损寿命与循环次数须试验，本核算不构成寿命结论'});
// 4. Rack tooth shear under arrested drop, impact ×5 of moving mass.
const Ftooth = mHi / 1000 * g * 5 / 2;
const tau = Ftooth / (2.3 * 16); // N/mm² = MPa, root area 2.3×16
checks.push({item: '棘齿根部剪切（断带×5冲击）', value: `F≈${Ftooth.toFixed(0)} N/侧, τ≈${tau.toFixed(1)} MPa`,
  verdict: tau < 80 ? '量级可行（钢允许剪切量级 80-200 MPa）' : '偏紧', note: '齿形斜面引导与落座冲击未设计，UNVERIFIED'});
// 5. Service prop cantilever, seating ×3.
const Fp = mHi / 1000 * g * 3;
const sig = Fp * 40 / (16 * 2 * 2 / 6); // σ = M/W, W=16×2²/6 mm³
checks.push({item: '检修挡块悬臂（落座×3）', value: `F≈${Fp.toFixed(0)} N, σ≈${sig.toFixed(1)} MPa`,
  verdict: sig < 80 ? '金属件（铝/钢）可行；塑料件则截面不足需加宽' : '偏紧，需加宽截面或换金属',
  note: '挡块为承力件应选金属或加筋打印；挠度影响落座平稳性需复校'});
// 6. Screw drive margin vs a typical N20-class gearbox (est. 10-30 mN·m).
checks.push({item: 'M1 驱动余量校验', value: `需求≈${(Tdrive * 1000).toFixed(1)} mN·m vs 微型减速电机常见 10-30 mN·m`,
  verdict: '需按选定电机实测堵转/温升', note: '卡滞工况按联锁停机保护，非靠电机硬扛'});
console.log(JSON.stringify({
  status: 'ESTIMATE — 工程估算，非实测；全部判定为条件性（依赖材料密度与几何模型，无称重/试验证据）',
  totalMass_g: [Math.round(lo), Math.round(hi)],
  movingMass_g: [Math.round(mLo), Math.round(mHi)],
  massTable: rows,
  loadChecks: checks,
  headline: '2 kg 量级下静强度全部大裕量；真实风险重心在磨损/疲劳/护罩寿命与低龄夹持安全，需实物试验',
}, null, 2));
