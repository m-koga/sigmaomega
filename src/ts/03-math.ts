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
// Roots by the Durand–Kerner method (coefficients in descending powers)
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
    let delta = 0;
    r = r.map((ri, i): Complex => {
      let den: Complex = [1, 0];
      r.forEach((rj, j) => {
        if (i !== j) den = cmul(den, [ri[0] - rj[0], ri[1] - rj[1]]);
      });
      const d = cdiv(polyval(a, ri), den);
      delta = Math.max(delta, Math.hypot(d[0], d[1]));
      return [ri[0] - d[0], ri[1] - d[1]];
    });
    if (delta < 1e-13) break;
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
export function polyTeX(desc: Poly): string {
  const n = desc.length - 1;
  let out = '';
  desc.forEach((c, i) => {
    const p = n - i;
    if (Math.abs(c) < 1e-14) return;
    const neg = c < 0,
      a = Math.abs(c);
    const cs = Math.abs(a - 1) < 1e-12 && p > 0 ? '' : numStr(a, true);
    const sv = p === 0 ? '' : p === 1 ? 's' : `s^{${p}}`;
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
