// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Kinds of plant and controller: every entry of PLANTS and CONTROLLERS is complete and works with every other,
// so that a new kind added to the tables is checked without writing new tests; likewise the tables of parameters,
// design specifications and languages
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
      assert.ok(a.paramDef(p)?.hard, `${k}: parameter ${p} has a definition with its limits hard`);
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
      assert.ok(a.paramDef(p)?.hard, `${k}: parameter ${p} has a definition with its limits hard`);
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

test('parameters: every one has limits for typed values around its slider, and its sweep values within them', () => {
  for (const [k, d] of Object.entries(a.ALL_PARAMS)) {
    const [lo, hi] = d.hard;
    assert.ok(lo < hi, `${k}: limits in order`);
    assert.ok(
      lo <= d.min && d.max <= hi && lo <= d.val && d.val <= hi,
      `${k}: slider and initial value within the limits`,
    );
    for (const v of d.sweep ?? []) assert.ok(v >= lo && v <= hi, `${k}: sweep value ${v} within the limits`);
    assert.equal(a.paramSym(k), d.sym ?? k);
  }
});

test('design specifications: each has a measurement and a default limit that can be typed', () => {
  const b = fresh();
  assert.deepEqual(Object.keys(b.SPEC_MEASURES), [...b.SPEC_KEYS]);
  assert.equal(JSON.stringify(Object.keys(b.S.spec)), JSON.stringify([...b.SPEC_KEYS, 'show']));
  const ev = b.evalSpecs();
  for (const k of b.SPEC_KEYS) {
    const d = b.SPECS[k];
    assert.ok(d.v >= d.low, `${k}: default limit ≥ the smallest limit`);
    assert.deepEqual({ ...b.S.spec[k] }, { on: d.on, v: d.v });
    assert.equal(ev[k].key, k);
  }
  // the bound decides the direction of the check
  b.S.spec.os.v = 10;
  assert.equal(b.specMet('os', { value: 9 }), true);
  assert.equal(b.specMet('os', { value: 11 }), false);
  b.S.spec.pm.v = 45;
  assert.equal(b.specMet('pm', { value: 50 }), true);
  assert.equal(b.specMet('pm', { value: null, noneOk: true }), true);
  assert.equal(b.specMet('ts', { value: null }), false);
  assert.equal(b.specMet('ms', { value: 1.2, fail: true }), false);
});

test('languages: the menu lists every language of the table; each has its font and the language of its manual', () => {
  const b = fresh();
  assert.deepEqual(
    [...b.langOptions().matchAll(/value="(\w+)"/g)].map(m => m[1]),
    Object.keys(b.LANGUAGES),
  );
  for (const [l, d] of Object.entries(b.LANGUAGES)) {
    b.setLang(l as 'ja');
    assert.equal(b.UIFONT(), d.font);
    assert.equal(b.docsLang(), d.docs);
    assert.equal(b.docsTranslated(), d.docs === l);
  }
});

const pageHTML = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'index.html'), 'utf8');

test('panels: each has its card with a title row in the page, and the CSV buttons match the CSV exports', () => {
  for (const k of a.PANELS) {
    const at = pageHTML.indexOf(`id="panel-${k}"`);
    assert.ok(at > 0, `${k}: <div id="panel-${k}"> in src/index.html`);
    const next = pageHTML.indexOf('id="panel-', at + 1);
    assert.ok(pageHTML.slice(at, next < 0 ? undefined : next).includes('class="h2row"'), `${k}: its title row`);
    assert.ok(['plots', 'ana'].includes(a.PANEL_DEFS[k].menu), `${k}: its menu`);
  }
  const buttons = [...pageHTML.matchAll(/data-csv="(\w+)"/g)].map(m => m[1]).sort();
  assert.deepEqual(buttons, Object.keys(a.CSV_EXPORTS).sort());
  for (const k of buttons) assert.ok((a.PANELS as string[]).includes(k), `CSV ${k} belongs to a panel`);
  // the items of the menus are made from the table, not written in the page
  assert.ok(!/data-tab=/.test(pageHTML));
});

test('compensator designs: each sets its kind of controller, with parameters it has', () => {
  for (const [m, d] of Object.entries(a.COMP_METHODS)) {
    const c = a.CONTROLLERS[d.ctrl];
    assert.ok(c, `${m}: a kind of controller`);
    for (const p of [...d.params, 'Kc']) assert.ok(c.p.includes(p as NumKey), `${m}: ${p} is a parameter of it`);
  }
  // each kind designs a compensator for a third-order lag with K_c = 4 (phase margin short of 50°), and the phase
  // margin grows (a single lead may stay short of the target for this plant: that is the method, not an error)
  const b = fresh();
  Object.assign(b.S, { plant: 'third', mode: 'P' });
  for (const m of Object.keys(b.COMP_METHODS).filter(k => !b.COMP_METHODS[k as 'lead'].locus)) {
    const d = b.compDesign({ method: m, pm: 50, kc: 4, theta: 5, wc: null });
    assert.equal(d.err, undefined, `${m}: ${d.err}`);
    for (const p of b.COMP_METHODS[m as 'lead'].params) {
      const v = d[p as 'T1'];
      assert.ok(v !== undefined && isFinite(v) && v > 0, `${m}: ${p} = ${v}`);
    }
    assert.ok(d.pm !== null && d.pm0 !== null && d.pm > d.pm0, `${m}: phase margin ${d.pm0} → ${d.pm}`);
  }
});
