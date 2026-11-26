// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The panel "Steady-state error": the system type and error constants of L(s), and the steady-state errors to the
// reference and to a step disturbance beside the simulation, following the settings
import { test, expect, togglePanel } from './fixtures.ts';

test('Steady-state error: type, error constants and errors, following the settings', async ({ page }) => {
  await expect(page.locator('#panel-sse')).toBeHidden(); // not shown at first
  await togglePanel(page, 'sse');
  await expect(page.locator('#panel-sse')).toBeVisible();
  const box = page.locator('#sseBox');
  // integrating plant 1/(s(s+1)) with P control (KP = 3), ramp reference: type 1, Kv = 3, error 1/3
  await page.evaluate(() => {
    Object.assign(S, { plant: 'integ', K: 1, T: 1, mode: 'P', Kp: 3, refType: 'ramp', R: 1, Tsim: 40, dOn: false });
    buildPlant();
    update();
  });
  const consts = box.locator('table').first().locator('td.fc');
  await expect.poll(() => consts.allTextContents()).toEqual(['∞', '3', '0']);
  const want = await page.evaluate(() => T('Type {n}: L(s) has {n} pole(s) at the origin (integrators).', { n: 1 }));
  await expect(box).toContainText(want);
  // the ramp row is the current one: the error 1/3 from the theory and from the simulation
  const cur = box.locator('tr.cur');
  await expect(cur.locator('td').nth(1)).toContainText('0.3333');
  await expect(cur.locator('td').nth(2)).toContainText('0.333');
  await expect(box.locator('mjx-container').first()).toBeVisible(); // the formulas are typeset
  // PI control: type 2, no error to a ramp; with a step disturbance the error is 0
  await page.evaluate(() => {
    Object.assign(S, { mode: 'PI', Kp: 2, Ki: 0.5, dOn: true, d: 0.5, td: 20 });
    update();
  });
  await expect.poll(() => consts.allTextContents()).toEqual(['∞', '∞', '0.5']);
  await expect(box.locator('table').last().locator('td.fc')).toHaveText('0');
  // unstable closed loop: a warning in red
  await page.evaluate(() => {
    Object.assign(S, { plant: 'unstable', mode: 'P', Kp: 0.5, dOn: false });
    buildPlant();
    update();
  });
  await expect(box.locator('.verdict.bad')).toBeVisible();
});
