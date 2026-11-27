// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Simulation ================= */
import { polyRoots } from './03-math.ts';
import { PLANTS, hasTerm } from './10-definitions.ts';
import { S, ctrlRational, isTFMode, refValue } from './11-state.ts';
import { evalCP, evalT, freqRange, spWeights } from './15-frequency.ts';

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
// Average output over a step h with the input u held: (1/h)∫ y dt = (ca·x + cb·u), where the row ca = c·∫e^{Aτ}dτ / h
// and cb = (c·∫∫e^{Aσ}dσ dτ B + D h) / h come from the exponential of an augmented matrix (exact for a held input)
export function averageOut(ss: StateSpace, h: number): { ca: number[]; cb: number } {
  const n = ss.n;
  if (!n) return { ca: [], cb: ss.D };
  // M = [[A, I, 0], [0, 0, 0], [0, 0, 0]] for ∫e^{Aτ}, and [[A, B, 0], [0, 0, 1], [0, 0, 0]] for ∫∫e^{Aσ}B
  const N1 = 2 * n,
    M1: number[][] = [],
    N2 = n + 2,
    M2: number[][] = [];
  for (let i = 0; i < N1; i++) M1.push(new Array(N1).fill(0));
  for (let i = 0; i < N2; i++) M2.push(new Array(N2).fill(0));
  for (let k = 0; k < n - 1; k++) M1[k][k + 1] = M2[k][k + 1] = h;
  for (let k = 0; k < n; k++) M1[n - 1][k] = M2[n - 1][k] = -ss.dn[n - k] * h;
  for (let k = 0; k < n; k++) M1[k][n + k] = h;
  M2[n - 1][n] = h;
  M2[n][n + 1] = h;
  const E1 = expm(M1),
    E2 = expm(M2);
  const ca = new Array(n).fill(0);
  let cb = ss.D;
  for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) ca[j] += (ss.c[k] * E1[k][n + j]) / h;
  for (let k = 0; k < n; k++) cb += (ss.c[k] * E2[k][n + 1]) / h;
  return { ca, cb };
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
// Fastest dynamics of the controller (rad/s): the derivative filter N of a PID with a derivative term, or the
// largest pole magnitude of a controller given as a transfer function (0 when there is none)
export function ctrlFastest(st: State = S): number {
  if (isTFMode(st)) return Math.max(0, ...polyRoots(ctrlRational(st).den).map(z => Math.hypot(z[0], z[1])));
  return hasTerm(st, 'D') && st.Kd !== 0 ? st.N : 0;
}
// Time steps: NS recorded points, and m substeps of length h between them (the controller is updated at every
// substep). Holding the controller output over a step h acts like a delay of h/2, so h is chosen to keep ω·h ≤ 0.02
// (phase error ≤ 0.6°) at the gain crossover, at the frequency of a periodic reference and at the fastest dynamics
// of the controller (e.g. the derivative filter N); m is at most 100.
const SIM_POINTS = 4000;
function simSteps(tf: TF, st: State): { dt: number; m: number; h: number } {
  const dt = st.Tsim / SIM_POINTS;
  const wh = crossoverHigh(tf, st),
    wr = st.refType === 'sine' || st.refType === 'square' ? (2 * Math.PI) / st.rPer : 0,
    wc = ctrlFastest(st);
  const m = Math.max(1, Math.min(100, Math.ceil((dt * Math.max(wh, wr, wc)) / 0.02)));
  return { dt, m, h: dt / m };
}
/** The controller during a simulation: out() gives its output before saturation for the reference r and the
 * measured output ym; step() advances its state by one substep, given the output after saturation u */
interface SimController {
  out(r: number, ym: number): number;
  step(r: number, ym: number, ur: number, u: number): void;
}
function simController(st: State, h: number): SimController {
  // a controller entered as a transfer function: its discretized state space, driven by the error
  const cr = isTFMode(st) ? ctrlRational(st) : null;
  if (cr) {
    const cs = discretize(makeSS(cr.num, cr.den), h),
      { ca, cb } = averageOut(cs, h);
    let xc: number[] = new Array(cs.n).fill(0);
    return {
      // the output held over the substep is its exact average for the error held over the substep
      out: (r, ym) => {
        let u = cb * (r - ym);
        for (let k = 0; k < cs.n; k++) u += ca[k] * xc[k];
        return u;
      },
      step: (r, ym) => {
        xc = ssStepD(cs, xc, r - ym);
      },
    };
  }
  // PID (and its P, PI, PD forms) with set-point weights b, c, a first-order filter N on the derivative, and
  // conditional integration (anti-windup) while the actuator saturates
  const useD = hasTerm(st, 'D');
  const kp = hasTerm(st, 'P') ? st.Kp : 0,
    ki = hasTerm(st, 'I') ? st.Ki : 0,
    kd = useD ? st.Kd : 0;
  const { b: wb, c: wc } = spWeights(st);
  // the output held over each substep is the exact average of the continuous controller's output over the substep
  // (for the error held over it): the integral term adds e·h/2, and the derivative term, which decays with the time
  // constant 1/N, is scaled by its average factor (1 − e^{−Nh})/(Nh)
  const alpha = 1 - Math.exp(-st.N * h),
    davg = st.N * h > 1e-9 ? alpha / (st.N * h) : 1;
  let xi = 0, // integral of the error
    xf = 0; // filtered derivative signal
  return {
    out: (r, ym) => {
      const D = useD ? kd * st.N * davg * (wc * r - ym - xf) : 0;
      return kp * (wb * r - ym) + ki * (xi + ((r - ym) * h) / 2) + D;
    },
    step: (r, ym, ur, u) => {
      const e = r - ym;
      if (!(st.sat && st.aw && ur !== u && Math.sign(e) === Math.sign(ur))) xi += e * h;
      xf += alpha * (wc * r - ym - xf);
    },
  };
}
// Dead time of d substeps (d ≥ 0, not necessarily whole): the input held over each substep, delayed by d substeps,
// averaged over the substep — (1 − f)·u[k − n] + f·u[k − n − 1] with n = ⌊d⌋, f = d − n — so a dead time that is
// not a whole number of substeps is not rounded (zero before the first input)
function delayLine(d: number): (u: number) => number {
  const n = Math.floor(d + 1e-9),
    f = Math.max(0, d - n);
  if (n <= 0 && f < 1e-9) return u => u;
  const len = n + 2,
    buf: number[] = new Array(len).fill(0);
  let k = 0;
  return u => {
    buf[k] = u;
    const a = buf[(k - n + len) % len],
      b = buf[(k - n - 1 + 2 * len) % len];
    k = (k + 1) % len;
    return f < 1e-9 ? a : (1 - f) * a + f * b;
  };
}
// Measurement noise: normal with standard deviation st.noise, from a fixed seed (the same settings give the same
// noise every time); zero without drawing numbers when there is no noise
function noiseSource(st: State): () => number {
  if (!(st.noise > 0)) return () => 0;
  const rnd = mulberry32(12345);
  return () => {
    const u1 = rnd() || 1e-12,
      u2 = rnd();
    return st.noise * (Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
  };
}
// The closed-loop response: reference r → controller → (saturation) → dead time → (+ disturbance) → plant → y,
// with the measurement noise added to y in the feedback. Stops when the response diverges.
export function simulate(st: State = S) {
  const tf = PLANTS[st.plant].tf(st);
  const NS = SIM_POINTS,
    { dt, m, h } = simSteps(tf, st);
  const ps = discretize(makeSS(tf.num, tf.den), h);
  const ctrl = simController(st, h),
    delay = delayLine(tf.L / h),
    noise = noiseSource(st);
  let x: number[] = new Array(ps.n).fill(0),
    iae = 0,
    diverged = false;
  const T: number[] = [],
    R: number[] = [],
    Y: number[] = [],
    U: number[] = [];
  // the response counts as diverged beyond 1000 times the size of the reference and the disturbance
  let rAbs = 0;
  for (let i = 0; i <= NS; i += 4) rAbs = Math.max(rAbs, Math.abs(refValue(i * dt, st)));
  // an impulse A δ(t − t0): a pulse of area A over the substep that contains t0 (r and u are recorded without it)
  const imp = st.refType === 'impulse';
  if (imp) rAbs = Math.max(rAbs, Math.abs(st.R));
  const lim = 1e3 * (rAbs + Math.abs(st.dOn ? st.d : 0) + 1);
  outer: for (let i = 0; i <= NS; i++) {
    const nz = noise(); // held over each recorded step
    for (let q = 0; q < m; q++) {
      const t = i * dt + q * h;
      const y = ssOut(ps, x, 0);
      const ym = y + nz;
      const r0 = refValue(t, st),
        r = imp && t <= st.rT0 && st.rT0 < t + h ? r0 + st.R / h : r0;
      const ur = ctrl.out(r, ym);
      const u = st.sat ? Math.max(-st.umax, Math.min(st.umax, ur)) : ur;
      if (q === 0) {
        const uRec = r === r0 ? u : ctrl.out(r0, ym); // u without the impulse
        T.push(t);
        R.push(r0);
        Y.push(y);
        U.push(st.sat ? Math.max(-st.umax, Math.min(st.umax, uRec)) : uRec);
        if (!isFinite(y) || !isFinite(u) || Math.abs(y) > lim) {
          diverged = true;
          break outer;
        }
        if (i === NS) break outer;
      }
      iae += Math.abs(r0 - y) * h;
      ctrl.step(r, ym, ur, u);
      const up = delay(u) + (st.dOn && t >= st.td ? st.d : 0);
      x = ssStepD(ps, x, up);
    }
  }
  return { T, R, Y, U, iae, diverged, substeps: m };
}

// The plant alone (open loop, without the controller): P(s) driven by the reference r(t) itself (an impulse as in
// simulate()), on the same recorded points and substeps; stops when the response diverges
export function simulatePlant(st: State = S) {
  const tf = PLANTS[st.plant].tf(st),
    NS = SIM_POINTS,
    { dt, m, h } = simSteps(tf, st),
    ps = discretize(makeSS(tf.num, tf.den), h),
    delay = delayLine(tf.L / h),
    imp = st.refType === 'impulse';
  let x: number[] = new Array(ps.n).fill(0),
    rAbs = imp ? Math.abs(st.R) : 0;
  for (let i = 0; i <= NS; i += 4) rAbs = Math.max(rAbs, Math.abs(refValue(i * dt, st)));
  const lim = 1e3 * (rAbs + 1),
    T: number[] = [],
    Y: number[] = [];
  let diverged = false;
  outer: for (let i = 0; i <= NS; i++)
    for (let q = 0; q < m; q++) {
      const t = i * dt + q * h,
        y = ssOut(ps, x, 0);
      if (q === 0) {
        T.push(t);
        Y.push(y);
        if (!isFinite(y) || Math.abs(y) > lim) {
          diverged = true;
          break outer;
        }
        if (i === NS) break outer;
      }
      const r0 = refValue(t, st),
        r = imp && t <= st.rT0 && st.rT0 < t + h ? r0 + st.R / h : r0;
      x = ssStepD(ps, x, delay(r));
    }
  return { T, Y, diverged };
}
export function metricWindow(sim: SimResult, st: State = S): { tEnd: number; last: number; i0: number } {
  const tEnd = st.dOn ? Math.min(st.td, st.Tsim) : st.Tsim;
  let last = 0;
  while (last + 1 < sim.T.length && sim.T[last + 1] <= tEnd) last++;
  let i0 = 0;
  while (i0 < last && sim.T[i0] < st.rT0) i0++;
  return { tEnd, last, i0 };
}
// Impulse: the peak of y (with its sign) and its time from t0, the area ∫ y dt (trapezoidal rule) and y at the end,
// up to the disturbance (or the end)
export function impulseMetrics(sim: SimResult, st: State = S) {
  if (sim.diverged) return null;
  const { last, i0 } = metricWindow(sim, st);
  if (last - i0 < 10) return null;
  let k = i0,
    area = 0;
  for (let i = i0; i <= last; i++) {
    if (Math.abs(sim.Y[i]) > Math.abs(sim.Y[k])) k = i;
    if (i > i0) area += ((sim.Y[i] + sim.Y[i - 1]) / 2) * (sim.T[i] - sim.T[i - 1]);
  }
  return { peak: sim.Y[k], tPeak: sim.T[k] - st.rT0, area, yEnd: sim.Y[last] };
}
// Step and trapezoid: metrics relative to the final value of r (times measured from t0)
export function stepMetrics(sim: SimResult, st: State = S) {
  if (sim.diverged || Math.abs(st.R) < 1e-9) return null;
  const { last, i0 } = metricWindow(sim, st);
  if (last - i0 < 10) return null;
  const R = st.R,
    t0 = st.rT0,
    yn = sim.Y.map(v => v / R);
  // times between the recorded points are found by linear interpolation, and the peak by a parabola through the
  // largest point and its neighbours, so that the metrics do not depend on the spacing of the recorded points
  const T = sim.T,
    cross = (i: number, lv: number) =>
      i <= i0 || yn[i] === yn[i - 1] ? T[i] : T[i - 1] + ((lv - yn[i - 1]) / (yn[i] - yn[i - 1])) * (T[i] - T[i - 1]);
  let t10: number | null = null,
    t90: number | null = null,
    k = i0;
  for (let i = i0; i <= last; i++) {
    if (t10 === null && yn[i] >= 0.1) t10 = cross(i, 0.1) - t0;
    if (t90 === null && yn[i] >= 0.9) t90 = cross(i, 0.9) - t0;
    if (yn[i] > yn[k]) k = i;
  }
  let mx = yn[k];
  if (k > i0 && k < last) {
    const c = yn[k + 1] - 2 * yn[k] + yn[k - 1];
    if (c < 0) mx = yn[k] - (yn[k + 1] - yn[k - 1]) ** 2 / (8 * c);
  }
  let lastOut = -1;
  for (let i = i0; i <= last; i++) if (Math.abs(yn[i] - 1) > 0.02) lastOut = i;
  let ts: number | null = null;
  if (lastOut < 0) ts = 0;
  else if (lastOut < last) {
    const j = lastOut,
      lv = yn[j] > 1 ? 1.02 : 0.98;
    ts = T[j] + ((yn[j] - lv) / (yn[j] - yn[j + 1])) * (T[j + 1] - T[j]) - t0;
  }
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
