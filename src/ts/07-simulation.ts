// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Simulation ================= */
import { PLANTS, ctrlRational, isTFMode, refValue, hasTerm } from './03-definitions.ts';
import { S } from './05-state.ts';
import { evalCP, evalT, freqRange, spWeights } from './08-frequency.ts';

export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Transfer function num/den (descending powers, proper) -> state space in controllable canonical form
export function makeSS(num: Poly, den: Poly): StateSpace {
  const a0 = den[0],
    n = den.length - 1;
  const dn = den.map(v => v / a0);
  const nm = new Array(n + 1).fill(0);
  num.forEach((v, i) => {
    nm[n + 1 - num.length + i] = v / a0;
  });
  const Dff = nm[0];
  const c = new Array(n).fill(0);
  for (let k = 0; k < n; k++) c[k] = nm[n - k] - Dff * dn[n - k];
  return { n, c, D: Dff, dn };
}
// Matrix exponential (scaling and squaring + Taylor series)
export function matMul(A: number[][], B: number[][]): number[][] {
  const n = A.length,
    m = B[0].length,
    q = B.length,
    C: number[][] = [];
  for (let i = 0; i < n; i++) {
    const r = new Array(m).fill(0);
    for (let k = 0; k < q; k++) {
      const a = A[i][k];
      if (a === 0) continue;
      for (let j = 0; j < m; j++) r[j] += a * B[k][j];
    }
    C.push(r);
  }
  return C;
}
export function expm(M: number[][]): number[][] {
  let nrm = 0;
  M.forEach(r => {
    nrm = Math.max(
      nrm,
      r.reduce((s, v) => s + Math.abs(v), 0),
    );
  });
  const sq = Math.max(0, Math.ceil(Math.log2(nrm || 1)) + 1),
    sc = Math.pow(2, -sq);
  const A = M.map(r => r.map(v => v * sc));
  let E: number[][] = A.map((r, i) => r.map((_, j) => (i === j ? 1 : 0))),
    T: number[][] = E.map(r => r.slice());
  for (let k = 1; k <= 16; k++) {
    T = matMul(T, A).map(r => r.map(v => v / k));
    E = E.map((r, i) => r.map((v, j) => v + T[i][j]));
  }
  for (let i = 0; i < sq; i++) E = matMul(E, E);
  return E;
}
// Exact discretization with the input held constant over each step (zero-order hold): x[k+1] = Ad x[k] + Bd u[k]
export function discretize(ss: StateSpace, dt: number): DiscreteSS {
  const n = ss.n,
    d = ss as DiscreteSS; // Ad and Bd are added to ss
  if (!n) {
    d.Ad = [];
    d.Bd = [];
    return d;
  }
  const M: number[][] = [];
  for (let i = 0; i <= n; i++) M.push(new Array(n + 1).fill(0));
  for (let k = 0; k < n - 1; k++) M[k][k + 1] = 1;
  for (let k = 0; k < n; k++) M[n - 1][k] = -ss.dn[n - k];
  M[n - 1][n] = 1;
  const E = expm(M.map(r => r.map(v => v * dt)));
  d.Ad = E.slice(0, n).map(r => r.slice(0, n));
  d.Bd = E.slice(0, n).map(r => r[n]);
  return d;
}
export function ssStepD(ss: DiscreteSS, x: number[], u: number): number[] {
  if (!ss.n) return x;
  const n = ss.n,
    y = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = ss.Bd[i] * u;
    const r = ss.Ad[i];
    for (let j = 0; j < n; j++) s += r[j] * x[j];
    y[i] = s;
  }
  return y;
}
export const ssOut = (ss: StateSpace, x: number[], u: number): number => {
  let y = ss.D * u;
  for (let k = 0; k < ss.n; k++) y += ss.c[k] * x[k];
  return y;
};
// Highest frequency where |L(jω)| >= 1 (a measure of how fast the closed loop is)
export function crossoverHigh(tf: TF, st: State = S): number {
  const [a, b] = freqRange(tf, st),
    N = 60 * (b - a);
  let wh = 0;
  for (let i = 0; i < N; i++) {
    const w = Math.pow(10, a + ((b - a) * i) / (N - 1));
    const L = evalCP(w, tf, st);
    if (Math.hypot(L[0], L[1]) >= 1) wh = w;
  }
  return wh;
}
export function simulate(st: State = S) {
  const tf = PLANTS[st.plant].tf(st);
  const NS = 4000,
    dt = st.Tsim / NS;
  // NS recorded points; the controller is also updated between them (substeps, at most 100).
  // Holding the controller output over a step h acts like a delay of h/2, so h is chosen to keep ω·h ≤ 0.02
  // (phase error ≤ 0.6°) at the gain crossover and at the frequency of a periodic reference.
  const wh = crossoverHigh(tf, st),
    wr = st.refType === 'sine' || st.refType === 'square' ? (2 * Math.PI) / st.rPer : 0;
  const m = Math.max(1, Math.min(100, Math.ceil((dt * Math.max(wh, wr)) / 0.02))),
    h = dt / m;
  const ps = discretize(makeSS(tf.num, tf.den), h);
  const cr = isTFMode(st) ? ctrlRational(st) : null;
  const cs = cr ? discretize(makeSS(cr.num, cr.den), h) : null;
  const dsteps = Math.round(tf.L / h);
  const buf = new Array(dsteps).fill(0);
  let bi = 0;
  const useP = hasTerm(st, 'P'),
    useI = hasTerm(st, 'I'),
    useD = hasTerm(st, 'D');
  const kp = useP ? st.Kp : 0,
    ki = useI ? st.Ki : 0,
    kd = useD ? st.Kd : 0;
  const { b: wb, c: wc } = spWeights(st);
  const alpha = 1 - Math.exp(-st.N * h);
  const rnd = mulberry32(12345);
  const gauss = () => {
    let u1 = rnd() || 1e-12,
      u2 = rnd();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  let x = new Array(ps.n).fill(0),
    xc: number[] = cs ? new Array(cs.n).fill(0) : [],
    xi = 0,
    xf = 0,
    iae = 0,
    diverged = false;
  const T: number[] = [],
    R: number[] = [],
    Y: number[] = [],
    U: number[] = [];
  let rAbs = 0;
  for (let i = 0; i <= NS; i += 4) rAbs = Math.max(rAbs, Math.abs(refValue(i * dt, st)));
  const lim = 1e3 * (rAbs + Math.abs(st.dOn ? st.d : 0) + 1);
  outer: for (let i = 0; i <= NS; i++) {
    const nz = st.noise > 0 ? st.noise * gauss() : 0; // Measurement noise is held constant over each recorded step
    for (let q = 0; q < m; q++) {
      const t = i * dt + q * h;
      const y = ssOut(ps, x, 0);
      const ym = y + nz;
      const r = refValue(t, st),
        e = r - ym;
      let ur: number,
        sD = 0;
      if (cs) {
        ur = ssOut(cs, xc, e);
      } else {
        sD = wc * r - ym;
        const D = useD ? kd * st.N * (sD - xf) : 0;
        ur = kp * (wb * r - ym) + ki * xi + D;
      }
      const u = st.sat ? Math.max(-st.umax, Math.min(st.umax, ur)) : ur;
      if (q === 0) {
        T.push(t);
        R.push(r);
        Y.push(y);
        U.push(u);
        if (!isFinite(y) || !isFinite(u) || Math.abs(y) > lim) {
          diverged = true;
          break outer;
        }
        if (i === NS) break outer;
      }
      iae += Math.abs(r - y) * h;
      if (cs) {
        xc = ssStepD(cs, xc, e);
      } else {
        let integ = true;
        if (st.sat && st.aw && ur !== u && Math.sign(e) === Math.sign(ur)) integ = false;
        if (integ) xi += e * h;
        xf += alpha * (sD - xf);
      }
      let ud: number;
      if (dsteps > 0) {
        ud = buf[bi];
        buf[bi] = u;
        bi = (bi + 1) % dsteps;
      } else ud = u;
      const up = ud + (st.dOn && t >= st.td ? st.d : 0);
      x = ssStepD(ps, x, up);
    }
  }
  return { T, R, Y, U, iae, diverged, substeps: m };
}

export function metricWindow(sim: SimResult, st: State = S): { tEnd: number; last: number; i0: number } {
  const tEnd = st.dOn ? Math.min(st.td, st.Tsim) : st.Tsim;
  let last = 0;
  while (last + 1 < sim.T.length && sim.T[last + 1] <= tEnd) last++;
  let i0 = 0;
  while (i0 < last && sim.T[i0] < st.rT0) i0++;
  return { tEnd, last, i0 };
}
// Step and trapezoid: metrics relative to the final value of r (times measured from t0)
export function stepMetrics(sim: SimResult, st: State = S) {
  if (sim.diverged || Math.abs(st.R) < 1e-9) return null;
  const { last, i0 } = metricWindow(sim, st);
  if (last - i0 < 10) return null;
  const R = st.R,
    t0 = st.rT0,
    yn = sim.Y.map(v => v / R);
  let t10: number | null = null,
    t90: number | null = null,
    mx = -Infinity;
  for (let i = i0; i <= last; i++) {
    if (t10 === null && yn[i] >= 0.1) t10 = sim.T[i] - t0;
    if (t90 === null && yn[i] >= 0.9) t90 = sim.T[i] - t0;
    if (yn[i] > mx) mx = yn[i];
  }
  let lastOut = -1;
  for (let i = i0; i <= last; i++) if (Math.abs(yn[i] - 1) > 0.02) lastOut = i;
  const ts = lastOut === last ? null : lastOut < 0 ? 0 : sim.T[lastOut + 1] - t0;
  return {
    rise: t10 !== null && t90 !== null ? t90 - t10 : null,
    os: Math.max(0, (mx - 1) * 100),
    ts,
    sse: R - sim.Y[last],
  };
}
// Sine: Fourier coefficients over the last whole periods give the amplitude ratio and phase difference
// Result of sineMetrics: short is set when the simulation is too short for the measurement
interface SineMetrics {
  w: number;
  ratioT: number;
  phT: number;
  short?: boolean;
  ratio?: number;
  phase?: number;
  emax?: number;
}
export function sineMetrics(sim: SimResult, st: State = S): SineMetrics | null {
  if (sim.diverged || Math.abs(st.R) < 1e-9) return null;
  const { tEnd, last } = metricWindow(sim, st);
  const Tp = st.rPer,
    avail = tEnd - st.rT0,
    w = (2 * Math.PI) / Tp;
  const th = evalT(w, st);
  const base = { w, ratioT: Math.hypot(th[0], th[1]), phT: (Math.atan2(th[1], th[0]) * 180) / Math.PI };
  if (avail < 3 * Tp) return { ...base, short: true };
  const nP = Math.max(1, Math.min(3, Math.floor(avail / Tp) - 2)),
    ta = tEnd - nP * Tp,
    dt = sim.T[1] - sim.T[0];
  let a = 0,
    b = 0,
    emax = 0;
  for (let i = 0; i <= last; i++) {
    const t = sim.T[i];
    if (t < ta) continue;
    const ph = w * (t - st.rT0);
    a += sim.Y[i] * Math.sin(ph) * dt;
    b += sim.Y[i] * Math.cos(ph) * dt;
    emax = Math.max(emax, Math.abs(sim.R[i] - sim.Y[i]));
  }
  a *= 2 / (nP * Tp);
  b *= 2 / (nP * Tp);
  const g = [a / st.R, b / st.R];
  return { ...base, ratio: Math.hypot(g[0], g[1]), phase: (Math.atan2(g[1], g[0]) * 180) / Math.PI, emax };
}
