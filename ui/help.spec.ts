// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// User manual: the Help button of the menu bar, the dialog, its sections and languages
import { test, expect } from './fixtures.ts';

test('Help opens the user manual: sections, contents list, closing, languages', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 860 });
  const body = page.locator('#helpBody'),
    back = page.locator('#helpBack');
  // the button at the right end of the menu bar
  const h = await page.locator('#helpBtn').boundingBox(),
    m = await page.locator('#mviewBtn').boundingBox();
  expect(h!.x).toBeGreaterThan(m!.x + m!.width);
  await page.selectOption('#langSel', 'ja');
  await expect(page.locator('#helpBtn')).toHaveText('使い方');
  // open: every section in Japanese, the focus on ×
  await page.click('#helpBtn');
  await expect(back).toBeVisible();
  await expect(page.locator('#helpTitle')).toHaveText('利用者マニュアル');
  const n = await page.evaluate(() => HELP.length);
  await expect(page.locator('#helpToc .hp-link')).toHaveCount(n);
  await expect(page.locator('#helpBody section')).toHaveCount(n);
  await expect(page.locator('#help-start h3')).toHaveText('1. はじめに');
  await expect(page.locator('#helpClose')).toBeFocused();
  // the contents list scrolls the text to the section
  await page.click('.hp-link[data-sec=files]');
  const top = async (sel: string) => {
    const [s, b] = [await page.locator(sel).boundingBox(), await body.boundingBox()];
    return s!.y - b!.y;
  };
  expect(Math.abs(await top('#help-files'))).toBeLessThan(4);
  // Escape closes it and gives the focus back to Help
  await page.keyboard.press('Escape');
  await expect(back).toBeHidden();
  await expect(page.locator('#helpBtn')).toBeFocused();
  // English; opened again it starts at the top; × and a click beside the dialog close it
  await page.selectOption('#langSel', 'en');
  await page.click('#helpBtn');
  await expect(page.locator('#help-start h3')).toHaveText('1. Getting started');
  expect(await body.evaluate(e => e.scrollTop)).toBe(0);
  await page.click('#helpClose');
  await expect(back).toBeHidden();
  await page.click('#helpBtn');
  await page.mouse.click(5, 850);
  await expect(back).toBeHidden();
  // Chinese, Korean, Thai: the English text with a note in that language
  await page.selectOption('#langSel', 'ko');
  await page.click('#helpBtn');
  await expect(page.locator('#help-start h3')).toHaveText('1. Getting started');
  await expect(page.locator('#helpBody > p.note')).toHaveText(
    await page.evaluate(() => T('(The user manual is shown in English.)')),
  );
  await page.keyboard.press('Escape');
});

test('Help on a phone: its icon only, the contents above the text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.locator('#helpBtn .mb-ic')).toBeVisible();
  await expect(page.locator('#helpBtn span')).toBeHidden();
  await page.click('#helpBtn');
  const t = await page.locator('#helpToc').boundingBox(),
    b = await page.locator('#helpBody').boundingBox();
  expect(b!.y).toBeGreaterThanOrEqual(t!.y + t!.height - 1);
  await page.click('#helpClose');
});

test('the chapter on the exercises shows its screenshots in the language of the manual', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 860 });
  const pics = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLImageElement>('#help-examples figure img')].map(i => ({
        src: i.src.slice(-40),
        w: i.naturalWidth,
        shown: i.getBoundingClientRect().width,
        alt: i.alt,
      })),
    );
  await page.selectOption('#langSel', 'en');
  await page.click('#helpBtn');
  await page.click('.hp-link[data-sec=examples]');
  const figs = page.locator('#help-examples figure');
  const n = await figs.count();
  expect(n).toBeGreaterThanOrEqual(6);
  // every figure has its picture, decoded, no wider than the text, with the caption as its alternative text
  await figs.last().scrollIntoViewIfNeeded();
  await expect.poll(async () => (await pics()).every(p => p.w > 0)).toBe(true);
  const en = await pics();
  expect(en).toHaveLength(n);
  const bodyW = (await page.locator('#helpBody').boundingBox())!.width;
  for (const p of en) {
    expect(p.shown).toBeGreaterThan(200);
    expect(p.shown).toBeLessThan(bodyW);
    expect(p.alt.length).toBeGreaterThan(20);
  }
  await page.keyboard.press('Escape');
  // Japanese: other pictures (the Japanese screen)
  await page.selectOption('#langSel', 'ja');
  await page.click('#helpBtn');
  await page.click('.hp-link[data-sec=examples]');
  await figs.last().scrollIntoViewIfNeeded();
  await expect.poll(async () => (await pics()).every(p => p.w > 0)).toBe(true);
  const ja = await pics();
  expect(ja.map(p => p.src)).not.toEqual(en.map(p => p.src));
  expect(ja[0].alt).toMatch(/保持/);
});

test('figures and tables are numbered by section, and a reference scrolls to its figure or table', async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 860 });
  for (const [lang, fig, tab] of [
    ['en', 'Fig. 8.1', 'Table 2.1'],
    ['ja', '図 8.1', '表 2.1'],
  ]) {
    await page.selectOption('#langSel', lang);
    await page.click('#helpBtn');
    // the captions begin with the numbers, counted in each section
    await expect(page.locator('#help-fig-menus caption .hp-num')).toHaveText(tab);
    await expect(page.locator('#help-fig-ex1-time figcaption .hp-num')).toHaveText(fig);
    await expect(page.locator('#help-fig-ex4-time figcaption .hp-num')).toHaveText(fig.replace('8.1', '8.6'));
    await expect(page.locator('#help-fig-rules caption .hp-num')).toHaveText(tab.replace('2.1', '8.1'));
    // the references show the same numbers
    await expect(page.locator('a.hp-ref[data-ref=ex2-nyq]').first()).toHaveText(fig.replace('8.1', '8.3'));
    expect(await page.locator('a.hp-ref', { hasText: '?' }).count()).toBe(0);
    // a click on a reference scrolls the figure into view and marks it
    const ref = page.locator('a.hp-ref[data-ref=ex4-time]');
    await ref.scrollIntoViewIfNeeded();
    await page.locator('#helpBody').evaluate(b => (b.scrollTop = 0));
    await page.locator('#helpBody').evaluate(b => {
      (b.querySelector('a.hp-ref[data-ref=ex4-time]') as HTMLElement).click();
    });
    const [f, b] = [
      await page.locator('#help-fig-ex4-time').boundingBox(),
      await page.locator('#helpBody').boundingBox(),
    ];
    expect(f!.y - b!.y).toBeGreaterThanOrEqual(0);
    expect(f!.y - b!.y).toBeLessThan(40);
    await expect(page.locator('#help-fig-ex4-time')).toHaveClass(/hp-hit/);
    await page.keyboard.press('Escape');
  }
});

test('the copyright notice is shown under the user manual and the change log, the same in every language', async ({
  page,
}) => {
  const notice = 'Copyright © 2026 Masanobu Koga';
  for (const lang of ['en', 'ja', 'th']) {
    await page.selectOption('#langSel', lang);
    await page.click('#helpBtn');
    const foot = page.locator('#helpBack .cl-foot');
    await expect(foot).toHaveText(`${notice} · Apache License 2.0`);
    await expect(foot.locator('a')).toHaveAttribute('href', 'https://www.apache.org/licenses/LICENSE-2.0');
    // at the bottom of the dialog, below the text
    const [f, b, d] = [
      await foot.boundingBox(),
      await page.locator('#helpBody').boundingBox(),
      await page.locator('#helpBack .cl-box').boundingBox(),
    ];
    expect(f!.y).toBeGreaterThanOrEqual(b!.y + b!.height - 1);
    expect(Math.abs(f!.y + f!.height - (d!.y + d!.height))).toBeLessThan(2);
    await page.keyboard.press('Escape');
  }
  await page.click('#verBtn');
  await expect(page.locator('#clBack .cl-foot')).toHaveText(`${notice} · Apache License 2.0`);
});
