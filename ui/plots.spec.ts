// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Plots: selection and arrangement, Bode curve buttons, metrics, resizing areas, export
import fs from 'node:fs';
import { test, expect, dragY, boxOf, pickView, togglePanel, showAllPanels } from './fixtures.ts';

test('plots can be shown together and arranged', async ({ page }) => {
  await showAllPanels(page);
  for (const k of ['time', 'bode', 'nyq', 'pz']) await expect(page.locator(`#panel-${k}`)).toBeVisible();
  await pickView(page, '#pcols', '1');
  const a = await boxOf(page, '#panel-time'),
    b = await boxOf(page, '#panel-bode');
  expect(b.y).toBeGreaterThan(a.y + a.height - 1); // one column: one below the other
  await togglePanel(page, 'time');
  await expect(page.locator('#panel-time')).toBeHidden();
});

test('Bode curve buttons switch the curves and describe them', async ({ page }) => {
  await togglePanel(page, 'bode');
  await page.click('label.ctg:has(#bodeS)');
  expect(await page.evaluate(() => [$('bodeL').checked, $('bodeS').checked])).toEqual([true, true]);
  await expect(page.locator('#bodeDesc')).toContainText('S(jω)');
  await page.hover('label.ctg:has(#bodeD)');
  await expect(page.locator('#bodeDesc')).toContainText('Gyd');
  await page.click('label.ctg:has(#bodeS)');
  expect(await page.evaluate(() => $('bodeS').checked)).toBe(false);
});

test('metrics can be shown as a table, and the two metric areas resize independently', async ({ page }) => {
  await togglePanel(page, 'bode');
  await pickView(page, '#mview', 'table'); // shows the tabs of both metrics
  await expect(page.locator('#metrics .mtab')).toBeVisible();
  await expect(page.locator('#margins .mtab')).toBeVisible();
  await dragY(page, '.hgrip[data-scale=tinfo]', 40); // the handle of the area scales the shown tab
  const scale = (id: string) => page.evaluate(i => getComputedStyle(byId(i)).getPropertyValue('--ms').trim(), id);
  expect(Number(await scale('metrics'))).toBeGreaterThan(1.1);
  expect(Number(await scale('margins'))).toBe(1);
  await dragY(page, '.hgrip[data-scale=binfo]', -200);
  await expect(page.locator('#margins')).toBeHidden();
  await expect(page.locator('#metrics')).toBeVisible();
});

test('a resize handle hides an area and names it', async ({ page }) => {
  await dragY(page, '.hgrip[data-target=cvY]', -600);
  await expect(page.locator('#cvY')).toBeHidden();
  const g = page.locator('.hgrip[data-target=cvY]');
  await expect(g).toHaveAttribute('data-msg', /.+/);
  await g.dblclick();
  await expect(page.locator('#cvY')).toBeVisible();
});

test('CSV and PNG files are saved', async ({ page }) => {
  await showAllPanels(page);
  const files: Record<string, string> = {};
  for (const [sel, name] of [
    ['[data-csv=time]', 'time_response.csv'],
    ['[data-csv=bode]', 'frequency_response.csv'],
    ['[data-csv=nyq]', 'nyquist.csv'],
    ['[data-csv=pz]', 'poles_zeros.csv'],
  ]) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(sel)]);
    expect(dl.suggestedFilename()).toBe(name);
    files[name] = fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '');
  }
  expect(files['time_response.csv'].split('\r\n')[0]).toBe('t,r,y,u');
  expect(files['time_response.csv'].trim().split('\r\n').length).toBe(4002);
  await page.hover('#cvY');
  const [png] = await Promise.all([
    page.waitForEvent('download'),
    page.click('.plot-tools[data-for=cvY] [data-z=png]'),
  ]);
  expect(png.suggestedFilename()).toBe('output_y.png');
  expect(
    fs
      .readFileSync(await png.path())
      .subarray(1, 4)
      .toString(),
  ).toBe('PNG');
});

test('the buttons of every plot (also the pole-zero map) appear only with the pointer, the keyboard or a zoom', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1700, height: 1000 });
  await showAllPanels(page);
  const opacity = (sel: string) =>
    page.evaluate(s => Number(getComputedStyle(document.querySelector(s)!).opacity), sel);
  // nothing under the pointer: every bar of buttons is hidden
  await page.mouse.move(5, 5);
  for (const sel of ['.plot-tools[data-for=cvY]', '.plot-tools[data-for=cvG]', '.plot-tools[data-for=cvN]', '#pzTools'])
    await expect.poll(() => opacity(sel)).toBe(0);
  // the pointer over the pole-zero map: its buttons; away again: hidden
  await page.locator('#cvPZ').scrollIntoViewIfNeeded();
  await page.hover('#cvPZ');
  await expect.poll(() => opacity('#pzTools')).toBe(1);
  await page.mouse.move(5, 5);
  await expect.poll(() => opacity('#pzTools')).toBe(0);
  // the keyboard: shown while one of them has the focus (Tab from the button before)
  await page.focus('#pzIn');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await page.mouse.move(5, 5);
  await expect.poll(() => opacity('#pzTools')).toBe(1);
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.mouse.move(5, 5);
  await expect.poll(() => opacity('#pzTools')).toBe(0);
  // zoomed: they stay, so that "Fit" is at hand; after "Fit" hidden again
  await page.click('#pzIn', { force: true });
  await page.mouse.move(5, 5);
  await expect(page.locator('#pzTools')).toHaveClass(/zoomed/);
  await expect.poll(() => opacity('#pzTools')).toBe(1);
  await page.click('#pzFit');
  await page.mouse.move(5, 5);
  await expect(page.locator('#pzTools')).not.toHaveClass(/zoomed/);
  await expect.poll(() => opacity('#pzTools')).toBe(0); // although the clicked button keeps the focus
  // the same for the other plots: a click on "Fit" does not keep the buttons of the time response shown
  await page.locator('#cvY').scrollIntoViewIfNeeded();
  await page.hover('#cvY');
  await page.click('.plot-tools[data-for=cvY] [data-z=in]');
  await page.click('.plot-tools[data-for=cvY] [data-z=fit]');
  await page.mouse.move(5, 5);
  await expect.poll(() => opacity('.plot-tools[data-for=cvY]')).toBe(0);
});

test('the Bode plot names its curve also when only one is shown', async ({ page }) => {
  await togglePanel(page, 'bode');
  // record the names drawn in the legends of the gain and phase plots
  const legends = () =>
    page.evaluate(() => {
      const got: string[][] = [];
      const orig = drawLegend;
      drawLegend = (f, series) => {
        got.push(series.filter(s => s.name).map(s => s.name!));
        orig(f, series);
      };
      redraw();
      drawLegend = orig;
      return got;
    });
  // only L(jω) (the curve shown at first): named in both plots
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll<HTMLInputElement>('#bodeOpts input:checked')].map(i => i.id),
    ),
  ).toEqual(['bodeL']);
  const one = await legends();
  expect(one.filter(n => n.length === 1 && n[0] === 'L(jω)').length).toBeGreaterThanOrEqual(2);
  // only P(jω): its name
  await page.click('label.ctg:has(#bodeP)'); // the curve buttons under the plot
  await page.click('label.ctg:has(#bodeL)');
  expect(await page.evaluate(() => [$('bodeL').checked, $('bodeP').checked])).toEqual([false, true]);
  expect((await legends()).filter(n => n.length === 1 && n[0] === 'P(jω)').length).toBeGreaterThanOrEqual(2);
});

test('the frequency range of the Bode plot can be set by hand and returns to automatic when the poles change', async ({
  page,
}) => {
  await togglePanel(page, 'bode');
  const range = () =>
    page.evaluate(() => {
      const t = $('cvG')._tf!;
      return { lo: +t.xmin.toPrecision(4), hi: +t.xmax.toPrecision(4), on: S.wr.on, auto: !$('wrAuto').disabled };
    });
  const auto = await range();
  expect(auto.on).toBe(false);
  expect(auto.auto).toBe(false); // the Auto button does nothing while the range is automatic
  expect(await page.inputValue('#wrLo')).toBe(String(auto.lo));
  const margins = await page.innerHTML('#margins');
  await page.fill('#wrLo', '0.05');
  await page.fill('#wrHi', '500');
  await page.press('#wrHi', 'Enter');
  expect(await range()).toEqual({ lo: 0.05, hi: 500, on: true, auto: true });
  const txt = (en: string) => page.evaluate(e => T(e), en);
  await expect(page.locator('#wrState')).toHaveText(
    await txt('Set by hand (returns to automatic when the poles, zeros, dead time, or simulation time change)'),
  );
  expect(await page.innerHTML('#margins')).toBe(margins); // the margins are found in the automatic range
  // the gain moves no pole or zero: the range stays
  await page.evaluate(() => {
    S.K = 2;
    update();
  });
  expect((await range()).on).toBe(true);
  // a plant pole moves: back to the automatic range
  await page.evaluate(() => {
    S.T = 3;
    update();
  });
  const back = await range();
  expect(back.on).toBe(false);
  expect(back.auto).toBe(false);
  await expect(page.locator('#wrState')).toHaveText(await txt('Automatic'));
  // the simulation time also returns it to automatic; the Auto button does it at once
  await page.fill('#wrLo', '0.2');
  await page.press('#wrLo', 'Enter');
  expect(await range()).toMatchObject({ lo: 0.2, on: true });
  await page.evaluate(() => {
    S.Tsim = 50;
    update();
  });
  expect((await range()).on).toBe(false);
  await page.fill('#wrHi', '30');
  await page.press('#wrHi', 'Enter');
  expect((await range()).hi).toBe(30);
  await page.click('#wrAuto');
  expect((await range()).on).toBe(false);
  // a range that is not valid is not taken
  await page.fill('#wrHi', '0');
  await page.press('#wrHi', 'Enter');
  expect((await range()).on).toBe(false);
  expect(await page.inputValue('#wrHi')).not.toBe('0');
});

test('the block diagram zooms, pans, shows all and saves a PNG like the plots', async ({ page }) => {
  const tools = '.plot-tools[data-for=diagBox]';
  await expect(page.locator(`${tools} button`)).toHaveCount(4);
  const opacity = () => page.evaluate(s => Number(getComputedStyle(document.querySelector(s)!).opacity), tools);
  const view = () =>
    page.evaluate(() => ({
      vb: document.querySelector('#diagBox svg')!.getAttribute('viewBox')!.split(' ').map(Number),
      k: diagView.v?.k ?? 1,
    }));
  const whole = await view();
  const height = (await boxOf(page, '#diagBox')).height;
  // shown only while the pointer is over the diagram
  await page.mouse.move(5, 5);
  await expect.poll(opacity).toBe(0);
  await page.hover('#diagBox svg');
  await expect.poll(opacity).toBe(1);
  // ＋ twice: a smaller part of the drawing, in the same area; the buttons stay while zoomed
  await page.click(`${tools} [data-z=in]`);
  await page.click(`${tools} [data-z=in]`);
  const z = await view();
  expect(z.k).toBeCloseTo(1.96, 6);
  expect(z.vb[2]).toBeCloseTo(whole.vb[2] / 1.96, 3);
  expect((await boxOf(page, '#diagBox')).height).toBe(height);
  await page.mouse.move(5, 5);
  await expect(page.locator(tools)).toHaveClass(/zoomed/);
  await expect.poll(opacity).toBe(1);
  // a drag to the right shows the part on the left (as far as the left end of the drawing)
  const b = await boxOf(page, '#diagBox svg');
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 2000, b.y + b.height / 2, { steps: 4 });
  await page.mouse.up();
  expect((await view()).vb[0]).toBe(0);
  // the wheel zooms at the pointer; − back to the whole drawing
  await page.mouse.move(b.x + 10, b.y + 10);
  await page.mouse.wheel(0, -200);
  expect((await view()).k).toBeGreaterThan(1.96);
  for (let i = 0; i < 8; i++) await page.click(`${tools} [data-z=out]`);
  expect(await view()).toEqual(whole);
  await expect(page.locator(tools)).not.toHaveClass(/zoomed/);
  // a double-click and "Fit" show the whole drawing; so does a new drawing (another part of the loop)
  await page.click(`${tools} [data-z=in]`);
  await page.dblclick('#diagBox svg');
  expect(await view()).toEqual(whole);
  await page.click(`${tools} [data-z=in]`);
  await page.click(`${tools} [data-z=fit]`);
  expect(await view()).toEqual(whole);
  await page.click(`${tools} [data-z=in]`);
  await page.evaluate(() => {
    S.sat = true;
    update();
  });
  const sat = await view();
  expect(sat.k).toBe(1);
  expect(sat.vb[2]).toBeGreaterThan(whole.vb[2]);
  // PNG: what is shown, as block_diagram.png
  await page.hover('#diagBox svg');
  await page.click(`${tools} [data-z=in]`);
  const [png] = await Promise.all([page.waitForEvent('download'), page.click(`${tools} [data-z=png]`)]);
  expect(png.suggestedFilename()).toBe('block_diagram.png');
  const data = fs.readFileSync(await png.path());
  expect(data.subarray(1, 4).toString()).toBe('PNG');
  expect(data.readUInt32BE(16)).toBe(Math.round((await boxOf(page, '#diagBox svg')).width * 2));
});
