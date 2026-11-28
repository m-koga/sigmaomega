// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Settings panel: building it and its events ================= */
import { PLANT_FMT, T } from './02-i18n.ts';
import { lastOf, numStr, polyRoots, rootList } from './03-math.ts';
import { parsePoly } from './04-parser.ts';
import { CONTROLLERS, EXAMPLES, PARAMS, PLANTS, REFP, REF_TYPES, entriesOf, hardRange } from './10-definitions.ts';
import { S } from './11-state.ts';
import { $, errMessage, fmtVal, i18nText, must } from './40-dom.ts';
import { layout, saveLayout, subFolded } from './41-view.ts';
import { renderTeX, scheduleTeX } from './55-formulas.ts';
import { update } from './62-update.ts';

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
    const model = PLANTS[S.plant].model;
    // a physical model: what it is and its equations, above its parameters
    if (model) html += `<div class="hint plant-model">${T(model)}</div>`;
    const fig = PLANTS[S.plant].figure;
    if (fig)
      html += `<figure class="plant-fig">${fig.replace('role="img"', `role="img" aria-label="${T(PLANTS[S.plant].name)}"`)}</figure>`;
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
/** Set the plant to the transfer function numStr/denStr (from moving a pole or zero on the pole-zero map): the plant
 *  becomes "Enter transfer function", keeping its dead time, and its inputs show the new polynomials */
export function setPlantTF(numStr: string, denStr: string) {
  if (S.plant !== 'custom') {
    S.L_custom = PLANTS[S.plant].tf(S).L; // the dead time of the plant (0 for the plants without one)
    S.plant = 'custom';
    $('plant').value = 'custom';
  }
  S.cNumStr = numStr;
  S.cDenStr = denStr;
  S.cNum = parsePoly(numStr);
  S.cDen = parsePoly(denStr);
  if (document.getElementById('cNum')) {
    $('cNum').value = numStr;
    $('cDen').value = denStr;
    $('cErr').textContent = '';
    showRoots();
  } else buildPlant();
  scheduleTeX();
  update();
}
