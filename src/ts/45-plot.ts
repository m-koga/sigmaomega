// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Plots: frame, axes, grid, curves, legend, metric cards, and saving as PNG ================= */
import { UIFONT } from './02-i18n.ts';
import { PLOTS } from './10-definitions.ts';
import { ctx2d, savePNG } from './40-dom.ts';
import { COLORS, PLOT_VIEWS, layout } from './41-view.ts';

export function niceTicks(min: number, max: number, n = 6): number[] {
  const span = max - min || 1;
  let step = Math.pow(10, Math.floor(Math.log10(span / n)));
  const e = span / n / step;
  if (e >= 7.5) step *= 10;
  else if (e >= 3.5) step *= 5;
  else if (e >= 1.5) step *= 2;
  const t: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step)
    t.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toPrecision(12));
  return t;
}
/** A plot being drawn: canvas context, size, margins, plot area, axis ranges and the mapping from data to pixels */
interface PlotFrame {
  g: CanvasRenderingContext2D;
  W: number;
  H: number;
  m: { l: number; r: number; t: number; b: number };
  pw: number;
  ph: number;
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  lx: boolean;
  X: (v: number) => number;
  Y: (v: number) => number;
}

// Straight line from (x0, y0) to (x1, y1) with the current stroke style
export function strokeLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}

// Draw a line plot: grid and axes, extra marks (circles, bands, segments, horizontal and vertical lines),
// the curves, markers and the legend. The view set by zooming or panning (PLOT_VIEWS) overrides the ranges.
export function plot(cv: HTMLCanvasElement, o: PlotOptions) {
  const f = plotFrame(cv, o);
  if (!f) return;
  drawGrid(f, o);
  drawAxisLabels(f, o);
  const { g, m, pw, ph } = f;
  g.save();
  g.beginPath();
  g.rect(m.l, m.t, pw, ph);
  g.clip(); // marks and curves stay inside the plot area
  drawMarks(f, o);
  o.series.forEach(s => drawSeries(f, s));
  drawPoints(f, o.points || []);
  g.restore();
  drawLegend(f, o.series, o.legend);
}

// Vertical range from the curves and horizontal lines, with 8 % margin (when not given)
export function autoYRange(o: PlotOptions): [number, number] {
  if (o.ymin !== undefined && o.ymax !== undefined) return [o.ymin, o.ymax];
  let lo = Infinity,
    hi = -Infinity;
  const take = (v: number) => {
    if (isFinite(v)) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  };
  o.series.forEach(s => s.y.forEach(take));
  (o.hlines || []).forEach(h => take(h.v));
  if (!isFinite(lo)) {
    lo = -1;
    hi = 1;
  }
  if (hi - lo < 1e-6) {
    hi += 0.5;
    lo -= 0.5;
  }
  const pad = (hi - lo) * 0.08;
  return [o.ymin ?? lo - pad, o.ymax ?? hi + pad];
}

// Size the canvas for the device pixel ratio, clear it and set up the frame (null when the canvas is hidden)
export function plotFrame(cv: HTMLCanvasElement, o: PlotOptions): PlotFrame | null {
  const dpr = window.devicePixelRatio || 1,
    W = cv.clientWidth,
    H = cv.clientHeight;
  if (!W) return null;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const g = ctx2d(cv);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const m = { l: 58, r: 16, t: 12, b: 36 },
    pw = W - m.l - m.r,
    ph = H - m.t - m.b,
    lx = !!o.xlog;
  let { xmin, xmax } = o,
    [ymin, ymax] = autoYRange(o);
  const vw = PLOT_VIEWS[cv.id]; // user zoom/pan
  if (vw?.x) [xmin, xmax] = vw.x;
  if (vw?.y) [ymin, ymax] = vw.y;
  cv._tf = { m, pw, ph, xmin, xmax, ymin, ymax, lx };
  const tools = document.querySelector<HTMLElement>(`.plot-tools[data-for="${cv.id}"]`);
  if (tools) tools.classList.toggle('zoomed', !!vw);
  const lmin = Math.log10(xmin),
    lmax = Math.log10(xmax);
  const X = (v: number) => m.l + (lx ? (Math.log10(v) - lmin) / (lmax - lmin) : (v - xmin) / (xmax - xmin)) * pw;
  const Y = (v: number) => m.t + (1 - (v - ymin) / (ymax - ymin)) * ph;
  return { g, W, H, m, pw, ph, xmin, xmax, ymin, ymax, lx, X, Y };
}

// Values k·10^e (k from ks) inside [xmin, xmax], for the ticks of a logarithmic axis
export function logTicks(xmin: number, xmax: number, ks: number[], open = false): number[] {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(xmin)); e <= Math.ceil(Math.log10(xmax)); e++)
    for (const k of ks) {
      const v = k * Math.pow(10, e);
      if (open ? v > xmin && v < xmax : v >= xmin && v <= xmax) out.push(v);
    }
  return out;
}

// Ticks of the horizontal axis: decades on a logarithmic axis (1, 2, 5 × 10^n or finer when zoomed in)
export function xTicks(f: PlotFrame): number[] {
  if (!f.lx) return niceTicks(f.xmin, f.xmax, 8);
  for (const ks of [[1], [1, 2, 5], [1, 2, 3, 4, 5, 6, 7, 8, 9]]) {
    const t = logTicks(f.xmin, f.xmax, ks);
    if (t.length >= 2) return t;
  }
  return logTicks(f.xmin, f.xmax, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
}

// Grid lines with tick labels, the zero line and the frame
export function drawGrid(f: PlotFrame, o: PlotOptions) {
  const { g, m, pw, ph, X, Y, ymin, ymax } = f;
  g.font = '11px "JetBrains Mono", monospace';
  g.fillStyle = COLORS.tick;
  g.strokeStyle = COLORS.grid;
  g.lineWidth = 1;
  if (f.lx) {
    // light lines at 2 … 9 × 10^n
    g.strokeStyle = COLORS.gridMinor;
    logTicks(f.xmin, f.xmax, [2, 3, 4, 5, 6, 7, 8, 9], true).forEach(v => strokeLine(g, X(v), m.t, X(v), m.t + ph));
    g.strokeStyle = COLORS.gridDecade;
  }
  const num = (v: number) => (+v.toPrecision(6)).toString();
  g.textAlign = 'center';
  xTicks(f).forEach(v => {
    const x = X(v);
    strokeLine(g, x, m.t, x, m.t + ph);
    g.fillText(f.lx && !(v >= 1 && v < 1e5) ? v.toExponential(0) : num(v), x, m.t + ph + 15);
  });
  g.textAlign = 'right';
  (o.yticks ? o.yticks(ymin, ymax) : niceTicks(ymin, ymax, 6)).forEach(v => {
    const y = Y(v);
    strokeLine(g, m.l, y, m.l + pw, y);
    g.fillText(num(v), m.l - 6, y + 4);
  });
  if (ymin < 0 && ymax > 0) {
    g.strokeStyle = COLORS.zeroLine;
    strokeLine(g, m.l, Y(0), m.l + pw, Y(0));
  }
  g.strokeStyle = COLORS.frame;
  g.strokeRect(m.l, m.t, pw, ph);
}

// Axis labels: below the plot and rotated on the left
export function drawAxisLabels(f: PlotFrame, o: PlotOptions) {
  const { g, m, pw, ph } = f;
  g.fillStyle = COLORS.text;
  g.font = '12px ' + UIFONT();
  g.textAlign = 'center';
  g.fillText(o.xlabel || '', m.l + pw / 2, f.H - 4);
  g.save();
  g.translate(13, m.t + ph / 2);
  g.rotate(-Math.PI / 2);
  g.fillText(o.ylabel || '', 0, 0);
  g.restore();
}

// Extra marks under the curves: circles, shaded bands, horizontal segments, horizontal and vertical lines
export function drawMarks(f: PlotFrame, o: PlotOptions) {
  const { g, m, pw, ph, X, Y, xmin, xmax } = f;
  (o.circles || []).forEach(c => {
    g.strokeStyle = c.color;
    g.lineWidth = c.width || 1.5;
    g.setLineDash(c.dash || [6, 4]);
    g.beginPath();
    g.ellipse(
      X(c.cx),
      Y(c.cy),
      Math.abs(X(c.cx + c.r) - X(c.cx)),
      Math.abs(Y(c.cy + c.r) - Y(c.cy)),
      0,
      0,
      2 * Math.PI,
    );
    g.stroke();
    g.setLineDash([]);
  });
  (o.bands || []).forEach(b => {
    const xa = X(Math.max(b.x0, xmin)),
      xb = X(Math.min(b.x1, xmax));
    if (xb <= xa) return;
    g.fillStyle = b.fill;
    g.fillRect(xa, Y(b.y1), xb - xa, Y(b.y0) - Y(b.y1));
    if (b.stroke) {
      g.strokeStyle = b.stroke;
      g.lineWidth = 1;
      g.setLineDash([4, 3]);
      g.strokeRect(xa, Y(b.y1), xb - xa, Y(b.y0) - Y(b.y1));
      g.setLineDash([]);
    }
  });
  (o.segs || []).forEach(s => {
    g.strokeStyle = s.color;
    g.setLineDash(s.dash || [6, 4]);
    g.lineWidth = 1.4;
    strokeLine(g, X(Math.max(s.x0, xmin)), Y(s.y), X(Math.min(s.x1, xmax)), Y(s.y));
    g.setLineDash([]);
  });
  (o.hlines || []).forEach(h => {
    g.strokeStyle = h.color;
    g.setLineDash(h.dash || [5, 4]);
    g.lineWidth = 1.2;
    strokeLine(g, m.l, Y(h.v), m.l + pw, Y(h.v));
    g.setLineDash([]);
  });
  (o.vlines || []).forEach(h => {
    g.strokeStyle = h.color;
    g.setLineDash(h.dash || [5, 4]);
    g.lineWidth = 1.2;
    strokeLine(g, X(h.v), m.t, X(h.v), m.t + ph);
    g.setLineDash([]);
    if (h.label) {
      g.fillStyle = h.color;
      g.font = '11px ' + UIFONT();
      g.textAlign = 'left';
      g.fillText(h.label, X(h.v) + 4, m.t + 13);
    }
  });
}

// One curve; it is interrupted at values that are not finite (and at x ≤ 0 on a logarithmic axis)
export function drawSeries(f: PlotFrame, s: PlotSeries) {
  const { g, X, Y } = f;
  g.strokeStyle = s.color;
  g.lineWidth = s.width || 2;
  g.setLineDash(s.dash || []);
  g.beginPath();
  let pen = false;
  for (let i = 0; i < s.x.length; i++) {
    const vx = s.x[i],
      vy = s.y[i];
    if (!isFinite(vy) || (f.lx && vx <= 0)) {
      pen = false;
      continue;
    }
    const px = X(vx),
      py = Math.max(-1e4, Math.min(1e4, Y(vy))); // keep far-off points within what the canvas can draw
    if (pen) g.lineTo(px, py);
    else g.moveTo(px, py);
    pen = true;
  }
  g.stroke();
  g.setLineDash([]);
}

// Markers (×) at given points
export function drawPoints(f: PlotFrame, points: NonNullable<PlotOptions['points']>) {
  const { g, X, Y } = f;
  points.forEach(p => {
    const px = X(p.x),
      py = Y(p.y);
    g.strokeStyle = p.color;
    g.lineWidth = 2;
    g.beginPath();
    if (p.shape === 'o') {
      g.arc(px, py, 5, 0, 2 * Math.PI);
      g.fillStyle = COLORS.white;
      g.fill();
      g.stroke();
      return;
    }
    g.moveTo(px - 6, py - 6);
    g.lineTo(px + 6, py + 6);
    g.moveTo(px + 6, py - 6);
    g.lineTo(px - 6, py + 6);
    g.stroke();
  });
}

// Legend of the named curves, in the top right corner
export function drawLegend(f: PlotFrame, series: PlotSeries[], pos: 'tr' | 'bl' = 'tr') {
  const leg = series.filter((s): s is PlotSeries & { name: string } => !!s.name);
  if (!leg.length) return;
  const { g, m, pw, ph } = f;
  g.font = '12px ' + UIFONT();
  g.textAlign = 'left';
  // top right (default) or bottom left
  const w = Math.max(...leg.map(s => g.measureText(s.name).width)),
    bx = pos === 'bl' ? m.l + 12 : m.l + pw - w - 42,
    by = pos === 'bl' ? m.t + ph - leg.length * 17 - 8 : m.t + 8;
  g.fillStyle = COLORS.legendBack;
  g.fillRect(bx - 6, by - 4, w + 44, leg.length * 17 + 6);
  leg.forEach((s, i) => {
    const y = by + 8 + i * 17;
    g.strokeStyle = s.color;
    g.lineWidth = s.width || 2;
    g.setLineDash(s.dash || []);
    strokeLine(g, bx, y, bx + 24, y);
    g.setLineDash([]);
    g.fillStyle = COLORS.text;
    g.fillText(s.name, bx + 30, y + 4);
  });
}

export const GHOST_COLORS = ['#9aa0aa', '#b7a99a', '#a3b3a0', '#b0a3b8'];
// Columns of the metric cards: all in one row up to four, otherwise two rows of equal length
export const metricCols = (n: number) => (n <= 4 ? Math.max(n, 1) : Math.ceil(n / 2));
// Metrics as cards or as a table (label and value in rows), chosen in the plot selection bar
export function metricsHTML(items: Metric[]): string {
  if (layout.mview === 'table')
    return `<div class="mtab">${items.map(([k, v]) => `<div class="mr"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}</div>`;
  return items.map(([k, v]) => `<div class="m"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
}
// A number with d decimals and a unit, or — when there is no value
export function fmtNum(v: number | null | undefined, d = 3, u = ''): string {
  return v === null || v === undefined || !isFinite(v) ? '—' : v.toFixed(d) + u;
}

// Widen the range r to include the values of a that pass keep
export function stretch(r: { lo: number; hi: number }, a: readonly number[], keep: (v: number) => boolean = isFinite) {
  a.forEach(v => {
    if (keep(v)) {
      r.lo = Math.min(r.lo, v);
      r.hi = Math.max(r.hi, v);
    }
  });
}

export const PNG_NAMES: Record<string, string> = Object.fromEntries(Object.entries(PLOTS).map(([k, v]) => [k, v.file]));
// The plot as a PNG image (white background, at the screen's pixel density)
export async function saveCanvasPNG(cv: HTMLCanvasElement) {
  const c = document.createElement('canvas');
  c.width = cv.width;
  c.height = cv.height;
  const g = ctx2d(c);
  g.fillStyle = COLORS.white;
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(cv, 0, 0);
  await savePNG(c, PNG_NAMES[cv.id] || 'plot');
}
