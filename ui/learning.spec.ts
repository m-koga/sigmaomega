// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Aids to learning: dragging a pole of the plant on the pole-zero map, the second-order approximation and the
// modes under the time response, the lead design on the root locus, following the Nyquist contour, and the plants
// that are physical models
import { test, expect, boxOf, togglePanel, openCard } from './fixtures.ts';
import type { Page } from '@playwright/test';

const showTab = async (page: Page, k: string) => {
  if (!(await page.locator(`#panel-${k}`).isVisible())) await togglePanel(page, k);
};

test('dragging a pole of the plant on the pole-zero map moves it: the plant becomes a transfer function', async ({
  page,
}) => {
  await showTab(page, 'pz');
  await page.locator('#cvPZ').scrollIntoViewIfNeeded();
  const q = await page.evaluate(() => {
    drawPZ(lastPZ); // the points as drawn now, in the panel's present size
    const p = pzPts.find(q => q.p.k === 'pp')!;
    return { x: p.px, y: p.py, k: pzCurrentView().k };
  });
  const b = await boxOf(page, '#cvPZ');
  await page.mouse.move(b.x + q.x, b.y + q.y);
  await expect(page.locator('#pzTip')).toContainText(await page.evaluate(() => T('(drag to move it)')));
  await page.mouse.down();
  // 2 units to the left (and a little up: a real pole stays on the real axis)
  for (let i = 1; i <= 8; i++) await page.mouse.move(b.x + q.x - (2 * q.k * i) / 8, b.y + q.y - i);
  await page.mouse.up();
  expect(await page.evaluate(() => [S.plant, S.cDenStr, S.cNumStr, S.L])).toEqual(['custom', '(s+3)', '3', 0]);
  await expect(page.locator('#cDen')).toHaveValue('(s+3)');
  // the closed loop follows
  expect(await page.evaluate(() => lastPZ!.cl.every(z => z[0] < 0))).toBe(true);
});

test('second-order approximation and modes under the time response, with their curves', async ({ page }) => {
  await page.evaluate(() => {
    Object.assign(S, { plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 2 });
    buildPlant();
    buildCtrlCustom();
    update();
  });
  // the names of the extra curves drawn on the time response
  const series = () => page.evaluate(() => [...so2Series(lastSim!), ...modeSeries(lastSim!)].map(c => c.name ?? ''));
  await page.click('#itab-so2');
  await expect(page.locator('#so2Box')).toContainText('ζ = 0.3536');
  await expect(page.locator('#so2Box tbody tr')).toHaveCount(4);
  await page.check('#timeSO2');
  expect(await series()).toContain(await page.evaluate(() => T('Second-order approximation')));
  await page.click('#itab-modes');
  await expect(page.locator('#modesBox tbody tr')).toHaveCount(2); // the step (forced) and the closed-loop pair
  await expect(page.locator('#modesBox')).toContainText(
    await page.evaluate(() =>
      T('Largest difference between the sum of the terms and the simulated y(t): {d}', { d: '' }),
    ),
  );
  await page.check('#timeModes');
  expect(await series()).toHaveLength(3); // the approximation, and the term of each pole
});

test('lead design on the root locus: the steps, the closed-loop poles and Apply', async ({ page }) => {
  await page.evaluate(() => {
    Object.assign(S, { plant: 'integ', K: 2, T: 0.5, mode: 'P' });
    buildPlant();
    buildCtrlCustom();
    update();
  });
  await openCard(page, 'comp');
  await page.selectOption('#compMethod', 'rlead');
  await expect(page.locator('#compPm')).toBeHidden();
  await expect(page.locator('#compZeta')).toBeVisible();
  await page.fill('#compWn', '4');
  await page.press('#compWn', 'Enter');
  await expect(page.locator('#compOut li')).toHaveCount(5);
  await expect(page.locator('#compOut')).toContainText('-5.464');
  await expect(page.locator('#compOut .err')).toHaveCount(0); // s_d is dominant; no target phase margin
  await page.click('#compApply');
  expect(
    await page.evaluate(() => [
      S.mode,
      lastPZ!.cl.some(z => Math.abs(z[0] + 2) < 1e-3 && Math.abs(Math.abs(z[1]) - 2 * Math.sqrt(3)) < 1e-3),
    ]),
  ).toEqual(['lead', true]);
});

test('following the Nyquist contour: the slider moves the point, play goes round, N at the end', async ({ page }) => {
  await page.evaluate(() => {
    Object.assign(S, { plant: 'third', mode: 'P', Kp: 10 });
    buildPlant();
    buildCtrlCustom();
    update();
  });
  await showTab(page, 'nyq');
  await page.click('#itab-nyqmap');
  await page.locator('#nyqMapPos').fill('500');
  await expect(page.locator('#nyqMapRead')).toContainText('L(s) =');
  expect(await page.evaluate(() => nyqMapAt)).not.toBeNull();
  await page.locator('#nyqMapPos').fill('1000');
  await expect(page.locator('#nyqMapRead')).toContainText('N = 2, P = 0, Z = N + P = 2');
  await page.click('#nyqMapPlay'); // from the start again
  await expect(page.locator('#nyqMapPlay')).toHaveText(await page.evaluate(() => T('■ Stop')));
  await page.click('#nyqMapPlay');
  await expect(page.locator('#nyqMapPlay')).toHaveText(await page.evaluate(() => T('▶ Play')));
  // another tab: no mark on the plot
  await page.click('#itab-nyqcrit');
  expect(await page.evaluate(() => nyqMapAt)).toBeNull();
});

test('physical models: the model with its equations above its parameters, which set the transfer function', async ({
  page,
}) => {
  await openCard(page, 'plant');
  await page.selectOption('#plant', 'msd');
  await expect(page.locator('#plant-params .plant-model')).toBeVisible();
  await expect(page.locator('#plant-params .plant-fig svg')).toBeVisible(); // the figure of the model
  expect(await page.locator('#plant-params .plant-fig svg').getAttribute('aria-label')).toBe(
    await page.evaluate(() => T(PLANTS.msd.name)),
  );
  await expect(page.locator('#in-mass')).toBeVisible();
  await page.fill('#v-mass', '4');
  await page.press('#v-mass', 'Enter');
  expect(await page.evaluate(() => [S.mass, PLANTS[S.plant].tf(S).den])).toEqual([4, [4, 1, 2]]);
  // a preset without a model has no description
  await page.selectOption('#plant', 'first');
  await expect(page.locator('#plant-params .plant-model')).toHaveCount(0);
  await expect(page.locator('#plant-params .plant-fig')).toHaveCount(0);
  await page.selectOption('#plant', 'motorA');
  expect(await page.evaluate(() => PLANTS[S.plant].tf(S).den.at(-1))).toBe(0); // the integrator of the angle
});
