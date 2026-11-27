// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Interaction with the plots: zoom and pan, the pole-zero map, Bode and Nyquist options ================= */
// PLOT_VIEWS[id] = {x:[min,max], y:[min,max]} set by the user; absent = automatic range
import { S, lastFr, lastFrB, lastPZ } from './06-state.ts';
import { WR_MAX, WR_MIN, rangeSig } from './07-frequency.ts';
import { $, byId, i18nText, i18nTitle, must } from './13-dom.ts';
import { KEEP_ASPECT, PLOT_IDS, PLOT_VIEWS, fromU, resetPlotView, setPlotView, shownPanels, toU } from './14-view.ts';
import { bodeDescDefault, drawBode, drawNyq, saveCanvasPNG } from './15-drawing.ts';
import { PZM, drawPZ, pzCurrentView, pzHover, pzZoomAt, resetPZView } from './16-pole-zero.ts';
import { scheduleRedraw, update } from './18-update.ts';
import { applyLoopGain } from './19-controls.ts';

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
// Interaction with the map: wheel to zoom, drag to pan, double-click or Fit to reset the view, tooltip on hover,
// click on the root locus to apply its gain; buttons to zoom and save as PNG; check boxes of what is shown
(() => {
  const cv = $('cvPZ'),
    tip = $('pzTip'),
    hideTip = () => (tip.style.display = 'none'),
    fit = () => {
      resetPZView();
      drawPZ(lastPZ);
    };
  let drag: { x: number; y: number; cx: number; cy: number } | null = null, // start of a drag (pointer and view centre)
    moved = 0, // largest distance from the start [px]: below 4 px it is a click
    hoverK: number | null = null; // gain of the root locus point under the pointer
  cv.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      pzZoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
      hideTip();
    },
    { passive: false },
  );
  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    cv.setPointerCapture(e.pointerId);
    const v = pzCurrentView();
    drag = { x: e.clientX, y: e.clientY, cx: v.cx, cy: v.cy };
    moved = 0;
    cv.classList.add('panning');
    hideTip();
  });
  cv.addEventListener('pointermove', e => {
    if (drag) {
      moved = Math.max(moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
      if (moved < 4) return;
      const v = pzCurrentView();
      v.cx = drag.cx - (e.clientX - drag.x) / v.k;
      v.cy = drag.cy + (e.clientY - drag.y) / v.k;
      drawPZ(lastPZ);
      return;
    }
    const r = cv.getBoundingClientRect();
    hoverK = pzHover(e.clientX - r.left, e.clientY - r.top);
  });
  const end = (e: PointerEvent) => {
    const click = drag && moved < 4;
    drag = null;
    cv.classList.remove('panning');
    if (click && hoverK !== null && e.type === 'pointerup') {
      const k = hoverK;
      hoverK = null;
      hideTip();
      applyLoopGain(k);
    }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', hideTip);
  cv.addEventListener('dblclick', fit);
  const zoomCentre = (f: number) =>
    pzZoomAt(f, cv.clientWidth / 2 + (PZM.l - PZM.r) / 2, cv.clientHeight / 2 + (PZM.t - PZM.b) / 2);
  $('pzIn').onclick = () => zoomCentre(1.4);
  $('pzOut').onclick = () => zoomCentre(1 / 1.4);
  $('pzFit').onclick = fit;
  $('pzPng').onclick = () => saveCanvasPNG(cv);
  (['pzPlant', 'pzCtrl', 'pzCL', 'pzLocus', 'pzRules', 'pzGrid'] as const).forEach(
    id => ($(id).onchange = () => drawPZ(lastPZ)),
  );
})();
// Options of the Bode and Nyquist plots: redraw when a check box changes; the description line of the Bode
// curve buttons shows the hovered or focused one, otherwise the curves that are shown
(() => {
  (['bodeL', 'bodeP', 'bodeC', 'bodeS', 'bodeT', 'bodeD', 'bodeR', 'bodeA'] as const).forEach(
    id =>
      ($(id).onchange = () => {
        if (shownPanels.has('bode') && lastFr) drawBode(lastFr, lastFrB || lastFr);
      }),
  );
  document.querySelectorAll<HTMLElement>('#bodeOpts .ctg').forEach(l => {
    l.dataset.desc = l.getAttribute('title') ?? '';
    const show = () => {
      $('bodeDesc').textContent = l.title;
    };
    const inp = must(l.querySelector('input'), 'check box of a Bode curve');
    l.addEventListener('mouseenter', show);
    inp.addEventListener('focus', show);
    l.addEventListener('mouseleave', bodeDescDefault);
    inp.addEventListener('blur', bodeDescDefault);
    inp.addEventListener('change', bodeDescDefault);
  });
  // Frequency range of the Bode plot set by hand; the zoom of the Bode plots is reset to show it
  const resetBodeViews = () =>
    ['cvG', 'cvPh'].forEach(id => {
      if (PLOT_VIEWS[id]) delete PLOT_VIEWS[id].x;
    });
  const commitWr = () => {
    const lo = Math.max(WR_MIN, parseFloat($('wrLo').value)),
      hi = Math.min(WR_MAX, parseFloat($('wrHi').value));
    if (isFinite(lo) && isFinite(hi) && hi > lo) {
      S.wr = { on: true, lo, hi, sig: rangeSig() };
      resetBodeViews();
    }
    update(); // also shows the range again when the input was not valid
  };
  (['wrLo', 'wrHi'] as const).forEach(id => {
    $(id).onchange = commitWr;
    $(id).onkeydown = e => {
      if (e.key === 'Enter') commitWr();
    };
  });
  $('wrAuto').onclick = () => {
    S.wr.on = false;
    resetBodeViews();
    update();
  };
  $('nyqMs').onchange = () => {
    if (shownPanels.has('nyq') && lastFr) drawNyq(lastFr);
  };
  $('nyqCount').onchange = () => {
    if (shownPanels.has('nyq') && lastFr) drawNyq(lastFr);
  };
})();
