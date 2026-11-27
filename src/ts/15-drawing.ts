// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Drawing ================= */
import { T, TXT_BODE_RANGE, TXT_BODE_UNSTABLE, UIFONT } from './02-i18n.ts';
import { numStr } from './03-math.ts';
import { PLOTS } from './05-definitions.ts';
import { S, ghosts, lastPZ, lastSweep } from './06-state.ts';
import { distMetrics, mContour, twoDof } from './07-frequency.ts';
import { impulseMetrics, metricWindow, sineMetrics, stepMetrics } from './08-simulation.ts';
import { bodeAsymptote, loopTFs, nyqCount } from './09-loop.ts';
import { evalSpecs, specIcon, specOn } from './11-specs.ts';
import { sweepSeries } from './12-sweep.ts';
import { $, ctx2d, savePNG } from './13-dom.ts';
import { COLORS, PLOT_VIEWS, layout } from './14-view.ts';

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
  drawLegend(f, o.series);
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
export function drawLegend(f: PlotFrame, series: PlotSeries[]) {
  const leg = series.filter((s): s is PlotSeries & { name: string } => !!s.name);
  if (!leg.length) return;
  const { g, m, pw } = f;
  g.font = '12px ' + UIFONT();
  g.textAlign = 'left';
  const w = Math.max(...leg.map(s => g.measureText(s.name).width)),
    bx = m.l + pw - w - 42,
    by = m.t + 8;
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

// Time response: output y(t) and control input u(t) with their metrics
export function drawTime(sim: SimResult) {
  const tmax = S.Tsim;
  const vl: PlotLine[] = S.dOn && S.td < tmax ? [{ v: S.td, color: COLORS.alert, label: T('Disturbance') }] : [];
  if (S.refType === 'impulse' && S.rT0 < tmax) vl.push({ v: S.rT0, color: COLORS.reference, label: T('Impulse') });
  plot($('cvY'), {
    series: [
      ...ghosts.map((gh, i) => ({
        x: gh.T,
        y: gh.Y,
        color: GHOST_COLORS[i],
        width: 1.6,
        name: T('Held {n}', { n: i + 1 }),
      })),
      { x: sim.T, y: sim.R, color: COLORS.reference, width: 1.4, dash: [6, 4], name: T('Reference r') },
      ...sweepSeries(r => ({ x: r.sim.T, y: r.sim.Y })),
      { x: sim.T, y: sim.Y, color: COLORS.output, width: 2.4, name: T('Output y') },
    ],
    xmin: 0,
    xmax: tmax,
    ...outputRange(sim),
    xlabel: T('Time t [s]'),
    ylabel: 'y',
    vlines: vl,
    ...specMarks(),
  });
  plot($('cvU'), {
    series: [
      ...sweepSeries(r => ({ x: r.sim.T, y: r.sim.U })),
      { x: sim.T, y: sim.U, color: COLORS.input, width: 2, name: T('Control input u') },
    ],
    xmin: 0,
    xmax: tmax,
    ...inputRange(sim),
    xlabel: T('Time t [s]'),
    ylabel: 'u',
    hlines: S.sat
      ? [
          { v: S.umax, color: COLORS.alert },
          { v: -S.umax, color: COLORS.alert },
        ]
      : [],
    vlines: vl,
  });
  $('divBanner').style.display = sim.diverged ? 'block' : 'none';
  const items = timeMetrics(sim);
  $('metrics').innerHTML = metricsHTML(items);
  $('metrics').style.setProperty('--mcols', String(metricCols(items.length)));
}

// Vertical range of y(t): the reference, held responses, sweep runs, the output and the specification lines that
// are shown, leaving out values far beyond the reference (automatic range when the response diverges or the
// reference is zero)
export function outputRange(sim: SimResult): { ymin?: number; ymax?: number } {
  const rmax = Math.max(0, ...sim.R.map(Math.abs));
  if (sim.diverged || !(rmax > 0)) return {};
  const r = { lo: 0, hi: 0 };
  stretch(r, sim.R, () => true);
  const ys = [...ghosts.map(g => g.Y), ...(lastSweep || []).filter(w => !w.sim.diverged).map(w => w.sim.Y), sim.Y];
  ys.forEach(a => stretch(r, a, v => isFinite(v) && Math.abs(v) < 10 * rmax + 5));
  // the specification lines that are shown (overshoot limit, settling band, error limits) stay inside the plot
  const marks = specMarks();
  stretch(r, [...(marks.segs || []).map(g => g.y), ...(marks.bands || []).flatMap(b => [b.y0, b.y1])], isFinite);
  const pad = (r.hi - r.lo) * 0.1 || 0.5;
  return { ymin: r.lo - pad, ymax: r.hi + pad };
}

// Vertical range of u(t), with extreme peaks clipped so that a derivative kick does not squash the axis
// (automatic range with saturation, where the limits ±umax are drawn)
export function inputRange(sim: SimResult): { ymin?: number; ymax?: number } {
  if (S.sat) return {};
  const all = { lo: 0, hi: 0 };
  stretch(all, sim.U);
  const quantile = (a: number[]) => {
    const s = a.filter(isFinite).sort((x, y) => x - y);
    return (k: number) => s[Math.floor(k * (s.length - 1))] || 0;
  };
  const q = quantile(sim.U.slice()),
    lo2 = Math.min(0, q(0.005)),
    hi2 = Math.max(0, q(0.995)),
    pad = (hi2 - lo2) * 0.2 || 0.5;
  const r = { ymin: Math.max(all.lo, lo2 - pad * 2), ymax: Math.min(all.hi, hi2 + pad * 2) };
  if (r.ymax - r.ymin < 1e-6) {
    r.ymin -= 0.5;
    r.ymax += 0.5;
  }
  const p = (r.ymax - r.ymin) * 0.08;
  r.ymin -= p;
  r.ymax += p;
  (lastSweep || []).forEach(w => {
    if (w.sim.diverged) return;
    const qs = quantile(w.sim.U);
    r.ymin = Math.min(r.ymin, qs(0.005));
    r.ymax = Math.max(r.ymax, qs(0.995));
  });
  return r;
}

// Specification limits drawn on y(t) for step and trapezoid references: settling band, overshoot limit,
// steady-state error limits
export function specMarks(): { bands: PlotOptions['bands']; segs: PlotOptions['segs'] } {
  const bands: PlotOptions['bands'] = [],
    segs: PlotOptions['segs'] = [];
  if (S.spec.show && (S.refType === 'step' || S.refType === 'trap') && Math.abs(S.R) > 0) {
    const r0 = S.R,
      lo = Math.min(r0 * 0.98, r0 * 1.02),
      hi = Math.max(r0 * 0.98, r0 * 1.02);
    if (specOn('ts'))
      bands.push({
        x0: S.rT0 + S.spec.ts.v,
        x1: Infinity,
        y0: lo,
        y1: hi,
        fill: COLORS.specBand,
        stroke: COLORS.spec,
      });
    if (specOn('os')) segs.push({ x0: S.rT0, x1: Infinity, y: r0 * (1 + S.spec.os.v / 100), color: COLORS.alert });
    if (specOn('sse'))
      [r0 - S.spec.sse.v, r0 + S.spec.sse.v].forEach(y =>
        segs.push({ x0: S.rT0, x1: Infinity, y, color: COLORS.spec, dash: [2, 3] }),
      );
  }
  return { bands, segs };
}

// Metrics of the time response, depending on the kind of reference, plus the disturbance metrics
export function timeMetrics(sim: SimResult): Metric[] {
  const f = fmtNum,
    ev = evalSpecs(),
    ty = S.refType;
  const pre = S.dOn ? T(' (before disturbance)') : '';
  const iae: Metric = ['IAE ∫|e|dt', sim.diverged ? '—' : f(sim.iae, 3)];
  const umax: Metric = [T('Max |u|'), sim.diverged ? '—' : f(Math.max(...sim.U.map(Math.abs)), 2)];
  // error at the end and largest error, up to the disturbance (or the end)
  const win = sim.diverged ? null : metricWindow(sim);
  const eEnd = win ? sim.R[win.last] - sim.Y[win.last] : null;
  let emaxAll: number | null = null;
  if (win) {
    emaxAll = 0;
    for (let i = 0; i <= win.last; i++) emaxAll = Math.max(emaxAll, Math.abs(sim.R[i] - sim.Y[i]));
  }
  let cards: Metric[];
  if (ty === 'step' || ty === 'trap') {
    const mt = stepMetrics(sim);
    cards = [
      [T('Rise time (10–90%)'), specIcon('tr', ev) + (mt ? f(mt.rise, 2, ' s') : '—')],
      [T('Max overshoot'), specIcon('os', ev) + (mt ? f(mt.os, 1, ' %') : '—')],
      [
        T('Settling time (±2%, from t₀)'),
        specIcon('ts', ev) + (mt ? (mt.ts === null ? T('Not settled') : f(mt.ts, 2, ' s')) : '—'),
      ],
      [T('Steady-state error') + pre, specIcon('sse', ev) + (mt ? f(mt.sse, 4) : '—')],
      iae,
      umax,
    ];
  } else if (ty === 'ramp' || ty === 'parab') {
    const name = ty === 'ramp' ? T('Steady-state velocity error') : T('Steady-state acceleration error');
    cards = [[name + T(' (e at the end)') + pre, f(eEnd, 4)], [T('Max |e|') + pre, f(emaxAll, 4)], iae, umax];
  } else if (ty === 'impulse') {
    const im = impulseMetrics(sim),
      g = loopTFs().R,
      d0 = (g.den0[g.den0.length - 1] ?? 0) + (g.den1[g.den1.length - 1] ?? 0),
      theory = Math.abs(d0) > 1e-12 ? (S.R * (g.num[g.num.length - 1] ?? 0)) / d0 : null;
    cards = [
      [T('Peak of y'), im ? f(im.peak, 4) : '—'],
      [T('Time of the peak (from t₀)'), im ? f(im.tPeak, 2, ' s') : '—'],
      [T('Area ∫ y dt') + pre, im ? f(im.area, 4) : '—'],
      [twoDof() ? T('Theory A·Gyr(0)') : T('Theory A·T(0)'), theory === null ? '—' : f(theory, 4)],
      [T('y at the end') + pre, im ? f(im.yEnd, 4) : '—'],
      [T('Max |u| (without the impulse)'), umax[1]],
    ];
  } else if (ty === 'sine') {
    const sm = sineMetrics(sim),
      ok = sm && !sm.short,
      none = '—' + (sm && sm.short ? T(' (too short)') : '');
    cards = [
      [T('Amplitude ratio |y|/|r| (ω = {w} rad/s)', { w: sm ? f(sm.w, 3) : '—' }), ok ? f(sm.ratio, 3) : none],
      [T('Phase difference ∠y − ∠r'), ok ? f(sm.phase, 1, ' °') : none],
      [twoDof() ? T('Theory |Gyr(jω)|') : T('Theory |T(jω)|'), sm ? f(sm.ratioT, 3) : '—'],
      [twoDof() ? T('Theory ∠Gyr(jω)') : T('Theory ∠T(jω)'), sm ? f(sm.phT, 1, ' °') : '—'],
      [T('Steady-state max |e|') + pre, ok ? f(sm.emax, 4) : none],
      umax,
    ];
  } else {
    cards = [[T('Max |e|') + pre, f(emaxAll, 4)], [T('e at the end') + pre, f(eEnd, 4)], iae, umax];
  }
  const dm = distMetrics(sim);
  if (dm)
    cards.push(
      [T('Max deviation by the disturbance'), f(dm.dev, 4)],
      [T('Recovery time after the disturbance'), dm.rec === null ? T('Not recovered') : f(dm.rec, 2, ' s')],
    );
  return cards;
}
export function bodeDescDefault() {
  const on = [...document.querySelectorAll<HTMLElement>('#bodeOpts .ctg')]
    .filter(l => l.querySelector<HTMLInputElement>('input')?.checked)
    .map(l => T(l.dataset.desc || l.title));
  $('bodeDesc').textContent = on.length ? on.join(' ／ ') : T('Select the curves to show');
}
/** A curve of the Bode plot: gain [dB] and phase [deg] at the frequencies fr.W, with its line style */
interface BodeCurve {
  name: string;
  mag: number[];
  ph: number[];
  color: string;
  dash: number[];
  width: number;
}

// Bode plot: gain and phase of the selected curves (and of L(jω) for each sweep run), with the margins.
// The curves are drawn from frB (the range set by hand, or the automatic one); the margins always come from fr.
export function drawBode(fr: FreqResult, frB: FreqResult = fr) {
  const showL = $('bodeL').checked,
    showS = $('bodeS').checked;
  const sets = bodeCurves(frB),
    vl: PlotLine[] = [];
  if (showL) {
    if (fr.wgc) vl.push({ v: fr.wgc, color: COLORS.output, label: 'ωgc' });
    if (fr.wpc) vl.push({ v: fr.wpc, color: COLORS.alert, label: 'ωpc' });
  }
  const sw = showL ? sweepSeries(r => ({ x: (r.frB || r.fr).W, y: (r.frB || r.fr).mag })) : [],
    swp = showL ? sweepSeries(r => ({ x: (r.frB || r.fr).W, y: (r.frB || r.fr).ph })) : [],
    runs = showL ? (lastSweep || []).map(r => r.frB || r.fr) : [];
  // the straight-line approximation of the gain of L, with its break frequencies
  const asym = $('bodeA').checked ? bodeAsymptote() : null,
    asymSeries: PlotSeries[] = asym
      ? [
          {
            x: frB.W,
            y: frB.W.map(asym.gain),
            color: COLORS.asymptote,
            width: 2,
            dash: [6, 4],
            name: T('L asymptotes'),
          },
        ]
      : [],
    asymPts = asym
      ? asym.breaks
          .filter(b => b.w >= frB.W[0] && b.w <= frB.W[frB.W.length - 1])
          .map(b => ({ x: b.w, y: asym.gain(b.w), color: COLORS.asymptote, shape: 'o' as const }))
      : [];
  const named = sets.length > 0 || sw.length > 0 || !!asym; // a legend whenever a curve is shown, also a single one
  const curves = (key: 'mag' | 'ph') =>
    sets.map(s => ({
      x: frB.W,
      y: s[key],
      color: s.color,
      width: s.width,
      dash: s.dash,
      name: named ? s.name : undefined,
    }));
  const common = {
    xlog: true,
    xmin: frB.W[0],
    xmax: frB.W[frB.W.length - 1],
    xlabel: T('Frequency ω [rad/s]'),
    vlines: vl,
  };
  // gain: whole multiples of 20 dB, at least −20 … 20 dB, at most ±120 dB
  const gr = { lo: Infinity, hi: -Infinity };
  sets.forEach(s => stretch(gr, s.mag));
  asymSeries.forEach(s => stretch(gr, s.y));
  if (!sets.length && !asym) Object.assign(gr, { lo: -20, hi: 20 });
  gr.lo = Math.max(gr.lo, -120);
  gr.hi = Math.min(gr.hi, 120);
  runs.forEach(r =>
    r.mag.forEach(v => {
      if (isFinite(v)) {
        gr.lo = Math.min(gr.lo, Math.max(v, -120));
        gr.hi = Math.max(gr.hi, Math.min(v, 120));
      }
    }),
  );
  plot($('cvG'), {
    ...common,
    series: [...sw, ...curves('mag'), ...asymSeries],
    points: asymPts,
    ymin: Math.floor(Math.min(gr.lo, -20) / 20) * 20,
    ymax: Math.ceil(Math.max(gr.hi, 20) / 20) * 20,
    ylabel: T('Gain [dB]'),
    hlines: [
      { v: 0, color: COLORS.zeroDb, dash: [3, 3] },
      ...(S.spec.show && specOn('gm') && showL ? [{ v: -S.spec.gm.v, color: COLORS.spec, dash: [6, 4] }] : []),
      ...(S.spec.show && specOn('ms') && showS
        ? [{ v: 20 * Math.log10(S.spec.ms.v), color: COLORS.sensitivity, dash: [2, 3] }]
        : []),
    ],
    yticks: (a, b) => niceTicks(a, b, 6),
  });
  // phase: whole multiples of 90°, at least −180 … 0°, at most ±720°
  const pr = { lo: Infinity, hi: -Infinity };
  sets.forEach(s => stretch(pr, s.ph));
  if (!sets.length) Object.assign(pr, { lo: -180, hi: 0 });
  runs.forEach(r => stretch(pr, r.ph));
  pr.lo = Math.max(pr.lo, -720);
  pr.hi = Math.min(pr.hi, 720);
  plot($('cvPh'), {
    ...common,
    series: [...swp, ...curves('ph')],
    ymin: Math.floor(Math.min(pr.lo, -180) / 90) * 90,
    ymax: Math.ceil(Math.max(pr.hi, 0) / 90) * 90,
    ylabel: T('Phase [deg]'),
    hlines: [
      { v: -180, color: COLORS.alert, dash: [3, 3] },
      ...(S.spec.show && specOn('pm') && showL ? [{ v: -180 + S.spec.pm.v, color: COLORS.spec, dash: [6, 4] }] : []),
    ],
    yticks: (a, b) => {
      const t: number[] = [];
      const step = b - a > 360 ? 90 : 45;
      for (let v = Math.ceil(a / step) * step; v <= b; v += step) t.push(v);
      return t;
    },
  });
  showBodeRange(frB, frB !== fr);
  $('margins').innerHTML = metricsHTML(marginMetrics(fr));
  $('bodeNote').textContent = fr.openUnstable ? T(TXT_BODE_UNSTABLE) : T(TXT_BODE_RANGE, { a: fr.w0, b: fr.w1 });
}

// The frequency range of the Bode plot in its inputs, and whether it was set by hand
export function showBodeRange(f: FreqResult, manual: boolean) {
  $('wrLo').value = String(+f.W[0].toPrecision(4));
  $('wrHi').value = String(+f.W[f.W.length - 1].toPrecision(4));
  $('wrAuto').disabled = !manual;
  $('wrState').textContent = manual
    ? T('Set by hand (returns to automatic when the poles, zeros, dead time, or simulation time change)')
    : T('Automatic');
}
// The curves selected with the Bode buttons, drawn in this order (L(jω) last, on top)
export function bodeCurves(fr: FreqResult): BodeCurve[] {
  const sets: BodeCurve[] = [];
  const add = (
    id: 'bodeL' | 'bodeP' | 'bodeC' | 'bodeS' | 'bodeT' | 'bodeD' | 'bodeR',
    name: string,
    r: { mag: number[]; ph: number[] },
    color: string,
    dash: number[],
    width: number,
  ) => {
    if ($(id).checked) sets.push({ name, mag: r.mag, ph: r.ph, color, dash, width });
  };
  add('bodeP', 'P(jω)', fr.P, COLORS.plant, [7, 4], 2);
  add('bodeC', 'C(jω)', fr.C, COLORS.input, [2, 3], 2.2);
  add('bodeS', 'S(jω)', fr.S, COLORS.sensitivity, [8, 3], 2);
  add('bodeD', 'Gyd(jω)', fr.D, COLORS.disturbanceTF, [2, 3], 2.2);
  add('bodeR', 'Gyr(jω)', fr.Gyr, COLORS.referenceTF, [12, 5], 1.8);
  add('bodeT', 'T(jω)', fr.T, COLORS.complementary, [9, 3, 2, 3], 2);
  add('bodeL', 'L(jω)', fr, COLORS.output, [], 2.4);
  return sets;
}

// Stability margins and closed-loop peaks (the closed-loop values only when the closed loop is stable)
export function marginMetrics(fr: FreqResult): Metric[] {
  const f = fmtNum,
    ev = evalSpecs(),
    clOK = !lastPZ || lastPZ.cl.every(z => z[0] < 0);
  const withDb = (x: number) => {
    const db = 20 * Math.log10(x);
    return `${numStr(x)} (${f(Math.abs(db) < 0.005 ? 0 : db, 2, ' dB')})`;
  };
  return [
    [T('Gain margin GM'), specIcon('gm', ev) + (fr.gm === null ? '∞' : f(fr.gm, 2, ' dB'))],
    [T('Phase margin PM'), specIcon('pm', ev) + f(fr.pm, 1, ' °')],
    [T('Gain crossover ωgc'), f(fr.wgc, 3, ' rad/s')],
    [T('Phase crossover ωpc'), f(fr.wpc, 3, ' rad/s')],
    [T('Peak sensitivity Ms'), specIcon('ms', ev) + (clOK && fr.ms !== null ? withDb(fr.ms) : '—')],
    [T('Peak of T  Mt'), clOK && fr.mt !== null ? withDb(fr.mt) : '—'],
    [T('Closed-loop bandwidth ωBW'), clOK ? f(fr.wbw, 3, ' rad/s') : '—'],
    [
      T('Peak disturbance gain max|Gyd|'),
      clOK && fr.dmax !== null ? `${numStr(fr.dmax)} (ω = ${f(fr.wdmax, 3, ' rad/s')})` : '—',
    ],
  ];
}
export function drawNyq(fr: FreqResult) {
  const re = fr.Lc.map(z => z[0]),
    im = fr.Lc.map(z => z[1]);
  let x0 = -2,
    x1 = 1,
    y0 = -1.5,
    y1 = 1.5;
  fr.Lc.forEach(z => {
    if (Math.hypot(z[0], z[1]) < 6) {
      x0 = Math.min(x0, z[0]);
      x1 = Math.max(x1, z[0]);
      y0 = Math.min(y0, z[1], -z[1]);
      y1 = Math.max(y1, z[1], -z[1]);
    }
  });
  // Equal aspect ratio
  const cv = $('cvN');
  const pw = cv.clientWidth - 74,
    ph = cv.clientHeight - 48;
  if (pw > 0) {
    const sx = (x1 - x0) / pw,
      sy = (y1 - y0) / ph,
      s = Math.max(sx, sy) * 1.08;
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    x0 = cx - (s * pw) / 2;
    x1 = cx + (s * pw) / 2;
    y0 = cy - (s * ph) / 2;
    y1 = cy + (s * ph) / 2;
  }
  plot(cv, {
    series: [
      { x: re, y: im.map(v => -v), color: COLORS.negativeFreq, width: 1.4, dash: [5, 4], name: 'ω < 0' },
      ...sweepSeries(r => ({ x: r.fr.Lc.map(z => z[0]), y: r.fr.Lc.map(z => z[1]) })),
      { x: re, y: im, color: COLORS.output, width: 2.2, name: 'ω > 0' },
    ],
    xmin: x0,
    xmax: x1,
    ymin: y0,
    ymax: y1,
    xlabel: 'Re L(jω)',
    ylabel: 'Im L(jω)',
    points: [{ x: -1, y: 0, color: COLORS.alert }],
    circles: [
      ...($('nyqMs').checked && fr.ms !== null && fr.ms > 0 && (!lastPZ || lastPZ.cl.every(z => z[0] < 0))
        ? [{ cx: -1, cy: 0, r: 1 / (fr.ms as number), color: COLORS.sensitivity, dash: [6, 4] }]
        : []),
      ...(S.spec.show && specOn('ms')
        ? [{ cx: -1, cy: 0, r: 1 / S.spec.ms.v, color: COLORS.spec, dash: [2, 3], width: 1.3 }]
        : []),
    ],
    vlines: [{ v: 0, color: COLORS.zeroLine, dash: [] }],
  });
  if ($('nyqCount').checked) drawNyqCrossings(cv);
}
// The crossings of the real axis to the left of −1 on the drawn part of the plot: ▲ from below to above (clockwise,
// +1) and ▼ from above to below (counterclockwise, −1); those on the half circles around the poles on the imaginary
// axis are far away and not drawn
export function drawNyqCrossings(cv: HTMLCanvasElement) {
  const c = nyqCount(),
    tf = cv._tf;
  if (!c || !tf) return;
  const g = ctx2d(cv),
    { m, pw, ph, xmin, xmax, ymin, ymax } = tf,
    X = (x: number) => m.l + ((x - xmin) / (xmax - xmin)) * pw,
    Y = (y: number) => m.t + ((ymax - y) / (ymax - ymin)) * ph;
  g.save();
  g.beginPath();
  g.rect(m.l, m.t, pw, ph);
  g.clip();
  g.fillStyle = COLORS.nyqCrossing;
  g.strokeStyle = COLORS.white;
  g.lineWidth = 1;
  // a crossing at ω > 0 and its mirror image at ω < 0 are at the same place, in the same direction: one mark, counted
  const marks: { x: number; dir: number; n: number }[] = [];
  c.crossings.forEach(k => {
    if (k.arc !== null) return;
    const same = marks.find(q => q.dir === k.dir && Math.abs(q.x - k.x) <= 1e-6 * (1 + Math.abs(k.x)));
    if (same) same.n++;
    else marks.push({ x: k.x, dir: k.dir, n: 1 });
  });
  g.font = '11px "JetBrains Mono", monospace';
  g.textAlign = 'center';
  marks.forEach(({ x, dir: d, n }) => {
    const px = X(x),
      py = Y(0); // ▲ for +1
    g.fillStyle = COLORS.nyqCrossing;
    g.strokeStyle = COLORS.white;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(px, py - 7 * d);
    g.lineTo(px + 6, py + 4 * d);
    g.lineTo(px - 6, py + 4 * d);
    g.closePath();
    g.fill();
    g.stroke();
    const label = `${d > 0 ? '+' : '−'}${n}`,
      ly = py - 13 * d + (d > 0 ? 0 : 8);
    g.lineWidth = 3;
    g.strokeText(label, px, ly);
    g.fillText(label, px, ly);
  });
  g.restore();
}
// M contours of the Nichols chart [dB] and the ones labelled
export const M_CONTOURS = [12, 6, 3, 1, 0.5, 0, -1, -3, -6, -12, -20];
// Nichols chart: the gain of L(jω) [dB] against its phase [deg] (ω > 0), over the M contours of the closed loop
// |T| = |L/(1 + L)| (repeating every 360°), with the critical points (−180° − 360°k, 0 dB)
export function drawNich(fr: FreqResult) {
  const cv = $('cvNi'),
    pr = { lo: Infinity, hi: -Infinity },
    gr = { lo: Infinity, hi: -Infinity };
  fr.ph.forEach((p, i) => {
    if (fr.mag[i] > -60 && fr.mag[i] < 60) stretch(pr, [p]);
  });
  stretch(gr, fr.mag);
  if (!isFinite(pr.lo)) Object.assign(pr, { lo: -270, hi: -90 });
  const xmin = Math.max(-720, Math.floor(Math.min(pr.lo, -225) / 45) * 45),
    xmax = Math.min(180, Math.ceil(Math.max(pr.hi, -90) / 45) * 45),
    ymin = Math.floor(Math.min(Math.max(gr.lo, -60), -20) / 10) * 10,
    ymax = Math.ceil(Math.max(Math.min(gr.hi, 60), 20) / 10) * 10;
  // the contours over the range and one period beyond it on each side (for panning)
  const phs: number[] = [];
  for (let p = xmin - 360; p <= xmax + 360; p += 0.5) phs.push(p);
  const contours: PlotSeries[] = M_CONTOURS.flatMap(m => {
    const c = mContour(m, phs);
    return [c.lo, c.hi].map(y => ({ x: phs, y, color: COLORS.mContour, width: 1, dash: m === 0 ? [] : [4, 4] }));
  });
  const crit: NonNullable<PlotOptions['points']> = [];
  for (let p = -180; p >= xmin - 360; p -= 360) crit.push({ x: p, y: 0, color: COLORS.alert });
  for (let p = 180; p <= xmax + 360; p += 360) crit.push({ x: p, y: 0, color: COLORS.alert });
  plot(cv, {
    series: [
      ...contours,
      ...sweepSeries(r => ({ x: r.fr.ph, y: r.fr.mag })),
      { x: fr.ph, y: fr.mag, color: COLORS.output, width: 2.2, name: 'L(jω)' },
    ],
    xmin,
    xmax,
    ymin,
    ymax,
    xlabel: T('Phase [deg]'),
    ylabel: T('Gain [dB]'),
    points: crit,
    hlines: [{ v: 0, color: COLORS.zeroDb, dash: [3, 3] }],
    vlines: [{ v: -180, color: COLORS.zeroLine, dash: [] }],
  });
  drawMLabels(cv);
}
// Labels of the M contours: M ≥ 0 dB where they cross the phase of the critical point (the upper branch), M < 0 dB
// 160° to its right (or near the right edge of the view), where they are spread apart
export function drawMLabels(cv: HTMLCanvasElement) {
  const tf = cv._tf;
  if (!tf) return;
  const g = ctx2d(cv),
    { m, pw, ph, xmin, xmax, ymin, ymax } = tf,
    X = (x: number) => m.l + ((x - xmin) / (xmax - xmin)) * pw,
    Y = (y: number) => m.t + ((ymax - y) / (ymax - ymin)) * ph;
  g.save();
  g.beginPath();
  g.rect(m.l, m.t, pw, ph);
  g.clip();
  g.font = '10.5px "JetBrains Mono", monospace';
  g.textAlign = 'center';
  g.fillStyle = COLORS.mLabel;
  g.strokeStyle = COLORS.white;
  g.lineWidth = 3;
  // the critical point in the view (or the nearest one to its middle)
  const mid = (xmin + xmax) / 2,
    pc = -180 + 360 * Math.round((mid + 180) / 360);
  M_CONTOURS.forEach(mv => {
    const px = mv < 0 ? Math.min(pc + 160, xmax - 0.1 * (xmax - xmin)) : pc,
      c = mContour(mv, [px]),
      y = mv > 0 ? c.hi[0] : c.lo[0];
    if (!isFinite(y) || y < ymin || y > ymax) return;
    const label = `${mv > 0 ? '+' : ''}${mv} dB`;
    g.strokeText(label, X(px), Y(y) - 3);
    g.fillText(label, X(px), Y(y) - 3);
  });
  g.restore();
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
