// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Routh–Hurwitz stability test ================= */
import { polyRoots, trimPoly } from './03-math.ts';
import { S } from './11-state.ts';
import { loopRational } from './17-loop.ts';
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
