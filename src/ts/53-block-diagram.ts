// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Block diagram =================
   Drawn from what is used: the saturation, the disturbance d and the noise n (each with its block or summing
   point) only when they are applied, so the diagram gets shorter without them. Top row, left to right:
   r -> [Cr(s) ->] summing point -> [C(s) ->] u -> [saturation] -> [d] -> P(s) -> y; the feedback path runs below,
   through [n] and, in the 2-DOF form u = Cr(s) r − C(s) y (2-DOF PID and PI-D), through C(s). */
import { LANG, T } from './02-i18n.ts';
import { numStr } from './03-math.ts';
import { PID_MODES, PLANTS, hasTerm } from './10-definitions.ts';
import { S } from './11-state.ts';
import { spWeights } from './15-frequency.ts';
import { $, byId } from './40-dom.ts';
export interface DiagramParts {
  sat: boolean;
  d: boolean;
  n: boolean;
  /** 2-DOF form */
  two: boolean;
  /** the plant alone (option "Only the plant alone" of the time response): u -> P(s) -> y */
  plant?: boolean;
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
// Pen of the block diagram: lines (with an arrow by default) and shapes, text, and the SVG of all of them;
// part: the data-part of what is drawn only with a part of the loop (saturation, disturbance, noise)
function diagramPen() {
  const L: string[] = [], // lines
    X: string[] = [], // text
    dp = (part: string) => (part ? ` data-part="${part}"` : '');
  return {
    line: (x1: number, y1: number, x2: number, y2: number, arrow = true, part = '') =>
      L.push(`<line${dp(part)} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${arrow ? ' marker-end="url(#ar)"' : ''}/>`),
    poly: (pts: number[], arrow: boolean) =>
      L.push(`<polyline points="${pts.join(',')}"${arrow ? ' marker-end="url(#ar)"' : ''}/>`),
    raw: (svg: string) => L.push(svg),
    rect: (x: number, y: number, w: number, h: number, part = '') =>
      L.push(`<rect${dp(part)} x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`),
    circle: (cx: number, cy: number, r: number, part = '') =>
      L.push(`<circle${dp(part)} cx="${cx}" cy="${cy}" r="${r}"/>`),
    text: (x: number, y: number, t: string, attrs = '') => X.push(`<text x="${x}" y="${y}"${attrs}>${t}</text>`),
    // the whole drawing, w wide; dots: filled dots (branch points) drawn over the lines
    svg: (w: number, dots = '') =>
      `<svg viewBox="0 0 ${w} ${DIAG_H}" xmlns="http://www.w3.org/2000/svg" font-family="Noto Sans JP, sans-serif">` +
      '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0,0 L10,5 L0,10 z" fill="#1b1d22"/></marker></defs>' +
      `<g stroke="#1b1d22" stroke-width="1.6" fill="none">${L.join('')}</g>` +
      dots +
      `<g font-size="15" fill="#1b1d22">${X.join('')}</g></svg>`,
  };
}
type DiagramPen = ReturnType<typeof diagramPen>;
const IT = ' font-style="italic"',
  MID = ' text-anchor="middle"',
  DIAG_Y = 60, // top row
  DIAG_FB = 135; // feedback path
// The plant alone: its input u, the plant and its output y, without the controller and the feedback
function diagramPlantAlone(d: DiagramPen): { svg: string; w: number } {
  d.line(20, DIAG_Y, 98, DIAG_Y);
  d.text(18, 50, 'u', IT);
  d.rect(100, 38, 100, 44);
  d.text(150, 66, 'P(s)', MID + IT);
  d.text(150, 97, '', ' text-anchor="middle" font-size="11" fill="#666b75" id="lbl-Pnote"');
  d.line(200, DIAG_Y, 280, DIAG_Y);
  d.text(288, 65, 'y', IT);
  d.text(150, 22, T('Plant alone'), ' text-anchor="middle" font-size="11" fill="#666b75"');
  return { w: 310, svg: d.svg(310) };
}
// From the reference r to the control input u (the same in both forms up to x = 283); returns where u starts
function diagramController(d: DiagramPen, two: boolean): number {
  const Y = DIAG_Y;
  d.text(18, 50, 'r', IT);
  if (two) {
    d.line(20, Y, 58, Y);
    d.rect(60, 38, 96, 44);
    d.text(108, 66, 'C<tspan font-size="11" dy="4">r</tspan><tspan dy="-4">(s)</tspan>', MID + IT);
    d.text(108, 26, '', ' text-anchor="middle" font-size="11" fill="#c62828" font-weight="700" id="lbl-2dof"');
    d.line(156, Y, 190, Y);
    d.circle(203, Y, 13);
    d.text(184, 52, '+', ' font-size="12"');
    d.text(208, 88, '−', ' font-size="14"');
    d.text(250, 52, 'u', IT);
    return 216;
  }
  d.line(20, Y, 72, Y);
  d.circle(85, Y, 13);
  d.text(66, 52, '+', ' font-size="12"');
  d.text(90, 88, '−', ' font-size="14"');
  d.line(98, Y, 138, Y);
  d.text(112, 52, 'e', IT);
  d.rect(140, 38, 100, 44);
  d.text(190, 66, 'C(s)', MID + IT);
  d.text(258, 52, 'u', IT);
  return 240;
}
// The top row after u: the saturation and the disturbance when they are applied, then the plant and y. Each part
// starts 44 (block) or 46 (summing point) after the previous one ends. Returns the left and right edges of P(s)
function diagramForward(d: DiagramPen, p: DiagramParts, out: number): { pl: number; po: number } {
  const Y = DIAG_Y;
  let next = 285; // left edge of the first part after u
  if (p.sat) {
    d.line(out, Y, next - 2, Y);
    d.rect(next, 38, 64, 44, 'sat');
    d.raw(
      `<polyline data-part="sat" points="${next + 10},72 ${next + 22},72 ${next + 42},48 ${next + 54},48" stroke-width="1.4"/>`,
    );
    d.text(next + 32, 31, T('Saturation'), ' text-anchor="middle" font-size="11" fill="#666b75" data-part="sat"');
    out = next + 64;
    next = out + 46;
  }
  if (p.d) {
    const cx = next + 13;
    d.line(out, Y, next, Y);
    d.line(cx, 12, cx, 45, true, 'd');
    d.circle(cx, Y, 13, 'd');
    d.text(cx + 7, 14, 'd', IT + ' data-part="d"');
    out = cx + 13;
    next = out + 44;
  } else if (p.sat) next = out + 44;
  d.line(out, Y, next - 2, Y);
  const pl = next,
    po = pl + 100;
  d.rect(pl, 38, 100, 44);
  d.text(pl + 50, 66, 'P(s)', MID + IT);
  d.text(pl + 50, 97, '', ' text-anchor="middle" font-size="11" fill="#666b75" id="lbl-Pnote"');
  d.line(po, Y, po + 80, Y);
  d.text(po + 88, 65, 'y', IT);
  return { pl, po };
}
// The feedback path: from the branch point br down and to the left, through the noise, to e (or, in the 2-DOF
// form, through C(s) to the summing point after C_r(s)); pl: the left edge of P(s)
function diagramFeedback(d: DiagramPen, p: DiagramParts, br: number, pl: number) {
  const Y = DIAG_Y,
    FB = DIAG_FB,
    fbEnd = p.two ? 342 : 85; // where the feedback path ends on the left (the right edge of C(s), or e)
  let from = br;
  d.poly([br, Y, br, FB], false);
  if (p.n) {
    const cx = Math.max(pl - 47, p.two ? 384 : 140);
    d.line(br, FB, cx + 12, FB, false);
    d.circle(cx, FB, 12, 'n');
    d.line(cx, 162, cx, 149, true, 'n');
    d.text(cx + 8, 162, 'n', IT + ' data-part="n"');
    from = cx - 12;
  }
  if (p.two) {
    d.line(from, FB, fbEnd, FB);
    d.rect(244, 115, 96, 40);
    d.text(292, 140, 'C(s)', MID + IT);
    d.poly([244, FB, 203, FB, 203, 75], true);
  } else d.poly([from, FB, 85, FB, 85, 75], true);
}
// The drawing for the parts: its SVG and width
export function diagramSVG(p: DiagramParts): { svg: string; w: number } {
  const d = diagramPen();
  if (p.plant) return diagramPlantAlone(d);
  const { pl, po } = diagramForward(d, p, diagramController(d, p.two)),
    br = po + 35; // branch point of the feedback
  diagramFeedback(d, p, br, pl);
  const w = po + 115;
  return { w, svg: d.svg(w, `<circle cx="${br}" cy="${DIAG_Y}" r="3" fill="#1b1d22"/>`) };
}
let diagKey = '';
// Draws the block diagram again when its parts or the language changed, then its labels
export function syncBlockDiagram() {
  const plant = $('timePlantOnly').checked,
    p: DiagramParts = plant ? { sat: false, d: false, n: false, two: false, plant } : diagramParts(),
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
// Tallest height of the block diagram that still fits the width of its area (the drawing keeps its proportions);
// Infinity before it is drawn or while it is hidden
export function diagMaxH(): number {
  const box = $('diagBox'),
    svg = box.querySelector<SVGSVGElement>('svg'),
    vb = svg?.viewBox?.baseVal;
  if (!vb || !vb.width || !box.clientWidth) return Infinity;
  return Math.floor((box.clientWidth * vb.height) / vb.width);
}
