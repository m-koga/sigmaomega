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
  // drawn in its own color, visible beside the blue curve of L (counted in the pixels of the gain plot)
  const pixels = (id = 'cvG') =>
    page.evaluate(id => {
      const c = byId<HTMLCanvasElement>(id),
        d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data,
        [r, g, b] = [0xd8, 0x1b, 0x60];
      let n = 0;
      for (let i = 0; i < d.length; i += 4)
        if (Math.abs(d[i] - r) < 20 && Math.abs(d[i + 1] - g) < 20 && Math.abs(d[i + 2] - b) < 20) n++;
      return n;
    }, id);
  await expect.poll(() => pixels()).toBeGreaterThan(200);
  await expect.poll(() => pixels('cvPh')).toBeGreaterThan(200); // the phase approximation too
  // the button of the factors: a line for K/s^q and one for the pole, named in the legend
  await page.locator('label:has(#bodeAc)').click();
  await expect(page.locator('#bodeAc')).toBeChecked();
  // the expected names in the language of the page
  const [got, want] = await page.evaluate(() => [
    bodeAsymptote()!.parts.map(p => asymPartLabel(bodeAsymptote()!, p)),
    ['K = 2', `${T('pole')} -2`],
  ]);
  expect(got).toEqual(want);
  expect(await page.evaluate(() => viewOptions().bodeAc)).toBe(true);
  expect(await page.evaluate(() => viewOptions().bodeA)).toBe(true);
  // PI control adds an integrator and a zero: two break frequencies
  await page.evaluate(() => {
    Object.assign(S, { mode: 'PI', Kp: 2, Ki: 1 });
    update();
  });
  await expect(box.locator('tbody tr')).toHaveCount(2);
});
