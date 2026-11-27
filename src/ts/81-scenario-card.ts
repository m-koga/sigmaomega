// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Scenarios card: the list, saving and loading, files and links ================= */
import { T } from './02-i18n.ts';
import { S, defaults } from './11-state.ts';
import { $, copyText, saveFile } from './40-dom.ts';
import { renderTeX } from './55-formulas.ts';
import { resetSweepUI } from './61-sweep-panel.ts';
import { update } from './62-update.ts';
import { buildPlant, setPrevPlant } from './70-controls.ts';
import { buildCtrlCustom } from './71-controller-input.ts';
import { buildSpecs } from './73-design-controls.ts';
import { buildStatic } from './74-settings-panel.ts';
import {
  SC_EXAMPLES,
  SC_MAX,
  applyScenario,
  b64urlDecode,
  parseScenarioText,
  scLoadAll,
  scSaveAll,
  scenarioData,
  scenarioLink,
  scenarioText,
  showTask,
} from './80-scenarios.ts';
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
// The scenario of the current settings, with the name, note and layout choice of the form
const scCurrent = () => scenarioData($('sc-name').value.trim(), $('sc-note').value.trim(), $('sc-withLayout').checked);
// "Save in this browser": first in the list, replacing one of the same name
function scSaveHere() {
  const d = scCurrent();
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
}
// Copy t to the clipboard; where that is not allowed, show it selected under the buttons to copy by hand
async function scCopyOrSelect(t: string): Promise<boolean> {
  const ok = await copyText(t);
  if (!ok) {
    $('sc-text').value = t;
    $('sc-text').select();
  }
  return ok;
}
// "Load from text": the scenario pasted in the text box
function scLoadText() {
  try {
    const d = parseScenarioText($('sc-text').value);
    applyScenario(d, { layout: scUseLayout() });
    fillScenarioForm(d);
    scMsg(T('Loaded "{n}"', { n: d.name || '' }));
  } catch (e) {
    scMsg(T('Could not read the scenario. Paste the whole text copied with "Copy as text".'), true);
  }
}
// "Save to a file": a .json file, or its text selected where the page cannot save files
async function scExport() {
  const d = scCurrent();
  d.saved = new Date().toISOString();
  const r = await exportScenarioFile(d);
  if (r === 'saved') scMsg(T('Saved as "{f}" (usually in the Downloads folder)', { f: scFileName(d.name) }));
  else if (r === 'declined') scMsg('');
  else {
    $('sc-text').value = JSON.stringify(d, null, 2);
    $('sc-text').select();
    scMsg(T('This page cannot save files. Copy the selected text below and save it as a .json file.'), true);
  }
}
// "Load from a file": the file chosen in the file input
function scImportChosen() {
  const f = $('sc-file').files?.[0];
  if (!f) return;
  const rd = new FileReader(),
    failed = () => scMsg(T('Could not read the file. Choose a .json file saved with "Save to a file".'), true);
  rd.onload = () => {
    try {
      const r = importScenarioFile(String(rd.result));
      scMsg(
        r.count !== undefined
          ? T('Added {n} scenario(s) from the file', { n: r.count })
          : T('Loaded "{n}"', { n: r.name ?? '' }),
      );
    } catch (err) {
      failed();
    }
  };
  rd.onerror = failed;
  rd.readAsText(f);
}
export function buildScenarios() {
  $('sc-save').onclick = scSaveHere;
  $('sc-copy').onclick = async () => {
    const ok = await scCopyOrSelect(scenarioText(scCurrent()));
    scMsg(ok ? T('Copied to the clipboard') : T('Copy the selected text below'), !ok);
  };
  $('sc-link').onclick = async () => {
    const ok = await scCopyOrSelect(scenarioLink(scCurrent()));
    scMsg(
      ok
        ? T(
            'Link copied. The link opens this page with the scenario where the page is served directly (for example GitHub Pages).',
          )
        : T('Copy the selected text below'),
      !ok,
    );
  };
  $('sc-load').onclick = scLoadText;
  $('sc-export').onclick = scExport;
  $('sc-import').onclick = () => {
    $('sc-file').value = '';
    $('sc-file').click();
  };
  $('sc-file').onchange = scImportChosen;
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
