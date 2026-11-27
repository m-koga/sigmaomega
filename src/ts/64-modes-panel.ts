// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Time response: its modes (the term of each pole, from the partial fractions) as formulas and curves ================= */
import { T } from './02-i18n.ts';
import { nT, numStr } from './03-math.ts';
import { S, lastSim } from './11-state.ts';
import { metricWindow } from './16-simulation.ts';
import { modeValue, responseModes, sortedModes } from './31-modes.ts';
import type { Mode, ModeResult } from './31-modes.ts';
import { byId } from './40-dom.ts';
import { AFTER_UPDATE } from './62-update.ts';

let modesTimer: Timer | undefined;
AFTER_UPDATE.push(scheduleModes);
export function scheduleModes() {
  clearTimeout(modesTimer);
  modesTimer = setTimeout(renderModes, 120);
}
const modeC = (z: Complex) => (z[1] === 0 ? numStr(z[0]) : `${numStr(z[0])} ± ${numStr(z[1])}j`);
// t^k as TeX (with the factorial already in the coefficient)
const tPow = (k: number) => (k === 0 ? '' : k === 1 ? 't' : `t^{${k}}`);
// e^{σt} as TeX (nothing for σ = 0)
const eTeX = (s: number) => (Math.abs(s) < 1e-12 ? '' : `e^{${nT(s)}t}`);
/** The parts of the term of a mode as [coefficient, rest of the term in TeX], summed in y(t) */
function modeParts(m: Mode): [number, string][] {
  const [s, w] = m.p,
    out: [number, string][] = [];
  let fact = 1;
  m.c.forEach((c, k) => {
    if (k > 0) fact *= k;
    if (w === 0) out.push([c[0] / fact, `${tPow(k)}${eTeX(s)}`]);
    else {
      const ph = Math.atan2(c[1], c[0]);
      const cos = `\\cos(${nT(w)}t${ph < 0 ? '-' : '+'}${nT(Math.abs(ph))})`;
      out.push([(2 * Math.hypot(c[0], c[1])) / fact, `${tPow(k)}${eTeX(s)}${cos}`]);
    }
  });
  return out.filter(([v]) => Math.abs(v) > 1e-12);
}
/** A sum of parts as TeX: 0.5 − 1.2e^{−t} + … */
function sumTeX(parts: [number, string][]): string {
  if (!parts.length) return '0';
  return parts
    .map(([v, r], i) => {
      const a = Math.abs(v),
        coef = r && Math.abs(a - 1) < 1e-12 ? '' : nT(a);
      return `${v < 0 ? '-' : i ? '+' : ''}${coef}${r}`;
    })
    .join('');
}
// The largest difference between the sum of the modes and the simulated y(t), up to the disturbance or the end
function simDifference(r: ModeResult): number | null {
  if (!lastSim || lastSim.diverged) return null;
  const { last } = metricWindow(lastSim);
  let d = 0;
  for (let i = 0; i <= last; i++) {
    const u = lastSim.T[i] - r.t0;
    const y = r.modes.reduce((a, m) => a + modeValue(m, u), 0);
    d = Math.max(d, Math.abs(y - lastSim.Y[i]));
  }
  return d;
}
// The rows of the table: each mode with its pole, its term, its time constant and what it is
function modeRows(r: ModeResult): string {
  return r.modes
    .map(m => {
      const what =
        m.kind === 'input' ? T('Forced response (pole of the reference)') : T('Transient (closed-loop pole)');
      const tc = m.p[0] < 0 ? numStr(-1 / m.p[0]) + ' s' : '—';
      return `<tr><td>${modeC(m.p)}${m.mult > 1 ? ` (×${m.mult})` : ''}</td><td>\\(${sumTeX(modeParts(m))}\\)</td><td>${tc}</td><td>${what}</td></tr>`;
    })
    .join('');
}
/** The tab "Modes" under the time response */
export function renderModes() {
  const box = byId('modesBox');
  if (!box) return;
  const r = responseModes();
  if (!r) {
    box.innerHTML = `<p class="note">${T('The modes are shown for a step, ramp, parabola, impulse or sine reference.')}</p>`;
    return;
  }
  r.modes = sortedModes(r);
  const parts = r.modes.flatMap(modeParts),
    d = S.dOn || S.sat || S.noise > 0 ? null : simDifference(r),
    t = r.t0 ? T(' (t measured from t₀ = {t} s)', { t: numStr(r.t0) }) : '';
  box.innerHTML =
    `<p>${T('Partial fractions of Y(s) = Gyr(s) R(s): each pole of Y(s) gives a term of y(t){t}.', { t })}</p>` +
    `<div class="modes-sum">\\[y(t)=${sumTeX(parts)}\\]</div>` +
    `<div class="pzwrap-tbl"><table class="pzt modes"><thead><tr><th>${T('Pole')}</th><th>${T('Term in y(t)')}</th><th>${T('Time constant 1/|Re|')}</th><th>${T('Kind')}</th></tr></thead><tbody>${modeRows(r)}</tbody></table></div>` +
    `<p class="note">${[
      d === null
        ? T('The disturbance, the noise and the saturation are not part of these terms.')
        : T('Largest difference between the sum of the terms and the simulated y(t): {d}', { d: numStr(d) }),
      r.approx ? T('With a dead time, the terms are those of its third-order Padé approximation.') : '',
    ]
      .filter(Boolean)
      .join(' ')}</p>`;
  if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([box]).catch(() => {});
}
