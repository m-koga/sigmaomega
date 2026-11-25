// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= UI construction ================= */
// Element by id. Only ids of the page are accepted, and the element has its type (an <input> is an
// HTMLInputElement, a <canvas> an HTMLCanvasElement, ...): see src/ts/element-ids.d.ts, generated from the HTML.
import { CTRL_FMT, LANG, PLANT_FMT, T, i18nText } from './02-i18n.ts';
import {
  COMP_MODES,
  CONTROLLERS,
  CTRL,
  DIST,
  EXAMPLES,
  INPUTS,
  MODE_NAMES,
  MODE_PARAMS,
  PARAMS,
  PID_MODES,
  PLANTS,
  REFP,
  REF_TYPES,
  SAT,
  TDOF,
  ctrlRational,
  entriesOf,
  hardRange,
  hasTerm,
} from './03-definitions.ts';
import { cT, lastOf, nT, numStr, parsePoly, polyRoots, rootList } from './04-parser.ts';
import { S } from './05-state.ts';
import { spWeights } from './08-frequency.ts';
import { buildTune } from './13-tuning.ts';
import { PLOT_VIEWS } from './15-zoom.ts';
import { update } from './16-pole-zero.ts';
import { layout, saveLayout } from './17-events-layout.ts';
import { fitTex } from './18-tiles.ts';

export function $<K extends keyof ElementById>(id: K): ElementById[K] {
  return document.getElementById(id) as ElementById[K];
}
// Element by an id known only when the page runs (from a data attribute or an object key)
export function byId<E extends HTMLElement = HTMLElement>(id: string): E {
  return document.getElementById(id) as E;
}
// A value that is always there (an element of the page, a 2D context, ...): a missing one is a bug, reported clearly
export function must<T>(x: T | null | undefined, what: string): T {
  if (x === null || x === undefined) throw new Error(`missing: ${what}`);
  return x;
}
// Message and code of a caught error (anything can be thrown, so its type is unknown)
export const errMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));
export const errCode = (e: unknown): unknown =>
  typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined;
// An element that is always in the page, by CSS selector (root: where to look)
export function qs<E extends Element = HTMLElement>(sel: string, root: ParentNode = document): E {
  return must(root.querySelector<E>(sel), sel);
}
export const ctx2d = (cv: HTMLCanvasElement) => must(cv.getContext('2d'), '2D context of a canvas');
export function fmt(v: number, step: number): string {
  const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return Number(v).toFixed(dec);
}
export function slider(key: NumKey, def: ParamDef): string {
  return `<div class="row" id="row-${key}"><div class="top"><label for="in-${key}">${T(def.label)}</label><input type="number" class="num" id="v-${key}" step="any" value="${fmtVal(key, S[key], def)}" title="${T('Type a value and press Enter (values outside the slider range are allowed)')}"></div>
    <input type="range" id="in-${key}" min="${def.min}" max="${def.max}" step="${def.step}" value="${S[key]}"></div>`;
}
export const TIME_KEYS: string[] = ['td', 'rT0', 'rPer', 'rW'];
export function fmtVal(k: string, v: number, d: ParamDef): string {
  return TIME_KEYS.includes(k) || v < d.min || v > d.max || Math.abs(v / d.step - Math.round(v / d.step)) > 1e-6
    ? String(+(+v).toPrecision(6))
    : String(fmt(v, d.step));
}
export function afterParam(k: NumKey) {
  update();
  if (k === 'L' && S.plant === 'custom') {
    clearTimeout(texTimer);
    texTimer = setTimeout(renderTeX, 250);
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
// Subsections of the input forms (examples, properties, syntax, dead time): click the heading to show/hide (hidden by default)
export const subFolded = (key: string) => !(layout.subs && layout.subs[key] === false);
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
// Label around a check box (shown, hidden or greyed out with it)
export const labelOf = (id: 'dOnMeas' | 'tdof' | 'aw') => must($(id).parentElement, `label of ${id}`);

// Show the settings as they are in S: selections, check boxes, which inputs apply, the block diagram
// Shows the value of controller parameter k in its slider and number box (after it was set by the program)
export function showCtrlParam(k: NumKey) {
  const el = document.getElementById(`in-${k}`) as HTMLInputElement | null,
    nm = document.getElementById(`v-${k}`) as HTMLInputElement | null;
  if (!el || !nm) return; // its row is built with the controller inputs
  el.value = String(S[k]);
  nm.value = fmtVal(k, S[k], CTRL[k]);
}
export function syncControls() {
  $('plant').value = S.plant;
  $('mode').value = S.mode;
  $('dOnMeas').checked = S.dOnMeas;
  $('dOn').checked = S.dOn;
  $('sat').checked = S.sat;
  $('aw').checked = S.aw;
  $('tdof').checked = S.tdof;
  syncControllerRows();
  const info = $('ctrl-info'),
    html = compensatorInfo();
  info.innerHTML = html;
  info.style.display = html ? '' : 'none';
  $('dist-params').classList.toggle('disabled', !S.dOn);
  $('sat-params').classList.toggle('disabled', !S.sat);
  labelOf('aw').classList.toggle('disabled', !S.sat || !hasTerm(S, 'I'));
  syncBlockDiagram();
  syncTimeSliders();
}

// Controller inputs of the selected kind: PID-type modes show all four gains (unused ones greyed out),
// derivative on y only and 2-DOF only for PID-type modes; no inputs for a transfer function
export function syncControllerRows() {
  const m = S.mode,
    isPID = PID_MODES.includes(m),
    shown = isPID ? ['Kp', 'Ki', 'Kd', 'N'] : MODE_PARAMS[m];
  $('ctrl-params').style.display = MODE_PARAMS[m].length ? '' : 'none';
  (Object.keys(CTRL) as NumKey[]).forEach(k => {
    const row = $(`row-${k}`);
    if (!row) return;
    row.style.display = shown.includes(k) ? '' : 'none';
    row.classList.toggle('disabled', isPID && !MODE_PARAMS[m].includes(k));
  });
  labelOf('dOnMeas').style.display = isPID ? '' : 'none';
  labelOf('dOnMeas').classList.toggle('disabled', !hasTerm(S, 'D'));
  labelOf('tdof').style.display = isPID ? '' : 'none';
  $('tdof-params').style.display = isPID && S.tdof ? '' : 'none';
  $('row-bw').classList.toggle('disabled', !hasTerm(S, 'P'));
  $('row-cw').classList.toggle('disabled', !hasTerm(S, 'D') || S.dOnMeas);
}

// Characteristics of a lead/lag compensator: maximum phase lead/lag and where, gain at low and high
// frequencies (empty for other controllers)
export function compensatorInfo(): string {
  const m = S.mode;
  if (!COMP_MODES.includes(m)) return '';
  const deg = (x: number) => (x * 180) / Math.PI,
    out: string[] = [];
  if (MODE_PARAMS[m].includes('alpha')) {
    const a = S.alpha;
    out.push(
      T('<b>Phase lead</b>: max {a}° (ω = {w} rad/s)', {
        a: numStr(deg(Math.asin((1 - a) / (1 + a)))),
        w: numStr(1 / (S.T1 * Math.sqrt(a))),
      }),
    );
  }
  if (MODE_PARAMS[m].includes('beta')) {
    const b = S.beta;
    out.push(
      T('<b>Phase lag</b>: max {a}° (ω = {w} rad/s)', {
        a: numStr(deg(Math.asin((b - 1) / (b + 1)))),
        w: numStr(1 / (S.T2 * Math.sqrt(b))),
      }),
    );
  }
  const r = ctrlRational(),
    g0 = lastOf(r.num) / lastOf(r.den),
    ginf = (r.num[0] / r.den[0]) * (r.num.length === r.den.length ? 1 : 0);
  const db = (g: number) => numStr(20 * Math.log10(Math.abs(g)));
  out.push(
    T('<b>Gain</b>: low frequency {g0} ({d0} dB), high frequency {g1} ({d1} dB)', {
      g0: numStr(g0),
      d0: db(g0),
      g1: numStr(ginf),
      d1: db(ginf),
    }),
  );
  return out.join('<br>');
}

/* ---- Block diagram ----
   Drawn from what is used: the saturation, the disturbance d and the noise n (each with its block or summing
   point) only when they are applied, so the diagram gets shorter without them. Top row, left to right:
   r -> [Cr(s) ->] summing point -> [C(s) ->] u -> [saturation] -> [d] -> P(s) -> y; the feedback path runs below,
   through [n] and, in the 2-DOF form u = Cr(s) r − C(s) y (2-DOF PID and PI-D), through C(s). */
export interface DiagramParts {
  sat: boolean;
  d: boolean;
  n: boolean;
  /** 2-DOF form */
  two: boolean;
}
const DIAG_H = 165, // height of the drawing (the scale is kept when its width changes)
  DIAG_W_FULL = 680; // width with every part (the width of the area it is drawn for)
export function diagramParts(st: State = S): DiagramParts {
  return {
    sat: st.sat,
    d: st.dOn,
    n: st.noise > 0,
    two: PID_MODES.includes(st.mode) && (st.tdof || (st.dOnMeas && hasTerm(st, 'D'))),
  };
}
// The drawing for the parts: its SVG and width
export function diagramSVG(p: DiagramParts): { svg: string; w: number } {
  const L: string[] = [], // lines
    X: string[] = [], // text
    line = (x1: number, y1: number, x2: number, y2: number, arrow = true, part = '') =>
      L.push(
        `<line${part ? ` data-part="${part}"` : ''} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${arrow ? ' marker-end="url(#ar)"' : ''}/>`,
      ),
    poly = (pts: number[], arrow: boolean) =>
      L.push(`<polyline points="${pts.join(',')}"${arrow ? ' marker-end="url(#ar)"' : ''}/>`),
    rect = (x: number, y: number, w: number, h: number, part = '') =>
      L.push(`<rect${part ? ` data-part="${part}"` : ''} x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>`),
    circle = (cx: number, cy: number, r: number, part = '') =>
      L.push(`<circle${part ? ` data-part="${part}"` : ''} cx="${cx}" cy="${cy}" r="${r}"/>`),
    text = (x: number, y: number, t: string, attrs = '') => X.push(`<text x="${x}" y="${y}"${attrs}>${t}</text>`),
    it = ' font-style="italic"',
    mid = ' text-anchor="middle"',
    Y = 60, // top row
    FB = 135; // feedback path
  // reference to the control input u (the same in both forms up to x = 283)
  text(18, 50, 'r', it);
  if (p.two) {
    line(20, Y, 58, Y);
    rect(60, 38, 96, 44);
    text(108, 66, 'C<tspan font-size="11" dy="4">r</tspan><tspan dy="-4">(s)</tspan>', mid + it);
    text(108, 26, '', ' text-anchor="middle" font-size="11" fill="#c62828" font-weight="700" id="lbl-2dof"');
    line(156, Y, 190, Y);
    circle(203, Y, 13);
    text(184, 52, '+', ' font-size="12"');
    text(208, 88, '−', ' font-size="14"');
    text(250, 52, 'u', it);
  } else {
    line(20, Y, 72, Y);
    circle(85, Y, 13);
    text(66, 52, '+', ' font-size="12"');
    text(90, 88, '−', ' font-size="14"');
    line(98, Y, 138, Y);
    text(112, 52, 'e', it);
    rect(140, 38, 100, 44);
    text(190, 66, 'C(s)', mid + it);
    text(258, 52, 'u', it);
  }
  // the top row after u: each part starts 44 (block) or 46 (summing point) after the previous one ends
  let out = p.two ? 216 : 240,
    next = 285; // left edge of the first part after u
  if (p.sat) {
    line(out, Y, next - 2, Y);
    rect(next, 38, 64, 44, 'sat');
    L.push(
      `<polyline data-part="sat" points="${next + 10},72 ${next + 22},72 ${next + 42},48 ${next + 54},48" stroke-width="1.4"/>`,
    );
    text(next + 32, 31, T('Saturation'), ' text-anchor="middle" font-size="11" fill="#666b75" data-part="sat"');
    out = next + 64;
    next = out + 46;
  }
  if (p.d) {
    const cx = next + 13;
    line(out, Y, next, Y);
    line(cx, 12, cx, 45, true, 'd');
    circle(cx, Y, 13, 'd');
    text(cx + 7, 14, 'd', it + ' data-part="d"');
    out = cx + 13;
    next = out + 44;
  } else if (p.sat) next = out + 44;
  line(out, Y, next - 2, Y);
  const pl = next, // the plant
    po = pl + 100,
    br = po + 35; // branch point of the feedback
  rect(pl, 38, 100, 44);
  text(pl + 50, 66, 'P(s)', mid + it);
  text(pl + 50, 97, '', ' text-anchor="middle" font-size="11" fill="#666b75" id="lbl-Pnote"');
  line(po, Y, po + 80, Y);
  text(po + 88, 65, 'y', it);
  const fbEnd = p.two ? 342 : 85; // where the feedback path ends on the left (the right edge of C(s), or e)
  // the feedback path: from the branch point down and to the left, through the noise
  let from = br;
  poly([br, Y, br, FB], false);
  if (p.n) {
    const cx = Math.max(pl - 47, p.two ? 384 : 140);
    line(br, FB, cx + 12, FB, false);
    circle(cx, FB, 12, 'n');
    line(cx, 162, cx, 149, true, 'n');
    text(cx + 8, 162, 'n', it + ' data-part="n"');
    from = cx - 12;
  }
  if (p.two) {
    line(from, FB, fbEnd, FB);
    rect(244, 115, 96, 40);
    text(292, 140, 'C(s)', mid + it);
    poly([244, FB, 203, FB, 203, 75], true);
  } else poly([from, FB, 85, FB, 85, 75], true);
  const w = po + 115;
  return {
    w,
    svg:
      `<svg viewBox="0 0 ${w} ${DIAG_H}" xmlns="http://www.w3.org/2000/svg" font-family="Noto Sans JP, sans-serif">` +
      '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0,0 L10,5 L0,10 z" fill="#1b1d22"/></marker></defs>' +
      `<g stroke="#1b1d22" stroke-width="1.6" fill="none">${L.join('')}</g>` +
      `<circle cx="${br}" cy="${Y}" r="3" fill="#1b1d22"/>` +
      `<g font-size="15" fill="#1b1d22">${X.join('')}</g></svg>`,
  };
}
let diagKey = '';
// Draws the block diagram again when its parts or the language changed, then its labels
export function syncBlockDiagram() {
  const p = diagramParts(),
    key = JSON.stringify(p) + LANG,
    box = $('diagBox');
  if (key !== diagKey) {
    diagKey = key;
    const d = diagramSVG(p);
    box.innerHTML = d.svg;
    // the same scale whatever the width: a shorter drawing takes less of the area
    box.style.setProperty('--dgw', String(d.w / DIAG_W_FULL));
    window.diagViewReset?.(); // a new drawing is shown whole
  }
  box.classList.toggle('two', p.two);
  if (p.two) {
    const w = spWeights();
    byId('lbl-2dof').textContent = S.tdof
      ? T('2-DOF PID (b = {b}, c = {c})', { b: numStr(w.b), c: numStr(w.c) })
      : T('PI-D (derivative on y only)');
  }
  byId('lbl-Pnote').textContent = PLANTS[S.plant].tf(S).L > 0 ? T('(with dead time)') : '';
}

// Time and period sliders: range and step follow the simulation time (fraction lo … hi of it)
export function syncTimeSliders() {
  const sliders: [NumKey, number, number][] = [
    ['td', 0, 1],
    ['rT0', 0, 1],
    ['rPer', 0.002, 1],
    ['rW', 0.002, 1],
  ];
  sliders.forEach(([k, lo, hi]) => {
    const el = $(`in-${k}`);
    if (!el) return;
    el.min = String(lo * S.Tsim);
    el.max = String(hi * S.Tsim);
    el.step = String(S.Tsim / 1000);
    el.value = String(S[k]);
    if (document.activeElement !== $(`v-${k}`)) $(`v-${k}`).value = String(+(+S[k]).toPrecision(6));
  });
}
export let texTimer: Timer | undefined;
/* ---- Formulas of P(s) and C(s) with the numbers substituted ----
   Shown one below the other at the left, each a formula of its own; their left-hand sides are given the same width
   (that of the widest, C_r(s) with a 2-DOF PID, otherwise C(s)), so that the equals signs line up */
// The controller acts on the reference and the output differently: a second formula C_r(s)
function twoDofShown(): boolean {
  return !CONTROLLERS[S.mode].texNum && (S.tdof || (S.dOnMeas && hasTerm(S, 'D')));
}
// Left-hand side `name` as wide as the widest one
export function texLhs(name: string): string {
  return `\\rlap{${name}}\\hphantom{${twoDofShown() ? 'C_r(s)' : 'C(s)'}}`;
}
export function plantTeX(): string {
  return `${texLhs('P(s)')}=${PLANTS[S.plant].texNum(S)}`;
}
// The formulas of the controller: C(s), and C_r(s) with a 2-DOF PID
export function ctrlTeXLines(): string[] {
  const ctl = CONTROLLERS[S.mode];
  if (ctl.texNum) return [`${texLhs('C(s)')}=${ctl.texNum(S)}`]; // numbers only
  const terms = [];
  if (hasTerm(S, 'P') && S.Kp !== 0) terms.push(nT(S.Kp));
  if (hasTerm(S, 'I') && S.Ki !== 0) terms.push(`\\dfrac{${nT(S.Ki)}}{s}`);
  if (hasTerm(S, 'D') && S.Kd !== 0) terms.push(`\\dfrac{${cT(S.Kd)}s}{s/${nT(S.N)}+1}`);
  const num = terms.length ? terms.join('+') : '0';
  const base = `${texLhs('C(s)')}=${num}`; // numbers only
  if (!twoDofShown()) return [base];
  // 2-DOF PID: the controller acting on the reference, Cr(s) = KP b + KI/s + KD c s/(s/N+1) (u = Cr(s) r − C(s) y)
  const { b, c } = spWeights(),
    rt = [];
  if (hasTerm(S, 'P') && S.Kp * b !== 0) rt.push(nT(+(S.Kp * b).toPrecision(6)));
  if (hasTerm(S, 'I') && S.Ki !== 0) rt.push(`\\dfrac{${nT(S.Ki)}}{s}`);
  if (hasTerm(S, 'D') && S.Kd * c !== 0) rt.push(`\\dfrac{${cT(+(S.Kd * c).toPrecision(6))}s}{s/${nT(S.N)}+1}`);
  return [base, `${texLhs('C_r(s)')}=${rt.length ? rt.join('+') : '0'}`];
}
export function ctrlTeX(): string {
  return ctrlTeXLines().join('\n');
}
// Each formula as display math (one block each)
const displayTeX = (lines: string[]) => lines.map(l => '\\[' + l + '\\]').join('');
// When numbers change, redraw only the formulas (replace after conversion to avoid flicker)
export let fmTimer: Timer | undefined;
export function scheduleFormulas() {
  clearTimeout(fmTimer);
  fmTimer = setTimeout(renderFormulas, 100);
}
export function renderFormulas() {
  const jobs: [HTMLElement, string[]][] = [
    [$('tex-P'), [plantTeX()]],
    [$('tex-C'), ctrlTeXLines()],
  ];
  if (window.MathJax && MathJax.tex2svgPromise) {
    jobs.forEach(([el, lines]) => {
      const tex = lines.join('\n');
      if (el.dataset.tex === tex) return;
      Promise.all(lines.map(l => MathJax.tex2svgPromise(l, { display: true })))
        .then((nodes: Node[]) => {
          el.replaceChildren(...nodes);
          el.dataset.tex = tex;
          fitTex(); // a longer formula may need a smaller size to fit the width
        })
        .catch(() => {});
    });
  }
}
// Formulas of P(s) and C(s) (MathJax); also called by MathJax when it has loaded (src/index.html)
export function renderTeX() {
  $('tex-P').innerHTML = '\\[' + plantTeX() + '\\]';
  $('tex-C').innerHTML = displayTeX(ctrlTeXLines());
  if ($('tex-r')) $('tex-r').innerHTML = '\\(' + REF_TYPES[S.refType].tex + '\\)';
  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetClear && MathJax.typesetClear();
    MathJax.typesetPromise([document.body])
      .then(() => {
        $('tex-P').dataset.tex = plantTeX();
        $('tex-C').dataset.tex = ctrlTeX();
        fitTex(); // a longer formula may need a smaller size to fit the width
      })
      .catch(() => {});
  }
}
window.renderTeX = renderTeX;
