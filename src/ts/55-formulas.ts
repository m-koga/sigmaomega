// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Formulas: P(s), C(s) and the transfer functions of the loop with the numbers substituted ================= */
import { T } from './02-i18n.ts';
import { cT, nT, polyTeX } from './03-math.ts';
import { CONTROLLERS, PLANTS, REF_TYPES, hasTerm } from './10-definitions.ts';
import { S } from './11-state.ts';
import { spWeights } from './15-frequency.ts';
import { loopTFs } from './17-loop.ts';
import type { LoopTF, LoopTFKey } from './17-loop.ts';
import { $, byId } from './40-dom.ts';
import { layout } from './41-view.ts';
/* ---- Formulas of P(s) and C(s) with the numbers substituted ----
   Shown one below the other at the left, each a formula of its own; their left-hand sides are given the same width
   (that of the widest, C_r(s) with a 2-DOF PID, otherwise C(s)), so that the equals signs line up */
// Size of the formulas (px) for the bottom edge of their panel: f0 the size and h0 the height of the formulas when
// the drag started, dh how far the edge moved. The formulas scale with their size, so the size changes in the
// same ratio as the height; 4-60 px in steps of 0.5. wr: how many times wider the formulas may become and still fit
// the width of the panel (the narrowest one decides); the size stops there (rounded down), unless that is below 4 px
export const TEX_FS_MIN = 4,
  TEX_FS_MAX = 60,
  TEX_FS_DEFAULT = 14; // the size in the style sheet (.tex)
export function texFsForHeight(f0: number, h0: number, dh: number, wr = Infinity): number {
  const f = h0 > 0 ? (f0 * (h0 + dh)) / h0 : f0;
  const fit = Math.floor(f0 * wr * 2) / 2;
  const v = Math.round(Math.min(TEX_FS_MAX, f) * 2) / 2;
  return Math.max(TEX_FS_MIN, Math.min(v, fit));
}
// Size the formulas are shown at: the chosen size (layout.texFs, or the default), made smaller while that is wider
// than the panel. cur: the size shown now, wr: how many times wider the formulas may become at it (Infinity: not
// measured). The chosen size is kept, so the formulas grow back when there is room again
export function texFsShown(chosen: number, cur: number, wr: number): number {
  if (!isFinite(wr)) return chosen;
  return Math.max(TEX_FS_MIN, Math.min(chosen, Math.floor(cur * wr * 2) / 2));
}
// Panels showing formulas: their area, the boxes of the formulas and the item of the layout with their size (px)
export const FORMULA_PANELS = {
  tf: { wrap: 'tf-wrap', boxes: ['tex-P', 'tex-C'], size: 'texFs' },
  loop: { wrap: 'loop-wrap', boxes: ['tex-loop'], size: 'loopFs' },
} as const;
export type FormulaPanel = keyof typeof FORMULA_PANELS;
// How many times wider the formulas of a panel may become and still fit the width of their boxes (the widest
// formula decides; Infinity before they are drawn). 2 % is left for rounding
export function texWidthRatio(panel: FormulaPanel = 'tf'): number {
  let r = Infinity;
  FORMULA_PANELS[panel].boxes.forEach(id => {
    const el = byId(id);
    el.querySelectorAll('mjx-container > svg').forEach(svg => {
      const w = svg.getBoundingClientRect().width;
      if (w > 0 && el.clientWidth > 0) r = Math.min(r, (el.clientWidth * 0.98) / w);
    });
  });
  return r;
}
// Show the formulas at the chosen size, or smaller so that they fit the width of the panel (both panels when none is
// given). Called after they are drawn (renderTeX), when the layout is applied, when the size is chosen, and when
// the width of the panel changes
export function fitTex(panel?: FormulaPanel) {
  if (!panel) {
    (Object.keys(FORMULA_PANELS) as FormulaPanel[]).forEach(fitTex);
    return;
  }
  const d = FORMULA_PANELS[panel],
    box = byId(d.wrap),
    chosen = layout[d.size],
    cur = parseFloat(getComputedStyle(byId(d.boxes[0])).fontSize) || TEX_FS_DEFAULT,
    f = texFsShown(chosen || TEX_FS_DEFAULT, cur, texWidthRatio(panel));
  if (f === TEX_FS_DEFAULT && !chosen) box.style.removeProperty('--texFs');
  else box.style.setProperty('--texFs', f + 'px');
}
export let texTimer: Timer | undefined;
// Formulas typeset again a moment after the last change
export function scheduleTeX() {
  clearTimeout(texTimer);
  texTimer = setTimeout(renderTeX, 250);
}
// The controller acts on the reference and the output differently: a second formula C_r(s)
function twoDofShown(): boolean {
  return !CONTROLLERS[S.mode].texNum && (S.tdof || (S.dOnMeas && hasTerm(S, 'D')));
}
// Left-hand side `name` as wide as the widest one
export function texLhs(name: string): string {
  return `\\rlap{${name}}\\hphantom{${twoDofShown() ? 'C_r(s)' : 'C(s)'}}`;
}
export function plantTeX(): string {
  return `${texLhs('P(s)')}=${PLANTS[S.plant].texNum(S)}`;
}
// The formulas of the controller: C(s), and C_r(s) with a 2-DOF PID
export function ctrlTeXLines(): string[] {
  const ctl = CONTROLLERS[S.mode];
  if (ctl.texNum) return [`${texLhs('C(s)')}=${ctl.texNum(S)}`]; // numbers only
  const terms = [];
  if (hasTerm(S, 'P') && S.Kp !== 0) terms.push(nT(S.Kp));
  if (hasTerm(S, 'I') && S.Ki !== 0) terms.push(`\\dfrac{${nT(S.Ki)}}{s}`);
  if (hasTerm(S, 'D') && S.Kd !== 0) terms.push(`\\dfrac{${cT(S.Kd)}s}{s/${nT(S.N)}+1}`);
  const num = terms.length ? terms.join('+') : '0';
  const base = `${texLhs('C(s)')}=${num}`; // numbers only
  if (!twoDofShown()) return [base];
  // 2-DOF PID: the controller acting on the reference, Cr(s) = KP b + KI/s + KD c s/(s/N+1) (u = Cr(s) r − C(s) y)
  const { b, c } = spWeights(),
    rt = [];
  if (hasTerm(S, 'P') && S.Kp * b !== 0) rt.push(nT(+(S.Kp * b).toPrecision(6)));
  if (hasTerm(S, 'I') && S.Ki !== 0) rt.push(`\\dfrac{${nT(S.Ki)}}{s}`);
  if (hasTerm(S, 'D') && S.Kd * c !== 0) rt.push(`\\dfrac{${cT(+(S.Kd * c).toPrecision(6))}s}{s/${nT(S.N)}+1}`);
  return [base, `${texLhs('C_r(s)')}=${rt.length ? rt.join('+') : '0'}`];
}
export function ctrlTeX(): string {
  return ctrlTeXLines().join('\n');
}
/* ---- Transfer functions of the loop: each as its definition and as a rational function with the numbers ---- */
// Order of the formulas, their check boxes, left-hand sides and definitions
export const LOOP_TFS: [LoopTFKey, string, string][] = [
  ['L', 'L(s)', 'C(s)P(s)'],
  ['S', 'S(s)', '\\dfrac{1}{1+L(s)}'],
  ['T', 'T(s)', '\\dfrac{L(s)}{1+L(s)}'],
  ['R', 'G_{yr}(s)', ''],
  ['D', 'G_{yd}(s)', '\\dfrac{P(s)}{1+L(s)}'],
];
// A polynomial times the dead time: e^{-Ls} alone, after a single term, or after a sum in parentheses
function delayed(p: Poly, L: number): string {
  const e = `e^{-${nT(L)}s}`,
    terms = p.filter(v => Math.abs(v) >= 1e-14).length,
    t = polyTeX(p);
  if (t === '1') return e;
  if (t === '-1') return '-' + e;
  return terms > 1 ? `\\left(${t}\\right)${e}` : t + e;
}
// Right-hand side of a transfer function of the loop: N(s) e^{-Ls}/(D0(s) + D1(s) e^{-Ls})
export function loopTFTeX(g: LoopTF): string {
  const num = g.delay ? delayed(g.num, g.L) : polyTeX(g.num);
  let den = polyTeX(g.den0);
  if (g.den1.length) {
    const d1 = delayed(g.den1, g.L);
    den += d1.startsWith('-') ? d1 : '+' + d1;
  }
  return den === '1' ? num : `\\dfrac{${num}}{${den}}`;
}
// Check box of each transfer function of the loop
export const loopBox = (k: LoopTFKey) => byId(`loop${k}`) as HTMLInputElement;
// Formulas of the chosen transfer functions of the loop: name = definition = rational function; the names have the
// width of the widest (G_yr(s)), so that the first equals signs line up
export function loopTeXLines(): string[] {
  const g = loopTFs(),
    two = twoDofShown();
  return LOOP_TFS.filter(([k]) => loopBox(k).checked).map(([k, name, def]) => {
    const d = k === 'R' ? `\\dfrac{${two ? 'C_r(s)' : 'C(s)'}P(s)}{1+L(s)}` : def;
    return `\\rlap{${name}}\\hphantom{G_{yr}(s)}=${d}=${loopTFTeX(g[k])}`;
  });
}
// Note under the formulas: what to do when none is chosen, otherwise that they are not reduced
export function loopNote() {
  byId('loopNote').textContent = LOOP_TFS.some(([k]) => loopBox(k).checked)
    ? T('The rational functions are not reduced: common factors of the numerator and the denominator are kept.')
    : T('Choose the transfer functions to show with the buttons above.');
}
// Each formula as display math (one block each)
const displayTeX = (lines: string[]) => lines.map(l => '\\[' + l + '\\]').join('');
// When numbers change, redraw only the formulas (replace after conversion to avoid flicker)
export let fmTimer: Timer | undefined;
export function scheduleFormulas() {
  clearTimeout(fmTimer);
  fmTimer = setTimeout(renderFormulas, 100);
}
export function renderFormulas() {
  const jobs: [HTMLElement, string[]][] = [
    [$('tex-P'), [plantTeX()]],
    [$('tex-C'), ctrlTeXLines()],
    [byId('tex-loop'), loopTeXLines()],
  ];
  loopNote();
  if (window.MathJax && MathJax.tex2svgPromise) {
    jobs.forEach(([el, lines]) => {
      const tex = lines.join('\n');
      if (el.dataset.tex === tex) return;
      Promise.all(lines.map(l => MathJax.tex2svgPromise(l, { display: true })))
        .then((nodes: Node[]) => {
          el.replaceChildren(...nodes);
          el.dataset.tex = tex;
          fitTex(el.id === 'tex-loop' ? 'loop' : 'tf'); // a longer formula may need a smaller size to fit the width
        })
        .catch(() => {});
    });
  }
}
// Formulas of P(s) and C(s) (MathJax); also called by MathJax when it has loaded (src/index.html)
export function renderTeX() {
  $('tex-P').innerHTML = '\\[' + plantTeX() + '\\]';
  $('tex-C').innerHTML = displayTeX(ctrlTeXLines());
  byId('tex-loop').innerHTML = displayTeX(loopTeXLines());
  loopNote();
  if ($('tex-r')) $('tex-r').innerHTML = '\\(' + REF_TYPES[S.refType].tex + '\\)';
  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetClear && MathJax.typesetClear();
    MathJax.typesetPromise([document.body])
      .then(() => {
        $('tex-P').dataset.tex = plantTeX();
        $('tex-C').dataset.tex = ctrlTeX();
        byId('tex-loop').dataset.tex = loopTeXLines().join('\n');
        fitTex(); // a longer formula may need a smaller size to fit the width
      })
      .catch(() => {});
  }
}
window.renderTeX = renderTeX;
