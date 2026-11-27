// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Bode plot, its margins and the straight-line approximation ================= */
import { T, TXT_BODE_RANGE, TXT_BODE_UNSTABLE } from './02-i18n.ts';
import { numStr } from './03-math.ts';
import { S, lastPZ, lastSweep } from './11-state.ts';
import { bodeAsymptote } from './19-bode-asymptote.ts';
import type { BodeAsymptote } from './19-bode-asymptote.ts';
import { evalSpecs, specIcon, specOn } from './27-specs.ts';
import { sweepSeries } from './28-sweep.ts';
import { $ } from './40-dom.ts';
import { COLORS } from './41-view.ts';
import { fmtNum, metricsHTML, niceTicks, plot, stretch } from './45-plot.ts';
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

// The straight-line approximation of L for the Bode plot (buttons "L asymptotes" and "Factors"): the sum, dashed,
// with dots at its break frequencies, and the lines of its factors in their own colors. The phase is shifted by a
// multiple of 360° onto the branch of the plotted phase of L (with the factor K/s^q, which carries that shift).
interface BodeAsymCurves {
  asym: ReturnType<typeof bodeAsymptote>;
  gain: PlotSeries[];
  phase: PlotSeries[];
  gainPts: PlotPoint[];
  phasePts: PlotPoint[];
  parts: (key: 'gain' | 'ph') => PlotSeries[];
}
function bodeAsymCurves(frB: FreqResult): BodeAsymCurves {
  const showParts = $('bodeAc').checked,
    drawSum = $('bodeA').checked,
    asym = drawSum || showParts ? bodeAsymptote() : null,
    W = frB.W;
  if (!asym) return { asym, gain: [], phase: [], gainPts: [], phasePts: [], parts: () => [] };
  const phOff = 360 * Math.round((frB.ph[0] - asym.phase(W[0])) / 360);
  const sum = (y: number[]): PlotSeries[] =>
    drawSum ? [{ x: W, y, color: COLORS.asymptote, width: 2, dash: [6, 4], name: T('L asymptotes') }] : [];
  const gainPts: PlotPoint[] = drawSum
    ? asym.breaks
        .filter(b => b.w >= W[0] && b.w <= W[W.length - 1])
        .map(b => ({ x: b.w, y: asym.gain(b.w), color: COLORS.asymptote, shape: 'o' as const }))
    : [];
  return {
    asym,
    gain: sum(W.map(asym.gain)),
    phase: sum(W.map(w => asym.phase(w) + phOff)),
    gainPts,
    phasePts: gainPts.map(p => ({ ...p, y: asym.phase(p.x) + phOff })),
    parts: (key: 'gain' | 'ph'): PlotSeries[] =>
      showParts
        ? asym.parts.map((p, i) => ({
            x: W,
            y: W.map(w => (key === 'gain' ? p.gain(w) : p.phase(w) + (p.kind === 'K' ? phOff : 0))),
            color: COLORS.asymParts[i % COLORS.asymParts.length],
            width: 1.4,
            name: asymPartLabel(asym, p),
          }))
        : [],
  };
}
// Vertical range of the gain: whole multiples of 20 dB, at least −20 … 20 dB, at most ±120 dB
function bodeGainRange(curves: number[][], runs: FreqResult[], empty: boolean): [number, number] {
  const r = { lo: Infinity, hi: -Infinity };
  curves.forEach(c => stretch(r, c));
  if (empty) Object.assign(r, { lo: -20, hi: 20 });
  r.lo = Math.max(r.lo, -120);
  r.hi = Math.min(r.hi, 120);
  runs.forEach(f =>
    f.mag.forEach(v => {
      if (isFinite(v)) {
        r.lo = Math.min(r.lo, Math.max(v, -120));
        r.hi = Math.max(r.hi, Math.min(v, 120));
      }
    }),
  );
  return [Math.floor(Math.min(r.lo, -20) / 20) * 20, Math.ceil(Math.max(r.hi, 20) / 20) * 20];
}
// Vertical range of the phase: whole multiples of 90°, at least −180 … 0°, at most ±720°
function bodePhaseRange(curves: number[][], runs: FreqResult[], empty: boolean): [number, number] {
  const r = { lo: Infinity, hi: -Infinity };
  curves.forEach(c => stretch(r, c));
  if (empty) Object.assign(r, { lo: -180, hi: 0 });
  runs.forEach(f => stretch(r, f.ph));
  r.lo = Math.max(r.lo, -720);
  r.hi = Math.min(r.hi, 720);
  return [Math.floor(Math.min(r.lo, -180) / 90) * 90, Math.ceil(Math.max(r.hi, 0) / 90) * 90];
}
// Ticks of the phase: every 45°, or every 90° over more than 360°
function phaseTicks(a: number, b: number): number[] {
  const t: number[] = [];
  const step = b - a > 360 ? 90 : 45;
  for (let v = Math.ceil(a / step) * step; v <= b; v += step) t.push(v);
  return t;
}
// The note of the Bode plot: the frequency range (or why L is not shown on its own) and the straight-line rules
function bodeNoteHTML(fr: FreqResult): string {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return (
    `<p>${esc(fr.openUnstable ? T(TXT_BODE_UNSTABLE) : T(TXT_BODE_RANGE, { a: fr.w0, b: fr.w1 }))}</p>` +
    `<p><b>${esc(T('Straight-line approximation (button “L asymptotes”)'))}</b></p><ul>` +
    ASYM_NOTES.map(k => `<li>${esc(T(k))}</li>`).join('') +
    '</ul>'
  );
}
// Bode plot: gain and phase of the selected curves (and of L(jω) for each sweep run), with the margins.
// The curves are drawn from frB (the range set by hand, or the automatic one); the margins always come from fr.
export function drawBode(fr: FreqResult, frB: FreqResult = fr) {
  const showL = $('bodeL').checked,
    showS = $('bodeS').checked,
    spec = (k: SpecKey) => S.spec.show && specOn(k);
  const sets = bodeCurves(frB),
    vl: PlotLine[] = [];
  if (showL) {
    if (fr.wgc) vl.push({ v: fr.wgc, color: COLORS.output, label: 'ωgc' });
    if (fr.wpc) vl.push({ v: fr.wpc, color: COLORS.alert, label: 'ωpc' });
  }
  const sw = showL ? sweepSeries(r => ({ x: (r.frB || r.fr).W, y: (r.frB || r.fr).mag })) : [],
    swp = showL ? sweepSeries(r => ({ x: (r.frB || r.fr).W, y: (r.frB || r.fr).ph })) : [],
    runs = showL ? (lastSweep || []).map(r => r.frB || r.fr) : [];
  const A = bodeAsymCurves(frB);
  const named = sets.length > 0 || sw.length > 0 || !!A.asym; // a legend whenever a curve is shown, also a single one
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
  const [gmin, gmax] = bodeGainRange([...sets.map(s => s.mag), ...A.gain.map(s => s.y)], runs, !sets.length && !A.asym);
  plot($('cvG'), {
    ...common,
    series: [...sw, ...A.parts('gain'), ...curves('mag'), ...A.gain],
    points: A.gainPts,
    ymin: gmin,
    ymax: gmax,
    ylabel: T('Gain [dB]'),
    hlines: [
      { v: 0, color: COLORS.zeroDb, dash: [3, 3] },
      ...(spec('gm') && showL ? [{ v: -S.spec.gm.v, color: COLORS.spec, dash: [6, 4] }] : []),
      ...(spec('ms') && showS ? [{ v: 20 * Math.log10(S.spec.ms.v), color: COLORS.sensitivity, dash: [2, 3] }] : []),
    ],
    yticks: (a, b) => niceTicks(a, b, 6),
  });
  const [pmin, pmax] = bodePhaseRange([...sets.map(s => s.ph), ...A.phase.map(s => s.y)], runs, !sets.length);
  plot($('cvPh'), {
    ...common,
    series: [...swp, ...A.parts('ph'), ...curves('ph'), ...A.phase],
    points: A.phasePts,
    ymin: pmin,
    ymax: pmax,
    ylabel: T('Phase [deg]'),
    hlines: [
      { v: -180, color: COLORS.alert, dash: [3, 3] },
      ...(spec('pm') && showL ? [{ v: -180 + S.spec.pm.v, color: COLORS.spec, dash: [6, 4] }] : []),
    ],
    yticks: phaseTicks,
  });
  showBodeRange(frB, frB !== fr);
  $('margins').innerHTML = metricsHTML(marginMetrics(fr));
  $('bodeNote').innerHTML = bodeNoteHTML(fr);
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
// The name of a factor of the asymptotes in the legend: K/s^q, a pole or zero (with its multiplicity), the dead time
const SUP: Record<string, string> = {
  '-': '⁻',
  2: '²',
  3: '³',
  4: '⁴',
  5: '⁵',
  6: '⁶',
  7: '⁷',
  8: '⁸',
  9: '⁹',
  1: '¹',
  0: '⁰',
};
const sup = (n: number) => (n === 1 ? '' : String(n).replace(/./g, c => SUP[c] ?? c));
export function asymPartLabel(a: BodeAsymptote, p: BodeAsymptote['parts'][number]): string {
  if (p.kind === 'delay') return `e^(−${numStr(a.L)}s)`;
  if (p.kind === 'K')
    return a.q === 0 ? `K = ${numStr(a.K)}` : a.q > 0 ? `${numStr(a.K)}/s${sup(a.q)}` : `${numStr(a.K)}·s${sup(-a.q)}`;
  const [x, y] = p.z!,
    m = p.mult > 1 ? ` ×${p.mult}` : '';
  return y > 0
    ? `${T(p.kind === 'pole' ? 'complex poles' : 'complex zeros')} ${numStr(x)} ± j${numStr(y)}${m}`
    : `${T(p.kind)} ${numStr(x)}${m}`;
}
// The method of the straight-line approximation of the Bode plot, in the note under it
export const ASYM_NOTES = [
  'Gain: K/ω^q at low frequencies (q: the poles minus the zeros at the origin, K: the ratio of the lowest coefficients). At the break frequency ω_b = |s| of each pole or zero the slope changes by −20 dB/dec per real pole and +20 dB/dec per real zero, by ∓40 dB/dec per complex pair at ωn. The true gain differs by 3 dB at a real break and by −20 log10(2ζ) dB at a complex pair.',
  'Phase: −90°·q at low frequencies (+180° when K < 0). A real pole changes it by −90° and a real zero by +90°, along a straight line in log ω from ω_b/10 to 10ω_b (45° per decade); a complex pair by ∓180° from ωn·10^(−ζ) to ωn·10^ζ (a step at ωn when ζ = 0). Poles and zeros in the right half-plane change it with the opposite sign. The line is shifted by a multiple of 360° onto the plotted phase.',
  'Dead time: it does not change the gain, and its phase −ωL, which has no straight-line approximation, is added exactly.',
  'The button “Factors of the asymptotes” draws the straight line of each factor — K/s^q, each pole and zero (a complex pair as one), the dead time — in its own color: their sum, frequency by frequency, is the asymptote.',
];
