// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Building the settings panel and its events ================= */
import { CTRL_FMT, PLANT_FMT, T } from './02-i18n.ts';
import { lastOf, numStr, pScale, polyRoots, rootList } from './03-math.ts';
import { parsePoly } from './04-parser.ts';
import {
  CONTROLLERS,
  CTRL,
  DIST,
  EXAMPLES,
  INPUTS,
  MODE_NAMES,
  PARAMS,
  PLANTS,
  REFP,
  REF_TYPES,
  SAT,
  SPECS,
  SPEC_KEYS,
  TDOF,
  entriesOf,
  hardRange,
  paramDef,
} from './05-definitions.ts';
import { S, ghosts, isTFMode, lastSim, lastSweep, switchDefaults } from './06-state.ts';
import { resetLocus } from './09-loop.ts';
import {
  TUNE_METHODS,
  TUNE_TYPES,
  exerciseCheck,
  exercisePlant,
  freqExCheck,
  freqExercisePlant,
  freqExRange,
  freqExResponse,
  fopdtStep,
  tuneGains,
  tuneLabel,
} from './10-tuning.ts';
import { plot } from './15-drawing.ts';
import { parseSweep, sweepDefaults } from './12-sweep.ts';
import { $, byId, errMessage, fmtVal, i18nText, must } from './13-dom.ts';
import { COLORS, PLOT_VIEWS, layout, saveLayout, subFolded } from './14-view.ts';
import {
  lastComp,
  lastTune,
  renderComp,
  renderSpecs,
  renderTeX,
  renderTune,
  scheduleTeX,
  specRows,
} from './17-panels.ts';
import { redraw, update } from './18-update.ts';

export function slider(key: NumKey, def: ParamDef): string {
  return `<div class="row" id="row-${key}"><div class="top"><label for="in-${key}">${T(def.label)}</label><input type="number" class="num" id="v-${key}" step="any" value="${fmtVal(key, S[key], def)}" title="${T('Type a value and press Enter (values outside the slider range are allowed)')}"></div>
    <input type="range" id="in-${key}" min="${def.min}" max="${def.max}" step="${def.step}" value="${S[key]}"></div>`;
}
export function afterParam(k: NumKey) {
  update();
  if (k === 'L' && S.plant === 'custom') {
    scheduleTeX();
  }
}
export function bindSliders(defs: ParamDefs) {
  entriesOf(defs).forEach(([k, d]) => {
    const el = $(`in-${k}`),
      num = $(`v-${k}`);
    if (!el) return;
    el.addEventListener('input', () => {
      S[k] = parseFloat(el.value);
      num.value = fmtVal(k, S[k], d);
      num.classList.remove('clamped');
      afterParam(k);
    });
    const commit = () => {
      const v = parseFloat(num.value);
      if (!isFinite(v)) {
        num.value = fmtVal(k, S[k], d);
        return;
      }
      const [lo, hi] = hardRange(k),
        c = Math.min(hi, Math.max(lo, v));
      num.classList.toggle('clamped', c !== v);
      num.title =
        c !== v
          ? T('Allowed range is {lo} to {hi} (changed to {c})', { lo, hi, c })
          : T('Type a value and press Enter (values outside the slider range are allowed)');
      S[k] = c;
      el.value = String(c);
      num.value = String(+c.toPrecision(6));
      afterParam(k);
    };
    num.addEventListener('change', commit);
    num.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        num.blur();
      }
    }); // blur fires change, which commits the value
  });
}
export function subsec(key: string, label: string, inner: string): string {
  const f = subFolded(key);
  return `<div class="sub${f ? ' folded' : ''}" data-sub="${key}"><div class="sub-h" tabindex="0" role="button" aria-expanded="${f ? 'false' : 'true'}" title="${T('Click to show/hide')}">${T(label)}</div><div class="sub-b">${inner}</div></div>`;
}
export function toggleSub(el: Element) {
  const sub = must(el.closest<HTMLElement>('.sub'), '.sub'),
    key = sub.dataset.sub ?? '',
    on = !sub.classList.contains('folded');
  sub.classList.toggle('folded', on);
  el.setAttribute('aria-expanded', on ? 'false' : 'true');
  layout.subs[key] = on;
  saveLayout();
}
document.addEventListener('click', e => {
  const h = (e.target as Element).closest('.sub-h');
  if (h) toggleSub(h);
});
document.addEventListener('keydown', e => {
  const t = e.target as Element,
    h = t.closest && t.closest('.sub-h');
  if (h && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    toggleSub(h);
  }
});
export function buildRef() {
  const ty = REF_TYPES[S.refType];
  const defs: ParamDefs = { R: { ...REFP.R, label: T('Reference {x}', { x: T(ty.R) }) } };
  ty.p.forEach(k => (defs[k] = { ...REFP[k], label: k === 'rW' ? (ty.W ?? REFP[k].label) : REFP[k].label }));
  $('ref-params').innerHTML =
    `<label class="reflbl" for="refType">${T('Reference \\(r(t)\\) type')}</label>
    <select id="refType">${Object.entries(REF_TYPES)
      .map(([k, v]) => `<option value="${k}"${k === S.refType ? ' selected' : ''}>${T(v.name)}</option>`)
      .join('')}</select>
    <div class="reftex" id="tex-r"></div>` +
    entriesOf(defs)
      .map(([k, d]) => slider(k, d))
      .join('');
  bindSliders(defs);
  $('refType').onchange = () => {
    S.refType = $('refType').value;
    buildRef();
    renderTeX();
    update();
  };
}
export let prevPlant = 'first'; // plant shown before the current one (its parameters are kept when switching back)
export function setPrevPlant(p: string) {
  prevPlant = p;
}
// Menus of the kinds of plant and controller, from PLANTS and CONTROLLERS
export function buildMenus() {
  const fill = (sel: HTMLSelectElement, items: [string, string][]) =>
    items.forEach(([value, label]) => {
      const o = document.createElement('option');
      o.value = value;
      i18nText(o, label);
      sel.append(o);
    });
  fill(
    $('plant'),
    Object.entries(PLANTS).map(([k, v]) => [k, v.name]),
  );
  fill(
    $('mode'),
    Object.entries(CONTROLLERS).map(([k, v]) => [k, v.label]),
  );
  $('plant').value = S.plant;
  $('mode').value = S.mode;
}
export function buildPlant() {
  // Keep the dead time L separately for the "dead time + first-order lag" preset and the custom transfer function
  if (prevPlant === 'custom' && S.plant !== 'custom') {
    S.L_custom = S.L;
    S.L = PARAMS.L.val;
  }
  if (prevPlant !== 'custom' && S.plant === 'custom') {
    S.L = S.L_custom;
  }
  prevPlant = S.plant;
  const keys = PLANTS[S.plant].p;
  let html = '';
  if (S.plant === 'custom') {
    html += `<div class="tfin">
      <label class="lbl" for="cNum">${T('Numerator polynomial \\(N(s)\\)')}</label>
      <input type="text" id="cNum" spellcheck="false" autocomplete="off" value="${S.cNumStr.replace(/"/g, '&quot;')}">
      <label class="lbl" for="cDen">${T('Denominator polynomial \\(D(s)\\)')}</label>
      <input type="text" id="cDen" spellcheck="false" autocomplete="off" value="${S.cDenStr.replace(/"/g, '&quot;')}">
      <div class="err" id="cErr"></div>
      ${subsec('p-ex', 'Examples', `<div class="ex">${EXAMPLES.map((e, i) => `<button class="chip" data-ex="${i}">${T(e.label)}</button>`).join('')}</div>`)}
      ${subsec('p-info', 'Properties (poles, zeros, DC gain, stability)', '<div class="poles" id="cPoles"></div>')}
      ${subsec('p-fmt', 'Syntax', `<div class="hint">${T(PLANT_FMT)}</div>`)}
    </div>`;
    html += subsec('p-L', 'Dead time', slider('L', PARAMS.L));
  } else {
    html += keys.map(k => slider(k, PARAMS[k])).join('');
  }
  $('plant-params').innerHTML = html;
  bindSliders(Object.fromEntries(keys.map(k => [k, PARAMS[k]])));
  if (S.plant === 'custom') {
    let tmr: Timer | undefined;
    (['cNum', 'cDen'] as const).forEach(id => {
      $(id).addEventListener('input', () => {
        clearTimeout(tmr);
        tmr = setTimeout(applyCustom, 450);
      });
      $(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          clearTimeout(tmr);
          applyCustom();
        }
      });
      $(id).addEventListener('change', () => {
        clearTimeout(tmr);
        applyCustom();
      });
    });
    document.querySelectorAll<HTMLElement>('[data-ex]').forEach(
      b =>
        (b.onclick = () => {
          const ex = EXAMPLES[Number(b.dataset.ex)];
          $('cNum').value = ex.n;
          $('cDen').value = ex.d;
          applyCustom();
        }),
    );
    showRoots();
  }
}
export function applyCustom() {
  const ns = $('cNum').value,
    ds = $('cDen').value;
  let which = 'cNum';
  try {
    const num = parsePoly(ns);
    which = 'cDen';
    const den = parsePoly(ds);
    const nn = num.length - 1,
      dn = den.length - 1;
    if (den.length === 1 && den[0] === 0) throw new Error(T('The denominator is 0'));
    if (dn < 1) throw new Error(T('The denominator must be of degree 1 or higher'));
    if (dn > 10) throw new Error(T('The denominator degree must be 10 or less'));
    which = 'cNum';
    if (num.length === 1 && num[0] === 0) throw new Error(T('The numerator is 0'));
    if (nn >= dn)
      throw new Error(
        T(
          'The numerator degree ({n}) must be less than the denominator degree ({d}). Only strictly proper transfer functions are supported',
          { n: nn, d: dn },
        ),
      );
    S.cNumStr = ns;
    S.cDenStr = ds;
    S.cNum = num;
    S.cDen = den;
    $('cErr').textContent = '';
    $('cNum').classList.remove('bad');
    $('cDen').classList.remove('bad');
    showRoots();
    renderTeX();
    update();
  } catch (e) {
    $('cErr').textContent = (which === 'cNum' ? T('Numerator: ') : T('Denominator: ')) + errMessage(e);
    $('cNum').classList.toggle('bad', which === 'cNum');
    $('cDen').classList.toggle('bad', which === 'cDen');
  }
}
export function rootsInfo(num: Poly, den: Poly, who: string): { unstable: boolean; html: string } {
  const p = polyRoots(den),
    z = polyRoots(num);
  const tol = 1e-6;
  const unst = p.some(r => r[0] > tol),
    marg = p.some(r => Math.abs(r[0]) <= tol);
  const nint = p.filter(r => Math.hypot(r[0], r[1]) <= 1e-5).length;
  const zr = z.some(r => r[0] > tol);
  const verdict = unst
    ? `<b style="color:#c62828">${T('Unstable (pole in the right half-plane)')}</b>`
    : marg
      ? `<b style="color:#d9822b">${T('Marginally stable (pole on the imaginary axis)')}</b>`
      : `<b style="color:#2e7d32">${T('Stable')}</b>`;
  const dc = nint > 0 ? T('∞ ({n} integrator(s))', { n: nint }) : numStr(lastOf(num) / lastOf(den));
  return {
    unstable: unst,
    html: `<b>${T('Poles')}</b>${T(': ')}${rootList(p)}<br><b>${T('Zeros')}</b>${T(': ')}${rootList(z)}${zr ? T(' (<b>{x}</b>)', { x: T('Non-minimum phase') }) : ''}<br>
      <b>${T('DC gain')}</b>${T(': ')}${dc}<br>${T('{who} alone', { who: T(who) })}${T(': ')}${verdict}`,
  };
}
export function showRoots() {
  const r = rootsInfo(S.cNum, S.cDen, 'Plant');
  S.cUnstable = r.unstable;
  $('cPoles').innerHTML = r.html;
}

/* ---- Controller transfer function input ---- */
export const CTRL_EXAMPLES: { label: string; n: string; d: string }[] = [
  { label: 'PI', n: '2s + 1', d: 's' },
  { label: 'Lead', n: '2(s+1)', d: '0.1s + 1' },
  { label: 'Lag', n: '3(10s+1)', d: '100s + 1' },
  { label: 'Practical PID', n: '0.2s^2 + 2s + 1', d: 's(0.05s+1)' },
];
export function loadFromPID(mode: string, apply: boolean) {
  mode = mode || S.lastPid || 'PID';
  const v = (x: number) => (+x.toPrecision(6)).toString();
  // the transfer function of the controller as typed polynomials: a number, or coefficients in brackets
  const r = CONTROLLERS[mode].rational({ ...S, mode }),
    poly = (p: Poly) => (p.length === 1 ? v(p[0]) : `[${p.map(v).join(' ')}]`),
    n = poly(r.num),
    d = poly(r.den);
  if (apply) {
    $('ccNum').value = n;
    $('ccDen').value = d;
    applyCtrl();
  } else {
    try {
      S.ccNum = parsePoly(n);
      S.ccDen = parsePoly(d);
      S.ccNumStr = n;
      S.ccDenStr = d;
    } catch (e) {}
  }
}
export function buildCtrlCustom() {
  const box = $('ctrl-custom');
  if (S.mode !== 'custom') {
    box.innerHTML = '';
    return;
  }
  const q = (s: string) => s.replace(/"/g, '&quot;');
  box.innerHTML = `<div class="tfin">
    <label class="lbl" for="ccNum">${T('Numerator polynomial \\(N_c(s)\\)')}</label>
    <input type="text" id="ccNum" spellcheck="false" autocomplete="off" value="${q(S.ccNumStr)}">
    <label class="lbl" for="ccDen">${T('Denominator polynomial \\(D_c(s)\\)')}</label>
    <input type="text" id="ccDen" spellcheck="false" autocomplete="off" value="${q(S.ccDenStr)}">
    <div class="err" id="ccErr"></div>
    ${subsec(
      'c-ex',
      'Examples',
      `<div class="ex">${CTRL_EXAMPLES.map((e, i) => `<button class="chip" data-cex="${i}">${T(e.label)}</button>`).join('')}
      <button class="chip" id="ccFromPID">${T('Convert from {m} settings', { m: T(MODE_NAMES[S.lastPid || 'PID']) })}</button></div>`,
    )}
    ${subsec('c-info', 'Properties (poles, zeros, DC gain)', '<div class="poles" id="ccPoles"></div>')}
    ${subsec('c-fmt', 'Syntax', `<div class="hint">${T(CTRL_FMT)}</div>`)}
  </div>`;
  let tmr: Timer | undefined;
  (['ccNum', 'ccDen'] as const).forEach(id => {
    $(id).addEventListener('input', () => {
      clearTimeout(tmr);
      tmr = setTimeout(applyCtrl, 450);
    });
    $(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        clearTimeout(tmr);
        applyCtrl();
      }
    });
    $(id).addEventListener('change', () => {
      clearTimeout(tmr);
      applyCtrl();
    });
  });
  document.querySelectorAll<HTMLElement>('[data-cex]').forEach(
    b =>
      (b.onclick = () => {
        const ex = CTRL_EXAMPLES[Number(b.dataset.cex)];
        $('ccNum').value = ex.n;
        $('ccDen').value = ex.d;
        applyCtrl();
      }),
  );
  $('ccFromPID').onclick = () => loadFromPID(S.lastPid ?? 'PID', true);
  showCtrlRoots();
}
export function showCtrlRoots() {
  const r = rootsInfo(S.ccNum, S.ccDen, 'Controller');
  S.ccUnstable = r.unstable;
  $('ccPoles').innerHTML = r.html;
}
export function applyCtrl() {
  const ns = $('ccNum').value,
    ds = $('ccDen').value;
  let which = 'ccNum';
  try {
    const num = parsePoly(ns);
    which = 'ccDen';
    const den = parsePoly(ds);
    if (den.length === 1 && den[0] === 0) throw new Error(T('The denominator is 0'));
    if (den.length - 1 > 10) throw new Error(T('The denominator degree must be 10 or less'));
    which = 'ccNum';
    if (num.length === 1 && num[0] === 0) throw new Error(T('The numerator is 0'));
    if (num.length > den.length)
      throw new Error(
        T(
          'The numerator degree ({n}) must not exceed the denominator degree ({d}). Add a filter to derivative terms (e.g. 0.2s/(0.05s+1))',
          { n: num.length - 1, d: den.length - 1 },
        ),
      );
    S.ccNumStr = ns;
    S.ccDenStr = ds;
    S.ccNum = num;
    S.ccDen = den;
    S.ccTouched = true;
    $('ccErr').textContent = '';
    $('ccNum').classList.remove('bad');
    $('ccDen').classList.remove('bad');
    showCtrlRoots();
    renderTeX();
    update();
  } catch (e) {
    $('ccErr').textContent = (which === 'ccNum' ? T('Numerator: ') : T('Denominator: ')) + errMessage(e);
    $('ccNum').classList.toggle('bad', which === 'ccNum');
    $('ccDen').classList.toggle('bad', which === 'ccDen');
  }
}
export function buildStatic() {
  $('ctrl-params').innerHTML = entriesOf(CTRL)
    .map(([k, d]) => slider(k, d))
    .join('');
  bindSliders(CTRL);
  buildTune();
  buildComp();
  buildExercise();
  buildRef();
  $('input-params').innerHTML = entriesOf(INPUTS)
    .map(([k, d]) => slider(k, d))
    .join('');
  bindSliders(INPUTS);
  $('tdof-params').innerHTML = entriesOf(TDOF)
    .map(([k, d]) => slider(k, d))
    .join('');
  bindSliders(TDOF);
  $('dist-params').innerHTML = entriesOf(DIST)
    .map(([k, d]) => slider(k, d))
    .join('');
  bindSliders(DIST);
  $('sat-params').innerHTML = entriesOf(SAT)
    .map(([k, d]) => slider(k, d))
    .join('');
  bindSliders(SAT);
  const ts = $('Tsim'),
    tn = $('TsimNum');
  const showT = () => {
    ts.value = String(Math.log10(S.Tsim));
    tn.value = String(+S.Tsim.toPrecision(4));
  };
  showT();
  const resetTimeViews = () => {
    ['cvY', 'cvU'].forEach(id => {
      if (PLOT_VIEWS[id]) delete PLOT_VIEWS[id].x;
    });
  };
  ts.oninput = () => {
    S.Tsim = +Math.pow(10, parseFloat(ts.value)).toPrecision(3);
    tn.value = String(S.Tsim);
    resetTimeViews();
    update();
  };
  const commitT = () => {
    const v = parseFloat(tn.value);
    if (isFinite(v) && v > 0) {
      S.Tsim = Math.min(10000, Math.max(0.01, v));
    }
    showT();
    resetTimeViews();
    update();
  };
  tn.onchange = commitT;
  tn.onkeydown = e => {
    if (e.key === 'Enter') commitT();
  };
}

// Show the settings as they are in S: selections, check boxes, which inputs apply, the block diagram
// Shows the value of controller parameter k in its slider and number box (after it was set by the program)
export function showCtrlParam(k: NumKey) {
  const el = document.getElementById(`in-${k}`) as HTMLInputElement | null,
    nm = document.getElementById(`v-${k}`) as HTMLInputElement | null;
  if (!el || !nm) return; // its row is built with the controller inputs
  el.value = String(S[k]);
  nm.value = fmtVal(k, S[k], CTRL[k]);
}

export function buildSpecs() {
  specRows();
  SPEC_KEYS.forEach(k => {
    const cb = byId<HTMLInputElement>(`spec-${k}-on`),
      inp = byId<HTMLInputElement>(`spec-${k}`);
    cb.checked = S.spec[k].on;
    inp.value = String(S.spec[k].v);
    cb.onchange = () => {
      S.spec[k].on = cb.checked;
      afterSpec();
    };
    inp.onchange = () => {
      const v = parseFloat(inp.value);
      if (isFinite(v) && v >= SPECS[k].low) S.spec[k].v = v;
      inp.value = String(S.spec[k].v);
      afterSpec();
    };
    inp.onkeydown = e => {
      if (e.key === 'Enter') inp.blur();
    };
  });
  $('spec-show').checked = S.spec.show;
  $('spec-show').onchange = () => {
    S.spec.show = $('spec-show').checked;
    afterSpec();
  };
}
export function afterSpec() {
  resetLocus();
  renderSpecs();
  redraw();
}
export function buildTune() {
  const opt = (v: string, l: string, cur: string) =>
    `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`;
  const inner = `<div class="tune-grid">
      <label for="tuneMethod">${T('Method')}</label><select id="tuneMethod">${TUNE_METHODS.map(m => opt(m, tuneLabel(m), S.tune.method)).join('')}</select>
      <label for="tuneType">${T('Controller type')}</label><select id="tuneType">${TUNE_TYPES.map(m => opt(m, T(m + ' control'), S.tune.type)).join('')}</select>
      <label for="tuneLam" id="tuneLamL">${T('IMC filter time constant λ')}</label><input type="number" id="tuneLam" step="any" min="0" placeholder="${T('auto')}" value="${S.tune.lam ?? ''}">
    </div>
    <div class="poles" id="tuneOut"></div>
    <button class="chip" id="tuneApply">${T('Apply to the controller')}</button>
    <div class="hint">${T('The model is identified from the step or frequency response of P(s) alone, so the closed-loop response can differ from what the rule aims for. The derivative filter N keeps its current value.')}</div>`;
  $('ctrl-tune').innerHTML = inner;
  $('tuneMethod').onchange = () => {
    S.tune.method = $('tuneMethod').value;
    renderTune();
  };
  $('tuneType').onchange = () => {
    S.tune.type = $('tuneType').value;
    renderTune();
  };
  $('tuneLam').onchange = () => {
    const v = parseFloat($('tuneLam').value);
    S.tune.lam = isFinite(v) && v > 0 ? v : null;
    $('tuneLam').value = String(S.tune.lam ?? '');
    renderTune();
  };
  $('tuneLam').onkeydown = e => {
    if (e.key === 'Enter') $('tuneLam').blur();
  };
  $('tuneApply').onclick = applyTune;
}
export function applyTune() {
  const r = lastTune;
  if (!r || r.err !== undefined) return;
  const g = tuneGains(r),
    type = S.tune.type;
  S.mode = type;
  S.lastPid = type;
  S.Kp = +g.Kp.toPrecision(4);
  if (type !== 'P') S.Ki = +g.Ki.toPrecision(4);
  if (type === 'PID') S.Kd = +g.Kd.toPrecision(4);
  (['Kp', 'Ki', 'Kd'] as NumKey[]).forEach(showCtrlParam);
  buildCtrlCustom();
  renderTeX();
  update();
}
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
  $('exCheck').onclick = () => {
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
      names
        .map((nm, i) => `${nm}: ${ok[i] ? '✓' : '✗'} ${T('error {e} %', { e: numStr(100 * err[i]) })}`)
        .join('<br>') +
      `<br><b>${n === 3 ? T('All three within 10 %: well done!') : T('{n} of 3 within 10 %.', { n })}</b>`;
    drawExercise();
  };
  $('exShow').onclick = () => {
    const [a, b, c] = exTrue();
    exShown = true;
    $('exUse').disabled = false;
    $('exOut').innerHTML =
      (exEst ? $('exOut').innerHTML + '<br>' : '') + T(exText().answer, { a: numStr(a), b: numStr(b), c: numStr(c) });
  };
  $('exUse').onclick = () => {
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
  };
  // the values under the mouse
  const read = (cv: HTMLCanvasElement) => (e: MouseEvent) => {
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
  };
  (['cvEx', 'cvEx2'] as const).forEach(id => {
    const cv = $(id);
    cv.onmousemove = read(cv);
    cv.onmouseleave = () => ($('exRead').textContent = '');
  });
}
// The card of the lead and lag compensator design: kind, target phase margin, gain Kc and allowance θ
export function buildComp() {
  const c = S.comp;
  byId('comp-card').innerHTML = `<div class="tune-grid">
      <label for="compMethod">${T('Compensator')}</label><select id="compMethod">${(
        [
          ['lead', 'Lead compensator'],
          ['lag', 'Lag compensator'],
          ['leadlag', 'Lead-lag compensator'],
        ] as const
      )
        .map(([m, l]) => `<option value="${m}"${m === c.method ? ' selected' : ''}>${T(l)}</option>`)
        .join('')}</select>
      <label for="compPm">${T('Target phase margin PM* [°]')}</label><input type="number" id="compPm" step="any" min="1" value="${c.pm}">
      <label for="compKc">${T('Gain K_c (for the steady-state error)').replace('K_c', 'K<sub>c</sub>')}</label><input type="number" id="compKc" step="any" min="0" value="${c.kc}">
      <label for="compTheta">${T('Allowance θ [°]')}</label><input type="number" id="compTheta" step="any" min="0" value="${c.theta}">
      <label for="compWc" id="compWcL">${T('New crossover ωc [rad/s]')}</label><input type="number" id="compWc" step="any" min="0" placeholder="${T('auto (phase crossover)')}" value="${c.wc ?? ''}">
    </div>
    <div class="poles" id="compOut"></div>
    <button class="chip" id="compApply">${T('Apply to the controller')}</button>
    <div class="hint">${T('Designed from the frequency response of K_c P(s) by the classical steps. Lead: C(s) = K_c (T₁s + 1)/(αT₁s + 1); lag: C(s) = K_c (T₂s + 1)/(βT₂s + 1); lead-lag: the product of the two; all keep the DC gain K_c. θ makes up for what the steps leave out (the shift of the crossover for a lead, the phase lag of the lag at the new crossover).').replace(/K_c/g, 'K<sub>c</sub>')}</div>`;
  // the new crossover is asked only for the lead-lag design
  const showWc = () =>
    (['compWc', 'compWcL'] as const).forEach(id => ($(id).style.display = c.method === 'leadlag' ? '' : 'none'));
  showWc();
  byId<HTMLSelectElement>('compMethod').onchange = e => {
    c.method = (e.target as HTMLSelectElement).value;
    showWc();
    renderComp();
  };
  $('compWc').onchange = () => {
    const v = parseFloat($('compWc').value);
    c.wc = isFinite(v) && v > 0 ? v : null;
    $('compWc').value = String(c.wc ?? '');
    renderComp();
  };
  $('compWc').onkeydown = e => {
    if (e.key === 'Enter') $('compWc').blur();
  };
  (
    [
      ['compPm', 'pm', 1],
      ['compKc', 'kc', 1e-9],
      ['compTheta', 'theta', 0],
    ] as const
  ).forEach(([id, k, lo]) => {
    const inp = byId<HTMLInputElement>(id);
    inp.onchange = () => {
      const v = parseFloat(inp.value);
      if (isFinite(v) && v >= lo) c[k] = v;
      inp.value = String(c[k]);
      renderComp();
    };
    inp.onkeydown = e => {
      if (e.key === 'Enter') inp.blur();
    };
  });
  byId('compApply').onclick = applyComp;
}
// Sets the designed compensator as the controller
export function applyComp() {
  const d = lastComp;
  if (!d || d.err !== undefined) return;
  const prev = S.mode;
  if (prev !== 'custom' && !isTFMode(S)) S.lastPid = prev;
  S.Kc = +S.comp.kc.toPrecision(4);
  if (S.comp.method !== 'lag') {
    S.mode = S.comp.method;
    S.T1 = +d.T1!.toPrecision(4);
    S.alpha = +d.alpha!.toPrecision(4);
  }
  if (S.comp.method === 'leadlag') {
    S.T2 = +d.T2!.toPrecision(4);
    S.beta = +d.beta!.toPrecision(4);
  } else if (S.comp.method === 'lag') {
    S.mode = 'lag';
    S.T2 = +d.T2!.toPrecision(4);
    S.beta = +d.beta!.toPrecision(4);
  }
  (['Kc', 'T1', 'alpha', 'T2', 'beta'] as NumKey[]).forEach(showCtrlParam);
  buildCtrlCustom();
  renderTeX();
  update();
}
export function applySweepValue(v: number) {
  const p = S.sweep.p,
    d = paramDef(p);
  S[p] = v;
  const el = $(`in-${p}`),
    nm = $(`v-${p}`);
  if (el) {
    el.value = String(v);
    nm.value = fmtVal(p, v, d);
  }
  if (PLANTS[S.plant].p.includes(p)) renderTeX();
  update();
}
export function buildSweep() {
  // a row of the table applies its value
  $('sw-table').onclick = e => {
    const tr = e.target instanceof Element ? e.target.closest<HTMLElement>('tbody tr') : null,
      r = tr ? lastSweep?.[Number(tr.dataset.i)] : undefined;
    if (r) applySweepValue(r.v);
  };
  $('sw-on').onchange = () => {
    S.sweep.on = $('sw-on').checked;
    update();
  };
  $('sw-p').onchange = () => {
    S.sweep.p = $('sw-p').value as NumKey;
    S.sweep.vals = sweepDefaults(S.sweep.p);
    update();
  };
  $('sw-v').onchange = () => {
    const v = parseSweep($('sw-v').value, S.sweep.p);
    if (v.length) S.sweep.vals = v;
    $('sw-v').value = S.sweep.vals.map(x => numStr(x)).join(', ');
    update();
  };
  $('sw-v').onkeydown = e => {
    if (e.key === 'Enter') $('sw-v').blur();
  };
  $('sw-def').onclick = () => {
    S.sweep.vals = sweepDefaults(S.sweep.p);
    if (!S.sweep.on) S.sweep.on = true;
    update();
  };
}
// Multiply the controller gain by k
export function applyLoopGain(k: number) {
  const gain = CONTROLLERS[S.mode].gain;
  if (gain.length) gain.forEach(p => (S[p] = +(S[p] * k).toPrecision(6)));
  else {
    S.ccNum = pScale(S.ccNum, k).map(v => +v.toPrecision(6));
    S.ccNumStr = '[' + S.ccNum.join(' ') + ']';
    S.ccTouched = true;
    buildCtrlCustom();
  }
  (['Kp', 'Ki', 'Kd', 'Kc'] as NumKey[]).forEach(p => {
    const el = $(`in-${p}`),
      nm = $(`v-${p}`);
    if (el) {
      el.value = String(S[p]);
      nm.value = fmtVal(p, S[p], CTRL[p]);
    }
  });
  update();
}
$('plant').onchange = () => {
  S.plant = $('plant').value;
  buildPlant();
  renderTeX();
  update();
};
$('mode').onchange = () => {
  const prev = S.mode;
  S.mode = $('mode').value;
  switchDefaults(prev, S.mode).forEach(showCtrlParam);
  if (prev !== 'custom') S.lastPid = prev;
  if (S.mode === 'custom' && prev !== 'custom' && !S.ccTouched) loadFromPID(prev, false);
  buildCtrlCustom();
  renderTeX();
  update();
};
(['dOnMeas', 'dOn', 'sat', 'aw', 'tdof'] as const).forEach(
  id =>
    ($(id).onchange = () => {
      S[id] = $(id).checked;
      update();
    }),
);
$('hold').onclick = () => {
  if (!lastSim) return;
  if (ghosts.length >= 4) ghosts.shift();
  ghosts.push({ T: lastSim.T.slice(), Y: lastSim.Y.slice() });
  ghostText();
  update();
};
$('clearHold').onclick = () => {
  ghosts.length = 0;
  ghostText();
  update();
};
export function ghostText() {
  $('ghostInfo').textContent = ghosts.length
    ? T('Holding {n} (gray lines)', { n: ghosts.length })
    : T('Held responses are overlaid as gray lines (up to 4).');
}
