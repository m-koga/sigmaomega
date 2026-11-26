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
export type PoleKey = 'P' | 'C' | LoopTFKey;
/** Poles and zeros of P(s), C(s) and of the transfer functions of the loop (as written in loopTFs: common factors not
 *  cancelled; the dead time has no zeros). approx: the closed-loop poles of a loop with dead time, from the
 *  third-order Padé approximation (the actual closed loop has infinitely many) */
export function loopPoles(
  st: State = S,
  pz: ReturnType<typeof computePZ> = computePZ(st),
): Record<PoleKey, { poles: Complex[]; zeros: Complex[]; approx: boolean }> {
  const c = ctrlTF(st),
    r = isTFMode(st) ? c : ctrlTF(st, spWeights(st)),
    sameDen = r.den.length === c.den.length && r.den.every((v, i) => v === c.den[i]),
    rz = r.num.every(v => v === 0) ? [] : polyRoots(r.num),
    cl = (zeros: Complex[]) => ({ poles: pz.cl, zeros, approx: pz.pade }),
    exact = (poles: Complex[], zeros: Complex[]) => ({ poles, zeros, approx: false });
  return {
    P: exact(pz.pp, pz.pz),
    C: exact(pz.cp, pz.cz),
    L: exact([...pz.pp, ...pz.cp], [...pz.pz, ...pz.cz]),
    // S = D/(D + N e): the zeros are the poles of P and C; T = N e/(D + N e): the zeros of P and C;
    // Gyd = Np Dc e/(D + N e): the zeros of P and the poles of C; Gyr = Nr Np e/(D + N e) (Nr Np Dc e/(Dr (D + N e))
    // when Cr has another denominator)
    S: cl([...pz.pp, ...pz.cp]),
    T: cl([...pz.pz, ...pz.cz]),
    D: cl([...pz.pz, ...pz.cp]),
    R: sameDen
      ? cl([...rz, ...pz.pz])
      : { poles: [...polyRoots(r.den), ...pz.cl], zeros: [...rz, ...pz.pz, ...pz.cp], approx: pz.pade },
  };
}
/* ---- Routh–Hurwitz stability test ---- */
/** Characteristic polynomial of the closed loop for the gain factor k (C(s) → k C(s)): D(s) + k N(s) = 0, with D and N
 *  of the same length (descending powers of s, the leading coefficient of D made 1); approx: with a dead time, replaced
 *  by its third-order Padé approximation */
export function charPolyK(st: State = S): { D: Poly; N: Poly; approx: boolean } {
  const { num, den, tf } = loopRational(st),
    n = Math.max(num.length, den.length),
    pad = (p: Poly) => [...new Array(n - p.length).fill(0), ...p],
    a = den[0];
  return { D: pad(den).map(v => v / a), N: pad(num).map(v => v / a), approx: tf.L > 0 };
}
export interface RouthResult {
  /** rows of the table, from s^n down to s^0 */
  rows: number[][];
  /** rows whose first element was zero and replaced by a small ε > 0 */
  eps: number[];
  /** rows of zeros replaced by the derivative of the auxiliary polynomial of the row above */
  aux: number[];
  /** sign changes in the first column: the number of roots in the right half-plane */
  changes: number;
}
/** Routh table of a polynomial (descending powers), with the two special cases: a zero first element is replaced by
 *  a small ε > 0, and a row of zeros by the derivative of the auxiliary polynomial of the row above */
export function routhArray(a: Poly): RouthResult {
  const n = a.length - 1,
    w = Math.floor(n / 2) + 1,
    scale = Math.max(...a.map(Math.abs)) || 1,
    row = (k: number) => Array.from({ length: w }, (_, j) => a[k + 2 * j] ?? 0),
    rows: number[][] = [row(0), row(1)],
    eps: number[] = [],
    aux: number[] = [];
  const tiny = (v: number, ref: number) => Math.abs(v) <= 1e-10 * ref;
  const fix = (i: number) => {
    const r = rows[i],
      ref = Math.max(scale, ...rows.slice(0, i).flat().map(Math.abs));
    if (r.every(v => tiny(v, ref)) && i > 0 && i < n) {
      // auxiliary polynomial of the row above (powers m+1, m−1, …) and its derivative
      const m = n - i;
      rows[i] = rows[i - 1].map((v, j) => v * (m + 1 - 2 * j)).map(v => (Math.abs(v) < 1e-300 ? 0 : v));
      aux.push(i);
    }
    if (tiny(rows[i][0], ref) && i < n) {
      rows[i][0] = 1e-9 * ref;
      eps.push(i);
    }
  };
  if (n >= 1) fix(1);
  for (let i = 2; i <= n; i++) {
    const p = rows[i - 2],
      q = rows[i - 1];
    rows.push(Array.from({ length: w }, (_, j) => (q[0] * (p[j + 1] ?? 0) - p[0] * (q[j + 1] ?? 0)) / q[0]));
    fix(i);
  }
  let changes = 0;
  for (let i = 1; i <= n; i++) if (Math.sign(rows[i][0]) !== Math.sign(rows[i - 1][0]) && rows[i][0] !== 0) changes++;
  return { rows, eps, aux, changes };
}
/** Hurwitz determinants Δ1(k) … Δn(k) of D(s) + k N(s) as polynomials in k (descending powers of k). The first
 *  column of the Routh table is a0, Δ1, Δ2/Δ1, …, Δn/Δn−1, so the closed loop is stable when every Δi(k) > 0 */
export function hurwitzK(D: Poly, N: Poly): Poly[] {
  type K = number[]; // ascending powers of k
  const n = D.length - 1,
    coef = (i: number): K => (i >= 0 && i <= n ? [D[i], N[i]] : [0]),
    add = (a: K, b: K) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0)),
    mul = (a: K, b: K) => {
      const r = new Array(a.length + b.length - 1).fill(0);
      a.forEach((x, i) => b.forEach((y, j) => (r[i + j] += x * y)));
      return r;
    };
  // determinant of a matrix of polynomials: expansion along the rows, memoized on the columns used
  const det = (M: K[][]): K => {
    const m = M.length,
      memo = new Map<number, K>();
    const f = (mask: number, r: number): K => {
      if (r === m) return [1];
      const hit = memo.get(mask);
      if (hit) return hit;
      let acc: K = [0],
        pos = 0;
      for (let j = 0; j < m; j++) {
        if (mask & (1 << j)) continue;
        const e = M[r][j];
        if (e.some(v => v !== 0)) {
          const t = mul(e, f(mask | (1 << j), r + 1));
          acc = add(acc, pos % 2 ? t.map(v => -v) : t);
        }
        pos++;
      }
      memo.set(mask, acc);
      return acc;
    };
    return f(0, 0);
  };
  // Hurwitz matrix: H[i][j] = a(2j − i + 1)
  const H = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => coef(2 * j - i + 1)));
  return Array.from({ length: n }, (_, m) =>
    trimPoly(
      det(H.slice(0, m + 1).map(r => r.slice(0, m + 1)))
        .slice()
        .reverse(),
    ),
  );
}
/** Ranges of k > 0 where every polynomial (descending powers of k) is positive */
export function positiveKRanges(ps: Poly[]): [number, number][] {
  const val = (p: Poly, k: number) => p.reduce((s, c) => s * k + c, 0);
  const cuts = [
    ...new Set(
      ps
        .flatMap(p => (p.length > 1 ? polyRoots(p) : []))
        .filter(z => Math.abs(z[1]) <= 1e-7 * (1 + Math.abs(z[0])) && z[0] > 1e-12)
        .map(z => z[0]),
    ),
  ].sort((x, y) => x - y);
  const edges = [0, ...cuts, Infinity],
    out: [number, number][] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const lo = edges[i],
      hi = edges[i + 1],
      mid = hi === Infinity ? Math.max(2 * lo, lo + 1) : (lo + hi) / 2;
    if (ps.every(p => val(p, mid) > 0)) {
      const last = out[out.length - 1];
      if (last && last[1] === lo) last[1] = hi;
      else out.push([lo, hi]);
    }
  }
  return out;
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
