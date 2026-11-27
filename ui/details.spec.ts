// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Less frequent paths: sliders, sweeps drawn in every plot, pole-zero map options, scenario details,
// the artifact viewer's downloads capability, area handles, card folding, the change log, timed messages
import { test, expect, dragY, boxOf, pickView, togglePanel, showAllPanels, openCard } from './fixtures.ts';
import type { Page } from '@playwright/test';

// Set by the stand-in for the artifact viewer below
declare global {
  interface Window {
    __saved: string[];
    __decline?: boolean;
  }
}

const showTab = async (page: Page, k: string) => {
  if (!(await page.locator(`#panel-${k}`).isVisible())) await togglePanel(page, k);
};
const enter = async (page: Page, sel: string, v: string) => {
  await page.fill(sel, v);
  await page.press(sel, 'Enter');
};

test('sliders and the reference type change the settings', async ({ page }) => {
  await openCard(page, 'ctrl');
  await page.locator('#in-Kp').fill('3');
  expect(await page.evaluate(() => S.Kp)).toBe(3);
  expect(parseFloat(await page.inputValue('#v-Kp'))).toBe(3);
  await openCard(page, 'input');
  await page.selectOption('#refType', 'sine');
  expect(await page.evaluate(() => S.refType)).toBe('sine');
  await expect(page.locator('#in-rPer')).toBeAttached(); // the period of the sine wave can be set
});

test('impulse reference: its metrics, the area of y equal to the theory A·T(0)', async ({ page }) => {
  await page.evaluate(() => {
    Object.assign(S, { plant: 'first', K: 1, T: 1, mode: 'P', Kp: 2, R: 1, rT0: 1, Tsim: 20 });
    buildPlant();
  });
  await openCard(page, 'input');
  await page.selectOption('#refType', 'impulse');
  await expect(page.locator('#tex-r')).toContainText('δ');
  const val = (i: number) => page.locator('#metrics .m').nth(i).locator('.v');
  // area ∫ y dt = A·T(0) = 2/3 for P control of 1/(s + 1) with K_P = 2
  await expect(val(2)).toHaveText('0.6667');
  await expect(val(3)).toHaveText('0.6667');
});

test('lead and lag compensator design: the steps, the result and Apply', async ({ page }) => {
  await page.evaluate(() => {
    Object.assign(S, { plant: 'integ', K: 1, T: 1 });
    buildPlant();
    update();
  });
  await openCard(page, 'comp');
  await page.fill('#compKc', '10');
  await page.press('#compKc', 'Enter');
  await expect(page.locator('#compOut li')).toHaveCount(5); // the five steps of the lead design
  await expect(page.locator('#compOut')).toContainText('17.96');
  await page.click('#compApply');
  expect(await page.evaluate(() => [S.mode, S.Kc, S.alpha > 0.2 && S.alpha < 0.3])).toEqual(['lead', 10, true]);
  expect(await page.evaluate(() => Math.round(lastFr!.pm!))).toBe(50);
  // lag: four steps
  await page.selectOption('#compMethod', 'lag');
  await expect(page.locator('#compOut li')).toHaveCount(4);
  await page.click('#compApply');
  expect(await page.evaluate(() => S.mode)).toBe('lag');
});

test('estimation exercise: the hidden step response, checking estimates, the answer and using the plant', async ({
  page,
}) => {
  await openCard(page, 'ex');
  await expect(page.locator('#exN')).toHaveValue('1');
  await expect(page.locator('#exUse')).toBeDisabled();
  const p = await page.evaluate(() => exercisePlant(1));
  // estimates 5 % off: all three within 10 %
  await page.fill('#exK', String(p.K * 1.05));
  await page.fill('#exT', String(p.T * 0.95));
  await page.fill('#exL', String(p.L));
  await page.click('#exCheck');
  await expect(page.locator('#exOut')).toContainText(await page.evaluate(() => T('All three within 10 %: well done!')));
  // the answer, then the plant is used in the simulator
  await page.click('#exShow');
  await expect(page.locator('#exUse')).toBeEnabled();
  await page.click('#exUse');
  expect(await page.evaluate(() => [S.plant, S.K, S.T, S.L])).toEqual(['dead', p.K, p.T, p.L]);
  // another number gives another plant and clears the result
  await page.fill('#exN', '7');
  await page.press('#exN', 'Enter');
  await expect(page.locator('#exOut')).toBeEmpty();
  expect(await page.evaluate(() => S.ex.n)).toBe(7);
});

test('a parameter sweep is drawn in the Bode, Nyquist and pole-zero plots', async ({ page }) => {
  await openCard(page, 'sweep');
  await page.check('#sw-on');
  for (const k of ['bode', 'nyq', 'pz']) await showTab(page, k);
  await page.check('#pzCL');
  const n = await page.evaluate(() => lastSweep!.length);
  expect(n).toBeGreaterThan(1);
  // every sweep value has its closed-loop poles in the map and an entry in its legend
  expect(await page.evaluate(() => new Set(pzPts.filter(q => q.p.k === 'sw').map(q => q.p.i)).size)).toBe(n);
  // and a curve in the Bode and Nyquist plots (drawn below the nominal one)
  expect(await page.evaluate(() => sweepSeries(r => ({ x: r.fr.W, y: r.fr.mag })).length)).toBe(n);
});

test('specification lines on the time response, and a Bode plot zoomed into less than a decade', async ({ page }) => {
  await openCard(page, 'spec');
  await page.check('#spec-show');
  await page.check('#spec-os-on');
  await page.check('#spec-sse-on');
  await page.check('#spec-ts-on');
  expect(await page.evaluate(() => [S.spec.show, S.spec.os.on, S.spec.sse.on])).toEqual([true, true, true]);
  await showTab(page, 'bode');
  await page.locator('#cvG').scrollIntoViewIfNeeded(); // below the time response and the transfer functions
  const b = await boxOf(page, '#cvG');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.keyboard.down('Shift');
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -500);
  await page.keyboard.up('Shift');
  const x = await page.evaluate(() => PLOT_VIEWS.cvG.x!);
  expect(x[1] / x[0]).toBeLessThan(10); // labelled 1, 2, 5 × 10^n or finer
});

test('pole-zero map options: plant zeros, controller poles and zeros, the ζ–ωn grid, PNG', async ({ page }) => {
  await page.selectOption('#plant', 'custom');
  await enter(page, '#cNum', 's+2');
  await enter(page, '#cDen', '(s+1)(s+3)(s+5)');
  await showTab(page, 'pz');
  await page.check('#pzCtrl');
  await page.check('#pzGrid');
  const kinds = await page.evaluate(() => [...new Set(pzPts.map(q => q.p.k))].sort());
  expect(kinds).toEqual(expect.arrayContaining(['pp', 'pz', 'cp', 'cz']));
  await page.uncheck('#pzPlant');
  expect(await page.evaluate(() => pzPts.some(q => q.p.k === 'pp'))).toBe(false);
  await showTab(page, 'nyq');
  await page.uncheck('#nyqMs');
  const dl = page.waitForEvent('download');
  await page.click('#pzPng');
  expect((await dl).suggestedFilename()).toMatch(/\.png$/);
  await expect(page.locator('#toast')).toHaveClass(/on/);
});

test('clicking the root locus scales a controller given as a transfer function', async ({ page }) => {
  await openCard(page, 'ctrl');
  await page.selectOption('#mode', 'custom');
  await enter(page, '#ccNum', '2(s+1)');
  await enter(page, '#ccDen', 's');
  await showTab(page, 'pz');
  const q = await page.evaluate(() => {
    const far = (q: { px: number; py: number }) => pzPts.every(r => Math.hypot(r.px - q.px, r.py - q.py) > 14);
    const c = pzLocusPts.filter(q => q.k > 2 && q.k < 20 && far(q));
    return c.length ? { x: c[0].px, y: c[0].py, k: c[0].k } : null;
  });
  if (!q) throw new Error('no point of the root locus to click');
  await page.locator('#cvPZ').scrollIntoViewIfNeeded();
  const b = await boxOf(page, '#cvPZ');
  await page.mouse.move(b.x + q.x, b.y + q.y);
  await page.mouse.down();
  await page.mouse.up();
  const num = await page.evaluate(() => S.ccNum);
  expect(num[0]).toBeCloseTo(2 * q.k, 3);
  await expect(page.locator('#ccNum')).toHaveValue(/^\[/);
});

test('scenarios: special characters in names, saving under the same name, layout loaded with folded sections', async ({
  page,
}) => {
  await page.selectOption('#plant', 'custom'); // has folded sections (examples)
  await openCard(page, 'scen');
  await page.fill('#sc-name', '<A & B>');
  await page.click('#sc-save');
  await page.click('#sc-save'); // the second save replaces the first
  await expect(page.locator('#sc-list .sc-item .nm').first()).toHaveText('<A & B>');
  await expect(page.locator('[data-sc-del]')).toHaveCount(1);
  // zoom a plot and open a folded section, then load the scenario with its layout
  const c = await boxOf(page, '#cvY');
  await page.mouse.move(c.x + 200, c.y + 100);
  await page.mouse.wheel(0, -300);
  await openCard(page, 'plant');
  await page.click('[data-sub=p-ex] .sub-h');
  await openCard(page, 'scen');
  await page.click('[data-sc-load="0"]');
  expect(await page.evaluate(() => Object.keys(PLOT_VIEWS).length)).toBe(0); // views are reset
  await expect(page.locator('[data-sub=p-ex]')).toHaveClass(/folded/); // as saved in the layout
  // a task note shows the banner, which can be closed
  await page.fill('#sc-note', 'Make the overshoot less than 10 %');
  await page.click('#sc-copy');
  const text = await page.evaluate(() => scenarioText(scenarioData('task', $('sc-note').value, false)));
  await page.fill('#sc-text', text);
  await page.click('#sc-load');
  await expect(page.locator('#taskBanner')).toHaveClass(/on/);
  await page.click('#taskClose');
  await expect(page.locator('#taskBanner')).not.toHaveClass(/on/);
});

test('a file with a list of scenarios is added to the saved ones (same names replaced)', async ({ page }) => {
  await openCard(page, 'scen');
  await page.fill('#sc-name', 'one');
  await page.click('#sc-save');
  await page.fill('#sc-name', 'kept');
  await page.click('#sc-save');
  const S0 = await page.evaluate(() => JSON.parse(JSON.stringify(S)));
  const list = [{ name: 'one', S: { ...S0, Kp: 7 } }, { name: 'two', S: S0 }, { name: 'not a scenario' }];
  await page.setInputFiles('#sc-file', {
    name: 'list.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(list)),
  });
  await expect(page.locator('#sc-msg')).toContainText('2');
  const saved = await page.evaluate(() => scLoadAll().map(d => [d.name, d.S.Kp, !!d.saved]));
  expect(saved.map(d => d[0])).toEqual(['one', 'two', 'kept']);
  expect(saved[0][1]).toBe(7);
  expect(saved.every(d => d[2])).toBe(true); // a save time is added
});

test('timed messages: delete confirmation, scenario message and toast disappear', async ({ page }) => {
  await openCard(page, 'scen');
  await page.fill('#sc-name', 'x');
  await page.click('#sc-save');
  await expect(page.locator('#sc-msg')).not.toBeEmpty();
  await page.click('[data-sc-del="0"]');
  await expect(page.locator('[data-sc-del="0"]')).toHaveClass(/arm/);
  await expect(page.locator('[data-sc-del="0"]')).not.toHaveClass(/arm/, { timeout: 5000 }); // after 3 s
  await expect(page.locator('[data-sc-del]')).toHaveCount(1);
  const dl = page.waitForEvent('download');
  await page.hover('#cvY');
  await page.click('.plot-tools[data-for=cvY] [data-z=png]');
  await dl;
  await expect(page.locator('#toast')).toHaveClass(/on/);
  await expect(page.locator('#sc-msg')).toBeEmpty({ timeout: 8000 }); // after 6 s
  await expect(page.locator('#toast')).not.toHaveClass(/on/, { timeout: 8000 }); // after 5 s
});

// The claude.ai artifact viewer offers files through window.claude.use('downloads')
async function withDownloads(page: Page, script: () => void) {
  await page.addInitScript(script);
  await page.reload();
  await page.waitForFunction(() => typeof S === 'object' && document.querySelector('#tex-C svg'));
  await openCard(page, 'scen');
}

test('in the artifact viewer, files are saved through the downloads capability (or declined)', async ({ page }) => {
  await withDownloads(page, () => {
    window.__saved = [];
    window.claude = {
      use: async () => ({
        save: async ({ filename }: { filename: string }) => {
          if (window.__decline) throw Object.assign(new Error('declined'), { code: 'declined' });
          window.__saved.push(filename);
        },
      }),
    };
  });
  await page.fill('#sc-name', 'viewer');
  await page.click('#sc-export');
  await expect(page.locator('#sc-msg')).toContainText('viewer.json');
  expect(await page.evaluate(() => window.__saved)).toEqual(['viewer.json']);
  await page.evaluate(() => {
    window.__decline = true;
  });
  await page.click('#sc-export');
  await expect(page.locator('#sc-msg')).toBeEmpty();
});

test('without the downloads capability, the scenario is shown as text to copy', async ({ page }) => {
  await withDownloads(page, () => {
    window.claude = { use: () => Promise.reject(new Error('not declared')) };
  });
  await page.fill('#sc-name', 'nofile');
  await page.click('#sc-export');
  await expect(page.locator('#sc-msg')).toHaveClass(/err/);
  expect(JSON.parse(await page.inputValue('#sc-text')).name).toBe('nofile');
});

test('a card of the settings panel stays open: its heading is a plain heading (no folding, no show all / hide all)', async ({
  page,
}) => {
  const plant = page.locator('.side > .card[data-card=plant]');
  await plant.locator('h2').click();
  await expect(plant).not.toHaveClass(/folded/);
  await expect(page.locator('#plant')).toBeVisible();
  await expect(page.locator('#expandAll, #collapseAll')).toHaveCount(0);
});

test('area handles: scaled, hidden when dragged far up, and reset by double-click', async ({ page }) => {
  // the area of the response metrics and the simulation time: the handle scales the shown tab only
  const tinfo = '.hgrip[data-scale=tinfo]';
  await page.click('[data-itab=tsim]');
  await dragY(page, tinfo, 60);
  expect(await page.evaluate(() => [layout.ts! > 1, layout.ms])).toEqual([true, null]);
  await page.click('[data-itab=metrics]');
  await dragY(page, tinfo, 40);
  expect(await page.evaluate(() => layout.ms)).toBeGreaterThan(1);
  // dragged far up: the whole area is hidden, its tabs too
  await dragY(page, tinfo, -400);
  expect(await page.evaluate(() => isHidden('tinfo'))).toBe(true);
  await expect(page.locator('#tinfo .ptabs')).toBeHidden();
  await expect(page.locator('#metrics')).toBeHidden();
  await expect(page.locator(tinfo)).toHaveClass(/collapsed/);
  // still hidden after a reload; double-click shows it with both tabs at their original size
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  await expect(page.locator('#tinfo .ptabs')).toBeHidden();
  await page.dblclick(tinfo);
  expect(await page.evaluate(() => [layout.ts, layout.ms, isHidden('tinfo')])).toEqual([null, null, false]);
  await expect(page.locator('#tinfo .ptabs')).toBeVisible();
  // the area under the Bode plot: curve buttons (zoomed as a whole) and stability margins (their own scale)
  await showTab(page, 'bode');
  const binfo = '.hgrip[data-scale=binfo]';
  await dragY(page, binfo, 60);
  expect(await page.evaluate(() => [layout.zs.bodeopts! > 1, layout.msb])).toEqual([true, null]);
  await page.click('[data-itab=margins]');
  await dragY(page, binfo, 40);
  expect(await page.evaluate(() => layout.msb)).toBeGreaterThan(1);
  await dragY(page, binfo, -400);
  expect(await page.evaluate(() => isHidden('binfo'))).toBe(true);
  await expect(page.locator('#binfo .ptabs')).toBeHidden();
  await expect(page.locator('#tinfo .ptabs')).toBeVisible(); // the other areas stay
  await page.dblclick(binfo);
  expect(await page.evaluate(() => [layout.zs.bodeopts, layout.msb, isHidden('binfo')])).toEqual([
    undefined,
    null,
    false,
  ]);
  // formulas: double-click on the bottom edge of their panel resets the size
  await dragY(page, '#panel-tf .pgrip', 30);
  await page.dblclick('#panel-tf .pgrip');
  expect(await page.evaluate(() => layout.texFs)).toBeNull();
});

test('the change log opens and closes with the button, the backdrop and Escape', async ({ page }) => {
  const back = page.locator('#clBack');
  await page.click('#verBtn');
  await expect(back).toHaveClass(/open/);
  await page.click('#clClose');
  await expect(back).not.toHaveClass(/open/);
  await page.click('#verBtn');
  await back.click({ position: { x: 5, y: 5 } });
  await expect(back).not.toHaveClass(/open/);
  await page.click('#verBtn');
  await page.keyboard.press('Escape');
  await expect(back).not.toHaveClass(/open/);
});

test('hovering a pole shows its tooltip even without the root locus (regression in 1.46.10–1.46.12)', async ({
  page,
}) => {
  await showTab(page, 'pz');
  await page.uncheck('#pzLocus'); // no locus near the point: the tooltip must come from the pole itself
  const q = await page.evaluate(() => {
    const p = pzPts.find(q => q.p.k === 'pp')!;
    return { x: p.px, y: p.py, label: pzLabel(p.p) };
  });
  const b = await boxOf(page, '#cvPZ');
  await page.mouse.move(b.x + q.x, b.y + q.y);
  await expect(page.locator('#pzTip')).toHaveText(q.label);
});

test('the design region of the pole specifications is drawn on the pole-zero map', async ({ page }) => {
  await openCard(page, 'spec');
  await page.check('#spec-show');
  await page.check('#spec-zeta-on');
  await showTab(page, 'pz');
  expect(await page.evaluate(() => poleRegion())).not.toBeNull();
  // a point far left on the real axis is inside the region (ζ = 1), one near the imaginary axis is outside (shaded)
  const shade = await page.evaluate(() => {
    const cv = $('cvPZ'),
      g = ctx2d(cv),
      d = window.devicePixelRatio || 1,
      v = pzCurrentView(),
      px = (x: number, y: number) => {
        const W = cv.clientWidth - PZM.l - PZM.r,
          H = cv.clientHeight - PZM.t - PZM.b;
        return [PZM.l + W / 2 + (x - v.cx) * v.k, PZM.t + H / 2 - (y - v.cy) * v.k];
      };
    const at = (x: number, y: number) => {
      const [a, b] = px(x, y);
      return [...g.getImageData(Math.round(a * d), Math.round(b * d), 1, 1).data];
    };
    const span = (cv.clientHeight - PZM.t - PZM.b) / v.k / 2;
    return { outside: at(-0.05 * span, 0.8 * span + v.cy), inside: at(v.cx - 0.3 * span, v.cy + 0.02 * span) };
  });
  expect(shade.outside).not.toEqual(shade.inside);
});

test('every zoomable plot gets its zoom buttons and help from the table of plots', async ({ page }) => {
  const ids = await page.evaluate(() => PLOT_IDS);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) {
    await expect(page.locator(`.plot-tools[data-for=${id}] button`)).toHaveCount(4);
    expect(await page.getAttribute(`#${id}`, 'title')).toBe(await page.evaluate(() => T(ZOOM_HELP)));
  }
  await page.selectOption('#langSel', 'ja');
  await expect(page.locator('.plot-tools[data-for=cvY] [data-z=fit]')).toHaveText(await page.evaluate(() => T('Fit')));
});

test('the response metrics and the simulation time share one place, chosen with tabs', async ({ page }) => {
  const tab = (t: string) => page.locator(`[data-itab=${t}]`);
  // the response metrics first
  await expect(tab('metrics')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#metrics')).toBeVisible();
  await expect(page.locator('#TsimNum')).toBeHidden();
  const h0 = (await boxOf(page, '#panel-time')).height;
  await tab('tsim').click();
  await expect(page.locator('#TsimNum')).toBeVisible();
  await expect(page.locator('#metrics')).toBeHidden();
  expect((await boxOf(page, '#panel-time')).height).toBe(h0); // switching does not move what is below
  // remembered after a reload
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  await expect(tab('tsim')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#TsimNum')).toBeVisible();
  // arrow keys, Home and End move between the tabs
  await tab('tsim').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab('metrics')).toBeFocused();
  await expect(tab('metrics')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(tab('tsim')).toHaveAttribute('aria-selected', 'true');
  expect(
    await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#tinfo .ptab')].map(b => b.tabIndex)),
  ).toEqual([-1, 0]);
  // changing how the metrics are shown brings their tab forward
  await pickView(page, '#mview', 'table');
  await expect(tab('metrics')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#metrics .mtab')).toBeVisible();
  // the tab names are translated
  await page.selectOption('#langSel', 'ja');
  await expect(tab('metrics')).toHaveText('応答指標');
});

test('every area under a plot has its tabs; each tab shows its section, remembered per area', async ({ page }) => {
  await showAllPanels(page);
  const areas = await page.evaluate(() => Object.entries(INFO_AREAS).map(([a, d]) => [a, d.tabs.map(t => t[0])]));
  expect(areas.map(([a]) => a)).toEqual(['tinfo', 'binfo', 'ninfo', 'pinfo']);
  for (const [a, keys] of areas as [string, string[]][]) {
    await expect(page.locator(`#${a} .ptab`)).toHaveCount(keys.length);
    // the first tab is shown at first; the area keeps the height of its tallest section (except the long sections —
    // break frequencies, the Bode note, Nyquist criterion, root locus rules — which make it taller only while shown)
    await expect(page.locator(`#${a} .ptab`).first()).toHaveAttribute('aria-selected', 'true');
    const h = (await boxOf(page, `#${a}`)).height;
    for (const k of keys) {
      await page.click(`#${a} [data-itab=${k}]`);
      await expect(page.locator(`#${a} .tsec[data-sec=${k}]`)).toBeVisible();
      for (const o of keys.filter(o => o !== k)) await expect(page.locator(`#${a} .tsec[data-sec=${o}]`)).toBeHidden();
      if (['pzrules', 'nyqcrit', 'bodeasym', 'bodenote'].includes(k))
        expect((await boxOf(page, `#${a}`)).height).toBeGreaterThan(h);
      else expect((await boxOf(page, `#${a}`)).height).toBe(h);
    }
  }
  // the last tab of each area is remembered after a reload
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  expect(await page.evaluate(() => layout.itabs)).toEqual({
    tinfo: 'tsim',
    binfo: 'bodenote',
    ninfo: 'nyqnote',
    pinfo: 'pzhelp',
  });
  await expect(page.locator('#pinfo [data-itab=pzhelp]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#pzHelp')).toBeVisible();
  // the tab names are translated
  await page.selectOption('#langSel', 'ja');
  await expect(page.locator('#pinfo [data-itab=pztable]')).toHaveText('極の一覧');
});

test('the block diagram shows the saturation, the disturbance and the noise only while used, and gets shorter', async ({
  page,
}) => {
  const parts = () =>
    page.evaluate(() => ['sat', 'd', 'n'].map(k => !!document.querySelector(`#diagBox [data-part="${k}"]`)));
  const width = () => page.evaluate(() => document.querySelector<SVGSVGElement>('#diagBox svg')!.viewBox.baseVal.width);
  // none of them: the shortest drawing
  expect(await parts()).toEqual([false, false, false]);
  const w0 = await width();
  await openCard(page, 'sat');
  await page.check('#sat');
  expect(await parts()).toEqual([true, false, false]);
  const w1 = await width();
  await openCard(page, 'input');
  await page.check('#dOn');
  expect(await parts()).toEqual([true, true, false]);
  const w2 = await width();
  expect(w0).toBeLessThan(w1);
  expect(w1).toBeLessThan(w2);
  // the noise is in the feedback path: the width stays
  await page.fill('#v-noise', '0.05');
  await page.press('#v-noise', 'Enter');
  expect(await parts()).toEqual([true, true, true]);
  expect(await width()).toBe(w2);
  // the scale stays: a shorter drawing is narrower on the page
  const full = (await boxOf(page, '#diagBox svg')).width;
  await openCard(page, 'sat');
  await page.uncheck('#sat');
  await openCard(page, 'input');
  await page.uncheck('#dOn');
  expect((await boxOf(page, '#diagBox svg')).width).toBeLessThan(full * 0.85);
  // the labels are filled in after the drawing changes: 2-DOF form and dead time
  await openCard(page, 'ctrl');
  await page.check('#tdof');
  await expect(page.locator('#lbl-2dof')).toContainText('b = 1');
  await openCard(page, 'plant');
  await page.selectOption('#plant', 'dead');
  await expect(page.locator('#lbl-Pnote')).not.toBeEmpty();
});
