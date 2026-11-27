// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Layout "Rows": each row with its own number of panels side by side (one, two, three, ...)
import { test, expect, boxOf, pickView, showAllPanels, togglePanel } from './fixtures.ts';
import type { Page } from '@playwright/test';

// The shown panels row by row (rows of hidden panels only are left out)
const rows = (page: Page) =>
  page.evaluate(() => layout.rows?.rows.map(r => r.panels.filter(k => shownPanels.has(k))).filter(r => r.length));
// The tops of the shown panels, rounded: panels in one row share their top
const tops = (page: Page, ks: string[]) =>
  Promise.all(ks.map(async k => Math.round((await boxOf(page, `#panel-${k}`)).y)));
// Rows with every panel shown but the loop transfer functions, the poles, the Routh–Hurwitz test, the steady-state
// error and the Nichols chart (hidden at first, they go to the rows at the bottom)
const start = async (page: Page) => {
  await page.setViewportSize({ width: 1700, height: 1000 });
  await pickView(page, '#pcols', 'rows');
  await showAllPanels(page);
  await togglePanel(page, 'loop');
  await togglePanel(page, 'poles');
  await togglePanel(page, 'routh');
  await togglePanel(page, 'sse');
  await togglePanel(page, 'nich');
};

test('rows: one, two and three panels side by side, kept after a reload', async ({ page }) => {
  await start(page);
  // from the panels shown at first: the block diagram alone, the time response beside the transfer functions, and
  // the other plots (hidden at first) together in a third row
  expect(await rows(page)).toEqual([['diag'], ['time', 'tf'], ['bode', 'nyq', 'pz']]);
  const [d, t, f, b, n, p] = await Promise.all(
    ['diag', 'time', 'tf', 'bode', 'nyq', 'pz'].map(k => boxOf(page, `#panel-${k}`)),
  );
  // widths: the whole row, half of it, a third of it
  expect(Math.abs(t.width + f.width + 12 - d.width)).toBeLessThan(3);
  expect(Math.abs(b.width - n.width)).toBeLessThan(2);
  expect(Math.abs(b.width * 3 + 24 - d.width)).toBeLessThan(3);
  // each row below the previous one, its panels level
  const [yt, yf, yb, yn, yp] = await tops(page, ['time', 'tf', 'bode', 'nyq', 'pz']);
  expect(yt).toBe(yf);
  expect(yb).toBe(yn);
  expect(yn).toBe(yp);
  expect(yt).toBeGreaterThan(d.y + d.height);
  expect(yb).toBeGreaterThan(Math.max(t.y + t.height, f.y + f.height));
  expect(p.x).toBeGreaterThan(n.x);
  // the panels of a row are as tall as the tallest: the transfer functions as the time response
  expect(Math.abs(f.height - t.height)).toBeLessThan(1);
  expect(Math.abs(b.height - n.height)).toBeLessThan(1);
  expect(Math.abs(p.height - n.height)).toBeLessThan(1);
  // ...and follow it: a taller transfer functions panel makes the time response panel as tall; the handle at the
  // bottom edge stays at the bottom of each
  await page.evaluate(() => {
    layout.texFs = 40;
    fitTex();
  });
  const [t2, f2] = [await boxOf(page, '#panel-time'), await boxOf(page, '#panel-tf')];
  expect(Math.abs(t2.height - f2.height)).toBeLessThan(1);
  for (const k of ['time', 'tf']) {
    const [pb, gb] = [await boxOf(page, `#panel-${k}`), await boxOf(page, `#panel-${k} .pgrip`)];
    expect(Math.abs(pb.y + pb.height - (gb.y + gb.height))).toBeLessThan(12);
  }
  await page.evaluate(() => {
    layout.texFs = null;
    fitTex();
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  expect(await rows(page)).toEqual([['diag'], ['time', 'tf'], ['bode', 'nyq', 'pz']]);
  await expect(page.locator('#pcols')).toHaveValue('rows');
});

test('rows: dragging a panel into another row, into a new row, and the arrow keys', async ({ page }) => {
  await start(page);
  const drag = async (k: string, x: number, y: number) => {
    const h = await boxOf(page, `#panel-${k} h2`);
    await page.mouse.move(h.x + 20, h.y + 8);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 10 });
    await expect(page.locator('#panelDrop')).toBeVisible(); // the line that shows where it goes
    await page.mouse.up();
  };
  // the block diagram into the row of the time response, on its left: a row of three
  const t = await boxOf(page, '#panel-time');
  await drag('diag', t.x + 40, t.y + 120);
  expect(await rows(page)).toEqual([
    ['diag', 'time', 'tf'],
    ['bode', 'nyq', 'pz'],
  ]);
  const [yd, yt] = await tops(page, ['diag', 'time']);
  expect(yd).toBe(yt);
  // the pole-zero map near the top edge of the first row: a new row above it
  const d = await boxOf(page, '#panel-diag');
  await drag('pz', d.x + d.width / 2, d.y + 6);
  expect(await rows(page)).toEqual([['pz'], ['diag', 'time', 'tf'], ['bode', 'nyq']]);
  // Escape while dragging changes nothing
  const h = await boxOf(page, '#panel-nyq h2');
  await page.mouse.move(h.x + 20, h.y + 8);
  await page.mouse.down();
  await page.mouse.move(d.x + 20, d.y + 100, { steps: 6 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(await rows(page)).toEqual([['pz'], ['diag', 'time', 'tf'], ['bode', 'nyq']]);
  // arrow keys on the handle: down into the next row at the same place (the first), right within it
  await page.focus('#panel-pz .pmove');
  await page.keyboard.press('ArrowDown');
  expect(await rows(page)).toEqual([
    ['pz', 'diag', 'time', 'tf'],
    ['bode', 'nyq'],
  ]);
  await page.keyboard.press('ArrowRight');
  expect(await rows(page)).toEqual([
    ['diag', 'pz', 'time', 'tf'],
    ['bode', 'nyq'],
  ]);
  // a full row (four) takes no more: the Nyquist plot stays
  await page.focus('#panel-nyq .pmove');
  await page.keyboard.press('ArrowUp');
  expect(await rows(page)).toEqual([
    ['diag', 'pz', 'time', 'tf'],
    ['bode', 'nyq'],
  ]);
  // the last of a row down: at the end of the next row
  await page.focus('#panel-tf .pmove');
  await page.keyboard.press('ArrowDown');
  expect(await rows(page)).toEqual([
    ['diag', 'pz', 'time'],
    ['bode', 'nyq', 'tf'],
  ]);
});

test('rows: the boundary between two panels of a row changes their widths', async ({ page }) => {
  await start(page);
  const g = page.locator('.prow-grip').first(); // between the time response and the transfer functions
  const w0 = (await boxOf(page, '#panel-time')).width;
  const b = await g.boundingBox();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + 50);
  await page.mouse.down();
  await page.mouse.move(b!.x + b!.width / 2 + 150, b!.y + 50, { steps: 6 });
  await page.mouse.up();
  const w1 = (await boxOf(page, '#panel-time')).width;
  expect(w1).toBeGreaterThan(w0 + 120);
  // kept after a reload; the other rows keep their widths
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  expect(Math.abs((await boxOf(page, '#panel-time')).width - w1)).toBeLessThan(2);
  const [bd, nq] = [await boxOf(page, '#panel-bode'), await boxOf(page, '#panel-nyq')];
  expect(Math.abs(bd.width - nq.width)).toBeLessThan(2);
  // arrow keys, then double-click: equal widths
  await page.focus('.prow-grip >> nth=0');
  await page.keyboard.press('ArrowLeft');
  expect((await boxOf(page, '#panel-time')).width).toBeLessThan(w1 - 20);
  await page.dblclick('.prow-grip >> nth=0');
  const [t, f] = [await boxOf(page, '#panel-time'), await boxOf(page, '#panel-tf')];
  expect(Math.abs(t.width - f.width)).toBeLessThan(2);
});

test('rows: a hidden panel comes back in its row; other layouts keep the rows for later; narrow screens', async ({
  page,
}) => {
  await start(page);
  await togglePanel(page, 'nyq');
  expect(await rows(page)).toEqual([['diag'], ['time', 'tf'], ['bode', 'pz']]);
  await togglePanel(page, 'nyq');
  expect(await rows(page)).toEqual([['diag'], ['time', 'tf'], ['bode', 'nyq', 'pz']]);
  // 2 columns and back: the same rows
  await pickView(page, '#pcols', '2');
  await expect(page.locator('.prow')).toHaveCount(0);
  await pickView(page, '#pcols', 'rows');
  expect(await rows(page)).toEqual([['diag'], ['time', 'tf'], ['bode', 'nyq', 'pz']]);
  // narrow: one below the other, no boundaries, no handles
  await page.setViewportSize({ width: 800, height: 900 });
  const [b, n] = [await boxOf(page, '#panel-bode'), await boxOf(page, '#panel-nyq')];
  expect(n.y).toBeGreaterThan(b.y + b.height - 1);
  expect(Math.abs(n.x - b.x)).toBeLessThan(2);
  await expect(page.locator('.prow-grip').first()).toBeHidden();
  await expect(page.locator('#panel-time .pmove')).toBeHidden();
  // "Reset layout" goes back to 2 columns and forgets the rows
  await page.setViewportSize({ width: 1700, height: 1000 });
  await page.evaluate(() => resetLayout());
  expect(await page.evaluate(() => [layout.pcols, layout.rows])).toEqual([null, null]);
});
