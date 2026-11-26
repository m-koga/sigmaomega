// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Construction rules of the root locus: the option of the pole-zero map draws them, and the tab "Locus rules" lists
// them with their values, following the settings
import { test, expect, togglePanel } from './fixtures.ts';

test('root locus rules: drawn on the map when chosen, listed in their tab, following the settings', async ({
  page,
}) => {
  await togglePanel(page, 'pz');
  await expect(page.locator('#pzRules')).not.toBeChecked(); // off at first
  // 1/(s+1)³ with P control: asymptotes at ±60° and 180° from −1, crossing at ±j1.732 for k = 8
  await page.evaluate(() => {
    Object.assign(S, { plant: 'third', K: 1, T: 1, mode: 'P', Kp: 1 });
    buildPlant();
    update();
  });
  await page.click('#pinfo [data-itab=pzrules]');
  const box = page.locator('#pzRulesBox');
  await expect(box).toContainText('θ = 60°, 180°, -60°; σ = -1');
  await expect(box).toContainText('s = ±j1.732 (k = 8)');
  await expect(box).toContainText('-1 (×3): -60°, 60°, 180°');
  // the option adds the rules to the legend of the map
  const legend = () => page.evaluate(() => pzLegendKeys);
  expect(await legend()).not.toContain('as');
  await page.click('#pinfo [data-itab=pzopts]');
  await page.check('#pzRules');
  expect(await legend()).toEqual(expect.arrayContaining(['ra', 'as', 'ix', 'an']));
  // 1/(s(s+1)): a breakaway point at −0.5 for k = 0.25
  await page.evaluate(() => {
    Object.assign(S, { plant: 'integ' });
    buildPlant();
    update();
  });
  expect(await legend()).toContain('ba');
  await page.click('#pinfo [data-itab=pzrules]');
  await expect(box).toContainText('-0.5 (k = 0.25');
  // the choice is kept in a saved scenario's view options
  expect(await page.evaluate(() => viewOptions().pzRules)).toBe(true);
});
