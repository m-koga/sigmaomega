// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Nyquist stability criterion ================= */
import { cdiv, cmul, groupRoots, polyRoots, polyval } from './03-math.ts';
import { S } from './11-state.ts';
import { loopTFs } from './17-loop.ts';
import type { LoopTF } from './17-loop.ts';
/** Counting for the Nyquist criterion along the Nyquist contour (up the imaginary axis from −jW to +jW, around the
 *  poles of L(s) on the imaginary axis by small half circles on their right, closed by a large half circle on which
 *  L(s) is small): P open-loop poles in the right half-plane, N clockwise encirclements of −1 by L(s), Z = N + P
 *  closed-loop poles in the right half-plane (exact with a dead time). crossings: where L(s) crosses the real axis to
 *  the left of −1 (dir +1: clockwise, from below to above; w: the frequency, or arc: the pole on the imaginary axis
 *  whose half circle it is on); their sum is N. through: L(s) passes through −1 (closed-loop poles on the imaginary
 *  axis): N and Z are not defined */
export interface NyquistCount {
  P: number;
  rhp: Complex[];
  axis: { w: number; mult: number }[];
  N: number;
  Z: number;
  crossings: { x: number; w: number; arc: number | null; dir: number }[];
  through: boolean;
  delay: boolean;
}
// L(s) at a complex s: num(s) e^{−Ls} / den0(s)
function loopAt(g: LoopTF, s: Complex): Complex {
  const n = polyval(g.num, s),
    e: Complex = g.delay
      ? [Math.exp(-g.L * s[0]) * Math.cos(-g.L * s[1]), Math.exp(-g.L * s[0]) * Math.sin(-g.L * s[1])]
      : [1, 0];
  return cdiv(cmul(n, e), polyval(g.den0, s));
}
/** A piece s(t), t0 ≤ t ≤ t1, of the Nyquist contour; arc: ω of the pole it goes around, or null on the axis */
interface ContourPiece {
  f: (t: number) => Complex;
  t0: number;
  t1: number;
  arc: number | null;
}
// The Nyquist contour up to |ω| = W: the imaginary axis between half circles of radius ε to the right of the poles
// on the axis (ws: their ω), the axis as ω = c sinh t (dense near 0 and spread over decades)
function nyquistContour(ws: number[], sing: Complex[], c: number, W: number): ContourPiece[] {
  const eps = ws.map(w =>
    Math.min(
      1e-4 * (1 + Math.abs(w)),
      ...sing
        .map(z => Math.hypot(z[0], z[1] - w))
        .filter(d => d > 1e-9)
        .map(d => d / 10),
    ),
  );
  const axis = (a: number, b: number): ContourPiece => ({
    f: t => [0, c * Math.sinh(t)],
    t0: Math.asinh(a / c),
    t1: Math.asinh(b / c),
    arc: null,
  });
  const pieces: ContourPiece[] = [];
  let from = -W;
  ws.forEach((w, i) => {
    pieces.push(axis(from, w - eps[i]));
    pieces.push({
      f: t => [eps[i] * Math.cos(t), w + eps[i] * Math.sin(t)],
      t0: -Math.PI / 2,
      t1: Math.PI / 2,
      arc: w,
    });
    from = w + eps[i];
  });
  pieces.push(axis(from, W));
  return pieces;
}
// Follow 1 + L(s) along the contour, refining where its angle changes by more than 0.2 rad between samples: the
// total angle, whether the contour passes through a closed-loop pole, and the crossings of L to the left of −1
function followNyquist(g: LoopTF, pieces: ContourPiece[]) {
  let theta = 0,
    through = false;
  const crossings: NyquistCount['crossings'] = [];
  const arg = (z: Complex) => Math.atan2(z[1], z[0]);
  for (const pc of pieces) {
    const at = (t: number) => {
      const s = pc.f(t),
        l = loopAt(g, s);
      return { t, s, l, a: arg([1 + l[0], l[1]]) };
    };
    type Pt = ReturnType<typeof at>;
    // a crossing of the real axis to the left of −1 (1 + L crosses the negative real axis), found by bisection
    const crossing = (p: Pt, q: Pt) => {
      let lo = p,
        hi = q;
      for (let i = 0; i < 60 && hi.l[1] !== 0; i++) {
        const mid = at((lo.t + hi.t) / 2);
        if (mid.t === lo.t || mid.t === hi.t) break;
        if (Math.sign(mid.l[1]) === Math.sign(lo.l[1])) lo = mid;
        else hi = mid;
      }
      const u = lo.l[1] === hi.l[1] ? 0 : lo.l[1] / (lo.l[1] - hi.l[1]),
        x = lo.l[0] + u * (hi.l[0] - lo.l[0]);
      if (x < -1) crossings.push({ x, w: lo.s[1] + u * (hi.s[1] - lo.s[1]), arc: pc.arc, dir: p.l[1] < 0 ? 1 : -1 });
    };
    const step = (p: Pt, q: Pt, depth: number) => {
      let d = q.a - p.a;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      if (Math.abs(d) > 0.2 && depth < 40) {
        const mid = at((p.t + q.t) / 2);
        step(p, mid, depth + 1);
        step(mid, q, depth + 1);
        return;
      }
      if (Math.abs(d) > 0.2) through = true; // the angle jumps however finely sampled: 1 + L(s) = 0 on the contour
      theta += d;
      if ((p.l[1] < 0 && q.l[1] >= 0) || (p.l[1] > 0 && q.l[1] <= 0)) crossing(p, q);
    };
    const n = 400,
      pts = Array.from({ length: n + 1 }, (_, i) => at(pc.t0 + ((pc.t1 - pc.t0) * i) / n));
    for (let i = 0; i < n; i++) step(pts[i], pts[i + 1], 0);
  }
  return { theta, through, crossings };
}
// The Nyquist stability criterion for the loop: P open-loop poles in the right half-plane, N clockwise
// encirclements of −1, Z = N + P closed-loop poles there (null without a loop: the controller gain is zero)
export function nyquistCount(st: State = S): NyquistCount | null {
  const g = loopTFs(st).L;
  if (g.num.every(v => v === 0)) return null;
  const poles = groupRoots(polyRoots(g.den0)),
    zeros = polyRoots(g.num),
    size = Math.max(1, ...poles.map(p => Math.hypot(p.z[0], p.z[1])), ...zeros.map(z => Math.hypot(z[0], z[1]))),
    tolRe = 1e-7 * size,
    rhp = poles.filter(p => p.z[0] > tolRe).flatMap(p => Array<Complex>(p.mult).fill(p.z)),
    onAxis = poles.filter(p => Math.abs(p.z[0]) <= tolRe),
    axis = onAxis.filter(p => p.z[1] >= 0).map(p => ({ w: p.z[1], mult: p.mult }));
  const c =
      1e-3 * Math.min(1, ...poles.concat(zeros.map(z => ({ z, mult: 1 }))).map(p => Math.hypot(p.z[0], p.z[1]) || 1)),
    contour = nyquistContour(
      onAxis.map(p => p.z[1]).sort((a, b) => a - b),
      [...poles.map(p => p.z), ...zeros],
      c,
      1e4 * size,
    );
  const { theta, through, crossings } = followNyquist(g, contour);
  const N = Math.round(-theta / (2 * Math.PI)) + 0;
  return { P: rhp.length, rhp, axis, N, Z: N + rhp.length, crossings, through, delay: g.delay };
}
