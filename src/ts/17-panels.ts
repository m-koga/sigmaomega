// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Contents of the settings panel, the block diagram and the formulas ================= */
import { LANG, T } from './02-i18n.ts';
import { cT, lastOf, nT, numStr, polyTeX } from './03-math.ts';
import {
  COMP_MODES,
  CONTROLLERS,
  CTRL,
  MODE_PARAMS,
  PID_MODES,
  PLANTS,
  REF_TYPES,
  SPECS,
  SPEC_KEYS,
  hasTerm,
  paramSym,
} from './05-definitions.ts';
import { S, ctrlRational, lastPZ, lastSweep } from './06-state.ts';
import { spWeights } from './07-frequency.ts';
import { loopPoles, loopTFs } from './09-loop.ts';
import type { LoopTF, LoopTFKey, PoleKey } from './09-loop.ts';
import { tuneErr, tuneGains, tuneRule } from './10-tuning.ts';
import type { TuneResult } from './10-tuning.ts';
import { evalSpecs, specIcon } from './11-specs.ts';
import { SWEEP_COLORS, plainLabel, sweepDefaults, sweepParams } from './12-sweep.ts';
import { $, byId, i18nText, must } from './13-dom.ts';
import { layout } from './14-view.ts';

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
/* ---- Block diagram ----
   Drawn from what is used: the saturation, the disturbance d and the noise n (each with its block or summing
   point) only when they are applied, so the diagram gets shorter without them. Top row, left to right:
   r -> [Cr(s) ->] summing point -> [C(s) ->] u -> [saturation] -> [d] -> P(s) -> y; the feedback path runs below,
   through [n] and, in the 2-DOF form u = Cr(s) r − C(s) y (2-DOF PID and PI-D), through C(s). */
export interface DiagramParts {
  sat: boolean;
  d: boolean;
  n: boolean;
  /** 2-DOF form */
  two: boolean;
}
const DIAG_H = 165, // height of the drawing (the scale is kept when its width changes)
  DIAG_W_FULL = 680; // width with every part (the width of the area it is drawn for)
export function diagramParts(st: State = S): DiagramParts {
  return {
    sat: st.sat,
    d: st.dOn,
    n: st.noise > 0,
    two: PID_MODES.includes(st.mode) && (st.tdof || (st.dOnMeas && hasTerm(st, 'D'))),
  };
}
// The drawing for the parts: its SVG and width
export function diagramSVG(p: DiagramParts): { svg: string; w: number } {
  const L: string[] = [], // lines
    X: string[] = [], // text
    line = (x1: number, y1: number, x2: number, y2: number, arrow = true, part = '') =>
      L.push(
        `<line${part ? ` data-part="${part}"` : ''} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${arrow ? ' marker-end="url(#ar)"' : ''}/>`,
      ),
    poly = (pts: number[], arrow: boolean) =>
      L.push(`<polyline points="${pts.join(',')}"${arrow ? ' marker-end="url(#ar)"' : ''}/>`),
    rect = (x: number, y: number, w: number, h: number, part = '') =>
      L.push(`<rect${part ? ` data-part="${part}"` : ''} x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`),
    circle = (cx: number, cy: number, r: number, part = '') =>
      L.push(`<circle${part ? ` data-part="${part}"` : ''} cx="${cx}" cy="${cy}" r="${r}"/>`),
    text = (x: number, y: number, t: string, attrs = '') => X.push(`<text x="${x}" y="${y}"${attrs}>${t}</text>`),
    it = ' font-style="italic"',
    mid = ' text-anchor="middle"',
    Y = 60, // top row
    FB = 135; // feedback path
  // reference to the control input u (the same in both forms up to x = 283)
  text(18, 50, 'r', it);
  if (p.two) {
    line(20, Y, 58, Y);
    rect(60, 38, 96, 44);
    text(108, 66, 'C<tspan font-size="11" dy="4">r</tspan><tspan dy="-4">(s)</tspan>', mid + it);
    text(108, 26, '', ' text-anchor="middle" font-size="11" fill="#c62828" font-weight="700" id="lbl-2dof"');
    line(156, Y, 190, Y);
    circle(203, Y, 13);
    text(184, 52, '+', ' font-size="12"');
    text(208, 88, '−', ' font-size="14"');
    text(250, 52, 'u', it);
  } else {
    line(20, Y, 72, Y);
    circle(85, Y, 13);
    text(66, 52, '+', ' font-size="12"');
    text(90, 88, '−', ' font-size="14"');
    line(98, Y, 138, Y);
    text(112, 52, 'e', it);
    rect(140, 38, 100, 44);
    text(190, 66, 'C(s)', mid + it);
    text(258, 52, 'u', it);
  }
  // the top row after u: each part starts 44 (block) or 46 (summing point) after the previous one ends
  let out = p.two ? 216 : 240,
    next = 285; // left edge of the first part after u
  if (p.sat) {
    line(out, Y, next - 2, Y);
    rect(next, 38, 64, 44, 'sat');
    L.push(
      `<polyline data-part="sat" points="${next + 10},72 ${next + 22},72 ${next + 42},48 ${next + 54},48" stroke-width="1.4"/>`,
    );
    text(next + 32, 31, T('Saturation'), ' text-anchor="middle" font-size="11" fill="#666b75" data-part="sat"');
    out = next + 64;
    next = out + 46;
  }
  if (p.d) {
    const cx = next + 13;
    line(out, Y, next, Y);
    line(cx, 12, cx, 45, true, 'd');
    circle(cx, Y, 13, 'd');
    text(cx + 7, 14, 'd', it + ' data-part="d"');
    out = cx + 13;
    next = out + 44;
  } else if (p.sat) next = out + 44;
  line(out, Y, next - 2, Y);
  const pl = next, // the plant
    po = pl + 100,
    br = po + 35; // branch point of the feedback
  rect(pl, 38, 100, 44);
  text(pl + 50, 66, 'P(s)', mid + it);
  text(pl + 50, 97, '', ' text-anchor="middle" font-size="11" fill="#666b75" id="lbl-Pnote"');
  line(po, Y, po + 80, Y);
  text(po + 88, 65, 'y', it);
  const fbEnd = p.two ? 342 : 85; // where the feedback path ends on the left (the right edge of C(s), or e)
  // the feedback path: from the branch point down and to the left, through the noise
  let from = br;
  poly([br, Y, br, FB], false);
  if (p.n) {
    const cx = Math.max(pl - 47, p.two ? 384 : 140);
    line(br, FB, cx + 12, FB, false);
    circle(cx, FB, 12, 'n');
    line(cx, 162, cx, 149, true, 'n');
    text(cx + 8, 162, 'n', it + ' data-part="n"');
    from = cx - 12;
  }
  if (p.two) {
    line(from, FB, fbEnd, FB);
    rect(244, 115, 96, 40);
    text(292, 140, 'C(s)', mid + it);
    poly([244, FB, 203, FB, 203, 75], true);
  } else poly([from, FB, 85, FB, 85, 75], true);
  const w = po + 115;
  return {
    w,
    svg:
      `<svg viewBox="0 0 ${w} ${DIAG_H}" xmlns="http://www.w3.org/2000/svg" font-family="Noto Sans JP, sans-serif">` +
      '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0,0 L10,5 L0,10 z" fill="#1b1d22"/></marker></defs>' +
      `<g stroke="#1b1d22" stroke-width="1.6" fill="none">${L.join('')}</g>` +
      `<circle cx="${br}" cy="${Y}" r="3" fill="#1b1d22"/>` +
      `<g font-size="15" fill="#1b1d22">${X.join('')}</g></svg>`,
  };
}
let diagKey = '';
// Draws the block diagram again when its parts or the language changed, then its labels
export function syncBlockDiagram() {
  const p = diagramParts(),
    key = JSON.stringify(p) + LANG,
    box = $('diagBox');
  if (key !== diagKey) {
    diagKey = key;
    const d = diagramSVG(p);
    box.innerHTML = d.svg;
    // the same scale whatever the width: a shorter drawing takes less of the area
    box.style.setProperty('--dgw', String(d.w / DIAG_W_FULL));
    window.diagViewReset?.(); // a new drawing is shown whole
  }
  box.classList.toggle('two', p.two);
  if (p.two) {
    const w = spWeights();
    byId('lbl-2dof').textContent = S.tdof
      ? T('2-DOF PID (b = {b}, c = {c})', { b: numStr(w.b), c: numStr(w.c) })
      : T('PI-D (derivative on y only)');
  }
  byId('lbl-Pnote').textContent = PLANTS[S.plant].tf(S).L > 0 ? T('(with dead time)') : '';
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
// Tallest height of the block diagram that still fits the width of its area (the drawing keeps its proportions);
// Infinity before it is drawn or while it is hidden
export function diagMaxH(): number {
  const box = $('diagBox'),
    svg = box.querySelector<SVGSVGElement>('svg'),
    vb = svg?.viewBox?.baseVal;
  if (!vb || !vb.width || !box.clientWidth) return Infinity;
  return Math.floor((box.clientWidth * vb.height) / vb.width);
}
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
/* ---- Poles and zeros of P(s), C(s) and of the transfer functions of the loop: a table of the ones chosen ---- */
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
/* ---- Design specifications: rows of the card and their results ---- */
export function renderSpecs(): SpecEval {
  specRows();
  const ev = evalSpecs();
  let n = 0,
    bad = 0;
  SPEC_KEYS.forEach(k => {
    const e = ev[k],
      row = byId(`specrow-${k}`),
      res = byId(`res-${k}`);
    row.classList.toggle('off', !e.on);
    const unit = SPECS[k].unit,
      v = e.value === null ? (e.applicable && e.none ? T(e.none) : '—') : numStr(e.value) + (unit ? ' ' + unit : '');
    res.innerHTML = (e.on && e.applicable ? specIcon(k, ev) : '') + v;
    if (e.on && e.applicable) {
      n++;
      if (!e.ok) bad++;
    }
  });
  const sum = $('specSum');
  sum.className = 'spec-sum' + (n ? (bad ? ' ng' : ' ok') : '');
  sum.textContent = !n
    ? T('No specifications enabled')
    : bad
      ? T('{n} specification(s) not met', { n: bad })
      : T('All enabled specifications are met');
  return ev;
}
// The rows of the card, made once from SPECS: the ids specrow-k, spec-k-on, spec-k and res-k
export function specRows() {
  const box = $('specRows');
  if (box.childElementCount) return;
  for (const k of SPEC_KEYS) {
    const d = SPECS[k],
      row = document.createElement('div');
    row.className = 'spec-row';
    row.id = `specrow-${k}`;
    row.innerHTML =
      `<label class="chk"><input type="checkbox" id="spec-${k}-on"><span></span></label>` +
      `<span class="spec-in"><input type="number" class="num" id="spec-${k}" step="any" min="${d.low}">` +
      ` <span class="spec-u">${d.unit}</span></span><span class="spec-res" id="res-${k}"></span>`;
    i18nText(row.querySelector('label span') as HTMLElement, d.label);
    box.append(row);
  }
}
/* ---- Tuning rule: the model and the gains shown in its card ---- */
export let lastTune: TuneResult | null = null;
export function tuneVisible() {
  const c = document.querySelector<HTMLElement>('.side > .card[data-card="tune"]');
  return !!c && layout.scard === 'tune'; // the card shown in the settings panel
}
export function renderTune() {
  const box = $('tuneOut');
  if (!box) return;
  const imc = S.tune.method === 'imc';
  $('tuneLam').style.display = $('tuneLamL').style.display = imc ? '' : 'none';
  if (!tuneVisible()) {
    lastTune = null;
    return;
  } // computed only while its card is shown
  const r = (lastTune = tuneRule(S.tune.method, S.tune.type, S.tune.lam)),
    m = r.model,
    n = numStr,
    out: string[] = [];
  if (m.err === undefined && m.kind === 'ult')
    out.push(T('Ultimate gain Ku = {Ku}, ultimate period Pu = {Pu} s', { Ku: n(m.sgn * m.Ku), Pu: n(m.Pu) }));
  else if (m.err === undefined) {
    out.push(
      m.K !== null
        ? T('Model from the step response of P(s) (tangent at the steepest point): K = {K}, T = {T}, L = {L}', {
            K: n(m.sgn * m.K),
            T: n(m.T ?? NaN),
            L: n(m.L),
          })
        : T('Model from the step response of P(s) (tangent at the steepest point): slope R = {R}, L = {L}', {
            R: n(m.sgn * m.R),
            L: n(m.L),
          }),
    );
  }
  if (r.err !== undefined) out.push(`<span class="err">${tuneErr(r.err)}</span>`);
  else {
    if (imc) out.push(T('λ = {l} (automatic value when blank)', { l: n(r.lam ?? NaN) }));
    const g = tuneGains(r),
      ks: string[] = [`K<sub>P</sub> = <b>${n(r.Kp)}</b>`],
      ts: string[] = [];
    if (r.Ti !== undefined) {
      ks.push(`K<sub>I</sub> = <b>${n(g.Ki)}</b>`);
      ts.push(`T<sub>I</sub> = ${n(r.Ti)}`);
    }
    if (r.Td !== undefined) {
      ks.push(`K<sub>D</sub> = <b>${n(g.Kd)}</b>`);
      ts.push(`T<sub>D</sub> = ${n(r.Td)}`);
    }
    out.push(ks.join('　'));
    if (ts.length) out.push('(' + ts.join('　') + ')');
  }
  box.innerHTML = out.join('<br>');
  $('tuneApply').disabled = !!r.err;
}
/* ---- Parameter sweep: its inputs and the table of results ---- */
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
