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
