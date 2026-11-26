// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= State: the settings, what follows directly from them, and the last results ================= */
import { parsePoly } from './04-parser.ts';
import {
  CONTROLLERS,
  CTRL,
  DIST,
  INPUTS,
  PARAMS,
  REFP,
  SAT,
  TDOF,
  ctrlDefault,
  entriesOf,
  specDefaults,
} from './05-definitions.ts';

export const S = {} as State; // filled by defaults()
export function defaults() {
  entriesOf({ ...PARAMS, ...CTRL, ...REFP, ...INPUTS, ...DIST, ...SAT, ...TDOF }).forEach(([k, d]) => (S[k] = d.val));
  S.tdof = false;
  S.refType = 'step';
  S.Tsim = 20;
  S.plant = 'first';
  S.mode = 'PID';
  S.dOnMeas = false;
  S.dOn = false;
  S.sat = false;
  S.aw = true;
  S.cNumStr = '1';
  S.cDenStr = '(s+1)(0.5s+1)(0.2s+1)';
  S.cNum = parsePoly(S.cNumStr);
  S.cDen = parsePoly(S.cDenStr);
  S.cUnstable = false;
  S.L_custom = 0;
  S.ccNumStr = '2s + 1';
  S.ccDenStr = 's';
  S.ccNum = parsePoly(S.ccNumStr);
  S.ccDen = parsePoly(S.ccDenStr);
  S.ccUnstable = false;
  S.spec = specDefaults();
  S.tune = { method: 'zn-step', type: 'PID', lam: null };
  S.sweep = { on: false, p: 'Kp', vals: [1, 2, 4, 8] };
  S.wr = { on: false, lo: 0.01, hi: 100, sig: '' };
}
defaults();
export let ghosts: Ghost[] = [];
// Results of the last update() (18-update.ts), drawn by redraw(); set with setResults
export let lastSim: SimResult | null = null,
  lastFr: FreqResult | null = null,
  lastFrB: FreqResult | null = null,
  lastPZ: PZResult | null = null,
  lastSweep: SweepRun[] | null = null;
export function setResults(r: {
  sim?: SimResult | null;
  fr?: FreqResult | null;
  frB?: FreqResult | null;
  pz?: PZResult | null;
  sweep?: SweepRun[] | null;
}) {
  if (r.sim !== undefined) lastSim = r.sim;
  if (r.fr !== undefined) lastFr = r.fr;
  if (r.frB !== undefined) lastFrB = r.frB;
  if (r.pz !== undefined) lastPZ = r.pz;
  if (r.sweep !== undefined) lastSweep = r.sweep;
}
// Controllers handled as transfer functions (lead, lag, custom)
export const isTFMode = (st: State = S) => CONTROLLERS[st.mode].kind === 'tf';
// Switching from kind prev to kind next: a parameter still at the initial value of prev gets the initial value
// of next (a value changed by hand is kept)
export function switchDefaults(prev: string, next: string, st: State = S): NumKey[] {
  const keys = [
      ...new Set([
        ...Object.keys(CONTROLLERS[prev]?.defaults ?? {}),
        ...Object.keys(CONTROLLERS[next]?.defaults ?? {}),
      ]),
    ] as NumKey[],
    changed = keys.filter(k => st[k] === ctrlDefault(prev, k) && ctrlDefault(next, k) !== st[k]);
  changed.forEach(k => (st[k] = ctrlDefault(next, k)));
  return changed; // the parameters whose inputs need to show the new value
}
export function ctrlRational(st: State = S): Rational {
  return CONTROLLERS[st.mode].rational(st);
}
export function refValue(t: number, st: State = S): number {
  const R = st.R,
    tau = t - st.rT0;
  if (tau < 0) return 0;
  switch (st.refType) {
    case 'ramp':
      return R * tau;
    case 'parab':
      return 0.5 * R * tau * tau;
    case 'trap':
      return R * Math.min(tau / st.rW, 1);
    case 'pulse':
      return tau < st.rW ? R : 0;
    case 'square':
      return tau % st.rPer < st.rPer / 2 ? R : 0;
    case 'sine':
      return R * Math.sin((2 * Math.PI * tau) / st.rPer);
    case 'impulse':
      return 0; // the impulse itself is applied by the simulation (08-simulation.ts)
    default:
      return R;
  }
}
