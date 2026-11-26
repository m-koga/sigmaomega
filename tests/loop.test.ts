// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Transfer functions of the loop (the panel "Loop transfer functions"): the rational forms equal the frequency
// responses, and the formulas show the chosen ones
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh } from './harness.ts';

type C = [number, number];
const close = (v: C, r: C) => Math.hypot(v[0] - r[0], v[1] - r[1]) <= 1e-12 * Math.max(1, Math.hypot(r[0], r[1]));

test('L, S, T, Gyr and Gyd as rational functions equal their frequency responses (dead time, 2-DOF, transfer functions)', () => {
  const cases: Record<string, unknown>[] = [
    {},
    { plant: 'dead', L: 0.5, mode: 'PID', tdof: true, bw: 0.6, cw: 0.2 },
    { plant: 'second', mode: 'PID', dOnMeas: true },
    { plant: 'third', mode: 'lead' },
    { plant: 'integ', mode: 'PD' },
    { plant: 'dead', L: 1, mode: 'PI' },
    { plant: 'custom', mode: 'custom' },
  ];
  for (const set of cases) {
    const a = fresh();
    Object.assign(a.S, set);
    const g = a.loopTFs(),
      tf = a.PLANTS[a.S.plant].tf(a.S);
    for (const w of [0.01, 0.3, 1, 2.7, 10, 50]) {
      const dl: C = [Math.cos(-w * tf.L), Math.sin(-w * tf.L)],
        L = a.cmul(a.evalCP(w, tf, a.S), dl),
        den = a.cadd([1, 0], L);
      const ref: Record<string, C> = {
        L,
        S: a.cdiv([1, 0], den),
        T: a.cdiv(L, den),
        D: a.cdiv(a.cmul(a.evalPr(w, tf), dl), den),
        R: a.evalT(w, a.S),
      };
      for (const k of ['L', 'S', 'T', 'R', 'D'] as const)
        assert.ok(close(a.evalLoopTF(g[k], w), ref[k]), `${JSON.stringify(set)} ${k} at ω = ${w}`);
    }
  }
});

test('formulas: definition and rational function; dead time kept as e^{-Ls}; only the chosen ones', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'first', K: 1, T: 1, mode: 'PID', Kp: 2, Ki: 1, Kd: 1, N: 20, tdof: false });
  const g = a.loopTFs();
  // L = (Kp + Ki/s + Kd s·20/(s+20))/(s+1) = (22s² + 41s + 20)/(s³ + 21s² + 20s)
  assert.equal(a.loopTFTeX(g.L), '\\dfrac{22s^{2} + 41s + 20}{s^{3} + 21s^{2} + 20s}');
  // S = D/(D + N), monic
  assert.equal(a.loopTFTeX(g.S), '\\dfrac{s^{3} + 21s^{2} + 20s}{s^{3} + 43s^{2} + 61s + 20}');
  Object.assign(a.S, { plant: 'dead', L: 0.5 });
  const d = a.loopTFs();
  assert.match(a.loopTFTeX(d.L), /^\\dfrac\{\\left\(22s\^\{2\} \+ 41s \+ 20\\right\)e\^\{-0\.5s\}\}/);
  assert.match(a.loopTFTeX(d.S), /\+\\left\(22s\^\{2\} \+ 41s \+ 20\\right\)e\^\{-0\.5s\}\}$/);
  // the check boxes choose the formulas; the names line up (the width of G_yr(s))
  for (const k of ['L', 'S', 'T', 'R', 'D']) (a.byId('loop' + k) as HTMLInputElement).checked = k === 'S' || k === 'D';
  const lines = a.loopTeXLines();
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('\\rlap{S(s)}\\hphantom{G_{yr}(s)}=\\dfrac{1}{1+L(s)}='));
  assert.ok(lines[1].startsWith('\\rlap{G_{yd}(s)}\\hphantom{G_{yr}(s)}=\\dfrac{P(s)}{1+L(s)}='));
  // with set-point weights, Gyr is defined with Cr(s)
  Object.assign(a.S, { tdof: true, bw: 0.5 });
  (a.$('loopR') as HTMLInputElement).checked = true;
  assert.ok(a.loopTeXLines().some(l => l.includes('\\dfrac{C_r(s)P(s)}{1+L(s)}')));
});

test('poles: P, C and L as their denominators; the closed-loop poles make 1 + L(s) zero; Padé with dead time', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'third', K: 1, T: 1, mode: 'PID', Kp: 2, Ki: 0.5, Kd: 1, N: 20, tdof: true, bw: 0.5 });
  const p = a.loopPoles(),
    near = (zs: C[], z: C) => zs.some(q => Math.hypot(q[0] - z[0], q[1] - z[1]) < 1e-4); // a triple pole: about 2e-5
  // plant (s+1)^3: a triple pole at −1; controller s(s+20): 0 and −20; L: all of them
  assert.equal(p.P.poles.length, 3);
  assert.ok(p.P.poles.every(z => near([[-1, 0]], z)));
  assert.ok(near(p.C.poles, [0, 0]) && near(p.C.poles, [-20, 0]));
  assert.equal(p.L.poles.length, 5);
  // the closed-loop poles: 1 + L(p) = 0, the same for S, T, Gyd and Gyr (the same denominator with set-point weights)
  for (const z of p.T.poles) {
    const { num, den } = a.loopRational();
    const n = a.polyval(num, z),
      d = a.polyval(den, z);
    assert.ok(Math.hypot(n[0] + d[0], n[1] + d[1]) < 1e-8 * (1 + Math.hypot(...d)), `closed-loop pole ${z}`);
  }
  for (const k of ['S', 'R', 'D'] as const) assert.deepEqual(p[k].poles, p.T.poles);
  assert.ok(!p.T.approx);
  // dead time: the closed-loop poles from the Padé approximation, marked as approximate; P, C and L stay exact
  Object.assign(a.S, { plant: 'dead', L: 0.5 });
  const d = a.loopPoles();
  assert.ok(d.T.approx && !d.P.approx && !d.L.approx);
  assert.equal(d.T.poles.length, 6); // (s+1)·s(s+20)·Padé of order three
});
