// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Definitions ================= */
// Entries of a set of setting definitions, with the keys typed as numeric settings of State
import { cT, nT, pMul, pScale, ratTeX } from './04-parser.ts';
import { S } from './05-state.ts';

export const entriesOf = (defs: ParamDefs) => Object.entries(defs) as [NumKey, ParamDef][];
export const PARAMS: ParamDefs = {
  K: { label: 'Gain \\(K\\)', min: 0.1, max: 5, step: 0.1, val: 1 },
  T: { label: 'Time constant \\(T\\) [s]', min: 0.1, max: 10, step: 0.1, val: 1 },
  zeta: { label: 'Damping ratio \\(\\zeta\\)', min: 0, max: 2, step: 0.01, val: 0.3 },
  wn: { label: 'Natural frequency \\(\\omega_n\\) [rad/s]', min: 0.1, max: 10, step: 0.1, val: 1 },
  L: { label: 'Dead time \\(L\\) [s]', min: 0, max: 5, step: 0.05, val: 0.5 },
};
export const CTRL: ParamDefs = {
  Kp: { label: 'Proportional gain \\(K_P\\)', min: 0, max: 20, step: 0.05, val: 2 },
  Ki: { label: 'Integral gain \\(K_I\\)', min: 0, max: 10, step: 0.05, val: 1 },
  Kd: { label: 'Derivative gain \\(K_D\\)', min: 0, max: 5, step: 0.01, val: 0.2 },
  N: { label: 'Derivative filter coefficient \\(N\\)', min: 1, max: 100, step: 1, val: 20 },
  Kc: { label: 'Gain \\(K_c\\)', min: 0.05, max: 50, step: 0.05, val: 2 },
  T1: { label: 'Lead time constant \\(T_1\\) [s]', min: 0.01, max: 10, step: 0.01, val: 1 },
  alpha: { label: 'Lead ratio \\(\\alpha\\) (\\(0<\\alpha<1\\))', min: 0.02, max: 0.99, step: 0.01, val: 0.1 },
  T2: { label: 'Lag time constant \\(T_2\\) [s]', min: 0.1, max: 100, step: 0.1, val: 10 },
  beta: { label: 'Lag ratio \\(\\beta\\) (\\(\\beta>1\\))', min: 1.01, max: 50, step: 0.01, val: 10 },
};
/* ---- Kinds of controller ----
   To add a kind of controller, add an entry to CONTROLLERS (and its new parameters to CTRL and HARD).
   The menu, the parameter inputs, simulation, frequency response, pole-zero map, root locus and scenario
   files all follow from the entry; give the menu label and the short name translations in i18n.json. */
interface CtrlType {
  /** name in the menu (English; translated) */
  label: string;
  /** short name, as in 'Convert from PID settings' */
  name: string;
  /** 'pid': KP + KI/s + KD s/(s/N+1) with the terms whose gains are in p (2-DOF, derivative on y and anti-windup
      apply); 'tf': the transfer function given by rational */
  kind: 'pid' | 'tf';
  /** parameters shown as inputs */
  p: NumKey[];
  /** parameters multiplied when the loop gain is changed (root locus); none: the numerator is scaled */
  gain: NumKey[];
  /** transfer function C(s) */
  rational: (st: State) => Rational;
  /** right-hand side of C(s)= with the numbers substituted (for 'tf'; PID formulas are built from the terms) */
  texNum?: (st: State) => string;
  /** the controller alone is unstable (counts in the Nyquist criterion) */
  unstable?: (st: State) => boolean;
  /** initial values of its parameters that differ from those in CTRL (the parameters are shared by the kinds) */
  defaults?: Partial<Record<NumKey, number>>;
}
// First-order lead and lag parts of the compensators: (T1 s + 1)/(α T1 s + 1), (T2 s + 1)/(β T2 s + 1)
const leadPart = (st: State) => ({ num: [st.T1, 1], den: [st.alpha * st.T1, 1] }),
  lagPart = (st: State) => ({ num: [st.T2, 1], den: [st.beta * st.T2, 1] }),
  partTeX = (r: Rational) => `\\dfrac{${cT(r.num[0])}s+1}{${cT(r.den[0])}s+1}`;
export const CONTROLLERS: Record<string, CtrlType> = {
  P: {
    label: 'P control',
    name: 'P',
    kind: 'pid',
    p: ['Kp'],
    gain: ['Kp'],
    rational: st => ({ num: [st.Kp], den: [1] }),
    defaults: { Kp: 1 },
  },
  PI: {
    label: 'PI control',
    name: 'PI',
    kind: 'pid',
    p: ['Kp', 'Ki'],
    gain: ['Kp', 'Ki'],
    rational: st => ({ num: [st.Kp, st.Ki], den: [1, 0] }),
  },
  PD: {
    label: 'PD control',
    name: 'PD',
    kind: 'pid',
    p: ['Kp', 'Kd', 'N'],
    gain: ['Kp', 'Kd'],
    rational: st => ({ num: [st.Kp + st.Kd * st.N, st.Kp * st.N], den: [1, st.N] }),
  },
  PID: {
    label: 'PID control',
    name: 'PID',
    kind: 'pid',
    p: ['Kp', 'Ki', 'Kd', 'N'],
    gain: ['Kp', 'Ki', 'Kd'],
    rational: st => ({
      num: [st.Kp + st.Kd * st.N, st.Kp * st.N + st.Ki, st.Ki * st.N],
      den: [1, st.N, 0],
    }),
  },
  lead: {
    label: 'Lead compensator',
    name: 'Lead',
    kind: 'tf',
    p: ['Kc', 'T1', 'alpha'],
    gain: ['Kc'],
    rational: st => {
      const l = leadPart(st);
      return { num: pScale(l.num, st.Kc), den: l.den };
    },
    texNum: st => `${nT(st.Kc)}${partTeX(leadPart(st))}`,
  },
  lag: {
    label: 'Lag compensator',
    name: 'Lag',
    kind: 'tf',
    p: ['Kc', 'T2', 'beta'],
    gain: ['Kc'],
    rational: st => {
      const l = lagPart(st);
      return { num: pScale(l.num, st.Kc), den: l.den };
    },
    texNum: st => `${nT(st.Kc)}${partTeX(lagPart(st))}`,
  },
  leadlag: {
    label: 'Lead-lag compensator',
    name: 'Lead-lag',
    kind: 'tf',
    p: ['Kc', 'T1', 'alpha', 'T2', 'beta'],
    gain: ['Kc'],
    rational: st => {
      const a = leadPart(st),
        b = lagPart(st);
      return { num: pScale(pMul(a.num, b.num), st.Kc), den: pMul(a.den, b.den) };
    },
    texNum: st => `${nT(st.Kc)}${partTeX(leadPart(st))}\\cdot${partTeX(lagPart(st))}`,
  },
  custom: {
    label: 'Enter transfer function',
    name: 'Transfer function',
    kind: 'tf',
    p: [],
    gain: [],
    rational: st => ({ num: st.ccNum, den: st.ccDen }),
    texNum: st => ratTeX(st.ccNum, st.ccDen),
    unstable: st => !!st.ccUnstable,
  },
};
const ctrlKeys = Object.keys(CONTROLLERS);
// Groups and tables derived from CONTROLLERS
export const PID_MODES: string[] = ctrlKeys.filter(k => CONTROLLERS[k].kind === 'pid'),
  COMP_MODES: string[] = ctrlKeys.filter(k => CONTROLLERS[k].kind === 'tf' && k !== 'custom'); // lead/lag type
export const MODE_PARAMS: Record<string, NumKey[]> = Object.fromEntries(ctrlKeys.map(k => [k, CONTROLLERS[k].p]));
export const MODE_NAMES: Record<string, string> = Object.fromEntries(ctrlKeys.map(k => [k, CONTROLLERS[k].name]));
// Controllers handled as transfer functions (lead, lag, custom)
export const isTFMode = (st: State = S) => CONTROLLERS[st.mode].kind === 'tf';
// Whether a PID-type controller has the P, I or D term
const TERM_GAIN = { P: 'Kp', I: 'Ki', D: 'Kd' } as const;
export const hasTerm = (st: State, t: 'P' | 'I' | 'D') =>
  CONTROLLERS[st.mode].kind === 'pid' && CONTROLLERS[st.mode].p.includes(TERM_GAIN[t]);
// Initial value of parameter k for controller kind m
export const ctrlDefault = (m: string, k: NumKey): number => CONTROLLERS[m]?.defaults?.[k] ?? CTRL[k].val;
// Switching from kind prev to kind next: a parameter still at the initial value of prev gets the initial value
// of next (a value changed by hand is kept)
export function switchDefaults(prev: string, next: string, st: State = S): NumKey[] {
  const keys = [
      ...new Set([
        ...Object.keys(CONTROLLERS[prev]?.defaults ?? {}),
        ...Object.keys(CONTROLLERS[next]?.defaults ?? {}),
      ]),
    ] as NumKey[],
    changed = keys.filter(k => st[k] === ctrlDefault(prev, k) && ctrlDefault(next, k) !== st[k]);
  changed.forEach(k => (st[k] = ctrlDefault(next, k)));
  return changed; // the parameters whose inputs need to show the new value
}
export function ctrlRational(st: State = S): Rational {
  return CONTROLLERS[st.mode].rational(st);
}
export const REFP: ParamDefs = {
  R: { label: '', min: -2, max: 2, step: 0.1, val: 1 },
  rT0: { label: 'Start time \\(t_0\\) [s]', min: 0, max: 100, step: 0.5, val: 0 },
  rPer: { label: 'Period \\(T_p\\) [s]', min: 0.2, max: 50, step: 0.1, val: 5 },
  rW: { label: '', min: 0.1, max: 50, step: 0.1, val: 2 },
};
/** Kind of reference: name, label of its amplitude R, label of its width W, extra parameters, formula */
interface RefType {
  name: string;
  R: string;
  W?: string;
  p: NumKey[];
  tex: string;
}
export const REF_TYPES: Record<string, RefType> = {
  step: { name: 'Step', R: 'amplitude \\(r_0\\)', p: ['rT0'], tex: 'r(t)=r_0\\quad(t\\ge t_0)' },
  ramp: {
    name: 'Ramp (constant velocity)',
    R: 'slope \\(v\\) [1/s]',
    p: ['rT0'],
    tex: 'r(t)=v\\,(t-t_0)\\quad(t\\ge t_0)',
  },
  parab: {
    name: 'Parabola (constant acceleration)',
    R: 'acceleration \\(a\\) [1/s\\(^2\\)]',
    p: ['rT0'],
    tex: 'r(t)=\\tfrac{a}{2}(t-t_0)^2\\quad(t\\ge t_0)',
  },
  trap: {
    name: 'Trapezoid (ramp, then hold)',
    R: 'final value \\(r_0\\)',
    W: 'Ramp time \\(T_w\\) [s]',
    p: ['rT0', 'rW'],
    tex: 'r(t)=r_0\\min\\{(t-t_0)/T_w,\\,1\\}\\quad(t\\ge t_0)',
  },
  pulse: {
    name: 'Pulse (single)',
    R: 'height \\(r_0\\)',
    W: 'Width \\(T_w\\) [s]',
    p: ['rT0', 'rW'],
    tex: 'r(t)=r_0\\quad(t_0\\le t<t_0+T_w)',
  },
  square: {
    name: 'Square wave',
    R: 'amplitude \\(r_0\\) (alternates between 0 and \\(r_0\\))',
    p: ['rT0', 'rPer'],
    tex: 'r(t)=\\begin{cases}r_0&(0\\le\\tau<T_p/2)\\\\0&(T_p/2\\le\\tau<T_p)\\end{cases},\\ \\tau=(t-t_0)\\bmod T_p',
  },
  sine: {
    name: 'Sine wave',
    R: 'amplitude \\(A\\)',
    p: ['rT0', 'rPer'],
    tex: 'r(t)=A\\sin\\dfrac{2\\pi(t-t_0)}{T_p}\\quad(t\\ge t_0)',
  },
};
export function refValue(t: number, st: State = S): number {
  const R = st.R,
    tau = t - st.rT0;
  if (tau < 0) return 0;
  switch (st.refType) {
    case 'ramp':
      return R * tau;
    case 'parab':
      return 0.5 * R * tau * tau;
    case 'trap':
      return R * Math.min(tau / st.rW, 1);
    case 'pulse':
      return tau < st.rW ? R : 0;
    case 'square':
      return tau % st.rPer < st.rPer / 2 ? R : 0;
    case 'sine':
      return R * Math.sin((2 * Math.PI * tau) / st.rPer);
    default:
      return R;
  }
}
export const INPUTS: ParamDefs = {
  noise: { label: 'Measurement noise std. dev. \\(\\sigma_n\\)', min: 0, max: 0.2, step: 0.005, val: 0 },
};
export const DIST: ParamDefs = {
  d: { label: 'Disturbance magnitude \\(d\\)', min: -2, max: 2, step: 0.05, val: 0.5 },
  td: { label: 'Disturbance time [s]', min: 0, max: 100, step: 0.5, val: 10 },
};
export const TDOF: ParamDefs = {
  bw: { label: 'Set-point weight on P \\(b\\)', min: 0, max: 1, step: 0.05, val: 1 },
  cw: { label: 'Set-point weight on D \\(c\\)', min: 0, max: 1, step: 0.05, val: 0 },
};
export const SAT: ParamDefs = {
  umax: { label: 'Saturation limit \\(|u|\\le u_{\\max}\\)', min: 0.2, max: 20, step: 0.1, val: 3 },
};

/* ---- Kinds of plant ----
   To add a kind of plant, add an entry to PLANTS (and its new parameters to PARAMS and HARD). The menu, the
   sliders, the formulas, simulation, frequency response, tuning rules and scenario files all follow from the
   entry; give the menu label's translations in i18n.json. */
interface PlantType {
  /** name in the menu (English; translated) */
  name: string;
  /** parameters shown as sliders */
  p: NumKey[];
  /** formula with symbols (null: entered as a transfer function) */
  tex: string | null;
  /** right-hand side of P(s)= with the numbers substituted */
  texNum: (p: State) => string;
  /** transfer function, with the dead time L */
  tf: (p: State) => TF;
  /** the plant alone is unstable (counts in the Nyquist criterion) */
  unstable?: (p: State) => boolean;
}
const deadTeX = (L: number) => (L > 0 ? `\\,e^{-${nT(L)}s}` : ''); // e^{-Ls}
const secondTF = (p: State): TF => ({ num: [p.K * p.wn * p.wn], den: [1, 2 * p.zeta * p.wn, p.wn * p.wn], L: 0 });
export const PLANTS: Record<string, PlantType> = {
  first: {
    name: 'First-order lag',
    p: ['K', 'T'],
    tex: 'P(s)=\\dfrac{K}{Ts+1}',
    texNum: p => `\\dfrac{${nT(p.K)}}{${cT(p.T)}s+1}`,
    tf: p => ({ num: [p.K], den: [p.T, 1], L: 0 }),
  },
  second: {
    name: 'Second-order system',
    p: ['K', 'zeta', 'wn'],
    tex: 'P(s)=\\dfrac{K\\omega_n^2}{s^2+2\\zeta\\omega_n s+\\omega_n^2}',
    texNum: p => {
      const tf = secondTF(p);
      return ratTeX(tf.num, tf.den);
    },
    tf: secondTF,
  },
  third: {
    name: 'Third-order lag (equal time constants)',
    p: ['K', 'T'],
    tex: 'P(s)=\\dfrac{K}{(Ts+1)^3}',
    texNum: p => `\\dfrac{${nT(p.K)}}{(${cT(p.T)}s+1)^3}`,
    tf: p => ({ num: [p.K], den: [p.T ** 3, 3 * p.T ** 2, 3 * p.T, 1], L: 0 }),
  },
  dead: {
    name: 'First-order lag + dead time',
    p: ['K', 'T', 'L'],
    tex: 'P(s)=\\dfrac{K}{Ts+1}e^{-Ls}',
    texNum: p => `\\dfrac{${nT(p.K)}}{${cT(p.T)}s+1}${deadTeX(p.L)}`,
    tf: p => ({ num: [p.K], den: [p.T, 1], L: p.L }),
  },
  integ: {
    name: 'Integrator + first-order lag',
    p: ['K', 'T'],
    tex: 'P(s)=\\dfrac{K}{s(Ts+1)}',
    texNum: p => `\\dfrac{${nT(p.K)}}{s(${cT(p.T)}s+1)}`,
    tf: p => ({ num: [p.K], den: [p.T, 1, 0], L: 0 }),
  },
  unstable: {
    name: 'Unstable first-order',
    p: ['K', 'T'],
    tex: 'P(s)=\\dfrac{K}{Ts-1}',
    texNum: p => `\\dfrac{${nT(p.K)}}{${cT(p.T)}s-1}`,
    tf: p => ({ num: [p.K], den: [p.T, -1], L: 0 }),
    unstable: () => true,
  },
  // Entered as a transfer function; its inputs are built by buildPlant
  custom: {
    name: 'Enter transfer function',
    p: ['L'],
    tex: null,
    texNum: p => `${ratTeX(p.cNum, p.cDen)}${deadTeX(p.L)}`,
    tf: p => ({ num: p.cNum, den: p.cDen, L: p.L }),
    unstable: p => !!p.cUnstable,
  },
};
/* ---- Plots ----
   To add a plot, put its canvas in a <div class="plot-wrap"> of index.html (with a <div class="hgrip"> below it for
   its height), add an entry to PLOTS (and its label's translations in i18n.json) and draw it in update().
   Zoomable plots get the wheel and drag zoom and the ＋ − Fit PNG buttons; PNG saving, hiding the area and
   the hidden-area handle follow from the entry. */
interface PlotDef {
  /** name on the handle of the area while it is hidden (English; translated) */
  label: string;
  /** name of the PNG file, without the extension */
  file: string;
  /** zoomed with the wheel, by dragging and with the buttons (the pole-zero map has its own controls) */
  zoom: boolean;
  /** plot sharing the horizontal axis (zoomed together) */
  linkX?: string;
  /** both axes zoom together (equal scales) */
  keepAspect?: boolean;
}
export const PLOTS: Record<string, PlotDef> = {
  cvY: { label: 'Output y(t) plot', file: 'output_y', zoom: true, linkX: 'cvU' },
  cvU: { label: 'Control input u(t) plot', file: 'control_input_u', zoom: true, linkX: 'cvY' },
  cvG: { label: 'Gain plot', file: 'bode_gain', zoom: true, linkX: 'cvPh' },
  cvPh: { label: 'Phase plot', file: 'bode_phase', zoom: true, linkX: 'cvG' },
  cvN: { label: 'Nyquist plot', file: 'nyquist', zoom: true, keepAspect: true },
  cvPZ: { label: 'Pole-zero map plot', file: 'pole_zero_map', zoom: false },
};
export const EXAMPLES: { label: string; n: string; d: string }[] = [
  { label: 'Third-order', n: '1', d: '(s+1)(0.5s+1)(0.2s+1)' },
  { label: 'Lightly damped', n: '4', d: 's^2 + 0.2s + 4' },
  { label: 'Non-minimum phase', n: '-0.5s + 1', d: '(s+1)^2' },
  { label: 'Type 1 (integrator)', n: 's + 2', d: 's(s+1)(s+3)' },
  { label: 'Coefficient vector', n: '[2 1]', d: '[1 4 6 4 1]' },
];

/* ---- Cards of the settings panel ----
   Chosen one at a time from three drop-down lists (System setup, Analysis & design, File); only the chosen card is
   shown. The keys follow the order of the cards in src/index.html. */
export const CARD_KEYS: string[] = ['plant', 'ctrl', 'input', 'sat', 'spec', 'tune', 'sweep', 'scen', 'compare'];
// The drop-down list of each card
export const CARD_GROUP: Record<string, string> = {
  plant: 'sys',
  ctrl: 'sys',
  input: 'sys',
  sat: 'sys',
  spec: 'ana',
  tune: 'ana',
  sweep: 'ana',
  scen: 'file',
  compare: 'file',
};
export const CARD_GROUPS = ['sys', 'ana', 'file'];
// The card to show from stored data: a known card, else the first card of the stored group (stab, the tab of the
// versions before 1.60), else the plant
export function sideCardOf(scard: unknown, stab?: unknown): string {
  if (typeof scard === 'string' && CARD_KEYS.includes(scard)) return scard;
  return CARD_KEYS.find(k => CARD_GROUP[k] === stab) ?? 'plant';
}
