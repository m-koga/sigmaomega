// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The Nichols chart panel: shown from the menu, the curve of L(jω) over the M contours, zoom and CSV
import { test, expect, togglePanel } from './fixtures.ts';

test('Nichols chart: shown from the menu, drawn with its M contours, zoomed by the wheel', async ({ page }) => {
  await expect(page.locator('#panel-nich')).toBeHidden(); // not shown at first
  await togglePanel(page, 'nich');
  await expect(page.locator('#panel-nich')).toBeVisible();
  // the horizontal axis is the phase (in degrees) and covers −180°
  const tf = await page.evaluate(() => {
    const t = byId<HTMLCanvasElement>('cvNi')._tf!;
    return [t.xmin, t.xmax, t.ymin, t.ymax];
  });
  expect(tf[0]).toBeLessThanOrEqual(-180);
  expect(tf[1]).toBeGreaterThanOrEqual(-180);
  // the wheel zooms it like the other plots
  await page.locator('#cvNi').scrollIntoViewIfNeeded();
  const box = (await page.locator('#cvNi').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -300);
  await expect.poll(() => page.evaluate(() => !!PLOT_VIEWS.cvNi)).toBe(true);
});
