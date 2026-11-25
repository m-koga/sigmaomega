// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Interaction: zooming and panning plots, the pole-zero map, transfer function input, held responses,
// panel and formula sizes, simulation time, copying scenarios
import { test, expect, dragY, setup, boxOf, togglePanel, openCard } from './fixtures.ts';
import type { Page } from '@playwright/test';

// Point on a canvas in page coordinates (x, y in CSS pixels from the top left of the canvas)
async function at(page: Page, sel: string, x: number, y: number) {
  const b = await boxOf(page, sel);
  return { x: b.x + x, y: b.y + y };
}

test('time plots: wheel, drag, buttons and double-click change the view; the time axes stay linked', async ({
  page,
}) => {
  const view = () => page.evaluate(() => JSON.parse(JSON.stringify(PLOT_VIEWS)));
  const c = await at(page, '#cvY', 300, 150);
  await page.mouse.move(c.x, c.y);
  await page.mouse.wheel(0, -400);
  let v = await view();
  expect(v.cvY.x[1] - v.cvY.x[0]).toBeLessThan(20);
  expect(v.cvU.x).toEqual(v.cvY.x); // u(t) follows the time axis of y(t)
  const x0 = v.cvY.x[0];
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x - 120, c.y, { steps: 6 });
  await page.mouse.up();
  expect((await view()).cvY.x[0]).toBeGreaterThan(x0); // dragged to the left: later times
  await page.hover('#cvY');
  const w1 = (await view()).cvY.x;
  await page.click('.plot-tools[data-for=cvY] [data-z=out]');
  const w2 = (await view()).cvY.x;
  expect(w2[1] - w2[0]).toBeGreaterThan(w1[1] - w1[0]);
  await page.click('.plot-tools[data-for=cvY] [data-z=in]');
  await page.click('.plot-tools[data-for=cvY] [data-z=fit]');
  expect((await view()).cvY).toBeUndefined();
  await page.mouse.move(c.x, c.y);
  await page.mouse.wheel(0, -300);
  await page.dblclick('#cvY');
  expect((await view()).cvY).toBeUndefined();
});

test('Bode plot: Shift + wheel zooms the frequency axis only, shared by gain and phase', async ({ page }) => {
  await togglePanel(page, 'bode');
  await togglePanel(page, 'time');
  const c = await at(page, '#cvG', 250, 100);
  await page.mouse.move(c.x, c.y);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, -300);
  await page.keyboard.up('Shift');
  const v = await page.evaluate(() => JSON.parse(JSON.stringify(PLOT_VIEWS)));
  expect(v.cvG.x).toBeTruthy();
  expect(v.cvG.y).toBeUndefined();
  expect(v.cvPh.x).toEqual(v.cvG.x);
});

test('pole-zero map: tooltip on a pole, zoom and pan, and clicking the root locus applies its gain', async ({
  page,
}) => {
  await togglePanel(page, 'pz');
  await togglePanel(page, 'time');
  // tooltip of a closed-loop pole
  const p = await page.evaluate(() => {
    const q = pzPts.find(q => q.p.k === 'cl')!;
    return { x: q.px, y: q.py };
  });
  const pp = await at(page, '#cvPZ', p.x, p.y);
  await page.mouse.move(pp.x, pp.y);
  await expect(page.locator('#pzTip')).toBeVisible();
  // buttons, wheel, drag and double-click
  await page.evaluate(() => ((pzView = null), drawPZ(lastPZ))); // start from the automatic view
  await page.click('#pzIn');
  const k1 = await page.evaluate(() => pzView!.k);
  await page.click('#pzOut');
  await page.click('#pzOut');
  expect(await page.evaluate(() => pzView!.k)).toBeLessThan(k1);
  const c = await at(page, '#cvPZ', 200, 150);
  await page.mouse.move(c.x, c.y);
  await page.mouse.wheel(0, -300);
  expect(await page.evaluate(() => pzView!.k)).toBeGreaterThan(k1 / 1.4 / 1.4);
  const cx = await page.evaluate(() => pzView!.cx);
  await page.mouse.down();
  await page.mouse.move(c.x + 80, c.y, { steps: 5 });
  await page.mouse.up();
  expect(await page.evaluate(() => pzView!.cx)).toBeLessThan(cx);
  await page.dblclick('#cvPZ');
  await page.click('#pzFit');
  // click on the root locus at a point with k well away from 1 (and away from the poles and zeros)
  const q = await page.evaluate(() => {
    const far = (q: { px: number; py: number }) => pzPts.every(r => Math.hypot(r.px - q.px, r.py - q.py) > 14);
    const c = pzLocusPts.filter(q => q.k > 2 && q.k < 20 && far(q));
    return c.length ? { x: c[0].px, y: c[0].py, k: c[0].k } : null;
  });
  if (!q) throw new Error('no point of the root locus to click');
  const kp0 = await page.evaluate(() => S.Kp);
  const lp = await at(page, '#cvPZ', q.x, q.y);
  await page.mouse.move(lp.x, lp.y);
  await page.mouse.down();
  await page.mouse.up();
  expect(await page.evaluate(() => S.Kp)).toBeCloseTo(kp0 * q.k, 2);
});

test('plant entered as a transfer function: valid input, an error, and an example', async ({ page }) => {
  await page.selectOption('#plant', 'custom');
  await page.fill('#cNum', '2');
  await page.fill('#cDen', '(s+1)(0.5s+1)');
  await page.press('#cDen', 'Enter');
  await expect.poll(() => page.evaluate(() => JSON.stringify(S.cDen))).toBe('[0.5,1.5,1]');
  await page.fill('#cDen', 's+');
  await page.press('#cDen', 'Enter');
  await expect(page.locator('#cErr')).not.toBeEmpty();
  await expect(page.locator('#cDen')).toHaveClass(/bad/);
  await page.click('[data-sub=p-ex] .sub-h'); // the examples are folded by default
  await page.locator('[data-ex]').first().click();
  await expect(page.locator('#cErr')).toBeEmpty();
});

test('controller entered as a transfer function: loaded from PID, valid input and an error', async ({ page }) => {
  await openCard(page, 'ctrl');
  await page.selectOption('#mode', 'custom');
  await page.click('[data-sub=c-ex] .sub-h'); // the examples are folded by default
  await page.click('#ccFromPID');
  const n = await page.inputValue('#ccNum');
  expect(n).toMatch(/\d/); // the current PID written as a transfer function
  await page.fill('#ccNum', '3(s+1)');
  await page.fill('#ccDen', 's');
  await page.press('#ccDen', 'Enter');
  await expect.poll(() => page.evaluate(() => JSON.stringify(S.ccNum))).toBe('[3,3]');
  await page.fill('#ccNum', 's^3');
  await page.press('#ccNum', 'Enter'); // improper
  await expect(page.locator('#ccErr')).not.toBeEmpty();
  await page.locator('[data-cex]').first().click();
  await expect(page.locator('#ccErr')).toBeEmpty();
});

test('held responses are drawn for comparison and can be cleared', async ({ page }) => {
  await openCard(page, 'compare');
  await page.click('#hold');
  await openCard(page, 'ctrl');
  await page.fill('#v-Kp', '5');
  await page.press('#v-Kp', 'Enter');
  await openCard(page, 'compare');
  await page.click('#hold');
  expect(await page.evaluate(() => ghosts.length)).toBe(2);
  await expect(page.locator('#ghostInfo')).toContainText('2');
  await page.click('#clearHold');
  expect(await page.evaluate(() => ghosts.length)).toBe(0);
});

test('the panel border, the formula size and the simulation time can be changed', async ({ page }) => {
  const b = await boxOf(page, '#vsplit');
  await page.mouse.move(b.x + b.width / 2, b.y + 200);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 80, b.y + 200, { steps: 6 });
  await page.mouse.up();
  expect(await page.evaluate(() => layout.sideW)).toBeGreaterThan(340);
  await page.dblclick('#vsplit');
  expect(await page.evaluate(() => layout.sideW)).toBeNull();
  await dragY(page, '#panel-tf .pgrip', 40); // the bottom edge of the transfer functions panel
  expect(await page.evaluate(() => layout.texFs)).toBeGreaterThan(0);
  await page.click('[data-itab=tsim]'); // in the tab next to the response metrics
  await page.locator('#Tsim').fill('2'); // log scale: 10^2 s
  expect(await page.evaluate(() => S.Tsim)).toBe(100);
  await page.fill('#TsimNum', '7');
  await page.press('#TsimNum', 'Enter');
  expect(await page.evaluate(() => S.Tsim)).toBe(7);
});

test('scenarios: copied as text and as a link (which opens the scenario), and deleted with two clicks', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.selectOption('#plant', 'third');
  await openCard(page, 'scen');
  await page.fill('#sc-name', 'copy test');
  await page.click('#sc-copy');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(JSON.parse(text).S.plant).toBe('third');
  await page.click('#sc-link');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain('#s=');
  const p2 = await context.newPage();
  await setup(p2);
  await p2.goto(link);
  await expect.poll(() => p2.evaluate(() => typeof S === 'object' && S.plant)).toBe('third');
  await p2.close();
  await page.click('#sc-save');
  await expect(page.locator('[data-sc-del]')).toHaveCount(1);
  await page.click('[data-sc-del="0"]');
  await expect(page.locator('[data-sc-del="0"]')).toHaveClass(/arm/); // first click asks
  await page.click('[data-sc-del="0"]');
  await expect(page.locator('[data-sc-del]')).toHaveCount(0);
});

test('analysis inputs: specification check boxes, tuning type and λ, sweep parameter', async ({ page }) => {
  await openCard(page, 'spec');
  await page.check('#spec-zeta-on');
  expect(await page.evaluate(() => S.spec.zeta.on)).toBe(true);
  await openCard(page, 'tune');
  await page.selectOption('#tuneMethod', 'imc');
  await page.selectOption('#tuneType', 'PI');
  await page.fill('#tuneLam', '0.7');
  await page.press('#tuneLam', 'Enter');
  expect(await page.evaluate(() => [S.tune.type, S.tune.lam])).toEqual(['PI', 0.7]);
  await expect(page.locator('#tuneOut')).toContainText('0.7');
  await openCard(page, 'sweep');
  await page.check('#sw-on');
  await page.selectOption('#sw-p', 'Ki');
  expect(await page.evaluate(() => S.sweep.p)).toBe('Ki');
  await page.fill('#sw-v', '9');
  await page.press('#sw-v', 'Enter');
  await page.click('#sw-def');
  expect(await page.evaluate(() => S.sweep.vals.length)).toBeGreaterThan(1);
});

test('P control starts with the proportional gain 1; a gain changed by hand is kept when switching', async ({
  page,
}) => {
  await openCard(page, 'ctrl');
  await page.selectOption('#mode', 'P');
  expect(await page.evaluate(() => S.Kp)).toBe(1);
  expect(parseFloat(await page.inputValue('#v-Kp'))).toBe(1);
  await page.selectOption('#mode', 'PID');
  expect(await page.evaluate(() => S.Kp)).toBe(2);
  await page.fill('#v-Kp', '4');
  await page.press('#v-Kp', 'Enter');
  await page.selectOption('#mode', 'P');
  expect(await page.evaluate(() => S.Kp)).toBe(4);
});
