// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Design aids on the page: specifications, auto-tuning, parameter sweep
import { test, expect, openCard } from './fixtures.ts';

test('design specifications: verdicts, and the limits drawn only when asked', async ({ page }) => {
  await openCard(page, 'spec');
  await expect(page.locator('#specSum')).toHaveClass(/ok|ng/);
  await expect(page.locator('#spec-show')).not.toBeChecked();
  await page.fill('#spec-ts', '1');
  await page.press('#spec-ts', 'Enter');
  await expect(page.locator('#specSum')).toHaveClass(/ng/);
  await expect(page.locator('#res-ts .sp.ng')).toBeVisible();
  await page.check('#spec-show');
  expect(await page.evaluate(() => S.spec.show)).toBe(true);
});

test('auto-tuning: a rule is computed and applied to the controller', async ({ page }) => {
  await page.selectOption('#plant', 'third');
  await openCard(page, 'tune');
  await page.selectOption('#tuneMethod', 'zn-ult');
  await expect(page.locator('#tuneOut')).toContainText('Ku');
  await page.click('#tuneApply');
  const s = await page.evaluate(() => [S.mode, S.Kp, S.Ki, S.Kd]);
  expect(s[0]).toBe('PID');
  expect(s[1]).toBeCloseTo(4.8, 2);
  await openCard(page, 'plant');
  await page.selectOption('#plant', 'first');
  await openCard(page, 'tune');
  await page.selectOption('#tuneMethod', 'zn-step');
  await expect(page.locator('#tuneApply')).toBeDisabled(); // no apparent dead time
});

test('parameter sweep: one row per value; clicking a row applies the value', async ({ page }) => {
  await openCard(page, 'sweep');
  await page.check('#sw-on');
  await page.fill('#sw-v', '1, 2, 5');
  await page.press('#sw-v', 'Enter');
  await expect(page.locator('#sw-table tbody tr')).toHaveCount(3);
  await page.locator('#sw-table tbody tr').nth(2).click();
  expect(await page.evaluate(() => S.Kp)).toBe(5);
  await expect(page.locator('#sw-table tbody tr').nth(2)).toHaveClass(/cur/);
});
