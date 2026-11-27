// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Straight-line (asymptotic) approximation of the Bode gain of L(jω): the slopes, the break frequencies, the gap to
// the true gain at the breaks, and the agreement far from the breaks
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh } from './harness.ts';

const db = (a: ReturnType<typeof fresh>, w: number) => {
  const v = a.evalLoopTF(a.loopTFs().L, w);
  return 20 * Math.log10(Math.hypot(v[0], v[1]));
};

test('the asymptotes meet the true gain far from every break frequency; the last slope is −20(n − m) dB/dec', () => {
  for (const set of [
    { plant: 'first', mode: 'P', Kp: 2 },
    { plant: 'second', zeta: 0.2, wn: 2, mode: 'PI', Kp: 1, Ki: 0.5 },
    { plant: 'third', mode: 'PID', Kp: 2, Ki: 0.5, Kd: 1 },
    { plant: 'integ', mode: 'PD', Kp: 1, Kd: 0.5 },
    { plant: 'dead', L: 0.5, mode: 'PI', Kp: 1, Ki: 1 },
    { plant: 'third', mode: 'lead' },
    { plant: 'unstable', mode: 'P', Kp: 2 },
  ] as Record<string, unknown>[]) {
    const a = fresh();
    Object.assign(a.S, set);
    const as = a.bodeAsymptote()!,
      tag = JSON.stringify(set),
      ws = as.breaks.map((b: { w: number }) => b.w),
      lo = (ws[0] ?? 1) / 1e3,
      hi = (ws[ws.length - 1] ?? 1) * 1e3;
    for (const w of [lo, hi]) assert.ok(Math.abs(db(a, w) - as.gain(w)) < 0.05, `${tag} at ω = ${w}`);
    const g = a.loopTFs().L,
      nm = g.den0.length - g.num.length;
    assert.equal(as.breaks.length ? as.breaks[as.breaks.length - 1].slope : -20 * as.q, -20 * nm, tag);
  }
});

test('Bode asymptotes: textbook examples', () => {
  const a = fresh();
  // K/(Ts + 1) with P control: 20 log10(KP K) flat, one break at 1/T to −20 dB/dec, 3 dB below at the break
  Object.assign(a.S, { plant: 'first', K: 1, T: 0.5, mode: 'P', Kp: 2 });
  let as = a.bodeAsymptote()!;
  assert.equal(as.q, 0);
  assert.ok(Math.abs(as.K - 2) < 1e-12);
  assert.equal(as.breaks.length, 1);
  assert.ok(Math.abs(as.breaks[0].w - 2) < 1e-9);
  assert.equal(as.breaks[0].slope, -20);
  assert.ok(Math.abs(db(a, 2) - as.gain(2) + 3.0103) < 1e-3);
  // a complex pair (ζ = 0.2, ωn = 2): −40 dB/dec at ωn, the true gain −20 log10(2ζ) = 7.96 dB above there
  Object.assign(a.S, { plant: 'second', zeta: 0.2, wn: 2, K: 1, mode: 'P', Kp: 1 });
  as = a.bodeAsymptote()!;
  assert.equal(as.breaks.length, 1);
  assert.equal(as.breaks[0].dSlope, -40);
  assert.ok(Math.abs(db(a, 2) - as.gain(2) + 20 * Math.log10(0.4)) < 1e-6);
  // integrator: −20 dB/dec from the start
  Object.assign(a.S, { plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 1 });
  as = a.bodeAsymptote()!;
  assert.equal(as.q, 1);
  assert.equal(as.breaks[0].slope, -40);
});

test('the phase approximation meets the true phase far from the breaks (also with a dead time); textbook values', () => {
  const ph = (a: ReturnType<typeof fresh>, w: number) => {
    const v = a.evalLoopTF(a.loopTFs().L, w);
    return (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  };
  const dAng = (x: number, y: number) => Math.abs(((x - y + 540) % 360) - 180);
  for (const set of [
    { plant: 'first', mode: 'P', Kp: 2 },
    { plant: 'second', zeta: 0.2, wn: 2, mode: 'PI', Kp: 1, Ki: 0.5 },
    { plant: 'third', mode: 'PID', Kp: 2, Ki: 0.5, Kd: 1 },
    { plant: 'dead', L: 0.5, mode: 'PI', Kp: 1, Ki: 1 },
    { plant: 'unstable', mode: 'P', Kp: 2 },
    { plant: 'third', mode: 'lead' },
  ] as Record<string, unknown>[]) {
    const a = fresh();
    Object.assign(a.S, set);
    const as = a.bodeAsymptote()!,
      ws = as.breaks.map((b: { w: number }) => b.w);
    for (const w of [ws[0] / 1e3, ws[ws.length - 1] * 1e3])
      assert.ok(dAng(ph(a, w), as.phase(w)) < 1, `${JSON.stringify(set)} at ω = ${w}: ${ph(a, w)} / ${as.phase(w)}`);
  }
  // K/(Ts + 1): 0° up to ω_b/10, −45° at ω_b (exact there), −90° from 10ω_b
  const a = fresh();
  Object.assign(a.S, { plant: 'first', K: 1, T: 0.5, mode: 'P', Kp: 2 });
  const as = a.bodeAsymptote()!;
  assert.ok(Math.abs(as.phase(0.2)) < 1e-9 && Math.abs(as.phase(2) + 45) < 1e-9 && Math.abs(as.phase(20) + 90) < 1e-9);
  assert.ok(Math.abs(ph(a, 2) + 45) < 1e-9);
});

test('the lines of the factors add up to the asymptotes of the gain and the phase', () => {
  for (const set of [
    { plant: 'second', zeta: 0.2, wn: 2, mode: 'PI', Kp: 1, Ki: 0.5 },
    { plant: 'dead', L: 0.5, mode: 'PID', Kp: 1, Ki: 1, Kd: 0.2 },
    { plant: 'third', mode: 'lead' },
    { plant: 'unstable', mode: 'P', Kp: 2 },
  ] as Record<string, unknown>[]) {
    const a = fresh();
    Object.assign(a.S, set);
    const as = a.bodeAsymptote()!;
    // K/s^q first, then one line per distinct pole and zero, and the dead time when there is one
    assert.equal(as.parts[0].kind, 'K');
    assert.equal(as.parts.filter((p: { kind: string }) => p.kind === 'delay').length, set.plant === 'dead' ? 1 : 0);
    for (const w of [1e-3, 0.3, 1, 2, 7, 50, 1e3]) {
      const g = as.parts.reduce((v: number, p: { gain: (w: number) => number }) => v + p.gain(w), 0),
        ph = as.parts.reduce((v: number, p: { phase: (w: number) => number }) => v + p.phase(w), 0);
      assert.ok(
        Math.abs(g - as.gain(w)) < 1e-9 && Math.abs(ph - as.phase(w)) < 1e-9,
        `${JSON.stringify(set)} ω = ${w}`,
      );
    }
  }
  // 10/(s(s + 1)): the lines 10/s (−20 dB/dec through 20 dB at ω = 1, −90°) and the pole −1 (0 dB, then −20 dB/dec)
  const a = fresh();
  Object.assign(a.S, { plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 10 });
  const [k, p] = a.bodeAsymptote()!.parts;
  assert.ok(Math.abs(k.gain(1) - 20) < 1e-9 && Math.abs(k.gain(10)) < 1e-9 && k.phase(5) === -90);
  assert.ok(
    p.gain(0.5) === 0 && Math.abs(p.gain(10) + 20) < 1e-9 && p.phase(0.1) === 0 && Math.abs(p.phase(1) + 45) < 1e-9,
  );
});
