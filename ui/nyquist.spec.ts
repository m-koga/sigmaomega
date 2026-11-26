// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The tab "Nyquist criterion" under the Nyquist plot and the marks of the crossings of the real axis to the left of
// −1, following the settings
import { test, expect, togglePanel } from './fixtures.ts';

test('Nyquist criterion: P, N and Z with the crossings, following the settings', async ({ page }) => {
  await togglePanel(page, 'nyq');
  await expect(page.locator('#nyqCount')).not.toBeChecked(); // the marks are off at first
  await page.click('#ninfo [data-itab=nyqcrit]');
  const box = page.locator('#nyqCrit');
  // 1/(s+1)³ with K_P = 12: two clockwise crossings at −1.5, N = 2, Z = 2 (unstable)
  await page.evaluate(() => {
    Object.assign(S, { plant: 'third', K: 1, T: 1, mode: 'P', Kp: 12 });
    buildPlant();
    update();
  });
  await expect(box.locator('.verdict.bad')).toBeVisible();
  await expect(box.locator('table').first().locator('tr td:last-child')).toHaveText(['0', '2', '2']);
  await expect(box.locator('table').last()).toContainText('Re L = -1.5');
  // unstable plant with K_P = 2: P = 1, N = −1, Z = 0 (stable)
  await page.evaluate(() => {
    Object.assign(S, { plant: 'unstable', Kp: 2 });
    buildPlant();
    update();
  });
  await expect(box.locator('.verdict.ok')).toBeVisible();
  await expect(box.locator('table').first().locator('tr td:last-child')).toHaveText(['1 (s = 1)', '-1', '0']);
  // the option draws the marks; it is kept in a saved scenario's view options
  await page.click('#ninfo [data-itab=nyqopts]');
  await page.check('#nyqCount');
  expect(await page.evaluate(() => viewOptions().nyqCount)).toBe(true);
});
