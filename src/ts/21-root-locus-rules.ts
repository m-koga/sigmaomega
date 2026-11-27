// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Construction rules of the root locus ================= */
import { cdiv, groupRoots, lastOf, pAddDesc, pMul, pScale, polyRoots, polyval, trimPoly } from './03-math.ts';
import { S } from './11-state.ts';
import { loopRational } from './17-loop.ts';
/** The rules for sketching the root locus of D(s) + k N(s) = 0 (k > 0) with L(s) = N(s)/D(s) as in rootLocus:
 *  n poles and m zeros of L; sign: the sign of the leading coefficients of N/D (negative: the 0° locus, where the
 *  angle condition is 0° instead of 180°); the real-axis segments; the n − m asymptotes (angles [°] and centroid);
 *  the breakaway and break-in points (roots of N D′ − N′ D on the locus, with their k); the imaginary-axis crossings
 *  (ω ≥ 0, with k); the departure angles from complex or repeated poles and the arrival angles at complex or repeated
 *  zeros [°] (one per branch; the conjugates are symmetric). approx: with a dead time, from its Padé approximation */
export interface LocusRules {
  n: number;
  m: number;
  sign: number;
  poles: Complex[];
  zeros: Complex[];
  segments: [number, number][];
  asymAngles: number[];
  centroid: number | null;
  breakaway: { s: Complex; k: number; kind: 'breakaway' | 'break-in' }[];
  crossings: { w: number; k: number }[];
  departures: { at: Complex; mult: number; angles: number[] }[];
  arrivals: { at: Complex; mult: number; angles: number[] }[];
  approx: boolean;
}
const argDeg = (z: Complex) => (Math.atan2(z[1], z[0]) * 180) / Math.PI;
// An angle in degrees in (−180, 180]
export const wrapDeg = (a: number) => {
  let x = ((a % 360) + 360) % 360;
  if (x > 180) x -= 360;
  return Math.abs(x) < 1e-9 ? 0 : x;
};
// Derivative of a polynomial (descending powers)
const pDer = (p: Poly): Poly => (p.length < 2 ? [0] : p.slice(0, -1).map((c, i) => c * (p.length - 1 - i)));
type RootGroup = ReturnType<typeof groupRoots>[number];
// k = −D(s)/N(s) at s: the gain factor that puts a closed-loop pole there (real and positive on the locus)
function gainAt(N: Poly, D: Poly, z: Complex): Complex {
  const v = cdiv(polyval(D, z), polyval(N, z));
  return [-v[0], -v[1]];
}
// Real-axis segments: an odd (180° locus) or even (0° locus) number of real poles and zeros to the right (the
// repeated ones counted with their multiplicity)
function locusSegments(groups: RootGroup[], sign: number): [number, number][] {
  const realG = groups.filter(g => g.z[1] === 0),
    reals = realG.flatMap(g => Array<number>(g.mult).fill(g.z[0])),
    cuts = realG
      .map(g => g.z[0])
      .sort((a, b) => a - b)
      .filter((x, i, xs) => i === 0 || x - xs[i - 1] > 1e-3 * (1 + Math.abs(x))), // a cancelled pair: one point
    edges = [-Infinity, ...cuts, Infinity],
    segments: [number, number][] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const a = edges[i],
      b = edges[i + 1],
      x = !isFinite(a) ? b - 1 : !isFinite(b) ? a + 1 : (a + b) / 2,
      right = reals.filter(r => r > x).length;
    if (!isFinite(x)) {
      if (sign < 0) segments.push([a, b]); // no real pole or zero: the whole axis for the 0° locus
      continue;
    }
    if (right % 2 === (sign > 0 ? 1 : 0)) {
      const last = segments[segments.length - 1];
      if (last && last[1] === a) last[1] = b;
      else segments.push([a, b]);
    }
  }
  return segments;
}
// Breakaway and break-in points: dk/ds = 0 with k = −D/N real and positive, away from the poles and zeros
function locusBreakaway(N: Poly, D: Poly, groups: RootGroup[]): LocusRules['breakaway'] {
  const kReal = (x: number) => -polyval(D, [x, 0])[0] / polyval(N, [x, 0])[0];
  const bp = trimPoly(pAddDesc(pMul(N, pDer(D)), pScale(pMul(pDer(N), D), -1))),
    out: LocusRules['breakaway'] = [];
  if (bp.length > 1)
    for (const { z } of groupRoots(polyRoots(bp))) {
      if (z[1] < 0) continue;
      const kk = gainAt(N, D, z);
      if (!isFinite(kk[0]) || kk[0] <= 1e-12 || Math.abs(kk[1]) > 1e-6 * Math.abs(kk[0])) continue;
      if (groups.some(g => Math.hypot(g.z[0] - z[0], g.z[1] - z[1]) <= 1e-3 * (1 + Math.hypot(z[0], z[1])))) continue; // at a pole or a zero (k = 0 or ∞, or a cancelled pair)
      // along the real axis k has a maximum where the branches leave it and a minimum where they meet it
      const h = 1e-4 * (1 + Math.abs(z[0])),
        kind: 'breakaway' | 'break-in' =
          z[1] === 0 && kReal(z[0] - h) + kReal(z[0] + h) > 2 * kk[0] ? 'break-in' : 'breakaway';
      out.push({ s: z, k: kk[0], kind });
    }
  return out.sort((a, b) => a.s[0] - b.s[0]);
}
// Real and imaginary parts of p(jω), as polynomials in ω (descending powers)
function jwParts(p: Poly): [Poly, Poly] {
  const re: number[] = [],
    im: number[] = [];
  p.forEach((c, i) => {
    const e = p.length - 1 - i,
      r = e % 4; // j^e = 1, j, −1, −j
    re.push(r === 0 ? c : r === 2 ? -c : 0);
    im.push(r === 1 ? c : r === 3 ? -c : 0);
  });
  return [re, im];
}
// Imaginary-axis crossings: D(jω) + k N(jω) = 0, i.e. Im(D(jω) conj N(jω)) = 0 with k = −D/N > 0
function locusCrossings(N: Poly, D: Poly): LocusRules['crossings'] {
  const [Dr, Di] = jwParts(D),
    [Nr, Ni] = jwParts(N),
    cp = trimPoly(pAddDesc(pMul(Di, Nr), pScale(pMul(Dr, Ni), -1))),
    out: LocusRules['crossings'] = [];
  const ws = cp.every(v => Math.abs(v) < 1e-14)
    ? []
    : polyRoots(cp)
        .filter(z => z[1] === 0 && z[0] >= 0)
        .map(z => z[0]);
  if (Math.abs(lastOf(cp)) < 1e-14 && !ws.includes(0)) ws.push(0);
  for (const w of [...new Set(ws)].sort((a, b) => a - b)) {
    const kk = gainAt(N, D, [0, w]);
    if (!isFinite(kk[0]) || kk[0] <= 1e-12 || Math.abs(kk[1]) > 1e-6 * (1 + Math.abs(kk[0]))) continue;
    if (!out.some(c => Math.abs(c.w - w) <= 1e-6 * (1 + w))) out.push({ w, k: kk[0] });
  }
  return out;
}
// Departure and arrival angles: at a pole of multiplicity r, r θ = 180° + Σ∠(p − zeros) − Σ∠(p − other poles)
// (0° for the 0° locus), and the reverse for zeros. A zero at the same point (a cancelled pair) lowers r and is
// left out of the sums; a point cancelled completely does not move and has no angle
function locusAngles(gp: RootGroup[], gz: RootGroup[], sign: number) {
  const base = sign > 0 ? 180 : 0,
    near = (a: Complex, b: Complex) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-3 * (1 + Math.hypot(a[0], a[1]));
  const angles = (at: Complex, r: number, same: RootGroup[], other: RootGroup[], s: number) => {
    let a = base;
    other.forEach(o => {
      if (!near(o.z, at)) a += s * o.mult * argDeg([at[0] - o.z[0], at[1] - o.z[1]]);
    });
    same.forEach(o => {
      if (o.z !== at) a -= s * o.mult * argDeg([at[0] - o.z[0], at[1] - o.z[1]]);
    });
    return Array.from({ length: r }, (_, l) => wrapDeg((s * a + 360 * l) / r)).sort((x, y) => x - y);
  };
  const leaving = (same: RootGroup[], other: RootGroup[], s: number) =>
    same
      .map(g => ({ g, r: g.mult - other.filter(o => near(o.z, g.z)).reduce((t, o) => t + o.mult, 0) }))
      .filter(({ g, r }) => r > 0 && (g.z[1] > 0 || (g.z[1] === 0 && r > 1)))
      .map(({ g, r }) => ({ at: g.z, mult: r, angles: angles(g.z, r, same, other, s) }));
  return { departures: leaving(gp, gz, 1), arrivals: leaving(gz, gp, -1) };
}
// The construction rules of the root locus of the loop (null without a loop: the controller gain is zero)
export function locusRules(st: State = S): LocusRules | null {
  const { num, den, tf } = loopRational(st);
  if (num.every(v => v === 0)) return null;
  const N = trimPoly(num),
    D = trimPoly(den),
    n = D.length - 1,
    m = N.length - 1,
    sign = Math.sign(N[0] / D[0]),
    poles = polyRoots(D),
    zeros = polyRoots(N),
    gp = groupRoots(poles),
    gz = groupRoots(zeros),
    q = n - m;
  // asymptotes: q = n − m of them, at equal angles about the centroid of the poles and zeros
  const asymAngles =
    q > 0 ? Array.from({ length: q }, (_, i) => wrapDeg(((2 * i + (sign > 0 ? 1 : 0)) * 180) / q)) : [];
  const centroid = q > 0 ? (poles.reduce((s, z) => s + z[0], 0) - zeros.reduce((s, z) => s + z[0], 0)) / q : null;
  return {
    n,
    m,
    sign,
    poles,
    zeros,
    segments: locusSegments([...gp, ...gz], sign),
    asymAngles,
    centroid,
    breakaway: locusBreakaway(N, D, [...gp, ...gz]),
    crossings: locusCrossings(N, D),
    ...locusAngles(gp, gz, sign),
    approx: tf.L > 0,
  };
}
