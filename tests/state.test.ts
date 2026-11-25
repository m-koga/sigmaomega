// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Calculations take the settings as a parameter (st, default: the current settings S):
// with a modified copy they give the same results as with the global settings changed, and S is not touched
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, plain } from './harness.ts';

const cases: [string, Partial<State>, Partial<State>][] = [
  ['third-order plant, P control (gain changed)', { plant: 'third', K: 1, T: 1, mode: 'P', Kp: 2 }, { Kp: 4 }],
  [
    'dead time, PID (plant changed)',
    { plant: 'dead', K: 1, T: 1, L: 0.5, mode: 'PID', Kp: 1, Ki: 0.5, Kd: 0.2 },
    { T: 2, L: 1 },
  ],
  ['second order, lead compensator', { plant: 'second', mode: 'lead', Kc: 2 }, { Kc: 5, alpha: 0.1 }],
  [
    '2-DOF PID with disturbance and saturation',
    { plant: 'first', mode: 'PID', dOn: true, d: 0.5, td: 5 },
    { tdof: true, bw: 0.4, cw: 0, sat: true, umax: 1 },
  ],
  ['sine reference', { plant: 'second', mode: 'PI' }, { refType: 'sine', rPer: 3 }],
];

for (const [name, base, change] of cases) {
  test(`explicit settings give the same results as global ones: ${name}`, () => {
    const a = fresh();
    Object.assign(a.S, base);
    const before = JSON.stringify(a.S);
    const run: State = { ...a.S, ...change };
    const sim = a.simulate(run);
    const got = plain({
      sim,
      fr: a.freqResp(run),
      pz: a.computePZ(run),
      step: a.stepMetrics(sim, run),
      sine: a.sineMetrics(sim, run),
      dist: a.distMetrics(sim, run),
      tune: a.tuneRule('zn-ult', 'PID', null, run),
      ranges: a.stableRanges(run),
    });
    assert.equal(JSON.stringify(a.S), before, 'the global settings were changed');
    Object.assign(a.S, change);
    const sim2 = a.simulate();
    const want = plain({
      sim: sim2,
      fr: a.freqResp(),
      pz: a.computePZ(),
      step: a.stepMetrics(sim2),
      sine: a.sineMetrics(sim2),
      dist: a.distMetrics(sim2),
      tune: a.tuneRule('zn-ult', 'PID'),
      ranges: a.stableRanges(),
    });
    for (const k of Object.keys(want) as (keyof typeof want)[]) assert.deepEqual(got[k], want[k], k);
  });
}

test('the parameter sweep does not change the settings while it runs', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'third', K: 1, T: 1, mode: 'P', Kp: 2 });
  a.S.sweep = { on: true, p: 'Kp', vals: [1, 4] };
  const before = JSON.stringify(a.S);
  const runs = a.sweepRuns();
  assert.equal(JSON.stringify(a.S), before);
  assert.equal(runs?.length, 2);
});
