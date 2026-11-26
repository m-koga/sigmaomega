// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Construction rules of the root locus (the pole-zero map option and its "Locus rules" tab): each rule is checked
// against the root locus itself, the roots of D(s) + k N(s)
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh } from './harness.ts';

type C = [number, number];
const CASES: Record<string, unknown>[] = [
  { plant: 'third', mode: 'P', Kp: 1 }, // triple pole
  { plant: 'integ', mode: 'P', Kp: 1 }, // breakaway at −0.5
  { plant: 'second', zeta: 0.3, wn: 1, mode: 'PI', Kp: 1, Ki: 1 }, // departure angles, crossing
  { plant: 'integ', mode: 'PD', Kp: 1, Kd: 0.5 }, // breakaway, break-in, breakaway
  { plant: 'first', mode: 'PID', Kp: 2, Ki: 1, Kd: 0.2 },
  { plant: 'dead', L: 0.5, mode: 'PI', Kp: 1, Ki: 1 }, // Padé: 0° locus, complex zeros (arrival angles)
  { plant: 'unstable', mode: 'P', Kp: 1 }, // crossing at s = 0
  { plant: 'third', mode: 'lead' }, // a cancelled pole-zero pair
];
const ang = (z: C) => (Math.atan2(z[1], z[0]) * 180) / Math.PI;
const dAng = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

test('construction rules agree with the roots of D(s) + k N(s)', () => {
  for (const set of CASES) {
    const a = fresh();
    Object.assign(a.S, set);
    const r = a.locusRules()!,
      { num, den } = a.loopRational(),
      roots = (k: number): C[] => a.polyRoots(a.pAddDesc(den, a.pScale(num, k))),
      val = (p: number[], z: C): C => a.polyval(p, z),
      tag = JSON.stringify(set);
    assert.equal(r.n, den.length - 1, tag);
    // real axis: k = −D(x)/N(x) is positive on the segments and negative off them
    const kx = (x: number) => -val(den, [x, 0])[0] / val(num, [x, 0])[0];
    for (let x = -30; x <= 30; x += 0.37) {
      const on = r.segments.some(([lo, hi]: [number, number]) => x > lo && x < hi),
        k = kx(x);
      if (Math.abs(k) > 1e-9 && isFinite(k)) assert.equal(k > 0, on, `${tag} x = ${x}`);
    }
    // asymptotes: for a large k, the n − m far roots lie along them
    const q = r.n - r.m;
    if (q > 0) {
      const big = 10 * (1 + Math.max(...[...r.poles, ...r.zeros].map((z: C) => Math.hypot(z[0], z[1])))),
        far = roots(1e8)
          .filter((z: C) => Math.hypot(z[0], z[1]) > big)
          .map((z: C) => [z[0] - r.centroid!, z[1]] as C);
      assert.equal(far.length, q, tag);
      far.forEach((z: C) =>
        assert.ok(
          r.asymAngles.some((t: number) => dAng(ang(z), t) < 3),
          `${tag} asymptote ${ang(z)}`,
        ),
      );
    }
    // breakaway and break-in points: a double root of D + k N at that k
    for (const b of r.breakaway) {
      const p = a.pAddDesc(den, a.pScale(num, b.k)),
        f = val(p, b.s),
        size = Math.max(...p.map(Math.abs)) * (1 + Math.hypot(b.s[0], b.s[1])) ** (p.length - 1);
      assert.ok(Math.hypot(f[0], f[1]) < 1e-8 * size, `${tag} breakaway ${b.s}`);
      assert.ok(
        roots(b.k).filter((z: C) => Math.hypot(z[0] - b.s[0], z[1] - b.s[1]) < 1e-3 * (1 + Math.abs(b.s[0]))).length >=
          2,
        `${tag} double root at ${b.s}`,
      );
    }
    // imaginary-axis crossings: a root at jω for that k
    for (const c of r.crossings)
      assert.ok(
        roots(c.k).some((z: C) => Math.hypot(z[0], z[1] - c.w) < 1e-5 * (1 + c.w)),
        `${tag} crossing ω = ${c.w}`,
      );
    // departure angles: for a small k, the roots near the pole leave it in those directions; arrival angles: for a
    // large k, the roots near the zero approach it from those directions
    const check = (list: { at: C; mult: number; angles: number[] }[], k: number, what: string) =>
      list.forEach(d => {
        const near = roots(k)
          .filter((z: C) => {
            const dz = Math.hypot(z[0] - d.at[0], z[1] - d.at[1]);
            return dz > 1e-9 && dz < 0.05 * (1 + Math.hypot(d.at[0], d.at[1]));
          })
          .map((z: C) => ang([z[0] - d.at[0], z[1] - d.at[1]]));
        d.angles.forEach((t: number) =>
          assert.ok(
            near.some((x: number) => dAng(x, t) < 4),
            `${tag} ${what} at ${d.at}: ${t} (${near})`,
          ),
        );
      });
    check(r.departures, 1e-6, 'departure');
    check(r.arrivals, 1e7, 'arrival');
  }
});

test('construction rules: textbook examples', () => {
  const a = fresh();
  // 1/(s+1)³ with P control: three asymptotes at ±60° and 180° from −1, crossing at ±j√3 for k = 8
  Object.assign(a.S, { plant: 'third', K: 1, T: 1, mode: 'P', Kp: 1 });
  let r = a.locusRules()!;
  assert.deepEqual(
    [...r.asymAngles].sort((x: number, y: number) => x - y),
    [-60, 60, 180],
  );
  assert.ok(Math.abs(r.centroid! + 1) < 1e-6);
  assert.equal(r.crossings.length, 1);
  assert.ok(Math.abs(r.crossings[0].w - Math.sqrt(3)) < 1e-9 && Math.abs(r.crossings[0].k - 8) < 1e-9);
  assert.equal(r.segments.length, 1);
  assert.equal(r.segments[0][0], -Infinity);
  // 1/(s(s+1)) with P control: the real axis between −1 and 0, breakaway at −0.5 for k = 0.25
  Object.assign(a.S, { plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 1 });
  a.resetLoopCache();
  r = a.locusRules()!;
  assert.deepEqual(
    Array.from(r.segments, (s: number[]) => [...s]),
    [[-1, 0]],
  );
  assert.equal(r.breakaway.length, 1);
  assert.ok(Math.abs(r.breakaway[0].s[0] + 0.5) < 1e-9 && Math.abs(r.breakaway[0].k - 0.25) < 1e-9);
  assert.equal(r.breakaway[0].kind, 'breakaway');
  // with a dead time: the Padé approximation has numerator and denominator leading coefficients of opposite sign
  Object.assign(a.S, { plant: 'dead', L: 0.5, mode: 'PI', Kp: 1, Ki: 1 });
  r = a.locusRules()!;
  assert.equal(r.sign, -1);
  assert.ok(r.approx);
});
