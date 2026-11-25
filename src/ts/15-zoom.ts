// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Zoom and pan of plots ================= */
// PLOT_VIEWS[id] = {x:[min,max], y:[min,max]} set by the user; absent = automatic range
import { i18nText, i18nTitle } from './02-i18n.ts';
import { PLOTS } from './03-definitions.ts';
import { byId } from './06-ui-build.ts';
import { saveCanvasPNG } from './11-export.ts';
import { scheduleRedraw } from './17-events-layout.ts';

/** Zoomed view of a plot (axis ranges set by the user; a missing axis is automatic) */
interface PlotView {
  x?: [number, number];
  y?: [number, number];
}
export const PLOT_VIEWS: Record<string, PlotView> = {};
// Zoomable plots, plots sharing the horizontal axis and plots zooming both axes together, from PLOTS
const plotKeys = Object.keys(PLOTS);
export const PLOT_IDS: string[] = plotKeys.filter(k => PLOTS[k].zoom);
export const LINKX: Record<string, string> = Object.fromEntries(
  plotKeys.flatMap(k => (PLOTS[k].linkX ? [[k, PLOTS[k].linkX]] : [])),
);
export const KEEP_ASPECT: Record<string, boolean> = Object.fromEntries(plotKeys.map(k => [k, !!PLOTS[k].keepAspect]));
// Help text of a zoomable plot and its buttons: [data-z, tooltip, text (translated when it is a word)]
export const ZOOM_HELP =
  'Wheel: zoom (Shift: horizontal only, Alt: vertical only) / Drag: pan / Double-click: show all';
export const ZOOM_BUTTONS: [string, string, string][] = [
  ['in', 'Zoom in', '＋'],
  ['out', 'Zoom out', '−'],
  ['fit', 'Show the whole plot', 'Fit'],
  ['png', 'Save as a PNG image', 'PNG'],
];
PLOT_IDS.forEach(id => {
  const cv = byId<HTMLCanvasElement>(id),
    tb = document.createElement('div');
  i18nTitle(cv, ZOOM_HELP);
  tb.className = 'plot-tools';
  tb.dataset.for = id;
  ZOOM_BUTTONS.forEach(([z, tip, text]) => {
    const b = document.createElement('button');
    b.dataset.z = z;
    i18nTitle(b, tip);
    if (z === 'fit') i18nText(b, text);
    else b.textContent = text;
    tb.append(b);
  });
  cv.after(tb);
});
export function setPlotView(id: string, axis: 'x' | 'y', range: [number, number]) {
  (PLOT_VIEWS[id] = PLOT_VIEWS[id] || {})[axis] = range;
  if (axis === 'x' && LINKX[id]) (PLOT_VIEWS[LINKX[id]] = PLOT_VIEWS[LINKX[id]] || {}).x = [range[0], range[1]];
}
export function resetPlotView(id: string) {
  delete PLOT_VIEWS[id];
  const o = LINKX[id];
  if (o && PLOT_VIEWS[o]) {
    delete PLOT_VIEWS[o].x;
    if (!PLOT_VIEWS[o].y) delete PLOT_VIEWS[o];
  }
}
export const toU = (v: number, lx: boolean) => (lx ? Math.log10(v) : v),
  fromU = (u: number, lx: boolean) => (lx ? Math.pow(10, u) : u);
export function zoomPlot(cv: HTMLCanvasElement, f: number, mx: number, my: number, ax: { x: boolean; y: boolean }) {
  const t = cv._tf;
  if (!t) return;
  if (ax.x) {
    const a = toU(t.xmin, t.lx),
      b = toU(t.xmax, t.lx),
      u = a + ((mx - t.m.l) / t.pw) * (b - a);
    setPlotView(cv.id, 'x', [fromU(u - (u - a) / f, t.lx), fromU(u + (b - u) / f, t.lx)]);
  }
  if (ax.y) {
    const a = t.ymin,
      b = t.ymax,
      u = b - ((my - t.m.t) / t.ph) * (b - a);
    setPlotView(cv.id, 'y', [u - (u - a) / f, u + (b - u) / f]);
  }
  scheduleRedraw();
}
PLOT_IDS.forEach(id => {
  const cv = byId<HTMLCanvasElement>(id);
  cv.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const both = KEEP_ASPECT[id] || (!e.shiftKey && !e.altKey);
      zoomPlot(cv, Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top, {
        x: both || e.shiftKey,
        y: both || e.altKey,
      });
    },
    { passive: false },
  );
  let drag: { x: number; y: number; t: PlotTransform } | null = null;
  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !cv._tf) return;
    cv.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, t: { ...cv._tf } };
    cv.classList.add('panning');
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const t = drag.t;
    const a = toU(t.xmin, t.lx),
      b = toU(t.xmax, t.lx),
      du = (-(e.clientX - drag.x) / t.pw) * (b - a);
    const dy = ((e.clientY - drag.y) / t.ph) * (t.ymax - t.ymin);
    setPlotView(id, 'x', [fromU(a + du, t.lx), fromU(b + du, t.lx)]);
    setPlotView(id, 'y', [t.ymin + dy, t.ymax + dy]);
    scheduleRedraw();
  });
  const end = () => {
    drag = null;
    cv.classList.remove('panning');
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('dblclick', () => {
    resetPlotView(id);
    scheduleRedraw();
  });
});
document.querySelectorAll<HTMLElement>('.plot-tools').forEach(tb =>
  tb.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('button[data-z]');
    if (!b) return;
    const cv = byId<HTMLCanvasElement>(tb.dataset.for ?? '');
    if (b.dataset.z === 'png') {
      saveCanvasPNG(cv);
      return;
    }
    const t = cv._tf;
    if (!t) return;
    if (b.dataset.z === 'fit') {
      resetPlotView(cv.id);
      scheduleRedraw();
      return;
    }
    zoomPlot(cv, b.dataset.z === 'in' ? 1.4 : 1 / 1.4, t.m.l + t.pw / 2, t.m.t + t.ph / 2, { x: true, y: true });
  }),
);
