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
/** The physical models, added to PLANTS (10-definitions.ts) before "Enter transfer function": the transfer function
 *  follows from the equations of the model */
export const PHYSICAL_PLANTS: Record<string, PlantType> = {
  msd: {
    name: 'Mass–spring–damper',
    p: ['mass', 'damp', 'spring'],
    tex: 'P(s)=\\dfrac{1}{ms^2+cs+k}',
    texNum: p => ratTeX(...msdTF(p)),
    tf: p => ({ num: msdTF(p)[0], den: msdTF(p)[1], L: 0 }),
    model:
      'A mass \\(m\\) on a spring \\(k\\) and a damper \\(c\\), pushed by the force \\(u\\) [N]; the output \\(y\\) is its position [m]: \\(m\\ddot y+c\\dot y+ky=u\\).',
  },
  rlc: {
    name: 'RLC circuit',
    p: ['resR', 'indL', 'capC'],
    tex: 'P(s)=\\dfrac{1}{LCs^2+RCs+1}',
    texNum: p => ratTeX([1], [p.indL * p.capC, p.resR * p.capC, 1]),
    tf: p => ({ num: [1], den: [p.indL * p.capC, p.resR * p.capC, 1], L: 0 }),
    model:
      'A resistor \\(R\\), an inductor \\(L\\) and a capacitor \\(C\\) in series, driven by the voltage \\(u\\) [V]; the output \\(y\\) is the voltage of the capacitor [V]: \\(LC\\ddot y+RC\\dot y+y=u\\).',
  },
  motorW: {
    name: 'DC motor (speed)',
    p: ['motJ', 'motB', 'motK', 'motR', 'motL'],
    tex: 'P(s)=\\dfrac{K_m}{(Js+b)(L_as+R_a)+K_m^2}',
    texNum: p => ratTeX(...motorTF(p)),
    tf: p => ({ num: motorTF(p)[0], den: motorTF(p)[1], L: 0 }),
    model:
      'A DC motor driven by the armature voltage \\(u\\) [V]; the output \\(y\\) is its speed \\(\\omega\\) [rad/s]. Armature: \\(L_a\\dot i+R_ai=u-K_m\\omega\\); rotor: \\(J\\dot\\omega+b\\omega=K_mi\\) (the back emf and torque constants are equal in SI units).',
  },
  motorA: {
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
