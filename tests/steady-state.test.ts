// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// System type and steady-state error (the panel "Steady-state error"): the type and the error constants of L(s), and
// the steady-state errors to a step, ramp and parabola of the reference and to a step disturbance, against the
// textbook formulas and against long simulations
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh } from './harness.ts';

test('system type and error constants Kp, Kv, Ka of L(s)', () => {
  const cases: [Record<string, unknown>, number, number, number, number][] = [
    // first-order lag K/(Ts+1) with P control: type 0, Kp = K KP
    [{ plant: 'first', K: 1, T: 1, mode: 'P', Kp: 2 }, 0, 2, 0, 0],
    // PI control adds an integrator: type 1, Kv = K KI
    [{ plant: 'first', K: 1, T: 1, mode: 'PI', Kp: 2, Ki: 1.5 }, 1, Infinity, 1.5, 0],
    // integrating plant K/(s(Ts+1)) with P control: type 1, Kv = K KP
    [{ plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 3 }, 1, Infinity, 3, 0],
    // integrating plant with PI control: type 2, Ka = K KI
    [{ plant: 'integ', K: 1, T: 1, mode: 'PI', Kp: 2, Ki: 0.5 }, 2, Infinity, Infinity, 0.5],
    // the dead time does not change the constants
    [{ plant: 'dead', K: 1, T: 1, L: 0.5, mode: 'P', Kp: 1 }, 0, 1, 0, 0],
  ];
  for (const [set, type, Kp, Kv, Ka] of cases) {
    const a = fresh();
    Object.assign(a.S, set);
    const k = a.errorConstants();
    assert.equal(k.type, type, JSON.stringify(set));
    for (const [got, want, name] of [
      [k.Kp, Kp, 'Kp'],
      [k.Kv, Kv, 'Kv'],
      [k.Ka, Ka, 'Ka'],
    ] as [number, number, string][])
      assert.ok(got === want || Math.abs(got - want) <= 1e-12 * Math.abs(want), `${JSON.stringify(set)} ${name}`);
  }
  // a controller with a zero at the origin (derivative only): L(0) = 0, every constant 0
  const a = fresh();
  Object.assign(a.S, { plant: 'first', mode: 'custom', ccNum: [1, 0], ccDen: [0.1, 1] });
  const z = a.errorConstants();
  assert.ok(z.zeroAtOrigin);
  assert.equal(z.Kp, 0);
});

test('steady-state errors equal the textbook formulas without set-point weights, and differ with them', () => {
  for (const set of [
    { plant: 'first', mode: 'P', Kp: 2 },
    { plant: 'integ', mode: 'PI', Kp: 2, Ki: 0.5 },
    { plant: 'dead', L: 0.5, mode: 'PI', Kp: 0.5, Ki: 0.3 },
    { plant: 'third', mode: 'lead' },
  ]) {
    const a = fresh();
    Object.assign(a.S, set);
    const k = a.errorConstants(),
      e = a.steadyErrors()!,
      book = [1 / (1 + k.Kp), k.Kv === 0 ? Infinity : 1 / k.Kv, k.Ka === 0 ? Infinity : 1 / k.Ka];
    book.forEach((b, i) =>
      assert.ok(e.ref[i] === b || Math.abs(e.ref[i] - b) <= 1e-12 * (1 + b), `${JSON.stringify(set)} input ${i}`),
    );
  }
  // 2-DOF PI with the set-point weight b: the error to a ramp is (1 + K KP (1 − b))/(K KI) = 2.4, not 1/Kv = 1
  const a = fresh();
  Object.assign(a.S, { plant: 'first', K: 1, T: 1, mode: 'PI', Kp: 2, Ki: 1, tdof: true, bw: 0.3 });
  const e = a.steadyErrors()!;
  assert.equal(e.ref[0], 0);
  assert.ok(Math.abs(e.ref[1] - 2.4) < 1e-12);
  assert.equal(a.errorConstants().Kv, 1);
});

test('the steady-state errors agree with long simulations (reference and step disturbance)', () => {
  const cases: Record<string, unknown>[] = [
    { plant: 'first', mode: 'P', Kp: 2, refType: 'step' },
    { plant: 'first', mode: 'PI', Kp: 2, Ki: 1, refType: 'ramp' },
    { plant: 'integ', mode: 'P', Kp: 1, refType: 'ramp' },
    { plant: 'integ', mode: 'PI', Kp: 2, Ki: 0.5, refType: 'parab' },
    { plant: 'dead', L: 0.5, mode: 'P', Kp: 1, refType: 'step' },
    { plant: 'dead', L: 0.5, mode: 'PI', Kp: 0.5, Ki: 0.3, refType: 'ramp' },
    { plant: 'first', mode: 'PI', Kp: 2, Ki: 1, tdof: true, bw: 0.3, refType: 'ramp' },
  ];
  for (const set of cases) {
    const a = fresh();
    Object.assign(a.S, { R: 1, Tsim: 200, dOn: true, d: 0.5, td: 100 }, set);
    const e = a.steadyErrors()!,
      sim = a.simulate(),
      w = a.metricWindow(sim),
      n = sim.T.length - 1,
      eRef = sim.R[w.last] - sim.Y[w.last],
      eDist = sim.R[n] - sim.Y[n] - eRef,
      i = ['step', 'ramp', 'parab'].indexOf(set.refType as string);
    assert.ok(Math.abs(eRef - e.ref[i]) < 1e-4, `${JSON.stringify(set)} reference: ${eRef} / ${e.ref[i]}`);
    assert.ok(Math.abs(eDist - 0.5 * e.dist) < 1e-4, `${JSON.stringify(set)} disturbance: ${eDist} / ${0.5 * e.dist}`);
  }
});
