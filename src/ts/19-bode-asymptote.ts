// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Asymptotic (straight-line) approximation of the Bode gain plot ================= */
import { groupRoots, originOrder, polyRoots } from './03-math.ts';
import { S } from './11-state.ts';
import { loopTFs } from './17-loop.ts';
/** The straight-line approximation of |L(jω)| in dB: K/ω^q at low frequencies (q: poles minus zeros at the origin,
 *  K: the ratio of their lowest coefficients) and, at each break frequency ω_b = |root| of the other poles and zeros,
 *  a change of slope of ±20 dB/dec per zero/pole (±40 for a complex pair). The dead time does not change the gain */
export interface BodeAsymptote {
  K: number;
  q: number;
  breaks: {
    w: number;
    poles: { z: Complex; mult: number }[];
    zeros: { z: Complex; mult: number }[];
    dSlope: number;
    slope: number;
  }[];
  gain: (w: number) => number;
  /** straight-line approximation of the phase [deg] (up to a multiple of 360°): −90°·q at low frequencies (+180° for
   *  K < 0); a real pole or zero changes it by ∓90° (left half-plane; ±90° in the right half-plane) linearly in log ω
   *  from ω_b/10 to 10 ω_b, a complex pair by ∓180° from ω_n·10^(−ζ) to ω_n·10^(ζ) (a step when ζ = 0); the dead
   *  time adds its exact −ωL */
  phase: (w: number) => number;
  /** the factors whose straight lines add up to gain and phase: K/s^q (mult = q), each pole or zero (a complex pair
   *  once, by its root with Im > 0), and the dead time */
  parts: {
    kind: 'K' | 'pole' | 'zero' | 'delay';
    z: Complex | null;
    mult: number;
    gain: (w: number) => number;
    phase: (w: number) => number;
  }[];
  /** the dead time (0 without) */
  L: number;
}
export function bodeAsymptote(st: State = S): BodeAsymptote | null {
  const g = loopTFs(st).L;
  if (g.num.every(v => v === 0)) return null;
  const N = g.num,
    D = g.den0,
    zn = originOrder(N),
    zd = originOrder(D),
    K = N[N.length - 1 - zn] / D[D.length - 1 - zd],
    q = zd - zn,
    // the poles and zeros other than at the origin; a complex pair once, by its root with Im > 0
    pick = (rs: Complex[]) =>
      groupRoots(rs).filter(r => Math.hypot(r.z[0], r.z[1]) > 1e-9 * (1 + Math.hypot(r.z[0], r.z[1])) && r.z[1] >= 0),
    ps = pick(polyRoots(D)),
    zs = pick(polyRoots(N)),
    weight = (r: { z: Complex; mult: number }) => r.mult * (r.z[1] > 0 ? 2 : 1),
    mag = (r: { z: Complex }) => Math.hypot(r.z[0], r.z[1]);
  const ws = [...ps, ...zs]
    .map(mag)
    .sort((a, b) => a - b)
    .filter((w, i, a) => i === 0 || w - a[i - 1] > 1e-6 * w);
  let slope = -20 * q;
  const breaks = ws.map(w => {
    const at = (r: { z: Complex }) => Math.abs(mag(r) - w) <= 1e-6 * w,
      poles = ps.filter(at),
      zeros = zs.filter(at),
      dSlope = 20 * (zeros.reduce((s, r) => s + weight(r), 0) - poles.reduce((s, r) => s + weight(r), 0));
    slope += dSlope;
    return { w, poles, zeros, dSlope, slope };
  });
  // the factors whose straight lines add up to the asymptotes: K/s^q, each pole or zero (a complex pair once, with
  // its multiplicity), and the dead time
  const parts: BodeAsymptote['parts'] = [
    {
      kind: 'K',
      z: null,
      mult: q,
      gain: w => 20 * Math.log10(Math.abs(K)) - 20 * q * Math.log10(w),
      phase: () => -90 * q + (K < 0 ? 180 : 0),
    },
  ];
  // a pole (sgn −1) or zero (+1): the slope ±20 dB/dec per order from |s| on; the phase ∓90° per order (a complex pair
  // ∓180°) along a straight line in log ω from ω_b/10 to 10ω_b (from ωn·10^(−ζ) to ωn·10^ζ for a pair), the sign
  // reversed in the right half-plane
  const addPart = (r: { z: Complex; mult: number }, sgn: number) => {
    const w0 = mag(r),
      lhp = r.z[0] < 0 ? 1 : -1,
      pair = r.z[1] > 0,
      zeta = Math.abs(r.z[0]) / w0,
      l = Math.log10(w0),
      [a, b] = pair ? [l - zeta, l + zeta] : [l - 1, l + 1],
      d = sgn * lhp * (pair ? 180 : 90) * r.mult;
    parts.push({
      kind: sgn < 0 ? 'pole' : 'zero',
      z: r.z,
      mult: r.mult,
      gain: w => sgn * 20 * weight(r) * Math.log10(Math.max(1, w / w0)),
      phase: w => {
        const lw = Math.log10(w);
        return d * (b <= a ? (lw >= a ? 1 : 0) : Math.min(1, Math.max(0, (lw - a) / (b - a))));
      },
    });
  };
  ps.forEach(r => addPart(r, -1));
  zs.forEach(r => addPart(r, 1));
  if (g.delay && g.L > 0)
    parts.push({ kind: 'delay', z: null, mult: 1, gain: () => 0, phase: w => (-w * g.L * 180) / Math.PI });
  const gain = (w: number) => parts.reduce((v, p) => v + p.gain(w), 0),
    phase = (w: number) => parts.reduce((v, p) => v + p.phase(w), 0);
  return { K, q, breaks, gain, phase, parts, L: g.delay ? g.L : 0 };
}
