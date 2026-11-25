// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Design aids: specifications, tuning rules, parameter sweep, 2-DOF PID, disturbance metrics
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, near, defined, success } from './harness.ts';

test('design specifications: pass/fail matches the computed metrics and margins', () => {
  const a = fresh();
  a.update();
  const ev = a.evalSpecs();
  const mt = defined(a.stepMetrics(a.simulate())),
    fr = a.freqResp();
  assert.equal(ev.os.ok, mt.os <= a.S.spec.os.v);
  assert.ok(near(defined(ev.os.value), mt.os, 1e-9));
  assert.equal(ev.pm.ok, fr.pm === null || fr.pm >= a.S.spec.pm.v);
  a.S.spec.os.v = Math.max(0, mt.os - 1);
  a.S.spec.pm.v = 179;
  const e2 = a.evalSpecs();
  assert.equal(e2.os.ok, mt.os <= a.S.spec.os.v);
  assert.equal(e2.pm.ok, fr.pm === null);
  // time-domain specifications do not apply to a sine reference
  a.S.refType = 'sine';
  a.update();
  assert.equal(a.evalSpecs().os.applicable, false);
});

test('tuning: the reaction curve of K e^{-Ls}/(Ts+1) recovers K, T and L, and Ziegler–Nichols PID follows', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'dead', K: 2, T: 1, L: 0.5 });
  const m = success(a.plantStepModel());
  assert.ok(near(defined(m.K), 2, 1e-9) && near(defined(m.T), 1, 0.01) && near(m.L, 0.5, 0.01), JSON.stringify(m));
  const r = success(a.tuneRule('zn-step', 'PID'));
  assert.ok(
    near(r.Kp, (1.2 * 1) / (2 * 0.5), 0.01) && near(defined(r.Ti), 1, 0.01) && near(defined(r.Td), 0.25, 0.01),
    JSON.stringify(r),
  );
  const g = a.tuneGains(r);
  assert.ok(near(g.Ki, r.Kp / defined(r.Ti), 1e-12) && near(g.Kd, r.Kp * defined(r.Td), 1e-12));
  const c = success(a.tuneRule('chr-sp0', 'PI')); // Kp = 0.35 T/(K L), Ti = 1.2 T
  assert.ok(near(c.Kp, 0.35, 0.01) && near(defined(c.Ti), 1.2, 0.01) && c.Td === undefined, JSON.stringify(c));
});

test('tuning: ultimate sensitivity of 1/(s+1)³ gives Ku = 8, Pu = 2π/√3', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'third', K: 1, T: 1 });
  const r = success(a.tuneRule('zn-ult', 'PID')),
    Pu = (2 * Math.PI) / Math.sqrt(3);
  assert.ok(r.model.kind === 'ult');
  assert.ok(near(r.model.Ku, 8, 1e-3) && near(r.model.Pu, Pu, 1e-3), JSON.stringify(r.model));
  assert.ok(
    near(r.Kp, 4.8, 1e-3) && near(defined(r.Ti), Pu / 2, 1e-3) && near(defined(r.Td), Pu / 8, 1e-3),
    JSON.stringify(r),
  );
  assert.ok(near(success(a.tuneRule('zn-ult', 'P')).Kp, 4, 1e-3));
});

test('tuning: IMC PID for a first-order lag with dead time', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'dead', K: 1, T: 1, L: 0.5 });
  const r = success(a.tuneRule('imc', 'PID', 0.5)); // Kp = (2T+L)/(K(2λ+L)), Ti = T+L/2, Td = TL/(2T+L)
  assert.ok(
    near(r.Kp, 2.5 / 1.5, 0.01) && near(defined(r.Ti), 1.25, 0.01) && near(defined(r.Td), 0.2, 0.01),
    JSON.stringify(r),
  );
  assert.ok(defined(success(a.tuneRule('imc', 'PI')).lam) >= 1.7 * 0.5 - 0.01); // automatic λ
  assert.equal(a.tuneRule('imc', 'P').err, 'noP');
});

test('tuning: rules report when they are not applicable', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'first', K: 1, T: 1 });
  assert.equal(a.tuneRule('zn-step', 'PID').err, 'noDead'); // no apparent dead time
  assert.equal(a.tuneRule('zn-ult', 'PID').err, 'noCross'); // phase never reaches −180°
  assert.ok(!a.tuneRule('imc', 'PI').err);
  Object.assign(a.S, { plant: 'unstable' });
  assert.equal(a.tuneRule('zn-step', 'PID').err, 'unstable');
  Object.assign(a.S, { plant: 'integ', K: 1, T: 1 });
  const r = success(a.tuneRule('zn-step', 'PI')); // works with an integrator (slope R)
  assert.ok(r.model.kind === 'step');
  assert.ok(r.model.K === null && near(r.model.R, 1, 0.01) && near(r.model.L, 1, 0.02), JSON.stringify(r));
  assert.equal(a.tuneRule('chr-sp0', 'PI').err, 'needT');
  // negative plant gain gives negative controller gains
  Object.assign(a.S, { plant: 'dead', K: -1, T: 1, L: 0.5 });
  assert.ok(success(a.tuneRule('zn-step', 'PID')).Kp < 0 && success(a.tuneRule('zn-ult', 'PID')).Kp < 0);
});

test('tuning: Ziegler–Nichols PID stabilizes 1/(s+1)³ with closed-loop poles in the left half-plane', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'third', K: 1, T: 1, mode: 'PID', N: 1000 });
  for (const m of ['zn-step', 'zn-ult', 'chr-sp0', 'imc']) {
    Object.assign(a.S, a.tuneGains(success(a.tuneRule(m, 'PID'))));
    assert.ok(
      a.computePZ().cl.every(z => z[0] < 0),
      `${m}: ${JSON.stringify(a.computePZ().cl)}`,
    );
  }
});

test('sweep: each run matches a separate computation with that value, and the setting is restored', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'third', K: 1, T: 1, mode: 'P', Kp: 2 });
  a.S.sweep = { on: true, p: 'Kp', vals: [1, 4, 8, 10] };
  const runs = defined(a.sweepRuns());
  assert.equal(runs.length, 4);
  assert.equal(a.S.Kp, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(runs.map(r => r.stable))), [true, true, false, false]); // 1/(s+1)³ is stable for Kp < 8
  const b = fresh();
  Object.assign(b.S, { plant: 'third', K: 1, T: 1, mode: 'P', Kp: 4 });
  assert.ok(
    near(defined(runs[1].fr.pm), defined(b.freqResp().pm), 1e-9) &&
      near(defined(runs[1].mt).os, defined(b.stepMetrics(b.simulate())).os, 1e-9),
  );
  assert.ok(near(defined(runs[0].fr.gm), 20 * Math.log10(8), 0.05));
  a.S.sweep.on = false;
  assert.equal(a.sweepRuns(), null);
  a.S.sweep = { on: true, p: 'Kd', vals: [1] };
  assert.equal(a.sweepRuns(), null); // not a parameter of P control
});

test('sweep: parameter list, default values and parsing respect the allowed ranges', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'dead', mode: 'lead', Kc: 2 });
  assert.deepEqual(JSON.parse(JSON.stringify(a.sweepParams())), ['K', 'T', 'L', 'Kc', 'T1', 'alpha']);
  assert.deepEqual(JSON.parse(JSON.stringify(a.sweepDefaults('Kc'))), [1, 2, 4, 8]);
  assert.ok(a.sweepDefaults('alpha').every(v => v > 0 && v < 1));
  assert.deepEqual(JSON.parse(JSON.stringify(a.parseSweep('0.5, 2；3 abc 2, 1.2', 'alpha'))), [0.5, 0.999999]);
  assert.equal(a.parseSweep('1 2 3 4 5 6 7 8 9 10', 'Kp').length, 8);
});

test('2-DOF PID: b = c = 1 equals ordinary PID, and PI-D equals c = 0', () => {
  const run = (cfg: Partial<State>) => {
    const a = fresh();
    Object.assign(a.S, { plant: 'second', mode: 'PID', Kp: 3, Ki: 1.5, Kd: 0.8 }, cfg);
    return a.simulate().Y;
  };
  const base = run({}),
    one = run({ tdof: true, bw: 1, cw: 1 });
  assert.ok(base.every((v, i) => Math.abs(v - one[i]) < 1e-12));
  const pid = run({ dOnMeas: true }),
    c0 = run({ tdof: true, bw: 1, cw: 0 });
  assert.ok(pid.every((v, i) => Math.abs(v - c0[i]) < 1e-12));
  const b0 = run({ tdof: true, bw: 0, cw: 0 });
  assert.ok(Math.max(...b0) < Math.max(...base), 'smaller weights reduce the overshoot here');
});

test('2-DOF PID: the set-point weights do not change the response to a disturbance', () => {
  const run = (cfg: Partial<State>) => {
    const a = fresh();
    Object.assign(
      a.S,
      { plant: 'dead', K: 1, T: 1, L: 0.5, mode: 'PID', Kp: 1.9, Ki: 1.583, Kd: 0.399, Tsim: 30, td: 15, d: 0.5 },
      cfg,
    );
    return a.simulate().Y;
  };
  const dpart = (w: Partial<State>) => {
    const y1 = run({ ...w, dOn: true }),
      y0 = run({ ...w, dOn: false });
    return y1.map((v, i) => v - y0[i]);
  };
  const d1 = dpart({ tdof: true, bw: 1, cw: 1 }),
    d2 = dpart({ tdof: true, bw: 0.3, cw: 0 });
  assert.ok(d1.every((v, i) => Math.abs(v - d2[i]) < 1e-9));
  assert.ok(Math.max(...d1.map(Math.abs)) > 0.05);
});

test('disturbance metrics: deviation and recovery of PI control', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'first', K: 1, T: 1, mode: 'PI', Kp: 2, Ki: 2, Tsim: 30, dOn: true, d: 1, td: 10 });
  const sim = a.simulate(),
    dm = defined(a.distMetrics(sim));
  let i0 = sim.T.findIndex(t => t >= 10),
    dev = 0;
  for (let i = i0; i < sim.T.length; i++) dev = Math.max(dev, Math.abs(sim.Y[i] - sim.Y[i0]));
  assert.ok(near(dm.dev, dev, 1e-12) && dm.dev > 0.1);
  assert.ok(dm.rec !== null && dm.rec > 0 && dm.rec < 20, String(dm.rec));
  a.S.mode = 'P';
  assert.equal(defined(a.distMetrics(a.simulate())).rec, null); // P control leaves an offset
});

test('tuning: every rule and controller type against the published tables (FOPDT with K = 2, T = 1, L = 0.5)', () => {
  // Step-response rules use a = K·L/T = 1 (Ziegler–Nichols; Chien–Hrones–Reswick, as tabulated by Åström and Hägglund)
  const a = fresh();
  Object.assign(a.S, { plant: 'dead', K: 2, T: 1, L: 0.5 });
  const T = 1,
    L = 0.5,
    want: Record<string, Record<string, number[]>> = {
      // [Kp·a, Ti, Td]
      'zn-step': { P: [1], PI: [0.9, (10 * L) / 3], PID: [1.2, 2 * L, 0.5 * L] },
      'chr-sp0': { P: [0.3], PI: [0.35, 1.2 * T], PID: [0.6, T, 0.5 * L] },
      'chr-sp20': { P: [0.7], PI: [0.6, T], PID: [0.95, 1.4 * T, 0.47 * L] },
      'chr-ld0': { P: [0.3], PI: [0.6, 4 * L], PID: [0.95, 2.4 * L, 0.42 * L] },
      'chr-ld20': { P: [0.7], PI: [0.7, 2.3 * L], PID: [1.2, 2 * L, 0.42 * L] },
    };
  for (const [m, types] of Object.entries(want))
    for (const [ty, [kp, ti, td]] of Object.entries(types)) {
      const r = success(a.tuneRule(m, ty));
      assert.ok(near(r.Kp, kp, 0.01 * kp), `${m}/${ty}: Kp ${r.Kp} vs ${kp}`);
      if (ti === undefined) assert.equal(r.Ti, undefined);
      else assert.ok(near(defined(r.Ti), ti, 0.01 * ti), `${m}/${ty}: Ti ${r.Ti} vs ${ti}`);
      if (td === undefined) assert.equal(r.Td, undefined);
      else assert.ok(near(defined(r.Td), td, 0.01 * td), `${m}/${ty}: Td ${r.Td} vs ${td}`);
    }
});

test('disturbance metrics: analytical deviation and recovery time (PI cancelling the plant pole)', () => {
  // P = 1/(2s+1), C = 4 + 2/s: a unit step disturbance gives y_d(t) = (e^{−t/2} − e^{−2t})/3
  const a = fresh();
  Object.assign(a.S, { plant: 'first', K: 1, T: 2, mode: 'PI', Kp: 4, Ki: 2, Tsim: 30, dOn: true, d: 1, td: 10 });
  const dm = defined(a.distMetrics(a.simulate())),
    yd = (t: number) => (Math.exp(-t / 2) - Math.exp(-2 * t)) / 3;
  assert.ok(near(dm.dev, yd(Math.log(4) / 1.5), 2e-3), `deviation ${dm.dev}`);
  let lo = 2,
    hi = 20; // last time |y_d| = 0.02 (2 % of r = 1)
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2;
    if (yd(m) > 0.02) lo = m;
    else hi = m;
  }
  assert.ok(near(defined(dm.rec), lo, 0.05), `recovery ${dm.rec} vs ${lo}`);
});

test('tuning: every reason a rule cannot be applied has its own message', () => {
  const a = fresh();
  const codes = ['unstable', 'dc0', 'noDead', 'needT', 'noCross', 'imcMode'];
  const msgs = codes.map(c => a.tuneErr(c));
  assert.equal(new Set(msgs).size, codes.length);
  for (const m of msgs) assert.ok(m.length > 10, m);
});
