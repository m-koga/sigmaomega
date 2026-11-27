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
  const d = a.compDesign({ method: 'lead', pm: 50, kc: 10, theta: 5, wc: null });
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
  const d = a.compDesign({ method: 'lag', pm: 50, kc: 10, theta: 5, wc: null });
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
  assert.equal(a.compDesign({ method: 'lead', pm: 50, kc: 2, theta: 5, wc: null }).err, 'not-needed');
  assert.equal(a.compDesign({ method: 'lag', pm: 50, kc: 2, theta: 5, wc: null }).err, 'not-needed');
  assert.equal(a.compDesign({ method: 'lead', pm: 50, kc: 0.5, theta: 5, wc: null }).err, 'no-crossover');
  Object.assign(a.S, { plant: 'integ', K: 1, T: 1 });
  assert.equal(a.compDesign({ method: 'lead', pm: 89, kc: 100, theta: 10, wc: null }).err, 'too-much');
});

test("lead-lag design: Ogata's 20/(s(s + 1)(s + 2)) with a target of 50°", () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'custom', cNumStr: '1', cDenStr: 's(s+1)(s+2)', cNum: [1], cDen: [1, 3, 2, 0], L: 0 });
  // the new crossover at the phase crossover √2, where |20 P| = 20/(√2·√3·√6) = 10/3 (10.46 dB)
  const d = a.compDesign({ method: 'leadlag', pm: 50, kc: 20, theta: 5, wc: null });
  assert.equal(d.err, undefined);
  assert.ok(d.wcAuto && near(d.wc!, Math.SQRT2, 1e-3) && d.phc === -180);
  assert.ok(near(d.gcDb!, 20 * Math.log10(10 / 3), 1e-3));
  assert.ok(near(d.phiM!, 55, 1e-9));
  const s = Math.sin((55 * Math.PI) / 180);
  assert.ok(near(d.alpha!, (1 - s) / (1 + s), 1e-12));
  assert.ok(near(d.T1!, 1 / (d.wc! * Math.sqrt(d.alpha!)), 1e-12));
  assert.ok(near(d.beta!, 10 / 3 / Math.sqrt(d.alpha!), 1e-3));
  assert.ok(near(d.T2!, 10 / d.wc!, 1e-12));
  // the crossover lands at ωc with a phase margin close to the target, also once applied to the controller
  assert.ok(near(d.wgc!, d.wc!, 0.02 * d.wc!) && near(d.pm!, 50, 1));
  Object.assign(a.S, { mode: 'leadlag', Kc: 20, T1: d.T1, alpha: d.alpha, T2: d.T2, beta: d.beta });
  assert.ok(near(a.freqResp().pm!, d.pm!, 0.05));
  // a crossover given by hand (Ogata's 1.5 rad/s) gives about the same compensator (β ≈ 10)
  const g = a.compDesign({ method: 'leadlag', pm: 50, kc: 20, theta: 5, wc: 1.5 });
  assert.ok(!g.wcAuto && near(g.wc!, 1.5, 1e-12) && near(g.beta!, 10.4, 0.2) && near(g.pm!, 50, 1.5));
  // a crossover so low that its phase already leaves the margin: a lag compensator is enough
  assert.equal(a.compDesign({ method: 'leadlag', pm: 50, kc: 20, theta: 5, wc: 0.2 }).err, 'lead-not-needed');
});

test('lead design on the root locus: 4/(s(s + 2)), ζ = 0.5, ωn = 4 (s_d = −2 ± j2√3): φ = 30°, z ≈ −2.93, p ≈ −5.46', () => {
  // the textbook example (Ogata): the bisector method gives the zero −2.928 and the pole −2(1 + √3) = −5.464
  const a = fresh();
  Object.assign(a.S, { plant: 'integ', K: 2, T: 0.5, mode: 'P' }); // 2/(s(0.5s + 1)) = 4/(s(s + 2))
  const d = a.compDesign({ method: 'rlead', pm: 50, kc: 1, theta: 5, wc: null, zeta: 0.5, wn: 4 });
  assert.equal(d.err, undefined);
  assert.ok(near(d.angP!, -210, 1e-9), `∠P(s_d) = ${d.angP}`); // −∠s_d − ∠(s_d + 2) = −120° − 90°
  assert.ok(near(d.phi!, 30, 1e-9) && near(d.gamma!, 120, 1e-9));
  assert.ok(near(d.z!, -2.9282, 1e-4) && near(d.p!, -2 * (1 + Math.sqrt(3)), 1e-9), `z = ${d.z}, p = ${d.p}`);
  assert.ok(near(d.K!, 4.7321, 1e-4), `K = ${d.K}`);
  assert.ok(near(d.alpha!, d.z! / d.p!, 1e-12) && near(d.T1!, -1 / d.z!, 1e-12) && near(d.Kc!, d.K! * d.alpha!, 1e-12));
  // the closed loop has the poles s_d (exactly placed) and one more
  assert.ok(
    d.cl!.some(z => near(z[0], -2, 1e-9) && near(z[1], 2 * Math.sqrt(3), 1e-9)),
    JSON.stringify(d.cl),
  );
  // applied: the lead controller with these values, and the closed loop of the page has the same poles
  a.S.comp = { method: 'rlead', pm: 50, kc: 1, theta: 5, wc: null, zeta: 0.5, wn: 4 };
  Object.assign(a.S, { mode: 'lead', Kc: d.Kc!, T1: d.T1!, alpha: d.alpha! });
  assert.ok(a.computePZ().cl.some(z => near(z[0], -2, 1e-6) && near(Math.abs(z[1]), 2 * Math.sqrt(3), 1e-6)));
});

test('lead design on the root locus: the cases with no design', () => {
  const a = fresh();
  // 1/(s + 1)³ already passes through −0.5 ± j0.866 (ζ = 0.5, ωn = 1): only the gain, K = 1
  Object.assign(a.S, { plant: 'third', K: 1, T: 1, mode: 'P' });
  const on = a.compDesign({ method: 'rlead', pm: 50, kc: 1, theta: 5, wc: null, zeta: 0.5, wn: 1 });
  assert.equal(on.err, 'on-locus');
  assert.ok(near(on.K!, 1, 1e-9));
  // a first-order lag: −90° at s_d, a lead would have to take phase away
  Object.assign(a.S, { plant: 'first' });
  assert.equal(a.compDesign({ method: 'rlead', pm: 50, kc: 1, theta: 5, wc: null, zeta: 0.5, wn: 2 }).err, 'needs-lag');
  // more phase than one stage can add, and a target that is not a complex pair
  Object.assign(a.S, { plant: 'third' });
  assert.equal(a.compDesign({ method: 'rlead', pm: 50, kc: 1, theta: 5, wc: null, zeta: 0.3, wn: 5 }).err, 'too-much');
  assert.equal(a.compDesign({ method: 'rlead', pm: 50, kc: 1, theta: 5, wc: null, zeta: 1, wn: 2 }).err, 'bad-target');
});
