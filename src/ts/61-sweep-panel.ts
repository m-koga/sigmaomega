// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Parameter sweep: its inputs and the table of results ================= */
import { LANG, T } from './02-i18n.ts';
import { numStr } from './03-math.ts';
import { SPEC_KEYS, paramSym } from './10-definitions.ts';
import { S, lastSweep } from './11-state.ts';
import { specIcon } from './27-specs.ts';
import { SWEEP_COLORS, plainLabel, sweepDefaults, sweepParams } from './28-sweep.ts';
import { $ } from './40-dom.ts';
export let sweepKeys = ''; // parameters and language of the sweep inputs last built (rebuilt when they change)
// The sweep inputs are rebuilt at the next update (after the settings were replaced)
export function resetSweepUI() {
  sweepKeys = '';
}
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
  box.innerHTML = `<table class="sw-tab"><thead><tr><th>${paramSym(p)}</th><th>${T('Overshoot [%]')}</th><th>${T('Settling [s]')}</th><th>PM [°]</th><th>GM [dB]</th><th>${T('Stable')}</th><th>${T('Specs')}</th></tr></thead><tbody>${rows}</tbody></table>`;
}
