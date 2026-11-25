// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Parameter sweep ================= */
import { LANG, T } from './02-i18n.ts';
import { CTRL, MODE_PARAMS, PARAMS, PID_MODES, PLANTS, TDOF } from './03-definitions.ts';
import { numStr } from './04-parser.ts';
import { S } from './05-state.ts';
import { $, BIG, HARD, fmtVal, renderTeX } from './06-ui-build.ts';
import { simulate, stepMetrics } from './07-simulation.ts';
import { bodeRange, freqResp } from './08-frequency.ts';
import { SPEC_KEYS, evalSpecs, specIcon } from './14-specs.ts';
import { computePZ, lastSweep, update } from './16-pole-zero.ts';

export const SWEEP_COLORS = ['#0f9d8a', '#c99700', '#c2185b', '#558b2f', '#8d6e63', '#0097a7', '#ec7fa9', '#455a64'];
export const SWEEP_SYM: Record<string, string> = {
  K: 'K',
  T: 'T',
  zeta: 'ζ',
  wn: 'ωn',
  L: 'L',
  Kp: 'KP',
  Ki: 'KI',
  Kd: 'KD',
  N: 'N',
  Kc: 'Kc',
  T1: 'T1',
  alpha: 'α',
  T2: 'T2',
  beta: 'β',
  bw: 'b',
  cw: 'c',
};
export const SWEEP_MAX = 8;
export let sweepKeys = ''; // parameters and language of the sweep inputs last built (rebuilt when they change)
// The sweep inputs are rebuilt at the next update (after the settings were replaced)
export function resetSweepUI() {
  sweepKeys = '';
}
export const paramDef = (p: string): ParamDef => PARAMS[p] || CTRL[p] || TDOF[p];
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
// Values around v: ×0.5, ×1, ×2, ×4 (spread around 1 for ratios that must stay in their ranges)
export function sweepDefaults(p: NumKey): number[] {
  const v = S[p],
    [lo, hi] = HARD[p] || [-BIG, BIG];
  let vals = v === 0 ? [0.5, 1, 2, 4].map(x => x * (paramDef(p).max / 10 || 1)) : [0.5, 1, 2, 4].map(x => x * v);
  if (p === 'alpha') vals = [0.05, 0.1, 0.2, 0.4];
  if (p === 'beta') vals = [2, 5, 10, 20];
  if (p === 'zeta') vals = [0.1, 0.3, 0.7, 1];
  if (p === 'bw' || p === 'cw') vals = [0, 0.25, 0.5, 1];
  return [...new Set(vals.map(x => +Math.min(hi, Math.max(lo, x)).toPrecision(4)))];
}
export function parseSweep(str: string, p: NumKey): number[] {
  const [lo, hi] = HARD[p] || [-BIG, BIG];
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
export const sweepName = (p: string, v: number) => `${SWEEP_SYM[p] || p} = ${numStr(v)}`;
export function renderSweepUI() {
  const ps = sweepParams(),
    key = ps.join(',') + '|' + LANG;
  if (!ps.includes(S.sweep.p) && ps.length) {
    S.sweep.p = (['Kp', 'Kc'] as NumKey[]).find(k => ps.includes(k)) || ps[0];
    S.sweep.vals = sweepDefaults(S.sweep.p);
  }
  if (key !== sweepKeys) {
    sweepKeys = key;
    $('sw-p').innerHTML = ps.map(p => `<option value="${p}">${plainLabel(p)}</option>`).join('');
  }
  $('sw-p').value = S.sweep.p;
  $('sw-on').checked = S.sweep.on;
  if (document.activeElement !== $('sw-v')) $('sw-v').value = S.sweep.vals.map(v => numStr(v)).join(', ');
  $('sw-form').classList.toggle('disabled', !S.sweep.on);
  $('sw-def').classList.toggle('disabled', !S.sweep.on);
}
export function renderSweepTable() {
  const box = $('sw-table');
  if (!lastSweep) {
    box.innerHTML = '';
    return;
  }
  const p = S.sweep.p,
    time = S.refType === 'step' || S.refType === 'trap';
  const f = (v: number | null | undefined, d: number, u = '') =>
    v === null || v === undefined || !isFinite(v) ? '—' : (+v.toFixed(d)).toString() + u;
  const cell = (k: SpecKey, r: SweepRun, txt: string) => `<td>${specIcon(k, r.ev)}${txt}</td>`;
  const rows = lastSweep
    .map((r, i) => {
      const sp = SPEC_KEYS.filter(k => r.ev[k].on && r.ev[k].applicable),
        bad = sp.filter(k => !r.ev[k].ok).length;
      const all = sp.length ? (bad ? '<span class="sp ng">✗</span>' : '<span class="sp ok">✓</span>') : '—';
      return `<tr data-i="${i}" class="${Math.abs(r.v - S[p]) < 1e-12 * Math.max(1, Math.abs(r.v)) ? 'cur' : ''}" title="${T('Click to apply this value')}">
      <td><span class="sw-sw" style="background:${SWEEP_COLORS[i]}"></span>${numStr(r.v)}</td>
      ${cell('os', r, time && r.mt ? f(r.mt.os, 1) : '—')}
      ${cell('ts', r, time && r.mt ? (r.mt.ts === null ? '—' : f(r.mt.ts, 2)) : '—')}
      ${cell('pm', r, r.fr.pm === null ? '∞' : f(r.fr.pm, 1))}
      ${cell('gm', r, r.fr.gm === null ? '∞' : f(r.fr.gm, 1))}
      <td>${r.stable ? '<span class="sp ok">✓</span>' : '<span class="sp ng">✗</span>'}</td><td>${all}</td></tr>`;
    })
    .join('');
  box.innerHTML = `<table class="sw-tab"><thead><tr><th>${SWEEP_SYM[p] || p}</th><th>${T('Overshoot [%]')}</th><th>${T('Settling [s]')}</th><th>PM [°]</th><th>GM [dB]</th><th>${T('Stable')}</th><th>${T('Specs')}</th></tr></thead><tbody>${rows}</tbody></table>`;
  box.querySelectorAll<HTMLElement>('tbody tr').forEach(
    tr =>
      (tr.onclick = () => {
        const r = lastSweep?.[Number(tr.dataset.i)];
        if (r) applySweepValue(r.v);
      }),
  );
}
export function applySweepValue(v: number) {
  const p = S.sweep.p,
    d = paramDef(p);
  S[p] = v;
  const el = $(`in-${p}`),
    nm = $(`v-${p}`);
  if (el) {
    el.value = String(v);
    nm.value = fmtVal(p, v, d);
  }
  if (PLANTS[S.plant].p.includes(p)) renderTeX();
  update();
}
export function buildSweep() {
  $('sw-on').onchange = () => {
    S.sweep.on = $('sw-on').checked;
    update();
  };
  $('sw-p').onchange = () => {
    S.sweep.p = $('sw-p').value as NumKey;
    S.sweep.vals = sweepDefaults(S.sweep.p);
    update();
  };
  $('sw-v').onchange = () => {
    const v = parseSweep($('sw-v').value, S.sweep.p);
    if (v.length) S.sweep.vals = v;
    $('sw-v').value = S.sweep.vals.map(x => numStr(x)).join(', ');
    update();
  };
  $('sw-v').onkeydown = e => {
    if (e.key === 'Enter') $('sw-v').blur();
  };
  $('sw-def').onclick = () => {
    S.sweep.vals = sweepDefaults(S.sweep.p);
    if (!S.sweep.on) S.sweep.on = true;
    update();
  };
}
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
