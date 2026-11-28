// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Physical models among the plants: the transfer function follows from the equations of each model (DC gain, natural
// frequency and damping, time constants, the integrator of the motor angle), and the default PID keeps each stable
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, plain } from './harness.ts';

const near = (a: number, b: number, tol = 1e-12) => Math.abs(a - b) <= tol * (1 + Math.abs(b));
const a = fresh();
const tfOf = (plant: string, set: Record<string, number> = {}) => {
  a.defaults();
  Object.assign(a.S, { plant }, set);
  return a.PLANTS[plant].tf(a.S);
};

test('mass–spring–damper: 1/(ms² + cs + k), DC gain 1/k, ωn = √(k/m), ζ = c/(2√(mk))', () => {
  const tf = tfOf('msd', { mass: 2, damp: 0.8, spring: 8 });
  assert.deepEqual(plain(tf.den), [2, 0.8, 8]);
  assert.ok(near(tf.num[0] / tf.den[2], 1 / 8));
  const r = a.polyRoots(tf.den)[0],
    wn = Math.hypot(r[0], r[1]);
  assert.ok(near(wn, 2, 1e-9) && near(-r[0] / wn, 0.8 / (2 * Math.sqrt(16)), 1e-9));
});

test('RLC circuit: 1/(LCs² + RCs + 1), ωn = 1/√(LC), ζ = (R/2)√(C/L)', () => {
  const tf = tfOf('rlc', { resR: 1, indL: 0.5, capC: 0.5 });
  assert.deepEqual(plain(tf.den), [0.25, 0.5, 1]);
  const r = a.polyRoots(tf.den)[0],
    wn = Math.hypot(r[0], r[1]);
  assert.ok(near(wn, 2, 1e-9) && near(-r[0] / wn, 0.5 * Math.sqrt(0.5 / 0.5), 1e-9));
});

test('DC motor: speed Km/((Js + b)(La s + Ra) + Km²), its DC gain Km/(b Ra + Km²); the angle adds an integrator', () => {
  const set = { motJ: 0.1, motB: 0.05, motK: 0.5, motR: 2, motL: 0.1 },
    w = tfOf('motorW', set);
  assert.ok(near(w.den[0], 0.01) && near(w.den[1], 0.1 * 2 + 0.05 * 0.1) && near(w.den[2], 0.05 * 2 + 0.25));
  assert.ok(near(w.num[0] / w.den[2], 0.5 / (0.05 * 2 + 0.25)));
  const th = tfOf('motorA', set);
  assert.deepEqual(plain(th.den), [...plain(w.den), 0]);
  a.S.mode = 'P';
  assert.equal(a.errorConstants().type, 1); // with P control, a type 1 loop: the integrator of the angle
});

test('two water tanks: R2/((A1R1 s + 1)(A2R2 s + 1)), the time constants A1R1 and A2R2', () => {
  const tf = tfOf('tanks', { tankA1: 1, tankA2: 3, tankR1: 2, tankR2: 0.5 });
  assert.equal(tf.num[0], 0.5);
  const ts = a
    .polyRoots(tf.den)
    .map(z => -1 / z[0])
    .sort((x, y) => x - y);
  assert.ok(near(ts[0], 1.5, 1e-9) && near(ts[1], 2, 1e-9), String(ts));
});

test('each physical model has a figure: an SVG with its input u and its output y marked', () => {
  for (const plant of ['msd', 'rlc', 'motorW', 'motorA', 'tanks']) {
    const f = a.PLANTS[plant].figure ?? '';
    assert.ok(f.startsWith('<svg') && f.endsWith('</svg>'), plant);
    assert.ok(/class="pf-t pf-u"[^>]*>u</.test(f) && /class="pf-t pf-y"[^>]*>y/.test(f), plant);
  }
  assert.ok(a.PLANTS.motorA.figure!.includes('y = θ') && a.PLANTS.motorW.figure!.includes('y = ω'));
});

test('each physical model with its default values is stabilized by the default PID, on a time scale of seconds', () => {
  for (const plant of ['msd', 'rlc', 'motorW', 'motorA', 'tanks']) {
    a.defaults();
    a.S.plant = plant;
    assert.ok(
      a.computePZ().cl.every(z => z[0] < 0),
      plant,
    );
    const sim = a.simulate();
    assert.ok(!sim.diverged && Math.abs(sim.Y[sim.Y.length - 1] - 1) < 0.01, `${plant}: ${sim.Y[sim.Y.length - 1]}`);
  }
});
