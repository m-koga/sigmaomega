// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Render an old and a new build with the same settings and compare every canvas (and the metric text) exactly.
// Usage: npm run pixcmp -- <old index.html> [<new index.html>]   (the new one defaults to ./index.html)
// Uses CHROME_PATH, or /usr/bin/google-chrome when it exists, or Playwright's own Chromium.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const [oldArg, newArg] = process.argv.slice(2);
if (!oldArg) {
  console.error('usage: npm run pixcmp -- <old index.html> [<new index.html>]');
  process.exit(2);
}
const oldHtml = path.resolve(oldArg);
const newHtml = path.resolve(newArg ?? path.join(root, 'index.html'));
const mathjax = fs.readFileSync(path.join(root, 'node_modules/mathjax/es5/tex-svg.js'));

interface Case {
  name: string;
  s?: Record<string, unknown>;
  sweep?: boolean;
  spec?: boolean;
  zoom?: boolean;
}
const cases: Case[] = [
  { name: 'default' },
  { name: 'third PID sweep specs', s: { plant: 'third', mode: 'PID', Kp: 2, Ki: 0.5, Kd: 1 }, sweep: true, spec: true },
  { name: 'dead lead sine sat', s: { plant: 'dead', mode: 'lead', refType: 'sine', sat: true, umax: 1.5 } },
  { name: 'unstable P', s: { plant: 'unstable', mode: 'P', Kp: 0.5 } },
  {
    name: 'second PI disturbance 2dof',
    s: { plant: 'second', mode: 'PID', dOn: true, d: 0.5, td: 5, tdof: true, bw: 0.5, cw: 0 },
  },
  { name: 'zoomed', s: { plant: 'integ', mode: 'PD' }, zoom: true },
];

const chrome =
  process.env.CHROME_PATH || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});

async function render(file: string, c: Case) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('mathjax')) return r.fulfill({ body: mathjax, contentType: 'text/javascript' });
    if (u.includes('fonts.g')) return r.fulfill({ body: '', contentType: 'text/css' });
    return r.continue();
  });
  await page.goto('file://' + file);
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  await page.evaluate((c: Case) => {
    // Names of the page's script, declared as globals in tests/app-api.d.ts
    shownPanels = new Set(['time', 'bode', 'nyq', 'pz']);
    panelsChanged();
    for (const id of ['bodeL', 'bodeP', 'bodeC', 'bodeS', 'bodeT', 'bodeD', 'bodeR', 'pzCtrl', 'pzGrid', 'pzLocus']) {
      const e = document.getElementById(id) as HTMLInputElement | null;
      if (e) e.checked = true;
    }
    if (c.s) Object.assign(S, c.s);
    if (c.sweep) S.sweep = { on: true, p: 'Kp', vals: [1, 2, 4] };
    if (c.spec) {
      S.spec.show = true;
      S.spec.os.on = true;
      S.spec.ts.on = true;
      S.spec.zeta.on = true;
    }
    buildPlant();
    buildCtrlCustom();
    update();
    redraw();
    if (c.zoom) {
      PLOT_VIEWS.cvY = { x: [1, 4] };
      PLOT_VIEWS.cvG = { x: [0.3, 2] };
      PLOT_VIEWS.cvPh = { x: [0.3, 2] };
      redraw();
    }
  }, c);
  await page.waitForTimeout(300);
  const out = await page.evaluate(() => ({
    canvases: [...document.querySelectorAll('canvas')].map(cv => [cv.id, cv.toDataURL()]),
    text: ['metrics', 'margins', 'pzTable', 'pzRange', 'pzBanner', 'sw-table'].map(
      id => document.getElementById(id)?.innerHTML ?? '',
    ),
  }));
  await page.close();
  return out;
}

let bad = 0;
for (const c of cases) {
  const a = await render(oldHtml, c),
    b = await render(newHtml, c);
  a.canvases.forEach(([id, d], i) => {
    if (d !== b.canvases[i]?.[1]) {
      bad++;
      console.log(`DIFF ${c.name}: canvas ${id}`);
    }
  });
  a.text.forEach((t, i) => {
    if (t !== b.text[i]) {
      bad++;
      console.log(`DIFF ${c.name}: text #${i}`);
    }
  });
  console.log(`${c.name}: ${a.canvases.length} canvases compared`);
}
await browser.close();
console.log(bad ? `${bad} differences` : 'identical');
process.exit(bad ? 1 : 0);
