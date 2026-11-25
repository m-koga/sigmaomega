// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Kinds of plant and controller: every entry of PLANTS and CONTROLLERS is complete and works with every other,
// so that a new kind added to the tables is checked without writing new tests
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, near } from './harness.ts';

const a = fresh();
const plants = Object.keys(a.PLANTS),
  ctrls = Object.keys(a.CONTROLLERS);

test('kinds of plant: parameters are defined, with ranges for typed values; formulas have numbers', () => {
  for (const k of plants) {
    const pl = a.PLANTS[k];
    assert.ok(pl.name, `${k}: name`);
    for (const p of pl.p) {
      assert.ok(a.PARAMS[p], `${k}: parameter ${p} is in PARAMS`);
      assert.ok(a.HARD[p], `${k}: parameter ${p} has a range in HARD`);
    }
    const b = fresh();
    b.S.plant = k;
    const tf = pl.tf(b.S),
      tex = pl.texNum(b.S);
    assert.ok(tf.den.length >= tf.num.length && tf.den[0] !== 0, `${k}: proper transfer function`);
    assert.ok(!/undefined|NaN/.test(tex), `${k}: formula ${tex}`);
  }
});

test('kinds of controller: parameters, gains and formulas are complete', () => {
  for (const k of ctrls) {
    const c = a.CONTROLLERS[k];
    assert.ok(c.label && c.name, `${k}: label and name`);
    assert.ok(c.kind === 'pid' || c.texNum, `${k}: a transfer-function kind has a formula`);
    for (const p of c.p) {
      assert.ok(a.CTRL[p], `${k}: parameter ${p} is in CTRL`);
      assert.ok(a.HARD[p], `${k}: parameter ${p} has a range in HARD`);
    }
    for (const p of c.gain) assert.ok(c.p.includes(p), `${k}: gain ${p} is one of its parameters`);
    const b = fresh();
    b.S.mode = k;
    if (c.texNum) assert.ok(!/undefined|NaN/.test(c.texNum(b.S)), `${k}: formula`);
  }
});

test('kinds of controller: the transfer function of a PID-type kind matches its frequency response', () => {
  for (const k of ctrls.filter(k => a.CONTROLLERS[k].kind === 'pid')) {
    const b = fresh();
    b.S.mode = k;
    const r = a.CONTROLLERS[k].rational(b.S);
    for (const w of [0.1, 1, 10]) {
      const s: [number, number] = [0, w],
        fromTF = b.cdiv(b.polyval(r.num, s), b.polyval(r.den, s)),
        C = b.evalC(w, b.S);
      assert.ok(near(fromTF[0], C[0], 1e-9 * (1 + Math.abs(C[0]))), `${k} Re C(j${w})`);
      assert.ok(near(fromTF[1], C[1], 1e-9 * (1 + Math.abs(C[1]))), `${k} Im C(j${w})`);
    }
  }
});

test('kinds of controller: changing the loop gain scales C(s)', () => {
  for (const k of ctrls) {
    const b = fresh();
    b.S.mode = k;
    const before = b.evalC(1, b.S);
    b.applyLoopGain(2);
    const after = b.evalC(1, b.S);
    assert.ok(near(after[0], 2 * before[0], 1e-5 * (1 + Math.abs(before[0]))), `${k} Re`);
    assert.ok(near(after[1], 2 * before[1], 1e-5 * (1 + Math.abs(before[1]))), `${k} Im`);
  }
});

test('every kind of plant with every kind of controller simulates and has a frequency response', () => {
  for (const pk of plants)
    for (const ck of ctrls) {
      const b = fresh();
      Object.assign(b.S, { plant: pk, mode: ck, Tsim: 10 });
      const sim = b.simulate(),
        fr = b.freqResp();
      assert.ok(sim.Y.length > 10, `${pk} × ${ck}: simulated`);
      assert.ok(sim.Y.every(Number.isFinite) || sim.diverged, `${pk} × ${ck}: finite or reported as diverged`);
      assert.ok(fr.mag.length > 10 && fr.mag.every(Number.isFinite), `${pk} × ${ck}: frequency response`);
    }
});

test('tuning rules: every rule gives gains for a first-order lag + dead time plant, for each controller type', () => {
  const b = fresh();
  b.S.plant = 'dead';
  for (const [k, rule] of Object.entries(b.TUNE_RULES)) {
    assert.ok(rule.label, `${k}: label`);
    for (const type of b.TUNE_TYPES) {
      const r = b.tuneRule(k, type);
      if (r.err !== undefined) {
        assert.equal(`${k} ${type} ${r.err}`, `imc P noP`, 'only IMC refuses a P controller');
        continue;
      }
      assert.ok(r.Kp > 0 && Number.isFinite(r.Kp), `${k} ${type}: Kp`);
      assert.equal(r.Ti !== undefined, type !== 'P', `${k} ${type}: Ti only with an integral term`);
      assert.equal(r.Td !== undefined, type === 'PID', `${k} ${type}: Td only with a derivative term`);
      assert.equal(r.model.kind, rule.model, `${k}: uses its model`);
    }
  }
});

test('tuning rules: what a rule needs is checked before its gains are computed', () => {
  const b = fresh();
  b.S.plant = 'integ'; // no time constant T in the model
  for (const [k, rule] of Object.entries(b.TUNE_RULES))
    if (rule.needT) assert.equal(b.tuneRule(k, 'PI').err, 'needT', k);
  b.S.plant = 'first'; // no apparent dead time
  for (const [k, rule] of Object.entries(b.TUNE_RULES))
    if (rule.needDead) assert.equal(b.tuneRule(k, 'PI').err, 'noDead', k);
});

test('plots: every plot has a PNG file name and a label; linked plots link back', () => {
  for (const [k, p] of Object.entries(a.PLOTS)) {
    assert.ok(p.label && p.file, k);
    assert.equal(a.PNG_NAMES[k], p.file);
    assert.equal(a.AREA_LABELS[k], p.label);
    if (p.linkX) assert.equal(a.PLOTS[p.linkX].linkX, k, `${k} and ${p.linkX} share the horizontal axis`);
  }
});

test('kinds of controller: their own initial values are among their parameters and in range', () => {
  for (const [k, c] of Object.entries(a.CONTROLLERS))
    for (const [p, v] of Object.entries(c.defaults ?? {})) {
      assert.ok(c.p.includes(p as NumKey), `${k}: ${p} is one of its parameters`);
      const d = a.CTRL[p];
      assert.ok(v >= d.min && v <= d.max, `${k}: ${p} = ${v} within the slider`);
    }
  assert.equal(a.ctrlDefault('P', 'Kp'), 1);
  assert.equal(a.ctrlDefault('PID', 'Kp'), a.CTRL.Kp.val);
});

test('switching the kind of controller: a value at its initial value follows, a changed value is kept', () => {
  const b = fresh();
  assert.equal(b.S.Kp, 2); // PID
  b.switchDefaults('PID', 'P');
  assert.equal(b.S.Kp, 1);
  b.switchDefaults('P', 'PI');
  assert.equal(b.S.Kp, 2);
  b.S.Kp = 3.5; // changed by hand
  b.switchDefaults('PI', 'P');
  assert.equal(b.S.Kp, 3.5);
  b.switchDefaults('P', 'lead'); // other parameters are not touched
  assert.equal(b.S.Kp, 3.5);
});
