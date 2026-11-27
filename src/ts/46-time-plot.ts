// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Time response plot and its metrics ================= */
import { T } from './02-i18n.ts';
import { S, ghosts, lastSweep, refValue } from './11-state.ts';
import { distMetrics, twoDof } from './15-frequency.ts';
import { impulseMetrics, metricWindow, simulatePlant, sineMetrics, stepMetrics } from './16-simulation.ts';
import { loopTFs } from './17-loop.ts';
import { evalSpecs, specIcon, specOn } from './27-specs.ts';
import { sweepSeries } from './28-sweep.ts';
import { $ } from './40-dom.ts';
import { COLORS } from './41-view.ts';
import { GHOST_COLORS, fmtNum, metricCols, metricsHTML, plot, stretch } from './45-plot.ts';
// The response of the plant alone to r(t) (open loop), when chosen; computed again only when the settings change
let plantRun: { key: string; run: ReturnType<typeof simulatePlant> } | null = null;
export function plantAlone(): PlotSeries[] {
  if (!$('timePlant').checked && !$('timePlantOnly').checked) return [];
  const key = JSON.stringify(S);
  if (plantRun?.key !== key) plantRun = { key, run: simulatePlant() };
  const r = plantRun.run;
  return [{ x: r.T, y: r.Y, color: COLORS.plant, width: 1.8, dash: [7, 4], name: T('Plant alone (open loop)') }];
}
// Time response: output y(t) and control input u(t) with their metrics
export function drawTime(sim: SimResult) {
  const only = $('timePlantOnly').checked;
  (['tTitleCL', 'uTitleCL'] as const).forEach(id => ($(id).hidden = only));
  (['tTitleP', 'uTitleP'] as const).forEach(id => ($(id).hidden = !only));
  if (only) {
    drawPlantOnly();
    return;
  }
  $('plantBanner').style.display = 'none';
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
      ...plantAlone(),
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

// Only the plant alone: its output, and its input (the signal set as the reference) in the lower plot, with the
// metrics of its own response
export function drawPlantOnly() {
  plantAlone();
  const run = plantRun!.run,
    tmax = S.Tsim,
    vl: PlotLine[] =
      S.refType === 'impulse' && S.rT0 < tmax ? [{ v: S.rT0, color: COLORS.reference, label: T('Impulse') }] : [],
    U = run.T.map(t => refValue(t));
  const r = { lo: 0, hi: 0 };
  stretch(r, run.Y);
  const pad = (r.hi - r.lo) * 0.1 || 0.5;
  plot($('cvY'), {
    series: [{ x: run.T, y: run.Y, color: COLORS.plant, width: 2.4, name: T('Output y of the plant') }],
    xmin: 0,
    xmax: tmax,
    ymin: r.lo - pad,
    ymax: r.hi + pad,
    xlabel: T('Time t [s]'),
    ylabel: 'y',
    vlines: vl,
  });
  const ur = { lo: 0, hi: 0 }; // the range of u from 0
  stretch(ur, U);
  const upad = (ur.hi - ur.lo) * 0.1 || 0.5;
  plot($('cvU'), {
    series: [{ x: run.T, y: U, color: COLORS.input, width: 2, name: T('Input u to the plant') }],
    xmin: 0,
    xmax: tmax,
    ymin: ur.lo - upad,
    ymax: ur.hi + upad,
    xlabel: T('Time t [s]'),
    ylabel: 'u',
    vlines: vl,
  });
  $('divBanner').style.display = 'none';
  $('plantBanner').style.display = run.diverged ? 'block' : 'none';
  const items = plantMetrics(run);
  $('metrics').innerHTML = metricsHTML(items);
  $('metrics').style.setProperty('--mcols', String(metricCols(items.length)));
}
// Metrics of the plant alone: for a step (or trapezoid) input, relative to its own final value (the value at the end):
// rise time, overshoot, settling time and the final value; for an impulse, its peak, time and area; otherwise the
// largest |y| and y at the end
export function plantMetrics(run: ReturnType<typeof simulatePlant>): Metric[] {
  const f = fmtNum,
    n = run.Y.length,
    yEnd = n ? run.Y[n - 1] : NaN,
    st = { ...S, dOn: false },
    sim = { T: run.T, Y: run.Y, R: run.T.map(() => yEnd), U: [], iae: 0, diverged: run.diverged, substeps: 1 };
  if (run.diverged) return [[T('Final value'), '—']];
  const ymax: Metric = [T('Max |y|'), f(Math.max(...run.Y.map(Math.abs)), 4)];
  if (S.refType === 'step' || S.refType === 'trap') {
    const mt = stepMetrics(sim, { ...st, R: yEnd });
    return [
      [T('Final value'), f(yEnd, 4)],
      [T('Rise time (10–90%)'), mt ? f(mt.rise, 2, ' s') : '—'],
      [T('Max overshoot'), mt ? f(mt.os, 1, ' %') : '—'],
      [T('Settling time (±2%, from t₀)'), mt ? (mt.ts === null ? T('Not settled') : f(mt.ts, 2, ' s')) : '—'],
      [T('Steady-state gain y/u'), Math.abs(S.R) > 0 ? f(yEnd / S.R, 4) : '—'],
      ymax,
    ];
  }
  if (S.refType === 'impulse') {
    const im = impulseMetrics(sim, st);
    return [
      [T('Peak of y'), im ? f(im.peak, 4) : '—'],
      [T('Time of the peak (from t₀)'), im ? f(im.tPeak, 2, ' s') : '—'],
      [T('Area ∫ y dt'), im ? f(im.area, 4) : '—'],
      [T('y at the end'), f(yEnd, 4)],
    ];
  }
  return [[T('y at the end'), f(yEnd, 4)], ymax];
}
// Vertical range of y(t): the reference, held responses, sweep runs, the output and the specification lines that
// are shown, leaving out values far beyond the reference (automatic range when the response diverges or the
// reference is zero)
export function outputRange(sim: SimResult): { ymin?: number; ymax?: number } {
  const rmax = Math.max(0, ...sim.R.map(Math.abs));
  if (sim.diverged || !(rmax > 0)) return {};
  const r = { lo: 0, hi: 0 };
  stretch(r, sim.R, () => true);
  const ys = [
    ...ghosts.map(g => g.Y),
    ...(lastSweep || []).filter(w => !w.sim.diverged).map(w => w.sim.Y),
    ...plantAlone().map(s => s.y), // a diverging plant leaves the plot (only values near r count)
    sim.Y,
  ];
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
