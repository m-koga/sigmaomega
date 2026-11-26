// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Time efficiency (PERFORMANCE.md): the heaviest computations stay far below the time they took before they were
// made faster, so that a change that makes them slow again is noticed. The limits are about 10 times what they take
// on a slow test machine; the measured times, in a browser, are in PERFORMANCE.md (npm run performance).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh } from './harness.ts';

const a = fresh();
// the time of f in ms (the best of a few runs, after a warm-up)
function ms(f: () => unknown, runs = 3): number {
  f();
  let best = Infinity;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    f();
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}
const eighthOrder = () => {
  a.defaults();
  a.S.plant = 'custom';
  a.S.cNumStr = '1';
  a.S.cDenStr = '(s+1)^8';
  a.S.cNum = a.parsePoly(a.S.cNumStr);
  a.S.cDen = a.parsePoly(a.S.cDenStr);
};

test('root locus and stable gain ranges: fast also with large and repeated poles', () => {
  for (const set of [
    () => a.defaults(), // the root locus reaches poles of about 6e4: they used to take the full 2000 iterations
    () => Object.assign((a.defaults(), a.S), { Kd: 1, N: 100 }),
    eighthOrder, // an eightfold pole: about 6.6 s before
  ]) {
    set();
    const t = ms(() => {
      const pts = a.rootLocus(a.LOCUS_KS);
      a.stableRanges(a.S, pts);
    });
    assert.ok(t < 1000, `root locus and stable ranges took ${t.toFixed(0)} ms`);
  }
});

test('the root of a large pole is found in few iterations, and accurately', () => {
  // (s + 6e4)(s + 6)(s + 0.5): the step of the old stopping rule could not get below 1e-13 at 6e4
  const p = a.pMul(a.pMul([1, 6e4], [1, 6]), [1, 0.5]);
  const t = ms(() => a.polyRoots(p), 20);
  const r = a
    .polyRoots(p)
    .map(z => z[0])
    .sort((x, y) => x - y);
  assert.ok(Math.abs(r[0] + 6e4) < 1e-6 && Math.abs(r[1] + 6) < 1e-9 && Math.abs(r[2] + 0.5) < 1e-9, String(r));
  assert.ok(t < 2, `one root finding took ${t.toFixed(2)} ms`);
});

test('the most time steps and a sweep of 8 values take bounded time', () => {
  a.defaults();
  Object.assign(a.S, { Kd: 1, N: 100, Tsim: 200 });
  const sim = a.simulate();
  assert.equal(sim.substeps, 100); // 4000 recorded points × 100 substeps: the most there can be
  const tSim = ms(() => a.simulate());
  assert.ok(tSim < 2000, `simulation took ${tSim.toFixed(0)} ms`);
  a.S.sweep = { on: true, p: 'Kp', vals: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4] };
  const tSweep = ms(() => a.sweepRuns(), 1);
  assert.ok(tSweep < 10000, `sweep of 8 values took ${tSweep.toFixed(0)} ms`);
});
