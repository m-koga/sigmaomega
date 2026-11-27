// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Poles and zeros of P(s), C(s) and of the transfer functions of the loop: a table of the ones chosen ================= */
import { T } from './02-i18n.ts';
import { numStr } from './03-math.ts';
import { S, lastPZ } from './11-state.ts';
import { loopPoles } from './17-loop.ts';
import type { PoleKey } from './17-loop.ts';
import { byId } from './40-dom.ts';
// Order of the transfer functions and their names in the table
export const POLE_TFS: [PoleKey, string][] = [
  ['P', 'P(s)'],
  ['C', 'C(s)'],
  ['L', 'L(s)'],
  ['S', 'S(s)'],
  ['T', 'T(s)'],
  ['R', 'G<sub>yr</sub>(s)'],
  ['D', 'G<sub>yd</sub>(s)'],
];
export const polesBox = (k: PoleKey) => byId(`poles${k}`) as HTMLInputElement;
// The roots as text, a conjugate pair as one entry, sorted from the right; a root in the right half-plane (Re > 0) is
// marked when red is asked for
function rootCells(zs: Complex[], red: boolean): string[] {
  return zs
    .filter(z => z[1] >= 0)
    .sort((a, b) => b[0] - a[0] || b[1] - a[1])
    .map(([x, y]) => {
      const val = y === 0 ? numStr(x) : `${numStr(x)} ± ${numStr(y)}j`;
      return `<td${red && x > 1e-6 ? ' class="uns"' : ''}>${val}</td>`;
    });
}
// Rows of one transfer function: its name, then its poles and zeros side by side (as many rows as the longer list;
// "none" when it has none); poles in the right half-plane in red
function poleRows(name: string, poles: Complex[], zeros: Complex[]): string {
  const ps = rootCells(poles, true),
    zs = rootCells(zeros, false),
    none = `<td>${T('none')}</td>`,
    n = Math.max(ps.length, zs.length, 1);
  return Array.from(
    { length: n },
    (_, i) =>
      `<tr${i ? '' : ' class="grp"'}><td>${i ? '' : name}</td>${ps[i] ?? (i ? '<td></td>' : none)}${zs[i] ?? (i ? '<td></td>' : none)}</tr>`,
  ).join('');
}
// The table of the chosen transfer functions, and the note under it
export function renderPoles() {
  const pz = lastPZ;
  if (!pz) return;
  const all = loopPoles(S, pz),
    chosen = POLE_TFS.filter(([k]) => polesBox(k).checked);
  byId('polesBox').innerHTML = chosen.length
    ? `<table class="pzt"><thead><tr><th>${T('Transfer function')}</th><th>${T('Poles')}</th><th>${T('Zeros')}</th></tr></thead><tbody>${chosen.map(([k, name]) => poleRows(name, all[k].poles, all[k].zeros)).join('')}</tbody></table>`
    : '';
  const notes: string[] = [];
  if (!chosen.length) notes.push(T('Choose the transfer functions to show with the buttons above.'));
  else {
    if (chosen.some(([k]) => 'STRD'.includes(k)))
      notes.push(
        T(
          'S(s), T(s), Gyr(s) and Gyd(s) have the closed-loop poles (common factors are not cancelled, as in the loop transfer functions).',
        ),
      );
    if (chosen.some(([k]) => all[k].approx))
      notes.push(
        T(
          'With a dead time the closed loop has infinitely many poles: those shown come from the third-order Padé approximation of the dead time.',
        ),
      );
    if (chosen.some(([k]) => all[k].poles.some(z => z[0] > 1e-6))) notes.push(T('Red: poles in the right half-plane.'));
  }
  byId('polesNote').textContent = notes.join(' ');
}
