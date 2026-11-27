// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Estimation exercise: the hidden plant of each exercise number (the same every time, within its ranges), its step
// response, and the check of the estimates
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh } from './harness.ts';

test('every exercise number gives the same plant every time, within the ranges, and different numbers differ', () => {
  const a = fresh(),
    seen = new Set<string>();
  for (let n = 1; n <= 300; n++) {
    const p = a.exercisePlant(n),
      q = a.exercisePlant(n);
    assert.deepEqual([p.K, p.T, p.L], [q.K, q.T, q.L]);
    assert.ok(p.K >= 0.5 && p.K <= 3 && p.T >= 0.5 && p.T <= 5 && p.L >= 0.1 && p.L <= Math.min(2, p.T) + 1e-9, `${n}`);
    seen.add(`${p.K} ${p.T} ${p.L}`);
  }
  assert.ok(seen.size > 290);
});

test('the step response and the check of the estimates', () => {
  const a = fresh(),
    p = { K: 2, T: 1.5, L: 0.4 };
  assert.equal(a.fopdtStep(p, 0.4), 0);
  // 63.2 % of K one time constant after the dead time
  assert.ok(Math.abs(a.fopdtStep(p, 0.4 + 1.5) - 2 * (1 - Math.exp(-1))) < 1e-12);
  const c = a.exerciseCheck(p, { K: 2.1, T: 1.8, L: 0.4 });
  assert.ok(Math.abs(c.err.K - 0.05) < 1e-12 && Math.abs(c.err.T - 0.2) < 1e-12 && c.err.L === 0);
  assert.deepEqual([c.ok.K, c.ok.T, c.ok.L], [true, false, true]);
});
