// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Time efficiency of the simulator (see PERFORMANCE.md): measures in a real browser how long the page takes to
// start, to respond to a slider and to redraw, and how long each computation takes, for typical and for the
// heaviest settings, at the normal speed of this computer and with the processor slowed down 4 times (like a
// slower laptop or phone). Prints the tables of PERFORMANCE.md as Markdown.
// Usage: npm run performance   (about two minutes)
// Uses CHROME_PATH, or /usr/bin/google-chrome when it exists, or Playwright's own Chromium. MathJax is served from
// node_modules and the web fonts are left out, so the network is not measured (its share is estimated separately).
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const html = path.join(root, 'index.html');
const mathjaxFile = path.join(root, 'node_modules/mathjax/es5/tex-svg.js');
const mathjax = fs.readFileSync(mathjaxFile);
const chrome =
  process.env.CHROME_PATH || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
const SLOW = 4; // CPU slowdown for the second set of measurements

/** Settings of a case: a scenario example, or changes to the defaults */
interface Case {
  name: string;
  /** index of SC_EXAMPLES */
  example?: number;
  s?: Record<string, unknown>;
  /** parameter sweep with these values of Kp */
  sweep?: number[];
}
const cases: Case[] = [
  { name: 'Start-up settings (first-order lag, PID)' },
  { name: 'Exercise 1 (third-order lag, PID)', example: 0 },
  { name: 'Exercise 2 (dead time, PI)', example: 1 },
  { name: 'Eighth-order plant 1/(s+1)^8, PID', s: { plant: 'custom', cNumStr: '1', cDenStr: '(s+1)^8' } },
  // the derivative filter N = 100 over 200 s asks for 100 substeps between recorded points: the most there can be
  { name: 'Most time steps (PID, N = 100, 200 s)', s: { Kd: 1, N: 100, Tsim: 200 } },
  { name: 'Exercise 1 with a sweep of 8 values', example: 0, sweep: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4] },
  {
    name: 'Most time steps with a sweep of 8 values',
    s: { Kd: 1, N: 100, Tsim: 200 },
    sweep: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4],
  },
];

async function openPage(rate = 1): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('mathjax')) return r.fulfill({ body: mathjax, contentType: 'text/javascript' });
    if (u.includes('fonts.g')) return r.fulfill({ body: '', contentType: 'text/css' });
    return r.continue();
  });
  if (rate !== 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  }
  return page;
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y),
    n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const ms = (v: number) => (v < 10 ? v.toFixed(1) : v.toFixed(0));

// ---------- start-up ----------
interface StartUp {
  firstPaint: number;
  ready: number;
  formulas: number;
}
async function startUp(rate: number, runs: number): Promise<StartUp> {
  const r: StartUp[] = [];
  for (let i = 0; i < runs; i++) {
    const page = await openPage(rate);
    // record when the formulas are typeset (MathJax runs after the page is ready)
    await page.addInitScript(() => {
      const w = window as unknown as { __formulas?: number };
      const look = () => {
        if (document.querySelector('#tex-C svg')) w.__formulas = performance.now();
        else requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    await page.goto('file://' + html);
    await page.waitForFunction(() => (window as unknown as { __formulas?: number }).__formulas !== undefined, null, {
      timeout: 60000,
    });
    r.push(
      await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming,
          fcp = performance.getEntriesByName('first-contentful-paint')[0];
        return {
          firstPaint: fcp ? fcp.startTime : NaN,
          ready: nav.domContentLoadedEventEnd,
          formulas: (window as unknown as { __formulas: number }).__formulas,
        };
      }),
    );
    await page.close();
  }
  return {
    firstPaint: median(r.map(x => x.firstPaint)),
    ready: median(r.map(x => x.ready)),
    formulas: median(r.map(x => x.formulas)),
  };
}

// ---------- one case: the computations, update() and redraw() ----------
interface CaseResult {
  substeps: number;
  freqPoints: number;
  simulate: number;
  freq: number;
  poles: number;
  locus: number;
  sweep: number;
  redraw: number;
  update: number;
  updateMax: number;
  /** update() with the panels shown at the first visit (block diagram, time response, formulas) */
  updateFew: number;
}
async function setCase(page: Page, c: Case) {
  await page.evaluate((c: Case) => {
    if (c.example !== undefined) applyScenario({ S: SC_EXAMPLES[c.example].S } as Scenario);
    else defaults();
    if (c.s) {
      Object.assign(S, c.s);
      if (S.plant === 'custom') {
        S.cNum = parsePoly(S.cNumStr);
        S.cDen = parsePoly(S.cDenStr);
      }
    }
    S.sweep = c.sweep ? { on: true, p: 'Kp', vals: c.sweep } : { on: false, p: 'Kp', vals: [1] };
    // every panel shown, with the root locus, the controller poles and the grid on the pole-zero map
    setShownPanels(PANELS);
    for (const id of ['bodeL', 'bodeP', 'bodeC', 'bodeS', 'bodeT', 'pzCtrl', 'pzGrid', 'pzLocus']) {
      const e = document.getElementById(id) as HTMLInputElement | null;
      if (e) e.checked = true;
    }
    buildPlant();
    buildCtrlCustom();
    applyPanels();
    update();
  }, c);
}
async function measureCase(page: Page, c: Case, runs: number): Promise<CaseResult> {
  console.error('  ' + c.name);
  await setCase(page, c);
  return page.evaluate(
    ([runs, sweep]) => {
      // repeated up to `runs` times for at most about 3 s; the first run warms up, unless it took 0.5 s or more
      const time = (f: () => unknown) => {
        const t: number[] = [],
          start = performance.now();
        for (let first = true; ; first = false) {
          const t0 = performance.now();
          f();
          const d = performance.now() - t0;
          if (first && d < 500) continue;
          t.push(d);
          if (t.length >= runs || performance.now() - start > 3000) break;
        }
        t.sort((a, b) => a - b);
        return { med: t[Math.floor(t.length / 2)], max: t[t.length - 1] };
      };
      const sim = simulate(),
        fr = freqResp();
      const u = time(() => update());
      setShownPanels(DEFAULT_PANELS);
      applyPanels();
      const few = time(() => update()).med;
      setShownPanels(PANELS);
      applyPanels();
      return {
        updateFew: few,
        substeps: sim.substeps,
        freqPoints: fr.W.length,
        simulate: time(() => simulate()).med,
        freq: time(() => {
          freqResp();
          bodeResp();
        }).med,
        poles: time(() => computePZ()).med,
        locus: time(() => {
          resetLoopCache();
          locus();
          stableKRanges();
        }).med,
        sweep: sweep ? time(() => sweepRuns()).med : 0,
        redraw: time(() => redraw()).med,
        update: u.med,
        updateMax: u.max,
      };
    },
    [runs, !!c.sweep] as const,
  );
}

// update() only (for the slowed-down processor)
async function measureUpdate(page: Page, c: Case): Promise<CaseResult> {
  console.error('  (slow) ' + c.name);
  await setCase(page, c);
  const u = await page.evaluate(() => {
    const t: number[] = [],
      start = performance.now();
    for (let first = true; ; first = false) {
      const t0 = performance.now();
      update();
      const d = performance.now() - t0;
      if (first && d < 500) continue;
      t.push(d);
      if (t.length >= 5 || performance.now() - start > 3000) break;
    }
    return t.sort((a, b) => a - b)[Math.floor(t.length / 2)];
  });
  return { update: u } as CaseResult;
}

// ---------- dragging a slider with the mouse ----------
interface Drag {
  events: number;
  processing: number;
  processingMax: number;
  toFrame: number;
  toFrameMax: number;
}
// Drags the K_P slider across its track; for each input event: the time the page takes to handle it (computing
// and drawing everything again) and the time from the event to the next frame, in which the result is shown
async function drag(page: Page, c: Case): Promise<Drag> {
  console.error('  drag: ' + c.name);
  await setCase(page, c);
  await page.evaluate(() => {
    setSideCard('ctrl'); // the card with the controller's sliders
    const w = window as unknown as { __drag: { p: number[]; f: number[] } };
    w.__drag = { p: [], f: [] };
    let t0 = 0;
    window.addEventListener('input', () => (t0 = performance.now()), true); // before the slider's own handler
    window.addEventListener('input', e => {
      const ts = e.timeStamp,
        t1 = performance.now();
      w.__drag.p.push(t1 - t0);
      requestAnimationFrame(() => w.__drag.f.push(performance.now() - ts));
    }); // after it
  });
  const el = page.locator('#in-Kp');
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  if (!b) throw new Error('no K_P slider');
  const y = b.y + b.height / 2;
  await page.mouse.move(b.x + 4, y);
  await page.mouse.down();
  for (let i = 1; i <= 40; i++) await page.mouse.move(b.x + 4 + ((b.width - 8) * i) / 40, y);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const d = await page.evaluate(() => (window as unknown as { __drag: { p: number[]; f: number[] } }).__drag);
  const max = (a: number[]) => Math.max(...a);
  return {
    events: d.p.length,
    processing: median(d.p),
    processingMax: max(d.p),
    toFrame: median(d.f),
    toFrameMax: max(d.f),
  };
}

// ---------- run ----------
const cpu = os.cpus()[0]?.model.replace(/\s+/g, ' ').trim() ?? 'unknown';
const version = browser.version();
const gz = (b: Buffer) => zlib.gzipSync(b, { level: 9 }).length;
const page0 = fs.readFileSync(html);
const kb = (n: number) => `${Math.round(n / 1024)} KB`;

const out: string[] = [];
const p = (s = '') => out.push(s);
p(
  `Measured on ${new Date().toISOString().slice(0, 10)}: ${cpu}, ${os.cpus().length} cores; Chrome ${version} (headless); Node.js ${process.version}.`,
);
p();
p('### Download size');
p();
p('| File | Size | Compressed (gzip) | From |');
p('|---|---|---|---|');
p(`| The page (index.html, with the manual's pictures) | ${kb(page0.length)} | ${kb(gz(page0))} | the site |`);
p(`| MathJax (tex-svg.js, for the formulas) | ${kb(mathjax.length)} | ${kb(gz(mathjax))} | cdn.jsdelivr.net |`);
p();

console.error('start-up');
const s1 = await startUp(1, 7),
  s4 = await startUp(SLOW, 5);
p('### Start-up (without the network)');
p();
p(`| | This computer | Processor ${SLOW}× slower |`);
p('|---|---|---|');
p(`| First paint | ${ms(s1.firstPaint)} ms | ${ms(s4.firstPaint)} ms |`);
p(`| Ready: plots drawn, inputs usable | ${ms(s1.ready)} ms | ${ms(s4.ready)} ms |`);
p(`| Formulas typeset (MathJax) | ${ms(s1.formulas)} ms | ${ms(s4.formulas)} ms |`);
p();

const results: [Case, CaseResult][] = [];
{
  const page = await openPage(1);
  await page.goto('file://' + html);
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  for (const c of cases) results.push([c, await measureCase(page, c, c.sweep ? 7 : 15)]);
  await page.close();
}
p('### Computing and drawing, by part (this computer)');
p();
p(
  'Every panel shown. Median of repeated runs, in ms; "substeps": the time steps of the simulation (4000 recorded points × substeps between them).',
);
p();
p(
  '| Settings | Substeps | Simulation | Frequency response | Poles | Root locus | Sweep | Drawing | All (update) | All, slowest run |',
);
p('|---|---|---|---|---|---|---|---|---|---|');
for (const [c, r] of results)
  p(
    `| ${c.name} | ${r.substeps * 4000} | ${ms(r.simulate)} | ${ms(r.freq)} | ${ms(r.poles)} | ${ms(r.locus)} | ${c.sweep ? ms(r.sweep) : '—'} | ${ms(r.redraw)} | ${ms(r.update)} | ${ms(r.updateMax)} |`,
  );
p();
p('### Computing and drawing everything again (update), by the panels shown (this computer)');
p();
p(
  '| Settings | Panels of a first visit (block diagram, time response, formulas) | Every panel (with the pole-zero map and its root locus) |',
);
p('|---|---|---|');
for (const [c, r] of results) p(`| ${c.name} | ${ms(r.updateFew)} ms | ${ms(r.update)} ms |`);
p();

const slow: [Case, CaseResult][] = [];
{
  const page = await openPage(SLOW);
  await page.goto('file://' + html);
  await page.waitForFunction(() => document.querySelector('#tex-C svg'), null, { timeout: 60000 });
  for (const c of cases) slow.push([c, await measureUpdate(page, c)]);
  await page.close();
}
p(`### Computing and drawing everything again (update), this computer and ${SLOW}× slower`);
p();
p(`| Settings | This computer | Processor ${SLOW}× slower |`);
p('|---|---|---|');
results.forEach(([c, r], i) => p(`| ${c.name} | ${ms(r.update)} ms | ${ms(slow[i][1].update)} ms |`));
p();

p('### Dragging the K_P slider with the mouse');
p();
p(
  '40 mouse moves across the slider; every move computes and draws everything again. Handling: the time the page takes for one input event; to the next frame: from the event to the next frame of the screen, in which the result is shown. Median / slowest, in ms.',
);
p();
p(`| Settings | Processor | Events | Handling | To the next frame |`);
p('|---|---|---|---|---|');
for (const ci of [0, 1, 4, 5])
  for (const rate of [1, SLOW]) {
    const page = await openPage(rate);
    await page.goto('file://' + html);
    await page.waitForFunction(() => document.querySelector('#tex-C svg'), null, { timeout: 60000 });
    const d = await drag(page, cases[ci]);
    await page.close();
    p(
      `| ${cases[ci].name} | ${rate === 1 ? 'this computer' : `${SLOW}× slower`} | ${d.events} | ${ms(d.processing)} / ${ms(d.processingMax)} | ${ms(d.toFrame)} / ${ms(d.toFrameMax)} |`,
    );
  }
p();
await browser.close();
console.log(out.join('\n'));
