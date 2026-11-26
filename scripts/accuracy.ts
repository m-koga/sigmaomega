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
/** Largest distance from an exact root to the nearest computed root */
export function rootError(poly: number[], exact: C[]) {
  const r: C[] = fresh().polyRoots(poly);
  return Math.max(...exact.map(z => Math.min(...r.map(q => Math.hypot(q[0] - z[0], q[1] - z[1])))));
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
