// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Estimation exercise card ================= */
import { T } from './02-i18n.ts';
import { numStr } from './03-math.ts';
import { parsePoly } from './04-parser.ts';
import { S } from './11-state.ts';
import {
  exerciseCheck,
  exercisePlant,
  fopdtStep,
  freqExCheck,
  freqExRange,
  freqExResponse,
  freqExercisePlant,
} from './26-exercises.ts';
import { $ } from './40-dom.ts';
import { COLORS, layout } from './41-view.ts';
import { plot } from './45-plot.ts';
import { renderTeX } from './55-formulas.ts';
import { update } from './62-update.ts';
import { buildPlant } from './70-controls.ts';
/* ---- Estimation exercise ---- */
// The estimates last checked (drawn over the true response) and whether the answer is shown
let exEst: [number, number, number] | null = null,
  exShown = false;
const exPlant = () => exercisePlant(S.ex.n),
  exFreq = () => freqExercisePlant(S.ex.n),
  exBode = () => S.ex.kind === 'bode';
// The step-response exercise as values in the order K, T, L
const stepVals = (p: { K: number; T: number; L: number }): [number, number, number] => [p.K, p.T, p.L],
  stepPlant = (v: [number, number, number]) => ({ K: v[0], T: v[1], L: v[2] });
/** Symbols and labels of the three values, the hint, the message for invalid values and the symbols of the answer, per plant */
const EX_TEXT = {
  step: {
    sym: ['K', 'T', 'L'],
    labels: ['Gain K', 'Time constant T [s]', 'Dead time L [s]'],
    hint: 'Estimate the gain K, the time constant T and the dead time L of a hidden plant P(s) = K e^(−Ls)/(Ts + 1) from its unit step response. Move the mouse over the plot to read t and y.',
    invalid: 'Enter K, T (> 0) and L (≥ 0).',
    answer: 'Answer: K = {a}, T = {b} s, L = {c} s',
  },
  lags: {
    sym: ['K', 'T1', 'T2'],
    labels: ['Gain K', 'Time constant T1 [s]', 'Time constant T2 [s]'],
    hint: 'Estimate the gain K and the time constants T1 and T2 of a hidden plant P(s) = K/((T1 s + 1)(T2 s + 1)) from its Bode plot (T1 and T2 in either order). Move the mouse over the plots to read ω, the gain and the phase.',
    invalid: 'Enter K, T1 and T2 (> 0).',
    answer: 'Answer: K = {a}, T1 = {b} s, T2 = {c} s',
  },
  dead: {
    sym: ['K', 'T', 'L'],
    labels: ['Gain K', 'Time constant T [s]', 'Dead time L [s]'],
    hint: 'Estimate the gain K, the time constant T and the dead time L of a hidden plant P(s) = K e^(−Ls)/(Ts + 1) from its Bode plot. Move the mouse over the plots to read ω, the gain and the phase.',
    invalid: 'Enter K, T (> 0) and L (≥ 0).',
    answer: 'Answer: K = {a}, T = {b} s, L = {c} s',
  },
  second: {
    sym: ['K', 'ωn', 'ζ'],
    labels: ['Gain K', 'Natural frequency ωn [rad/s]', 'Damping ratio ζ'],
    hint: 'Estimate the gain K, the natural frequency ωn and the damping ratio ζ of a hidden plant P(s) = K ωn²/(s² + 2ζωn s + ωn²) from its Bode plot. Move the mouse over the plots to read ω, the gain and the phase.',
    invalid: 'Enter K, ωn and ζ (> 0).',
    answer: 'Answer: K = {a}, ωn = {b} rad/s, ζ = {c}',
  },
} as const;
const exText = () => EX_TEXT[exBode() ? exFreq().kind : 'step'];
// The texts of the card for the current exercise
function exLabels() {
  const t = exText();
  $('exKind').value = S.ex.kind;
  $('exHint').textContent = T(t.hint);
  (['exKL', 'exTL', 'exLL'] as const).forEach((id, i) => ($(id).textContent = T(t.labels[i])));
  $('cvEx2').style.display = exBode() ? '' : 'none';
}
// The plot of the hidden plant (and of the estimates once checked), while its card is shown
export function drawExercise() {
  if (layout.scard !== 'ex') return;
  if (exBode()) {
    drawExerciseBode();
    return;
  }
  const p = exPlant(),
    tEnd = Math.ceil((p.L + 5 * p.T) / 2) * 2,
    ts = Array.from({ length: 401 }, (_, i) => (tEnd * i) / 400),
    est = exEst && stepPlant(exEst);
  plot($('cvEx'), {
    series: [
      { x: ts, y: ts.map(t => (t >= 0 ? 1 : 0)), color: COLORS.reference, width: 1.2, dash: [6, 4] },
      ...(est
        ? [
            {
              x: ts,
              y: ts.map(t => fopdtStep(est, t)),
              color: COLORS.input,
              width: 1.8,
              dash: [5, 3],
              name: T('Estimate'),
            },
          ]
        : []),
      {
        x: ts,
        y: ts.map(t => fopdtStep(p, t)),
        color: COLORS.output,
        width: 2.2,
        name: est ? T('Step response') : undefined,
      },
    ],
    xmin: 0,
    xmax: tEnd,
    ymin: Math.min(0, p.K) * 1.1,
    ymax: Math.max(1, p.K) * 1.1,
    xlabel: T('Time t [s]'),
    ylabel: 'y',
  });
}
// Vertical range of a curve with 8 % margin
function yRange(y: number[]) {
  const lo = Math.min(...y),
    hi = Math.max(...y),
    pad = Math.max(hi - lo, 1) * 0.08;
  return { ymin: lo - pad, ymax: hi + pad };
}
// The gain and the phase of the hidden plant (and of the estimates once checked)
function drawExerciseBode() {
  const p = exFreq(),
    [lo, hi] = freqExRange(p),
    W = Array.from({ length: 401 }, (_, i) => lo * (hi / lo) ** (i / 400)),
    R = W.map(w => freqExResponse(p, w)),
    E = exEst ? W.map(w => freqExResponse({ kind: p.kind, v: exEst as [number, number, number] }, w)) : null;
  (['db', 'ph'] as const).forEach(k => {
    plot(k === 'db' ? $('cvEx') : $('cvEx2'), {
      series: [
        ...(E
          ? [{ x: W, y: E.map(r => r[k]), color: COLORS.input, width: 1.8, dash: [5, 3], name: T('Estimate') }]
          : []),
        { x: W, y: R.map(r => r[k]), color: COLORS.output, width: 2.2, name: E ? T('Bode plot') : undefined },
      ],
      xmin: lo,
      xmax: hi,
      // the vertical range of the true response (an estimate far from it is cut off)
      ...yRange(R.map(r => r[k])),
      xlog: true,
      legend: 'bl',
      xlabel: T('Frequency ω [rad/s]'),
      ylabel: T(k === 'db' ? 'Gain [dB]' : 'Phase [deg]'),
      // phase ticks at multiples of 45° (90° or 180° for a wide range)
      yticks:
        k === 'ph'
          ? (a, b) => {
              const step = b - a > 720 ? 180 : b - a > 360 ? 90 : 45,
                t: number[] = [];
              for (let v = Math.ceil(a / step) * step; v <= b; v += step) t.push(v);
              return t;
            }
          : undefined,
    });
  });
}
// A new exercise: the estimates and the result cleared
function resetExercise() {
  exEst = null;
  exShown = false;
  $('exN').value = String(S.ex.n);
  (['exK', 'exT', 'exL'] as const).forEach(id => ($(id).value = ''));
  $('exOut').innerHTML = '';
  $('exRead').textContent = '';
  $('exUse').disabled = true;
  exLabels();
  drawExercise();
}
// The true values of the current exercise
const exTrue = (): [number, number, number] => (exBode() ? exFreq().v : stepVals(exPlant()));
// "Check": the estimates typed in, each against the true value (within 10 %)
function checkExercise() {
  const e: [number, number, number] = [
      parseFloat($('exK').value),
      parseFloat($('exT').value),
      parseFloat($('exL').value),
    ],
    deadTime = !exBode() || exFreq().kind === 'dead';
  if (!e.every(isFinite) || e[0] <= 0 || e[1] <= 0 || (deadTime ? e[2] < 0 : e[2] <= 0)) {
    $('exOut').innerHTML = `<span class="err">${T(exText().invalid)}</span>`;
    return;
  }
  const c = exBode() ? freqExCheck(exFreq(), e) : exerciseCheck(exPlant(), stepPlant(e)),
    ok = 'est' in c ? c.ok : [c.ok.K, c.ok.T, c.ok.L],
    err = 'est' in c ? c.err : [c.err.K, c.err.T, c.err.L],
    names = exText().sym,
    n = ok.filter(Boolean).length;
  exEst = 'est' in c ? c.est : e;
  $('exOut').innerHTML =
    names.map((nm, i) => `${nm}: ${ok[i] ? '✓' : '✗'} ${T('error {e} %', { e: numStr(100 * err[i]) })}`).join('<br>') +
    `<br><b>${n === 3 ? T('All three within 10 %: well done!') : T('{n} of 3 within 10 %.', { n })}</b>`;
  drawExercise();
}
// "Show the answer": the true values (the plant can then be used)
function showExerciseAnswer() {
  const [a, b, c] = exTrue();
  exShown = true;
  $('exUse').disabled = false;
  $('exOut').innerHTML =
    (exEst ? $('exOut').innerHTML + '<br>' : '') + T(exText().answer, { a: numStr(a), b: numStr(b), c: numStr(c) });
}
// "Use this plant": the true plant of the exercise becomes the plant of the simulator
function useExercisePlant() {
  const [a, b, c] = exTrue(),
    kind = exBode() ? exFreq().kind : 'dead';
  if (kind === 'lags') {
    S.plant = 'custom';
    S.cNumStr = numStr(a);
    S.cDenStr = `(${numStr(b)}s+1)(${numStr(c)}s+1)`;
    S.cNum = parsePoly(S.cNumStr);
    S.cDen = parsePoly(S.cDenStr);
    S.cUnstable = false;
    buildPlant();
    S.L = 0;
  } else if (kind === 'second') {
    S.plant = 'second';
    S.K = a;
    S.wn = b;
    S.zeta = c;
  } else {
    S.plant = 'dead';
    S.K = a;
    S.T = b;
    S.L = c;
  }
  buildPlant();
  renderTeX();
  update();
}
// The values under the mouse on the plot of the exercise
function readExercise(cv: HTMLCanvasElement, e: MouseEvent) {
  const t = cv._tf;
  if (!t) return;
  const f = (e.offsetX - t.m.l) / t.pw;
  if (f < 0 || f > 1) {
    $('exRead').textContent = '';
    return;
  }
  if (exBode()) {
    const w = t.xmin * (t.xmax / t.xmin) ** f,
      r = freqExResponse(exFreq(), w);
    $('exRead').textContent = `ω = ${numStr(w)} rad/s,  ${numStr(r.db)} dB,  ${numStr(r.ph)}°`;
  } else {
    const x = t.xmin + f * (t.xmax - t.xmin);
    $('exRead').textContent = `t = ${numStr(x)} s,  y = ${numStr(fopdtStep(exPlant(), x))}`;
  }
}
export function buildExercise() {
  $('exN').value = String(S.ex.n);
  $('exUse').disabled = !exShown;
  exLabels();
  $('exKind').onchange = () => {
    S.ex.kind = $('exKind').value === 'bode' ? 'bode' : 'step';
    resetExercise();
  };
  $('exN').onchange = () => {
    const v = Math.floor(parseFloat($('exN').value));
    if (isFinite(v) && v >= 1) S.ex.n = v;
    resetExercise();
  };
  $('exNew').onclick = () => {
    S.ex.n = 1 + Math.floor(Math.random() * 9999);
    resetExercise();
  };
  $('exCheck').onclick = checkExercise;
  $('exShow').onclick = showExerciseAnswer;
  $('exUse').onclick = useExercisePlant;
  (['cvEx', 'cvEx2'] as const).forEach(id => {
    const cv = $(id);
    cv.onmousemove = e => readExercise(cv, e);
    cv.onmouseleave = () => ($('exRead').textContent = '');
  });
}
