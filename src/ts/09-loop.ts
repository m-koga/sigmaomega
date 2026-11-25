// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Loop transfer function, closed-loop poles and root locus ================= */
import { lastOf, matchRoots, pAddDesc, pMul, pScale, polyRoots, trimPoly } from './03-math.ts';
import { PLANTS } from './05-definitions.ts';
import { S, ctrlRational, isTFMode } from './06-state.ts';

// Controller transfer function (P/PI/PD/PID are converted to rational form; common factors at the origin are cancelled)
export function ctrlTF(st: State = S): Rational {
  let num: Poly, den: Poly;
  if (isTFMode(st)) {
    const r = ctrlRational(st);
    num = r.num;
    den = r.den;
  } else {
    const Kp = st.Kp,
      Ki = st.Ki,
      Kd = st.Kd,
      N = st.N;
    let m = st.mode;
    if (m === 'PD' && Kd === 0) m = 'P';
    if (m === 'PID' && Kd === 0) m = 'PI';
    if (m === 'P') {
      num = [Kp];
      den = [1];
    } else if (m === 'PI') {
      num = [Kp, Ki];
      den = [1, 0];
    } else if (m === 'PD') {
      num = [Kp + Kd * N, Kp * N];
      den = [1, N];
    } else {
      num = [Kp + Kd * N, Kp * N + Ki, Ki * N];
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
// Ranges of k (within 1e-4 … 1e4) for which all closed-loop poles are in the left half-plane
export function stableRanges(st: State = S): [number, number][] {
  const { num, den } = loopRational(st);
  const maxRe = (k: number) => Math.max(...polyRoots(trimPoly(pAddDesc(den, pScale(num, k)))).map(z => z[0]));
  const ks = LOCUS_KS,
    stable = ks.map(k => maxRe(k) < 0),
    out: [number, number][] = [];
  const edge = (a: number, b: number) => {
    let lo = a,
      hi = b,
      sa = maxRe(a) < 0;
    for (let i = 0; i < 50; i++) {
      const m = Math.sqrt(lo * hi);
      if (maxRe(m) < 0 === sa) lo = m;
      else hi = m;
    }
    return Math.sqrt(lo * hi);
  };
  let start: number | null = stable[0] ? 0 : null;
  for (let i = 1; i < ks.length; i++) {
    if (stable[i] && !stable[i - 1]) start = edge(ks[i - 1], ks[i]);
    if (!stable[i] && stable[i - 1]) {
      out.push([start ?? 0, edge(ks[i - 1], ks[i])]);
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
export const stableKRanges = (): [number, number][] => (lastRanges ??= stableRanges());
// The root locus is computed again when next needed (the pole specifications changed)
export function resetLocus() {
  lastLocus = null;
}
// The root locus and the stable gain ranges are computed again when next needed (the loop changed)
export function resetLoopCache() {
  lastLocus = null;
  lastRanges = null;
}
