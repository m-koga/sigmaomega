// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= PID tuning rules ================= */
import { T } from './02-i18n.ts';
import { cdiv, cmul, lastOf, polyRoots, trimPoly } from './03-math.ts';
import { PLANTS } from './05-definitions.ts';
import { S } from './06-state.ts';
import { bodeSeries, evalPr, freqRange } from './07-frequency.ts';
import { discretize, makeSS, mulberry32, ssOut, ssStepD } from './08-simulation.ts';

/** A tuning rule or plant model that cannot be applied: why (a code for tuneErr) */
interface TuneFail {
  err: string;
}
/** Reaction-curve model: max slope R, apparent dead time L, gain K and time constant T (null with an integrator), sign, time scale */
interface StepModel {
  err?: undefined;
  kind: 'step';
  R: number;
  L: number;
  K: number | null;
  T: number | null;
  sgn: number;
  tau: number;
}
/** Ultimate gain Ku, period Pu and frequency wu, sign of the DC gain */
interface UltimateModel {
  err?: undefined;
  kind: 'ult';
  Ku: number;
  Pu: number;
  wu: number;
  sgn: number;
}
type PlantModel = StepModel | UltimateModel;
/** Gains of the standard form (Kp, Ti, Td) and the IMC filter time constant λ */
interface TuneGains {
  Kp: number;
  Ti?: number;
  Td?: number;
  lam?: number;
}
/** Result of a tuning rule, with the model it used (or why it cannot be applied) */
export type TuneResult =
  (TuneGains & { err?: undefined; model: PlantModel }) | { err: string; model: PlantModel | TuneFail };
/* ---- Tuning rules ----
   To add a rule, add an entry to TUNE_RULES with its menu name (and its translations in i18n.json), the plant
   model it uses and its gains for each controller type; the menu, the checks and the result follow from it. */
type TuneType = 'P' | 'PI' | 'PID';
export const TUNE_TYPES: TuneType[] = ['P', 'PI', 'PID'];
interface RuleBase {
  /** name in the menu (English; translated) */
  label: string;
  /** the rule needs the time constant T of the model (not defined for a plant with an integrator) */
  needT?: boolean;
  /** the rule needs an apparent dead time L > 0 (its gain is infinite without one) */
  needDead?: boolean;
}
/** A rule from the reaction-curve model (StepModel) or from the ultimate gain and period (UltimateModel):
    gains of the standard form for the controller type (positive DC gain; the sign is applied by tuneRule),
    or why the rule cannot give that type. lam: IMC filter time constant (null: automatic) */
type TuneRuleDef =
  | (RuleBase & { model: 'step'; gains: (m: StepModel, type: TuneType, lam: number | null) => TuneGains | TuneFail })
  | (RuleBase & { model: 'ult'; gains: (m: UltimateModel, type: TuneType) => TuneGains | TuneFail });
// Rule given as a table of rows [P: Kp·R·L], [PI: Kp·R·L, Ti], [PID: Kp·R·L, Ti, Td] (Ti, Td from L and T)
const reactionRule =
  (rows: (L: number, T: number) => number[][]) =>
  (m: StepModel, type: TuneType): TuneGains => {
    const tab = rows(m.L, m.T ?? 0)[TUNE_TYPES.indexOf(type)], // T is used only by rules that need it (checked)
      r: TuneGains = { Kp: tab[0] / (m.R * m.L) };
    if (tab[1] !== undefined) r.Ti = tab[1];
    if (tab[2] !== undefined) r.Td = tab[2];
    return r;
  };
export const TUNE_RULES: Record<string, TuneRuleDef> = {
  'zn-step': {
    label: 'Ziegler–Nichols (step response)',
    model: 'step',
    needDead: true,
    gains: reactionRule(L => [[1], [0.9, (10 * L) / 3], [1.2, 2 * L, 0.5 * L]]),
  },
  'zn-ult': {
    label: 'Ziegler–Nichols (ultimate sensitivity)',
    model: 'ult',
    gains: (u, type) =>
      type === 'P'
        ? { Kp: 0.5 * u.Ku }
        : type === 'PI'
          ? { Kp: 0.45 * u.Ku, Ti: u.Pu / 1.2 }
          : { Kp: 0.6 * u.Ku, Ti: u.Pu / 2, Td: u.Pu / 8 },
  },
  'chr-sp0': {
    label: 'CHR (set-point, 0% overshoot)',
    model: 'step',
    needDead: true,
    needT: true,
    gains: reactionRule((L, T) => [[0.3], [0.35, 1.2 * T], [0.6, T, 0.5 * L]]),
  },
  'chr-sp20': {
    label: 'CHR (set-point, 20% overshoot)',
    model: 'step',
    needDead: true,
    needT: true,
    gains: reactionRule((L, T) => [[0.7], [0.6, T], [0.95, 1.4 * T, 0.47 * L]]),
  },
  'chr-ld0': {
    label: 'CHR (disturbance, 0% overshoot)',
    model: 'step',
    needDead: true,
    gains: reactionRule(L => [[0.3], [0.6, 4 * L], [0.95, 2.4 * L, 0.42 * L]]),
  },
  'chr-ld20': {
    label: 'CHR (disturbance, 20% overshoot)',
    model: 'step',
    needDead: true,
    gains: reactionRule(L => [[0.7], [0.7, 2.3 * L], [1.2, 2 * L, 0.42 * L]]),
  },
  imc: {
    label: 'IMC (first-order lag + dead time model)',
    model: 'step',
    needT: true,
    gains: (m, type, lam) => {
      if (type === 'P') return { err: 'noP' };
      const K = m.K ?? 0, // K and T are defined: the rule needs T (checked by tuneRule)
        T = m.T ?? 0,
        L = m.L,
        l = lam !== null && lam > 0 ? lam : Math.max(type === 'PI' ? 1.7 * L : 0.8 * L, 0.25 * T),
        r: TuneGains =
          type === 'PI'
            ? { Kp: (2 * T + L) / (2 * K * l), Ti: T + L / 2 }
            : { Kp: (2 * T + L) / (K * (2 * l + L)), Ti: T + L / 2, Td: (T * L) / (2 * T + L) };
      r.lam = l;
      return r;
    },
  },
};
export const TUNE_METHODS = Object.keys(TUNE_RULES);
export const tuneLabel = (m: string) => T(TUNE_RULES[m].label);
export function tuneErr(code: string): string {
  switch (code) {
    case 'unstable':
      return T('Not applicable: the plant is unstable.');
    case 'dc0':
      return T('Not applicable: the DC gain of the plant is zero.');
    case 'noDead':
      return T(
        'Not applicable: the apparent dead time L is almost zero, so this rule gives an infinite gain. Try IMC, or a plant of higher order or with dead time.',
      );
    case 'needT':
      return T(
        'Not applicable: this rule needs the time constant T, which is not defined for a plant with an integrator.',
      );
    case 'noCross':
      return T('Not applicable: the phase of P(jω) does not reach −180°, so the ultimate gain is infinite.');
    default:
      return T('IMC tuning gives PI or PID controllers. Select PI or PID.');
  }
}
// Plant poles: unstable (Re > 0, or on the imaginary axis other than a single integrator), integrator, slowest stable pole
export function plantPoleInfo(tf: TF): { unstable: boolean; integ: boolean; smin: number | null } {
  const rs = polyRoots(trimPoly(tf.den)),
    tiny = (z: Complex) => Math.hypot(z[0], z[1]) < 1e-9;
  const nz = rs.filter(tiny).length,
    others = rs.filter(z => !tiny(z));
  const unstable = nz > 1 || others.some(z => z[0] > -1e-9);
  return { unstable, integ: nz === 1, smin: others.length ? Math.min(...others.map(z => -z[0])) : null };
}
// Reaction-curve model from the unit step response of P(s): tangent at the steepest point
// returns {R (max slope), L (apparent dead time, including the plant dead time), K, T (null with an integrator), sgn}
export function plantStepModel(st: State = S): StepModel | TuneFail {
  const tf = PLANTS[st.plant].tf(st),
    num = trimPoly(tf.num),
    den = trimPoly(tf.den),
    pi = plantPoleInfo(tf);
  if (pi.unstable) return { err: 'unstable' };
  if (pi.smin === null) return { err: 'noDead' };
  const K = pi.integ ? null : lastOf(num) / lastOf(den);
  if (K !== null && Math.abs(K) < 1e-12) return { err: 'dc0' };
  const N = 4000,
    h = 12 / pi.smin / N,
    ss = discretize(makeSS(num, den), h);
  let x = new Array(ss.n).fill(0);
  const y = [ssOut(ss, x, 1)];
  for (let i = 1; i <= N; i++) {
    x = ssStepD(ss, x, 1);
    y.push(ssOut(ss, x, 1));
  }
  const sgn = K !== null ? Math.sign(K) : Math.sign(y[N] - y[N - 1]) || 1;
  let R = -Infinity,
    ti = 0,
    yi = 0;
  for (let i = 0; i < N; i++) {
    const s = (sgn * (y[i + 1] - y[i])) / h;
    if (s > R) {
      R = s;
      ti = (i + 0.5) * h;
      yi = (sgn * (y[i] + y[i + 1])) / 2;
    }
  }
  if (!(R > 0)) return { err: 'dc0' };
  const L0 = Math.max(0, ti - yi / R),
    L = L0 + tf.L,
    tau = K !== null ? Math.abs(K) / R : 1 / pi.smin;
  return { kind: 'step', R, L, K: K !== null ? Math.abs(K) : null, T: K !== null ? Math.abs(K) / R : null, sgn, tau };
}
// Ultimate gain and period: the frequency where the phase of P(jω) (including dead time) reaches −180°
export function plantUltimate(st: State = S): UltimateModel | TuneFail {
  const tf = PLANTS[st.plant].tf(st),
    pi = plantPoleInfo(tf);
  if (pi.unstable) return { err: 'unstable' };
  const num = trimPoly(tf.num),
    den = trimPoly(tf.den);
  const g0 = pi.integ ? lastOf(num) / lastOf(den, 2) : lastOf(num) / lastOf(den);
  if (Math.abs(g0) < 1e-12) return { err: 'dc0' };
  const sgn = Math.sign(g0),
    [a, b] = freqRange(tf, st),
    lo = a - 2,
    hi = b + 2,
    NW = Math.round(400 * (hi - lo));
  const W: number[] = [];
  for (let i = 0; i < NW; i++) W.push(Math.pow(10, lo + ((hi - lo) * i) / (NW - 1)));
  const sr = bodeSeries(
    W,
    (w): Complex => {
      const p = evalPr(w, tf);
      return [sgn * p[0], sgn * p[1]];
    },
    tf.L,
  );
  for (let i = 1; i < NW; i++) {
    if (sr.ph[i - 1] > -180 && sr.ph[i] <= -180) {
      const t = (sr.ph[i - 1] + 180) / (sr.ph[i - 1] - sr.ph[i]);
      const wu = Math.pow(10, Math.log10(W[i - 1]) + t * (Math.log10(W[i]) - Math.log10(W[i - 1])));
      const md = sr.mag[i - 1] + t * (sr.mag[i] - sr.mag[i - 1]);
      return { kind: 'ult', Ku: Math.pow(10, -md / 20), Pu: (2 * Math.PI) / wu, wu, sgn };
    }
  }
  return { err: 'noCross' };
}
// Apply a tuning rule. type: 'P' | 'PI' | 'PID'; lam: IMC filter time constant (null = automatic)
// returns {Kp, Ti, Td, lam, model} or {err, model}
export function tuneRule(method: string, type: string, lam: number | null = null, st: State = S): TuneResult {
  const rule = TUNE_RULES[method],
    tt = (TUNE_TYPES as string[]).includes(type) ? (type as TuneType) : 'PID';
  let r: TuneGains | TuneFail, m: PlantModel;
  if (rule.model === 'ult') {
    const u = plantUltimate(st);
    if (u.err !== undefined) return { err: u.err, model: u };
    m = u;
    r = rule.gains(u, tt);
  } else {
    const sm = plantStepModel(st);
    if (sm.err !== undefined) return { err: sm.err, model: sm };
    m = sm;
    if (rule.needDead && sm.L < 1e-3 * sm.tau) return { err: 'noDead', model: m };
    if (rule.needT && sm.T === null) return { err: 'needT', model: m };
    r = rule.gains(sm, tt, lam);
  }
  if ('err' in r) return { err: r.err, model: m };
  r.Kp *= m.sgn;
  return { ...r, model: m };
}
// Gains of the parallel form C(s) = KP + KI/s + KD s/(s/N+1)
export const tuneGains = (r: TuneGains) => ({ Kp: r.Kp, Ki: r.Ti ? r.Kp / r.Ti : 0, Kd: r.Td ? r.Kp * r.Td : 0 });

/* ---- Lead and lag compensator design from the frequency response (the classical steps) ---- */
/** Settings of the design: the kind, the target phase margin [deg], the gain Kc (chosen for the steady-state error)
 *  and the allowance θ [deg] (lead: extra phase for the shift of the crossover; lag: for the lag's own phase lag) */
export interface CompSettings {
  method: string;
  pm: number;
  kc: number;
  theta: number;
  /** lead-lag: the new gain crossover [rad/s]; null: where the phase of Kc P is −180° */
  wc: number | null;
}
/** Result of the design. wgc0, pm0: crossover and phase margin of Kc P(s); lead: phiM (phase to add), alpha, wm (the
 *  new crossover where |Kc P| = √α), T1; lag: phiT (phase at the new crossover), wg, beta = |Kc P(jwg)|, T2 = 10/wg;
 *  wgc, pm: the crossover and phase margin of C(s) P(s) with the designed C. err: no crossover of Kc P, not needed
 *  (the target is already met), too much phase for one lead stage (φm > 80°), or no frequency found */
export interface CompDesign {
  wgc0: number | null;
  pm0: number | null;
  phiM?: number;
  alpha?: number;
  wm?: number;
  T1?: number;
  phiT?: number;
  wg?: number;
  /** lead-lag: the new crossover (given or where the phase of Kc P is −180°), with the gain [dB] and phase of Kc P
   *  there; the lead adds φm there (centred on it), the lag lowers the gain by β = |Kc P|/√α, T2 = 10/ωc */
  wc?: number;
  wcAuto?: boolean;
  gcDb?: number;
  phc?: number;
  beta?: number;
  T2?: number;
  wgc: number | null;
  pm: number | null;
  err?: 'no-crossover' | 'not-needed' | 'too-much' | 'no-frequency' | 'lead-not-needed' | 'lag-not-needed';
}
// The frequency response of g(ω) on a log grid: frequencies, gains [dB] and phases [deg] unwrapped from the lowest
function compGrid(st: State, g: (w: number) => Complex) {
  const tf = PLANTS[st.plant].tf(st),
    [a, b] = freqRange(tf, st),
    n = 6000,
    W: number[] = [],
    db: number[] = [],
    ph: number[] = [];
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.pow(10, a - 2 + ((b - a + 4) * i) / (n - 1)),
      z = g(w);
    let p = (Math.atan2(z[1], z[0]) * 180) / Math.PI;
    if (i > 0) p -= 360 * Math.round((p - prev) / 360);
    prev = p;
    W.push(w);
    db.push(20 * Math.log10(Math.hypot(z[0], z[1])));
    ph.push(p);
  }
  return { W, db, ph };
}
// The first frequency (from below) where v crosses the level from above, by linear interpolation in log ω, with the
// other quantity interpolated there; null when it does not cross
function crossDown(W: number[], v: number[], level: number, other: number[]): { w: number; o: number } | null {
  for (let i = 1; i < W.length; i++)
    if (v[i - 1] >= level && v[i] < level) {
      const u = (v[i - 1] - level) / (v[i - 1] - v[i]);
      return {
        w: Math.pow(10, Math.log10(W[i - 1]) + u * (Math.log10(W[i]) - Math.log10(W[i - 1]))),
        o: other[i - 1] + u * (other[i] - other[i - 1]),
      };
    }
  return null;
}
// Gain crossover and phase margin of g (180° + the phase there, taken in (−180°, 180°] around −180°)
function crossover(st: State, g: (w: number) => Complex): { wgc: number | null; pm: number | null } {
  const r = compGrid(st, g),
    c = crossDown(r.W, r.db, 0, r.ph);
  if (!c) return { wgc: null, pm: null };
  return { wgc: c.w, pm: 180 + c.o - 360 * Math.round((180 + c.o) / 360) };
}
/** What the design of each kind starts from: the settings, Kc P(jω) and its response on a grid, the result so far,
 *  and verify(C), which puts the crossover and phase margin of C(s) P(s) into the result */
interface CompContext {
  cs: CompSettings;
  G: (w: number) => Complex;
  g0: ReturnType<typeof compGrid>;
  pm0: number;
  out: CompDesign;
  verify: (C: (w: number) => Complex) => void;
}
// C(s) of a lead (T₁s + 1)/(αT₁s + 1) or lag (T₂s + 1)/(βT₂s + 1) stage at jω
const stage = (w: number, T: number, r: number): Complex => cdiv([1, w * T], [1, w * r * T]);
// α of a lead stage that adds the phase φm [deg] at its centre
const leadAlpha = (phiM: number) => {
  const s = Math.sin((phiM * Math.PI) / 180);
  return (1 - s) / (1 + s);
};
// Lead: the phase to add φm = PM* − PM + θ, α, the new crossover ωm where |Kc P| = √α, T₁ = 1/(ωm √α)
function designLead({ cs, g0, pm0, out, verify }: CompContext): CompDesign {
  const phiM = cs.pm - pm0 + cs.theta;
  out.phiM = phiM;
  if (phiM <= 0) return { ...out, err: 'not-needed' };
  if (phiM > 80) return { ...out, err: 'too-much' };
  const alpha = leadAlpha(phiM),
    m = crossDown(g0.W, g0.db, 10 * Math.log10(alpha), g0.ph);
  out.alpha = alpha;
  if (!m) return { ...out, err: 'no-frequency' };
  out.wm = m.w;
  const T1 = (out.T1 = 1 / (m.w * Math.sqrt(alpha)));
  verify(w => cmul([cs.kc, 0], stage(w, T1, alpha)));
  return out;
}
// Lag: the new crossover where the phase of Kc P is −180° + PM* + θ, β = |Kc P| there, T₂ = 10/ω
function designLag({ cs, g0, out, verify }: CompContext): CompDesign {
  const phiT = (out.phiT = -180 + cs.pm + cs.theta),
    c = crossDown(g0.W, g0.ph, phiT, g0.db);
  if (!c) return { ...out, err: 'no-frequency' };
  out.wg = c.w;
  const beta = (out.beta = Math.pow(10, c.o / 20));
  if (beta <= 1) return { ...out, err: 'not-needed' };
  const T2 = (out.T2 = 10 / c.w);
  verify(w => cmul([cs.kc, 0], stage(w, T2, beta)));
  return out;
}
// Lead-lag: the new crossover ωc (given, or the phase crossover of Kc P), the lead centred there adding the phase
// missing at ωc, and the lag lowering the gain there by β = |Kc P(jωc)|/√α
function designLeadLag({ cs, G, g0, out, verify }: CompContext): CompDesign {
  let wc = cs.wc && cs.wc > 0 ? cs.wc : null;
  out.wcAuto = wc === null;
  if (wc === null) {
    const c = crossDown(g0.W, g0.ph, -180, g0.db);
    if (!c) return { ...out, err: 'no-frequency' };
    wc = c.w;
  }
  out.wc = wc;
  const z = G(wc),
    unwrap = crossDown(
      g0.W,
      g0.W.map(w => -w),
      -wc,
      g0.ph,
    ), // the plotted (unwrapped) phase at ωc
    // the phase there: exactly −180° at the phase crossover, otherwise on the branch of the plotted phase
    phc = out.wcAuto ? -180 : unwrap ? unwrap.o : (Math.atan2(z[1], z[0]) * 180) / Math.PI,
    gc = Math.hypot(z[0], z[1]);
  out.gcDb = 20 * Math.log10(gc);
  out.phc = phc;
  const phiM = (out.phiM = cs.pm + cs.theta - (180 + phc));
  if (phiM <= 0) return { ...out, err: 'lead-not-needed' };
  if (phiM > 80) return { ...out, err: 'too-much' };
  const alpha = (out.alpha = leadAlpha(phiM)),
    T1 = (out.T1 = 1 / (wc * Math.sqrt(alpha))),
    beta = (out.beta = gc / Math.sqrt(alpha));
  if (beta <= 1) return { ...out, err: 'lag-not-needed' };
  const T2 = (out.T2 = 10 / wc);
  verify(w => cmul(cmul([cs.kc, 0], stage(w, T1, alpha)), stage(w, T2, beta)));
  return out;
}
/* The kinds of compensator design, in the order of their menu. To add one: an entry here (its design function, and
   the controller it sets: a kind of CONTROLLERS with its parameters), and its steps in COMP_STEPS (17-panels.ts).
     label: its item in the menu (English); design: the classical steps; params: the parameters of the controller
     taken from the result; askWc: the new crossover ωc can be given */
export const COMP_METHODS = {
  lead: { label: 'Lead compensator', design: designLead, params: ['T1', 'alpha'], askWc: false },
  lag: { label: 'Lag compensator', design: designLag, params: ['T2', 'beta'], askWc: false },
  leadlag: { label: 'Lead-lag compensator', design: designLeadLag, params: ['T1', 'alpha', 'T2', 'beta'], askWc: true },
} as const satisfies Record<
  string,
  { label: string; design: (c: CompContext) => CompDesign; params: readonly NumKey[]; askWc: boolean }
>;
export type CompMethod = keyof typeof COMP_METHODS;
export const isCompMethod = (m: unknown): m is CompMethod =>
  typeof m === 'string' && Object.prototype.hasOwnProperty.call(COMP_METHODS, m);
// The design for the settings cs: the crossover and phase margin of Kc P(s), then the steps of its kind
export function compDesign(cs: CompSettings, st: State = S): CompDesign {
  const tf = PLANTS[st.plant].tf(st),
    P = (w: number) => cmul(evalPr(w, tf), [Math.cos(-w * tf.L), Math.sin(-w * tf.L)]),
    G = (w: number): Complex => {
      const p = P(w);
      return [cs.kc * p[0], cs.kc * p[1]];
    };
  const g0 = compGrid(st, G),
    c0 = crossDown(g0.W, g0.db, 0, g0.ph),
    wgc0 = c0 ? c0.w : null,
    pm0 = c0 ? 180 + c0.o - 360 * Math.round((180 + c0.o) / 360) : null,
    out: CompDesign = { wgc0, pm0, wgc: null, pm: null };
  const verify = (C: (w: number) => Complex) => {
    Object.assign(
      out,
      crossover(st, w => cmul(C(w), P(w))),
    );
  };
  if (pm0 === null) return { ...out, err: 'no-crossover' };
  if (pm0 >= cs.pm) return { ...out, err: 'not-needed' };
  const m = isCompMethod(cs.method) ? cs.method : 'lag'; // (an unknown kind was designed as a lag)
  return COMP_METHODS[m].design({ cs, G, g0, pm0, out, verify });
}

/* ---- Estimation exercise: a hidden first-order lag + dead time plant ---- */
/** The hidden plant K e^{−Ls}/(Ts + 1) of exercise number n (the same number always gives the same plant):
 *  K in 0.5 … 3 (2 decimals), T in 0.5 … 5 s (1 decimal), L in 0.1 … min(2, T) s (steps of 0.05) */
export function exercisePlant(n: number): { K: number; T: number; L: number } {
  const r = mulberry32(Math.floor(Math.abs(n)) * 2654435761 + 97),
    K = Math.round((0.5 + 2.5 * r()) * 100) / 100,
    T = Math.round((0.5 + 4.5 * r()) * 10) / 10,
    L = Math.round((0.1 + (Math.min(2, T) - 0.1) * r()) * 20) / 20;
  return { K, T, L };
}
/** Unit step response of K e^{−Ls}/(Ts + 1) at time t */
export const fopdtStep = (p: { K: number; T: number; L: number }, t: number) =>
  t <= p.L ? 0 : p.K * (1 - Math.exp(-(t - p.L) / p.T));
/** Relative errors of the estimates (|estimate − true|/true) and whether each is within tol */
export function exerciseCheck(
  p: { K: number; T: number; L: number },
  e: { K: number; T: number; L: number },
  tol = 0.1,
) {
  const err = (k: 'K' | 'T' | 'L') => Math.abs(e[k] - p[k]) / p[k];
  const r = { K: err('K'), T: err('T'), L: err('L') };
  return { err: r, ok: { K: r.K <= tol, T: r.T <= tol, L: r.L <= tol } };
}

/* ---- Estimation exercise from the frequency response: one of three hidden plants ---- */
/** Kinds of hidden plant of the frequency-response exercise and the three values estimated for each:
 *  lags: K/((T1 s + 1)(T2 s + 1)); dead: K e^{−Ls}/(Ts + 1); second: K ωn²/(s² + 2ζωn s + ωn²) */
export const FREQ_EX_KEYS = {
  lags: ['K', 'T1', 'T2'],
  dead: ['K', 'T', 'L'],
  second: ['K', 'wn', 'zeta'],
} as const;
export type FreqExKind = keyof typeof FREQ_EX_KEYS;
export interface FreqExPlant {
  kind: FreqExKind;
  /** the three values, in the order of FREQ_EX_KEYS[kind] */
  v: [number, number, number];
}
const sig2 = (x: number) => Number(x.toPrecision(2));
/** The hidden plant of frequency-response exercise number n (the same number always gives the same plant):
 *  the kind at random; lags: K in 0.5 … 5, T1 in 1 … 10 s, T2 = T1/(5 … 20) (2 significant digits);
 *  dead: the ranges of the step-response exercise; second: K in 0.5 … 3, ωn in 0.5 … 10 rad/s (log-uniform,
 *  2 significant digits), ζ in 0.1 … 0.7 (steps of 0.05) */
export function freqExercisePlant(n: number): FreqExPlant {
  const r = mulberry32(Math.floor(Math.abs(n)) * 2246822519 + 31),
    kinds: FreqExKind[] = ['lags', 'dead', 'second'],
    kind = kinds[Math.min(2, Math.floor(3 * r()))];
  if (kind === 'lags') {
    const K = Math.round((0.5 + 4.5 * r()) * 100) / 100,
      T1 = Math.round((1 + 9 * r()) * 10) / 10;
    return { kind, v: [K, T1, sig2(T1 / (5 + 15 * r()))] };
  }
  if (kind === 'dead') {
    const K = Math.round((0.5 + 2.5 * r()) * 100) / 100,
      T = Math.round((0.5 + 4.5 * r()) * 10) / 10,
      L = Math.round((0.1 + (Math.min(2, T) - 0.1) * r()) * 20) / 20;
    return { kind, v: [K, T, L] };
  }
  const K = Math.round((0.5 + 2.5 * r()) * 100) / 100,
    wn = sig2(0.5 * 20 ** r()),
    zeta = Math.round((0.1 + 0.6 * r()) * 20) / 20;
  return { kind, v: [K, wn, zeta] };
}
/** Gain [dB] and phase [deg] (continuous) of the plant at angular frequency w */
export function freqExResponse(p: FreqExPlant, w: number): { db: number; ph: number } {
  const [K, a, b] = p.v,
    deg = 180 / Math.PI,
    lag = (T: number) => 10 * Math.log10(1 + (w * T) ** 2);
  if (p.kind === 'lags')
    return { db: 20 * Math.log10(K) - lag(a) - lag(b), ph: -(Math.atan(w * a) + Math.atan(w * b)) * deg };
  if (p.kind === 'dead') return { db: 20 * Math.log10(K) - lag(a), ph: -(Math.atan(w * a) + w * b) * deg };
  const u = w / a;
  return {
    db: 20 * Math.log10(K) - 10 * Math.log10((1 - u * u) ** 2 + (2 * b * u) ** 2),
    ph: -Math.atan2(2 * b * u, 1 - u * u) * deg,
  };
}
/** Frequency range drawn [rad/s]: whole decades from a decade below the lowest corner to beyond the highest */
export function freqExRange(p: FreqExPlant): [number, number] {
  const [, a, b] = p.v,
    [lo, hi] = p.kind === 'lags' ? [0.1 / a, 10 / b] : p.kind === 'dead' ? [0.1 / a, 10 / a] : [a / 100, a * 100];
  return [10 ** Math.floor(Math.log10(lo) + 1e-9), 10 ** Math.ceil(Math.log10(hi) - 1e-9)];
}
/** Relative errors of the estimates and whether each is within tol; T1 and T2 may be given in either order */
export function freqExCheck(p: FreqExPlant, e: [number, number, number], tol = 0.1) {
  let est = e;
  if (p.kind === 'lags' && (e[1] - e[2]) * (p.v[1] - p.v[2]) < 0) est = [e[0], e[2], e[1]];
  const err = p.v.map((x, i) => Math.abs(est[i] - x) / x) as [number, number, number];
  return { est, err, ok: err.map(x => x <= tol) as [boolean, boolean, boolean] };
}
