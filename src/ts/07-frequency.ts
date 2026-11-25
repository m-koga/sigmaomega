// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Frequency response ================= */
import { cadd, cdiv, cmul, polyRoots, polyval } from './03-math.ts';
import { CONTROLLERS, PID_MODES, PLANTS, hasTerm } from './05-definitions.ts';
import { S, ctrlRational, isTFMode } from './06-state.ts';

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
// Frequency response over the automatic range, or over rng (powers of 10) when it is given
export function freqResp(st: State = S, rng?: [number, number]) {
  const tf = PLANTS[st.plant].tf(st);
  const [w0, w1] = rng || freqRange(tf, st);
  const NW = Math.max(2, Math.min(2400, Math.round(150 * (w1 - w0))));
  const W: number[] = [];
  for (let i = 0; i < NW; i++) W.push(Math.pow(10, w0 + ((w1 - w0) * i) / (NW - 1)));
  const Ls = bodeSeries(W, w => evalCP(w, tf, st), tf.L),
    Ps = bodeSeries(W, w => evalPr(w, tf), tf.L),
    Cs = bodeSeries(W, w => evalC(w, st), 0);
  const Lc = Ls.cs,
    mag = Ls.mag,
    ph = Ls.ph;
  // Margins
  let wgc: number | null = null,
    pm: number | null = null,
    wpc: number | null = null,
    gm: number | null = null;
  for (let i = 1; i < NW; i++) {
    if (wgc === null && mag[i - 1] >= 0 && mag[i] < 0) {
      const a = mag[i - 1] / (mag[i - 1] - mag[i]);
      wgc = Math.pow(10, Math.log10(W[i - 1]) + a * (Math.log10(W[i]) - Math.log10(W[i - 1])));
      pm = 180 + ph[i - 1] + a * (ph[i] - ph[i - 1]);
    }
    if (wpc === null && ph[i - 1] > -180 && ph[i] <= -180) {
      const a = (ph[i - 1] + 180) / (ph[i - 1] - ph[i]);
      wpc = Math.pow(10, Math.log10(W[i - 1]) + a * (Math.log10(W[i]) - Math.log10(W[i - 1])));
      gm = -(mag[i - 1] + a * (mag[i] - mag[i - 1]));
    }
  }
  // Sensitivity S = 1/(1+L) and complementary sensitivity T = L/(1+L)
  let ii = 0;
  const Ss = bodeSeries(W, () => cdiv([1, 0], cadd([1, 0], Lc[ii++])), 0);
  ii = 0;
  const Ts = bodeSeries(
    W,
    () => {
      const L = Lc[ii++];
      return cdiv(L, cadd([1, 0], L));
    },
    0,
  );
  const sens = sensMetrics(W, Ss.mag, Ts.mag);
  // Disturbance at the plant input to the output: P/(1+L) = P S; reference to the output: Cr P/(1+L)
  ii = 0;
  const Ds = bodeSeries(
    W,
    () => {
      const i = ii++;
      return cmul(Ps.cs[i], Ss.cs[i]);
    },
    0,
  );
  ii = 0;
  const Rs = bodeSeries(
    W,
    () => {
      const i = ii++;
      return cmul(cmul(evalCr(W[i], st), Ps.cs[i]), Ss.cs[i]);
    },
    0,
  );
  let dmax = -Infinity,
    wdmax: number | null = null;
  Ds.mag.forEach((v, i) => {
    if (isFinite(v) && v > dmax) {
      dmax = v;
      wdmax = W[i];
    }
  });
  return {
    W,
    Lc,
    mag,
    ph,
    P: Ps,
    C: Cs,
    S: Ss,
    T: Ts,
    D: Ds,
    Gyr: Rs,
    dmax: isFinite(dmax) ? Math.pow(10, dmax / 20) : null,
    wdmax,
    ...sens,
    wgc,
    pm,
    wpc,
    gm,
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
export function sensMetrics(W: number[], sm: number[], tm: number[]) {
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
  return {
    ms: isFinite(ms) ? Math.pow(10, ms / 20) : null,
    wms,
    mt: isFinite(mt) ? Math.pow(10, mt / 20) : null,
    wmt,
    wbw,
  };
}
