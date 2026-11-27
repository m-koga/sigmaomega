// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= System type and steady-state error ================= */
import { originOrder, pMul, trimPoly } from './03-math.ts';
import { PLANTS } from './10-definitions.ts';
import { S } from './11-state.ts';
import { ctrlTF, loopTFs } from './17-loop.ts';
import type { LoopTF } from './17-loop.ts';
/** System type and error constants of the open loop L(s) = N(s)e^{−Ls}/D(s): near s = 0, L(s) ≈ K/s^type (the dead
 *  time does not change them, e^{−Ls} → 1); Kp = lim L, Kv = lim sL, Ka = lim s²L (Infinity above the type).
 *  zeroAtOrigin: L(s) has more zeros than poles at the origin (then type 0 and every constant 0) */
export interface ErrorConstants {
  type: number;
  K: number;
  Kp: number;
  Kv: number;
  Ka: number;
  zeroAtOrigin: boolean;
}
export function errorConstants(st: State = S): ErrorConstants {
  const tf = PLANTS[st.plant].tf(st),
    c = ctrlTF(st),
    N = trimPoly(pMul(tf.num, c.num)),
    D = trimPoly(pMul(tf.den, c.den));
  if (N.every(v => v === 0)) return { type: 0, K: 0, Kp: 0, Kv: 0, Ka: 0, zeroAtOrigin: false };
  const zn = originOrder(N),
    zd = originOrder(D),
    l = zd - zn;
  if (l < 0) return { type: 0, K: 0, Kp: 0, Kv: 0, Ka: 0, zeroAtOrigin: true };
  const K = N[N.length - 1 - zn] / D[D.length - 1 - zd],
    at = (i: number) => (l < i ? 0 : l === i ? K : Infinity);
  return { type: l, K, Kp: at(0), Kv: at(1), Ka: at(2), zeroAtOrigin: false };
}
// Taylor series at s = 0 (ascending powers up to s^m) of a polynomial (descending), of a product and of a quotient
const serPoly = (p: Poly, m: number): number[] => Array.from({ length: m + 1 }, (_, i) => p[p.length - 1 - i] ?? 0);
const serMul = (a: number[], b: number[]): number[] =>
  a.map((_, i) => a.slice(0, i + 1).reduce((s, x, j) => s + x * b[i - j], 0));
const serDiv = (a: number[], b: number[]): number[] => {
  const c: number[] = [];
  a.forEach((x, i) => c.push((x - c.reduce((s, y, j) => s + y * b[i - j], 0)) / b[0]));
  return c;
};
// Numerator and denominator series of a loop transfer function (the dead time as the series of e^{−Ls})
function serLoop(g: LoopTF, m: number): { num: number[]; den: number[] } {
  const e = Array.from({ length: m + 1 }, (_, i) => (-g.L) ** i / [1, 1, 2, 6, 24, 120][i]),
    num = serPoly(g.num, m),
    den0 = serPoly(g.den0, m);
  return {
    num: g.delay ? serMul(num, e) : num,
    den: g.den1.length ? den0.map((v, i) => v + serMul(serPoly(g.den1, m), e)[i]) : den0,
  };
}
// a − b with the differences that are rounding errors made exactly zero
const serSub = (a: number[], b: number[]) =>
  a.map((x, i) => (Math.abs(x - b[i]) <= 1e-9 * (Math.abs(x) + Math.abs(b[i])) ? 0 : x - b[i]));
/** Steady-state errors e = r − y of the closed loop, from the series at s = 0 of E(s)/R(s) = 1 − G_yr(s) (this holds
 *  with set-point weights too) and of G_yd(s): ref[i] for a unit step, ramp (slope 1) and parabola (acceleration 1),
 *  Infinity when the error grows without bound; dist for a unit step disturbance at the plant input (−G_yd(0)).
 *  null: the closed loop has a pole at the origin. The values hold only when the closed loop is stable. */
export function steadyErrors(st: State = S): { ref: [number, number, number]; dist: number } | null {
  const g = loopTFs(st),
    r = serLoop(g.R, 2),
    d = serLoop(g.D, 2);
  if (Math.abs(r.den[0]) <= 1e-12 * Math.max(...r.den.map(Math.abs))) return null;
  const c = serDiv(serSub(r.den, r.num), r.den);
  return {
    ref: [c[0], c[0] !== 0 ? Infinity : c[1], c[0] !== 0 || c[1] !== 0 ? Infinity : c[2]],
    dist: -serDiv(d.num, d.den)[0] + 0,
  };
}
