// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Lead and lag compensator design from the frequency response: the classical steps on the textbook example
// K/(s(s + 1)) with Kv = 10, the phase margin reached, the applied compensator, and the cases with no design
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh } from './harness.ts';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

test('lead design: 10/(s(s + 1)), target 50°: α ≈ 0.248, ωm ≈ 4.42 rad/s, phase margin ≈ 50°', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'integ', K: 1, T: 1 });
  const d = a.compDesign({ method: 'lead', pm: 50, kc: 10, theta: 5 });
  assert.equal(d.err, undefined);
  // uncompensated: ωgc = 3.08 rad/s, PM = 18.0° (|10/(jω(jω + 1))| = 1)
  assert.ok(near(d.wgc0!, 3.084, 1e-3) && near(d.pm0!, 17.96, 0.01));
  assert.ok(near(d.phiM!, 50 - d.pm0! + 5, 1e-9));
  const s = Math.sin((d.phiM! * Math.PI) / 180);
  assert.ok(near(d.alpha!, (1 - s) / (1 + s), 1e-12));
  assert.ok(near(d.wm!, 4.425, 2e-3));
  assert.ok(near(d.T1!, 1 / (d.wm! * Math.sqrt(d.alpha!)), 1e-12));
  // the lead puts its largest phase at the new crossover: the phase margin is PM + φm − θ shift, close to 50°
  assert.ok(near(d.wgc!, d.wm!, 1e-2 * d.wm!) && near(d.pm!, 50, 1));
  // the same phase margin with the compensator applied to the controller (the frequency response of the app)
  Object.assign(a.S, { mode: 'lead', Kc: 10, T1: d.T1, alpha: d.alpha });
  assert.ok(near(a.freqResp().pm!, d.pm!, 0.05));
});

test('lag design: 10/(s(s + 1)), target 50°: β ≈ 11.7, T2 = 10/ω, phase margin ≈ 50°', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'integ', K: 1, T: 1 });
  const d = a.compDesign({ method: 'lag', pm: 50, kc: 10, theta: 5 });
  assert.equal(d.err, undefined);
  assert.ok(near(d.phiT!, -125, 1e-9));
  // the phase of 10/(jω(jω + 1)) is −90° − atan ω = −125° at ω = tan 35°
  assert.ok(near(d.wg!, Math.tan((35 * Math.PI) / 180), 1e-3));
  assert.ok(near(d.beta!, 10 / (d.wg! * Math.hypot(1, d.wg!)), 1e-3));
  assert.ok(near(d.T2!, 10 / d.wg!, 1e-9));
  assert.ok(near(d.pm!, 50, 1));
  Object.assign(a.S, { mode: 'lag', Kc: 10, T2: d.T2, beta: d.beta });
  assert.ok(near(a.freqResp().pm!, d.pm!, 0.05));
});

test('no design when the target is met, when too much phase is needed, or without a crossover', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'first', K: 1, T: 1 });
  assert.equal(a.compDesign({ method: 'lead', pm: 50, kc: 2, theta: 5 }).err, 'not-needed');
  assert.equal(a.compDesign({ method: 'lag', pm: 50, kc: 2, theta: 5 }).err, 'not-needed');
  assert.equal(a.compDesign({ method: 'lead', pm: 50, kc: 0.5, theta: 5 }).err, 'no-crossover');
  Object.assign(a.S, { plant: 'integ', K: 1, T: 1 });
  assert.equal(a.compDesign({ method: 'lead', pm: 89, kc: 100, theta: 10 }).err, 'too-much');
});
