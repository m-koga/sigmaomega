// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Aids to learning the classical control: moving a pole or zero of the plant (dragged on the pole-zero map), the
// second-order approximation by the dominant poles, the modes of the response (partial fractions) and the sampled
// Nyquist contour with the turns of L(s) about −1
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, plain } from './harness.ts';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const a = fresh();

test('plant from its roots: factors written as text, and read back to the same polynomial', () => {
  assert.equal(
    a.factorString([
      [-1, 0],
      [-1, 0],
      [-0.2, 2],
      [-0.2, -2],
    ]),
    '(s+1)^2(s^2+0.4s+4.04)',
  );
  assert.equal(
    a.factorString([
      [0, 0],
      [0, 0],
      [2, 0],
    ]),
    's^2(s-2)',
  );
  assert.deepEqual(
    plain(
      a.parsePoly(
        a.factorString([
          [-1, 0],
          [-0.5, 1],
          [-0.5, -1],
        ]),
      ),
    ),
    [1, 2, 2.25, 1.25],
  );
  assert.deepEqual(
    plain(
      a.polyOfRoots([
        [-2, 0],
        [1, 3],
        [1, -3],
      ]),
    ),
    [1, 0, 6, 20],
  );
});

test('moving a pole or zero of the plant: real ones stay real, pairs move together, the DC gain is kept', () => {
  a.defaults();
  Object.assign(a.S, { plant: 'second', K: 2, zeta: 0.3, wn: 1 });
  const pr = a.plantRoots(),
    up = pr.poles.find(z => z[1] > 0)!;
  // the pair to −1 ± 2j: the gain at s = 0 stays 2
  const m = a.movePlantRoot('p', up, [-1, 2])!;
  assert.equal(m.denStr, '(s^2+2s+5)');
  assert.equal(m.numStr, '10');
  // put on the real axis: a double real pole
  assert.equal(a.movePlantRoot('p', up, [-1, 0])!.denStr, '(s+1)^2');
  // a real pole of a first-order lag moved to −4: 4/(s + 4) keeps P(0) = K; to the origin, the factor K is kept
  a.defaults();
  Object.assign(a.S, { plant: 'first', K: 1.5, T: 1 });
  assert.deepEqual(
    [a.movePlantRoot('p', [-1, 0], [-4, 0])!.numStr, a.movePlantRoot('p', [-1, 0], [-4, 0])!.denStr],
    ['6', '(s+4)'],
  );
  assert.deepEqual(
    [a.movePlantRoot('p', [-1, 0], [0, 0])!.numStr, a.movePlantRoot('p', [-1, 0], [0, 0])!.denStr],
    ['1.5', 's'],
  );
  // no pole there
  assert.equal(a.movePlantRoot('p', [-3, 0], [-4, 0]), null);
  // the snapping: a step, and to the real axis within the snap distance
  assert.deepEqual(plain(a.snapPoint([-1.234, 0.04], 0.1, 0.05)), [-1.2, 0]);
  assert.deepEqual(plain(a.snapPoint([-1.234, -0.66], 0.1, 0.05)), [-1.2, -0.7]);
});

test('second-order approximation: a pure second-order closed loop matches its formulas', () => {
  // K/(s(Ts + 1)) with P control: T(s) = ωn²/(s² + 2ζωn s + ωn²), no zeros, no other pole
  a.defaults();
  Object.assign(a.S, { plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 2, Tsim: 30 });
  const d = a.dominantApprox(a.computePZ())!;
  assert.equal(d.kind, 'pair');
  assert.ok(near(d.wn, Math.sqrt(2), 1e-9) && near(d.zeta, 1 / (2 * Math.sqrt(2)), 1e-9));
  assert.equal(d.ratio, null);
  assert.equal(d.zeros.length, 0);
  const sim = a.simulatedShape(a.simulate(), a.stepFinal())!;
  assert.ok(near(sim.os!, d.formula.os!, 0.5), `overshoot ${sim.os} / ${d.formula.os}`);
  assert.ok(near(sim.tp!, d.formula.tp!, 0.01 * d.formula.tp!), `peak time ${sim.tp} / ${d.formula.tp}`);
  assert.ok(near(sim.tr!, d.formula.tr!, 0.05 * d.formula.tr!), `rise time ${sim.tr} / ${d.formula.tr}`);
  // its step response is the simulated one
  const s = a.simulate(),
    y = a.approxStep(d, s.T, a.stepFinal()!, a.S.rT0);
  assert.ok(Math.max(...y.map((v, i) => Math.abs(v - s.Y[i]))) < 5e-3); // the simulation is within about 0.3 %
});

test('second-order approximation: a real dominant pole, a far pole, a zero nearly cancelling a pole', () => {
  // 1/((s + 1)(s + 10)) with PI, the zero at −1 cancelling the plant pole: the closed loop pole at −1 is left out
  a.defaults();
  Object.assign(a.S, { plant: 'custom', cNumStr: '10', cDenStr: '(s+1)(s+10)', L: 0, mode: 'PI', Kp: 1, Ki: 1 });
  a.S.cNum = a.parsePoly(a.S.cNumStr);
  a.S.cDen = a.parsePoly(a.S.cDenStr);
  const d = a.dominantApprox(a.computePZ())!;
  assert.ok(
    d.cancelled.some(z => near(z[0], -1, 1e-6)),
    JSON.stringify(d.cancelled),
  );
  assert.equal(d.kind, 'real'); // 10/(s(s + 10)) closed: (s + 1.13)(s + 8.87)
  assert.ok(near(d.formula.ts!, 4 * d.tau, 1e-12) && d.formula.os === 0);
  assert.ok(d.ratio! > 5);
  // an unstable loop has none
  Object.assign(a.S, { plant: 'third', mode: 'P', Kp: 10 });
  assert.equal(a.dominantApprox(a.computePZ()), null);
});

test('partial fractions: known residues, also of repeated poles', () => {
  // 1/(s(s + 1)) = 1/s − 1/(s + 1)
  const r1 = plain(a.residues([1], 1, [0, 0], 1, [[-1, 0]]));
  assert.ok(near(r1[0][0], 1, 1e-12) && near(r1[0][1], 0, 1e-12));
  // 1/(s(s + 1)²) at −1: −1/(s + 1) − 1/(s + 1)²
  const r2 = plain(a.residues([1], 1, [-1, 0], 2, [[0, 0]]));
  assert.ok(near(r2[0][0], -1, 1e-12) && near(r2[1][0], -1, 1e-12), JSON.stringify(r2));
  // (s + 2)/(s² + 2s + 5) at −1 + 2j: (1 + 2j)/(4j) = 0.5 − 0.25j
  const r3 = plain(a.residues([1, 2], 1, [-1, 2], 1, [[-1, -2]]));
  assert.ok(near(r3[0][0], 0.5, 1e-12) && near(r3[0][1], -0.25, 1e-12), JSON.stringify(r3));
});

test('modes of the response: their sum is the simulated response, for each kind of reference', () => {
  const cases: [string, () => void, number][] = [
    ['step, PID', () => a.defaults(), 2e-3],
    ['ramp', () => Object.assign((a.defaults(), a.S), { refType: 'ramp' }), 2e-3],
    ['parabola, integrator', () => Object.assign((a.defaults(), a.S), { plant: 'integ', refType: 'parab' }), 2e-3],
    ['sine', () => Object.assign((a.defaults(), a.S), { refType: 'sine' }), 2e-3],
    ['impulse, second order', () => Object.assign((a.defaults(), a.S), { plant: 'second', refType: 'impulse' }), 5e-3],
    ['triple pole', () => Object.assign((a.defaults(), a.S), { plant: 'third', mode: 'P' }), 2e-3],
  ];
  for (const [name, set, tol] of cases) {
    set();
    const r = a.responseModes()!,
      sim = a.simulate(),
      scale = Math.max(1, ...sim.Y.map(Math.abs));
    let d = 0;
    sim.T.forEach(
      (t, i) => (d = Math.max(d, Math.abs(r.modes.reduce((s, m) => s + a.modeValue(m, t - r.t0), 0) - sim.Y[i]))),
    );
    assert.ok(d < tol * scale, `${name}: difference ${d}`);
    assert.ok(r.modes.some(m => m.kind === 'input') === (a.S.refType !== 'impulse'), name);
  }
  // a reference that is not a step, ramp, parabola, impulse or sine has none
  Object.assign((a.defaults(), a.S), { refType: 'square' });
  assert.equal(a.responseModes(), null);
});

test('Nyquist contour: the turns of L(s) about −1 along it are N, for stable and unstable loops', () => {
  const cases: [string, () => void][] = [
    ['first-order lag, PID', () => a.defaults()],
    ['integrator', () => Object.assign((a.defaults(), a.S), { plant: 'integ' })],
    ['third order, high gain', () => Object.assign((a.defaults(), a.S), { plant: 'third', mode: 'P', Kp: 10 })],
    ['dead time', () => Object.assign((a.defaults(), a.S), { plant: 'dead', L: 1 })],
    ['unstable plant', () => Object.assign((a.defaults(), a.S), { plant: 'unstable', mode: 'P', Kp: 3 })],
  ];
  for (const [name, set] of cases) {
    set();
    const p = a.nyquistPath()!,
      c = a.nyquistCount()!;
    assert.ok(
      near(p.pts[p.pts.length - 1].turns, c.N, 0.02),
      `${name}: ${p.pts[p.pts.length - 1].turns} turns, N = ${c.N}`,
    );
    assert.equal(p.P, c.P, name);
    assert.ok(p.pts.some(q => q.big) && p.pts[0].s[1] < 0, name);
  }
});
