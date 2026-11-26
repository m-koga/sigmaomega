// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Nyquist stability criterion (the tab "Nyquist criterion" and the crossing marks of the Nyquist plot): P, N and
// Z = N + P against the closed-loop poles, and N as the sum of the crossings of the real axis to the left of −1
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh } from './harness.ts';

const CASES: Record<string, unknown>[] = [
  {},
  { plant: 'third', mode: 'P', Kp: 1 },
  { plant: 'third', mode: 'P', Kp: 9 },
  { plant: 'unstable', mode: 'P', Kp: 0.5 },
  { plant: 'unstable', mode: 'P', Kp: 2 },
  { plant: 'unstable', mode: 'PID', Kp: 3, Ki: 1, Kd: 0.5 },
  { plant: 'integ', mode: 'PI', Kp: 1, Ki: 2 },
  { plant: 'integ', mode: 'PI', Kp: 0.2, Ki: 2 },
  { plant: 'second', zeta: 0.1, wn: 1, mode: 'PI', Kp: 1, Ki: 1 },
  { plant: 'dead', L: 2, mode: 'PI', Kp: 2, Ki: 1 },
  { plant: 'dead', L: 0.5, mode: 'P', Kp: 8 },
  { plant: 'third', mode: 'lead' },
];

test('Z = N + P equals the closed-loop poles in the right half-plane; N is the sum of the crossings', () => {
  for (const set of CASES) {
    const a = fresh();
    Object.assign(a.S, set);
    const c = a.nyquistCount()!,
      tag = JSON.stringify(set),
      cl = a.computePZ().cl.filter((z: [number, number]) => z[0] > 1e-7).length;
    assert.equal(c.through, false, tag);
    assert.equal(c.Z, cl, tag); // with a dead time, the closed-loop poles here are from the Padé approximation
    assert.equal(
      c.crossings.reduce((s: number, k: { dir: number }) => s + k.dir, 0),
      c.N,
      tag,
    );
  }
});

test('Nyquist criterion: textbook examples', () => {
  const a = fresh();
  // 1/(s+1)³ with K_P = 12: P = 0, −1 encircled twice clockwise (crossing at −1.5 for ω = ±√3), Z = 2
  Object.assign(a.S, { plant: 'third', K: 1, T: 1, mode: 'P', Kp: 12 });
  let c = a.nyquistCount()!;
  assert.deepEqual([c.P, c.N, c.Z], [0, 2, 2]);
  assert.equal(c.crossings.length, 2);
  c.crossings.forEach((k: { x: number; w: number; dir: number }) => {
    assert.ok(Math.abs(k.x + 1.5) < 1e-6 && Math.abs(Math.abs(k.w) - Math.sqrt(3)) < 1e-6);
    assert.equal(k.dir, 1);
  });
  // K_P = 8: L(jω) passes through −1 (closed-loop poles ±j√3)
  Object.assign(a.S, { Kp: 8 });
  assert.equal(a.nyquistCount()!.through, true);
  // unstable plant 1/(s − 1) with K_P = 2: P = 1, one counterclockwise encirclement, N = −1, Z = 0 (stable)
  Object.assign(a.S, { plant: 'unstable', mode: 'P', Kp: 2 });
  c = a.nyquistCount()!;
  assert.deepEqual([c.P, c.N, c.Z], [1, -1, 0]);
  // integrator: the pole at the origin is on the imaginary axis, passed by a half circle (not counted in P)
  Object.assign(a.S, { plant: 'integ', mode: 'P', Kp: 1 });
  c = a.nyquistCount()!;
  assert.equal(c.P, 0);
  assert.deepEqual(
    Array.from(c.axis, (p: { w: number; mult: number }) => [p.w, p.mult]),
    [[0, 1]],
  );
  assert.equal(c.Z, 0);
});
