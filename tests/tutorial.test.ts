// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The numbers of the chapter "Trying the exercises" of the user manual (src/ts/84-help.ts): each step of the four
// built-in exercises gives what the manual says (rounded as there). When one of these fails after a change of the
// computation, correct the manual in every language (src/help/<lang>.html) together with this test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, plain } from './harness.ts';

// Loads exercise i (as the Load button does) and computes what the page shows for the settings given
function run(i: number, change: Record<string, unknown> = {}) {
  const a = fresh();
  a.applyScenario({ app: 'ctrlsim', format: 1, name: '', note: '', S: structuredClone(a.SC_EXAMPLES[i].S) } as never);
  Object.assign(a.S, change);
  const sim = a.simulate(a.S),
    fr = a.freqResp(a.S),
    pz = a.computePZ(a.S),
    mt = a.stepMetrics(sim, a.S),
    ev = a.evalSpecs(sim, fr, pz, a.S),
    ok = Object.values(ev).every(e => !e.on || e.ok);
  return { a, sim, fr, pz, mt, ok, dist: a.distMetrics(sim, a.S) };
}
// value rounded to the given number of decimals equals want
const about = (v: number | null | undefined, want: number, dec = 0) =>
  assert.equal(v === null || v === undefined ? v : +v.toFixed(dec), want, `${v} is not about ${want}`);
// the gains of a tuning rule for the plant of exercise i
const tuned = (i: number, rule: string, type: string) => {
  const a = fresh();
  a.applyScenario({ app: 'ctrlsim', format: 1, name: '', note: '', S: structuredClone(a.SC_EXAMPLES[i].S) } as never);
  return a.tuneGains(a.tuneRule(rule, type, null, a.S) as never);
};

test('exercise 1: PID control of a third-order plant', () => {
  let r = run(0);
  about(r.mt!.os, 0);
  about(r.fr.pm, 88);
  about(r.mt!.ts, 15);
  assert.equal(r.ok, false);
  r = run(0, { Ki: 0.4 });
  about(r.mt!.ts, 8.4, 1);
  about(r.fr.pm, 76);
  assert.equal(r.ok, true);
  const rows: [string, number, number, number, boolean][] = [
    ['zn-step', 55, 13, 21, false],
    ['chr-sp0', 11, 7.3, 52, true],
    ['imc', 15, 11, 48, false],
  ];
  for (const [rule, os, ts, pm, ok] of rows) {
    r = run(0, tuned(0, rule, 'PID'));
    about(r.mt!.os, os, os < 10 ? 1 : 0);
    about(r.mt!.ts, ts, ts < 10 ? 1 : 0);
    about(r.fr.pm, pm);
    assert.equal(r.ok, ok, rule);
  }
});

test('exercise 2: PI control of a plant with dead time (sweep of K_I)', () => {
  let r = run(1);
  about(r.fr.pm, 83);
  about(r.fr.ms, 1.22, 2);
  about(r.mt!.ts, 19);
  const rows: [number, number, number, number, boolean, boolean][] = [
    [0.2, 22, 91, 1.29, true, true],
    [0.4, 8.8, 64, 1.41, true, true],
    [0.5, 9.6, 55, 1.53, false, true],
    [0.6, 13, 47, 1.7, false, false],
  ];
  for (const [Ki, ts, pm, ms, pmOK, msOK] of rows) {
    r = run(1, { Kp: 0.7, Ki });
    about(r.mt!.ts, ts, ts < 10 ? 1 : 0);
    about(r.fr.pm, pm);
    about(r.fr.ms, ms, 2);
    assert.deepEqual([r.fr.pm! >= 60, r.fr.ms! <= 1.6], [pmOK, msOK], `K_I = ${Ki}`);
  }
  r = run(1, tuned(1, 'zn-step', 'PI'));
  about(r.fr.ms, 2.3, 1);
  about(r.fr.gm, 5.7, 1);
  r = run(1, tuned(1, 'chr-sp0', 'PI'));
  assert.equal(r.ok, true);
  about(r.mt!.ts, 12);
  r = run(1, tuned(1, 'imc', 'PI'));
  about(r.fr.ms, 2, 1);
});

test('exercise 3: set-point weighting leaves the disturbance response and the margins as they are', () => {
  const r0 = run(2);
  about(r0.mt!.os, 19);
  about(r0.dist!.dev, 0.21, 2);
  about(r0.dist!.rec, 3.2, 1);
  about(r0.fr.gm, 4.9, 1);
  const r1 = run(2, { bw: 0.7, cw: 0 });
  about(r1.mt!.os, 0.3, 1);
  about(r1.mt!.ts, 2.4, 1);
  const r2 = run(2, { bw: 0.5, cw: 0 });
  about(r2.mt!.os, 0);
  about(r2.mt!.ts, 3.6, 1);
  for (const r of [r1, r2]) {
    const same = (x: typeof r) => [x.dist!.dev, x.dist!.rec, x.fr.pm, x.fr.gm].map(v => +v!.toFixed(6));
    assert.deepEqual(same(r), same(r0));
  }
});

test('exercise 4: stabilizing an unstable plant', () => {
  let r = run(3);
  assert.equal(
    r.pz.cl.every(z => z[0] < 0),
    false,
  );
  const range = r.a.stableRanges(r.a.S);
  about(range[0][0], 2);
  assert.equal(range[0][1], Infinity);
  for (const [Kp, y] of [
    [2, 2],
    [5, 1.25],
  ]) {
    r = run(3, { Kp });
    about(r.sim.Y[r.sim.Y.length - 1], y, 2);
  }
  r = run(3, { mode: 'PI', Kp: 3, Ki: 2 });
  assert.deepEqual(plain(r.pz.cl.map(z => z.map(v => +v.toFixed(6) + 0)).sort((p, q) => p[1] - q[1])), [
    [-1, -1],
    [-1, 1],
  ]);
  about(r.mt!.sse, 0, 3);
  about(r.mt!.ts, 3.3, 1);
  assert.equal(r.ok, true);
  r = run(3, { mode: 'PI', Kp: 3, Ki: 1 });
  r.pz.cl.forEach(z => assert.ok(Math.abs(z[0] + 1) < 1e-3 && Math.abs(z[1]) < 1e-3));
  about(r.mt!.os, 45);
});
