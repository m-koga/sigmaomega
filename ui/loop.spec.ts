// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The panels "Loop transfer functions" and "Poles": shown from the menu, the buttons choose the formulas or the
// transfer functions, the formulas follow the settings, and the bottom edge scales them (independently of the
// transfer functions panel); poles in the right half-plane are red
import { test, expect, dragY, boxOf, togglePanel } from './fixtures.ts';

const formulas = (page: import('@playwright/test').Page) => page.locator('#tex-loop mjx-container > svg');

test('loop transfer functions: shown from the menu, the buttons choose the formulas', async ({ page }) => {
  await expect(page.locator('#panel-loop')).toBeHidden(); // not shown at first
  await togglePanel(page, 'loop');
  await expect(page.locator('#panel-loop')).toBeVisible();
  // at first L(s) and Gyr(s)
  await expect(formulas(page)).toHaveCount(2);
  expect(
    await page.evaluate(() =>
      ['L', 'S', 'T', 'R', 'D'].map(k => (document.getElementById('loop' + k) as HTMLInputElement).checked),
    ),
  ).toEqual([true, false, false, true, false]);
  // add S(s), T(s), Gyd(s): five formulas, in the order of the buttons
  for (const k of ['S', 'T', 'D']) await page.click(`label.ctg:has(#loop${k})`);
  await expect(formulas(page)).toHaveCount(5);
  expect(
    await page.evaluate(() =>
      $('tex-loop')
        .dataset.tex!.split('\n')
        .map(l => l.match(/rlap\{(.*?)\}\\hphantom/)![1]),
    ),
  ).toEqual(['L(s)', 'S(s)', 'T(s)', 'G_{yr}(s)', 'G_{yd}(s)']);
  // none chosen: no formula, and a note says what to do
  for (const k of ['L', 'S', 'T', 'R', 'D']) await page.click(`label.ctg:has(#loop${k})`);
  await expect(formulas(page)).toHaveCount(0);
  const hint = await page.evaluate(() => T('Choose the transfer functions to show with the buttons above.'));
  await expect(page.locator('#loopNote')).toHaveText(hint);
});

test('loop transfer functions follow the settings; the dead time stays as e^{-Ls}', async ({ page }) => {
  await togglePanel(page, 'loop');
  await expect(formulas(page)).toHaveCount(2);
  await page.evaluate(() => {
    S.plant = 'dead';
    S.L = 0.5;
    buildPlant();
    update();
    scheduleFormulas();
  });
  await expect.poll(() => page.evaluate(() => $('tex-loop').dataset.tex)).toContain('e^{-0.5s}');
  await expect(formulas(page)).toHaveCount(2);
});

test('loop transfer functions: the bottom edge scales the formulas, kept apart from the transfer functions panel', async ({
  page,
}) => {
  await togglePanel(page, 'loop');
  await expect(formulas(page)).toHaveCount(2);
  const size = (id: 'tex-loop' | 'tex-P') => page.evaluate(i => parseFloat(getComputedStyle($(i)).fontSize), id);
  const [f0, p0] = [await size('tex-loop'), await size('tex-P')];
  const h0 = (await boxOf(page, '#panel-loop')).height;
  await dragY(page, '#panel-loop .pgrip', 60);
  expect((await boxOf(page, '#panel-loop')).height).toBeGreaterThan(h0 + 30);
  expect(await size('tex-loop')).toBeGreaterThan(f0);
  expect(await page.evaluate(() => layout.loopFs)).toBe(await size('tex-loop'));
  expect(await size('tex-P')).toBe(p0); // the other panel keeps its size
  await page.dblclick('#panel-loop .pgrip');
  expect(await size('tex-loop')).toBe(f0);
  expect(await page.evaluate(() => layout.loopFs)).toBeNull();
});

test('poles: shown from the menu, the buttons choose the transfer functions, poles in the right half-plane in red', async ({
  page,
}) => {
  await togglePanel(page, 'poles');
  await expect(page.locator('#panel-poles')).toBeVisible();
  const names = () => page.locator('#polesBox tr.grp td:first-child').evaluateAll(tds => tds.map(td => td.textContent));
  // at first P(s), C(s) and T(s)
  await expect.poll(names).toEqual(['P(s)', 'C(s)', 'T(s)']);
  await page.click('label.ctg:has(#polesC)');
  await page.click('label.ctg:has(#polesL)');
  await expect.poll(names).toEqual(['P(s)', 'L(s)', 'T(s)']);
  // the plant 1/(Ts − 1): its pole +1 in red
  await page.evaluate(() => {
    S.plant = 'unstable';
    buildPlant();
    update();
  });
  await expect(page.locator('#polesBox tr.grp').first().locator('td.uns')).toHaveText('1');
  // none chosen: an empty table and a hint
  for (const k of ['P', 'L', 'T']) await page.click(`label.ctg:has(#poles${k})`);
  await expect(page.locator('#polesBox table')).toHaveCount(0);
  const hint = await page.evaluate(() => T('Choose the transfer functions to show with the buttons above.'));
  await expect(page.locator('#polesNote')).toHaveText(hint);
});
