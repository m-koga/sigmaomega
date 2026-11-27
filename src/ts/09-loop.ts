// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Loop transfer function, closed-loop poles and root locus ================= */
import {
  cadd,
  cdiv,
  cmul,
  lastOf,
  matchRoots,
  pAddDesc,
  pMul,
  pScale,
  polyRoots,
  polyval,
  trimPoly,
} from './03-math.ts';
import { PLANTS } from './05-definitions.ts';
import { S, ctrlRational, isTFMode } from './06-state.ts';
import { spWeights } from './07-frequency.ts';

// Controller transfer function (P/PI/PD/PID are converted to rational form; common factors at the origin are cancelled).
// w: set-point weights of a PID, for the controller acting on the reference Cr(s) = KP b + KI/s + KD c s·N/(s+N)
// (the same denominator as C(s))
export function ctrlTF(st: State = S, w: { b: number; c: number } = { b: 1, c: 1 }): Rational {
  let num: Poly, den: Poly;
  if (isTFMode(st)) {
    const r = ctrlRational(st);
    num = r.num;
    den = r.den;
  } else {
    const Kp = st.Kp,
      Ki = st.Ki,
      Kd = st.Kd,
      N = st.N,
      Kpb = Kp * w.b,
      Kdc = Kd * w.c;
    let m = st.mode;
    if (m === 'PD' && Kd === 0) m = 'P';
    if (m === 'PID' && Kd === 0) m = 'PI';
    if (m === 'P') {
      num = [Kpb];
      den = [1];
    } else if (m === 'PI') {
      num = [Kpb, Ki];
      den = [1, 0];
    } else if (m === 'PD') {
      num = [Kpb + Kdc * N, Kpb * N];
      den = [1, N];
    } else {
      num = [Kpb + Kdc * N, Kpb * N + Ki, Ki * N];
      den = [1, N, 0];
    }
  }
  num = trimPoly(num.slice());
  den = trimPoly(den.slice());
  while (num.length > 1 && den.length > 1 && Math.abs(lastOf(num)) < 1e-14 && Math.abs(lastOf(den)) < 1e-14) {
    num = num.slice(0, -1);
    den = den.slice(0, -1);
  }
  return { num, den };
}
// Open-loop transfer function L(s) = num/den (dead time replaced by a third-order Padé approximation)
export function loopRational(st: State = S) {
  const tf = PLANTS[st.plant].tf(st),
    c = ctrlTF(st);
  let Nd = [1],
    Dd = [1];
  if (tf.L > 0) {
    const L = tf.L;
    Nd = [-(L ** 3) / 120, (L * L) / 10, -L / 2, 1];
    Dd = [L ** 3 / 120, (L * L) / 10, L / 2, 1];
  } // third-order Padé approximation
  return { num: trimPoly(pMul(pMul(tf.num, c.num), Nd)), den: trimPoly(pMul(pMul(tf.den, c.den), Dd)), tf, c };
}
/** A transfer function of the loop as num(s)·e^{−Ls}/(den0(s) + den1(s)·e^{−Ls}): delay tells whether the numerator
 *  has the dead time e^{−Ls} of the plant, den1 is empty when the denominator has none; den0 is monic */
export interface LoopTF {
  num: Poly;
  delay: boolean;
  den0: Poly;
  den1: Poly;
  L: number;
}
export type LoopTFKey = 'L' | 'S' | 'T' | 'R' | 'D';
// Transfer functions of the loop with the plant P = Np e^{−Ls}/Dp and the controller C = Nc/Dc (Cr = Nr/Dr acting
// on the reference): with N = Np Nc and D = Dp Dc,
//   L = N e/D,  S = 1/(1+L) = D/(D + N e),  T = L/(1+L) = N e/(D + N e),
//   Gyd = P/(1+L) = Np Dc e/(D + N e),  Gyr = Cr P/(1+L) = Nr Np Dc e/(Dr (D + N e))  (Dr = Dc: Nr Np e/(D + N e)).
// The common factors of the numerator and the denominator are not cancelled.
export function loopTFs(st: State = S): Record<LoopTFKey, LoopTF> {
  const tf = PLANTS[st.plant].tf(st),
    c = ctrlTF(st),
    r = isTFMode(st) ? c : ctrlTF(st, spWeights(st)),
    N = trimPoly(pMul(tf.num, c.num)),
    D = trimPoly(pMul(tf.den, c.den)),
    L = tf.L > 0 ? tf.L : 0,
    sameDen = r.den.length === c.den.length && r.den.every((v, i) => v === c.den[i]);
  // the closed-loop denominator D + N e^{−Ls} (one polynomial without dead time)
  const cl = (k: Poly = [1]): [Poly, Poly] => (L ? [pMul(k, D), pMul(k, N)] : [trimPoly(pMul(k, pAddDesc(D, N))), []]);
  const make = (num: Poly, delay: boolean, [den0, den1]: [Poly, Poly]): LoopTF => {
    const a = den0[0];
    return {
      num: pScale(trimPoly(num), 1 / a),
      delay: delay && L > 0,
      den0: pScale(den0, 1 / a),
      den1: pScale(den1, 1 / a),
      L,
    };
  };
  return {
    L: make(N, true, [D, []]),
    S: make(D, false, cl()),
    T: make(N, true, cl()),
    D: make(pMul(tf.num, c.den), true, cl()),
    R: sameDen ? make(pMul(r.num, tf.num), true, cl()) : make(pMul(pMul(r.num, tf.num), c.den), true, cl(r.den)),
  };
}
// Value of a transfer function of the loop at s = jω
export function evalLoopTF(g: LoopTF, w: number): Complex {
  const s: Complex = [0, w],
    e: Complex = [Math.cos(-w * g.L), Math.sin(-w * g.L)],
    num = g.delay ? cmul(polyval(g.num, s), e) : polyval(g.num, s),
    den = g.den1.length ? cadd(polyval(g.den0, s), cmul(polyval(g.den1, s), e)) : polyval(g.den0, s);
  return cdiv(num, den);
}
// Root locus: closed-loop poles of den + k num for the gain factors ks (k = 1 is the current setting)
export function rootLocus(ks: number[], st: State = S): LocusPoint[] {
  const { num, den } = loopRational(st);
  const out: LocusPoint[] = [];
  let prev: Complex[] | null = null;
  for (const k of ks) {
    const chr = trimPoly(pAddDesc(den, pScale(num, k)));
    let r = polyRoots(chr, prev ?? undefined);
    if (prev && prev.length === r.length) r = matchRoots(prev, r);
    out.push({ k, r });
    prev = r;
  }
  return out;
}
export const LOCUS_KS = (() => {
  const a: number[] = [];
  for (let i = 0; i <= 640; i++) a.push(Math.pow(10, -4 + (8 * i) / 640));
  a.push(1);
  return a.sort((x, y) => x - y);
})();
// Ranges of k (within 1e-4 … 1e4) for which all closed-loop poles are in the left half-plane. pts: the root locus
// over LOCUS_KS (computed when not given); each boundary is then found by bisection, each step starting from the
// poles of the nearer known point, so that few iterations are needed
export function stableRanges(st: State = S, pts: LocusPoint[] = rootLocus(LOCUS_KS, st)): [number, number][] {
  const { num, den } = loopRational(st);
  const poles = (k: number, init: Complex[]) => polyRoots(trimPoly(pAddDesc(den, pScale(num, k))), init);
  const isStable = (r: Complex[]) => r.every(z => z[0] < 0);
  const stable = pts.map(p => isStable(p.r)),
    out: [number, number][] = [];
  const edge = (i: number) => {
    let lo = pts[i - 1].k,
      hi = pts[i].k,
      rLo = pts[i - 1].r;
    const sa = stable[i - 1];
    for (let n = 0; n < 50; n++) {
      const m = Math.sqrt(lo * hi),
        r = poles(m, rLo);
      if (isStable(r) === sa) {
        lo = m;
        rLo = r;
      } else hi = m;
    }
    return Math.sqrt(lo * hi);
  };
  let start: number | null = stable[0] ? 0 : null;
  for (let i = 1; i < pts.length; i++) {
    if (stable[i] && !stable[i - 1]) start = edge(i);
    if (!stable[i] && stable[i - 1]) {
      out.push([start ?? 0, edge(i)]);
      start = null;
    } // start is set while stable
  }
  if (start !== null) out.push([start, Infinity]);
  return out;
}
export function computePZ(st: State = S) {
  const { num, den, tf, c } = loopRational(st);
  const chr = trimPoly(pAddDesc(den, num));
  const allZero = c.num.every(v => v === 0);
  return {
    pp: polyRoots(tf.den),
    pz: polyRoots(tf.num),
    cp: polyRoots(c.den),
    cz: allZero ? [] : polyRoots(c.num),
    cl: polyRoots(chr),
    pade: tf.L > 0,
    L: tf.L,
  };
}
export type PoleKey = 'P' | 'C' | LoopTFKey;
/** Poles and zeros of P(s), C(s) and of the transfer functions of the loop (as written in loopTFs: common factors not
 *  cancelled; the dead time has no zeros). approx: the closed-loop poles of a loop with dead time, from the
 *  third-order Padé approximation (the actual closed loop has infinitely many) */
export function loopPoles(
  st: State = S,
  pz: ReturnType<typeof computePZ> = computePZ(st),
): Record<PoleKey, { poles: Complex[]; zeros: Complex[]; approx: boolean }> {
  const c = ctrlTF(st),
    r = isTFMode(st) ? c : ctrlTF(st, spWeights(st)),
    sameDen = r.den.length === c.den.length && r.den.every((v, i) => v === c.den[i]),
    rz = r.num.every(v => v === 0) ? [] : polyRoots(r.num),
    cl = (zeros: Complex[]) => ({ poles: pz.cl, zeros, approx: pz.pade }),
    exact = (poles: Complex[], zeros: Complex[]) => ({ poles, zeros, approx: false });
  return {
    P: exact(pz.pp, pz.pz),
    C: exact(pz.cp, pz.cz),
    L: exact([...pz.pp, ...pz.cp], [...pz.pz, ...pz.cz]),
    // S = D/(D + N e): the zeros are the poles of P and C; T = N e/(D + N e): the zeros of P and C;
    // Gyd = Np Dc e/(D + N e): the zeros of P and the poles of C; Gyr = Nr Np e/(D + N e) (Nr Np Dc e/(Dr (D + N e))
    // when Cr has another denominator)
    S: cl([...pz.pp, ...pz.cp]),
    T: cl([...pz.pz, ...pz.cz]),
    D: cl([...pz.pz, ...pz.cp]),
    R: sameDen
      ? cl([...rz, ...pz.pz])
      : { poles: [...polyRoots(r.den), ...pz.cl], zeros: [...rz, ...pz.pz, ...pz.cp], approx: pz.pade },
  };
}
/* ---- Routh–Hurwitz stability test ---- */
/** Characteristic polynomial of the closed loop for the gain factor k (C(s) → k C(s)): D(s) + k N(s) = 0, with D and N
 *  of the same length (descending powers of s, the leading coefficient of D made 1); approx: with a dead time, replaced
 *  by its third-order Padé approximation */
export function charPolyK(st: State = S): { D: Poly; N: Poly; approx: boolean } {
  const { num, den, tf } = loopRational(st),
    n = Math.max(num.length, den.length),
    pad = (p: Poly) => [...new Array(n - p.length).fill(0), ...p],
    a = den[0];
  return { D: pad(den).map(v => v / a), N: pad(num).map(v => v / a), approx: tf.L > 0 };
}
export interface RouthResult {
  /** rows of the table, from s^n down to s^0 */
  rows: number[][];
  /** rows whose first element was zero and replaced by a small ε > 0 */
  eps: number[];
  /** rows of zeros replaced by the derivative of the auxiliary polynomial of the row above */
  aux: number[];
  /** sign changes in the first column: the number of roots in the right half-plane */
  changes: number;
}
/** Routh table of a polynomial (descending powers), with the two special cases: a zero first element is replaced by
 *  a small ε > 0, and a row of zeros by the derivative of the auxiliary polynomial of the row above */
export function routhArray(a: Poly): RouthResult {
  const n = a.length - 1,
    w = Math.floor(n / 2) + 1,
    scale = Math.max(...a.map(Math.abs)) || 1,
    row = (k: number) => Array.from({ length: w }, (_, j) => a[k + 2 * j] ?? 0),
    rows: number[][] = [row(0), row(1)],
    eps: number[] = [],
    aux: number[] = [];
  const tiny = (v: number, ref: number) => Math.abs(v) <= 1e-10 * ref;
  const fix = (i: number) => {
    const r = rows[i],
      ref = Math.max(scale, ...rows.slice(0, i).flat().map(Math.abs));
    if (r.every(v => tiny(v, ref)) && i > 0 && i < n) {
      // auxiliary polynomial of the row above (powers m+1, m−1, …) and its derivative
      const m = n - i;
      rows[i] = rows[i - 1].map((v, j) => v * (m + 1 - 2 * j)).map(v => (Math.abs(v) < 1e-300 ? 0 : v));
      aux.push(i);
    }
    if (tiny(rows[i][0], ref) && i < n) {
      rows[i][0] = 1e-9 * ref;
      eps.push(i);
    }
  };
  if (n >= 1) fix(1);
  for (let i = 2; i <= n; i++) {
    const p = rows[i - 2],
      q = rows[i - 1];
    rows.push(Array.from({ length: w }, (_, j) => (q[0] * (p[j + 1] ?? 0) - p[0] * (q[j + 1] ?? 0)) / q[0]));
    fix(i);
  }
  let changes = 0;
  for (let i = 1; i <= n; i++) if (Math.sign(rows[i][0]) !== Math.sign(rows[i - 1][0]) && rows[i][0] !== 0) changes++;
  return { rows, eps, aux, changes };
}
/** Hurwitz determinants Δ1(k) … Δn(k) of D(s) + k N(s) as polynomials in k (descending powers of k). The first
 *  column of the Routh table is a0, Δ1, Δ2/Δ1, …, Δn/Δn−1, so the closed loop is stable when every Δi(k) > 0 */
export function hurwitzK(D: Poly, N: Poly): Poly[] {
  type K = number[]; // ascending powers of k
  const n = D.length - 1,
    coef = (i: number): K => (i >= 0 && i <= n ? [D[i], N[i]] : [0]),
    add = (a: K, b: K) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0)),
    mul = (a: K, b: K) => {
      const r = new Array(a.length + b.length - 1).fill(0);
      a.forEach((x, i) => b.forEach((y, j) => (r[i + j] += x * y)));
      return r;
    };
  // determinant of a matrix of polynomials: expansion along the rows, memoized on the columns used
  const det = (M: K[][]): K => {
    const m = M.length,
      memo = new Map<number, K>();
    const f = (mask: number, r: number): K => {
      if (r === m) return [1];
      const hit = memo.get(mask);
      if (hit) return hit;
      let acc: K = [0],
        pos = 0;
      for (let j = 0; j < m; j++) {
        if (mask & (1 << j)) continue;
        const e = M[r][j];
        if (e.some(v => v !== 0)) {
          const t = mul(e, f(mask | (1 << j), r + 1));
          acc = add(acc, pos % 2 ? t.map(v => -v) : t);
        }
        pos++;
      }
      memo.set(mask, acc);
      return acc;
    };
    return f(0, 0);
  };
  // Hurwitz matrix: H[i][j] = a(2j − i + 1)
  const H = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => coef(2 * j - i + 1)));
  return Array.from({ length: n }, (_, m) =>
    trimPoly(
      det(H.slice(0, m + 1).map(r => r.slice(0, m + 1)))
        .slice()
        .reverse(),
    ),
  );
}
/** Ranges of k > 0 where every polynomial (descending powers of k) is positive */
export function positiveKRanges(ps: Poly[]): [number, number][] {
  const val = (p: Poly, k: number) => p.reduce((s, c) => s * k + c, 0);
  const cuts = [
    ...new Set(
      ps
        .flatMap(p => (p.length > 1 ? polyRoots(p) : []))
        .filter(z => Math.abs(z[1]) <= 1e-7 * (1 + Math.abs(z[0])) && z[0] > 1e-12)
        .map(z => z[0]),
    ),
  ].sort((x, y) => x - y);
  const edges = [0, ...cuts, Infinity],
    out: [number, number][] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const lo = edges[i],
      hi = edges[i + 1],
      mid = hi === Infinity ? Math.max(2 * lo, lo + 1) : (lo + hi) / 2;
    if (ps.every(p => val(p, mid) > 0)) {
      const last = out[out.length - 1];
      if (last && last[1] === lo) last[1] = hi;
      else out.push([lo, hi]);
    }
  }
  return out;
}
/* ---- Asymptotic (straight-line) approximation of the Bode gain plot ---- */
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
/* ---- Nyquist stability criterion ---- */
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
/* ---- Construction rules of the root locus ---- */
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
// Roots grouped into distinct points with their multiplicity (repeated roots are found only to about 10^(−16/r))
function groupRoots(rs: Complex[]): { z: Complex; mult: number }[] {
  const out: { z: Complex; mult: number; sum: Complex }[] = [];
  for (const z of rs) {
    const g = out.find(o => Math.hypot(o.z[0] - z[0], o.z[1] - z[1]) <= 1e-3 * (1 + Math.hypot(z[0], z[1])));
    if (g) {
      g.sum = cadd(g.sum, z);
      g.mult++;
      g.z = [g.sum[0] / g.mult, g.sum[1] / g.mult];
    } else out.push({ z, mult: 1, sum: z });
  }
  return out.map(({ z, mult }) => ({ z: [z[0], Math.abs(z[1]) < 1e-9 ? 0 : z[1]], mult }));
}
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
/* ---- System type and steady-state error ---- */
/** System type and error constants of the open loop L(s) = N(s)e^{−Ls}/D(s): near s = 0, L(s) ≈ K/s^type (the dead
 *  time does not change them, e^{−Ls} → 1); Kp = lim L, Kv = lim sL, Ka = lim s²L (Infinity above the type).
 *  zeroAtOrigin: L(s) has more zeros than poles at the origin (then type 0 and every constant 0) */
export interface ErrorConstants {
  type: number;
  K: number;
  Kp: number;
  Kv: number;
  Ka: number;
  zeroAtOrigin: boolean;
}
// Number of factors s of a polynomial (trailing zero coefficients, relative to its largest coefficient)
const originOrder = (p: Poly): number => {
  const tol = 1e-12 * Math.max(0, ...p.map(Math.abs));
  let n = 0;
  while (n < p.length - 1 && Math.abs(p[p.length - 1 - n]) <= tol) n++;
  return n;
};
export function errorConstants(st: State = S): ErrorConstants {
  const tf = PLANTS[st.plant].tf(st),
    c = ctrlTF(st),
    N = trimPoly(pMul(tf.num, c.num)),
    D = trimPoly(pMul(tf.den, c.den));
  if (N.every(v => v === 0)) return { type: 0, K: 0, Kp: 0, Kv: 0, Ka: 0, zeroAtOrigin: false };
  const zn = originOrder(N),
    zd = originOrder(D),
    l = zd - zn;
  if (l < 0) return { type: 0, K: 0, Kp: 0, Kv: 0, Ka: 0, zeroAtOrigin: true };
  const K = N[N.length - 1 - zn] / D[D.length - 1 - zd],
    at = (i: number) => (l < i ? 0 : l === i ? K : Infinity);
  return { type: l, K, Kp: at(0), Kv: at(1), Ka: at(2), zeroAtOrigin: false };
}
// Taylor series at s = 0 (ascending powers up to s^m) of a polynomial (descending), of a product and of a quotient
const serPoly = (p: Poly, m: number): number[] => Array.from({ length: m + 1 }, (_, i) => p[p.length - 1 - i] ?? 0);
const serMul = (a: number[], b: number[]): number[] =>
  a.map((_, i) => a.slice(0, i + 1).reduce((s, x, j) => s + x * b[i - j], 0));
const serDiv = (a: number[], b: number[]): number[] => {
  const c: number[] = [];
  a.forEach((x, i) => c.push((x - c.reduce((s, y, j) => s + y * b[i - j], 0)) / b[0]));
  return c;
};
// Numerator and denominator series of a loop transfer function (the dead time as the series of e^{−Ls})
function serLoop(g: LoopTF, m: number): { num: number[]; den: number[] } {
  const e = Array.from({ length: m + 1 }, (_, i) => (-g.L) ** i / [1, 1, 2, 6, 24, 120][i]),
    num = serPoly(g.num, m),
    den0 = serPoly(g.den0, m);
  return {
    num: g.delay ? serMul(num, e) : num,
    den: g.den1.length ? den0.map((v, i) => v + serMul(serPoly(g.den1, m), e)[i]) : den0,
  };
}
// a − b with the differences that are rounding errors made exactly zero
const serSub = (a: number[], b: number[]) =>
  a.map((x, i) => (Math.abs(x - b[i]) <= 1e-9 * (Math.abs(x) + Math.abs(b[i])) ? 0 : x - b[i]));
/** Steady-state errors e = r − y of the closed loop, from the series at s = 0 of E(s)/R(s) = 1 − G_yr(s) (this holds
 *  with set-point weights too) and of G_yd(s): ref[i] for a unit step, ramp (slope 1) and parabola (acceleration 1),
 *  Infinity when the error grows without bound; dist for a unit step disturbance at the plant input (−G_yd(0)).
 *  null: the closed loop has a pole at the origin. The values hold only when the closed loop is stable. */
export function steadyErrors(st: State = S): { ref: [number, number, number]; dist: number } | null {
  const g = loopTFs(st),
    r = serLoop(g.R, 2),
    d = serLoop(g.D, 2);
  if (Math.abs(r.den[0]) <= 1e-12 * Math.max(...r.den.map(Math.abs))) return null;
  const c = serDiv(serSub(r.den, r.num), r.den);
  return {
    ref: [c[0], c[0] !== 0 ? Infinity : c[1], c[0] !== 0 || c[1] !== 0 ? Infinity : c[2]],
    dist: -serDiv(d.num, d.den)[0] + 0,
  };
}
export let lastLocus: LocusPoint[] | null = null,
  lastRanges: [number, number][] | null = null,
  lastRules: LocusRules | null | undefined,
  lastNyq: NyquistCount | null | undefined;
// Root locus and stable ranges of k, computed when first needed after each update
export const locus = (): LocusPoint[] => (lastLocus ??= rootLocus(LOCUS_KS));
export const stableKRanges = (): [number, number][] => (lastRanges ??= stableRanges(S, locus()));
// Construction rules of the root locus, computed when first needed after each update
export const rules = (): LocusRules | null => (lastRules === undefined ? (lastRules = locusRules()) : lastRules);
// Counting for the Nyquist criterion, computed when first needed after each update
export const nyqCount = (): NyquistCount | null => (lastNyq === undefined ? (lastNyq = nyquistCount()) : lastNyq);
// The root locus is computed again when next needed (the pole specifications changed)
export function resetLocus() {
  lastLocus = null;
}
// The root locus and the stable gain ranges are computed again when next needed (the loop changed)
export function resetLoopCache() {
  lastLocus = null;
  lastRanges = null;
  lastRules = undefined;
  lastNyq = undefined;
}
