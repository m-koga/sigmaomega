// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Nichols chart ================= */
import { T } from './02-i18n.ts';
import { mContour } from './15-frequency.ts';
import { sweepSeries } from './28-sweep.ts';
import { $, ctx2d } from './40-dom.ts';
import { COLORS } from './41-view.ts';
import { plot, stretch } from './45-plot.ts';
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
