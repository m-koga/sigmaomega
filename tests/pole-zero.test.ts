// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Poles and zeros: closed-loop poles, stability, root locus, design region
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, near, defined } from './harness.ts';

test('closed-loop poles: first-order lag + PID gives the roots of s³+27s²+61s+20', () => {
  const a = fresh();
  const cl = a.computePZ().cl;
  assert.equal(cl.length, 3);
  const sum = cl.reduce((s, z) => s + z[0], 0);
  const prod = cl.reduce((p, z) => p * Math.hypot(z[0], z[1]), 1);
  assert.ok(near(sum, -27, 1e-6) && near(prod, 20, 1e-6), `sum ${sum}, product ${prod}`);
});

test('closed-loop poles: 1/(s(s+1)) with lead 2(s+1)/(0.1s+1) gives −1, −2.764, −7.236', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'integ', K: 1, T: 1, mode: 'lead', Kc: 2, T1: 1, alpha: 0.1 });
  const re = a
    .computePZ()
    .cl.map(z => z[0])
    .sort((x, y) => y - x);
  [-1, -2.7639, -7.2361].forEach((v, i) => assert.ok(near(re[i], v, 1e-3), `${re[i]} ≠ ${v}`));
});

test('dead time: the dominant closed-loop pole nearly satisfies the exact characteristic equation 1 + L(s) = 0', () => {
  // P(s) = e^{-0.5s}/(s+1), C = 1. Substitute the dominant pole found with the Padé approximation into the exact expression with e^{-Ls}
  const a = fresh();
  Object.assign(a.S, { plant: 'dead', K: 1, T: 1, L: 0.5, mode: 'P', Kp: 1 });
  const cl = a.computePZ().cl;
  const dom = cl.reduce((b, z) => (z[0] > b[0] ? z : b));
  const [x, y] = dom,
    L = 0.5;
  const ex = Math.exp(-L * x),
    er = ex * Math.cos(-L * y),
    ei = ex * Math.sin(-L * y); // e^{-Ls}
  const dr = x + 1,
    di = y,
    q = dr * dr + di * di; // ÷ (s+1)
  const res = Math.hypot(1 + (er * dr + ei * di) / q, (ei * dr - er * di) / q);
  assert.ok(res < 1e-3, `|1+L(p)| = ${res} (dominant pole ${dom})`);
});

test('stability: an unstable first-order plant is unstable with small K_P and stable with large K_P', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'unstable', mode: 'P', K: 1, T: 1, Kp: 0.5 });
  assert.ok(a.computePZ().cl.some(z => z[0] > 0));
  a.S.Kp = 2;
  assert.ok(a.computePZ().cl.every(z => z[0] < 0));
});

test('root locus: for 1/(s(s+1)) with K_P = 1 the poles at gain factor k are the roots of s² + s + k', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 1 });
  const loc = a.rootLocus([0.1, 0.25, 1, 4]);
  for (const { k, r } of loc) {
    const d = 1 - 4 * k; // s = (-1 ± √(1-4k)) / 2
    const want =
      d >= 0
        ? [
            [(-1 + Math.sqrt(d)) / 2, 0],
            [(-1 - Math.sqrt(d)) / 2, 0],
          ]
        : [
            [-0.5, Math.sqrt(-d) / 2],
            [-0.5, -Math.sqrt(-d) / 2],
          ];
    for (const w of want)
      assert.ok(
        r.some(z => Math.hypot(z[0] - w[0], z[1] - w[1]) < 1e-4),
        `k=${k}: ${JSON.stringify(r)} lacks ${w}`,
      );
  }
});

test('root locus: the poles at k = 1 equal the closed-loop poles', () => {
  const a = fresh();
  const at1 = a.rootLocus(JSON.parse(JSON.stringify(a.LOCUS_KS))).find(e => e.k === 1)!.r;
  const cl = a.computePZ().cl;
  for (const z of cl)
    assert.ok(
      at1.some(q => Math.hypot(q[0] - z[0], q[1] - z[1]) < 1e-6),
      JSON.stringify([at1, cl]),
    );
});

test('root locus: 1/(s+1)³ with K_P = 1 is stable for 0 < k < 8, matching the gain margin', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'third', K: 1, T: 1, mode: 'P', Kp: 1 });
  const rs = a.stableRanges();
  assert.equal(rs.length, 1);
  assert.equal(rs[0][0], 0);
  assert.ok(near(rs[0][1], 8, 1e-6), `upper limit ${rs[0][1]}`);
  assert.ok(near(defined(a.freqResp().gm), 20 * Math.log10(8), 0.05), `GM ${a.freqResp().gm}`);
});

test('root locus: the unstable plant 1/(s−1) with K_P = 1 is stable for k > 1', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'unstable', K: 1, T: 1, mode: 'P', Kp: 1 });
  const rs = a.stableRanges();
  assert.equal(rs.length, 1);
  assert.ok(near(rs[0][0], 1, 1e-6) && rs[0][1] === Infinity, JSON.stringify(rs));
});

test('applying a gain factor k from the root locus multiplies the controller gains by k', () => {
  const a = fresh();
  Object.assign(a.S, { mode: 'PID', Kp: 2, Ki: 1, Kd: 0.2 });
  a.applyLoopGain(2.5);
  assert.deepEqual([a.S.Kp, a.S.Ki, a.S.Kd], [5, 2.5, 0.5]);
  Object.assign(a.S, { mode: 'lead', Kc: 2 });
  a.applyLoopGain(3);
  assert.equal(a.S.Kc, 6);
});

test('design region: ζ ≥ 0.5 on 1/(s(s+1)) with P control holds for 0 < k ≤ 1', () => {
  const a = fresh();
  Object.assign(a.S, { plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 1 });
  for (const k of a.SPEC_KEYS) a.S.spec[k].on = false;
  a.S.spec.zeta = { on: true, v: 0.5 };
  const reg = defined(a.poleRegion());
  assert.ok(near(reg.zmin, 0.5, 1e-12) && reg.smin === 0, JSON.stringify(reg));
  const rr = JSON.parse(JSON.stringify(a.specKRanges(a.rootLocus(JSON.parse(JSON.stringify(a.LOCUS_KS))), reg)));
  assert.equal(rr.length, 1);
  assert.equal(rr[0][0], 0);
  assert.ok(near(rr[0][1], 1, 0.03), `upper limit ${rr[0][1]}`); // ζ = 1/(2√k)
  // adding settling time 8 s requires −Re ≥ 0.5 → the double pole at k = 0.25 and beyond
  a.S.spec.ts = { on: true, v: 8 };
  const r2 = JSON.parse(
    JSON.stringify(a.specKRanges(a.rootLocus(JSON.parse(JSON.stringify(a.LOCUS_KS))), defined(a.poleRegion()))),
  );
  assert.equal(r2.length, 1);
  assert.ok(near(r2[0][0], 0.25, 0.01) && near(r2[0][1], 1, 0.03), JSON.stringify(r2));
});

test('design region: the overshoot specification gives ζ = −ln(OS)/√(π²+ln²OS)', () => {
  const a = fresh();
  for (const k of ['ts', 'zeta'] as const) a.S.spec[k].on = false;
  a.S.spec.os = { on: true, v: 16.3 };
  assert.ok(near(defined(a.poleRegion()).zmin, 0.5, 1e-3), String(defined(a.poleRegion()).zmin));
  a.S.spec.os.on = false;
  assert.equal(a.poleRegion(), null);
});
