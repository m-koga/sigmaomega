// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= State ================= */
import { CTRL, DIST, INPUTS, PARAMS, REFP, SAT, TDOF, entriesOf, specDefaults } from './03-definitions.ts';
import { parsePoly } from './04-parser.ts';

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
