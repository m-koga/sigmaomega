// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Nichols chart: the M contours of the closed loop |T| = |L/(1 + L)|, and the chart's curve as the gain and phase of L
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh } from './harness.ts';

test('every point of an M contour has |L/(1 + L)| = M', () => {
  const a = fresh(),
    phs: number[] = [];
  for (let p = -540; p <= 180; p += 3.7) phs.push(p);
  for (const m of a.M_CONTOURS as number[]) {
    const c = a.mContour(m, phs);
    let n = 0;
    for (const branch of [c.lo, c.hi])
      branch.forEach((db: number, i: number) => {
        if (!isFinite(db)) return;
        n++;
        const r = Math.pow(10, db / 20),
          t = (phs[i] * Math.PI) / 180,
          L = [r * Math.cos(t), r * Math.sin(t)],
          T = Math.hypot(L[0], L[1]) / Math.hypot(1 + L[0], L[1]);
        assert.ok(Math.abs(20 * Math.log10(T) - m) < 1e-9, `M = ${m} dB at ${phs[i]}°`);
      });
    assert.ok(n > 0, `M = ${m} dB has points`);
  }
  // M > 0 dB: closed curves around the critical point (two branches at −180°, none far from it)
  const c6 = a.mContour(6, [-180, -60]);
  assert.ok(isFinite(c6.lo[0]) && isFinite(c6.hi[0]) && c6.hi[0] > c6.lo[0]);
  assert.ok(!isFinite(c6.lo[1]) && !isFinite(c6.hi[1]));
  // M = 0 dB: r = −1/(2 cos φ), i.e. −6.02 dB at −180°
  assert.ok(Math.abs(a.mContour(0, [-180]).lo[0] + 20 * Math.log10(2)) < 1e-9);
});

test('the Nichols chart touches the M contour of the resonance peak Mt', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'second', zeta: 0.3, wn: 1, mode: 'PI', Kp: 1, Ki: 0.3 });
  const fr = a.freqResp(),
    mt = 20 * Math.log10(fr.mt!);
  // the largest closed-loop gain along the curve, from its phase and gain, is Mt
  let best = -Infinity;
  fr.ph.forEach((p: number, i: number) => {
    const r = Math.pow(10, fr.mag[i] / 20),
      t = (p * Math.PI) / 180;
    best = Math.max(best, 20 * Math.log10(r / Math.hypot(1 + r * Math.cos(t), r * Math.sin(t))));
  });
  assert.ok(Math.abs(best - mt) < 0.01, `${best} / ${mt}`);
});
