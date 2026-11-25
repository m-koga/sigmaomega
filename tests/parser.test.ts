// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Tests for transfer function input (polynomial parsing) and root finding
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, near } from './harness.ts';

const { api } = load();

test('polynomials are converted to coefficients in descending powers', () => {
  const cases: [string, number[]][] = [
    ['1', [1]],
    ['2*s + 1', [2, 1]],
    ['(s+1)^2', [1, 2, 1]],
    ['2(s+1)', [2, 2]],
    ['s(s+1)(s+3)', [1, 4, 3, 0]],
    ['(s+1)(0.5s+1)', [0.5, 1.5, 1]],
    ['-s + 1', [-1, 1]],
    ['s**2', [1, 0, 0]],
    ['3(s+2)/2', [1.5, 3]],
    ['[1 4 6 4 1]', [1, 4, 6, 4, 1]],
    ['（s＋１）^2', [1, 2, 1]], // full-width characters
  ];
  for (const [src, want] of cases) {
    const got = api.parsePoly(src);
    assert.equal(got.length, want.length, src);
    got.forEach((v, i) => assert.ok(near(v, want[i], 1e-12), `${src}: ${got} ≠ ${want}`));
  }
});

test('invalid expressions raise errors', () => {
  for (const src of ['', 's+', 'x+1', '(s+1', 's^1.5', 's^-1', '1/(s+1)', '1/0', '[1 a 2]']) {
    assert.throws(
      () => api.parsePoly(src),
      (e: unknown) => typeof (e as Error)?.message === 'string' && (e as Error).message.length > 0,
      `"${src}" did not raise an error`,
    );
  }
});

test('root finding: (s+1)(s+2)(s+3) and s²+0.2s+4', () => {
  const r1 = api
    .polyRoots(api.parsePoly('(s+1)(s+2)(s+3)'))
    .map(z => z[0])
    .sort((a, b) => b - a);
  [-1, -2, -3].forEach((v, i) => assert.ok(near(r1[i], v, 1e-9), `${r1}`));
  const r2 = api.polyRoots(api.parsePoly('s^2+0.2s+4'));
  r2.forEach(z => {
    assert.ok(near(z[0], -0.1, 1e-9));
    assert.ok(near(Math.abs(z[1]), Math.sqrt(3.99), 1e-9));
  });
});

test('repeated roots are found with practical accuracy', () => {
  const r = api.polyRoots(api.parsePoly('(s+1)^3'));
  r.forEach(z => assert.ok(Math.hypot(z[0] + 1, z[1]) < 1e-4, JSON.stringify(r)));
});
