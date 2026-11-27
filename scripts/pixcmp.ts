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
    shownPanels = new Set(['time', 'bode', 'nyq', 'nich', 'pz']);
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
  await page.waitForTimeout(300); // the Routh table and the steady-state errors are rendered after 120 ms
  // the text and tables of the panels and of the analysis cards (the tuning and compensator cards render only
  // while they are shown)
  // (MathJax numbers its formulas and their glyphs in the order typeset: the numbers say nothing about what is shown)
  const html = (ids: string[]) =>
    ids.map(id =>
      (document.getElementById(id)?.innerHTML ?? '')
        .replace(/ ctxtmenu_counter="\d+"/g, '')
        .replace(/MJX-\d+-/g, 'MJX-'),
    );
  const text = await page.evaluate(html, [
    ...['metrics', 'margins', 'pzTable', 'pzRange', 'pzBanner', 'sw-table', 'specSum', 'ctrl-info'],
    ...['routhBox', 'sseBox', 'bodeAsym', 'bodeNote', 'nyqCrit', 'pzRulesBox', 'diagBox'],
  ]);
  // the block diagram for every combination of its parts, and for the plant alone
  text.push(
    await page.evaluate(() => {
      const all: string[] = [];
      for (let i = 0; i < 16; i++)
        all.push(diagramSVG({ sat: !!(i & 1), d: !!(i & 2), n: !!(i & 4), two: !!(i & 8) }).svg);
      all.push(diagramSVG({ sat: false, d: false, n: false, two: false, plant: true }).svg);
      return all.join('\n');
    }),
  );
  for (const [card, method] of [['tune'], ['comp', 'lead'], ['comp', 'lag'], ['comp', 'leadlag']]) {
    await page.evaluate(
      ([card, method]) => {
        if (method) S.comp.method = method;
        setSideCard(card);
        update();
      },
      [card, method] as const,
    );
    text.push(...(await page.evaluate(html, [card === 'tune' ? 'tuneOut' : 'compOut'])));
  }
  const out = {
    canvases: await page.evaluate(() => [...document.querySelectorAll('canvas')].map(cv => [cv.id, cv.toDataURL()])),
    text,
  };
  await page.close();
  return out;
}

let bad = 0;
for (const c of cases) {
  const a = await render(oldHtml, c),
    b = await render(newHtml, c);
  // canvases matched by id (a new canvas in the page does not shift the others; one only in the new page is skipped)
  const nb = new Map(b.canvases as [string, string][]);
  a.canvases.forEach(([id, d]) => {
    if (d !== nb.get(id)) {
      bad++;
      console.log(`DIFF ${c.name}: canvas ${id}`);
    }
  });
  a.text.forEach((t, i) => {
    if (t !== b.text[i]) {
      bad++;
      // shown from a little before the first character that differs
      let k = 0;
      while (k < t.length && t[k] === b.text[i][k]) k++;
      const from = Math.max(0, k - 80);
      console.log(
        `DIFF ${c.name}: text #${i} at ${k}\n  old: ${t.slice(from, from + 300)}\n  new: ${b.text[i].slice(from, from + 300)}`,
      );
    }
  });
  console.log(
    `${c.name}: ${a.canvases.length} canvases and ${a.text.filter(t => t).length} of ${a.text.length} texts compared`,
  );
}
await browser.close();
console.log(bad ? `${bad} differences` : 'identical');
process.exit(bad ? 1 : 0);
