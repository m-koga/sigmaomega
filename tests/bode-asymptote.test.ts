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
