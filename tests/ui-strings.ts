// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The (English) UI strings of the page: T('…') in the script, the names in the tables of plants, controllers, inputs,
// tuning rules, examples and areas, and the HTML text marked with data-i18n / data-i18n-title. Shared by the
// translation tests and the test for leftover dictionary entries
import vm from 'node:vm';
import type { load } from './harness.ts';

export function uiStrings(api: ReturnType<typeof load>['api'], html: string): string[] {
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()?.[1] ?? '';
  const keys = new Set<string>();
  for (const m of script.matchAll(/\bT\('((?:[^'\\]|\\.)*)'/g)) keys.add(vm.runInNewContext(`'${m[1]}'`));
  [api.PARAMS, api.CTRL, api.TDOF, api.REFP, api.INPUTS, api.DIST, api.SAT].forEach(d =>
    Object.values(d).forEach(v => v.label && keys.add(v.label)),
  );
  Object.values(api.REF_TYPES).forEach(v => {
    keys.add(v.name);
    keys.add(v.R);
    if (v.W) keys.add(v.W);
  });
  [...api.EXAMPLES, ...api.CTRL_EXAMPLES].forEach(e => keys.add(e.label));
  Object.values(api.PLANTS).forEach(v => keys.add(v.name));
  Object.values(api.TUNE_RULES).forEach(v => keys.add(v.label));
  keys.add(api.ZOOM_HELP);
  keys.add(api.DIAG_ZOOM_HELP);
  api.ZOOM_BUTTONS.forEach(([z, tip, text]) => {
    keys.add(tip);
    if (z === 'fit') keys.add(text);
  });
  Object.values(api.CONTROLLERS).forEach(v => {
    keys.add(v.label);
    keys.add(v.name);
  });
  Object.values(api.AREA_LABELS).forEach(v => keys.add(v));
  api.SC_EXAMPLES.forEach(e => {
    keys.add(e.name);
    keys.add(e.note);
  });
  [
    api.PLANT_FMT,
    api.CTRL_FMT,
    api.TXT_COLLAPSED,
    api.TXT_TIP,
    api.TXT_PCLOSE,
    api.TXT_BODE_UNSTABLE,
    api.TXT_BODE_RANGE,
    api.TXT_PZ1,
    api.TXT_PZ2,
    api.TXT_PZ3,
  ].forEach(v => keys.add(v));
  const body = html.slice(
    html.indexOf('<body>'),
    html.indexOf('<script>\n/* ================= Version number and change log'),
  );
  for (const m of body.matchAll(/<(\w+)\b[^>]*\sdata-i18n(?=[\s>])[^>]*>([\s\S]*?)<\/\1>/g)) keys.add(m[2]);
  for (const m of body.matchAll(/title="([^"]*)"\s+data-i18n-title/g)) keys.add(m[1]);
  // abbreviations only (P, PI, PID, ...) are not translated
  return [...keys].filter(k => /[a-z]{2,}/.test(k.replace(/\\\(.*?\\\)/g, '')));
}
