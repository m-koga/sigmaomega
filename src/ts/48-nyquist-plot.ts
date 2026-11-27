// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Nyquist plot ================= */
import { S, lastPZ } from './11-state.ts';
import { nyqCount, nyqPath } from './23-loop-analysis.ts';
import { specOn } from './27-specs.ts';
import { sweepSeries } from './28-sweep.ts';
import { $, ctx2d } from './40-dom.ts';
import { COLORS } from './41-view.ts';
import { plot } from './45-plot.ts';
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
  if (nyqMapAt !== null) drawNyqMapMarker(cv, nyqMapAt);
}
/** The point of the Nyquist contour whose image is marked on the plot (an index of its samples), or null */
export let nyqMapAt: number | null = null;
export function setNyqMapAt(i: number | null) {
  nyqMapAt = i;
}
// The image L(s) of the point of the contour followed in the tab "Contour mapping", with the arrow from −1 to it
function drawNyqMapMarker(cv: HTMLCanvasElement, i: number) {
  const path = nyqPath(),
    tf = cv._tf;
  if (!path || !tf || !path.pts.length) return;
  const l = path.pts[Math.min(i, path.pts.length - 1)].l,
    g = ctx2d(cv),
    { m, pw, ph, xmin, xmax, ymin, ymax } = tf,
    X = (x: number) => m.l + ((x - xmin) / (xmax - xmin)) * pw,
    Y = (y: number) => m.t + ((ymax - y) / (ymax - ymin)) * ph;
  const x0 = X(-1),
    y0 = Y(0),
    x1 = X(l[0]),
    y1 = Y(l[1]),
    a = Math.atan2(y1 - y0, x1 - x0),
    len = Math.hypot(x1 - x0, y1 - y0);
  g.save();
  g.beginPath();
  g.rect(m.l, m.t, pw, ph);
  g.clip();
  g.strokeStyle = g.fillStyle = COLORS.approx;
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  if (len > 12) {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x1 - 10 * Math.cos(a - 0.35), y1 - 10 * Math.sin(a - 0.35));
    g.lineTo(x1 - 10 * Math.cos(a + 0.35), y1 - 10 * Math.sin(a + 0.35));
    g.closePath();
    g.fill();
  }
  g.beginPath();
  g.arc(x1, y1, 4.5, 0, 2 * Math.PI);
  g.fill();
  g.strokeStyle = COLORS.white;
  g.lineWidth = 1.2;
  g.stroke();
  g.restore();
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
