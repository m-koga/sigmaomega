// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= The plant written from its poles and zeros: moving one of them (dragged on the pole-zero map) ================= */
import { pMul, polyRoots, polyval } from './03-math.ts';
import { S } from './11-state.ts';
import { PLANTS } from './10-definitions.ts';

// A number as typed in a transfer function: at most 4 significant digits, no exponent for ordinary sizes
const num4 = (v: number): string => String(+v.toPrecision(4));
// The real factors of a set of roots (each conjugate pair once): s − a, or s² − 2 Re(z) s + |z|²
function factors(rs: Complex[]): Poly[] {
  return rs.filter(z => z[1] >= 0).map(z => (z[1] === 0 ? [1, -z[0]] : [1, -2 * z[0], z[0] * z[0] + z[1] * z[1]]));
}
/** The polynomial with these roots (leading coefficient 1; complex roots in conjugate pairs) */
export const polyOfRoots = (rs: Complex[]): Poly => factors(rs).reduce<Poly>((p, f) => pMul(p, f), [1]);
// A factor as text: s, s + 2, s^2 + 0.4s + 4 (in parentheses when it is a sum)
function factorText(f: Poly): string {
  const term = (c: number, pw: string) => (c === 0 ? '' : `${c < 0 ? '-' : '+'}${num4(Math.abs(c))}${pw}`);
  if (f.length === 2) return f[1] === 0 ? 's' : `(s${term(f[1], '')})`;
  return `(s^2${term(f[1], 's')}${term(f[2], '')})`;
}
/** The roots as a product of factors, such as (s+1)^2(s^2+0.4s+4); repeated factors are written with a power */
export function factorString(rs: Complex[]): string {
  const out: { t: string; n: number }[] = [];
  factors(rs).forEach(f => {
    const t = factorText(f),
      o = out.find(x => x.t === t);
    if (o) o.n++;
    else out.push({ t, n: 1 });
  });
  return out.map(({ t, n }) => (n > 1 ? `${t}^${n}` : t)).join('');
}
/** The plant's poles, zeros and gain: P(s) = K·Π(s − z)/Π(s − p)·e^{−Ls} */
export function plantRoots(st: State = S): { poles: Complex[]; zeros: Complex[]; K: number; L: number } {
  const tf = PLANTS[st.plant].tf(st);
  return { poles: polyRoots(tf.den), zeros: polyRoots(tf.num), K: tf.num[0] / tf.den[0], L: tf.L };
}
// The value at s = 0 of Π(s − z)/Π(s − p), or null when it is 0 or infinite (a pole or zero at the origin)
function gainAt0(zeros: Complex[], poles: Complex[]): number | null {
  const n = polyval(polyOfRoots(zeros), [0, 0])[0],
    d = polyval(polyOfRoots(poles), [0, 0])[0];
  return Math.abs(n) < 1e-12 || Math.abs(d) < 1e-12 ? null : n / d;
}
/** Snap a point to the step and to the real axis (within snap): the new place of a moved pole or zero */
export function snapPoint(z: Complex, step: number, snap: number): Complex {
  const r = (v: number) => +(Math.round(v / step) * step).toPrecision(6);
  return [r(z[0]), Math.abs(z[1]) < snap ? 0 : r(Math.abs(z[1])) * Math.sign(z[1])];
}
/** Move the pole (kind 'p') or zero ('z') of the plant at `from` to `to`. A real root moves along the real axis; a
 *  complex pair moves together (its conjugate mirrored), and becomes a double real root on the axis. The gain at
 *  s = 0 is kept when it is finite and not zero before and after; otherwise the factor K. Returns the new roots and
 *  the transfer function as the text of its numerator and denominator, or null when there is no such root. */
export function movePlantRoot(
  kind: 'p' | 'z',
  from: Complex,
  to: Complex,
  st: State = S,
): { poles: Complex[]; zeros: Complex[]; numStr: string; denStr: string } | null {
  const pr = plantRoots(st),
    list = kind === 'p' ? pr.poles : pr.zeros;
  let i = -1,
    best = Infinity;
  list.forEach((z, j) => {
    const d = Math.hypot(z[0] - from[0], z[1] - from[1]);
    if (d < best) [best, i] = [d, j];
  });
  // the coefficients are written with 4 digits, so the roots found again may differ a little from where they were put
  if (i < 0 || best > 1e-3 * (1 + Math.hypot(from[0], from[1]))) return null;
  const old = list[i],
    small = (z: Complex) => Math.abs(z[1]) <= 1e-4 * (1 + Math.hypot(z[0], z[1])), // a repeated real root found as nearly real
    complex = !small(old),
    rest = list.filter((_, j) => j !== i);
  let moved: Complex[];
  if (!complex) moved = [[to[0], 0]];
  else {
    const j = rest.findIndex(z => Math.hypot(z[0] - old[0], z[1] + old[1]) < 1e-3 * (1 + Math.hypot(old[0], old[1])));
    if (j >= 0) rest.splice(j, 1);
    moved =
      to[1] === 0
        ? [
            [to[0], 0],
            [to[0], 0],
          ]
        : [
            [to[0], Math.abs(to[1])],
            [to[0], -Math.abs(to[1])],
          ];
  }
  const tidy = (rs: Complex[]): Complex[] => rs.map(z => [z[0], small(z) ? 0 : z[1]]);
  const poles = tidy(kind === 'p' ? [...rest, ...moved] : pr.poles),
    zeros = tidy(kind === 'z' ? [...rest, ...moved] : pr.zeros);
  const g0 = gainAt0(pr.zeros, pr.poles),
    g1 = gainAt0(zeros, poles),
    K = g0 !== null && g1 !== null ? (pr.K * g0) / g1 : pr.K;
  const zs = factorString(zeros);
  return {
    poles,
    zeros,
    numStr: zs ? `${num4(K)}${zs.startsWith('(') ? '' : '*'}${zs}` : num4(K),
    denStr: factorString(poles) || '1',
  };
}
