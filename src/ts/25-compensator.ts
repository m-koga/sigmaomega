// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Lead and lag compensator design from the frequency response (the classical steps) ================= */
import { cdiv, cmul } from './03-math.ts';
import { PLANTS } from './10-definitions.ts';
import { S } from './11-state.ts';
import { evalPr, freqRange } from './15-frequency.ts';
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
   the controller it sets: a kind of CONTROLLERS with its parameters), and its steps in COMP_STEPS (60-design-cards.ts).
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
