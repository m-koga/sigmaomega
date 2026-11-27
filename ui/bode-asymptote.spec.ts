// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The straight-line approximation of the Bode gain of L(jω) and the tab "Break frequencies"
import { test, expect, togglePanel } from './fixtures.ts';

test('Bode asymptotes: the curve button and the table of break frequencies, following the settings', async ({
  page,
}) => {
  await togglePanel(page, 'bode');
  await expect(page.locator('#bodeA')).not.toBeChecked(); // off at first
  await page.evaluate(() => {
    Object.assign(S, { plant: 'first', K: 1, T: 0.5, mode: 'P', Kp: 2 });
    buildPlant();
    update();
  });
  await page.click('#binfo [data-itab=bodeasym]');
  const box = page.locator('#bodeAsym');
  await expect(box).toContainText('|L(jω)| ≈ 2 (6.021 dB)');
  await expect(box.locator('tbody tr')).toHaveCount(1);
  await expect(box.locator('tbody tr td').nth(4)).toHaveText('-3.01 dB');
  // the button adds the asymptotes to the gain plot and its legend
  await page.click('#binfo [data-itab=bodeopts]');
  await page.locator('label:has(#bodeA)').click();
  await expect(page.locator('#bodeA')).toBeChecked();
  expect(await page.evaluate(() => viewOptions().bodeA)).toBe(true);
  // PI control adds an integrator and a zero: two break frequencies
  await page.evaluate(() => {
    Object.assign(S, { mode: 'PI', Kp: 2, Ki: 1 });
    update();
  });
  await expect(box.locator('tbody tr')).toHaveCount(2);
});
