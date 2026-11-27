// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Second-order approximation of the closed loop by its dominant poles: the textbook formulas of the step response ================= */
import { lastOf } from './03-math.ts';
import { S } from './11-state.ts';
import { stepMetrics } from './16-simulation.ts';
import { computePZ, loopPoles, loopTFs } from './17-loop.ts';

/** Metrics of a step response, relative to its final value: overshoot [%], peak time, settling time (±2 %) and
 *  rise time (10–90 %) [s]; null where there is none */
export interface StepShape {
  os: number | null;
  tp: number | null;
  ts: number | null;
  tr: number | null;
}
/** The dominant poles and what the formulas give: kind 'pair' (a complex pair with ζ < 1) or 'real' (a real pole,
 *  first-order approximation). ratio: how many times farther from the imaginary axis the next pole is (null when
 *  there is none); zeros: the zeros of G_yr closer to the imaginary axis than 5 times the dominant poles, or in the
 *  right half-plane; cancelled: poles left out because a zero of G_yr nearly cancels them */
export interface DominantApprox {
  kind: 'pair' | 'real';
  p: Complex;
  zeta: number;
  wn: number;
  wd: number;
  tau: number;
  ratio: number | null;
  zeros: Complex[];
  cancelled: Complex[];
  approx: boolean;
  formula: StepShape;
}
const near = (a: Complex, b: Complex, rel: number) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= rel * Math.hypot(...a);
// The textbook formulas: a complex pair (overshoot e^{−πζ/√(1−ζ²)}, peak time π/ωd, settling time 4/(ζωn), rise time
// (1 + 1.039ζ − 0.417ζ² + 1.76ζ³)/ωn, a fit to the exact one for 0 < ζ < 0.9) or a real pole (no overshoot, settling time 4τ, rise time 2.2τ)
function formulas(kind: 'pair' | 'real', zeta: number, wn: number, wd: number, tau: number): StepShape {
  return kind === 'pair'
    ? {
        os: 100 * Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)),
        tp: Math.PI / wd,
        ts: 4 / (zeta * wn),
        tr: (1 + 1.039 * zeta - 0.417 * zeta ** 2 + 1.76 * zeta ** 3) / wn,
      }
    : { os: 0, tp: null, ts: 4 * tau, tr: 2.2 * tau };
}
/** The second-order (or first-order) approximation of the closed loop by its dominant poles, or null when the loop
 *  is not asymptotically stable */
export function dominantApprox(pz: PZResult = computePZ(), st: State = S): DominantApprox | null {
  const zs = loopPoles(st, pz).R.zeros;
  if (!pz.cl.length || pz.cl.some(p => p[0] >= -1e-9)) return null;
  // poles nearly cancelled by a zero of G_yr hardly show in the response to the reference
  const cancelled = pz.cl.filter(p => zs.some(z => near(p, z, 0.02))),
    real = (q: Complex) => Math.abs(q[1]) <= 1e-4 * Math.hypot(...q), // repeated real poles are found nearly real
    poles = pz.cl.filter(q => !cancelled.includes(q) && (q[1] > 0 || real(q))).sort((a, b) => b[0] - a[0]);
  if (!poles.length) return null;
  const p = poles[0],
    kind = real(p) ? 'real' : 'pair',
    wn = Math.hypot(...p),
    zeta = -p[0] / wn,
    wd = Math.abs(p[1]),
    tau = -1 / p[0],
    next = poles.slice(1).find(q => q[0] < p[0] * (1 + 1e-9));
  const zeros = zs.filter(
    z => (z[0] >= 0 || Math.abs(z[0]) < 5 * Math.abs(p[0])) && !cancelled.some(c => near(c, z, 0.02)),
  );
  return {
    kind,
    p,
    zeta,
    wn,
    wd,
    tau,
    ratio: next ? next[0] / p[0] : null,
    zeros,
    cancelled: cancelled.filter(c => c[1] > 0 || real(c)),
    approx: pz.pade,
    formula: formulas(kind, zeta, wn, wd, tau),
  };
}
/** The final value of the response to a step of the reference (amplitude R): R·G_yr(0), or null when it is infinite */
export function stepFinal(st: State = S): number | null {
  const g = loopTFs(st).R,
    d0 = (lastOf(g.den0) ?? 0) + (lastOf(g.den1) ?? 0);
  return Math.abs(d0) > 1e-12 ? (st.R * lastOf(g.num)) / d0 : null;
}
/** The step response of the approximation with the same final value yf, starting at t0, at the times t */
export function approxStep(a: DominantApprox, t: number[], yf: number, t0: number): number[] {
  return t.map(ti => {
    const u = ti - t0;
    if (u <= 0) return 0;
    if (a.kind === 'real') return yf * (1 - Math.exp(-u / a.tau));
    const b = Math.sqrt(1 - a.zeta * a.zeta);
    return yf * (1 - (Math.exp(-a.zeta * a.wn * u) / b) * Math.sin(a.wd * u + Math.acos(a.zeta)));
  });
}
/** The metrics of the simulated step response relative to its final value yf (as the formulas are), or null when the
 *  reference is not a step or there is no response */
export function simulatedShape(sim: SimResult, yf: number | null, st: State = S): StepShape | null {
  if (st.refType !== 'step' || yf === null || Math.abs(yf) < 1e-9 || sim.diverged) return null;
  const m = stepMetrics(sim, { ...st, R: yf });
  if (!m) return null;
  let k = -1;
  for (let i = 0; i < sim.T.length; i++)
    if (sim.T[i] >= st.rT0 && (!st.dOn || sim.T[i] < st.td) && (k < 0 || sim.Y[i] / yf > sim.Y[k] / yf)) k = i;
  return { os: m.os, tp: m.os > 0.01 && k >= 0 ? sim.T[k] - st.rT0 : null, ts: m.ts, tr: m.rise };
}
