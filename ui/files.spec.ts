// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Saving and loading scenarios (browser storage, files, layout) and the example exercises
import fs from 'node:fs';
import { test, expect, pickView, togglePanel, openCard } from './fixtures.ts';

test('an example exercise loads its settings and shows its task', async ({ page }) => {
  await openCard(page, 'scen');
  await page.click('[data-sc-ex="0"]');
  expect(await page.evaluate(() => [S.plant, S.mode])).toEqual(['third', 'PID']);
  await expect(page.locator('#taskBanner')).toBeVisible();
  await openCard(page, 'compare');
  await page.click('#reset');
  await expect(page.locator('#taskBanner')).toBeHidden();
});

test('a scenario saved with its layout restores both', async ({ page }) => {
  await page.selectOption('#plant', 'second');
  await togglePanel(page, 'bode');
  await pickView(page, '#mview', 'table');
  await page.click('#binfo [data-itab=bodeopts]'); // the curve buttons are in their tab
  await page.click('label.ctg:has(#bodeS)');
  await openCard(page, 'scen');
  await page.fill('#sc-name', 'with layout');
  await page.click('#sc-save');
  await expect(page.locator('#sc-list .sc-tag')).toHaveCount(1);

  await openCard(page, 'compare');
  await page.click('#reset');
  await page.evaluate(() => resetLayout());
  await page.evaluate(() => {
    shownPanels = new Set(['time']);
    panelsChanged();
    $('bodeS').checked = false;
    layout.mview = 'cards';
  });
  await openCard(page, 'scen');
  await page.click('[data-sc-load="0"]');
  expect(await page.evaluate(() => [S.plant, shownPanels.has('bode'), layout.mview, $('bodeS').checked])).toEqual([
    'second',
    true,
    'table',
    true,
  ]);

  // without applying the layout
  await page.evaluate(() => {
    shownPanels = new Set(['time']);
    panelsChanged();
  });
  await openCard(page, 'scen');
  await page.uncheck('#sc-useLayout');
  await page.click('[data-sc-load="0"]');
  expect(await page.evaluate(() => shownPanels.has('bode'))).toBe(false);
});

test('a scenario file is written and read back', async ({ page }) => {
  await page.selectOption('#plant', 'dead');
  await openCard(page, 'scen');
  // (an ASCII name: a page opened as a local file may not pass non-ASCII download names to the browser;
  //  the file-name rules themselves are covered by the unit tests)
  await page.fill('#sc-name', 'Exercise: dead time');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sc-export')]);
  expect(dl.suggestedFilename()).toBe('Exercise_ dead time.json');
  const file = await dl.path();
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).S.plant).toBe('dead');

  await openCard(page, 'compare');
  await page.click('#reset');
  await openCard(page, 'scen');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sc-import')]);
  await chooser.setFiles(file);
  await expect.poll(() => page.evaluate(() => S.plant)).toBe('dead');
  await expect(page.locator('#sc-msg')).not.toHaveClass(/err/);
});

test('a broken scenario text is rejected without changing the settings', async ({ page }) => {
  await openCard(page, 'scen');
  await page.fill('#sc-text', 'not a scenario');
  await page.click('#sc-load');
  await expect(page.locator('#sc-msg')).toHaveClass(/err/);
  expect(await page.evaluate(() => S.plant)).toBe('first');
});
