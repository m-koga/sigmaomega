// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Time response: the second-order approximation by the dominant poles (formulas beside the simulation) ================= */
import { T } from './02-i18n.ts';
import { numStr } from './03-math.ts';
import { S, lastPZ, lastSim } from './11-state.ts';
import { dominantApprox, simulatedShape, stepFinal } from './30-second-order.ts';
import type { DominantApprox, StepShape } from './30-second-order.ts';
import { byId } from './40-dom.ts';
import { AFTER_UPDATE } from './62-update.ts';

let so2Timer: Timer | undefined;
AFTER_UPDATE.push(scheduleSO2);
export function scheduleSO2() {
  clearTimeout(so2Timer);
  so2Timer = setTimeout(renderSO2, 120);
}
const so2C = (z: Complex) => (z[1] === 0 ? numStr(z[0]) : `${numStr(z[0])} ± ${numStr(Math.abs(z[1]))}j`);
const so2Val = (v: number | null, u: string) => (v === null ? '—' : numStr(v) + u);
// The dominant poles with ζ, ωn (or τ), and the conditions of the approximation
function so2Head(a: DominantApprox): string {
  const head =
    a.kind === 'pair'
      ? T('Dominant poles: {p} (ζ = {z}, ωn = {w} rad/s, ωd = {d} rad/s)', {
          p: so2C(a.p),
          z: numStr(a.zeta),
          w: numStr(a.wn),
          d: numStr(a.wd),
        })
      : T('Dominant pole: {p} (real: first-order approximation, time constant τ = {t} s)', {
          p: numStr(a.p[0]),
          t: numStr(a.tau),
        });
  const notes: string[] = [];
  if (a.ratio === null) notes.push(T('There is no other pole: the approximation is exact up to the zeros.'));
  else
    notes.push(
      T(
        'The next pole is {r} times as far from the imaginary axis (the approximation is good when this is 5 or more).',
        {
          r: numStr(a.ratio),
        },
      ),
    );
  if (a.zeros.length)
    notes.push(
      T('Zeros of Gyr near the dominant poles or in the right half-plane change the response: {z}', {
        z: a.zeros.map(so2C).join(', '),
      }),
    );
  if (a.cancelled.length)
    notes.push(T('Left out, as a zero of Gyr nearly cancels them: {p}', { p: a.cancelled.map(so2C).join(', ') }));
  if (a.approx) notes.push(T('With a dead time, the poles are those of its third-order Padé approximation.'));
  const bad = (a.ratio !== null && a.ratio < 5) || a.zeros.length > 0;
  return `<p><b>${head}</b></p><ul class="so2-notes${bad ? ' warn' : ''}">${notes.map(n => `<li>${n}</li>`).join('')}</ul>`;
}
// The table: each metric with its formula, the value of the approximation and the simulated value
function so2Table(a: DominantApprox, sim: StepShape | null): string {
  const f = a.formula,
    pair = a.kind === 'pair';
  const rows: [string, string, number | null, number | null, string][] = [
    [T('Overshoot'), pair ? '\\(100\\,e^{-\\pi\\zeta/\\sqrt{1-\\zeta^2}}\\)' : '0', f.os, sim?.os ?? null, ' %'],
    [T('Peak time'), pair ? '\\(\\pi/\\omega_d\\)' : '—', f.tp, sim?.tp ?? null, ' s'],
    [T('Settling time (±2%)'), pair ? '\\(4/(\\zeta\\omega_n)\\)' : '\\(4\\tau\\)', f.ts, sim?.ts ?? null, ' s'],
    [
      T('Rise time (10–90%)'),
      pair ? '\\((1+1.039\\zeta-0.417\\zeta^2+1.76\\zeta^3)/\\omega_n\\)' : '\\(2.2\\tau\\)',
      f.tr,
      sim?.tr ?? null,
      ' s',
    ],
  ];
  return (
    `<div class="pzwrap-tbl"><table class="pzt so2"><thead><tr><th>${T('Metric')}</th><th>${T('Formula')}</th><th>${T('Approximation')}</th><th>${T('Simulation')}</th></tr></thead><tbody>` +
    rows
      .map(([n, fm, v, s, u]) => `<tr><td>${n}</td><td>${fm}</td><td>${so2Val(v, u)}</td><td>${so2Val(s, u)}</td></tr>`)
      .join('') +
    '</tbody></table></div>'
  );
}
/** The tab "Second-order approximation" under the time response */
export function renderSO2() {
  const box = byId('so2Box');
  if (!box) return;
  const a = lastPZ ? dominantApprox(lastPZ) : null;
  if (!a) {
    box.innerHTML = `<p class="note">${T('The closed loop is not stable: there are no dominant poles to approximate it by.')}</p>`;
    return;
  }
  const yf = stepFinal(),
    sim = lastSim ? simulatedShape(lastSim, yf) : null;
  box.innerHTML =
    so2Head(a) +
    so2Table(a, sim) +
    `<p class="note">${T('All values are relative to the final value of the response. The simulated values are measured for a step reference only{d}.', { d: S.sat ? T(', and saturation makes the response differ') : '' })}</p>`;
  if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([box]).catch(() => {});
}
