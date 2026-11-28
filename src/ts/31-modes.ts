// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Modes of the response to the reference: partial fractions of Y(s) = G_yr(s) R(s) and the term of each pole ================= */
import { cadd, cdiv, cmul, groupRoots, pMul, pade3, polyRoots, trimPoly } from './03-math.ts';
import { S } from './11-state.ts';
import { loopTFs } from './17-loop.ts';

/** The term of a pole p (and of its conjugate when p is complex) in y(t):
 *  Σₖ c[k−1] t^{k−1}/(k−1)! e^{pt} (twice its real part for a complex pole); kind 'input' for the poles of R(s) (the
 *  forced response: a constant, a ramp, a sine), 'loop' for the closed-loop poles (the transient) */
export interface Mode {
  p: Complex;
  mult: number;
  c: Complex[];
  kind: 'input' | 'loop';
}
/** The partial fractions of the response to the reference: the modes, whether the dead time was replaced by its
 *  Padé approximation, and the reference they are for; null for a reference that is not a step, ramp, parabola,
 *  impulse or sine, or when the response has no poles */
export interface ModeResult {
  modes: Mode[];
  approx: boolean;
  t0: number;
}
// The Laplace transform of the reference from t0 on: [numerator, denominator], or null for the other references
function refTransform(st: State): [Poly, Poly] | null {
  const R = st.R;
  switch (st.refType) {
    case 'step':
      return [[R], [1, 0]];
    case 'ramp':
      return [[R], [1, 0, 0]];
    case 'parab':
      return [[R], [1, 0, 0, 0]];
    case 'impulse':
      return [[R], [1]];
    case 'sine': {
      const w = (2 * Math.PI) / st.rPer;
      return [[R * w], [1, 0, w * w]];
    }
    default:
      return null;
  }
}
/** G_yr(s) as a rational function (a dead time replaced by its third-order Padé approximation) */
export function gyrRational(st: State = S): { num: Poly; den: Poly; approx: boolean } {
  const g = loopTFs(st).R,
    { Nd, Dd } = pade3(g.L);
  const num = g.delay ? pMul(g.num, Nd) : g.num,
    den = g.den1.length ? addDesc(pMul(g.den0, Dd), pMul(g.den1, Nd)) : g.L > 0 && g.delay ? pMul(g.den0, Dd) : g.den0;
  return { num: trimPoly(num), den: trimPoly(den), approx: g.L > 0 };
}
// Sum of two polynomials in descending powers
function addDesc(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length),
    r = new Array(n).fill(0);
  a.forEach((v, i) => (r[n - a.length + i] += v));
  b.forEach((v, i) => (r[n - b.length + i] += v));
  return r;
}
// The first m Taylor coefficients of the polynomial f (complex, descending powers) at p: f(p + h) = Σ a_j h^j
function taylorAt(f: Complex[], p: Complex, m: number): Complex[] {
  let b = f.slice();
  const out: Complex[] = [];
  for (let j = 0; j < m; j++) {
    const q: Complex[] = [];
    let acc: Complex = [0, 0];
    for (const c of b) {
      acc = cadd(cmul(acc, p), c);
      q.push(acc);
    }
    out.push(q.pop() ?? [0, 0]);
    b = q;
  }
  return out;
}
// The polynomial a·Π(s − r) with complex coefficients (descending powers)
function polyFromRoots(a: number, rs: Complex[]): Complex[] {
  let p: Complex[] = [[a, 0]];
  for (const r of rs) {
    const q: Complex[] = p.map(() => [0, 0] as Complex).concat([[0, 0]]);
    p.forEach((c, i) => {
      q[i] = cadd(q[i], c);
      q[i + 1] = cadd(q[i + 1], cmul(c, [-r[0], -r[1]]));
    });
    p = q;
  }
  return p;
}
/** The coefficients of the partial fractions of N(s)/D(s) at its pole p of multiplicity m: c[k−1] of 1/(s − p)^k, from
 *  the series of N(s)/Q(s), Q(s) = D(s)/(s − p)^m, at p (others: the other poles with their multiplicities) */
export function residues(num: Poly, lead: number, p: Complex, m: number, others: Complex[]): Complex[] {
  const n = taylorAt(
      num.map(v => [v, 0] as Complex),
      p,
      m,
    ),
    q = taylorAt(polyFromRoots(lead, others), p, m),
    c: Complex[] = [];
  for (let j = 0; j < m; j++) {
    let v = n[j];
    for (let i = 1; i <= j; i++) v = cadd(v, cmul([-q[i][0], -q[i][1]], c[j - i]));
    c.push(cdiv(v, q[0]));
  }
  return c.reverse(); // c[k−1]: the coefficient of 1/(s − p)^k
}
/** The modes of the response to the reference, for the current settings (the disturbance and the noise left out) */
export function responseModes(st: State = S): ModeResult | null {
  const rt = refTransform(st);
  if (!rt) return null;
  const g = gyrRational(st),
    num = trimPoly(pMul(g.num, rt[0])),
    den = trimPoly(pMul(g.den, rt[1]));
  if (den.length < 2 || num.length >= den.length) return null;
  const inputPoles = groupRoots(rt[1].length > 1 ? polyRoots(rt[1]) : []),
    groups = groupRoots(polyRoots(den)),
    roots = (gs: { z: Complex; mult: number }[]) => gs.flatMap(({ z, mult }) => Array<Complex>(mult).fill(z));
  const modes = groups
    .map(({ z, mult }, i) => ({
      p: z,
      mult,
      c: residues(num, den[0], z, mult, roots(groups.filter((_, j) => j !== i))),
      kind: inputPoles.some(q => Math.hypot(q.z[0] - z[0], q.z[1] - z[1]) <= 1e-6 * (1 + Math.hypot(...z)))
        ? ('input' as const)
        : ('loop' as const),
    }))
    .filter(m => m.p[1] >= 0);
  return { modes, approx: g.approx, t0: st.rT0 };
}
/** The value of a mode at the time u after the start of the reference */
export function modeValue(m: Mode, u: number): number {
  if (u < 0) return 0;
  const e: Complex = [Math.exp(m.p[0] * u) * Math.cos(m.p[1] * u), Math.exp(m.p[0] * u) * Math.sin(m.p[1] * u)];
  let sum: Complex = [0, 0],
    pw = 1;
  m.c.forEach((c, k) => {
    sum = cadd(sum, [c[0] * pw, c[1] * pw]);
    pw = (pw * u) / (k + 1);
  });
  const v = cmul(sum, e)[0];
  return m.p[1] > 0 ? 2 * v : v;
}
/** The modes in the order shown: the forced response first, then the closed-loop poles from the slowest */
export function sortedModes(r: ModeResult): Mode[] {
  return r.modes.slice().sort((a, b) => (a.kind === b.kind ? b.p[0] - a.p[0] : a.kind === 'input' ? -1 : 1));
}
