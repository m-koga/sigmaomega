// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Time-domain simulation: step, ramp and sine responses, dead time, saturation, response metrics
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, near, at, last, defined } from './harness.ts';

test('first-order lag + P control: step response matches the analytical solution', () => {
  const a = fresh();
  const S = a.S;
  Object.assign(S, { plant: 'first', K: 1, T: 1, mode: 'P', Kp: 2, Tsim: 5 });
  const sim = a.simulate();
  assert.equal(sim.diverged, false);
  // y(t) = yss (1 - e^{-(1+K Kp) t / T}),  yss = K Kp / (1 + K Kp) = 2/3
  for (const t of [0.1, 0.5, 1, 3]) {
    const exact = (2 / 3) * (1 - Math.exp(-3 * t));
    assert.ok(near(at(sim, t), exact, 5e-3), `t=${t}: ${at(sim, t)} ≠ ${exact}`);
  }
  assert.equal(sim.Y[0], 0);
});

test('defaults (first-order lag + PID): response metrics match earlier versions', () => {
  const a = fresh();
  const sim = a.simulate();
  const m = defined(a.stepMetrics(sim));
  assert.equal(sim.diverged, false);
  assert.ok(near(last(sim.Y), 1, 1e-3), `final value ${last(sim.Y)}`);
  assert.ok(near(defined(m.rise), 2.75, 0.05), `rise time ${m.rise}`);
});

test('dead time: output stays 0 during the delay; steady state is K Kp/(1+K Kp)', () => {
  const a = fresh();
  const S = a.S;
  Object.assign(S, { plant: 'dead', K: 1, T: 1, L: 0.5, mode: 'P', Kp: 1, Tsim: 20 });
  const sim = a.simulate();
  for (let i = 0; i < sim.T.length && sim.T[i] < 0.49; i++) assert.equal(sim.Y[i], 0, `t=${sim.T[i]}`);
  assert.ok(near(last(sim.Y), 0.5, 2e-3), `steady-state value ${last(sim.Y)}`);
});

test('ramp reference: steady-state velocity error equals 1/Kv (type 1)', () => {
  const a = fresh();
  const S = a.S;
  Object.assign(S, { refType: 'ramp', Tsim: 40 }); // first-order lag + PID, Kv = K·Ki = 1
  const sim = a.simulate();
  for (const t of [1, 10, 40]) assert.ok(near(at(sim, t, 'R'), at(sim, t, 'T'), 1e-12), `r(${t}) ≠ ${t}`); // r(t) = v t, v = 1
  const e = last(sim.R) - last(sim.Y);
  assert.ok(near(e, 1, 1e-3), `steady-state velocity error ${e}`);
});

test('sine reference: amplitude ratio and phase difference match the closed-loop theory', () => {
  const a = fresh();
  const S = a.S;
  Object.assign(S, { refType: 'sine', rPer: 5, Tsim: 40 });
  const sm = defined(a.sineMetrics(a.simulate()));
  assert.ok(!sm.short);
  assert.ok(Math.abs(defined(sm.ratio) / sm.ratioT - 1) < 0.01, `amplitude ratio ${sm.ratio} / theory ${sm.ratioT}`);
  assert.ok(near(defined(sm.phase), sm.phT, 1), `phase difference ${sm.phase} / theory ${sm.phT}`);
});

test('saturation: control input stays within its limits', () => {
  const a = fresh();
  const S = a.S;
  Object.assign(S, { sat: true, umax: 0.5, aw: true });
  const sim = a.simulate();
  assert.ok(Math.max(...sim.U.map(Math.abs)) <= 0.5 + 1e-12);
});

test('with saturation, anti-windup reduces overshoot', () => {
  const os = (aw: boolean) => {
    const a = fresh();
    Object.assign(a.S, { mode: 'PI', Kp: 1, Ki: 3, sat: true, umax: 1.2, aw, Tsim: 30 });
    return defined(a.stepMetrics(a.simulate())).os;
  };
  const on = os(true),
    off = os(false);
  assert.ok(off > 10 && on < off / 2, `with anti-windup ${on}%, without ${off}%`);
});

test('a plant with a fast pole does not diverge over a long simulation', () => {
  const a = fresh();
  const S = a.S;
  Object.assign(S, {
    plant: 'custom',
    cNum: a.parsePoly('1'),
    cDen: a.parsePoly('(s+1)(0.0001s+1)'),
    L: 0,
    Tsim: 10000,
  });
  const sim = a.simulate();
  assert.equal(sim.diverged, false);
  assert.ok(near(last(sim.Y), 1, 1e-3), `final value ${last(sim.Y)}`);
});

test('PID and the same controller entered as a transfer function give identical responses', () => {
  const a = fresh();
  const S = a.S;
  const y1 = a.simulate().Y;
  const c = a.ctrlTF();
  Object.assign(S, { mode: 'custom', ccNum: c.num, ccDen: c.den });
  const y2 = a.simulate().Y;
  const d = Math.max(...y1.map((v, i) => Math.abs(v - y2[i])));
  assert.ok(d < 1e-6, `max difference ${d}`);
});

test('PI cancelling the plant pole: first-order closed loop with rise time ln9·τ and settling time ln50·τ', () => {
  // P = 1/(2s+1), C = 4 + 2/s = 4(2s+1)/(2s)  →  closed loop 1/(0.5s+1), τ = 0.5
  const a = fresh();
  Object.assign(a.S, { plant: 'first', K: 1, T: 2, mode: 'PI', Kp: 4, Ki: 2, Tsim: 10 });
  const sim = a.simulate(),
    mt = defined(a.stepMetrics(sim)),
    tau = 0.5,
    h = 10 / 4000;
  assert.ok(near(defined(mt.rise), Math.log(9) * tau, 2 * h), `rise ${mt.rise}`);
  assert.ok(near(defined(mt.ts), Math.log(50) * tau, 2 * h), `settling ${mt.ts}`);
  assert.ok(mt.os < 0.01, `overshoot ${mt.os}`); // the sampled controller leaves a trace of overshoot only
  // the controller output is held over each step h (a delay of about h/2): |error| ≤ max|y'|·h
  for (const t of [0.1, 0.5, 1, 2]) assert.ok(near(at(sim, t), 1 - Math.exp(-t / tau), 2 * h), `y(${t})`);
});

test('second-order closed loop: response matches the analytical solution, overshoot exp(−ζπ/√(1−ζ²))', () => {
  // P = 1/(s(s+1)), K_P = 1  →  closed loop 1/(s²+s+1): ωn = 1, ζ = 0.5
  const a = fresh();
  Object.assign(a.S, { plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 1, Tsim: 20 });
  const sim = a.simulate(),
    z = 0.5,
    wd = Math.sqrt(1 - z * z);
  const y = (t: number) => 1 - Math.exp(-z * t) * (Math.cos(wd * t) + (z / wd) * Math.sin(wd * t));
  const err = (sm: SimResult) => Math.max(...sm.T.map((t, i) => Math.abs(sm.Y[i] - y(t))));
  const h = 20 / 4000; // recorded step (one controller update per step here)
  for (const t of [0.5, 1.5, 3, 6, 12]) assert.ok(near(at(sim, t), y(t), h), `y(${t}) = ${at(sim, t)} vs ${y(t)}`);
  // the error is of first order in the step: halving the simulation time halves it
  a.S.Tsim = 10;
  const e2 = err(a.simulate());
  assert.ok(e2 < 0.6 * err(sim), `error ${err(sim)} → ${e2}`);
  const os = 100 * Math.exp((-z * Math.PI) / wd); // 16.30 %
  const mo = defined(a.stepMetrics(sim)).os;
  assert.ok(near(mo, os, 0.2), `overshoot ${mo} vs ${os}`); // within 0.2 points (sampled controller)
});

test('every reference type follows its definition (and the simulation records it)', () => {
  const a = fresh();
  Object.assign(a.S, { R: 2, rT0: 1, rW: 2, rPer: 4, Tsim: 10 });
  const want: Record<string, (t: number) => number> = {
    step: () => 2,
    ramp: t => 2 * t,
    parab: t => t * t,
    trap: t => 2 * Math.min(t / 2, 1),
    pulse: t => (t < 2 ? 2 : 0),
    square: t => (t % 4 < 2 ? 2 : 0),
    sine: t => 2 * Math.sin((2 * Math.PI * t) / 4),
    impulse: () => 0, // the impulse itself is applied by the simulation, not part of the recorded reference
  };
  assert.deepEqual(Object.keys(want).sort(), Object.keys(a.REF_TYPES).sort());
  for (const [ty, f] of Object.entries(want)) {
    a.S.refType = ty;
    assert.equal(a.refValue(0.5), 0, `${ty} before t0`);
    // includes times just before the end of the pulse and of the first half period (t − t0 = 1.95)
    for (const t of [1.3, 2.7, 2.95, 4.2, 6.9]) assert.ok(near(a.refValue(t), f(t - 1), 1e-12), `${ty} at ${t}`);
    const sim = a.simulate(),
      i = sim.T.findIndex(t => t >= 4.2);
    assert.ok(near(sim.R[i], a.refValue(sim.T[i]), 1e-12), `${ty}: recorded reference`);
  }
});

test('impulse reference: the response is the derivative of the step response, with the area A·T(0)', () => {
  for (const set of [
    { plant: 'first', mode: 'P', Kp: 2 },
    { plant: 'second', zeta: 0.3, wn: 2, mode: 'PI', Kp: 1, Ki: 1 },
    { plant: 'third', mode: 'PID', Kp: 2, Ki: 0.5, Kd: 1 },
    { plant: 'third', mode: 'lead' },
    { plant: 'first', mode: 'PID', Kp: 2, Ki: 1, Kd: 0.3, tdof: true, bw: 0.5 },
  ] as Record<string, unknown>[]) {
    const a = fresh(),
      b = fresh();
    Object.assign(a.S, set, { refType: 'impulse', R: 1, rT0: 1, Tsim: 30 });
    Object.assign(b.S, set, { refType: 'step', R: 1, rT0: 1, Tsim: 30 });
    const si = a.simulate(),
      ss = b.simulate();
    let err = 0,
      mx = 0;
    // away from the jump at t0, by the central difference of the step response
    for (let i = 1; i < ss.T.length - 1; i++) {
      if (ss.T[i] < 1.2) continue;
      const d = (ss.Y[i + 1] - ss.Y[i - 1]) / (ss.T[i + 1] - ss.T[i - 1]);
      err = Math.max(err, Math.abs(si.Y[i] - d));
      mx = Math.max(mx, Math.abs(d));
    }
    assert.ok(err < 0.02 * mx, `${JSON.stringify(set)}: ${err} / ${mx}`);
    // the recorded reference is zero, the area of y is the DC gain of Gyr
    assert.ok(si.R.every((v: number) => v === 0));
    const g = a.loopTFs().R,
      dc = g.num[g.num.length - 1] / g.den0[g.den0.length - 1],
      im = a.impulseMetrics(si)!;
    assert.ok(Math.abs(im.area - dc) < 0.01, `${JSON.stringify(set)}: area ${im.area} / ${dc}`);
  }
});

test('the plant alone (open loop): the analytical step and impulse responses, dead time, divergence', () => {
  const a = fresh();
  // K/(Ts + 1) e^(−Ls) with K = 2, T = 1.5, L = 0.5, step of 1 at t0 = 1: y = K(1 − e^(−(t − t0 − L)/T))
  Object.assign(a.S, { plant: 'dead', K: 2, T: 1.5, L: 0.5, refType: 'step', R: 1, rT0: 1, Tsim: 20 });
  let r = a.simulatePlant(),
    err = 0;
  r.T.forEach((t: number, i: number) => {
    const tau = t - 1.5;
    err = Math.max(err, Math.abs(r.Y[i] - (tau > 0 ? 2 * (1 - Math.exp(-tau / 1.5)) : 0)));
  });
  assert.ok(!r.diverged && err < 1e-3, `step: ${err}`);
  // impulse of area 1: y = (K/T) e^(−(t − t0 − L)/T) after the dead time (checked away from the jump)
  Object.assign(a.S, { refType: 'impulse' });
  r = a.simulatePlant();
  err = 0;
  r.T.forEach((t: number, i: number) => {
    const tau = t - 1.5;
    if (tau > 0.1) err = Math.max(err, Math.abs(r.Y[i] - (2 / 1.5) * Math.exp(-tau / 1.5)));
  });
  assert.ok(err < 2e-3, `impulse: ${err}`);
  // an unstable plant 1/(s − 1) diverges, and the run stops
  Object.assign(a.S, { plant: 'unstable', refType: 'step', Tsim: 50 });
  r = a.simulatePlant();
  assert.ok(r.diverged && r.T.length < 4001);
  // the controller does not matter (only through the number of substeps, a discretization difference)
  Object.assign(a.S, { plant: 'second', zeta: 0.3, wn: 1, K: 1, Tsim: 20 });
  const y1 = a.simulatePlant().Y;
  Object.assign(a.S, { mode: 'P', Kp: 7 });
  const y2 = a.simulatePlant().Y;
  assert.ok(y2.every((v: number, i: number) => Math.abs(v - y1[i]) < 1e-4));
});

test('measurement noise: none gives identical runs, noise changes the output only around its mean', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'first', mode: 'PI', Kp: 2, Ki: 1, Tsim: 20 });
  const y1 = a.simulate().Y,
    y2 = a.simulate().Y;
  assert.ok(y1.every((v, i) => v === y2[i]));
  a.S.noise = 0.05;
  const yn = a.simulate().Y;
  const diff = yn.map((v, i) => v - y1[i]).slice(2000);
  const mean = diff.reduce((s, v) => s + v, 0) / diff.length;
  assert.ok(diff.some(v => v !== 0) && Math.abs(mean) < 0.01, `mean deviation ${mean}`);
});

test('an unstable closed loop is reported as diverged and gives no metrics', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'unstable', K: 1, T: 1, mode: 'P', Kp: 0.5, Tsim: 200 });
  const sim = a.simulate();
  assert.equal(sim.diverged, true);
  assert.equal(a.stepMetrics(sim), null);
});
