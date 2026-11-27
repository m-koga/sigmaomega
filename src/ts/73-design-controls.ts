// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Design controls: specifications, tuning rule, compensator design, parameter sweep, loop gain and comparison ================= */
import { T } from './02-i18n.ts';
import { numStr, pScale } from './03-math.ts';
import { CONTROLLERS, CTRL, PLANTS, SPECS, SPEC_KEYS, paramDef } from './10-definitions.ts';
import { S, ghosts, isTFMode, lastSim, lastSweep, switchDefaults } from './11-state.ts';
import { resetLocus } from './23-loop-analysis.ts';
import { TUNE_METHODS, TUNE_TYPES, tuneGains, tuneLabel } from './24-tuning.ts';
import { COMP_METHODS, isCompMethod } from './25-compensator.ts';
import type { CompDesign, CompMethod } from './25-compensator.ts';
import { parseSweep, sweepDefaults } from './28-sweep.ts';
import { $, byId, fmtVal } from './40-dom.ts';
import { renderTeX } from './55-formulas.ts';
import { lastComp, lastTune, renderComp, renderSpecs, renderTune, specRows } from './60-design-cards.ts';
import { redraw, update } from './62-update.ts';
import { buildPlant } from './70-controls.ts';
import { buildCtrlCustom, loadFromPID, showCtrlParam } from './71-controller-input.ts';
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
// The card of the lead and lag compensator design: kind, target phase margin, gain Kc and allowance θ
export function buildComp() {
  const c = S.comp;
  byId('comp-card').innerHTML = `<div class="tune-grid">
      <label for="compMethod">${T('Compensator')}</label><select id="compMethod">${(
        Object.keys(COMP_METHODS) as CompMethod[]
      )
        .map(m => `<option value="${m}"${m === c.method ? ' selected' : ''}>${T(COMP_METHODS[m].label)}</option>`)
        .join('')}</select>
      <label for="compPm">${T('Target phase margin PM* [°]')}</label><input type="number" id="compPm" step="any" min="1" value="${c.pm}">
      <label for="compKc">${T('Gain K_c (for the steady-state error)').replace('K_c', 'K<sub>c</sub>')}</label><input type="number" id="compKc" step="any" min="0" value="${c.kc}">
      <label for="compTheta">${T('Allowance θ [°]')}</label><input type="number" id="compTheta" step="any" min="0" value="${c.theta}">
      <label for="compWc" id="compWcL">${T('New crossover ωc [rad/s]')}</label><input type="number" id="compWc" step="any" min="0" placeholder="${T('auto (phase crossover)')}" value="${c.wc ?? ''}">
    </div>
    <div class="poles" id="compOut"></div>
    <button class="chip" id="compApply">${T('Apply to the controller')}</button>
    <div class="hint">${T('Designed from the frequency response of K_c P(s) by the classical steps. Lead: C(s) = K_c (T₁s + 1)/(αT₁s + 1); lag: C(s) = K_c (T₂s + 1)/(βT₂s + 1); lead-lag: the product of the two; all keep the DC gain K_c. θ makes up for what the steps leave out (the shift of the crossover for a lead, the phase lag of the lag at the new crossover).').replace(/K_c/g, 'K<sub>c</sub>')}</div>`;
  // the new crossover is asked only for the kinds that take it (the lead-lag design)
  const showWc = () =>
    (['compWc', 'compWcL'] as const).forEach(
      id => ($(id).style.display = isCompMethod(c.method) && COMP_METHODS[c.method].askWc ? '' : 'none'),
    );
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
  const m = S.comp.method;
  if (!isCompMethod(m)) return;
  // the controller of the same name, with the parameters the design gives
  S.Kc = +S.comp.kc.toPrecision(4);
  S.mode = m;
  for (const p of COMP_METHODS[m].params) S[p] = +(d[p as keyof CompDesign] as number).toPrecision(4);
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
