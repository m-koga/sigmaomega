// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Complex numbers and polynomials ================= */
import { T } from './02-i18n.ts';

export const cadd = (a: Complex, b: Complex): Complex => [a[0] + b[0], a[1] + b[1]];
export const cmul = (a: Complex, b: Complex): Complex => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const cdiv = (a: Complex, b: Complex): Complex => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
export const polyval = (p: Poly, s: Complex): Complex =>
  p.reduce<Complex>((acc, c) => cadd(cmul(acc, s), [c, 0]), [0, 0]);
export const pAdd = (a: Poly, b: Poly): Poly => {
  const r = new Array(Math.max(a.length, b.length)).fill(0);
  a.forEach((v, i) => (r[i] += v));
  b.forEach((v, i) => (r[i] += v));
  return r;
};
export const pMul = (a: Poly, b: Poly): Poly => {
  const r = new Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => b.forEach((y, j) => (r[i + j] += x * y)));
  return r;
};
export const pScale = (a: Poly, k: number): Poly => a.map(v => v * k);
// Coefficient k-th from the end (k = 1: the constant term)
export const lastOf = (a: number[], k = 1): number => a[a.length - k];
export function trimPoly(desc: Poly): Poly {
  let i = 0;
  while (i < desc.length - 1 && Math.abs(desc[i]) < 1e-14) i++;
  return desc.slice(i);
}
// Roots by the Durand–Kerner method (coefficients in descending powers). The iteration stops when every step is
// below 1e-13 relative to the size of its root, or when the polynomial at every root is as small as its rounding
// error allows (sum of |a_j||r|^j times a few ulps): then no step can make the roots more accurate. (An absolute
// limit on the step could not be reached by large roots, and repeated roots move by more than their rounding error,
// so both used to run the full 2000 iterations.)
export function polyRoots(desc: Poly, init?: Complex[]): Complex[] {
  desc = trimPoly(desc);
  const n = desc.length - 1;
  if (n < 1) return [];
  const a = desc.map(v => v / desc[0]);
  let r: Complex[] = [];
  if (init && init.length === n) {
    r = init.map((z, i): Complex => [z[0] + 1e-7 * (i + 1), z[1] + 1.3e-7 * (i + 1)]);
  } // warm start (slightly separated)
  else {
    let z: Complex = [1, 0];
    for (let k = 0; k < n; k++) {
      r.push(z);
      z = cmul(z, [0.4, 0.9]);
    }
  }
  for (let it = 0; it < 2000; it++) {
    let delta = 0,
      atNoise = true;
    r = r.map((ri, i): Complex => {
      let den: Complex = [1, 0];
      r.forEach((rj, j) => {
        if (i !== j) den = cmul(den, [ri[0] - rj[0], ri[1] - rj[1]]);
      });
      const p = polyval(a, ri),
        size = Math.sqrt(ri[0] * ri[0] + ri[1] * ri[1]);
      if (atNoise) {
        let bound = 0;
        for (const c of a) bound = bound * size + Math.abs(c);
        bound *= 16 * Number.EPSILON;
        if (p[0] * p[0] + p[1] * p[1] > bound * bound) atNoise = false;
      }
      const d = cdiv(p, den),
        step = Math.sqrt(d[0] * d[0] + d[1] * d[1]) / (1 + size);
      if (step > delta) delta = step;
      return [ri[0] - d[0], ri[1] - d[1]];
    });
    if (delta < 1e-13 || atNoise) break;
  }
  return r.map(([x, y]): Complex => [Math.abs(x) < 1e-9 ? 0 : x, Math.abs(y) < 1e-4 * (1 + Math.abs(x)) ? 0 : y]);
}
export function numStr(a: number, tex?: boolean): string {
  let s = (+a.toPrecision(4)).toString();
  if (tex && s.includes('e')) {
    const [m, e] = s.split('e');
    s = `${m}\\times 10^{${parseInt(e)}}`;
  }
  return s;
}
// Polynomial in descending powers as TeX, in the variable v (s by default)
export function polyTeX(desc: Poly, v = 's'): string {
  const n = desc.length - 1;
  let out = '';
  desc.forEach((c, i) => {
    const p = n - i;
    if (Math.abs(c) < 1e-14) return;
    const neg = c < 0,
      a = Math.abs(c);
    const cs = Math.abs(a - 1) < 1e-12 && p > 0 ? '' : numStr(a, true);
    const sv = p === 0 ? '' : p === 1 ? v : `${v}^{${p}}`;
    out += out === '' ? (neg ? '-' : '') : neg ? ' - ' : ' + ';
    out += cs + sv;
  });
  return out || '0';
}
export const nT = (v: number) => numStr(v, true); // number in a formula
export const cT = (v: number) => (Math.abs(v - 1) < 1e-12 ? '' : Math.abs(v + 1) < 1e-12 ? '-' : nT(v)); // coefficient of s (1 is omitted)
export const ratTeX = (num: Poly, den: Poly) => `\\dfrac{${polyTeX(num)}}{${polyTeX(den)}}`; // N(s)/D(s)
export function rootList(rs: Complex[]): string {
  // Round to the displayed digits and group repeated roots
  const cnt = new Map<string, number>();
  rs.slice()
    .sort((p, q) => q[0] - p[0] || q[1] - p[1])
    .forEach(([x, y]) => {
      if (y < 0) return;
      const key = y === 0 ? numStr(x) : `${numStr(x)} ± ${numStr(y)}j`;
      cnt.set(key, (cnt.get(key) || 0) + 1);
    });
  const out = [...cnt].map(([k, c]) => (c > 1 ? T('{k} (×{c})', { k, c }) : k));
  return out.length ? out.join(',  ') : T('none');
}
export const pAddDesc = (a: Poly, b: Poly): Poly => pAdd(a.slice().reverse(), b.slice().reverse()).reverse();
// Pair each root in r with the nearest root of prev (keeps the branches continuous)
export function matchRoots(prev: Complex[], r: Complex[]): Complex[] {
  const used = new Array(r.length).fill(false);
  return prev.map(p => {
    let bi = -1,
      bd = Infinity;
    r.forEach((q, i) => {
      if (used[i]) return;
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    used[bi] = true;
    return r[bi];
  });
}
// Number of factors s of a polynomial (trailing zero coefficients, relative to its largest coefficient)
export const originOrder = (p: Poly): number => {
  const tol = 1e-12 * Math.max(0, ...p.map(Math.abs));
  let n = 0;
  while (n < p.length - 1 && Math.abs(p[p.length - 1 - n]) <= tol) n++;
  return n;
};
// Roots grouped into distinct points with their multiplicity (repeated roots are found only to about 10^(−16/r))
export function groupRoots(rs: Complex[]): { z: Complex; mult: number }[] {
  const out: { z: Complex; mult: number; sum: Complex }[] = [];
  for (const z of rs) {
    const g = out.find(o => Math.hypot(o.z[0] - z[0], o.z[1] - z[1]) <= 1e-3 * (1 + Math.hypot(z[0], z[1])));
    if (g) {
      g.sum = cadd(g.sum, z);
      g.mult++;
      g.z = [g.sum[0] / g.mult, g.sum[1] / g.mult];
    } else out.push({ z, mult: 1, sum: z });
  }
  return out.map(({ z, mult }) => ({ z: [z[0], Math.abs(z[1]) < 1e-9 ? 0 : z[1]], mult }));
}
