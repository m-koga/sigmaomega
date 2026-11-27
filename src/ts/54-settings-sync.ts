// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Settings panel: showing the state in its inputs ================= */
import { T } from './02-i18n.ts';
import { lastOf, numStr } from './03-math.ts';
import { COMP_MODES, CTRL, MODE_PARAMS, PID_MODES, hasTerm } from './10-definitions.ts';
import { S, ctrlRational } from './11-state.ts';
import { $, must } from './40-dom.ts';
import { syncBlockDiagram } from './53-block-diagram.ts';

// Label around a check box (shown, hidden or greyed out with it)
export const labelOf = (id: 'dOnMeas' | 'tdof' | 'aw') => must($(id).parentElement, `label of ${id}`);
export function syncControls() {
  $('plant').value = S.plant;
  $('mode').value = S.mode;
  $('dOnMeas').checked = S.dOnMeas;
  $('dOn').checked = S.dOn;
  $('sat').checked = S.sat;
  $('aw').checked = S.aw;
  $('tdof').checked = S.tdof;
  syncControllerRows();
  const info = $('ctrl-info'),
    html = compensatorInfo();
  info.innerHTML = html;
  info.style.display = html ? '' : 'none';
  $('dist-params').classList.toggle('disabled', !S.dOn);
  $('sat-params').classList.toggle('disabled', !S.sat);
  labelOf('aw').classList.toggle('disabled', !S.sat || !hasTerm(S, 'I'));
  syncBlockDiagram();
  syncTimeSliders();
}
// Controller inputs of the selected kind: PID-type modes show all four gains (unused ones greyed out),
// derivative on y only and 2-DOF only for PID-type modes; no inputs for a transfer function
export function syncControllerRows() {
  const m = S.mode,
    isPID = PID_MODES.includes(m),
    shown = isPID ? ['Kp', 'Ki', 'Kd', 'N'] : MODE_PARAMS[m];
  $('ctrl-params').style.display = MODE_PARAMS[m].length ? '' : 'none';
  (Object.keys(CTRL) as NumKey[]).forEach(k => {
    const row = $(`row-${k}`);
    if (!row) return;
    row.style.display = shown.includes(k) ? '' : 'none';
    row.classList.toggle('disabled', isPID && !MODE_PARAMS[m].includes(k));
  });
  labelOf('dOnMeas').style.display = isPID ? '' : 'none';
  labelOf('dOnMeas').classList.toggle('disabled', !hasTerm(S, 'D'));
  labelOf('tdof').style.display = isPID ? '' : 'none';
  $('tdof-params').style.display = isPID && S.tdof ? '' : 'none';
  $('row-bw').classList.toggle('disabled', !hasTerm(S, 'P'));
  $('row-cw').classList.toggle('disabled', !hasTerm(S, 'D') || S.dOnMeas);
}
// Characteristics of a lead/lag compensator: maximum phase lead/lag and where, gain at low and high
// frequencies (empty for other controllers)
export function compensatorInfo(): string {
  const m = S.mode;
  if (!COMP_MODES.includes(m)) return '';
  const deg = (x: number) => (x * 180) / Math.PI,
    out: string[] = [];
  if (MODE_PARAMS[m].includes('alpha')) {
    const a = S.alpha;
    out.push(
      T('<b>Phase lead</b>: max {a}° (ω = {w} rad/s)', {
        a: numStr(deg(Math.asin((1 - a) / (1 + a)))),
        w: numStr(1 / (S.T1 * Math.sqrt(a))),
      }),
    );
  }
  if (MODE_PARAMS[m].includes('beta')) {
    const b = S.beta;
    out.push(
      T('<b>Phase lag</b>: max {a}° (ω = {w} rad/s)', {
        a: numStr(deg(Math.asin((b - 1) / (b + 1)))),
        w: numStr(1 / (S.T2 * Math.sqrt(b))),
      }),
    );
  }
  const r = ctrlRational(),
    g0 = lastOf(r.num) / lastOf(r.den),
    ginf = (r.num[0] / r.den[0]) * (r.num.length === r.den.length ? 1 : 0);
  const db = (g: number) => numStr(20 * Math.log10(Math.abs(g)));
  out.push(
    T('<b>Gain</b>: low frequency {g0} ({d0} dB), high frequency {g1} ({d1} dB)', {
      g0: numStr(g0),
      d0: db(g0),
      g1: numStr(ginf),
      d1: db(ginf),
    }),
  );
  return out.join('<br>');
}
// Time and period sliders: range and step follow the simulation time (fraction lo … hi of it)
export function syncTimeSliders() {
  const sliders: [NumKey, number, number][] = [
    ['td', 0, 1],
    ['rT0', 0, 1],
    ['rPer', 0.002, 1],
    ['rW', 0.002, 1],
  ];
  sliders.forEach(([k, lo, hi]) => {
    const el = $(`in-${k}`);
    if (!el) return;
    el.min = String(lo * S.Tsim);
    el.max = String(hi * S.Tsim);
    el.step = String(S.Tsim / 1000);
    el.value = String(S[k]);
    if (document.activeElement !== $(`v-${k}`)) $(`v-${k}`).value = String(+(+S[k]).toPrecision(6));
  });
}
