// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ===== Zoom, pan and PNG of the block diagram =====
   The same buttons as the plots (＋, −, Fit, PNG; shown while the pointer is over the diagram, while one of them has
   the keyboard focus, or while zoomed) and the same gestures: the wheel zooms at the pointer, a drag pans, a
   double-click shows the whole diagram. The zoom changes only the part of the drawing that is shown (the viewBox of
   its SVG); the size of the area stays (its bottom edge changes that). A new drawing (other parts
   of the loop, another language) shows the whole diagram again. PNG saves what is shown, on a white background. */
import { i18nText, i18nTitle } from './02-i18n.ts';
import { $, qs } from './06-ui-build.ts';
import { COLORS } from './09-drawing.ts';
import { savePNG } from './11-export.ts';
import { ZOOM_BUTTONS } from './15-zoom.ts';

export const DIAG_ZOOM_HELP = 'Wheel: zoom / Drag: pan / Double-click: show all',
  DIAG_ZOOM_MAX = 8; // largest zoom factor
/** Part of the drawing shown: zoom factor k (> 1) and the centre (in the coordinates of the drawing); null: all */
interface DiagView {
  k: number;
  cx: number;
  cy: number;
}
export const diagView: { v: DiagView | null } = { v: null };

const box = $('diagBox'),
  tools = document.createElement('div');
tools.className = 'plot-tools dg-tools';
tools.dataset.for = 'diagBox';
ZOOM_BUTTONS.forEach(([z, tip, text]) => {
  const b = document.createElement('button');
  b.dataset.z = z;
  i18nTitle(b, tip);
  if (z === 'fit') i18nText(b, text);
  else b.textContent = text;
  tools.append(b);
});
box.before(tools);
i18nTitle(box, DIAG_ZOOM_HELP);

const svgOf = () => box.querySelector<SVGSVGElement>('svg');
// Size of the whole drawing (kept on the SVG, whose viewBox the zoom changes)
function fullSize(svg: SVGSVGElement): [number, number] {
  if (!svg.dataset.full) svg.dataset.full = (svg.getAttribute('viewBox') ?? '0 0 1 1').split(' ').slice(2).join(' ');
  const [w, h] = svg.dataset.full.split(' ').map(Number);
  return [w || 1, h || 1];
}
// The part shown: [x, y, width, height] in the coordinates of the drawing, kept inside it
export function diagViewBox(v: DiagView | null, w: number, h: number): [number, number, number, number] {
  if (!v) return [0, 0, w, h];
  const vw = w / v.k,
    vh = h / v.k,
    x = Math.min(w - vw, Math.max(0, v.cx - vw / 2)),
    y = Math.min(h - vh, Math.max(0, v.cy - vh / 2));
  return [x, y, vw, vh];
}
// Show the part of the drawing in diagView; the buttons stay shown while zoomed
export function applyDiagView() {
  const svg = svgOf();
  tools.classList.toggle('zoomed', !!diagView.v);
  box.classList.toggle('zoomed', !!diagView.v);
  if (!svg) return;
  const [w, h] = fullSize(svg),
    [x, y, vw, vh] = diagViewBox(diagView.v, w, h);
  if (diagView.v) Object.assign(diagView.v, { cx: x + vw / 2, cy: y + vh / 2 }); // the centre after keeping it inside
  svg.setAttribute('viewBox', `${x} ${y} ${vw} ${vh}`);
}
// Zoom by the factor f, keeping the point at (px, py) (fractions of the width and height of the drawing) in place
export function zoomDiagram(f: number, px = 0.5, py = 0.5) {
  const svg = svgOf();
  if (!svg) return;
  const [w, h] = fullSize(svg),
    [x, y, vw, vh] = diagViewBox(diagView.v, w, h),
    k = Math.min(DIAG_ZOOM_MAX, Math.max(1, (diagView.v?.k ?? 1) * f));
  if (k < 1.001) diagView.v = null;
  else {
    const u = x + px * vw,
      v = y + py * vh;
    diagView.v = { k, cx: u + (0.5 - px) * (w / k), cy: v + (0.5 - py) * (h / k) };
  }
  applyDiagView();
}
export function resetDiagView() {
  diagView.v = null;
  applyDiagView();
}
// Save what is shown as a PNG image, at twice the size on the screen (at least the pixel density of the screen)
export async function saveDiagramPNG() {
  const svg = svgOf();
  if (!svg) return;
  const r = svg.getBoundingClientRect(),
    s = Math.max(2, window.devicePixelRatio || 1),
    copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('width', String(r.width));
  copy.setAttribute('height', String(r.height));
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
  try {
    await img.decode();
  } catch (e) {
    // the drawing could not be turned into an image: nothing is saved (as when the file cannot be written)
  }
  const c = document.createElement('canvas');
  c.width = Math.round(r.width * s);
  c.height = Math.round(r.height * s);
  const g = c.getContext('2d');
  if (!g) return;
  g.fillStyle = COLORS.white;
  g.fillRect(0, 0, c.width, c.height);
  if (img.complete && img.naturalWidth) g.drawImage(img, 0, 0, c.width, c.height);
  await savePNG(c, 'block_diagram');
}

tools.addEventListener('click', e => {
  const b = (e.target as Element).closest<HTMLElement>('button[data-z]');
  if (!b) return;
  const z = b.dataset.z;
  if (z === 'png') saveDiagramPNG();
  else if (z === 'fit') resetDiagView();
  else zoomDiagram(z === 'in' ? 1.4 : 1 / 1.4);
});
// Position of the pointer as fractions of the drawing on the screen
const frac = (e: MouseEvent): [number, number] => {
  const r = qs<SVGSVGElement>('svg', box).getBoundingClientRect();
  return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
};
box.addEventListener(
  'wheel',
  e => {
    if (!svgOf()) return;
    e.preventDefault();
    zoomDiagram(Math.exp(-e.deltaY * 0.0015), ...frac(e));
  },
  { passive: false },
);
// A drag on the drawing pans it while zoomed (a drag on the scroll bar of the area is left to the area)
let drag: { x: number; y: number; cx: number; cy: number; id: number } | null = null;
box.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !diagView.v || !(e.target as Element).closest('svg')) return;
  drag = { x: e.clientX, y: e.clientY, cx: diagView.v.cx, cy: diagView.v.cy, id: e.pointerId };
  box.setPointerCapture(e.pointerId);
  box.classList.add('panning');
});
box.addEventListener('pointermove', e => {
  const svg = svgOf();
  if (!drag || !diagView.v || !svg) return;
  const r = svg.getBoundingClientRect(),
    [w, h] = fullSize(svg),
    k = diagView.v.k;
  diagView.v.cx = drag.cx - ((e.clientX - drag.x) / r.width) * (w / k);
  diagView.v.cy = drag.cy - ((e.clientY - drag.y) / r.height) * (h / k);
  applyDiagView();
});
const endDrag = () => {
  drag = null;
  box.classList.remove('panning');
};
box.addEventListener('pointerup', endDrag);
box.addEventListener('pointercancel', endDrag);
// (by the position: after a drag the events of the pointer go to the area, which captured it)
box.addEventListener('dblclick', e => {
  const [px, py] = frac(e);
  if (px >= 0 && px <= 1 && py >= 0 && py <= 1) resetDiagView();
});
// a new drawing shows the whole diagram
window.diagViewReset = resetDiagView;
