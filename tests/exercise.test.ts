// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Estimation exercise: the hidden plant of each exercise number (the same every time, within its ranges), its step
// response, and the check of the estimates
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, plain } from './harness.ts';

test('every exercise number gives the same plant every time, within the ranges, and different numbers differ', () => {
  const a = fresh(),
    seen = new Set<string>();
  for (let n = 1; n <= 300; n++) {
    const p = a.exercisePlant(n),
      q = a.exercisePlant(n);
    assert.deepEqual([p.K, p.T, p.L], [q.K, q.T, q.L]);
    assert.ok(p.K >= 0.5 && p.K <= 3 && p.T >= 0.5 && p.T <= 5 && p.L >= 0.1 && p.L <= Math.min(2, p.T) + 1e-9, `${n}`);
    seen.add(`${p.K} ${p.T} ${p.L}`);
  }
  assert.ok(seen.size > 290);
});

test('the step response and the check of the estimates', () => {
  const a = fresh(),
    p = { K: 2, T: 1.5, L: 0.4 };
  assert.equal(a.fopdtStep(p, 0.4), 0);
  // 63.2 % of K one time constant after the dead time
  assert.ok(Math.abs(a.fopdtStep(p, 0.4 + 1.5) - 2 * (1 - Math.exp(-1))) < 1e-12);
  const c = a.exerciseCheck(p, { K: 2.1, T: 1.8, L: 0.4 });
  assert.ok(Math.abs(c.err.K - 0.05) < 1e-12 && Math.abs(c.err.T - 0.2) < 1e-12 && c.err.L === 0);
  assert.deepEqual([c.ok.K, c.ok.T, c.ok.L], [true, false, true]);
});

test('frequency-response exercise: the same plant for the same number, within the ranges, each kind as often', () => {
  const a = fresh(),
    count: Record<string, number> = { lags: 0, dead: 0, second: 0 },
    N = 3000;
  for (let n = 1; n <= N; n++) {
    const p = a.freqExercisePlant(n),
      [K, x, y] = p.v;
    assert.deepEqual(plain(a.freqExercisePlant(n)), plain(p));
    count[p.kind]++;
    if (p.kind === 'lags') assert.ok(K >= 0.5 && K <= 5 && x >= 1 && x <= 10 && y >= x / 21 && y <= x / 4.7, `${n}`);
    else if (p.kind === 'dead')
      assert.ok(K >= 0.5 && K <= 3 && x >= 0.5 && x <= 5 && y >= 0.1 && y <= Math.min(2, x) + 1e-9);
    else assert.ok(K >= 0.5 && K <= 3 && x >= 0.5 && x <= 10 && y >= 0.1 && y <= 0.7 + 1e-9, `${n}`);
  }
  for (const k of ['lags', 'dead', 'second']) assert.ok(count[k] > N * 0.28, `${k}: ${count[k]}`);
});

test('frequency-response exercise: the gain and phase are those of the plant, and the check of the estimates', () => {
  const a = fresh(),
    cases = [
      [{ kind: 'lags', v: [2, 5, 0.4] }, 'custom', { cNum: [2], cDen: [2, 5.4, 1], L: 0 }],
      [{ kind: 'dead', v: [1.5, 2, 0.6] }, 'dead', { K: 1.5, T: 2, L: 0.6 }],
      [{ kind: 'second', v: [0.8, 3, 0.25] }, 'second', { K: 0.8, wn: 3, zeta: 0.25 }],
    ] as const;
  for (const [p, plant, par] of cases) {
    const tf = a.PLANTS[plant].tf({ ...a.S, ...par } as never);
    let prev = 0;
    for (const w of [0.01, 0.3, 1, 2.9, 3.1, 10, 50]) {
      // the rational part and the dead time e^{−jωL}
      const zr = a.evalPr(w, tf),
        dl = -w * (tf.L || 0),
        z = [zr[0] * Math.cos(dl) - zr[1] * Math.sin(dl), zr[0] * Math.sin(dl) + zr[1] * Math.cos(dl)],
        r = a.freqExResponse(p as never, w),
        db = 20 * Math.log10(Math.hypot(z[0], z[1])),
        // the principal value of the phase of the plant, compared modulo 360°
        d = ((((r.ph - (Math.atan2(z[1], z[0]) * 180) / Math.PI) % 360) + 540) % 360) - 180;
      assert.ok(Math.abs(r.db - db) < 1e-9 && Math.abs(d) < 1e-9, `${p.kind} at ${w}`);
      assert.ok(r.ph <= prev + 1e-9, `${p.kind}: the phase falls continuously`);
      prev = r.ph;
    }
  }
  // the second-order resonance peak 1/(2ζ√(1−ζ²)) near ωn
  const p2 = { kind: 'second', v: [1, 2, 0.2] } as never,
    peak = Math.max(...Array.from({ length: 2001 }, (_, i) => a.freqExResponse(p2, 1 + i / 1000).db));
  assert.ok(Math.abs(peak - 20 * Math.log10(1 / (2 * 0.2 * Math.sqrt(1 - 0.04)))) < 1e-4);
  // T1 and T2 in either order; L may not be swapped
  const lags = { kind: 'lags', v: [2, 5, 0.4] } as never,
    c = a.freqExCheck(lags, [2.1, 0.42, 6]);
  assert.deepEqual(plain(c.est), [2.1, 6, 0.42]);
  assert.deepEqual(plain(c.ok), [true, false, true]);
  assert.ok(Math.abs(c.err[1] - 0.2) < 1e-12);
  assert.deepEqual(plain(a.freqExCheck({ kind: 'dead', v: [1, 2, 0.5] } as never, [1, 0.5, 2]).ok), [
    true,
    false,
    false,
  ]);
  // the range: whole decades around the corners
  assert.deepEqual(plain(a.freqExRange(lags)), [0.01, 100]);
  assert.deepEqual(plain(a.freqExRange({ kind: 'second', v: [1, 3, 0.3] } as never)), [0.01, 1000]);
});
