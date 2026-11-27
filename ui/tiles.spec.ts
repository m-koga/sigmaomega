// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Free arrangement of the plot panels: moving them by dragging the ⠿ handle or with the arrow keys, changing
// the widths of the columns, keeping the arrangement, and narrow screens
import { test, expect, boxOf, pickView, togglePanel, showAllPanels } from './fixtures.ts';
import type { Page } from '@playwright/test';

// The arrangement of the four plots (the block diagram, the Nichols chart and the panels without plots, hidden in
// these tests, are left out)
const tiles = (page: Page) =>
  page.evaluate(
    () =>
      layout.tiles?.cols
        .map(c => c.panels.filter(k => !['tf', 'loop', 'poles', 'routh', 'sse', 'nich', 'diag'].includes(k)))
        .filter(c => c.length) ?? null,
  );
// The four plots time, Bode, Nyquist and pole-zero map shown; the block diagram, the Nichols chart and the panels
// without plots hidden
const showAll = async (page: Page) => {
  await page.setViewportSize({ width: 1700, height: 1000 });
  await showAllPanels(page);
  await togglePanel(page, 'tf');
  await togglePanel(page, 'loop');
  await togglePanel(page, 'poles');
  await togglePanel(page, 'routh');
  await togglePanel(page, 'sse');
  await togglePanel(page, 'nich');
  await togglePanel(page, 'diag');
};
// Drags the handle of panel k to the point (x, y) given relative to the panels area (fractions of its size)
async function drag(page: Page, k: string, fx: number, fy: number, opts: { cancel?: boolean } = {}) {
  const h = page.locator(`#panel-${k} .pmove`);
  await h.scrollIntoViewIfNeeded();
  const b = await boxOf(page, `#panel-${k} .pmove`);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 20, b.y + 20, { steps: 3 });
  const p = await boxOf(page, '#panels'),
    vh = page.viewportSize()!.height;
  // keep the target inside the window: the area can be taller than the window
  const y = Math.min(p.y + p.height * fy, vh - 5);
  await page.mouse.move(p.x + p.width * fx, Math.max(y, 5), { steps: 8 });
  if (opts.cancel) await page.keyboard.press('Escape');
  await page.mouse.up();
}

test('dragging a panel to the right edge puts it into a new column, and the arrangement is kept', async ({ page }) => {
  await showAll(page);
  expect(await page.inputValue('#pcols')).toBe('2');
  await page.evaluate(() => window.scrollTo(0, 0));
  await drag(page, 'time', 0.995, 0.1);
  expect(await page.inputValue('#pcols')).toBe('free');
  expect(await tiles(page)).toEqual([['nyq'], ['bode', 'pz'], ['time']]);
  await expect(page.locator('#panels > .pcol')).toHaveCount(3);
  // the panels sit side by side, the moved one on the right
  const [t, b] = [await boxOf(page, '#panel-time'), await boxOf(page, '#panel-bode')];
  expect(t.x).toBeGreaterThan(b.x + b.width);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  expect(await page.inputValue('#pcols')).toBe('free');
  expect(await tiles(page)).toEqual([['nyq'], ['bode', 'pz'], ['time']]);
  await expect(page.locator('#panels > .pcol')).toHaveCount(3);
});

test('dragging a panel onto another column puts it there, above or below the panels', async ({ page }) => {
  await showAll(page);
  await pickView(page, '#pcols', 'free'); // starts from what "2 columns" showed
  expect(await tiles(page)).toEqual([
    ['time', 'nyq'],
    ['bode', 'pz'],
  ]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await drag(page, 'nyq', 0.75, 0.02); // top of the right column
  expect(await tiles(page)).toEqual([['time'], ['nyq', 'bode', 'pz']]);
  // Escape cancels a drag
  await drag(page, 'time', 0.75, 0.02, { cancel: true });
  expect(await tiles(page)).toEqual([['time'], ['nyq', 'bode', 'pz']]);
  await expect(page.locator('body')).not.toHaveClass(/pdrag/);
  await expect(page.locator('#panelDrop')).toBeHidden();
});

test('the boundary between two columns changes their widths; double-click makes them equal', async ({ page }) => {
  await showAll(page);
  await pickView(page, '#pcols', 'free');
  await page.evaluate(() => window.scrollTo(0, 0));
  const w = async () => [
    (await boxOf(page, '.pcol[data-col="0"]')).width,
    (await boxOf(page, '.pcol[data-col="1"]')).width,
  ];
  const [l0, r0] = await w();
  expect(Math.abs(l0 - r0)).toBeLessThan(2);
  const g = await boxOf(page, '.pcol-grip');
  await page.mouse.move(g.x + g.width / 2, g.y + 50);
  await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2 + 150, g.y + 50, { steps: 5 });
  await page.mouse.up();
  const [l1, r1] = await w();
  expect(l1 - l0).toBeGreaterThan(140);
  expect(l1 + r1).toBeCloseTo(l0 + r0, 0);
  // the canvases follow the new width
  expect((await boxOf(page, '#cvY')).width).toBeGreaterThan(l0);
  // it cannot make a column narrower than its minimum
  await page.mouse.move(g.x + 150, g.y + 50);
  await page.mouse.down();
  await page.mouse.move(g.x + 2000, g.y + 50, { steps: 5 });
  await page.mouse.up();
  expect((await w())[1]).toBeGreaterThan(300);
  // kept after a reload, then made equal again
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  expect((await w())[1]).toBeLessThan(400);
  await page.dblclick('.pcol-grip');
  const [l2, r2] = await w();
  expect(Math.abs(l2 - r2)).toBeLessThan(2);
  // the arrow keys change the widths too
  await page.focus('.pcol-grip');
  await page.keyboard.press('ArrowRight');
  const [l3] = await w();
  expect(l3).toBeGreaterThan(l2 + 10);
});

test('the arrow keys on the handle move the panel one step', async ({ page }) => {
  await showAll(page);
  await pickView(page, '#pcols', 'free');
  await page.focus('#panel-time .pmove');
  await page.keyboard.press('ArrowDown');
  expect(await tiles(page)).toEqual([
    ['nyq', 'time'],
    ['bode', 'pz'],
  ]);
  await expect(page.locator('#panel-time .pmove')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  expect(await tiles(page)).toEqual([['nyq'], ['bode', 'time', 'pz']]);
  await page.keyboard.press('ArrowRight'); // at the right edge: a new column
  expect(await tiles(page)).toEqual([['nyq'], ['bode', 'pz'], ['time']]);
  await page.keyboard.press('ArrowRight'); // alone at the edge: no further
  expect(await tiles(page)).toEqual([['nyq'], ['bode', 'pz'], ['time']]);
  await expect(page.locator('#panel-time .pmove')).toBeFocused();
});

test('a hidden panel comes back in its place; the preset layouts keep the free arrangement for later', async ({
  page,
}) => {
  await showAll(page);
  await pickView(page, '#pcols', 'free');
  await page.focus('#panel-pz .pmove');
  await page.keyboard.press('ArrowLeft'); // pz: to the left column, at the same row position (second)
  expect(await tiles(page)).toEqual([['time', 'pz', 'nyq'], ['bode']]);
  await togglePanel(page, 'nyq'); // hide
  await expect(page.locator('#panel-nyq')).toBeHidden();
  await togglePanel(page, 'nyq'); // show again: below pz, where it was
  expect(await tiles(page)).toEqual([['time', 'pz', 'nyq'], ['bode']]);
  const ys = await Promise.all(['time', 'pz', 'nyq'].map(async k => (await boxOf(page, `#panel-${k}`)).y));
  expect(ys).toEqual([...ys].sort((a, b) => a - b));
  // a column whose panels are all hidden is not shown
  await togglePanel(page, 'bode');
  await expect(page.locator('#panels > .pcol')).toHaveCount(1);
  await expect(page.locator('.pcol-grip')).toHaveCount(0);
  await togglePanel(page, 'bode');
  // a preset layout shows the grid; choosing "Free" again brings the arrangement back
  await pickView(page, '#pcols', '1');
  await expect(page.locator('#panels > .pcol')).toHaveCount(0);
  await expect(page.locator('#panels > .tabpanel')).toHaveCount(11); // the hidden block diagram and panels without plots too
  await pickView(page, '#pcols', 'free');
  expect(await tiles(page)).toEqual([['time', 'pz', 'nyq'], ['bode']]);
  await expect(page.locator('#panels > .pcol')).toHaveCount(2);
});

test('on a narrow screen the columns are shown one below the other, without handles', async ({ page }) => {
  await showAll(page);
  await pickView(page, '#pcols', 'free');
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(page.locator('#panel-time .pmove')).toBeHidden();
  await expect(page.locator('.pcol-grip')).toBeHidden();
  const [t, n, b] = await Promise.all(['time', 'nyq', 'bode'].map(k => boxOf(page, `#panel-${k}`)));
  expect(Math.abs(t.x - b.x)).toBeLessThan(2); // same column position
  expect(n.y).toBeGreaterThan(t.y);
  expect(b.y).toBeGreaterThan(n.y); // the second column follows the first
});

test('the block diagram and the transfer functions panels move like the plots', async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 1000 });
  // shown at first: "Free" starts with the block diagram above the time response, the transfer functions beside
  await pickView(page, '#pcols', 'free');
  const cols = () =>
    page.evaluate(() => layout.tiles!.cols.map(c => c.panels.filter(k => shownPanels.has(k))).filter(c => c.length));
  expect(await cols()).toEqual([['diag', 'time'], ['tf']]);
  // the block diagram into a column of its own on the left: the time response to its right, level with it
  await page.focus('#panel-diag .pmove');
  await page.keyboard.press('ArrowLeft');
  expect(await cols()).toEqual([['diag'], ['time'], ['tf']]);
  const [d, t] = [await boxOf(page, '#panel-diag'), await boxOf(page, '#panel-time')];
  expect(t.x).toBeGreaterThan(d.x + d.width - 1);
  expect(Math.abs(t.y - d.y)).toBeLessThan(2);
  // and back above the time response
  await page.keyboard.press('ArrowRight');
  expect(await cols()).toEqual([['diag', 'time'], ['tf']]);
  // the transfer functions into the left column (same row: on top), and back into a column of their own
  await page.focus('#panel-tf .pmove');
  await page.keyboard.press('ArrowLeft');
  expect(await cols()).toEqual([['tf', 'diag', 'time']]);
  await page.keyboard.press('ArrowRight');
  expect(await cols()).toEqual([['diag', 'time'], ['tf']]);
});

test('choosing "Free" from a menu entry is translated', async ({ page }) => {
  await page.selectOption('#langSel', 'ja');
  await expect(page.locator('#pcols option[value=free]')).toHaveText(await page.evaluate(() => T('Free (drag ⠿)')));
  expect(await page.getAttribute('#panel-time .pmove', 'title')).toBe(
    await page.evaluate(() => T('Drag to move this plot (arrow keys also move it)')),
  );
});

// ---- Height of a panel from its bottom edge
const heights = (page: Page, ids: string[]) =>
  page.evaluate(ids => ids.map(id => document.getElementById(id)!.getBoundingClientRect().height), ids);
async function dragEdge(page: Page, k: string, dy: number) {
  await page.evaluate(k => document.querySelector(`#panel-${k} .pgrip`)!.scrollIntoView({ block: 'center' }), k);
  const g = await boxOf(page, `#panel-${k} .pgrip`);
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2 + dy, { steps: 6 });
  await page.mouse.up();
}

test('the bottom edge of an area changes the heights of all its plots by the same ratio', async ({ page }) => {
  const [y0, u0] = await heights(page, ['cvY', 'cvU']);
  await dragEdge(page, 'time', -120);
  const [y1, u1] = await heights(page, ['cvY', 'cvU']);
  expect(y0 + u0 - (y1 + u1)).toBeGreaterThan(110); // the area shrank by about the distance dragged
  expect(Math.abs(y1 / y0 - u1 / u0)).toBeLessThan(0.01); // the same ratio
  // a plot at its limit stops the others: the ratio stays the same
  await dragEdge(page, 'time', -2000);
  const [y2, u2] = await heights(page, ['cvY', 'cvU']);
  expect(u2).toBe(80); // the smallest height of u(t)
  expect(Math.abs(y2 / y0 - u2 / u0)).toBeLessThan(0.01);
  // kept after a reload
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  expect(await heights(page, ['cvU'])).toEqual([80]);
  // the arrow keys grow it by 10 %; double-click goes back to the original heights
  await page.focus('#panel-time .pgrip');
  await page.keyboard.press('ArrowDown');
  expect((await heights(page, ['cvU']))[0]).toBe(88);
  await page.dblclick('#panel-time .pgrip');
  expect(await heights(page, ['cvY', 'cvU'])).toEqual([y0, u0]);
  expect(await page.evaluate(() => [layout.h.cvY, layout.h.cvU])).toEqual([undefined, undefined]);
});

test('a plot hidden with its own handle is left as it is; a panel with one plot scales that plot', async ({ page }) => {
  await page.evaluate(() => setHidden('cvU', true));
  const [y0] = await heights(page, ['cvY']);
  await dragEdge(page, 'time', 100);
  expect(await page.evaluate(() => [isHidden('cvU'), layout.h.cvU])).toEqual([true, undefined]);
  expect((await heights(page, ['cvY']))[0]).toBeGreaterThan(y0 + 90);
  // in the free layout too, for any panel
  await showAll(page);
  await pickView(page, '#pcols', 'free');
  const [n0] = await heights(page, ['cvN']);
  await dragEdge(page, 'nyq', 80);
  expect((await heights(page, ['cvN']))[0]).toBeGreaterThan(n0 + 70);
});
