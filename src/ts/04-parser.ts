// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Polynomial parser ================= */
import { T } from './02-i18n.ts';
import { cdiv, cmul, polyval } from './08-frequency.ts';

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
// Full-width and look-alike characters typed with a Japanese keyboard, ** for powers and a capital S, made plain
function normalizeExpr(str: string): string {
  return str
    .trim()
    .replace(/\*\*/g, '^')
    .replace(/[−–ー]/g, '-')
    .replace(/[×・]/g, '*')
    .replace(/S/g, 's')
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/＋/g, '+');
}
// A coefficient vector in descending powers, such as [1 3 2] or [1, 3, 2]
function parseCoefVector(str: string): Poly {
  const v = str
    .slice(1, -1)
    .split(/[\s,;]+/)
    .filter(x => x)
    .map(Number);
  if (!v.length || v.some(x => !isFinite(x))) throw new Error(T('Cannot read the coefficient vector as numbers'));
  return trimPoly(v);
}
// Tokens: numbers (also 1e-3 and .5), the variable s, operators and parentheses; spaces are skipped
function tokenizeExpr(str: string): string[] {
  const toks: string[] = [];
  const re = /(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?|s|[-+*/^()])/y;
  let pos = 0;
  while (pos < str.length) {
    if (/\s/.test(str[pos])) {
      pos++;
      continue;
    }
    re.lastIndex = pos;
    const m = re.exec(str);
    if (!m)
      throw new Error(
        T('Cannot interpret "{c}" (character {p}). Only the variable s is allowed', { c: str[pos], p: pos + 1 }),
      );
    toks.push(m[1]);
    pos = re.lastIndex;
  }
  return toks;
}
// Recursive descent over the tokens; polynomials are kept in ascending powers while parsing
//   expr = term (('+' | '-') term)*
//   term = unary (('*' | '/') unary | power)*  (a product may leave out '*': 2s, (s+1)(s+2))
//   unary = ('-' | '+') unary | power
//   power = primary ('^' primary)?  (integer exponent 0..20)
//   primary = 's' | number | '(' expr ')'
function parseTokens(toks: string[]): Poly {
  let i = 0;
  const peek = () => toks[i],
    next = () => toks[i++];
  const isStart = (t: string | undefined) => t !== undefined && (t === 's' || t === '(' || /^[\d.]/.test(t));
  function expr(): Poly {
    let a = term();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const b = term();
      a = pAdd(a, op === '+' ? b : pScale(b, -1));
    }
    return a;
  }
  function term(): Poly {
    let a = unary();
    for (;;) {
      const t = peek();
      if (t === '*') {
        next();
        a = pMul(a, unary());
      } else if (t === '/') {
        next();
        const b = unary();
        if (trimPoly(b.slice().reverse()).length !== 1)
          throw new Error(
            T('Division by a polynomial is not allowed (enter the numerator and denominator separately)'),
          );
        if (b[0] === 0) throw new Error(T('Division by zero'));
        a = pScale(a, 1 / b[0]);
      } else if (isStart(t)) {
        a = pMul(a, power());
      } else break;
    }
    return a;
  }
  function unary(): Poly {
    if (peek() === '-') {
      next();
      return pScale(unary(), -1);
    }
    if (peek() === '+') {
      next();
      return unary();
    }
    return power();
  }
  function power(): Poly {
    let b = primary();
    if (peek() === '^') {
      next();
      const e = primary();
      if (e.length !== 1 || !Number.isInteger(e[0]) || e[0] < 0 || e[0] > 20)
        throw new Error(T('Exponents must be integers from 0 to 20'));
      let r = [1];
      for (let k = 0; k < e[0]; k++) r = pMul(r, b);
      b = r;
    }
    return b;
  }
  function primary(): Poly {
    const t = next();
    if (t === undefined) throw new Error(T('The expression ends unexpectedly'));
    if (t === 's') return [0, 1];
    if (t === '(') {
      const a = expr();
      if (next() !== ')') throw new Error(T('Unclosed parenthesis'));
      return a;
    }
    if (/^[\d.]/.test(t)) return [parseFloat(t)];
    throw new Error(T('"{t}" is in an invalid position', { t }));
  }
  const r = expr();
  if (i < toks.length) throw new Error(T('"{t}" is in an invalid position', { t: toks[i] }));
  return trimPoly(r.slice().reverse());
}
// A polynomial in s typed by the user, or a coefficient vector; returns coefficients in descending powers
export function parsePoly(input: string): Poly {
  const str = normalizeExpr(input);
  if (!str) throw new Error(T('The expression is empty'));
  if (/^\[.*\]$/.test(str)) return parseCoefVector(str);
  return parseTokens(tokenizeExpr(str));
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
