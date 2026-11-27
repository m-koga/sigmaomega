// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Numerical accuracy of the simulator: every result is compared with an exact solution or with an independent
// reference computed far more accurately (see ACCURACY.md). Prints the tables of ACCURACY.md as Markdown.
// Usage: npm run accuracy   (about one minute)
import { fresh } from '../tests/harness.ts';

type C = [number, number];
type App = ReturnType<typeof fresh>;
type Settings = Record<string, unknown>;

// ---------- polynomial helpers (descending powers) ----------
export const pAdd = (a: number[], b: number[]): number[] => {
  const n = Math.max(a.length, b.length),
    r = new Array(n).fill(0);
  a.forEach((v, i) => (r[n - a.length + i] += v));
  b.forEach((v, i) => (r[n - b.length + i] += v));
  return r;
};
export const pMul = (a: number[], b: number[]): number[] => {
  const r = new Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (r[i + j] += x * y)));
  return r;
};

// ---------- references ----------
/** Step response of num/den (proper, no dead time) at the given times: classical RK4 with a step of at most H
 *  (independent of the simulator's own discretization; its own error is below 1e-11 for the cases used) */
export function refStep(num: number[], den: number[], times: number[], H = 1e-4): number[] {
  const a0 = den[0],
    d = den.map(v => v / a0),
    n = d.length - 1,
    b = new Array(n + 1).fill(0);
  num.forEach((v, i) => (b[n + 1 - num.length + i] = v / a0));
  const D = b[0],
    c = Array.from({ length: n }, (_, k) => b[n - k] - D * d[n - k]);
  const f = (x: number[]) => {
    const dx = new Array(n);
    for (let k = 0; k < n - 1; k++) dx[k] = x[k + 1];
    let s = 1;
    for (let k = 0; k < n; k++) s -= d[n - k] * x[k];
    dx[n - 1] = s;
    return dx;
  };
  let x = new Array(n).fill(0),
    t = 0;
  const ys: number[] = [];
  for (const tt of times) {
    while (t < tt - 1e-12) {
      const h = Math.min(H, tt - t);
      const k1 = f(x),
        k2 = f(x.map((v, i) => v + (h / 2) * k1[i])),
        k3 = f(x.map((v, i) => v + (h / 2) * k2[i])),
        k4 = f(x.map((v, i) => v + h * k3[i]));
      x = x.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      t += h;
    }
    let y = D;
    for (let k = 0; k < n; k++) y += c[k] * x[k];
    ys.push(y);
  }
  return ys;
}
/** Closed loop with a continuous PID (filtered derivative, set-point weights) and a plant with an input dead
 *  time L, for a unit step at t = 0: RK4 with the step H, the delayed input interpolated linearly in its history.
 *  Returns the output on the grid k·H. */
export function refDeadPID(a: App, tEnd: number, H = 1e-4): number[] {
  const S = a.S,
    tf = a.PLANTS[S.plant].tf(S);
  const a0 = tf.den[0],
    d = tf.den.map((v: number) => v / a0),
    n = d.length - 1,
    nm = new Array(n + 1).fill(0);
  tf.num.forEach((v: number, i: number) => (nm[n + 1 - tf.num.length + i] = v / a0));
  const c = Array.from({ length: n }, (_, k) => nm[n - k] - nm[0] * d[n - k]);
  const useD = S.mode === 'PID' || S.mode === 'PD',
    useI = S.mode === 'PID' || S.mode === 'PI';
  const { b, c: cw } = a.spWeights(S),
    N = S.N,
    nL = Math.round(tf.L / H);
  const out = (x: number[]) => c.reduce((s, ck, k) => s + ck * x[k], 0);
  const ctrl = (x: number[], xi: number, xf: number) => {
    const y = out(x);
    return S.Kp * (b - y) + (useI ? S.Ki * xi : 0) + (useD ? S.Kd * N * (cw - y - xf) : 0);
  };
  const f = (x: number[], xf: number, u: number): [number[], number, number] => {
    const y = out(x),
      dx = new Array(n);
    for (let k = 0; k < n - 1; k++) dx[k] = x[k + 1];
    let s = u;
    for (let k = 0; k < n; k++) s -= d[n - k] * x[k];
    dx[n - 1] = s;
    return [dx, 1 - y, N * (cw - y - xf)];
  };
  const uh: number[] = [],
    Y: number[] = [];
  let x = new Array(n).fill(0),
    xi = 0,
    xf = 0;
  const steps = Math.round(tEnd / H);
  for (let i = 0; i <= steps; i++) {
    Y.push(out(x));
    uh[i] = ctrl(x, xi, xf);
    if (i === steps) break;
    const u0 = i - nL >= 0 ? uh[i - nL] : 0,
      u1 = i + 1 - nL >= 0 ? uh[i + 1 - nL] : 0,
      um = (u0 + u1) / 2;
    const add = (v: number[], dv: number[], h: number) => v.map((q, k) => q + h * dv[k]);
    const k1 = f(x, xf, u0),
      k2 = f(add(x, k1[0], H / 2), xf + (H / 2) * k1[2], um),
      k3 = f(add(x, k2[0], H / 2), xf + (H / 2) * k2[2], um),
      k4 = f(add(x, k3[0], H), xf + H * k3[2], u1);
    x = x.map((v, k) => v + (H / 6) * (k1[0][k] + 2 * k2[0][k] + 2 * k3[0][k] + k4[0][k]));
    xi += (H / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    xf += (H / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
  }
  return Y;
}
/** Overshoot [%], 10–90 % rise time and 2 % settling time of a unit-step response sampled finely on T */
export function refMetrics(T: number[], y: number[]) {
  let mx = -Infinity,
    t10: number | null = null,
    t90: number | null = null,
    lo = -1;
  y.forEach((v, i) => {
    if (t10 === null && v >= 0.1) t10 = T[i];
    if (t90 === null && v >= 0.9) t90 = T[i];
    mx = Math.max(mx, v);
    if (Math.abs(v - 1) > 0.02) lo = i;
  });
  return {
    os: Math.max(0, (mx - 1) * 100),
    rise: t10 !== null && t90 !== null ? t90 - t10 : null,
    ts: lo < y.length - 1 ? T[lo + 1] : null,
  };
}
/** Exact margins and peak sensitivity: dense scan of L(jω) (dead time exact, 5000 points per decade over
 *  1e-4 … 1e4 rad/s), crossings refined
 *  by bisection, Ms as the largest 1/|1 + L| on the scan refined by golden-section search */
export function refFreq(a: App) {
  const tf = a.PLANTS[a.S.plant].tf(a.S);
  const L = (w: number): C => {
    const z = a.evalCP(w, tf, a.S),
      p = -w * tf.L;
    return [z[0] * Math.cos(p) - z[1] * Math.sin(p), z[0] * Math.sin(p) + z[1] * Math.cos(p)];
  };
  const mag = (w: number) => Math.hypot(...L(w)),
    sens = (w: number) => 1 / Math.hypot(1 + L(w)[0], L(w)[1]);
  const M = 40000,
    ws = Array.from({ length: M + 1 }, (_, i) => Math.pow(10, -4 + (8 * i) / M)),
    Lz = ws.map(L),
    mz = Lz.map(z => Math.hypot(z[0], z[1])),
    sz = Lz.map(z => 1 / Math.hypot(1 + z[0], z[1]));
  const bisect = (lo: number, hi: number, below: (w: number) => boolean) => {
    for (let k = 0; k < 200; k++) {
      const m = Math.sqrt(lo * hi);
      if (below(m)) hi = m;
      else lo = m;
    }
    return Math.sqrt(lo * hi);
  };
  // continuous phase, on the same branch as the app (first value at most 90°)
  let prev: number | null = null,
    off = 0;
  const ph = Lz.map(z => {
    const p = (Math.atan2(z[1], z[0]) * 180) / Math.PI;
    if (prev !== null) {
      while (p + off - prev > 180) off -= 360;
      while (p + off - prev < -180) off += 360;
    }
    prev = p + off;
    return prev;
  });
  const shift = ph[0] > 90 ? -360 : 0;
  const phase = (w: number, i: number) => {
    const z = L(w);
    let p = (Math.atan2(z[1], z[0]) * 180) / Math.PI + shift;
    while (p - (ph[i] + shift) > 180) p -= 360;
    while (p - (ph[i] + shift) < -180) p += 360;
    return p;
  };
  let wgc: number | null = null,
    pm: number | null = null,
    wpc: number | null = null,
    gm: number | null = null;
  for (let i = 1; i <= M; i++) {
    if (wgc === null && mz[i - 1] >= 1 && mz[i] < 1) {
      wgc = bisect(ws[i - 1], ws[i], w => mag(w) < 1);
      pm = 180 + phase(wgc, i);
    }
    if (wpc === null && ph[i - 1] + shift > -180 && ph[i] + shift <= -180) {
      wpc = bisect(ws[i - 1], ws[i], w => phase(w, i) <= -180);
      gm = -20 * Math.log10(mag(wpc));
    }
  }
  let im = 0;
  sz.forEach((v, i) => {
    if (v > sz[im]) im = i;
  });
  const ms = a.refinePeak(ws, im, sens)[0];
  return { wgc, pm, wpc, gm, ms };
}

// ---------- the evaluations ----------
const fmt = (v: number | null | undefined, d = 3) => (v === null || v === undefined ? '—' : v.toFixed(d));
const sci = (v: number) =>
  v === 0
    ? '0'
    : v
        .toExponential(1)
        .replace('e', '×10^')
        .replace(/\^\+?(-?)(\d+)/, '<sup>$1$2</sup>');
const app = (set: Settings) => {
  const a = fresh();
  Object.assign(a.S, { refType: 'step', R: 1, rT0: 0, dOn: false, sat: false, noise: 0, tdof: false }, set);
  return a;
};

/** Time response without dead time against the exact closed loop */
export const TIME_CASES: [string, Settings][] = [
  ['1st-order lag + P', { plant: 'first', K: 1, T: 1, mode: 'P', Kp: 2, Tsim: 5 }],
  ['1st-order lag + PI', { plant: 'first', K: 1, T: 1, mode: 'PI', Kp: 1, Ki: 1, Tsim: 10 }],
  ['1st-order lag + PID', { plant: 'first', K: 1, T: 1, mode: 'PID', Kp: 2, Ki: 1, Kd: 1, N: 20, Tsim: 20 }],
  ['2nd-order (ζ = 0.2) + P', { plant: 'second', K: 1, zeta: 0.2, wn: 1, mode: 'P', Kp: 1, Tsim: 30 }],
  ['3rd-order lag + PID', { plant: 'third', K: 1, T: 1, mode: 'PID', Kp: 2, Ki: 0.5, Kd: 1, N: 20, Tsim: 30 }],
  [
    '3rd-order lag + PID, N = 100',
    { plant: 'third', K: 1, T: 1, mode: 'PID', Kp: 2, Ki: 0.5, Kd: 1, N: 100, Tsim: 30 },
  ],
  ['3rd-order lag + PID, fast', { plant: 'third', K: 1, T: 1, mode: 'PID', Kp: 4, Ki: 1, Kd: 4, N: 10, Tsim: 20 }],
  ['Integrator + 1st-order lag + PD', { plant: 'integ', K: 1, T: 1, mode: 'PD', Kp: 1, Kd: 0.5, N: 20, Tsim: 20 }],
  ['3rd-order lag + lead', { plant: 'third', K: 1, T: 1, mode: 'lead', Tsim: 30 }],
];
/** Lightly damped loops: K/(s(Ts + 1)) with P control, a pure second-order closed loop (ζ = 1/(2√(K Kp T))), and a
 *  second-order plant with PI. The controller sees y once per time step, which acts like a delay of half a step and
 *  lowers the damping a little; with little damping this shows over the many periods of the response */
export const LIGHT_CASES: [string, number, Settings][] = [
  ['Integrator + 1st-order lag + P, ζ = 0.35', 0.354, { plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 2, Tsim: 30 }],
  ['Integrator + 1st-order lag + P, ζ = 0.16', 0.158, { plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 10, Tsim: 30 }],
  [
    'Integrator + 1st-order lag + P, ζ = 0.16, 100 s',
    0.158,
    { plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 10, Tsim: 100 },
  ],
  ['Integrator + 1st-order lag + P, ζ = 0.10', 0.1, { plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 25, Tsim: 30 }],
  ['Integrator + 1st-order lag + P, ζ = 0.05', 0.05, { plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 100, Tsim: 30 }],
  ['2nd-order (ζ = 0.2) + PI', 0.2, { plant: 'second', K: 1, zeta: 0.2, wn: 1, mode: 'PI', Kp: 1, Ki: 0.3, Tsim: 60 }],
];
export function timeCase(set: Settings) {
  const a = app(set),
    sim = a.simulate(),
    { num, den } = a.loopRational();
  const yr = refStep(num, pAdd(den, num), sim.T);
  const ymax = Math.max(...yr.map(Math.abs));
  const err = Math.max(...sim.Y.map((y: number, i: number) => Math.abs(y - yr[i])));
  const N = 100000,
    Tf = Array.from({ length: N + 1 }, (_, i) => (a.S.Tsim * i) / N);
  return {
    m: sim.substeps,
    h: (sim.T[1] - sim.T[0]) / sim.substeps,
    err,
    rel: err / ymax,
    got: a.stepMetrics(sim),
    ref: refMetrics(Tf, refStep(num, pAdd(den, num), Tf)),
  };
}
/** Time response with dead time against the continuous reference with the exact delay */
export const DEAD_CASES: [string, Settings][] = [
  ['L = 0.5 (a whole number of substeps), P', { plant: 'dead', K: 1, T: 1, L: 0.5, mode: 'P', Kp: 0.8, Tsim: 20 }],
  ['L = 0.537 (not a whole number), P', { plant: 'dead', K: 1, T: 1, L: 0.537, mode: 'P', Kp: 0.8, Tsim: 20 }],
  ['Exercise 2: L = 1, T = 2, PI', { plant: 'dead', K: 1, T: 2, L: 1, mode: 'PI', Kp: 0.7, Ki: 0.4, Tsim: 40 }],
  [
    'Exercise 3: L = 0.5, PID',
    { plant: 'dead', K: 1, T: 1, L: 0.5, mode: 'PID', Kp: 1.9, Ki: 1.583, Kd: 0.399, N: 20, Tsim: 15 },
  ],
];
export function deadCase(set: Settings) {
  const a = app(set),
    sim = a.simulate(),
    H = 1e-4,
    Y = refDeadPID(a, a.S.Tsim, H);
  const err = Math.max(...sim.T.map((t: number, i: number) => Math.abs(sim.Y[i] - Y[Math.round(t / H)])));
  const Tf = Y.map((_, i) => i * H);
  return { h: (sim.T[1] - sim.T[0]) / sim.substeps, err, got: a.stepMetrics(sim), ref: refMetrics(Tf, Y) };
}
export const FREQ_CASES: [string, Settings][] = [
  ['1st-order lag + PID', { plant: 'first', K: 1, T: 1, mode: 'PID', Kp: 2, Ki: 1, Kd: 1, N: 20 }],
  ['3rd-order lag + PID', { plant: 'third', K: 1, T: 1, mode: 'PID', Kp: 2, Ki: 0.5, Kd: 1, N: 20 }],
  ['1st-order lag + dead time (L = 1) + PI', { plant: 'dead', K: 1, T: 1, L: 1, mode: 'PI', Kp: 0.5, Ki: 0.4 }],
  ['2nd-order (ζ = 0.05) + P', { plant: 'second', K: 1, zeta: 0.05, wn: 1, mode: 'P', Kp: 0.5 }],
  ['3rd-order lag + P, near instability', { plant: 'third', K: 1, T: 1, mode: 'P', Kp: 7.5 }],
];
export function freqCase(set: Settings) {
  const a = app(set);
  return { got: a.freqResp(), ref: refFreq(a) };
}
/** Error of the computed roots: the largest distance from a computed root to the nearest exact root, or from an exact
 *  root to the nearest computed one (both ways, so that every one of repeated roots counts) */
export function rootError(poly: number[], exact: C[]) {
  const r: C[] = fresh().polyRoots(poly),
    d = (p: C, q: C) => Math.hypot(p[0] - q[0], p[1] - q[1]),
    far = (a: C[], b: C[]) => Math.max(...a.map(z => Math.min(...b.map(q => d(z, q)))));
  return Math.max(far(r, exact), far(exact, r));
}
/** Largest error of the open-loop step response of 1/(s+1)^n by the app's exact discretization (h = 0.01, 30 s) */
export function discretizationError(n: number) {
  const a = fresh();
  let den = [1];
  for (let i = 0; i < n; i++) den = pMul(den, [1, 1]);
  const ss = a.discretize(a.makeSS([1], den), 0.01);
  let x = new Array(n).fill(0),
    e = 0;
  for (let k = 1; k <= 3000; k++) {
    x = a.ssStepD(ss, x, 1);
    const t = k * 0.01;
    let s = 0,
      term = 1;
    for (let j = 0; j < n; j++) {
      s += term;
      term *= t / (j + 1);
    }
    e = Math.max(e, Math.abs(a.ssOut(ss, x, 0) - (1 - Math.exp(-t) * s)));
  }
  return e;
}
/** Dominant closed-loop pole of K e^{-Ls}/(Ts+1) with P control: Padé (the app) and exact (Newton on s+1+Kp e^{-Ls}) */
export function padeCase(L: number, Kp: number) {
  const a = app({ plant: 'dead', K: 1, T: 1, L, mode: 'P', Kp });
  const dom = (a.computePZ().cl as C[]).slice().sort((p, q) => q[0] - p[0])[0];
  let s: C = [dom[0], Math.abs(dom[1])];
  for (let i = 0; i < 100; i++) {
    const e = Math.exp(-L * s[0]),
      ex: C = [e * Math.cos(L * s[1]), -e * Math.sin(L * s[1])];
    const F: C = [s[0] + 1 + Kp * ex[0], s[1] + Kp * ex[1]],
      dF: C = [1 - L * Kp * ex[0], -L * Kp * ex[1]];
    const q = dF[0] ** 2 + dF[1] ** 2;
    s = [s[0] - (F[0] * dF[0] + F[1] * dF[1]) / q, s[1] - (F[1] * dF[0] - F[0] * dF[1]) / q];
  }
  return { pade: [dom[0], Math.abs(dom[1])] as C, exact: s, err: Math.hypot(dom[0] - s[0], Math.abs(dom[1]) - s[1]) };
}
export function sineCase(Tp: number, Tsim: number) {
  const a = app({
    plant: 'first',
    K: 1,
    T: 1,
    mode: 'PID',
    Kp: 2,
    Ki: 1,
    Kd: 1,
    N: 20,
    refType: 'sine',
    rPer: Tp,
    Tsim,
  });
  const sm = a.sineMetrics(a.simulate());
  if (!sm || sm.ratio === undefined || sm.phase === undefined) throw new Error('sine metrics not available');
  return { ratio: sm.ratio / sm.ratioT - 1, phase: sm.phase - sm.phT };
}

// ---------- the analyses added since version 1.74 ----------
const cmulC = (p: C, q: C): C => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
const cdivC = (p: C, q: C): C => {
  const d = q[0] * q[0] + q[1] * q[1];
  return [(p[0] * q[0] + p[1] * q[1]) / d, (p[1] * q[0] - p[0] * q[1]) / d];
};
/** P(jω) and L(jω) of the settings, with the exact dead time */
function loopFns(a: App) {
  const tf = a.PLANTS[a.S.plant].tf(a.S),
    delay = (w: number): C => [Math.cos(-w * tf.L), Math.sin(-w * tf.L)];
  return {
    P: (w: number) => cmulC(a.evalPr(w, tf), delay(w)),
    L: (w: number) => cmulC(a.evalCP(w, tf, a.S), delay(w)),
    dead: tf.L > 0,
  };
}
/** Largest value of f on a dense log grid over 1e-4 … 1e4 rad/s, refined by golden-section search in log ω */
function refPeak(f: (w: number) => number): number {
  const M = 40000,
    x = Array.from({ length: M + 1 }, (_, i) => -4 + (8 * i) / M),
    v = x.map(t => f(Math.pow(10, t)));
  let i = 0;
  v.forEach((y, j) => {
    if (y > v[i]) i = j;
  });
  let lo = x[Math.max(0, i - 1)],
    hi = x[Math.min(M, i + 1)];
  const g = (Math.sqrt(5) - 1) / 2;
  for (let k = 0; k < 200; k++) {
    const m1 = hi - g * (hi - lo),
      m2 = lo + g * (hi - lo);
    if (f(Math.pow(10, m1)) > f(Math.pow(10, m2))) hi = m2;
    else lo = m1;
  }
  return Math.max(v[i], f(Math.pow(10, (lo + hi) / 2)));
}
/** Peak of |T| (Mt), the closed-loop bandwidth (|T| 3 dB below its value at low frequencies) and the peak of
 *  |Gyd| = |P/(1 + L)|, from the exact frequency responses */
export function refClosedLoop(a: App) {
  const { P, L } = loopFns(a),
    T = (w: number) => {
      const z = L(w);
      return Math.hypot(z[0], z[1]) / Math.hypot(1 + z[0], z[1]);
    },
    D = (w: number) => {
      const z = cdivC(P(w), [1 + L(w)[0], L(w)[1]]);
      return Math.hypot(z[0], z[1]);
    };
  const db = (v: number) => 20 * Math.log10(v),
    lim = db(T(Math.pow(10, a.freqResp().w0))) - 3; // (w0: the exponent of the lowest frequency)
  let wbw: number | null = null;
  for (let i = 1, M = 40000; i <= M && wbw === null; i++) {
    const w0 = Math.pow(10, -4 + (8 * (i - 1)) / M),
      w1 = Math.pow(10, -4 + (8 * i) / M);
    if (db(T(w0)) >= lim && db(T(w1)) < lim) {
      let lo = w0,
        hi = w1;
      for (let k = 0; k < 200; k++) {
        const m = Math.sqrt(lo * hi);
        if (db(T(m)) < lim) hi = m;
        else lo = m;
      }
      wbw = Math.sqrt(lo * hi);
    }
  }
  return { mt: refPeak(T), wbw, dmax: refPeak(D) };
}
export const CLOSED_CASES: [string, Settings][] = [
  ['3rd-order lag + PID', { plant: 'third', K: 1, T: 1, mode: 'PID', Kp: 2, Ki: 0.5, Kd: 1, N: 20 }],
  ['2nd-order (ζ = 0.05) + P', { plant: 'second', K: 1, zeta: 0.05, wn: 1, mode: 'P', Kp: 0.5 }],
  ['1st-order lag + dead time (L = 1) + PI', { plant: 'dead', K: 1, T: 1, L: 1, mode: 'PI', Kp: 0.5, Ki: 0.4 }],
  ['Integrator + 1st-order lag + PD', { plant: 'integ', K: 1, T: 1, mode: 'PD', Kp: 1, Kd: 0.5, N: 20 }],
];
export function closedLoopCase(set: Settings) {
  const a = app(set);
  return { got: a.freqResp(), ref: refClosedLoop(a) };
}

/** Whether every root of p (descending powers) is in the open left half-plane: a plain Routh table of our own
 *  (used only away from the boundaries, where no special case occurs) */
function routhStable(p: number[]): boolean {
  const n = p.length - 1,
    rows: number[][] = [p.filter((_, i) => i % 2 === 0), p.filter((_, i) => i % 2 === 1)];
  for (let k = 1; k <= n; k++) {
    const a = rows[k - 1],
      b = rows[k];
    if (!b.length || b[0] === 0) return false;
    rows.push(a.slice(1).map((v, i) => (b[0] * v - a[0] * (b[i + 1] ?? 0)) / b[0]));
  }
  const first = rows.slice(0, n + 1).map(r => r[0]);
  return first.every(v => v > 0) || first.every(v => v < 0);
}
/** The gains k > 0 where a closed-loop pole crosses the imaginary axis, found independently of the app: 1 + kL(jω) = 0
 *  where L(jω) is real and negative (a dense scan of Im L over 0 … 1e6 rad/s, refined by bisection), and at ω = 0
 *  when L(0) is finite and negative. The stable ranges between them: our own Routh table at the midpoints
 *  (rational L), or below the first boundary (with a dead time, the plants used being stable for small k) */
export function refStableK(a: App): [number, number][] {
  const { L, dead } = loopFns(a),
    cuts: number[] = [],
    M = 120000,
    ws = [0, ...Array.from({ length: M + 1 }, (_, i) => Math.pow(10, -6 + (12 * i) / M))];
  const z0 = L(1e-12);
  if (Math.abs(z0[0]) < 1e9 && z0[0] < 0) cuts.push(-1 / z0[0]);
  for (let i = 2; i < ws.length; i++) {
    const a1 = L(ws[i - 1])[1],
      b1 = L(ws[i])[1];
    if (a1 === 0 || Math.sign(a1) === Math.sign(b1)) continue;
    let lo = ws[i - 1],
      hi = ws[i];
    for (let k = 0; k < 200; k++) {
      const m = (lo + hi) / 2;
      if (Math.sign(L(m)[1]) === Math.sign(a1)) lo = m;
      else hi = m;
    }
    const re = L((lo + hi) / 2)[0];
    if (re < 0) cuts.push(-1 / re);
  }
  cuts.sort((x, y) => x - y);
  if (dead) return [[0, cuts[0]]];
  const { num, den } = a.loopRational(),
    edges = [0, ...cuts, Infinity],
    out: [number, number][] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const lo = edges[i],
      hi = edges[i + 1],
      k = hi === Infinity ? lo * 2 + 1 : (lo + hi) / 2;
    if (
      routhStable(
        pAdd(
          den,
          num.map((v: number) => v * k),
        ),
      )
    ) {
      const last = out[out.length - 1];
      if (last && last[1] === lo) last[1] = hi;
      else out.push([lo, hi]);
    }
  }
  return out;
}
export const STABLE_K_CASES: [string, Settings][] = [
  ['3rd-order lag + P (exact: 0 < k < 8)', { plant: 'third', K: 1, T: 1, mode: 'P', Kp: 1 }],
  ['3rd-order lag + PID', { plant: 'third', K: 1, T: 1, mode: 'PID', Kp: 2, Ki: 0.5, Kd: 1, N: 20 }],
  ['Unstable 1st-order + P (exact: k > 2)', { plant: 'unstable', K: 1, T: 1, mode: 'P', Kp: 0.5 }],
  ['1/(s(s+1)(s+2)) + PD', { plant: 'custom', cNum: [1], cDen: [1, 3, 2, 0], L: 0, mode: 'PD', Kp: 1, Kd: 0.5, N: 20 }],
  ['1st-order lag + dead time (L = 1) + P', { plant: 'dead', K: 1, T: 1, L: 1, mode: 'P', Kp: 1 }],
];
export function stableKCase(set: Settings) {
  const a = app(set),
    { D, N, approx } = a.charPolyK();
  return {
    routh: a.positiveKRanges([[D[0]], ...a.hurwitzK(D, N)]) as [number, number][],
    locus: a.stableRanges() as [number, number][],
    ref: refStableK(a),
    approx,
  };
}
/** Largest relative difference between two lists of ranges (Infinity when they differ in number) */
export function rangeError(x: [number, number][], y: [number, number][]) {
  if (x.length !== y.length) return Infinity;
  let e = 0;
  x.forEach((r, i) =>
    r.forEach((v, j) => {
      const u = y[i][j];
      if (v === u) return;
      if (!isFinite(v) || !isFinite(u)) {
        // the root locus stops at 1e4 and 1e-4: a range ending there stands for ∞ or 0
        e = Math.max(e, (v >= 1e4 && u === Infinity) || (u >= 1e4 && v === Infinity) ? 0 : Infinity);
        return;
      }
      e = Math.max(e, u === 0 ? (Math.abs(v) <= 1e-4 ? 0 : Infinity) : Math.abs(v - u) / Math.abs(u));
    }),
  );
  return e;
}

/** Steady-state errors and error constants against their exact values (worked out by hand from L(s)) */
export const STEADY_CASES: [string, Settings, { type: number; K: number; e: number; dist: number }][] = [
  [
    '1st-order lag + P (K_p = 2)',
    { plant: 'first', K: 1, T: 1, mode: 'P', Kp: 2 },
    { type: 0, K: 2, e: 1 / 3, dist: -1 / 3 },
  ],
  [
    '3rd-order lag + PI (K_v = 0.5)',
    { plant: 'third', K: 1, T: 1, mode: 'PI', Kp: 1, Ki: 0.5 },
    { type: 1, K: 0.5, e: 2, dist: 0 },
  ],
  [
    'Integrator + 1st-order lag + PI (K_a = 0.5)',
    { plant: 'integ', K: 1, T: 1, mode: 'PI', Kp: 1, Ki: 0.5 },
    { type: 2, K: 0.5, e: 2, dist: 0 },
  ],
  [
    '1st-order lag + dead time (L = 1) + PI (K_v = 0.4)',
    { plant: 'dead', K: 1, T: 1, L: 1, mode: 'PI', Kp: 0.5, Ki: 0.4 },
    { type: 1, K: 0.4, e: 2.5, dist: 0 },
  ],
];
export function steadyCase(set: Settings) {
  const a = app(set),
    c = a.errorConstants(),
    e = a.steadyErrors()!;
  return { type: c.type, K: [c.Kp, c.Kv, c.Ka][c.type], e: e.ref[c.type], dist: e.dist };
}

/** Nyquist criterion: Z = N + P against the number of closed-loop poles in the right half-plane, counted from the
 *  roots of the characteristic polynomial, over every combination of a plant, a controller and a gain */
export const NYQ_PLANTS: [string, Settings][] = [
  ['1st-order lag', { plant: 'first', K: 1, T: 1 }],
  ['2nd-order (ζ = 0.2)', { plant: 'second', K: 1, zeta: 0.2, wn: 1 }],
  ['3rd-order lag', { plant: 'third', K: 1, T: 1 }],
  ['Integrator + 1st-order lag', { plant: 'integ', K: 1, T: 1 }],
  ['Unstable 1st-order', { plant: 'unstable', K: 1, T: 1 }],
  ['1/(s(s+1)(s+2))', { plant: 'custom', cNum: [1], cDen: [1, 3, 2, 0], L: 0 }],
  ['(s+2)/((s−1)(s+3))', { plant: 'custom', cNum: [1, 2], cDen: [1, 2, -3], L: 0, cUnstable: true }],
  ['(1−s)/((s+1)(0.1s+1))', { plant: 'custom', cNum: [-1, 1], cDen: [0.1, 1.1, 1], L: 0 }],
];
export function nyquistAgreement(plant: Settings) {
  let cases = 0,
    agree = 0,
    skipped = 0;
  for (const mode of ['P', 'PI', 'PD', 'PID'])
    for (const Kp of [0.1, 0.3, 1, 3, 10, 30]) {
      const a = app({ ...plant, mode, Kp, Ki: Kp * 0.5, Kd: Kp * 0.3, N: 20 }),
        nq = a.nyquistCount(),
        cl = a.computePZ().cl as C[];
      if (!nq || nq.through || cl.some(z => Math.abs(z[0]) < 1e-6)) {
        skipped++;
        continue;
      }
      cases++;
      if (nq.Z === cl.filter(z => z[0] > 0).length) agree++;
    }
  return { cases, agree, skipped };
}

/** Straight-line approximation of the Bode plot: the break frequencies against the exact |roots|, and the asymptotes
 *  against our own construction from the exact poles and zeros (gain and phase, on 1e-3 … 1e3 rad/s) */
interface Factor {
  w: number;
  mult: number;
  zeta: number; // 1 for a real root, |cos| of the angle for a complex pair (counted once)
  zero: boolean;
  rhp: boolean;
}
export const ASYM_CASES: [string, Settings, { K: number; q: number; f: Factor[] }][] = [
  [
    '3rd-order lag + P: a triple pole at 1',
    { plant: 'third', K: 1, T: 1, mode: 'P', Kp: 1 },
    { K: 1, q: 0, f: [{ w: 1, mult: 3, zeta: 1, zero: false, rhp: false }] },
  ],
  [
    '2nd-order (ζ = 0.2, ωn = 2) + P',
    { plant: 'second', K: 1, zeta: 0.2, wn: 2, mode: 'P', Kp: 1 },
    { K: 1, q: 0, f: [{ w: 2, mult: 1, zeta: 0.2, zero: false, rhp: false }] },
  ],
  [
    '1st-order lag (T = 0.5) + PI: zero 0.5, pole 2, integrator',
    { plant: 'first', K: 1, T: 0.5, mode: 'PI', Kp: 1, Ki: 0.5 },
    {
      K: 0.5,
      q: 1,
      f: [
        { w: 0.5, mult: 1, zeta: 1, zero: true, rhp: false },
        { w: 2, mult: 1, zeta: 1, zero: false, rhp: false },
      ],
    },
  ],
  [
    '(1−s)/((s+1)(0.1s+1)) + P: a zero in the right half-plane',
    { plant: 'custom', cNum: [-1, 1], cDen: [0.1, 1.1, 1], L: 0, mode: 'P', Kp: 1 },
    {
      K: 1,
      q: 0,
      f: [
        { w: 1, mult: 1, zeta: 1, zero: true, rhp: true },
        { w: 1, mult: 1, zeta: 1, zero: false, rhp: false },
        { w: 10, mult: 1, zeta: 1, zero: false, rhp: false },
      ],
    },
  ],
];
export function asymptoteCase(set: Settings, ex: { K: number; q: number; f: Factor[] }) {
  const a = app(set),
    as = a.bodeAsymptote()!;
  const lg = Math.log10,
    clip = (x: number) => Math.min(1, Math.max(0, x));
  const gain = (w: number) =>
    20 * lg(Math.abs(ex.K)) -
    20 * ex.q * lg(w) +
    ex.f.reduce((s, f) => s + (f.zero ? 1 : -1) * 20 * f.mult * (f.zeta < 1 ? 2 : 1) * Math.max(0, lg(w / f.w)), 0);
  const phase = (w: number) =>
    -90 * ex.q +
    (ex.K < 0 ? 180 : 0) +
    ex.f.reduce((s, f) => {
      const sgn = (f.zero ? 1 : -1) * (f.rhp ? -1 : 1);
      return f.zeta < 1
        ? s + sgn * 180 * f.mult * clip((lg(w) - (lg(f.w) - f.zeta)) / (2 * f.zeta))
        : s + sgn * 90 * f.mult * clip((lg(w) - lg(f.w / 10)) / 2);
    }, 0);
  const brk = [...new Set(ex.f.map(f => f.w))].sort((x, y) => x - y);
  let eg = 0,
    ep = 0;
  for (let i = 0; i <= 600; i++) {
    const w = Math.pow(10, -3 + i / 100);
    eg = Math.max(eg, Math.abs(as.gain(w) - gain(w)));
    const d = ((((as.phase(w) - phase(w)) % 360) + 540) % 360) - 180;
    ep = Math.max(ep, Math.abs(d));
  }
  const got = as.breaks.map((b: { w: number }) => b.w);
  const eb =
    got.length === brk.length
      ? Math.max(...got.map((w: number, i: number) => Math.abs(w - brk[i]) / brk[i]))
      : Infinity;
  return { breaks: got, eb, eg, ep };
}

/** Construction rules of the root locus against their exact values (worked out by hand from L(s)) */
export const RULE_CASES: [
  string,
  Settings,
  { centroid: number | null; breakaway: [number, number][]; crossings: [number, number][]; departure: number | null },
][] = [
  [
    '1/(s(s+1)(s+2))',
    { plant: 'custom', cNum: [1], cDen: [1, 3, 2, 0], L: 0, mode: 'P', Kp: 1 },
    {
      centroid: -1,
      breakaway: [[-1 + 1 / Math.sqrt(3), (2 / 3) * (1 / Math.sqrt(3))]],
      crossings: [[Math.SQRT2, 6]],
      departure: null,
    },
  ],
  [
    '1/(s(s²+2s+2)): departure from −1 + j',
    { plant: 'custom', cNum: [1], cDen: [1, 2, 2, 0], L: 0, mode: 'P', Kp: 1 },
    { centroid: -2 / 3, breakaway: [], crossings: [[Math.SQRT2, 4]], departure: -45 },
  ],
  [
    '(s+3)/(s(s+1)): breakaway and break-in',
    { plant: 'custom', cNum: [1, 3], cDen: [1, 1, 0], L: 0, mode: 'P', Kp: 1 },
    {
      centroid: null,
      breakaway: [
        [-3 + Math.sqrt(6), 5 - 2 * Math.sqrt(6)],
        [-3 - Math.sqrt(6), 5 + 2 * Math.sqrt(6)],
      ],
      crossings: [],
      departure: null,
    },
  ],
];
export function rulesCase(set: Settings) {
  const a = app(set),
    r = a.locusRules()!;
  const dep = r.departures.find((d: { at: C }) => d.at[1] > 0.5);
  return {
    centroid: r.asymAngles.length > 1 ? r.centroid : null,
    breakaway: r.breakaway
      .filter((b: { s: C }) => Math.abs(b.s[1]) < 1e-9)
      .map((b: { s: C; k: number }) => [b.s[0], b.k] as [number, number])
      .sort((x: [number, number], y: [number, number]) => y[0] - x[0]),
    crossings: r.crossings.map((c: { w: number; k: number }) => [c.w, c.k] as [number, number]),
    departure: dep ? dep.angles[0] : null,
  };
}
/** Largest difference between the rules found and the exact ones (Infinity when an item is missing or extra) */
export function rulesError(
  got: ReturnType<typeof rulesCase>,
  ex: {
    centroid: number | null;
    breakaway: [number, number][];
    crossings: [number, number][];
    departure: number | null;
  },
) {
  const one = (x: number | null, y: number | null) =>
    x === null || y === null ? (x === y ? 0 : Infinity) : Math.abs(x - y);
  const many = (x: [number, number][], y: [number, number][]) =>
    x.length !== y.length
      ? Infinity
      : Math.max(
          0,
          ...x.flatMap((p, i) => [Math.abs(p[0] - y[i][0]), Math.abs(p[1] - y[i][1]) / Math.max(1, Math.abs(y[i][1]))]),
        );
  const ex2 = { ...ex, breakaway: ex.breakaway.slice().sort((x, y) => y[0] - x[0]) };
  return Math.max(
    one(got.centroid, ex2.centroid),
    many(got.breakaway, ex2.breakaway),
    many(got.crossings, ex2.crossings),
    one(got.departure, ex2.departure),
  );
}

// ---------- report ----------
if (import.meta.main) {
  const P = console.log;
  P('### Time response (no dead time)\n');
  P(
    '| Case | m | h [s] | Max. error of y | Overshoot [%] app / exact | Rise time [s] app / exact | Settling time [s] app / exact |',
  );
  P('|---|---|---|---|---|---|---|');
  for (const [name, set] of TIME_CASES) {
    const r = timeCase(set);
    P(
      `| ${name} | ${r.m} | ${r.h.toPrecision(2)} | ${sci(r.err)} | ${fmt(r.got?.os, 2)} / ${fmt(r.ref.os, 2)} | ${fmt(r.got?.rise)} / ${fmt(r.ref.rise)} | ${fmt(r.got?.ts)} / ${fmt(r.ref.ts)} |`,
    );
  }
  P('\n### Time response of lightly damped loops\n');
  P(
    '| Case | ζ of the dominant poles | m | h [s] | Max. error of y (relative) | Overshoot [%] app / exact | Rise time [s] app / exact | Settling time [s] app / exact |',
  );
  P('|---|---|---|---|---|---|---|---|');
  for (const [name, zeta, set] of LIGHT_CASES) {
    const r = timeCase(set);
    P(
      `| ${name} | ${zeta} | ${r.m} | ${r.h.toPrecision(2)} | ${(100 * r.rel).toFixed(2)} % | ${fmt(r.got?.os, 2)} / ${fmt(r.ref.os, 2)} | ${fmt(r.got?.rise)} / ${fmt(r.ref.rise)} | ${fmt(r.got?.ts)} / ${fmt(r.ref.ts)} |`,
    );
  }
  P('\n### Time response with dead time\n');
  P('| Case | h [s] | Max. error of y | Overshoot [%] app / exact | Settling time [s] app / exact |');
  P('|---|---|---|---|---|');
  for (const [name, set] of DEAD_CASES) {
    const r = deadCase(set);
    P(
      `| ${name} | ${r.h.toPrecision(2)} | ${sci(r.err)} | ${fmt(r.got?.os, 2)} / ${fmt(r.ref.os, 2)} | ${fmt(r.got?.ts)} / ${fmt(r.ref.ts)} |`,
    );
  }
  P('\n### Frequency response\n');
  P('| Case | Phase margin [°] app / exact | Gain margin [dB] app / exact | Ms app / exact |');
  P('|---|---|---|---|');
  for (const [name, set] of FREQ_CASES) {
    const { got, ref } = freqCase(set);
    P(
      `| ${name} | ${fmt(got.pm, 3)} / ${fmt(ref.pm, 3)} | ${fmt(got.gm, 4)} / ${fmt(ref.gm, 4)} | ${fmt(got.ms, 5)} / ${fmt(ref.ms, 5)} |`,
    );
  }
  P('\n### Polynomial roots\n');
  P('| Polynomial | Max. error of the roots |');
  P('|---|---|');
  for (const k of [2, 3, 4, 6, 8]) {
    let p = [1];
    for (let i = 0; i < k; i++) p = pMul(p, [1, 1]);
    P(
      `| (s+1)^${k} (a ${k}-fold root) | ${sci(
        rootError(
          p,
          Array.from({ length: k }, (): C => [-1, 0]),
        ),
      )} |`,
    );
  }
  {
    let p = [1];
    const ex: C[] = [];
    for (let i = 1; i <= 10; i++) {
      p = pMul(p, [1, i]);
      ex.push([-i, 0]);
    }
    P(`| (s+1)(s+2)…(s+10) | ${sci(rootError(p, ex))} |`);
    P(
      `| (s+0.001)(s+1000) | ${sci(
        rootError(pMul([1, 1e-3], [1, 1e3]), [
          [-1e-3, 0],
          [-1e3, 0],
        ]),
      )} |`,
    );
    const z = 0.9;
    P(
      `| s² + 2·0.9·s + 1 | ${sci(
        rootError(
          [1, 2 * z, 1],
          [
            [-z, Math.sqrt(1 - z * z)],
            [-z, -Math.sqrt(1 - z * z)],
          ],
        ),
      )} |`,
    );
  }
  P('\n### Discretization of the plant\n');
  P('| Plant | Max. error of the step response |');
  P('|---|---|');
  for (const n of [1, 3, 6, 10]) P(`| 1/(s+1)^${n} | ${sci(discretizationError(n))} |`);
  P('\n### Poles with dead time (third-order Padé approximation)\n');
  P('| L/T | K_P | Dominant pole: Padé | exact | Error |');
  P('|---|---|---|---|---|');
  for (const [L, Kp] of [
    [0.2, 1],
    [0.5, 1],
    [1, 1],
    [2, 0.5],
    [3, 0.5],
  ]) {
    const r = padeCase(L, Kp);
    const c = (z: C) => `${z[0].toFixed(4)} ± ${z[1].toFixed(4)}j`;
    P(`| ${L} | ${Kp} | ${c(r.pade)} | ${c(r.exact)} | ${sci(r.err)} |`);
  }
  const rng = (x: [number, number][]) =>
    x.length
      ? x.map(([lo, hi]) => `${+lo.toPrecision(6)} … ${isFinite(hi) ? +hi.toPrecision(6) : '∞'}`).join(', ')
      : 'none';
  P('\n### Closed-loop frequency response\n');
  P('| Case | Mt app / exact | ωBW [rad/s] app / exact | max\\|Gyd\\| app / exact |');
  P('|---|---|---|---|');
  for (const [name, set] of CLOSED_CASES) {
    const { got, ref } = closedLoopCase(set);
    P(
      `| ${name} | ${fmt(got.mt, 5)} / ${fmt(ref.mt, 5)} | ${fmt(got.wbw, 4)} / ${fmt(ref.wbw, 4)} | ${fmt(got.dmax, 5)} / ${fmt(ref.dmax, 5)} |`,
    );
  }
  P('\n### Stable range of the gain factor k\n');
  P('| Case | Routh–Hurwitz | Root locus | Exact | Largest error (Routh / locus) |');
  P('|---|---|---|---|---|');
  for (const [name, set] of STABLE_K_CASES) {
    const r = stableKCase(set);
    P(
      `| ${name} | ${rng(r.routh)} | ${rng(r.locus)} | ${rng(r.ref)} | ${sci(rangeError(r.routh, r.ref))} / ${sci(rangeError(r.locus, r.ref))} |`,
    );
  }
  P('\n### Steady-state error\n');
  P(
    '| Case | Type | Error constant app / exact | Error to the reference app / exact | Error to a step disturbance app / exact |',
  );
  P('|---|---|---|---|---|');
  for (const [name, set, ex] of STEADY_CASES) {
    const r = steadyCase(set);
    P(
      `| ${name} | ${r.type} / ${ex.type} | ${fmt(r.K, 6)} / ${fmt(ex.K, 6)} | ${fmt(r.e, 6)} / ${fmt(ex.e, 6)} | ${fmt(r.dist, 6)} / ${fmt(ex.dist, 6)} |`,
    );
  }
  P('\n### Nyquist criterion\n');
  P('| Plant | Cases | Z = N + P equal to the roots in the right half-plane | Left out (a pole on the axis) |');
  P('|---|---|---|---|');
  for (const [name, set] of NYQ_PLANTS) {
    const r = nyquistAgreement(set);
    P(`| ${name} | ${r.cases} | ${r.agree} | ${r.skipped} |`);
  }
  P('\n### Straight-line approximation of the Bode plot\n');
  P(
    '| Case | Break frequencies | Error of the break frequencies | Error of the gain asymptote [dB] | Error of the phase asymptote [°] |',
  );
  P('|---|---|---|---|---|');
  for (const [name, set, ex] of ASYM_CASES) {
    const r = asymptoteCase(set, ex);
    P(
      `| ${name} | ${r.breaks.map((w: number) => +w.toPrecision(6)).join(', ')} | ${sci(r.eb)} | ${sci(r.eg)} | ${sci(r.ep)} |`,
    );
  }
  P('\n### Construction rules of the root locus\n');
  P(
    '| L(s) | Centroid | Breakaway / break-in (s, k) | Imaginary-axis crossings (ω, k) | Departure angle | Largest error |',
  );
  P('|---|---|---|---|---|---|');
  for (const [name, set, ex] of RULE_CASES) {
    const g = rulesCase(set),
      pts = (x: [number, number][]) =>
        x.length ? x.map(([u, v]) => `(${u.toFixed(5)}, ${v.toFixed(5)})`).join(', ') : '—';
    P(
      `| ${name} | ${fmt(g.centroid, 5)} | ${pts(g.breakaway)} | ${pts(g.crossings)} | ${g.departure === null ? '—' : g.departure.toFixed(3) + '°'} | ${sci(rulesError(g, ex))} |`,
    );
  }
  P('\n### Sine reference\n');
  P('| Period [s] | Error of the amplitude ratio | Error of the phase difference [°] |');
  P('|---|---|---|');
  for (const [Tp, Tsim] of [
    [20, 100],
    [5, 40],
    [1, 20],
    [0.3, 10],
  ]) {
    const r = sineCase(Tp, Tsim);
    P(`| ${Tp} | ${(r.ratio * 100).toFixed(2)} % | ${r.phase.toFixed(2)} |`);
  }
}
