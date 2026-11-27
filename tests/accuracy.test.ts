// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Numerical accuracy (ACCURACY.md): the results stay within the bounds stated there, against exact solutions or
// independent references (scripts/accuracy.ts, which prints the full tables)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASYM_CASES,
  CLOSED_CASES,
  NYQ_PLANTS,
  RULE_CASES,
  STABLE_K_CASES,
  STEADY_CASES,
  asymptoteCase,
  closedLoopCase,
  nyquistAgreement,
  rangeError,
  rulesCase,
  rulesError,
  stableKCase,
  steadyCase,
  DEAD_CASES,
  FREQ_CASES,
  TIME_CASES,
  deadCase,
  discretizationError,
  freqCase,
  padeCase,
  pMul,
  rootError,
  sineCase,
  timeCase,
} from '../scripts/accuracy.ts';

const rel = (a: number | null | undefined, b: number | null | undefined) =>
  a === null || a === undefined || b === null || b === undefined
    ? a === b
      ? 0
      : Infinity
    : Math.abs(a - b) / Math.abs(b);
const pick = <T>(cases: [string, T][], names: string[]) => cases.filter(([n]) => names.includes(n));

test('time response: within 0.3 % of the exact closed loop; metrics within 0.2 % (overshoot 0.1 point)', () => {
  for (const [name, set] of pick(TIME_CASES, [
    '1st-order lag + PI',
    '3rd-order lag + PID, N = 100',
    '3rd-order lag + PID, fast',
    '3rd-order lag + lead',
  ])) {
    const r = timeCase(set);
    assert.ok(r.rel < 3e-3, `${name}: error ${r.rel}`);
    assert.ok(Math.abs((r.got?.os ?? 0) - r.ref.os) < 0.1, `${name}: overshoot ${r.got?.os} / ${r.ref.os}`);
    assert.ok(rel(r.got?.rise, r.ref.rise) < 2e-3, `${name}: rise ${r.got?.rise} / ${r.ref.rise}`);
    assert.ok(rel(r.got?.ts, r.ref.ts) < 2e-3, `${name}: settling ${r.got?.ts} / ${r.ref.ts}`);
  }
});

test('dead time not a whole number of substeps is not rounded; PID with dead time within 0.2 %', () => {
  for (const [name, set] of pick(DEAD_CASES, ['L = 0.537 (not a whole number), P', 'Exercise 3: L = 0.5, PID'])) {
    const r = deadCase(set);
    assert.ok(r.err < 2e-3, `${name}: error ${r.err}`);
    assert.ok(Math.abs((r.got?.os ?? 0) - r.ref.os) < 0.1, `${name}: overshoot ${r.got?.os} / ${r.ref.os}`);
  }
});

test('frequency response: phase margin within 0.02°, gain margin within 0.001 dB, Ms within 1e-6', () => {
  for (const [name, set] of FREQ_CASES) {
    const { got, ref } = freqCase(set);
    assert.ok(Math.abs(got.pm! - ref.pm!) < 0.02, `${name}: PM ${got.pm} / ${ref.pm}`);
    if (ref.gm !== null) assert.ok(Math.abs(got.gm! - ref.gm) < 1e-3, `${name}: GM ${got.gm} / ${ref.gm}`);
    assert.ok(rel(got.ms, ref.ms) < 1e-6, `${name}: Ms ${got.ms} / ${ref.ms}`);
  }
});

test('discretization, roots and the Padé approximation', () => {
  for (const n of [1, 3, 10]) assert.ok(discretizationError(n) < 1e-12, `1/(s+1)^${n}`);
  let p = [1];
  const ex: [number, number][] = [];
  for (let i = 1; i <= 10; i++) {
    p = pMul(p, [1, i]);
    ex.push([-i, 0]);
  }
  assert.ok(rootError(p, ex) < 1e-9, 'distinct roots');
  assert.ok(rootError(pMul(pMul([1, 1], [1, 1]), [1, 1]), [[-1, 0]]) < 5e-5, 'triple root');
  for (const [L, Kp] of [
    [0.5, 1],
    [3, 0.5],
  ])
    assert.ok(padeCase(L, Kp).err < 2e-3, `Padé L = ${L}`);
});

test('sine reference: amplitude ratio within 1 %, phase difference within 0.5°', () => {
  for (const [Tp, Tsim] of [
    [5, 40],
    [0.3, 10],
  ]) {
    const r = sineCase(Tp, Tsim);
    assert.ok(Math.abs(r.ratio) < 0.01 && Math.abs(r.phase) < 0.5, `period ${Tp}: ${r.ratio}, ${r.phase}°`);
  }
});

test('closed-loop frequency response: Mt and max|Gyd| within 1e-5, the bandwidth within 2e-4 (relative)', () => {
  for (const [name, set] of CLOSED_CASES) {
    const { got, ref } = closedLoopCase(set);
    assert.ok(rel(got.mt, ref.mt) < 1e-5, `${name}: Mt ${got.mt} / ${ref.mt}`);
    assert.ok(rel(got.wbw, ref.wbw) < 2e-4, `${name}: bandwidth ${got.wbw} / ${ref.wbw}`);
    assert.ok(rel(got.dmax, ref.dmax) < 1e-5, `${name}: max|Gyd| ${got.dmax} / ${ref.dmax}`);
  }
});

test('stable range of k: Routh–Hurwitz within 1e-9 and the root locus within 1e-6 of the exact boundaries; 2e-3 with the Padé approximation of a dead time', () => {
  for (const [name, set] of STABLE_K_CASES) {
    const r = stableKCase(set);
    assert.ok(rangeError(r.routh, r.ref) < (r.approx ? 2e-3 : 1e-9), `${name}: Routh ${JSON.stringify(r.routh)}`);
    assert.ok(rangeError(r.locus, r.ref) < (r.approx ? 2e-3 : 1e-6), `${name}: locus ${JSON.stringify(r.locus)}`);
  }
});

test('steady-state error: the system type, the error constant and the errors equal the exact values', () => {
  for (const [name, set, ex] of STEADY_CASES) {
    const r = steadyCase(set);
    assert.equal(r.type, ex.type, name);
    assert.ok(Math.abs(r.K - ex.K) < 1e-9 && Math.abs(r.e - ex.e) < 1e-9, `${name}: ${r.K}, ${r.e}`);
    assert.ok(Math.abs(r.dist - ex.dist) < 1e-9, `${name}: disturbance ${r.dist}`);
  }
});

test('Nyquist criterion: Z = N + P equals the closed-loop poles in the right half-plane in every case', () => {
  for (const [name, set] of NYQ_PLANTS) {
    const r = nyquistAgreement(set);
    assert.equal(r.agree, r.cases, name);
    assert.ok(r.cases >= 20, `${name}: ${r.cases} cases`);
  }
});

test('Bode asymptotes: break frequencies within 1e-6 (relative), gain and phase asymptotes within 1e-4', () => {
  for (const [name, set, ex] of ASYM_CASES) {
    const r = asymptoteCase(set, ex);
    assert.ok(r.eb < 1e-6 && r.eg < 1e-4 && r.ep < 1e-4, `${name}: ${r.eb}, ${r.eg} dB, ${r.ep}°`);
  }
});

test('root-locus rules: centroid, breakaway points, imaginary-axis crossings and departure angles within 1e-9', () => {
  for (const [name, set, ex] of RULE_CASES) assert.ok(rulesError(rulesCase(set), ex) < 1e-9, name);
});
