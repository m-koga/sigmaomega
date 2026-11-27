// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Frequency response ================= */
import { cadd, cdiv, cmul, polyRoots, polyval } from './03-math.ts';
import { CONTROLLERS, PID_MODES, PLANTS, hasTerm } from './10-definitions.ts';
import { S, ctrlRational, isTFMode } from './11-state.ts';

// C(jω)P(jω) (without dead time)
// C(jω)
export function evalC(w: number, st: State = S): Complex {
  const s: Complex = [0, w];
  const useP = hasTerm(st, 'P'),
    useI = hasTerm(st, 'I'),
    useD = hasTerm(st, 'D');
  let C: Complex;
  if (isTFMode(st)) {
    const r = ctrlRational(st);
    C = cdiv(polyval(r.num, s), polyval(r.den, s));
  } else {
    C = [useP ? st.Kp : 0, 0];
    if (useI) C = cadd(C, [0, -st.Ki / w]);
    if (useD) C = cadd(C, cdiv(cmul([st.Kd * st.N, 0], s), cadd(s, [st.N, 0])));
  }
  return C;
}
// Set-point weights of the PID controller: u = KP(b r − y) + KI/s (r − y) + KD s/(s/N+1) (c r − y)
// (b = c = 1: ordinary PID; PI-D: c = 0)
export const twoDof = (st: State = S) => {
  const w = spWeights(st);
  return w.b !== 1 || w.c !== 1;
};
export function spWeights(st: State = S): { b: number; c: number } {
  if (!PID_MODES.includes(st.mode)) return { b: 1, c: 1 };
  return { b: st.tdof ? st.bw : 1, c: st.dOnMeas ? 0 : st.tdof ? st.cw : 1 };
}
// Controller acting on the reference, Cr(jω) (equal to C(jω) unless set-point weights are used)
export function evalCr(w: number, st: State = S): Complex {
  if (isTFMode(st)) return evalC(w, st);
  const { b, c } = spWeights(st),
    s: Complex = [0, w],
    useP = hasTerm(st, 'P'),
    useI = hasTerm(st, 'I'),
    useD = hasTerm(st, 'D');
  let C: Complex = [useP ? st.Kp * b : 0, 0];
  if (useI) C = cadd(C, [0, -st.Ki / w]);
  if (useD) C = cadd(C, cdiv(cmul([st.Kd * st.N * c, 0], s), cadd(s, [st.N, 0])));
  return C;
}
// P(jω) (without dead time)
export function evalPr(w: number, tf: Rational): Complex {
  const s: Complex = [0, w];
  return cdiv(polyval(tf.num, s), polyval(tf.den, s));
}
export function evalCP(w: number, tf: Rational, st: State = S): Complex {
  return cmul(evalC(w, st), evalPr(w, tf));
}
// Closed loop from the reference to the output, Gyr = Cr P / (1 + C P) (= T without set-point weights)
export function evalT(w: number, st: State = S): Complex {
  const tf = PLANTS[st.plant].tf(st),
    dl: Complex = [Math.cos(-w * tf.L), Math.sin(-w * tf.L)];
  const Pd = cmul(evalPr(w, tf), dl),
    L = cmul(evalC(w, st), Pd);
  return cdiv(cmul(evalCr(w, st), Pd), cadd([1, 0], L));
}
// Frequency range to display, chosen from poles, zeros, dead time, and simulation time (in powers of 10)
export function freqRange(tf: Rational & { L?: number }, st: State = S): [number, number] {
  const mags = rangeMags(tf, st);
  let a = Math.floor(Math.log10(Math.min(...mags) / 100)),
    b = Math.ceil(Math.log10(Math.max(...mags) * 100));
  a = Math.max(a, -7);
  b = Math.min(b, 7);
  if (b - a < 4) {
    const c = (a + b) / 2;
    a = Math.floor(c - 2);
    b = Math.ceil(c + 2);
  }
  return [a, b];
}
// Limits of a frequency range set by hand [rad/s]
export const WR_MIN = 1e-7,
  WR_MAX = 1e7;
// What the automatic range depends on (poles, zeros, dead time, simulation time), as text:
// a range set by hand is used only while this stays the same
export function rangeSig(st: State = S): string {
  return rangeMags(PLANTS[st.plant].tf(st), st)
    .map(m => m.toPrecision(6))
    .join(',');
}
// Range of the Bode plot set by hand, in powers of 10 (null: automatic, also when the poles, zeros,
// dead time or simulation time have changed since it was set)
export function bodeRange(st: State = S): [number, number] | null {
  const r = st.wr;
  if (!r || !r.on || !(r.lo >= WR_MIN && r.hi <= WR_MAX && r.hi > r.lo) || r.sig !== rangeSig(st)) return null;
  return [Math.log10(r.lo), Math.log10(r.hi)];
}
// Frequency response over the range set by hand, for the Bode plot (null when the range is automatic)
export function bodeResp(st: State = S): FreqResult | null {
  const r = bodeRange(st);
  return r ? freqResp(st, r) : null;
}
// Magnitudes of the poles and zeros of the plant and controller, 1/L and 2π/Tsim
function rangeMags(tf: Rational & { L?: number }, st: State): number[] {
  const mags: number[] = [];
  const add = (rs: Complex[]) =>
    rs.forEach(z => {
      const m = Math.hypot(z[0], z[1]);
      if (m > 1e-9) mags.push(m);
    });
  add(polyRoots(tf.den));
  add(polyRoots(tf.num));
  if (isTFMode(st)) {
    const r = ctrlRational(st);
    add(polyRoots(r.den));
    add(polyRoots(r.num));
  } else {
    if (hasTerm(st, 'D')) mags.push(st.N);
    if (hasTerm(st, 'I') && st.Kp > 0 && st.Ki > 0) mags.push(st.Ki / st.Kp);
  }
  if (tf.L && tf.L > 0) mags.push(1 / tf.L);
  mags.push((2 * Math.PI) / st.Tsim);
  return mags;
}
// Gain [dB] and unwrapped phase [deg] of a frequency response (including dead time Ld)
export function bodeSeries(W: number[], F: (w: number) => Complex, Ld: number) {
  const mag: number[] = [],
    ph: number[] = [],
    cs: Complex[] = [];
  let prev: number | null = null,
    off = 0;
  W.forEach(w => {
    let z = F(w);
    const raw = (Math.atan2(z[1], z[0]) * 180) / Math.PI;
    if (prev === null) {
      off = raw > 90 ? -360 : 0;
    } else {
      let d = raw + off - prev;
      while (d > 180) {
        off -= 360;
        d -= 360;
      }
      while (d < -180) {
        off += 360;
        d += 360;
      }
    }
    const phr = raw + off;
    prev = phr;
    if (Ld > 0) z = cmul(z, [Math.cos(-w * Ld), Math.sin(-w * Ld)]);
    cs.push(z);
    mag.push(20 * Math.log10(Math.hypot(z[0], z[1]) || 1e-300));
    ph.push(phr - (w * Ld * 180) / Math.PI);
  });
  return { mag, ph, cs };
}
// Frequencies from 10^w0 to 10^w1: 150 per decade, at most 2400
function freqGrid(w0: number, w1: number): number[] {
  const NW = Math.max(2, Math.min(2400, Math.round(150 * (w1 - w0)))),
    W: number[] = [];
  for (let i = 0; i < NW; i++) W.push(Math.pow(10, w0 + ((w1 - w0) * i) / (NW - 1)));
  return W;
}
// Gain and phase margins of L: the first crossings of 0 dB and of −180°, interpolated between the grid points
function stabilityMargins(W: number[], mag: number[], ph: number[]) {
  let wgc: number | null = null,
    pm: number | null = null,
    wpc: number | null = null,
    gm: number | null = null;
  const at = (i: number, a: number) =>
    Math.pow(10, Math.log10(W[i - 1]) + a * (Math.log10(W[i]) - Math.log10(W[i - 1])));
  for (let i = 1; i < W.length; i++) {
    if (wgc === null && mag[i - 1] >= 0 && mag[i] < 0) {
      const a = mag[i - 1] / (mag[i - 1] - mag[i]);
      wgc = at(i, a);
      pm = 180 + ph[i - 1] + a * (ph[i] - ph[i - 1]);
    }
    if (wpc === null && ph[i - 1] > -180 && ph[i] <= -180) {
      const a = (ph[i - 1] + 180) / (ph[i - 1] - ph[i]);
      wpc = at(i, a);
      gm = -(mag[i - 1] + a * (mag[i] - mag[i - 1]));
    }
  }
  return { wgc, pm, wpc, gm };
}
// The closed-loop responses on the grid, from L(jω) and P(jω): the sensitivity S = 1/(1+L), the complementary
// sensitivity T = L/(1+L), the disturbance at the plant input to the output P/(1+L) = P S, and the reference to
// the output Cr P/(1+L)
function closedLoopSeries(W: number[], Lc: Complex[], Pc: Complex[], st: State) {
  const one: Complex = [1, 0],
    series = (f: (i: number) => Complex) => {
      let i = 0;
      return bodeSeries(W, () => f(i++), 0);
    };
  const Ss = series(i => cdiv(one, cadd(one, Lc[i]))),
    Ts = series(i => cdiv(Lc[i], cadd(one, Lc[i]))),
    Ds = series(i => cmul(Pc[i], Ss.cs[i])),
    Rs = series(i => cmul(cmul(evalCr(W[i], st), Pc[i]), Ss.cs[i]));
  return { Ss, Ts, Ds, Rs };
}
// The largest finite value of mag [dB] (as a ratio) and its frequency
function peakOf(W: number[], mag: number[]): { dmax: number | null; wdmax: number | null } {
  let max = -Infinity,
    w: number | null = null;
  mag.forEach((v, i) => {
    if (isFinite(v) && v > max) {
      max = v;
      w = W[i];
    }
  });
  return { dmax: isFinite(max) ? Math.pow(10, max / 20) : null, wdmax: w };
}
// Frequency response over the automatic range, or over rng (powers of 10) when it is given: L, P, C and the
// closed-loop responses, the margins and the peaks of the sensitivities
export function freqResp(st: State = S, rng?: [number, number]) {
  const tf = PLANTS[st.plant].tf(st);
  const [w0, w1] = rng || freqRange(tf, st);
  const W = freqGrid(w0, w1);
  const Ls = bodeSeries(W, w => evalCP(w, tf, st), tf.L),
    Ps = bodeSeries(W, w => evalPr(w, tf), tf.L),
    Cs = bodeSeries(W, w => evalC(w, st), 0);
  const { Ss, Ts, Ds, Rs } = closedLoopSeries(W, Ls.cs, Ps.cs, st);
  // L(jω) with the dead time, for refining the peaks of |S| and |T| between the grid points
  const Lw = (w: number): Complex => cmul(evalCP(w, tf, st), [Math.cos(-w * tf.L), Math.sin(-w * tf.L)]);
  return {
    W,
    Lc: Ls.cs,
    mag: Ls.mag,
    ph: Ls.ph,
    P: Ps,
    C: Cs,
    S: Ss,
    T: Ts,
    D: Ds,
    Gyr: Rs,
    ...peakOf(W, Ds.mag),
    ...sensMetrics(W, Ss.mag, Ts.mag, Lw),
    ...stabilityMargins(W, Ls.mag, Ls.ph),
    w0,
    w1,
    openUnstable: !!PLANTS[st.plant].unstable?.(st) || !!CONTROLLERS[st.mode].unstable?.(st),
  };
}

// Response to the step disturbance: largest deviation of y from its value at t_d, and the recovery time
// (after which y stays within 2% of |r| of its value at t_d, or within 10% of the largest deviation when r = 0)
export function distMetrics(sim: SimResult, st: State = S): { dev: number; rec: number | null } | null {
  if (!st.dOn || sim.diverged || st.td >= st.Tsim) return null;
  let i0 = 0;
  while (i0 < sim.T.length - 1 && sim.T[i0] < st.td) i0++;
  const y0 = sim.Y[i0];
  let dev = 0;
  for (let i = i0; i < sim.T.length; i++) dev = Math.max(dev, Math.abs(sim.Y[i] - y0));
  const band = Math.abs(st.R) > 1e-9 ? 0.02 * Math.abs(st.R) : 0.1 * dev;
  let lastOut = -1;
  for (let i = i0; i < sim.T.length; i++) if (Math.abs(sim.Y[i] - y0) > band) lastOut = i;
  const rec = lastOut < 0 ? 0 : lastOut === sim.T.length - 1 ? null : sim.T[lastOut + 1] - st.td;
  return { dev, rec };
}
// Peaks of |S| and |T| and the closed-loop bandwidth (|T| falls 3 dB below its low-frequency value)
// Peak of f (a magnitude) near the grid point i of W: golden-section search over log ω between the neighbouring
// points, so that a sharp peak between two grid points is not missed. Returns [peak value, ω at the peak].
export function refinePeak(W: number[], i: number, f: (w: number) => number): [number, number] {
  if (i <= 0 || i >= W.length - 1) return [f(W[i]), W[i]];
  let a = Math.log(W[i - 1]),
    b = Math.log(W[i + 1]);
  const g = (Math.sqrt(5) - 1) / 2;
  let x1 = b - g * (b - a),
    x2 = a + g * (b - a),
    f1 = f(Math.exp(x1)),
    f2 = f(Math.exp(x2));
  for (let k = 0; k < 60; k++) {
    if (f1 >= f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = b - g * (b - a);
      f1 = f(Math.exp(x1));
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = a + g * (b - a);
      f2 = f(Math.exp(x2));
    }
  }
  const fi = f(W[i]),
    best = Math.max(f1, f2);
  return best > fi ? [best, Math.exp(f1 >= f2 ? x1 : x2)] : [fi, W[i]];
}
// Peak sensitivity Ms, peak complementary sensitivity Mt (with the frequencies of the peaks) and the closed-loop
// bandwidth, from the gains in dB on the grid W; with L (the open-loop frequency response), the peaks are refined
// between the grid points
export function sensMetrics(W: number[], sm: number[], tm: number[], L?: (w: number) => Complex) {
  let ms = -Infinity,
    wms: number | null = null,
    mt = -Infinity,
    wmt: number | null = null;
  sm.forEach((v, i) => {
    if (isFinite(v) && v > ms) {
      ms = v;
      wms = W[i];
    }
  });
  tm.forEach((v, i) => {
    if (isFinite(v) && v > mt) {
      mt = v;
      wmt = W[i];
    }
  });
  let wbw: number | null = null;
  const t0 = tm[0];
  if (isFinite(t0) && t0 > -60)
    for (let i = 1; i < W.length; i++) {
      if (tm[i - 1] >= t0 - 3 && tm[i] < t0 - 3) {
        const a = (tm[i - 1] - (t0 - 3)) / (tm[i - 1] - tm[i]);
        wbw = Math.pow(10, Math.log10(W[i - 1]) + a * (Math.log10(W[i]) - Math.log10(W[i - 1])));
        break;
      }
    }
  let msv = isFinite(ms) ? Math.pow(10, ms / 20) : null,
    mtv = isFinite(mt) ? Math.pow(10, mt / 20) : null;
  if (L) {
    const absS = (w: number) => {
        const z = L(w);
        return 1 / Math.hypot(1 + z[0], z[1]);
      },
      absT = (w: number) => {
        const z = L(w);
        return Math.hypot(z[0], z[1]) / Math.hypot(1 + z[0], z[1]);
      };
    if (msv !== null && wms !== null) [msv, wms] = refinePeak(W, W.indexOf(wms), absS);
    if (mtv !== null && wmt !== null) [mtv, wmt] = refinePeak(W, W.indexOf(wmt), absT);
  }
  return { ms: msv, wms, mt: mtv, wmt, wbw };
}

/** M contour of the Nichols chart: the points (phase of L [deg], gain of L [dB]) where the closed loop
 *  |T| = |L/(1 + L)| equals M (given in dB), for the phases phs [deg]. Writing L = r e^{jφ},
 *  (1 − m²) r² − 2 m² cos φ · r − m² = 0; its positive roots give up to two branches (NaN where there is none) */
export function mContour(mDb: number, phs: number[]): { lo: number[]; hi: number[] } {
  const m2 = Math.pow(10, mDb / 10),
    a = 1 - m2,
    lo: number[] = [],
    hi: number[] = [];
  phs.forEach(p => {
    const c = Math.cos((p * Math.PI) / 180);
    let r1 = NaN,
      r2 = NaN;
    if (Math.abs(a) < 1e-12) {
      if (c < 0) r1 = -1 / (2 * c); // M = 0 dB: r = −1/(2 cos φ)
    } else {
      const d = m2 * m2 * c * c + a * m2;
      if (d >= 0) {
        const sq = Math.sqrt(d);
        r1 = (m2 * c + sq) / a;
        r2 = (m2 * c - sq) / a;
      }
    }
    const db = (r: number) => (r > 0 && isFinite(r) ? 20 * Math.log10(r) : NaN);
    const [x, y] = [db(r1), db(r2)];
    // the larger gain on the upper branch
    lo.push(isNaN(x) ? y : isNaN(y) ? x : Math.min(x, y));
    hi.push(isNaN(x) || isNaN(y) ? NaN : Math.max(x, y));
  });
  return { lo, hi };
}
