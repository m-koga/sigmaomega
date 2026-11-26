// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The panel "Routh–Hurwitz test": the characteristic equation, the Routh table with its verdict, and the stable range
// of the gain factor k (and of K_P with P control), the same as from the root locus
import { test, expect, togglePanel } from './fixtures.ts';

test('Routh–Hurwitz test: table, verdict and the stable range of k, following the settings', async ({ page }) => {
  await expect(page.locator('#panel-routh')).toBeHidden(); // not shown at first
  await togglePanel(page, 'routh');
  await expect(page.locator('#panel-routh')).toBeVisible();
  // third-order lag with P control, K_P = 2: s³ + 3s² + 3s + 3 = 0, stable; 0 < k < 4 (k = 1 now)
  await page.evaluate(() => {
    Object.assign(S, { plant: 'third', K: 1, T: 1, mode: 'P', Kp: 2 });
    buildPlant();
    update();
  });
  const box = page.locator('#routhBox');
  await expect(box.locator('.verdict.ok')).toBeVisible();
  // the table: rows s³ … s⁰, the first column 1, 3, 2, 3
  await expect
    .poll(() => box.locator('table').first().locator('td.fc').allTextContents())
    .toEqual(['1', '3', '2', '3']);
  const want = await page.evaluate(() => T('Every entry positive (stable): {r}', { r: '0 < k < 4' }));
  await expect(box).toContainText(want);
  await expect(box).toContainText('0 < KP < 8'); // K_P = 2k
  await expect(box.locator('mjx-container').first()).toBeVisible(); // the formulas are typeset
  // unstable: K_P = 9 → two sign changes, shown in red
  await page.evaluate(() => {
    S.Kp = 9;
    update();
  });
  await expect(box.locator('.verdict.bad')).toBeVisible();
  await expect(box.locator('table').first().locator('td.fc.neg')).toHaveCount(1);
});
