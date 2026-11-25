// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Frequency response: Bode plot, margins, compensators, sensitivity functions, disturbance and reference transfer functions
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, near, defined } from './harness.ts';

test('Bode plot: |L| = |P| + |C| [dB] and ∠L = ∠P + ∠C at all frequencies', () => {
  for (const [plant, mode] of [
    ['first', 'PID'],
    ['dead', 'PI'],
    ['integ', 'lead'],
    ['unstable', 'leadlag'],
    ['third', 'lag'],
  ]) {
    const a = fresh();
    Object.assign(a.S, { plant, mode });
    const f = a.freqResp();
    for (let i = 0; i < f.W.length; i++) {
      assert.ok(Math.abs(f.mag[i] - f.P.mag[i] - f.C.mag[i]) < 1e-9, `${plant}/${mode} gain i=${i}`);
      const d = f.ph[i] - f.P.ph[i] - f.C.ph[i];
      assert.ok(Math.abs((((d % 360) + 540) % 360) - 180) < 1e-6, `${plant}/${mode} phase i=${i}`);
    }
  }
});

test('phase margin: 1/(s(s+1)) with K_P = 1 gives PM = 51.83° and ωgc = 0.786 rad/s', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 1 });
  const f = a.freqResp();
  const wgc = Math.sqrt((Math.sqrt(5) - 1) / 2);
  assert.ok(near(defined(f.wgc), wgc, 1e-3), `ωgc ${f.wgc}`);
  assert.ok(near(defined(f.pm), 90 - (Math.atan(wgc) * 180) / Math.PI, 0.05), `PM ${f.pm}`);
  assert.equal(f.gm, null); // the phase never reaches -180° (GM = ∞)
});

test('lead compensator: maximum phase lead equals sin⁻¹((1−α)/(1+α))', () => {
  const a = fresh();
  Object.assign(a.S, { mode: 'lead', alpha: 0.1, T1: 1 });
  const f = a.freqResp();
  const max = Math.max(...f.C.ph);
  assert.ok(near(max, (Math.asin(0.9 / 1.1) * 180) / Math.PI, 0.1), `max phase ${max}`);
});

test('sensitivity: K/(s+1) with P control has bandwidth 1 + K Kp and Mt = K Kp/(1 + K Kp)', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'first', K: 1, T: 1, mode: 'P', Kp: 2 });
  const fr = a.freqResp();
  assert.ok(near(defined(fr.wbw), 3, 0.01), `ωBW ${fr.wbw}`);
  assert.ok(near(defined(fr.mt), 2 / 3, 1e-3), `Mt ${fr.mt}`);
  assert.ok(defined(fr.ms) <= 1 + 1e-9 && defined(fr.ms) > 0.95, `Ms ${fr.ms}`); // |S| rises monotonically to 1
  // S + T = 1 at every frequency
  for (let i = 0; i < fr.W.length; i += 97) {
    const s = 10 ** (fr.S.mag[i] / 20),
      t = 10 ** (fr.T.mag[i] / 20),
      ps = (fr.S.ph[i] * Math.PI) / 180,
      pt = (fr.T.ph[i] * Math.PI) / 180;
    assert.ok(Math.hypot(s * Math.cos(ps) + t * Math.cos(pt) - 1, s * Math.sin(ps) + t * Math.sin(pt)) < 1e-9);
  }
});

test('sensitivity: Ms equals 1 / (minimum distance from L(jω) to −1) for Kp/(s+1)³', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'third', K: 1, T: 1, mode: 'P', Kp: 4 });
  const fr = a.freqResp();
  let dmin = Infinity;
  for (let i = 0; i <= 200000; i++) {
    const w = 10 ** (-3 + (6 * i) / 200000);
    // (1 + jw)^3 = (1 - 3w²) + j(3w - w³)
    const re = 1 - 3 * w * w,
      im = 3 * w - w ** 3,
      d2 = re * re + im * im;
    const L = [(4 * re) / d2, (-4 * im) / d2];
    dmin = Math.min(dmin, Math.hypot(L[0] + 1, L[1]));
  }
  assert.ok(near(defined(fr.ms), 1 / dmin, 2e-3), `Ms ${fr.ms} vs ${1 / dmin}`);
  a.S.spec.ms = { on: true, v: 2 };
  a.update();
  assert.equal(a.evalSpecs().ms.ok, defined(fr.ms) <= 2);
});

test('disturbance and reference transfer functions: K/(s+1) with P control', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'first', K: 1, T: 1, mode: 'P', Kp: 3, tdof: true, bw: 0.5 });
  const fr = a.freqResp();
  // Gyd = 1/(s+1+Kp): DC gain 1/4 and |Gyd| decreasing; Gyr = Kp b/(s+1+Kp): DC 0.375
  assert.ok(near(10 ** (fr.D.mag[0] / 20), 0.25, 1e-3), String(fr.D.mag[0]));
  assert.ok(near(10 ** (fr.Gyr.mag[0] / 20), 0.375, 1e-3), String(fr.Gyr.mag[0]));
  assert.ok(near(defined(fr.dmax), 0.25, 1e-3));
  const w = 2.7,
    g = a.evalT(w),
    want = 1.5 / Math.hypot(4, w);
  assert.ok(near(Math.hypot(g[0], g[1]), want, 1e-9));
});

test('lag compensator: maximum phase lag −sin⁻¹((β−1)/(β+1)) at ω = 1/(T₂√β), DC gain Kc, high-frequency gain Kc/β', () => {
  const a = fresh();
  Object.assign(a.S, { mode: 'lag', Kc: 2, T2: 5, beta: 10 });
  const w0 = 1 / (5 * Math.sqrt(10)),
    c = a.evalC(w0),
    want = (-Math.asin(9 / 11) * 180) / Math.PI;
  assert.ok(near((Math.atan2(c[1], c[0]) * 180) / Math.PI, want, 1e-9));
  const lo = a.evalC(1e-6),
    hi = a.evalC(1e6);
  assert.ok(near(Math.hypot(...lo), 2, 1e-6) && near(Math.hypot(...hi), 0.2, 1e-6)); // C = Kc(T₂s+1)/(βT₂s+1)
});

test('every controller: the frequency response equals its transfer function used for the poles', () => {
  const a = fresh();
  Object.assign(a.S, { Kp: 2.5, Ki: 1.3, Kd: 0.4, N: 15, Kc: 3, T1: 0.8, alpha: 0.2, T2: 4, beta: 6 });
  const pv = (p: Poly, w: number) =>
    p.reduce<Complex>((acc, c) => [acc[0] * 0 - acc[1] * w + c, acc[0] * w + acc[1] * 0], [0, 0]);
  for (const mode of ['P', 'PI', 'PD', 'PID', 'lead', 'lag', 'leadlag', 'custom']) {
    a.S.mode = mode;
    const tf = a.ctrlTF();
    for (const w of [0.03, 0.4, 2, 17, 300]) {
      const n = pv(tf.num, w),
        d = pv(tf.den, w),
        q = d[0] ** 2 + d[1] ** 2;
      const r = [(n[0] * d[0] + n[1] * d[1]) / q, (n[1] * d[0] - n[0] * d[1]) / q],
        c = a.evalC(w);
      assert.ok(Math.hypot(r[0] - c[0], r[1] - c[1]) <= 1e-9 * Math.max(1, Math.hypot(...c)), `${mode} at ω = ${w}`);
    }
  }
});

test('every controller: the simulated sine response matches the closed-loop frequency response', () => {
  const a = fresh();
  const cfg: Record<string, Partial<State>> = {
    P: { Kp: 2 },
    PI: { Kp: 2, Ki: 1 },
    PD: { Kp: 2, Kd: 0.3, N: 20 },
    PID: { Kp: 2, Ki: 1, Kd: 0.3, N: 20 },
    lead: { Kc: 2, T1: 0.5, alpha: 0.2 },
    lag: { Kc: 2, T2: 3, beta: 5 },
    leadlag: { Kc: 2, T1: 0.5, alpha: 0.2, T2: 3, beta: 5 },
    custom: {},
  };
  for (const [mode, g] of Object.entries(cfg)) {
    Object.assign(a.S, { plant: 'second', K: 1, zeta: 0.4, wn: 2, mode, refType: 'sine', R: 1, rPer: 4, Tsim: 200 }, g);
    const sm = defined(a.sineMetrics(a.simulate()));
    assert.ok(!sm.short, mode);
    assert.ok(Math.abs(defined(sm.ratio) / sm.ratioT - 1) < 0.01, `${mode}: ratio ${sm.ratio} vs ${sm.ratioT}`);
    assert.ok(near(defined(sm.phase), sm.phT, 1), `${mode}: phase ${sm.phase} vs ${sm.phT}`);
  }
});

test('a Bode range set by hand is used until the poles, zeros, dead time or simulation time change', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'first', K: 1, T: 1, mode: 'PI', Kp: 1, Ki: 0.5 });
  assert.equal(a.bodeRange(), null);
  a.S.wr = { on: true, lo: 0.05, hi: 500, sig: a.rangeSig() };
  const r = defined(a.bodeRange());
  assert.ok(near(r[0], Math.log10(0.05), 1e-12) && near(r[1], Math.log10(500), 1e-12));
  const fr = defined(a.bodeResp()),
    auto = a.freqResp();
  assert.ok(near(fr.W[0], 0.05, 1e-9) && near(fr.W[fr.W.length - 1], 500, 1e-6));
  assert.equal(fr.W.length, Math.round(150 * Math.log10(500 / 0.05)));
  // the margins of the automatic range do not depend on it
  assert.deepEqual([a.freqResp().pm, a.freqResp().w0], [auto.pm, auto.w0]);
  a.S.K = 3; // a gain moves no pole or zero
  assert.notEqual(a.bodeRange(), null);
  for (const change of [{ T: 2 }, { Ki: 0.8 }, { Tsim: 40 }]) {
    const b = fresh();
    Object.assign(b.S, a.S, { wr: { ...a.S.wr } }, change);
    assert.equal(b.bodeRange(), null, JSON.stringify(change));
    assert.equal(b.bodeResp(), null);
  }
  a.S.wr = { on: true, lo: 10, hi: 1, sig: a.rangeSig() }; // not a range
  assert.equal(a.bodeRange(), null);
});
