// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Take the screenshots of the user manual (chapter "Trying the exercises") from the built index.html.
// Each shot loads an exercise, changes the settings the manual describes and captures one panel or card,
// in every language of the manual. The pictures are written to src/help-img/<name>.<lang>.webp and the build puts them
// into the page (scripts/build.ts). Run again after a change that alters what the pictures show:
//   npm run build && npm run shots && npm run build
// Uses CHROME_PATH, or /usr/bin/google-chrome when it exists, or Playwright's own Chromium. Needs Python 3 with
// Pillow to convert the PNG screenshots to WebP.
import { chromium } from '@playwright/test';
import { SHOT_WIDTH } from './build.ts';
import type { Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const OUT = path.join(root, 'src', 'help-img');
const PAGE = 'file://' + path.join(root, 'index.html');
const mathjax = fs.readFileSync(path.join(root, 'node_modules/mathjax/es5/tex-svg.js'));
const QUALITY = 80;

interface Shot {
  name: string; // file name (and the name used in the manual: <figure data-img="name">)
  ex: number; // exercise (index into SC_EXAMPLES)
  panels: string[]; // plots shown
  set?: Record<string, unknown>; // settings changed before holding (merged into S)
  hold?: boolean; // hold the response, then apply after
  after?: Record<string, unknown>; // settings changed after holding
  sweep?: { p: string; vals: number[] };
  card?: string; // card shown in the settings panel
  tab?: string; // tab of the area under the plot to show (a tab button's data-itab)
  view?: Record<string, { x?: [number, number]; y?: [number, number] }>; // zoomed plots (PLOT_VIEWS)
  target: string; // selector of the element captured
}
export const SHOTS: Shot[] = [
  // Exercise 1: K_I 0.3 (held, gray) against 0.4, with the specification lines
  { name: 'ex1-time', ex: 0, panels: ['time'], hold: true, after: { Ki: 0.4 }, target: '#panel-time' },
  // Exercise 2: the sweep of K_I in the Nyquist plot and the table of the sweep
  {
    name: 'ex2-nyq',
    ex: 1,
    panels: ['nyq'],
    set: { Kp: 0.7 },
    sweep: { p: 'Ki', vals: [0.2, 0.3, 0.4, 0.5, 0.6] },
    view: { cvN: { x: [-2.5, 1], y: [-2, 1] } },
    target: '#panel-nyq',
  },
  {
    name: 'ex2-table',
    ex: 1,
    panels: ['time'],
    set: { Kp: 0.7 },
    sweep: { p: 'Ki', vals: [0.2, 0.3, 0.4, 0.5, 0.6] },
    card: 'sweep',
    target: '#sw-table',
  },
  // Exercise 3: b = c = 1 (held) against b = 0.7, c = 0; the disturbance response after t = 15 s is the same
  { name: 'ex3-time', ex: 2, panels: ['time'], hold: true, after: { bw: 0.7, cw: 0 }, target: '#panel-time' },
  // Exercise 4: the unstable closed-loop pole on the root locus, then PI with poles at −1 ± j
  { name: 'ex4-pz', ex: 3, panels: ['pz'], tab: 'pzrange', target: '#panel-pz' },
  { name: 'ex4-time', ex: 3, panels: ['time'], set: { mode: 'PI', Kp: 3, Ki: 2 }, target: '#panel-time' },
];

async function take(page: Page, s: Shot, lang: string, file: string) {
  await page.evaluate(
    ([s, lang]) => {
      // Names of the page's script, declared as globals in tests/app-api.d.ts
      setLang(lang as Parameters<typeof setLang>[0]);
      const e = SC_EXAMPLES[s.ex],
        st = { ...JSON.parse(JSON.stringify(e.S)), ...(s.set || {}) };
      st.spec = { ...(st.spec || {}), show: true };
      if (s.sweep) st.sweep = { on: true, p: s.sweep.p, vals: s.sweep.vals };
      applyScenario({ name: T(e.name), note: T(e.note), S: st }, { layout: true });
      if (s.card) setSideCard(s.card);
      shownPanels = new Set(s.panels);
      panelsChanged();
      if (s.hold) {
        document.getElementById('hold')!.click();
        Object.assign(S, s.after || {});
        buildStatic();
        buildCtrlCustom();
        update();
      }
      Object.assign(PLOT_VIEWS, s.view || {});
      redraw();
      if (s.tab) document.getElementById(`itab-${s.tab}`)!.click();
    },
    [s, lang] as const,
  );
  await page.waitForTimeout(400);
  const loc = page.locator(s.target);
  await loc.scrollIntoViewIfNeeded();
  const png = path.join(os.tmpdir(), `${s.name}.${lang}.png`);
  await loc.screenshot({ path: png, animations: 'disabled' });
  // taken at twice the size on the screen, so that the text stays sharp; wider ones are shrunk to SHOT_WIDTH
  // (the build tells the two apart by their width) and saved as WebP
  execFileSync('python3', [
    '-c',
    `import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB')
w = min(im.width, int(sys.argv[3]))
im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
im.save(sys.argv[2], 'WEBP', quality=int(sys.argv[4]), method=6)`,
    png,
    file,
    String(SHOT_WIDTH),
    String(QUALITY),
  ]);
}

if (process.argv[1] === import.meta.filename) {
  const chrome =
    process.env.CHROME_PATH || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
  const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
  fs.mkdirSync(OUT, { recursive: true });
  // every language that has the manual (src/help/<lang>.html), or those given: npm run shots -- fr de
  const langs = process.argv.slice(2).length
    ? process.argv.slice(2)
    : fs
        .readdirSync(path.join(root, 'src', 'help'))
        .filter(f => f.endsWith('.html'))
        .map(f => f.replace('.html', ''));
  for (const lang of langs) {
    for (const s of SHOTS) {
      // a fresh page for each shot, so that no setting is left from the one before
      const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
      await page.route('**/*', r => {
        const u = r.request().url();
        if (u.includes('mathjax')) return r.fulfill({ body: mathjax, contentType: 'text/javascript' });
        if (u.includes('fonts.g')) return r.fulfill({ body: '', contentType: 'text/css' });
        return r.continue();
      });
      await page.goto(PAGE);
      await page.waitForFunction(() => document.querySelector('#tex-C svg'));
      const file = path.join(OUT, `${s.name}.${lang}.webp`);
      await take(page, s, lang, file);
      console.log(`${path.relative(root, file)}: ${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
      await page.close();
    }
  }
  await browser.close();
}
