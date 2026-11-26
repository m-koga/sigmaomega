// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Routh–Hurwitz stability test (the panel "Routh–Hurwitz test"): the Routh table and its special cases, the sign
// changes against the closed-loop poles, the first column in the gain factor k against the Hurwitz determinants, and
// the stable range of k against the root locus
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh } from './harness.ts';

test('Routh table: sign changes; a zero first element (ε) and a row of zeros (auxiliary polynomial)', () => {
  const a = fresh();
  // s³ + 3s² + 3s + 3: rows 1 3 / 3 3 / 2 / 3, stable
  const r = a.routhArray([1, 3, 3, 3]);
  assert.deepEqual([...r.rows.map((x: number[]) => x[0])], [1, 3, 2, 3]);
  assert.equal(r.changes, 0);
  // s³ + 3s + 2: the first element of the s² row is zero → ε; two roots in the right half-plane
  const e = a.routhArray([1, 0, 3, 2]);
  assert.deepEqual([...e.eps], [1]);
  assert.equal(e.changes, 2);
  // s³ + 2s² + s + 2 = (s + 2)(s² + 1): the s¹ row is zero → derivative of 2s² + 2, i.e. 4s; no sign change
  const z = a.routhArray([1, 2, 1, 2]);
  assert.deepEqual([...z.aux], [2]);
  assert.equal(z.rows[2][0], 4);
  assert.equal(z.changes, 0);
  // s⁵ + 2s⁴ + 2s³ + 4s² + s + 2 = (s + 2)(s² + 1)²: two rows of zeros
  assert.deepEqual([...a.routhArray([1, 2, 2, 4, 1, 2]).aux], [2, 4]);
});

const CASES: Record<string, unknown>[] = [
  {},
  { plant: 'third', mode: 'P', Kp: 1 },
  { plant: 'third', mode: 'P', Kp: 9 },
  { plant: 'third', mode: 'PID', Kp: 2, Ki: 0.5, Kd: 1 },
  { plant: 'unstable', mode: 'P', Kp: 0.5 },
  { plant: 'unstable', mode: 'PID', Kp: 3, Ki: 1, Kd: 0.5 },
  { plant: 'integ', mode: 'PI', Kp: 1, Ki: 2 },
  { plant: 'second', zeta: 0.1, wn: 1, mode: 'PI', Kp: 1, Ki: 1 },
  { plant: 'dead', L: 2, mode: 'PI', Kp: 2, Ki: 1 },
  { plant: 'third', mode: 'lead' },
];

test('the sign changes equal the closed-loop poles in the right half-plane; the stable k range equals the root locus', () => {
  for (const set of CASES) {
    const a = fresh();
    Object.assign(a.S, set);
    const { D, N } = a.charPolyK(),
      r = a.routhArray(D.map((d: number, i: number) => d + N[i])),
      rhp = a.computePZ().cl.filter((z: [number, number]) => z[0] > 1e-7).length;
    assert.equal(r.changes, rhp, JSON.stringify(set));
    const kr = a.positiveKRanges([[D[0]], ...a.hurwitzK(D, N)]),
      rl = a.stableRanges(a.S);
    assert.equal(kr.length, rl.length, JSON.stringify(set));
    kr.forEach(([lo, hi]: [number, number], i: number) => {
      const [l2, h2] = rl[i];
      assert.ok(Math.abs(lo - l2) <= 1e-6 * (1 + l2), `${JSON.stringify(set)} low ${lo} / ${l2}`);
      assert.ok(hi === h2 || Math.abs(hi - h2) <= 1e-6 * (1 + h2), `${JSON.stringify(set)} high ${hi} / ${h2}`);
    });
  }
});

test('the first column of the Routh table is a0, Δ1, Δ2/Δ1, …, Δn/Δn−1 for any k', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'third', mode: 'PID', Kp: 2, Ki: 0.5, Kd: 1 });
  const { D, N } = a.charPolyK(),
    H = a.hurwitzK(D, N),
    val = (p: number[], k: number) => p.reduce((s, c) => s * k + c, 0);
  for (const k of [0.3, 1, 5, 20]) {
    const fc = a.routhArray(D.map((d: number, i: number) => d + k * N[i])).rows.map((x: number[]) => x[0]),
      want = [D[0], val(H[0], k), ...H.slice(1).map((h: number[], i: number) => val(h, k) / val(H[i], k))];
    fc.forEach((v: number, i: number) =>
      assert.ok(Math.abs(v - want[i]) <= 1e-9 * (1 + Math.abs(want[i])), `k = ${k}, row ${i}`),
    );
  }
  // third-order lag with P control: s³ + 3s² + 3s + (1 + k): stable for 0 < k < 8 (K_P < 8 with K_P = 1)
  Object.assign(a.S, { plant: 'third', K: 1, T: 1, mode: 'P', Kp: 1 });
  const c = a.charPolyK();
  assert.deepEqual(
    [...a.positiveKRanges([[c.D[0]], ...a.hurwitzK(c.D, c.N)])].map((r: number[]) => [...r].map(v => +v.toFixed(9))),
    [[0, 8]],
  );
});
