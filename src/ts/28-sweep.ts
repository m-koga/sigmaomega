// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Parameter sweep ================= */
import { T } from './02-i18n.ts';
import { numStr } from './03-math.ts';
import { MODE_PARAMS, PID_MODES, PLANTS, hardRange, paramDef, paramSym } from './10-definitions.ts';
import { S, lastSweep } from './11-state.ts';
import { bodeRange, freqResp } from './15-frequency.ts';
import { simulate, stepMetrics } from './16-simulation.ts';
import { computePZ } from './17-loop.ts';
import { evalSpecs } from './27-specs.ts';

export const SWEEP_COLORS = ['#0f9d8a', '#c99700', '#c2185b', '#558b2f', '#8d6e63', '#0097a7', '#ec7fa9', '#455a64'];
export const SWEEP_MAX = 8;
// Parameters that affect the current plant and controller
export function sweepParams(st: State = S): NumKey[] {
  return [
    ...PLANTS[st.plant].p,
    ...MODE_PARAMS[st.mode],
    ...(PID_MODES.includes(st.mode) && st.tdof ? (['bw', 'cw'] as NumKey[]) : []),
  ];
}
export function plainLabel(p: string): string {
  return T(paramDef(p).label)
    .replace(/\\\(|\\\)/g, '')
    .replace(/\\zeta/g, 'ζ')
    .replace(/\\omega_n/g, 'ωn')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/_\{?(\w+)\}?/g, '$1');
}
// Values around v: ×0.5, ×1, ×2, ×4, or the values sweep of the parameter's definition (for ratios that must stay
// in their ranges)
export function sweepDefaults(p: NumKey): number[] {
  const v = S[p],
    def = paramDef(p),
    [lo, hi] = hardRange(p);
  const vals =
    def.sweep ?? (v === 0 ? [0.5, 1, 2, 4].map(x => x * (def.max / 10 || 1)) : [0.5, 1, 2, 4].map(x => x * v));
  return [...new Set(vals.map(x => +Math.min(hi, Math.max(lo, x)).toPrecision(4)))];
}
export function parseSweep(str: string, p: NumKey): number[] {
  const [lo, hi] = hardRange(p);
  const vals = String(str)
    .split(/[\s,;、，]+/)
    .map(parseFloat)
    .filter(isFinite)
    .map(x => +Math.min(hi, Math.max(lo, x)).toPrecision(6));
  return [...new Set(vals)].slice(0, SWEEP_MAX);
}
// Run the simulation and analyses for each value of the swept parameter
// Runs of the parameter sweep: each value of the swept parameter computed on a copy of the settings
// (null when the sweep is off or the parameter does not apply to the current controller)
export function sweepRuns(st: State = S): SweepRun[] | null {
  const p = st.sweep.p;
  if (!st.sweep.on || !sweepParams(st).includes(p)) return null;
  // the Bode curves of all runs use the range of the current settings when it is set by hand
  const rng = bodeRange(st);
  return st.sweep.vals.map(v => {
    const run: State = { ...st, [p]: v };
    const sim = simulate(run),
      fr = freqResp(run),
      frB = rng ? freqResp(run, rng) : null,
      pz = computePZ(run);
    const mt = (run.refType === 'step' || run.refType === 'trap') && !sim.diverged ? stepMetrics(sim, run) : null;
    return {
      v,
      sim,
      fr,
      frB,
      pz,
      mt,
      ev: evalSpecs(sim, fr, pz, run),
      stable: !sim.diverged && pz.cl.every(z => z[0] < 0),
    };
  });
}
export const sweepName = (p: string, v: number) => `${paramSym(p)} = ${numStr(v)}`;
// Series of the sweep for a plot: f(run) gives {x, y}
export const sweepSeries = (
  f: (r: SweepRun) => { x: number[]; y: number[] },
  extra: Partial<PlotSeries> = {},
): PlotSeries[] =>
  (lastSweep || []).map((r, i) => ({
    ...f(r),
    color: SWEEP_COLORS[i],
    width: 1.6,
    name: sweepName(S.sweep.p, r.v),
    ...extra,
  }));
