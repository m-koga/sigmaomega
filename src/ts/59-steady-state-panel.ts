// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= System type and steady-state error panel ================= */
import { T } from './02-i18n.ts';
import { nT, numStr } from './03-math.ts';
import { REF_TYPES } from './10-definitions.ts';
import { S, lastPZ, lastSim } from './11-state.ts';
import { metricWindow } from './16-simulation.ts';
import { errorConstants, steadyErrors } from './22-steady-state-error.ts';
import type { ErrorConstants } from './22-steady-state-error.ts';
import { byId } from './40-dom.ts';
/* ---- System type and steady-state error ---- */
// A value that may be infinite; a product with an amplitude (∞ × 0 = 0: no input, no error)
const infStr = (v: number) => (v === Infinity ? '∞' : v === -Infinity ? '−∞' : numStr(Math.abs(v) < 1e-12 ? 0 : v));
const timesAmp = (v: number, a: number) => (a === 0 ? 0 : !isFinite(v) ? v * Math.sign(a) : v * a);
// The row of the reference table for each kind of reference (the trapezoid ends at a constant like a step)
const SSE_ROW: Record<string, number> = { step: 0, trap: 0, ramp: 1, parab: 2 };
const REF_SYM = ['r<sub>0</sub>', 'v', 'a'];
let sseTimer: Timer | undefined;
export function scheduleSSE() {
  clearTimeout(sseTimer);
  sseTimer = setTimeout(renderSSE, 120);
}
// The panel: the system type and the error constants of L(s), the steady-state errors to a step, ramp and parabola
// of the reference and to a step disturbance (from the series of 1 − G_yr(s) and G_yd(s) at s = 0), beside the
// error at the end of the simulation
type SteadyErrors = ReturnType<typeof steadyErrors>;
// The system type of L(s), its approximation near s = 0 and the table of the error constants
function sseConstantsHTML(k: ErrorConstants): string {
  const near = k.zeroAtOrigin
    ? T('L(s) has a zero at the origin: L(0) = 0, so every error constant is 0.')
    : k.type === 0
      ? T('Type 0: L(s) has no pole at the origin (no integrator).')
      : T('Type {n}: L(s) has {n} pole(s) at the origin (integrators).', { n: k.type });
  const approx = k.zeroAtOrigin
    ? ''
    : k.type === 0
      ? `\\[L(0)=${nT(k.K)}\\]`
      : `\\[L(s)\\simeq\\dfrac{${nT(k.K)}}{${k.type === 1 ? 's' : `s^{${k.type}}`}}\\quad(s\\to 0)\\]`;
  const consts: [string, string, string, number][] = [
    ['Position error constant', 'K_p', '\\lim_{s\\to 0}L(s)', k.Kp],
    ['Velocity error constant', 'K_v', '\\lim_{s\\to 0}sL(s)', k.Kv],
    ['Acceleration error constant', 'K_a', '\\lim_{s\\to 0}s^2L(s)', k.Ka],
  ];
  const ctab =
    `<table class="pzt"><tr><th></th><th>${T('Definition')}</th><th>${T('Value')}</th></tr>` +
    consts
      .map(
        ([name, sym, def, v]) =>
          `<tr><th class="rn">${T(name)}</th><td>\\(${sym}=${def}\\)</td><td class="fc">${infStr(v)}</td></tr>`,
      )
      .join('') +
    '</table>';
  return `<p>${near}</p>${approx}${ctab}`;
}
// The table of the errors to a step, ramp and parabola of the reference: from 1 − G_yr(s) (and from the constants,
// the textbook formulas, when they differ: with set-point weights), for the current amplitude, and in the
// simulation (the row of the current reference). differ: the formulas do not hold
function sseReferenceTable(
  k: ErrorConstants,
  e: SteadyErrors,
  sim: SimResult | null,
): { html: string; differ: boolean } {
  const cur = SSE_ROW[S.refType] ?? -1,
    book = [1 / (1 + k.Kp), k.Kv === 0 ? Infinity : 1 / k.Kv, k.Ka === 0 ? Infinity : 1 / k.Ka],
    same = (a: number, b: number) => a === b || Math.abs(a - b) <= 1e-9 * (1 + Math.abs(b)),
    differ = !!e && e.ref.some((v, i) => !same(v, book[i])),
    eRef = (i: number) => (e ? e.ref[i] : NaN);
  // the error at the end of the window before the disturbance, with its time
  const simAt = () => {
    if (!sim) return '—';
    const w = metricWindow(sim);
    return `${numStr(sim.R[w.last] - sim.Y[w.last])}<br><small>t = ${numStr(sim.T[w.last])} s</small>`;
  };
  const refs: [string, string, string][] = [
    ['step', 'r(t)=r_0', 'e_{ss}=\\dfrac{r_0}{1+K_p}'],
    ['ramp', 'r(t)=v\\,t', 'e_{ss}=\\dfrac{v}{K_v}'],
    ['parab', 'r(t)=\\tfrac{a}{2}t^2', 'e_{ss}=\\dfrac{a}{K_a}'],
  ];
  const html =
    `<table class="pzt"><tr><th>${T('Reference')}</th><th>${T('Unit input')}</th>` +
    `<th>${T('Current setting')}</th><th>${T('Simulation')}</th></tr>` +
    refs
      .map(([key, r, f], i) => {
        const on = i === cur;
        return (
          `<tr${on ? ' class="cur"' : ''}><th class="rn">${T(REF_TYPES[key].name)}<br>\\(${r}\\)<br>\\(${f}\\)</th>` +
          `<td class="fc">${infStr(e ? eRef(i) : book[i])}${differ && !same(eRef(i), book[i]) ? `<br><small>${T('formula: {v}', { v: infStr(book[i]) })}</small>` : ''}</td>` +
          `<td>${on && e ? infStr(timesAmp(eRef(i), S.R)) + `<br><small>${REF_SYM[i]} = ${numStr(S.R)}</small>` : ''}</td><td>${on ? simAt() : ''}</td></tr>`
        );
      })
      .join('') +
    '</table>';
  return { html, differ };
}
// The table of the error to a step disturbance at the plant input: per unit, for the current d, and its change
// after the disturbance in the simulation
function sseDisturbanceTable(e: SteadyErrors, sim: SimResult | null): string {
  const dOn = S.dOn && S.td < S.Tsim;
  let dSim = '—';
  if (sim && dOn) {
    const w = metricWindow(sim),
      n = sim.T.length - 1;
    dSim = `${numStr(sim.R[n] - sim.Y[n] - (sim.R[w.last] - sim.Y[w.last]))}<br><small>t = ${numStr(sim.T[n])} s</small>`;
  }
  return (
    `<table class="pzt"><tr><th>${T('Unit input')}</th><th>${T('Current setting')}</th><th>${T('Simulation')}</th></tr>` +
    `<tr><td class="fc">${e ? infStr(e.dist) : '—'}</td><td>${e && dOn ? `${infStr(e.dist * S.d)}<br><small>d = ${numStr(S.d)}</small>` : T('(no disturbance)')}</td><td>${dOn ? dSim : ''}</td></tr></table>`
  );
}
// The notes under the tables: what differs from the textbook formulas and from the simulation
function sseNotesHTML(differ: boolean, pz: PZResult | null): string {
  return [
    differ
      ? T(
          'With set-point weights the controller acts on the reference as C_r(s), not on e = r − y: the formulas with K_p, K_v and K_a do not hold. The errors shown are found from E(s)/R(s) = 1 − G_yr(s) (the values of the formulas in small type).',
        )
      : '',
    T(
      'Simulation: the error e = r − y at the end of the simulation (before the disturbance); for the disturbance, its change after the disturbance. If the response has not settled, lengthen the simulation time.',
    ),
    pz?.pade
      ? T(
          'With a dead time: e^(−Ls) → 1 as s → 0, so the dead time does not change the system type or the error constants.',
        )
      : '',
    S.sat ? T('With the saturation of u, the simulation can differ from these linear results.') : '',
    S.noise > 0 ? T('With measurement noise, the simulated error fluctuates.') : '',
  ]
    .filter(Boolean)
    .map(t => `<p class="note">${t}</p>`)
    .join('');
}
export function renderSSE() {
  const box = byId('sseBox'),
    k = errorConstants(),
    e = steadyErrors(),
    pz = lastPZ,
    stable = !!e && !!pz && pz.cl.every(z => z[0] < 0),
    sim = lastSim && !lastSim.diverged ? lastSim : null,
    ref = sseReferenceTable(k, e, sim);
  const warn = !e
    ? `<p class="verdict bad">${T('The closed loop has a pole at the origin: the error does not settle.')}</p>`
    : !stable
      ? `<p class="verdict bad">${T('The closed loop is unstable: the error does not settle, and these values do not apply.')}</p>`
      : '';
  box.innerHTML =
    warn +
    `<h4>${T('System type and error constants')}</h4>` +
    sseConstantsHTML(k) +
    `<h4>${T('Steady-state error to the reference')}</h4>` +
    `<p>\\(e(t)=r(t)-y(t),\\quad e_{ss}=\\lim_{t\\to\\infty}e(t)=\\lim_{s\\to 0}sE(s)\\)</p>${ref.html}` +
    `<h4>${T('Steady-state error to a step disturbance')}</h4>` +
    `<p>${T('A step disturbance d at the plant input:')} \\(e_{ss}=-d\\lim_{s\\to 0}G_{yd}(s),\\ G_{yd}(s)=\\dfrac{P(s)}{1+L(s)}\\). ${T('An integrator in the controller C(s) removes this error; one in the plant P(s) does not.')}</p>${sseDisturbanceTable(e, sim)}` +
    sseNotesHTML(ref.differ, pz);
  if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([box]).catch(() => {});
}
