// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Loop transfer function, closed-loop poles and root locus ================= */
import {
  cadd,
  cdiv,
  cmul,
  lastOf,
  matchRoots,
  pAddDesc,
  pMul,
  pScale,
  polyRoots,
  polyval,
  trimPoly,
} from './03-math.ts';
import { PLANTS } from './05-definitions.ts';
import { S, ctrlRational, isTFMode } from './06-state.ts';
import { spWeights } from './07-frequency.ts';

// Controller transfer function (P/PI/PD/PID are converted to rational form; common factors at the origin are cancelled).
// w: set-point weights of a PID, for the controller acting on the reference Cr(s) = KP b + KI/s + KD c s·N/(s+N)
// (the same denominator as C(s))
export function ctrlTF(st: State = S, w: { b: number; c: number } = { b: 1, c: 1 }): Rational {
  let num: Poly, den: Poly;
  if (isTFMode(st)) {
    const r = ctrlRational(st);
    num = r.num;
    den = r.den;
  } else {
    const Kp = st.Kp,
      Ki = st.Ki,
      Kd = st.Kd,
      N = st.N,
      Kpb = Kp * w.b,
      Kdc = Kd * w.c;
    let m = st.mode;
    if (m === 'PD' && Kd === 0) m = 'P';
    if (m === 'PID' && Kd === 0) m = 'PI';
    if (m === 'P') {
      num = [Kpb];
      den = [1];
    } else if (m === 'PI') {
      num = [Kpb, Ki];
      den = [1, 0];
    } else if (m === 'PD') {
      num = [Kpb + Kdc * N, Kpb * N];
      den = [1, N];
    } else {
      num = [Kpb + Kdc * N, Kpb * N + Ki, Ki * N];
      den = [1, N, 0];
    }
  }
  num = trimPoly(num.slice());
  den = trimPoly(den.slice());
  while (num.length > 1 && den.length > 1 && Math.abs(lastOf(num)) < 1e-14 && Math.abs(lastOf(den)) < 1e-14) {
    num = num.slice(0, -1);
    den = den.slice(0, -1);
  }
  return { num, den };
}
// Open-loop transfer function L(s) = num/den (dead time replaced by a third-order Padé approximation)
export function loopRational(st: State = S) {
  const tf = PLANTS[st.plant].tf(st),
    c = ctrlTF(st);
  let Nd = [1],
    Dd = [1];
  if (tf.L > 0) {
    const L = tf.L;
    Nd = [-(L ** 3) / 120, (L * L) / 10, -L / 2, 1];
    Dd = [L ** 3 / 120, (L * L) / 10, L / 2, 1];
  } // third-order Padé approximation
  return { num: trimPoly(pMul(pMul(tf.num, c.num), Nd)), den: trimPoly(pMul(pMul(tf.den, c.den), Dd)), tf, c };
}
/** A transfer function of the loop as num(s)·e^{−Ls}/(den0(s) + den1(s)·e^{−Ls}): delay tells whether the numerator
 *  has the dead time e^{−Ls} of the plant, den1 is empty when the denominator has none; den0 is monic */
export interface LoopTF {
  num: Poly;
  delay: boolean;
  den0: Poly;
  den1: Poly;
  L: number;
}
export type LoopTFKey = 'L' | 'S' | 'T' | 'R' | 'D';
// Transfer functions of the loop with the plant P = Np e^{−Ls}/Dp and the controller C = Nc/Dc (Cr = Nr/Dr acting
// on the reference): with N = Np Nc and D = Dp Dc,
//   L = N e/D,  S = 1/(1+L) = D/(D + N e),  T = L/(1+L) = N e/(D + N e),
//   Gyd = P/(1+L) = Np Dc e/(D + N e),  Gyr = Cr P/(1+L) = Nr Np Dc e/(Dr (D + N e))  (Dr = Dc: Nr Np e/(D + N e)).
// The common factors of the numerator and the denominator are not cancelled.
export function loopTFs(st: State = S): Record<LoopTFKey, LoopTF> {
  const tf = PLANTS[st.plant].tf(st),
    c = ctrlTF(st),
    r = isTFMode(st) ? c : ctrlTF(st, spWeights(st)),
    N = trimPoly(pMul(tf.num, c.num)),
    D = trimPoly(pMul(tf.den, c.den)),
    L = tf.L > 0 ? tf.L : 0,
    sameDen = r.den.length === c.den.length && r.den.every((v, i) => v === c.den[i]);
  // the closed-loop denominator D + N e^{−Ls} (one polynomial without dead time)
  const cl = (k: Poly = [1]): [Poly, Poly] => (L ? [pMul(k, D), pMul(k, N)] : [trimPoly(pMul(k, pAddDesc(D, N))), []]);
  const make = (num: Poly, delay: boolean, [den0, den1]: [Poly, Poly]): LoopTF => {
    const a = den0[0];
    return {
      num: pScale(trimPoly(num), 1 / a),
      delay: delay && L > 0,
      den0: pScale(den0, 1 / a),
      den1: pScale(den1, 1 / a),
      L,
    };
  };
  return {
    L: make(N, true, [D, []]),
    S: make(D, false, cl()),
    T: make(N, true, cl()),
    D: make(pMul(tf.num, c.den), true, cl()),
    R: sameDen ? make(pMul(r.num, tf.num), true, cl()) : make(pMul(pMul(r.num, tf.num), c.den), true, cl(r.den)),
  };
}
// Value of a transfer function of the loop at s = jω
export function evalLoopTF(g: LoopTF, w: number): Complex {
  const s: Complex = [0, w],
    e: Complex = [Math.cos(-w * g.L), Math.sin(-w * g.L)],
    num = g.delay ? cmul(polyval(g.num, s), e) : polyval(g.num, s),
    den = g.den1.length ? cadd(polyval(g.den0, s), cmul(polyval(g.den1, s), e)) : polyval(g.den0, s);
  return cdiv(num, den);
}
// Root locus: closed-loop poles of den + k num for the gain factors ks (k = 1 is the current setting)
export function rootLocus(ks: number[], st: State = S): LocusPoint[] {
  const { num, den } = loopRational(st);
  const out: LocusPoint[] = [];
  let prev: Complex[] | null = null;
  for (const k of ks) {
    const chr = trimPoly(pAddDesc(den, pScale(num, k)));
    let r = polyRoots(chr, prev ?? undefined);
    if (prev && prev.length === r.length) r = matchRoots(prev, r);
    out.push({ k, r });
    prev = r;
  }
  return out;
}
export const LOCUS_KS = (() => {
  const a: number[] = [];
  for (let i = 0; i <= 640; i++) a.push(Math.pow(10, -4 + (8 * i) / 640));
  a.push(1);
  return a.sort((x, y) => x - y);
})();
// Ranges of k (within 1e-4 … 1e4) for which all closed-loop poles are in the left half-plane. pts: the root locus
// over LOCUS_KS (computed when not given); each boundary is then found by bisection, each step starting from the
// poles of the nearer known point, so that few iterations are needed
export function stableRanges(st: State = S, pts: LocusPoint[] = rootLocus(LOCUS_KS, st)): [number, number][] {
  const { num, den } = loopRational(st);
  const poles = (k: number, init: Complex[]) => polyRoots(trimPoly(pAddDesc(den, pScale(num, k))), init);
  const isStable = (r: Complex[]) => r.every(z => z[0] < 0);
  const stable = pts.map(p => isStable(p.r)),
    out: [number, number][] = [];
  const edge = (i: number) => {
    let lo = pts[i - 1].k,
      hi = pts[i].k,
      rLo = pts[i - 1].r;
    const sa = stable[i - 1];
    for (let n = 0; n < 50; n++) {
      const m = Math.sqrt(lo * hi),
        r = poles(m, rLo);
      if (isStable(r) === sa) {
        lo = m;
        rLo = r;
      } else hi = m;
    }
    return Math.sqrt(lo * hi);
  };
  let start: number | null = stable[0] ? 0 : null;
  for (let i = 1; i < pts.length; i++) {
    if (stable[i] && !stable[i - 1]) start = edge(i);
    if (!stable[i] && stable[i - 1]) {
      out.push([start ?? 0, edge(i)]);
      start = null;
    } // start is set while stable
  }
  if (start !== null) out.push([start, Infinity]);
  return out;
}
export function computePZ(st: State = S) {
  const { num, den, tf, c } = loopRational(st);
  const chr = trimPoly(pAddDesc(den, num));
  const allZero = c.num.every(v => v === 0);
  return {
    pp: polyRoots(tf.den),
    pz: polyRoots(tf.num),
    cp: polyRoots(c.den),
    cz: allZero ? [] : polyRoots(c.num),
    cl: polyRoots(chr),
    pade: tf.L > 0,
    L: tf.L,
  };
}
export let lastLocus: LocusPoint[] | null = null,
  lastRanges: [number, number][] | null = null;
// Root locus and stable ranges of k, computed when first needed after each update
export const locus = (): LocusPoint[] => (lastLocus ??= rootLocus(LOCUS_KS));
export const stableKRanges = (): [number, number][] => (lastRanges ??= stableRanges(S, locus()));
// The root locus is computed again when next needed (the pole specifications changed)
export function resetLocus() {
  lastLocus = null;
}
// The root locus and the stable gain ranges are computed again when next needed (the loop changed)
export function resetLoopCache() {
  lastLocus = null;
  lastRanges = null;
}
