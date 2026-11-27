// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Controller transfer function input ================= */
import { CTRL_FMT, T } from './02-i18n.ts';
import { parsePoly } from './04-parser.ts';
import { CONTROLLERS, CTRL, MODE_NAMES } from './10-definitions.ts';
import { S } from './11-state.ts';
import { $, errMessage, fmtVal } from './40-dom.ts';
import { renderTeX } from './55-formulas.ts';
import { update } from './62-update.ts';
import { rootsInfo, subsec } from './70-controls.ts';
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

// Shows the value of controller parameter k in its slider and number box (after it was set by the program)
export function showCtrlParam(k: NumKey) {
  const el = document.getElementById(`in-${k}`) as HTMLInputElement | null,
    nm = document.getElementById(`v-${k}`) as HTMLInputElement | null;
  if (!el || !nm) return; // its row is built with the controller inputs
  el.value = String(S[k]);
  nm.value = fmtVal(k, S[k], CTRL[k]);
}
