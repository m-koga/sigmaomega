// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Polynomial parser ================= */
import { T } from './02-i18n.ts';
import { pAdd, pMul, pScale, trimPoly } from './03-math.ts';

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
