// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Scenarios (save and load) ================= */
import { APP_VERSION } from './01-changelog.ts';
import { T } from './02-i18n.ts';
import { parsePoly } from './04-parser.ts';
import { CARD_GROUP, MODE_PARAMS, PLANTS, REF_TYPES, hardRange, sideCardOf } from './05-definitions.ts';
import { S, defaults, ghosts } from './06-state.ts';
import { SWEEP_MAX } from './12-sweep.ts';
import { $, copyText, saveFile } from './13-dom.ts';
import {
  PLOT_VIEWS,
  defaultLayout,
  infoTabs,
  layout,
  normRows,
  normTiles,
  saveLayout,
  setLayout,
  storedPanels,
  withoutTex,
} from './14-view.ts';
import { bodeDescDefault } from './15-drawing.ts';
import { resetPZView } from './16-pole-zero.ts';
import { renderTeX, resetSweepUI } from './17-panels.ts';
import { update } from './18-update.ts';
import { buildCtrlCustom, buildPlant, buildSpecs, buildStatic, ghostText, setPrevPlant } from './19-controls.ts';
import { applyLayout } from './24-layout.ts';

export const SC_KEY = 'ctrlsim-scenarios-v1',
  SC_MAX = 50;
export const SC_DERIVED: string[] = ['cNum', 'cDen', 'ccNum', 'ccDen', 'cUnstable', 'ccUnstable'];
// Keys of S that a scenario holds (everything set by defaults(), plus a few states of the controller input)
export const SC_KEYS = (() => {
  const k = (Object.keys(S) as (keyof State)[]).filter(x => !SC_DERIVED.includes(x));
  (['ccTouched', 'lastPid'] as (keyof State)[]).forEach(x => {
    if (!k.includes(x)) k.push(x);
  });
  return k;
})();
// Built-in examples (exercises): settings that differ from the defaults
export const SC_EXAMPLES: { name: string; note: string; S: Record<string, unknown> }[] = [
  {
    name: 'Exercise: PID control of a third-order plant',
    note: 'Tune the PID gains so that the overshoot is at most 12% and the settling time is at most 10 s, keeping a phase margin of at least 45°. Compare your result with the tuning rules.',
    S: {
      plant: 'third',
      K: 1,
      T: 1,
      mode: 'PID',
      Kp: 1,
      Ki: 0.3,
      Kd: 0.5,
      Tsim: 30,
      spec: { os: { on: true, v: 12 } },
    },
  },
  {
    name: 'Exercise: PI control of a plant with dead time',
    note: 'Design a PI controller with a phase margin of at least 60° and a peak sensitivity Ms of at most 1.6. Use the parameter sweep to see how the margins change with K_P.',
    S: {
      plant: 'dead',
      K: 1,
      T: 2,
      L: 1,
      mode: 'PI',
      Kp: 0.5,
      Ki: 0.2,
      Tsim: 40,
      spec: {
        os: { on: false, v: 10 },
        ts: { on: false, v: 10 },
        pm: { on: true, v: 60 },
        gm: { on: true, v: 6 },
        ms: { on: true, v: 1.6 },
      },
    },
  },
  {
    name: 'Exercise: set-point weighting (2-DOF PID)',
    note: 'The PID gains are tuned for disturbance rejection (CHR), so the response to the set-point overshoots. Lower the set-point weights b and c to reduce the overshoot, and check that the response to the disturbance (after t = 15 s) does not change.',
    S: {
      plant: 'dead',
      K: 1,
      T: 1,
      L: 0.5,
      mode: 'PID',
      Kp: 1.9,
      Ki: 1.583,
      Kd: 0.399,
      Tsim: 30,
      dOn: true,
      d: 0.5,
      td: 15,
      tdof: true,
      bw: 1,
      cw: 1,
      spec: { os: { on: true, v: 10 }, ts: { on: false, v: 10 } },
    },
  },
  {
    name: 'Exercise: stabilizing an unstable plant',
    note: 'With P control the closed loop is unstable for small gains. Use the root locus to find the range of K_P that stabilizes it, then add integral action to remove the steady-state error.',
    S: {
      plant: 'unstable',
      K: 1,
      T: 1,
      mode: 'P',
      Kp: 0.5,
      Tsim: 10,
      spec: {
        os: { on: false, v: 10 },
        ts: { on: false, v: 10 },
        pm: { on: false, v: 45 },
        gm: { on: false, v: 6 },
        zeta: { on: true, v: 0.5 },
      },
    },
  },
];
// Snapshot of the current settings
export function scenarioData(name: string, note: string, withLayout?: boolean): Scenario {
  const s: Record<string, unknown> = {},
    dflt: Record<string, unknown> = { ccTouched: false, lastPid: 'PID' };
  SC_KEYS.forEach(k => {
    const v = S[k] !== undefined ? S[k] : dflt[k];
    if (v !== undefined) s[k] = JSON.parse(JSON.stringify(v));
  });
  const d: Scenario = {
    app: 'ctrlsim',
    format: 1,
    version: APP_VERSION,
    name: String(name || ''),
    note: String(note || ''),
    S: s as Partial<State>,
  };
  if (withLayout) {
    d.layout = JSON.parse(JSON.stringify(layout));
    d.view = viewOptions();
  }
  return d;
}
// Merge src into dst, accepting only known keys with the same type (numbers must be finite; arrays of numbers).
// src is untrusted data (a file, a link, text), so both sides are handled as plain objects here.
export function scMerge(dst: Record<string, any>, src: any) {
  if (!src || typeof src !== 'object') return;
  Object.keys(dst).forEach(k => {
    if (!(k in src)) return;
    const d = dst[k],
      v = src[k];
    if (Array.isArray(d)) {
      if (Array.isArray(v)) {
        const a = v.map(Number).filter(isFinite);
        if (a.length) dst[k] = a.slice(0, SWEEP_MAX);
      }
    } else if (d !== null && typeof d === 'object') {
      scMerge(d, v);
    } else if (typeof d === 'number') {
      const x = Number(v);
      if (v !== null && v !== '' && isFinite(x)) {
        const [lo, hi] = hardRange(k, 1e9);
        dst[k] = Math.min(hi, Math.max(lo, x));
      }
    } else if (d === null) {
      if (v === null || (typeof v === 'number' && isFinite(v))) dst[k] = v;
    } else if (typeof d === typeof v) dst[k] = v;
  });
}
// Apply a scenario: start from the defaults, merge the stored settings, rebuild the inputs
export function applyScenario(data: Scenario, opts: { layout?: boolean } = {}) {
  if (!data || typeof data !== 'object' || !data.S) throw new Error('format');
  defaults();
  S.ccTouched = false;
  S.lastPid = 'PID';
  scMerge(S, data.S);
  if (!PLANTS[S.plant]) S.plant = 'first';
  if (!(S.mode in MODE_PARAMS)) S.mode = 'PID';
  if (!REF_TYPES[S.refType]) S.refType = 'step';
  if (!['lead', 'lag', 'leadlag'].includes(S.comp.method)) S.comp.method = 'lead';
  S.ex.n = Math.max(1, Math.floor(S.ex.n));
  if (S.ex.kind !== 'bode') S.ex.kind = 'step';
  try {
    S.cNum = parsePoly(S.cNumStr);
    S.cDen = parsePoly(S.cDenStr);
  } catch (e) {
    S.cNumStr = '1';
    S.cDenStr = 's+1';
    S.cNum = [1];
    S.cDen = [1, 1];
  }
  try {
    S.ccNum = parsePoly(S.ccNumStr);
    S.ccDen = parsePoly(S.ccDenStr);
  } catch (e) {
    S.ccNumStr = '1';
    S.ccDenStr = '1';
    S.ccNum = [1];
    S.ccDen = [1];
  }
  setPrevPlant(S.plant);
  ghosts.length = 0;
  PLOT_VIEWS_RESET();
  buildPlant();
  buildCtrlCustom();
  buildSpecs();
  buildStatic();
  resetSweepUI();
  ghostText();
  if (opts.layout && data.layout) applyScenarioLayout(data);
  showTask(data.name, data.note);
  renderTeX();
  update();
}
// Curves and options of the plots (check boxes) that are saved with the layout
export const VIEW_CHECKS = [
  'bodeL',
  'bodeP',
  'bodeC',
  'bodeS',
  'bodeT',
  'bodeD',
  'bodeR',
  'bodeA',
  'bodeAc',
  'timePlant',
  'timePlantOnly',
  'loopL',
  'loopS',
  'loopT',
  'loopR',
  'loopD',
  'polesP',
  'polesC',
  'polesL',
  'polesS',
  'polesT',
  'polesR',
  'polesD',
  'nyqMs',
  'nyqCount',
  'pzPlant',
  'pzCtrl',
  'pzCL',
  'pzLocus',
  'pzRules',
  'pzGrid',
] as const;
export function viewOptions(): Record<string, boolean> {
  const o: Record<string, boolean> = {};
  VIEW_CHECKS.forEach(id => {
    const el = $(id);
    if (el) o[id] = !!el.checked;
  });
  return o;
}
// Layout stored in a scenario: only known keys with valid values are taken
export function scLayout(src: any): Layout {
  const L: Layout = defaultLayout();
  if (!src || typeof src !== 'object') return L;
  const num = (v: unknown, lo: number, hi: number): number | null =>
    typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : null;
  const nums = (o: any, lo: number, hi: number) => {
    const r: Record<string, number> = {};
    if (o && typeof o === 'object')
      Object.keys(o).forEach(k => {
        const v = num(o[k], lo, hi);
        if (v !== null) r[k] = v;
      });
    return r;
  };
  const bools = (o: any) => {
    const r: Record<string, boolean> = {};
    if (o && typeof o === 'object')
      Object.keys(o).forEach(k => {
        if (typeof o[k] === 'boolean') r[k] = o[k];
      });
    return r;
  };
  L.sideW = num(src.sideW, 150, 2000);
  L.texFs = num(src.texFs, 4, 80);
  L.loopFs = num(src.loopFs, 4, 80);
  L.ms = num(src.ms, 0.3, 5);
  L.msb = num(src.msb, 0.3, 5);
  L.ts = num(src.ts, 0.3, 5);
  L.h = nums(src.h, 0, 5000);
  L.zs = nums(src.zs, 0.3, 5);
  L.hidden = withoutTex(bools(src.hidden));
  L.subs = bools(src.subs);
  L.panels = storedPanels(src.panels, src.pv, src.hidden);
  if (['1', '2', 'row', 'free', 'rows'].includes(src.pcols)) L.pcols = src.pcols;
  L.tiles = normTiles(src.tiles);
  L.rows = normRows(src.rows);
  L.scard = sideCardOf(src.scard, src.stab);
  L.stab = CARD_GROUP[L.scard];
  L.sideCollapsed = src.sideCollapsed === true;
  if (src.mview === 'table') L.mview = 'table';
  L.itabs = infoTabs(src.itabs, src.ttab);
  return L;
}
export function applyScenarioLayout(d: Scenario) {
  const mtab = layout.mtab;
  setLayout(scLayout(d.layout));
  layout.mtab = mtab;
  saveLayout();
  applyLayout(); // the phone view stays as it is
  const view = d.view;
  if (view && typeof view === 'object')
    VIEW_CHECKS.forEach(id => {
      const el = $(id),
        v = view[id];
      if (el && typeof v === 'boolean') el.checked = v;
    });
  if (typeof bodeDescDefault === 'function') bodeDescDefault();
}
export function PLOT_VIEWS_RESET() {
  Object.keys(PLOT_VIEWS).forEach(k => delete PLOT_VIEWS[k]);
  resetPZView();
}
export function showTask(name: string | undefined, note: string | undefined) {
  const on = !!(note && String(note).trim());
  $('taskBanner').classList.toggle('on', on);
  $('taskName').textContent = name || '';
  $('taskNote').textContent = note || '';
}
// Text form: JSON (readable, can be edited by hand)
export const scenarioText = (d: Scenario) => JSON.stringify(d);
export function parseScenarioText(t: string): Scenario {
  t = String(t).trim();
  const m = t.match(/[#&?]s=([A-Za-z0-9_\-]+)/);
  if (m) return JSON.parse(b64urlDecode(m[1]));
  return JSON.parse(t);
}
export function b64urlEncode(s: string): string {
  const b = new TextEncoder().encode(s);
  let bin = '';
  b.forEach(x => (bin += String.fromCharCode(x)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64urlDecode(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}
export function scenarioLink(d: Scenario): string {
  return location.href.split('#')[0] + '#s=' + b64urlEncode(scenarioText(d));
}
export function scLoadAll(): Scenario[] {
  try {
    const a = JSON.parse(localStorage.getItem(SC_KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}
export function scSaveAll(a: Scenario[]): boolean {
  try {
    localStorage.setItem(SC_KEY, JSON.stringify(a));
    return true;
  } catch (e) {
    return false;
  }
}
export let scMsgTimer: Timer | undefined;
export function scMsg(text: string, err?: boolean) {
  const m = $('sc-msg');
  m.textContent = text;
  m.classList.toggle('err', !!err);
  clearTimeout(scMsgTimer);
  scMsgTimer = setTimeout(() => {
    m.textContent = '';
  }, 6000);
}
export const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"]/g,
    c => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }) as Record<string, string>)[c],
  );
export function renderScenarios() {
  const list = scLoadAll();
  let html = '';
  html += `<div class="sc-group">${T('Saved in this browser')}</div>`;
  html += list.length
    ? list
        .map(
          (
            d,
            i,
          ) => `<div class="sc-item"><span class="nm" title="${esc(d.note || '')}">${esc(d.name || T('(no name)'))}</span>${d.layout ? `<span class="sc-tag" title="${T('Includes the layout')}">▣</span>` : ''}<span class="dt">${esc((d.saved || '').slice(0, 10))}</span>
      <button class="chip" data-sc-load="${i}">${T('Load')}</button><button class="chip" data-sc-del="${i}" title="${T('Delete')}">×</button></div>`,
        )
        .join('')
    : `<div class="sc-item"><span class="nm" style="color:var(--muted)">${T('None yet')}</span></div>`;
  html += `<div class="sc-group">${T('Examples')}</div>`;
  html += SC_EXAMPLES.map(
    (e, i) =>
      `<div class="sc-item"><span class="nm" title="${esc(T(e.note))}">${esc(T(e.name))}</span><button class="chip" data-sc-ex="${i}">${T('Load')}</button></div>`,
  ).join('');
  $('sc-list').innerHTML = html;
  $('sc-list')
    .querySelectorAll<HTMLElement>('[data-sc-load]')
    .forEach(
      b =>
        (b.onclick = () => {
          const d = scLoadAll()[Number(b.dataset.scLoad)];
          if (d) {
            applyScenario(d, { layout: scUseLayout() });
            fillScenarioForm(d);
            scMsg(T('Loaded "{n}"', { n: d.name || '' }));
          }
        }),
    );
  // Delete with two clicks (the first click asks for confirmation; dialogs may be blocked in embedded pages)
  $('sc-list')
    .querySelectorAll<HTMLElement>('[data-sc-del]')
    .forEach(
      b =>
        (b.onclick = () => {
          if (!b.dataset.armed) {
            b.dataset.armed = '1';
            b.textContent = T('Delete?');
            b.classList.add('arm');
            setTimeout(() => {
              if (b.isConnected) {
                delete b.dataset.armed;
                b.textContent = '×';
                b.classList.remove('arm');
              }
            }, 3000);
            return;
          }
          const a = scLoadAll();
          a.splice(Number(b.dataset.scDel), 1);
          scSaveAll(a);
          renderScenarios();
        }),
    );
  $('sc-list')
    .querySelectorAll<HTMLElement>('[data-sc-ex]')
    .forEach(
      b =>
        (b.onclick = () => {
          const e = SC_EXAMPLES[Number(b.dataset.scEx)],
            d = { name: T(e.name), note: T(e.note), S: JSON.parse(JSON.stringify(e.S)) };
          applyScenario(d, { layout: scUseLayout() });
          fillScenarioForm(d);
          scMsg(T('Loaded "{n}"', { n: d.name }));
        }),
    );
}
export const scUseLayout = () => {
  const el = $('sc-useLayout');
  return !el || el.checked;
};
export function fillScenarioForm(d: Scenario) {
  $('sc-name').value = d.name || '';
  $('sc-note').value = d.note || '';
}
export function buildScenarios() {
  const cur = () => scenarioData($('sc-name').value.trim(), $('sc-note').value.trim(), $('sc-withLayout').checked);
  $('sc-save').onclick = () => {
    const d = cur();
    if (!d.name) {
      scMsg(T('Enter a name'), true);
      $('sc-name').focus();
      return;
    }
    d.saved = new Date().toISOString();
    const a = scLoadAll().filter(x => x.name !== d.name);
    a.unshift(d);
    scMsg(
      scSaveAll(a.slice(0, SC_MAX))
        ? T('Saved "{n}"', { n: d.name })
        : T('Could not save (browser storage is not available)'),
      false,
    );
    renderScenarios();
  };
  $('sc-copy').onclick = async () => {
    const t = scenarioText(cur());
    const ok = await copyText(t);
    if (!ok) {
      $('sc-text').value = t;
      $('sc-text').select();
    }
    scMsg(ok ? T('Copied to the clipboard') : T('Copy the selected text below'), !ok);
  };
  $('sc-link').onclick = async () => {
    const t = scenarioLink(cur());
    const ok = await copyText(t);
    if (!ok) {
      $('sc-text').value = t;
      $('sc-text').select();
    }
    scMsg(
      ok
        ? T(
            'Link copied. The link opens this page with the scenario where the page is served directly (for example GitHub Pages).',
          )
        : T('Copy the selected text below'),
      !ok,
    );
  };
  $('sc-load').onclick = () => {
    try {
      const d = parseScenarioText($('sc-text').value);
      applyScenario(d, { layout: scUseLayout() });
      fillScenarioForm(d);
      scMsg(T('Loaded "{n}"', { n: d.name || '' }));
    } catch (e) {
      scMsg(T('Could not read the scenario. Paste the whole text copied with "Copy as text".'), true);
    }
  };
  $('sc-export').onclick = async () => {
    const d = cur();
    d.saved = new Date().toISOString();
    const r = await exportScenarioFile(d);
    if (r === 'saved') scMsg(T('Saved as "{f}" (usually in the Downloads folder)', { f: scFileName(d.name) }));
    else if (r === 'declined') scMsg('');
    else {
      $('sc-text').value = JSON.stringify(d, null, 2);
      $('sc-text').select();
      scMsg(T('This page cannot save files. Copy the selected text below and save it as a .json file.'), true);
    }
  };
  $('sc-import').onclick = () => {
    $('sc-file').value = '';
    $('sc-file').click();
  };
  $('sc-file').onchange = () => {
    const f = $('sc-file').files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const r = importScenarioFile(String(rd.result));
        scMsg(
          r.count !== undefined
            ? T('Added {n} scenario(s) from the file', { n: r.count })
            : T('Loaded "{n}"', { n: r.name ?? '' }),
        );
      } catch (err) {
        scMsg(T('Could not read the file. Choose a .json file saved with "Save to a file".'), true);
      }
    };
    rd.onerror = () => scMsg(T('Could not read the file. Choose a .json file saved with "Save to a file".'), true);
    rd.readAsText(f);
  };
  $('taskClose').onclick = () => $('taskBanner').classList.remove('on');
  renderScenarios();
}
// File name from the scenario name (characters not allowed in file names are replaced)
export function scFileName(name: string | undefined): string {
  const b = String(name || '')
    .trim()
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_')
    .slice(0, 80);
  return (b || 'scenario') + '.json';
}
export async function exportScenarioFile(d: Scenario) {
  return saveFile(scFileName(d.name), JSON.stringify(d, null, 2), 'application/json');
}
// A file holds one scenario, or a list of scenarios (these are added to the list in this browser)
export function importScenarioFile(text: string): { count?: number; name?: string } {
  const d = JSON.parse(String(text).replace(/^﻿/, ''));
  if (Array.isArray(d)) {
    const ok: Scenario[] = d.filter(x => x && typeof x === 'object' && x.S);
    if (!ok.length) throw new Error('format');
    const a = scLoadAll().filter(x => !ok.some(y => y.name === x.name));
    ok.forEach(x => {
      if (!x.saved) x.saved = new Date().toISOString();
    });
    scSaveAll(ok.concat(a).slice(0, SC_MAX));
    renderScenarios();
    return { count: ok.length };
  }
  applyScenario(d, { layout: scUseLayout() });
  fillScenarioForm(d);
  return { name: d.name || '' };
}
// A scenario in the URL (#s=...) is loaded at startup
export function loadScenarioFromURL() {
  const m = location.hash.match(/[#&]s=([A-Za-z0-9_\-]+)/);
  if (!m) return;
  try {
    const d = JSON.parse(b64urlDecode(m[1]));
    applyScenario(d, { layout: scUseLayout() });
    fillScenarioForm(d);
  } catch (e) {}
}
$('reset').onclick = () => {
  showTask('', '');
  defaults();
  S.ccTouched = false;
  setPrevPlant('first');
  buildPlant();
  buildCtrlCustom();
  buildSpecs();
  buildStatic();
  resetSweepUI();
  renderTeX();
  update();
};
