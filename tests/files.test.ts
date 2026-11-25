// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Saving and loading: scenarios, scenario files and layouts, CSV export
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, near, plain } from './harness.ts';

test('scenarios: export and import restore every setting', () => {
  const a = fresh();
  Object.assign(a.S, {
    plant: 'custom',
    cNumStr: '2s + 1',
    cDenStr: 's^2 + 3s + 1',
    L: 0.3,
    mode: 'lead',
    Kc: 3.5,
    T1: 0.7,
    refType: 'ramp',
    Tsim: 42,
    sat: true,
    umax: 1.5,
  });
  a.S.spec.ms = { on: true, v: 1.4 };
  a.S.sweep = { on: true, p: 'Kc', vals: [1, 3, 9] };
  a.S.tune.method = 'imc';
  a.S.tune.lam = 0.8;
  const before = JSON.stringify(a.scenarioData('x', 'task').S);
  const text = JSON.stringify(a.scenarioData('x', 'task'));
  a.defaults();
  assert.notEqual(JSON.stringify(a.scenarioData('', '').S), before);
  const d = a.parseScenarioText(text);
  a.applyScenario(d);
  assert.equal(JSON.stringify(a.scenarioData('x', 'task').S), before);
  assert.deepEqual(JSON.parse(JSON.stringify(a.S.cDen)), [1, 3, 1]); // parsed polynomial rebuilt
  // the link form decodes to the same data (non-ASCII text included)
  const link = 'https://example.org/#s=' + a.b64urlEncode(JSON.stringify({ ...d, note: '課題：位相余裕 ≥ 60°' }));
  assert.equal(a.parseScenarioText(link).note, '課題：位相余裕 ≥ 60°');
});

test('scenarios: unknown keys, wrong types and out-of-range values are ignored or clamped', () => {
  const a = fresh();
  // invalid on purpose (as in a hand-edited file): wrong types, out-of-range values, unknown keys
  a.applyScenario({
    S: {
      plant: 'nonexistent',
      mode: 42,
      Kp: 'abc',
      T: -5,
      zeta: 1e9,
      hack: 'x',
      spec: { os: { on: 'yes', v: 5 } },
      sweep: { vals: ['2', 'x', 3] },
    },
  } as unknown as Scenario);
  assert.equal(a.S.plant, 'first');
  assert.equal(a.S.mode, 'PID');
  assert.equal(a.S.Kp, a.CTRL.Kp.val);
  assert.equal(a.S.T, a.hardRange('T')[0]);
  assert.equal(a.S.zeta, a.hardRange('zeta')[1]);
  assert.equal((a.S as unknown as Record<string, unknown>).hack, undefined);
  assert.equal(a.S.spec.os.on, true);
  assert.equal(a.S.spec.os.v, 5);
  assert.deepEqual(JSON.parse(JSON.stringify(a.S.sweep.vals)), [2, 3]);
  assert.throws(
    () => a.applyScenario({ foo: 1 } as unknown as Scenario),
    e => /format/.test(String(e)),
  );
});

test('scenarios: transfer functions that cannot be read fall back to the defaults', () => {
  const a = fresh();
  a.applyScenario({ name: 'bad', S: { plant: 'custom', cNumStr: 's+(', cDenStr: '1', ccNumStr: '2', ccDenStr: '*s' } });
  assert.deepEqual(plain([a.S.cNumStr, a.S.cDenStr, a.S.cNum, a.S.cDen]), ['1', 's+1', [1], [1, 1]]);
  assert.deepEqual(plain([a.S.ccNumStr, a.S.ccDenStr, a.S.ccNum, a.S.ccDen]), ['1', '1', [1], [1]]);
});

test('scenarios: every example loads and simulates', () => {
  const a = fresh();
  a.SC_EXAMPLES.forEach(e => {
    a.applyScenario({ name: e.name, note: e.note, S: JSON.parse(JSON.stringify(e.S)) });
    assert.equal(a.S.plant, e.S.plant);
    const sim = a.simulate();
    assert.ok(sim.T.length > 100);
  });
});

test('scenario files: a single scenario is applied; file names are sanitized', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'second', zeta: 0.15, mode: 'PI', Kp: 1.7 });
  const text = '﻿' + JSON.stringify(a.scenarioData('課題 1/2: PI?', 'note'), null, 2);
  a.defaults();
  const r = a.importScenarioFile(text);
  assert.equal(r.name, '課題 1/2: PI?');
  assert.deepEqual([a.S.plant, a.S.zeta, a.S.mode, a.S.Kp], ['second', 0.15, 'PI', 1.7]);
  assert.equal(a.scFileName('課題 1/2: PI?'), '課題 1_2_ PI_.json');
  assert.equal(a.scFileName('  '), 'scenario.json');
  assert.throws(() => a.importScenarioFile('not json'));
  assert.throws(
    () => a.importScenarioFile('[{"x":1}]'),
    e => /format/.test(String(e)),
  );
});

test('CSV export: time response, frequency response, Nyquist and poles', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'third', mode: 'P', Kp: 2 });
  const sim = a.simulate(),
    fr = a.freqResp(),
    pz = a.computePZ();
  const lines = (t: string) => t.replace(/^﻿/, '').trim().split('\r\n');
  const t = lines(a.timeCSV(sim, null));
  assert.equal(t[0], 't,r,y,u');
  assert.equal(t.length, sim.T.length + 1);
  const end = t[t.length - 1].split(',').map(Number),
    n0 = sim.T.length - 1;
  assert.ok(near(end[0], sim.T[n0], 1e-9) && near(end[2], sim.Y[n0], 1e-6));
  a.S.sweep = { on: true, p: 'Kp', vals: [1, 4] };
  const t2 = lines(a.timeCSV(sim, a.sweepRuns()));
  assert.equal(t2[0], 't,r,y,u,y (KP=1),y (KP=4),u (KP=1),u (KP=4)');
  const f = lines(a.freqCSV(fr));
  assert.equal(f[0].split(',').length, 15);
  assert.equal(f.length, fr.W.length + 1);
  assert.ok(near(Number(f[1].split(',')[1]), fr.mag[0], 1e-6));
  const n = lines(a.nyqCSV(fr));
  assert.equal(n[0], 'omega [rad/s],Re L,Im L');
  const row = n[100].split(',').map(Number);
  assert.ok(
    near(row[0], fr.W[99], 1e-6 * fr.W[99]) && near(row[1], fr.Lc[99][0], 1e-6) && near(row[2], fr.Lc[99][1], 1e-6),
  );
  const p = lines(a.pzCSV(pz));
  assert.equal(p.filter(l => l.startsWith('closed-loop pole')).length, 3);
  assert.equal(p.filter(l => l.startsWith('plant pole')).length, 3);
});

test('scenario layout: only known keys with valid values are taken', () => {
  const a = fresh();
  const L = JSON.parse(
    JSON.stringify(
      a.scLayout({
        sideW: 420,
        h: { cvY: 300, diagBox: 'x', cvG: -5 },
        ms: 1.4,
        msb: 99,
        zs: { bodeopts: 1.2 },
        hidden: { tex: true, cvY: true, margins: 'yes' },
        cards: { plant: true },
        panels: ['bode', 'pz', 'bogus'],
        pcols: 'row',
        stab: 'ana',
        sideCollapsed: true,
        mview: 'table',
        hack: 1,
      }),
    ),
  );
  assert.equal(L.sideW, 420);
  assert.deepEqual(L.h, { cvY: 300 });
  assert.equal(L.ms, 1.4);
  assert.ok(!('cards' in L)); // folded cards (before 1.60): no longer kept
  assert.equal(L.msb, null);
  assert.deepEqual(L.hidden, { cvY: true }); // tex: the formulas are a panel now, hidden with its tab
  assert.deepEqual(L.panels, ['diag', 'bode', 'pz']); // saved without a version: the block diagram is added
  assert.equal(L.pcols, 'row');
  assert.equal(L.stab, 'ana');
  assert.equal(L.sideCollapsed, true);
  assert.equal(L.mview, 'table');
  assert.equal(L.hack, undefined);
  const D = JSON.parse(JSON.stringify(a.scLayout(null)));
  assert.equal(D.panels, null);
  assert.equal(D.pv, a.PANELS_V);
  assert.equal(D.stab, 'sys');
  assert.equal(D.mview, 'cards');
  // a scenario saved without the layout has no layout key
  assert.equal(a.scenarioData('x', '').layout, undefined);
});

test('stored panel lists: the panels of the transfer functions and the block diagram are added to lists saved before they existed', () => {
  const a = fresh();
  // saved before version 2: the formulas and the diagram were always shown, so their panels are shown
  assert.deepEqual(plain(a.storedPanels(['bode', 'time'], undefined, {})), ['diag', 'time', 'tf', 'bode']);
  // ...the formulas unless they had been hidden with their handle
  assert.deepEqual(plain(a.storedPanels(['bode'], undefined, { tex: true })), ['diag', 'bode']);
  // saved with version 2: the transfer functions taken as they are (hidden on purpose), the diagram added
  assert.deepEqual(plain(a.storedPanels(['nyq', 'time'], 2, {})), ['diag', 'time', 'nyq']);
  // saved with version 3: taken as it is
  assert.deepEqual(plain(a.storedPanels(['nyq'], a.PANELS_V, {})), ['nyq']);
  assert.equal(a.PANELS_V, 3);
  assert.equal(a.storedPanels(['bogus'], a.PANELS_V, {}), null);
  assert.equal(a.storedPanels('time', undefined, {}), null);
  // scenario layouts use the same rule
  assert.deepEqual(plain(a.scLayout({ panels: ['pz'] }).panels), ['diag', 'tf', 'pz']);
  assert.deepEqual(plain(a.scLayout({ panels: ['pz'], pv: 2 }).panels), ['diag', 'pz']);
  assert.deepEqual(plain(a.scLayout({ panels: ['pz'], pv: 3 }).panels), ['pz']);
  assert.deepEqual(plain(a.DEFAULT_PANELS), ['diag', 'time', 'tf']);
});

test('preset layouts: the block diagram lies on top across the whole width and is not counted as a column', () => {
  const a = fresh();
  assert.equal(a.presetCols('2', ['diag', 'time', 'tf']), 2);
  assert.equal(a.presetCols('2', ['diag', 'time']), 1);
  assert.equal(a.presetCols('2', ['diag']), 1);
  assert.equal(a.presetCols('row', ['diag', 'time', 'bode', 'nyq']), 3);
  assert.equal(a.presetCols('1', ['diag', 'time', 'bode']), 1);
});

test('the bottom edge of the transfer functions panel scales the formulas to fit the height', () => {
  const a = fresh();
  // the size changes in the same ratio as the height
  assert.equal(a.texFsForHeight(14, 100, 50), 21);
  assert.equal(a.texFsForHeight(14, 100, -50), 7);
  assert.equal(a.texFsForHeight(14, 100, 0), 14);
  // 4-60 px in steps of 0.5
  assert.equal(a.texFsForHeight(14, 100, -99), a.TEX_FS_MIN);
  assert.equal(a.texFsForHeight(14, 100, 1000), a.TEX_FS_MAX);
  assert.equal(a.texFsForHeight(14, 100, 3), 14.5);
  // no height measured (the panel is hidden): the size is kept
  assert.equal(a.texFsForHeight(20, 0, 30), 20);
  // the width of the panel stops the size: formulas may become 1.5 times wider -> at most 21 px from 14 px
  assert.equal(a.texFsForHeight(14, 100, 200, 1.5), 21);
  assert.equal(a.texFsForHeight(14, 100, 200, 1.52), 21); // rounded down, so it still fits
  assert.equal(a.texFsForHeight(14, 100, -50, 1.5), 7); // smaller: not limited
  // formulas already too wide (after the panel became narrower): they can only shrink
  assert.equal(a.texFsForHeight(20, 100, 50, 0.8), 16);
  assert.equal(a.texFsForHeight(20, 100, -50, 0.8), 10);
  assert.equal(a.texFsForHeight(14, 100, 0, 0.1), a.TEX_FS_MIN); // never below 4 px
  // the formulas hidden with their old handle: no longer an area of its own
  assert.deepEqual(plain(a.withoutTex({ tex: true, cvY: true })), { cvY: true });
});

test('the formulas are shown smaller while the chosen size is wider than the panel, and grow back with room', () => {
  const a = fresh();
  // room enough: the chosen size
  assert.equal(a.texFsShown(30, 30, 1.2), 30);
  assert.equal(a.texFsShown(14, 14, Infinity), 14); // not measured (hidden panel, formulas not drawn yet)
  // too wide: as large as fits (rounded down)
  assert.equal(a.texFsShown(30, 30, 0.75), 22.5);
  assert.equal(a.texFsShown(30, 30, 0.76), 22.5);
  // shown smaller now and the panel wider again: back up to the chosen size, no further
  assert.equal(a.texFsShown(30, 20, 1.25), 25);
  assert.equal(a.texFsShown(30, 20, 3), 30);
  // never below 4 px
  assert.equal(a.texFsShown(14, 14, 0.1), a.TEX_FS_MIN);
});

test('the layout defaults come from one place: defaultLayout()', () => {
  const a = fresh();
  const D = plain(a.defaultLayout());
  // a scenario without a layout, and a scenario holding the default layout, give the defaults
  assert.deepEqual(plain(a.scLayout(null)), D);
  assert.deepEqual(plain(a.scLayout(JSON.parse(JSON.stringify(D)))), D);
  // a fresh object each time (changing one does not change the next)
  const x = a.defaultLayout();
  x.h.cvY = 300;
  assert.deepEqual(plain(a.defaultLayout().h), {});
  // a few of the defaults
  assert.equal(D.scard, 'plant');
  assert.equal(D.mview, 'cards');
  assert.equal(D.pv, a.PANELS_V);
});
