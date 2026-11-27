// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Estimation exercises: hidden plants, their responses and the checking of the estimates ================= */
import { mulberry32 } from './16-simulation.ts';
/* ---- Estimation exercise: a hidden first-order lag + dead time plant ---- */
/** The hidden plant K e^{−Ls}/(Ts + 1) of exercise number n (the same number always gives the same plant):
 *  K in 0.5 … 3 (2 decimals), T in 0.5 … 5 s (1 decimal), L in 0.1 … min(2, T) s (steps of 0.05) */
export function exercisePlant(n: number): { K: number; T: number; L: number } {
  const r = mulberry32(Math.floor(Math.abs(n)) * 2654435761 + 97),
    K = Math.round((0.5 + 2.5 * r()) * 100) / 100,
    T = Math.round((0.5 + 4.5 * r()) * 10) / 10,
    L = Math.round((0.1 + (Math.min(2, T) - 0.1) * r()) * 20) / 20;
  return { K, T, L };
}
/** Unit step response of K e^{−Ls}/(Ts + 1) at time t */
export const fopdtStep = (p: { K: number; T: number; L: number }, t: number) =>
  t <= p.L ? 0 : p.K * (1 - Math.exp(-(t - p.L) / p.T));
/** Relative errors of the estimates (|estimate − true|/true) and whether each is within tol */
export function exerciseCheck(
  p: { K: number; T: number; L: number },
  e: { K: number; T: number; L: number },
  tol = 0.1,
) {
  const err = (k: 'K' | 'T' | 'L') => Math.abs(e[k] - p[k]) / p[k];
  const r = { K: err('K'), T: err('T'), L: err('L') };
  return { err: r, ok: { K: r.K <= tol, T: r.T <= tol, L: r.L <= tol } };
}

/* ---- Estimation exercise from the frequency response: one of three hidden plants ---- */
/** Kinds of hidden plant of the frequency-response exercise and the three values estimated for each:
 *  lags: K/((T1 s + 1)(T2 s + 1)); dead: K e^{−Ls}/(Ts + 1); second: K ωn²/(s² + 2ζωn s + ωn²) */
export const FREQ_EX_KEYS = {
  lags: ['K', 'T1', 'T2'],
  dead: ['K', 'T', 'L'],
  second: ['K', 'wn', 'zeta'],
} as const;
export type FreqExKind = keyof typeof FREQ_EX_KEYS;
export interface FreqExPlant {
  kind: FreqExKind;
  /** the three values, in the order of FREQ_EX_KEYS[kind] */
  v: [number, number, number];
}
const sig2 = (x: number) => Number(x.toPrecision(2));
/** The hidden plant of frequency-response exercise number n (the same number always gives the same plant):
 *  the kind at random; lags: K in 0.5 … 5, T1 in 1 … 10 s, T2 = T1/(5 … 20) (2 significant digits);
 *  dead: the ranges of the step-response exercise; second: K in 0.5 … 3, ωn in 0.5 … 10 rad/s (log-uniform,
 *  2 significant digits), ζ in 0.1 … 0.7 (steps of 0.05) */
export function freqExercisePlant(n: number): FreqExPlant {
  const r = mulberry32(Math.floor(Math.abs(n)) * 2246822519 + 31),
    kinds: FreqExKind[] = ['lags', 'dead', 'second'],
    kind = kinds[Math.min(2, Math.floor(3 * r()))];
  if (kind === 'lags') {
    const K = Math.round((0.5 + 4.5 * r()) * 100) / 100,
      T1 = Math.round((1 + 9 * r()) * 10) / 10;
    return { kind, v: [K, T1, sig2(T1 / (5 + 15 * r()))] };
  }
  if (kind === 'dead') {
    const K = Math.round((0.5 + 2.5 * r()) * 100) / 100,
      T = Math.round((0.5 + 4.5 * r()) * 10) / 10,
      L = Math.round((0.1 + (Math.min(2, T) - 0.1) * r()) * 20) / 20;
    return { kind, v: [K, T, L] };
  }
  const K = Math.round((0.5 + 2.5 * r()) * 100) / 100,
    wn = sig2(0.5 * 20 ** r()),
    zeta = Math.round((0.1 + 0.6 * r()) * 20) / 20;
  return { kind, v: [K, wn, zeta] };
}
/** Gain [dB] and phase [deg] (continuous) of the plant at angular frequency w */
export function freqExResponse(p: FreqExPlant, w: number): { db: number; ph: number } {
  const [K, a, b] = p.v,
    deg = 180 / Math.PI,
    lag = (T: number) => 10 * Math.log10(1 + (w * T) ** 2);
  if (p.kind === 'lags')
    return { db: 20 * Math.log10(K) - lag(a) - lag(b), ph: -(Math.atan(w * a) + Math.atan(w * b)) * deg };
  if (p.kind === 'dead') return { db: 20 * Math.log10(K) - lag(a), ph: -(Math.atan(w * a) + w * b) * deg };
  const u = w / a;
  return {
    db: 20 * Math.log10(K) - 10 * Math.log10((1 - u * u) ** 2 + (2 * b * u) ** 2),
    ph: -Math.atan2(2 * b * u, 1 - u * u) * deg,
  };
}
/** Frequency range drawn [rad/s]: whole decades from a decade below the lowest corner to beyond the highest */
export function freqExRange(p: FreqExPlant): [number, number] {
  const [, a, b] = p.v,
    [lo, hi] = p.kind === 'lags' ? [0.1 / a, 10 / b] : p.kind === 'dead' ? [0.1 / a, 10 / a] : [a / 100, a * 100];
  return [10 ** Math.floor(Math.log10(lo) + 1e-9), 10 ** Math.ceil(Math.log10(hi) - 1e-9)];
}
/** Relative errors of the estimates and whether each is within tol; T1 and T2 may be given in either order */
export function freqExCheck(p: FreqExPlant, e: [number, number, number], tol = 0.1) {
  let est = e;
  if (p.kind === 'lags' && (e[1] - e[2]) * (p.v[1] - p.v[2]) < 0) est = [e[0], e[2], e[1]];
  const err = p.v.map((x, i) => Math.abs(est[i] - x) / x) as [number, number, number];
  return { est, err, ok: err.map(x => x <= tol) as [boolean, boolean, boolean] };
}
