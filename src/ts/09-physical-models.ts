// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Plants that are physical models: their parameters (SI units) and transfer functions ================= */
import { cT, nT, pMul, ratTeX } from './03-math.ts';

const PHYS_BIG = 1e6; // the largest value that may be typed (as BIG in 10-definitions.ts)
/** The parameters of the physical models, added to PARAMS (10-definitions.ts): the values give time scales of
 *  seconds, like the other plants */
export const PHYSICAL_PARAMS: ParamDefs = {
  mass: { label: 'Mass \\(m\\) [kg]', min: 0.1, max: 10, step: 0.1, val: 1, hard: [1e-6, PHYS_BIG], sym: 'm' },
  damp: {
    label: 'Damping coefficient \\(c\\) [N·s/m]',
    min: 0,
    max: 10,
    step: 0.05,
    val: 1,
    hard: [0, PHYS_BIG],
    sym: 'c',
  },
  spring: { label: 'Spring constant \\(k\\) [N/m]', min: 0, max: 20, step: 0.1, val: 2, hard: [0, PHYS_BIG], sym: 'k' },
  resR: { label: 'Resistance \\(R\\) [Ω]', min: 0, max: 10, step: 0.05, val: 1, hard: [0, PHYS_BIG], sym: 'R' },
  indL: { label: 'Inductance \\(L\\) [H]', min: 0.01, max: 5, step: 0.01, val: 0.5, hard: [1e-9, PHYS_BIG], sym: 'L' },
  capC: { label: 'Capacitance \\(C\\) [F]', min: 0.01, max: 5, step: 0.01, val: 0.5, hard: [1e-9, PHYS_BIG], sym: 'C' },
  motJ: {
    label: 'Moment of inertia \\(J\\) [kg·m²]',
    min: 0.01,
    max: 1,
    step: 0.01,
    val: 0.1,
    hard: [1e-9, PHYS_BIG],
    sym: 'J',
  },
  motB: {
    label: 'Viscous friction \\(b\\) [N·m·s/rad]',
    min: 0,
    max: 1,
    step: 0.01,
    val: 0.05,
    hard: [0, PHYS_BIG],
    sym: 'b',
  },
  motK: {
    label: 'Motor constant \\(K_m\\) [N·m/A]',
    min: 0.01,
    max: 2,
    step: 0.01,
    val: 0.5,
    hard: [1e-9, PHYS_BIG],
    sym: 'Km',
  },
  motR: {
    label: 'Armature resistance \\(R_a\\) [Ω]',
    min: 0.1,
    max: 10,
    step: 0.1,
    val: 2,
    hard: [1e-9, PHYS_BIG],
    sym: 'Ra',
  },
  motL: {
    label: 'Armature inductance \\(L_a\\) [H]',
    min: 0.001,
    max: 1,
    step: 0.001,
    val: 0.1,
    hard: [1e-9, PHYS_BIG],
    sym: 'La',
  },
  tankA1: {
    label: 'Cross-section of tank 1 \\(A_1\\) [m²]',
    min: 0.1,
    max: 10,
    step: 0.1,
    val: 1,
    hard: [1e-9, PHYS_BIG],
    sym: 'A1',
  },
  tankA2: {
    label: 'Cross-section of tank 2 \\(A_2\\) [m²]',
    min: 0.1,
    max: 10,
    step: 0.1,
    val: 2,
    hard: [1e-9, PHYS_BIG],
    sym: 'A2',
  },
  tankR1: {
    label: 'Outflow resistance of tank 1 \\(R_1\\) [s/m²]',
    min: 0.1,
    max: 10,
    step: 0.1,
    val: 1,
    hard: [1e-9, PHYS_BIG],
    sym: 'R1',
  },
  tankR2: {
    label: 'Outflow resistance of tank 2 \\(R_2\\) [s/m²]',
    min: 0.1,
    max: 10,
    step: 0.1,
    val: 1,
    hard: [1e-9, PHYS_BIG],
    sym: 'R2',
  },
};
// Mass–spring–damper 1/(ms² + cs + k) and DC motor (speed) K/((Js + b)(L s + R) + K²) as [numerator, denominator]
const msdTF = (p: State): [Poly, Poly] => [[1], [p.mass, p.damp, p.spring]];
const motorTF = (p: State): [Poly, Poly] => [
  [p.motK],
  pMul([p.motJ, p.motB], [p.motL, p.motR]).map((v, i) => (i === 2 ? v + p.motK * p.motK : v)),
];
/* ---- Figures of the physical models (SVG, shown in the plant card): the input u in the colour of u(t), the output y
   in the colour of y(t); symbols only, so they need no translation ---- */
// An arrowhead at (x, y) pointing in the direction a [rad]
const pfHead = (x: number, y: number, a: number, cls: string) => {
  const p = (r: number, t: number) => `${(x + r * Math.cos(a + t)).toFixed(1)},${(y + r * Math.sin(a + t)).toFixed(1)}`;
  return `<polygon class="${cls}" points="${x},${y} ${p(-9, -0.4)} ${p(-9, 0.4)}"/>`;
};
// A line from (x0, y0) to (x1, y1) with an arrowhead at its end
const pfArrow = (x0: number, y0: number, x1: number, y1: number, cls = 'pf-line') =>
  `<line class="${cls}" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>` +
  pfHead(x1, y1, Math.atan2(y1 - y0, x1 - x0), cls === 'pf-line' ? 'pf-fill' : cls);
// A label in italics (sub: a subscript)
const pfLab = (x: number, y: number, t: string, cls = '', sub = '') =>
  `<text class="pf-t ${cls}" x="${x}" y="${y}">${t}${sub ? `<tspan class="pf-sub" dy="4">${sub}</tspan>` : ''}</text>`;
// A zigzag (spring or resistor) along x from x0 to x1 at y, with n teeth of height h
const pfZigzag = (x0: number, x1: number, y: number, n: number, h: number) => {
  const d = (x1 - x0) / (2 * n);
  let p = `M${x0},${y}`;
  for (let i = 0; i < 2 * n; i++) p += ` L${(x0 + d * (i + 0.5)).toFixed(1)},${y + (i % 2 ? h : -h)}`;
  return `<path class="pf-line" d="${p} L${x1},${y}"/>`;
};
// A coil (inductor) along x from x0 to x1 at y, with n loops
const pfCoil = (x0: number, x1: number, y: number, n: number) => {
  const d = (x1 - x0) / n;
  let p = `M${x0},${y}`;
  for (let i = 0; i < n; i++) p += ` a${d / 2},${d / 2} 0 0 1 ${d},0`;
  return `<path class="pf-line" d="${p}"/>`;
};
// A voltage source at (x, y) of radius 13, with + above, and the label u
const pfSource = (x: number, y: number) =>
  `<circle class="pf-line" cx="${x}" cy="${y}" r="13"/>${pfLab(x - 4, y - 2, '+', 'pf-sign')}${pfLab(x - 3, y + 9, '−', 'pf-sign')}${pfLab(x - 30, y + 5, 'u', 'pf-u')}`;
const pfSvg = (w: number, h: number, body: string) =>
  `<svg class="plant-svg" viewBox="0 0 ${w} ${h}" role="img">${body}</svg>`;
// Mass–spring–damper: a wall, the spring k and the damper c in parallel, the mass m on the ground, the force u and the
// position y
const msdFigure = pfSvg(
  300,
  135,
  `<line class="pf-line" x1="20" y1="22" x2="20" y2="102"/>` +
    [30, 46, 62, 78, 94].map(y => `<line class="pf-thin" x1="20" y1="${y}" x2="11" y2="${y + 8}"/>`).join('') +
    `<line class="pf-line" x1="20" y1="102" x2="290" y2="102"/>` +
    [40, 70, 100, 130, 160, 190, 220, 250, 280]
      .map(x => `<line class="pf-thin" x1="${x}" y1="102" x2="${x - 8}" y2="110"/>`)
      .join('') +
    `<line class="pf-line" x1="20" y1="45" x2="45" y2="45"/>${pfZigzag(45, 145, 45, 6, 7)}<line class="pf-line" x1="145" y1="45" x2="170" y2="45"/>` +
    `<line class="pf-line" x1="20" y1="78" x2="75" y2="78"/><path class="pf-line" d="M115,68 H75 V88 H115"/>` +
    `<line class="pf-line" x1="100" y1="71" x2="100" y2="85"/><line class="pf-line" x1="100" y1="78" x2="170" y2="78"/>` +
    `<rect class="pf-line pf-body" x="170" y="30" width="60" height="68"/>${pfLab(193, 69, 'm')}` +
    pfLab(91, 32, 'k') +
    pfLab(90, 64, 'c') +
    pfArrow(232, 55, 282, 55, 'pf-u') +
    pfLab(252, 47, 'u', 'pf-u') +
    `<line class="pf-y" x1="170" y1="114" x2="170" y2="130"/>` +
    pfArrow(170, 122, 215, 122, 'pf-y') +
    pfLab(221, 127, 'y', 'pf-y'),
);
// RLC circuit: the source u, R, L and C in series, the output y across C
const rlcFigure = pfSvg(
  300,
  130,
  pfSource(40, 65) +
    `<path class="pf-line" d="M40,52 V25 H70"/>${pfZigzag(70, 120, 25, 4, 7)}<line class="pf-line" x1="120" y1="25" x2="150" y2="25"/>` +
    `${pfCoil(150, 200, 25, 4)}<path class="pf-line" d="M200,25 H245 V58"/>` +
    `<line class="pf-line" x1="230" y1="58" x2="260" y2="58"/><line class="pf-line" x1="230" y1="68" x2="260" y2="68"/>` +
    `<path class="pf-line" d="M245,68 V105 H40 V78"/>` +
    pfLab(90, 14, 'R') +
    pfLab(170, 14, 'L') +
    pfLab(214, 70, 'C') +
    pfLab(271, 54, '+', 'pf-y pf-sign') +
    pfLab(272, 88, '−', 'pf-y pf-sign') +
    pfLab(284, 72, 'y', 'pf-y') +
    `<line class="pf-y pf-dash" x1="245" y1="40" x2="278" y2="40"/><line class="pf-y pf-dash" x1="245" y1="92" x2="278" y2="92"/>`,
);
// DC motor: the armature circuit (the source u, Ra, La and the motor M with its back emf), the shaft with the inertia J
// and the friction b, and the output: the speed ω or the angle θ
const motorFigure = (out: 'ω' | 'θ') =>
  pfSvg(
    320,
    130,
    pfSource(35, 65) +
      `<path class="pf-line" d="M35,52 V25 H55"/>${pfZigzag(55, 95, 25, 3, 6)}<line class="pf-line" x1="95" y1="25" x2="110" y2="25"/>` +
      `${pfCoil(110, 150, 25, 3)}<path class="pf-line" d="M150,25 H180 V47"/><path class="pf-line" d="M180,83 V105 H35 V78"/>` +
      `<circle class="pf-line pf-body" cx="180" cy="65" r="18"/>${pfLab(172, 70, 'M')}` +
      pfLab(68, 11, 'R', '', 'a') +
      pfLab(122, 11, 'L', '', 'a') +
      pfLab(186, 100, 'K', '', 'm') +
      pfArrow(158, 25, 172, 25) +
      pfLab(160, 40, 'i') +
      `<line class="pf-line" x1="198" y1="65" x2="246" y2="65"/><rect class="pf-line pf-body" x="246" y="30" width="14" height="70"/>` +
      `<line class="pf-line" x1="260" y1="65" x2="272" y2="65"/>` +
      pfLab(246, 22, 'J') +
      `<rect class="pf-thin" x="222" y="69" width="16" height="8"/><line class="pf-thin" x1="222" y1="77" x2="238" y2="69"/>` +
      pfLab(226, 94, 'b') +
      `<path class="pf-y" d="M279,48 A18,18 0 0 1 279,82"/>` +
      pfHead(276, 83, 2.4, 'pf-y') +
      pfLab(292, 70, out, 'pf-y') +
      pfLab(262, 124, `y = ${out}`, 'pf-y'),
  );
// Two water tanks: the inflow u into tank 1, its outflow through R1 falling into tank 2, and the outflow of tank 2
// through R2; y = h2
const pfValve = (x: number, y: number) =>
  `<path class="pf-line pf-body" d="M${x - 7},${y - 6} L${x + 7},${y + 6} L${x + 7},${y - 6} L${x - 7},${y + 6} Z"/>`;
const tanksFigure = pfSvg(
  300,
  140,
  `<rect class="pf-water" x="30" y="38" width="70" height="32"/><path class="pf-line" d="M30,18 V70 H100 V18"/>` +
    `<rect class="pf-water" x="140" y="100" width="90" height="30"/><path class="pf-line" d="M140,75 V130 H230 V75"/>` +
    pfArrow(65, 0, 65, 30, 'pf-u') +
    pfLab(72, 14, 'u', 'pf-u') +
    `<line class="pf-line" x1="100" y1="64" x2="168" y2="64"/>${pfValve(130, 64)}` +
    pfArrow(168, 64, 168, 92) +
    pfLab(124, 54, 'R', '', '1') +
    `<line class="pf-line" x1="230" y1="124" x2="284" y2="124"/>${pfValve(255, 124)}` +
    pfHead(293, 124, 0, 'pf-fill') +
    pfLab(249, 114, 'R', '', '2') +
    pfLab(54, 60, 'A', '', '1') +
    pfLab(178, 120, 'A', '', '2') +
    pfLab(4, 44, 'h', '', '1') +
    `<line class="pf-thin pf-dash" x1="18" y1="38" x2="30" y2="38"/>` +
    pfLab(238, 97, 'y = h', 'pf-y', '2') +
    `<line class="pf-y pf-dash" x1="230" y1="100" x2="238" y2="100"/>`,
);
/** The physical models, added to PLANTS (10-definitions.ts) before "Enter transfer function": the transfer function
 *  follows from the equations of the model */
export const PHYSICAL_PLANTS: Record<string, PlantType> = {
  msd: {
    figure: msdFigure,
    name: 'Mass–spring–damper',
    p: ['mass', 'damp', 'spring'],
    tex: 'P(s)=\\dfrac{1}{ms^2+cs+k}',
    texNum: p => ratTeX(...msdTF(p)),
    tf: p => ({ num: msdTF(p)[0], den: msdTF(p)[1], L: 0 }),
    model:
      'A mass \\(m\\) on a spring \\(k\\) and a damper \\(c\\), pushed by the force \\(u\\) [N]; the output \\(y\\) is its position [m]: \\(m\\ddot y+c\\dot y+ky=u\\).',
  },
  rlc: {
    figure: rlcFigure,
    name: 'RLC circuit',
    p: ['resR', 'indL', 'capC'],
    tex: 'P(s)=\\dfrac{1}{LCs^2+RCs+1}',
    texNum: p => ratTeX([1], [p.indL * p.capC, p.resR * p.capC, 1]),
    tf: p => ({ num: [1], den: [p.indL * p.capC, p.resR * p.capC, 1], L: 0 }),
    model:
      'A resistor \\(R\\), an inductor \\(L\\) and a capacitor \\(C\\) in series, driven by the voltage \\(u\\) [V]; the output \\(y\\) is the voltage of the capacitor [V]: \\(LC\\ddot y+RC\\dot y+y=u\\).',
  },
  motorW: {
    figure: motorFigure('ω'),
    name: 'DC motor (speed)',
    p: ['motJ', 'motB', 'motK', 'motR', 'motL'],
    tex: 'P(s)=\\dfrac{K_m}{(Js+b)(L_as+R_a)+K_m^2}',
    texNum: p => ratTeX(...motorTF(p)),
    tf: p => ({ num: motorTF(p)[0], den: motorTF(p)[1], L: 0 }),
    model:
      'A DC motor driven by the armature voltage \\(u\\) [V]; the output \\(y\\) is its speed \\(\\omega\\) [rad/s]. Armature: \\(L_a\\dot i+R_ai=u-K_m\\omega\\); rotor: \\(J\\dot\\omega+b\\omega=K_mi\\) (the back emf and torque constants are equal in SI units).',
  },
  motorA: {
    figure: motorFigure('θ'),
    name: 'DC motor (angle)',
    p: ['motJ', 'motB', 'motK', 'motR', 'motL'],
    tex: 'P(s)=\\dfrac{K_m}{s\\{(Js+b)(L_as+R_a)+K_m^2\\}}',
    texNum: p => {
      const [n, d] = motorTF(p);
      return ratTeX(n, [...d, 0]);
    },
    tf: p => ({ num: motorTF(p)[0], den: [...motorTF(p)[1], 0], L: 0 }),
    model:
      'The same DC motor, with its angle \\(\\theta\\) [rad] as the output \\(y\\) (\\(\\dot\\theta=\\omega\\)): the speed integrated, a type 1 plant.',
  },
  tanks: {
    figure: tanksFigure,
    name: 'Two water tanks in series',
    p: ['tankA1', 'tankA2', 'tankR1', 'tankR2'],
    tex: 'P(s)=\\dfrac{R_2}{(A_1R_1s+1)(A_2R_2s+1)}',
    texNum: p => `\\dfrac{${nT(p.tankR2)}}{(${cT(p.tankA1 * p.tankR1)}s+1)(${cT(p.tankA2 * p.tankR2)}s+1)}`,
    tf: p => ({
      num: [p.tankR2],
      den: pMul([p.tankA1 * p.tankR1, 1], [p.tankA2 * p.tankR2, 1]),
      L: 0,
    }),
    model:
      'Water flows at the rate \\(u\\) [m³/s] into tank 1, from tank 1 into tank 2 and out of tank 2, each outflow in proportion to the level (linearized); the output \\(y\\) is the level of tank 2 [m]: \\(A_1\\dot h_1=u-h_1/R_1\\), \\(A_2\\dot h_2=h_1/R_1-h_2/R_2\\).',
  },
};
