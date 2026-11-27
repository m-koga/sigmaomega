// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Layout: columns, header, settings panel tabs and folding, sticky plot bar, block diagram, smartphones
import { test, expect, dragY, boxOf, togglePanel, pickView, openCard } from './fixtures.ts';
import type { Page } from '@playwright/test';

const box = (page: Page, sel: string) => boxOf(page, sel);

test('wide screen: settings panel beside the plots, one-line header', async ({ page }) => {
  const side = await box(page, '.side'),
    main = await box(page, '.main');
  expect(side.x + side.width).toBeLessThanOrEqual(main.x);
  expect((await box(page, 'header')).height).toBeLessThan(60);
});

test('narrow window (860 px): still side by side; the header stays on one line', async ({ page }) => {
  await page.setViewportSize({ width: 860, height: 800 });
  const side = await box(page, '.side'),
    main = await box(page, '.main');
  expect(side.x + side.width).toBeLessThanOrEqual(main.x);
  expect((await box(page, 'header')).height).toBeLessThan(60);
  await expect(page.locator('#tex-C mjx-container > svg')).toBeVisible();
});

test('settings panel: three drop-down lists choose the one card shown, which is remembered', async ({ page }) => {
  const shown = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.side > .card')].filter(c => c.offsetParent).map(c => c.dataset.card),
    );
  const items = (g: string) =>
    page.evaluate(
      gr => [...document.querySelectorAll<HTMLElement>(`#smenuList-${gr} .vb-opt`)].map(b => b.dataset.card),
      g,
    );
  // at first: the plant alone; its list marked
  expect(await shown()).toEqual(['plant']);
  await expect(page.locator('#smenuBtn-sys')).toHaveClass(/on/);
  // the items of each list: the cards of that group, named like their headings
  expect(await items('sys')).toEqual(['plant', 'ctrl', 'input', 'sat']);
  expect(await items('ana')).toEqual(['spec', 'tune', 'comp', 'sweep', 'ex']);
  expect(await items('file')).toEqual(['scen', 'compare']);
  for (const k of ['ctrl', 'tune', 'compare'])
    await expect(page.locator(`.smenu .vb-opt[data-card=${k}]`)).toHaveText(
      await page.locator(`.side > .card[data-card=${k}] h2`).innerText(),
    );
  // the buttons name only their lists
  await expect(page.locator('#smenuBtn-ana .mb-full')).toHaveText(await page.evaluate(() => T('Analysis & design')));
  // choosing an item shows that card alone and closes the list; the other lists' buttons are not marked
  await page.click('#smenuBtn-ana');
  await expect(page.locator('#smenuList-ana')).toBeVisible();
  await expect(page.locator('#smenuList-ana .vb-opt').first()).toBeFocused();
  await page.click('#smenuList-ana .vb-opt[data-card=tune]');
  await expect(page.locator('#smenuList-ana')).toBeHidden();
  expect(await shown()).toEqual(['tune']);
  await expect(page.locator('#smenuBtn-ana')).toHaveClass(/on/);
  await expect(page.locator('#smenuBtn-sys')).not.toHaveClass(/on/);
  await expect(page.locator('#tuneOut')).not.toBeEmpty(); // the tuning result is computed when its card is shown
  // the chosen item is checked; arrow keys and Enter choose; Escape and a click outside close without a change
  await page.click('#smenuBtn-ana');
  await expect(page.locator('#smenuList-ana .vb-opt[aria-checked=true]')).toHaveAttribute('data-card', 'tune');
  await expect(page.locator('#smenuList-ana .vb-opt[data-card=tune]')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await shown()).toEqual(['comp']);
  await page.click('#smenuBtn-file');
  await page.keyboard.press('Escape');
  await expect(page.locator('#smenuList-file')).toBeHidden();
  await page.click('#smenuBtn-file');
  await page.mouse.click(700, 500);
  await expect(page.locator('#smenuList-file')).toBeHidden();
  expect(await shown()).toEqual(['comp']);
  // remembered after a reload
  await page.click('#smenuBtn-file');
  await page.click('#smenuList-file .vb-opt[data-card=compare]');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  expect(await shown()).toEqual(['compare']);
  await expect(page.locator('#smenuBtn-file')).toHaveClass(/on/);
  // a layout stored by an earlier version (a tab, no card): the first card of that tab
  await page.evaluate(() => {
    const L = JSON.parse(localStorage.getItem(LAYOUT_KEY)!);
    delete L.scard;
    L.stab = 'ana';
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(L));
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  expect(await shown()).toEqual(['spec']);
});

test('settings panel: folding into a strip widens the plots', async ({ page }) => {
  const w0 = (await box(page, '.main')).width;
  await page.click('#sideHide');
  await expect(page.locator('.wrap')).toHaveClass(/side-collapsed/);
  expect((await box(page, '.main')).width).toBeGreaterThan(w0 + 200);
  await page.reload();
  await expect(page.locator('.wrap')).toHaveClass(/side-collapsed/);
  await page.click('#sideOpen');
  await expect(page.locator('.wrap')).not.toHaveClass(/side-collapsed/);
});

test('the menu bar stays above the settings panel and the plots while they scroll', async ({ page }) => {
  await togglePanel(page, 'bode');
  await togglePanel(page, 'pz');
  const mb0 = await box(page, '#menubar');
  await page.evaluate(() => {
    document.querySelector('.main')!.scrollTop = 1500;
  });
  const mb = await box(page, '#menubar'),
    main = await box(page, '.main'),
    side = await box(page, '.side');
  expect(mb.y).toBe(mb0.y);
  // under the header, across the page; the settings panel and the plots below it
  expect(mb.y).toBeGreaterThanOrEqual((await box(page, 'header')).y + (await box(page, 'header')).height - 1);
  expect(main.y).toBeGreaterThanOrEqual(mb.y + mb.height - 1);
  expect(side.y).toBeGreaterThanOrEqual(mb.y + mb.height - 1);
  await togglePanel(page, 'nyq');
  expect(await page.evaluate(() => shownPanels.has('nyq'))).toBe(true);
});

test('transfer functions: a panel beside the time response, shown, hidden and remembered like the plots', async ({
  page,
}) => {
  // shown at first, to the right of the time response and level with it
  await expect(page.locator('.tab[data-tab=tf]')).toHaveAttribute('aria-pressed', 'true');
  const y = await box(page, '#panel-time'),
    t = await box(page, '#panel-tf');
  expect(t.x).toBeGreaterThan(y.x + y.width - 1);
  expect(Math.abs(t.y - y.y)).toBeLessThan(2);
  // P(s) first, then C(s), at the left of the panel
  const [p, c, w] = [
    await box(page, '#tex-P mjx-container > svg'),
    await box(page, '#tex-C mjx-container > svg'),
    await box(page, '#tf-wrap'),
  ];
  expect(c.y).toBeGreaterThan(p.y + p.height - 1);
  expect(Math.abs(p.x - w.x)).toBeLessThan(4);
  expect(Math.abs(c.x - w.x)).toBeLessThan(4);
  // the equals signs line up and the formulas are equally spaced, also with the second formula of a 2-DOF PID
  const eqs = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('#tf-wrap mjx-container > svg')].map(s => {
        const r = s.getBoundingClientRect();
        return [s.querySelector('[data-c="3D"]')!.getBoundingClientRect().left, r.top, r.bottom];
      }),
    );
  await openCard(page, 'ctrl');
  for (const tdof of [false, true]) {
    await page.setChecked('#tdof', tdof);
    await expect.poll(async () => (await eqs()).length).toBe(tdof ? 3 : 2);
    const f = await eqs();
    for (const [x] of f) expect(Math.abs(x - f[0][0])).toBeLessThan(0.6);
    const gaps = f.slice(1).map(([, top], i) => top - f[i][2]);
    for (const g of gaps) expect(Math.abs(g - gaps[0])).toBeLessThan(0.6);
    expect(gaps[0]).toBeGreaterThan(5);
  }
  // one column also in a wide panel: the transfer functions alone across the whole width
  await togglePanel(page, 'time');
  await page.setViewportSize({ width: 1800, height: 900 });
  expect((await box(page, '#panel-tf')).width).toBeGreaterThan(900);
  const wide = await eqs();
  expect(wide.length).toBe(3);
  for (const [x] of wide) expect(Math.abs(x - wide[0][0])).toBeLessThan(0.6);
  for (let i = 1; i < wide.length; i++) expect(wide[i][1]).toBeGreaterThan(wide[i - 1][2]);
  await page.setViewportSize({ width: 1400, height: 900 });
  await togglePanel(page, 'time');
  await page.uncheck('#tdof');
  await expect(page.locator('#tex-C mjx-container')).toHaveCount(1); // C_r(s) gone (drawn again shortly after)
  // the formulas are in the panel, no longer in the block diagram card
  expect(await page.locator('.card.diagram #tf-wrap').count()).toBe(0);
  await expect(page.locator('#panel-tf #tex-C mjx-container > svg')).toBeVisible();
  await expect(page.locator('#panel-tf #tex-P mjx-container > svg')).toBeVisible();
  // hidden with its tab; still hidden after a reload
  await togglePanel(page, 'tf');
  await expect(page.locator('#panel-tf')).toBeHidden();
  await page.reload();
  await page.waitForFunction(() => typeof S === 'object' && document.querySelector('#tex-C svg'));
  await expect(page.locator('#panel-tf')).toBeHidden();
  // a layout saved before the panel existed (no version): the formulas were always shown, so the panel is shown
  await page.evaluate(() => localStorage.setItem(LAYOUT_KEY, JSON.stringify({ panels: ['bode'] })));
  await page.reload();
  await page.waitForFunction(() => typeof S === 'object' && document.querySelector('#tex-C svg'));
  await expect(page.locator('#panel-tf')).toBeVisible();
  await expect(page.locator('#panel-bode')).toBeVisible();
  await expect(page.locator('#panel-time')).toBeHidden();
});

test('transfer functions: the bottom edge of the panel changes its height, with the formulas scaled to fit', async ({
  page,
}) => {
  const height = async () => (await boxOf(page, '#panel-tf')).height;
  const size = () => page.evaluate(() => parseFloat(getComputedStyle($('tex-P')).fontSize));
  // one handle: the bottom edge (the formulas no longer have a handle of their own)
  expect(await page.locator('#panel-tf .hgrip').count()).toBe(0);
  const [h0, f0] = [await height(), await size()];
  // lower: taller and larger formulas, about in the same ratio
  await dragY(page, '#panel-tf .pgrip', 80);
  const [h1, f1] = [await height(), await size()];
  expect(h1).toBeGreaterThan(h0 + 50);
  expect(f1).toBeGreaterThan(f0 * 1.3);
  expect(await page.evaluate(() => layout.texFs)).toBe(f1);
  // kept after a reload
  await page.reload();
  await page.waitForFunction(() => typeof S === 'object' && document.querySelector('#tex-C svg'));
  expect(await size()).toBe(f1);
  // higher: smaller; the arrow keys on the edge change it in steps; double-click: the original size
  await dragY(page, '#panel-tf .pgrip', -120);
  expect(await height()).toBeLessThan(h0);
  const f2 = await size();
  await page.focus('#panel-tf .pgrip');
  await page.keyboard.press('ArrowDown');
  expect(await size()).toBeGreaterThan(f2);
  await page.dblclick('#panel-tf .pgrip');
  expect(await size()).toBe(f0);
  expect(await page.evaluate(() => layout.texFs)).toBeNull();
  expect(Math.abs((await height()) - h0)).toBeLessThan(2);
});

test('transfer functions: the formulas stop growing when they fill the width of the panel', async ({ page }) => {
  const fit = () =>
    page.evaluate(() =>
      ['tex-C', 'tex-P'].map(id => {
        const el = byId(id);
        return [el.querySelector('svg')!.getBoundingClientRect().width, el.clientWidth];
      }),
    );
  // C(s) is the wider formula; far more height than the width allows
  const [[wc, cw]] = await fit();
  const f0 = await page.evaluate(() => parseFloat(getComputedStyle($('tex-P')).fontSize));
  await dragY(page, '#panel-tf .pgrip', 500);
  const f = await page.evaluate(() => layout.texFs!);
  expect(f).toBeLessThanOrEqual((f0 * cw) / wc);
  expect(f).toBeGreaterThan((f0 * cw) / wc - 1.5); // stopped at the width, not before
  for (const [w, c] of await fit()) expect(w).toBeLessThanOrEqual(c);
  expect(await page.evaluate(() => $('tex-C').scrollWidth <= $('tex-C').clientWidth)).toBe(true);
  // the arrow keys stop there too (measured again at each step: within half a pixel or so, depending on the fonts)
  await page.focus('#panel-tf .pgrip');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => layout.texFs!)).toBeLessThanOrEqual(f + 1);
  for (const [w, c] of await fit()) expect(w).toBeLessThanOrEqual(c);
});

test('transfer functions: shown smaller while they do not fit the width, and back to the chosen size with room', async ({
  page,
}) => {
  const shown = () => page.evaluate(() => parseFloat(getComputedStyle($('tex-P')).fontSize));
  const fits = () =>
    page.evaluate(() =>
      ['tex-C', 'tex-P'].every(id => {
        const el = byId(id);
        return el.querySelector('svg')!.getBoundingClientRect().width <= el.clientWidth + 0.5;
      }),
    );
  // as large as the width allows
  await dragY(page, '#panel-tf .pgrip', 500);
  const chosen = await page.evaluate(() => layout.texFs!);
  expect(await shown()).toBe(chosen);
  // narrower window: smaller, still fitting; the chosen size is kept
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect.poll(shown).toBeLessThan(chosen);
  expect(await fits()).toBe(true);
  expect(await page.evaluate(() => layout.texFs)).toBe(chosen);
  // wide again: back to the chosen size
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect.poll(shown).toBe(chosen);
  // a longer formula (lead-lag compensator, wider than the PID one): smaller so that it fits
  await openCard(page, 'ctrl');
  await page.selectOption('#mode', 'leadlag');
  await expect.poll(shown).toBeLessThan(chosen);
  expect(await fits()).toBe(true);
  await page.selectOption('#mode', 'PID');
  await expect.poll(shown).toBe(chosen);
});

test('block diagram: as large as before on a wide column; 2-DOF form for 2-DOF PID and PI-D', async ({ page }) => {
  // the diagram keeps the size it had beside the formulas: about 63 % of the area on a wide column
  const [w, cw] = await page.evaluate(() => [
    document.querySelector('#diagBox svg')!.getBoundingClientRect().width,
    $('diagBox').clientWidth,
  ]);
  expect(w).toBeLessThan(cw * 0.64);
  await expect(page.locator('#diagBox')).not.toHaveClass(/two/);
  await openCard(page, 'ctrl');
  await page.check('#tdof');
  await expect(page.locator('#diagBox')).toHaveClass(/two/);
  await expect(page.locator('#lbl-2dof')).toContainText('b = 1');
  await page.uncheck('#tdof');
  await page.check('#dOnMeas');
  await expect(page.locator('#diagBox')).toHaveClass(/two/);
  await page.selectOption('#mode', 'PI');
  await expect(page.locator('#diagBox')).not.toHaveClass(/two/); // PI-D needs a derivative term
});

test('block diagram: never wider than its area; the handle stops where it fills the width', async ({ page }) => {
  const widths = () =>
    page.evaluate(() => [
      document.querySelector('#diagBox svg')!.getBoundingClientRect().width,
      $('diagBox').clientWidth,
      $('diagBox').scrollWidth,
    ]);
  const fitted = async () => {
    const [w, cw, sw] = await widths();
    expect(sw).toBeLessThanOrEqual(cw + 1); // no scroll bar
    expect(w).toBeGreaterThan(cw - 6); // as wide as the area
  };
  // no "Fit to width" button any more
  await expect(page.locator('#diagFit')).toHaveCount(0);
  // without saturation, disturbance and noise the diagram is narrower than the area at first
  const [w0, cw0] = await widths();
  expect(w0).toBeLessThan(cw0 - 6);
  // the handle: taller only until the diagram fills the width
  await dragY(page, '.hgrip[data-target=diagBox]', 400);
  expect(await page.evaluate(() => layout.h.diagBox)).toBe(await page.evaluate(() => diagMaxH()));
  await fitted();
  // a part added: the longer diagram is made smaller to stay within the width (no scroll bar)
  await openCard(page, 'sat');
  await page.check('#sat');
  await fitted();
  // without it again: the height set before fits again
  await page.uncheck('#sat');
  await fitted();
  // the height is kept after a reload
  const h = await page.evaluate(() => layout.h.diagBox);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  expect(await page.evaluate(() => layout.h.diagBox)).toBe(h);
});

test('block diagram: a panel; its bottom edge changes its height, and it can sit left or right of the plots', async ({
  page,
}) => {
  // shown at first, on top across the whole width (2 columns below it), with its button in the bar
  await expect(page.locator('.tab[data-tab=diag]')).toHaveAttribute('aria-pressed', 'true');
  const [d, t, f] = [await box(page, '#panel-diag'), await box(page, '#panel-time'), await box(page, '#panel-tf')];
  expect(t.y).toBeGreaterThan(d.y + d.height - 1);
  expect(Math.abs(d.width - (f.x + f.width - t.x))).toBeLessThan(2);
  // the bottom edge: the diagram follows the height (up to the width of the area); double-click: the original
  const h0 = d.height;
  await dragY(page, '#panel-diag .pgrip', 60);
  expect((await box(page, '#panel-diag')).height).toBeGreaterThan(h0 + 40);
  await expect(page.locator('#diagBox')).toHaveClass(/sized/);
  await dragY(page, '#panel-diag .pgrip', 2000);
  expect(await page.evaluate(() => layout.h.diagBox)).toBe(await page.evaluate(() => diagMaxH()));
  expect(await page.evaluate(() => $('diagBox').scrollWidth <= $('diagBox').clientWidth)).toBe(true);
  await page.dblclick('#panel-diag .pgrip');
  expect(await page.evaluate(() => layout.h.diagBox)).toBeUndefined();
  await expect(page.locator('#diagBox')).not.toHaveClass(/sized/);
  // free arrangement: the block diagram in a column of its own, the time response to its right; its width follows
  // the column boundary (a wide window: three columns of more than the narrowest width)
  await page.setViewportSize({ width: 1900, height: 900 });
  await page.evaluate(() => {
    $('pcols').value = 'free';
    $('pcols').onchange!(new Event('change'));
  });
  await page.focus('#panel-diag .pmove');
  await page.keyboard.press('ArrowLeft');
  const [d2, t2] = [await box(page, '#panel-diag'), await box(page, '#panel-time')];
  expect(t2.x).toBeGreaterThan(d2.x + d2.width - 1);
  const g = await box(page, '.pcol-grip');
  await page.mouse.move(g.x + g.width / 2, g.y + 50);
  await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2 + 120, g.y + 50, { steps: 6 });
  await page.mouse.up();
  expect((await box(page, '#panel-diag')).width).toBeGreaterThan(d2.width + 80);
  // hidden with its button; the layout is reset from the ⚙ menu
  await togglePanel(page, 'diag');
  await expect(page.locator('#panel-diag')).toBeHidden();
  await page.evaluate(() => resetLayout());
  await expect(page.locator('#panel-diag')).toBeVisible();
});

test('smartphone: bottom bar switches between plots and settings; one-row plot bar; 16 px inputs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#mnav')).toBeVisible();
  await expect(page.locator('.side')).toBeHidden();
  await expect(page.locator('#cvY')).toBeVisible();
  expect((await box(page, '#menubar')).height).toBeLessThan(110); // two rows of menus
  await page.click('#mnavSet');
  await expect(page.locator('.main')).toBeHidden();
  await openCard(page, 'ctrl');
  await expect(page.locator('#v-Kp')).toHaveCSS('font-size', '16px');
  await page.fill('#v-Kp', '4');
  await page.press('#v-Kp', 'Enter');
  await page.click('#mnavPlot');
  await expect(page.locator('.main')).toBeVisible();
  expect(await page.evaluate(() => S.Kp)).toBe(4);
});

test('the Routh–Hurwitz test and the steady-state error are shown from "Analysis & design", below its cards', async ({
  page,
}) => {
  await page.click('#smenuBtn-ana');
  const list = page.locator('#smenuList-ana');
  // the five cards, a separator, then the two panels
  expect(
    await list
      .locator('> *')
      .evaluateAll(es => es.map(e => (e as HTMLElement).dataset.card || (e as HTMLElement).dataset.tab || e.className)),
  ).toEqual(['spec', 'tune', 'comp', 'sweep', 'ex', 'vb-ddsep', 'routh', 'sse']);
  await expect(page.locator('#panelList .tab[data-tab=routh]')).toHaveCount(0);
  // the arrow keys go on from the last card to the panels; Enter shows a panel and the list stays open
  await page.focus('#smenuList-ana .vb-opt[data-card=ex]');
  await page.keyboard.press('ArrowDown');
  await expect(list.locator('.tab[data-tab=routh]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#panel-routh')).toBeVisible();
  await expect(list.locator('.tab[data-tab=routh]')).toHaveAttribute('aria-pressed', 'true');
  await list.locator('.tab[data-tab=sse]').click();
  await expect(page.locator('#panel-sse')).toBeVisible();
  await expect(list).toBeVisible();
  const card = await page.evaluate(() => layout.scard);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => layout.scard)).toBe(card); // the card of the settings panel is not changed
  // the × of the panel names the menu where it is shown again, and hides it
  await expect(page.locator('#panel-sse .pclose')).toHaveAttribute(
    'title',
    await page.evaluate(() => T(TXT_PCLOSE_ANA)),
  );
  await page.click('#panel-sse .pclose');
  await expect(page.locator('#panel-sse')).toBeHidden();
  await page.click('#smenuBtn-ana');
  await expect(list.locator('.tab[data-tab=sse]')).toHaveAttribute('aria-pressed', 'false');
});

test('the plots to show are chosen in a drop-down list that stays open while choosing', async ({ page }) => {
  const list = page.locator('#panelList'),
    sum = page.locator('#panelSum');
  const label = () => page.evaluate(() => T('Plots to show'));
  // closed at first; the button reads only "Plots to show", whatever is shown (in the language of the page from the
  // start)
  await expect(list).toBeHidden();
  await expect(sum).toHaveText(await label());
  await expect(page.locator('#panelBtn')).not.toContainText(await page.evaluate(() => T('Time response')));
  // open: the first item has the focus; several panels are chosen one after another
  await page.click('#panelBtn');
  await expect(list).toBeVisible();
  await expect(page.locator('#panelBtn')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#panelList .tab').first()).toBeFocused();
  await page.click('#panelList .tab[data-tab=bode]');
  await page.click('#panelList .tab[data-tab=tf]');
  await expect(list).toBeVisible();
  await expect(page.locator('#panel-bode')).toBeVisible();
  await expect(page.locator('#panel-tf')).toBeHidden();
  await expect(sum).toHaveText(await label());
  // the arrow keys move between the items, Enter toggles, Escape closes and returns to the button
  await page.focus('#panelList .tab[data-tab=nich]');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#panelList .tab[data-tab=pz]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#panel-pz')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  await expect(page.locator('#panelBtn')).toBeFocused();
  // a click outside closes it; "All" shows every plot of the list (not the two panels of "Analysis & design")
  await expect(page.locator('#panelList .tab')).toHaveCount(9);
  await page.click('#panelBtn');
  await page.click('#panelsAll');
  await expect(page.locator('#panels > .tabpanel:visible')).toHaveCount(9);
  await expect(page.locator('#panel-routh')).toBeHidden();
  await page.click('#cvY');
  await expect(list).toBeHidden();
  // the last panel shown cannot be hidden
  await page.click('#panelBtn');
  for (const k of ['diag', 'tf', 'loop', 'poles', 'bode', 'nyq', 'nich', 'pz'])
    await page.click(`#panelList .tab[data-tab=${k}]`);
  await page.click('#panelList .tab[data-tab=time]');
  await expect(page.locator('#panel-time')).toBeVisible();
  await expect(sum).toHaveText(await label());
  // the choice is kept after a reload; the label follows the language
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  await expect(page.locator('#panel-time')).toBeVisible();
  await expect(page.locator('#panel-bode')).toBeHidden();
  await expect(sum).toHaveText(await label());
  await page.selectOption('#langSel', 'en');
  await expect(sum).toHaveText('Plots to show');
  await page.selectOption('#langSel', 'ja');
  await expect(sum).toHaveText('表示する図');
});

test('the menu bar holds every menu in order, in one row on wide screens and wrapped on narrow ones', async ({
  page,
}) => {
  const ids = ['#smenuBtn-file', '#panelBtn', '#smenuBtn-sys', '#smenuBtn-ana', '#pcolsBtn', '#mviewBtn'];
  // File, Plots to show, System setup, Analysis & design, Plot arrangement, Metrics display
  const names = await page.evaluate(() =>
    ['File', 'Plots to show', 'System setup', 'Analysis & design', 'Plot arrangement', 'Metrics display'].map(k =>
      T(k),
    ),
  );
  for (let i = 0; i < ids.length; i++) await expect(page.locator(`${ids[i]} .mb-full`)).toHaveText(names[i]);
  expect(await page.evaluate(() => [...document.querySelectorAll('#menubar .vb-ddbtn')].map(b => '#' + b.id))).toEqual(
    ids,
  );
  // nothing of the menus is left in the settings panel or above the plots
  expect(await page.locator('.side .vb-dd, .main .vb-dd').count()).toBe(0);
  for (const width of [1900, 1400, 1100, 800, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(100);
    const tops = new Set(await Promise.all(ids.map(async id => Math.round((await boxOf(page, id)).y))));
    // wide: one row; narrow: at most two rows (short names on phones); every button on the screen
    if (width >= 800) expect(tops.size).toBe(1);
    else expect(tops.size).toBeLessThanOrEqual(2);
    for (const id of ids) {
      const b = await boxOf(page, id);
      expect(b.x + b.width).toBeLessThanOrEqual(width);
    }
    // a list opened at the right end stays on the screen
    await page.click('#mviewBtn');
    const l = await boxOf(page, '#mviewList');
    expect(l.x).toBeGreaterThanOrEqual(0);
    expect(l.x + l.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
  }
});

test('the layout of the plots is chosen in a drop-down list that names only itself while closed', async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 900 });
  const btn = page.locator('#pcolsBtn'),
    list = page.locator('#pcolsList'),
    label = await page.evaluate(() => T('Plot arrangement'));
  // closed: only "Plot arrangement", not the chosen layout
  await expect(list).toBeHidden();
  await expect(btn.locator('.mb-full')).toHaveText(label);
  await expect(btn).not.toContainText(await page.evaluate(() => T('2 columns')));
  // open: every layout, the chosen one checked and focused
  await btn.click();
  await expect(list).toBeVisible();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#pcolsList .vb-opt')).toHaveCount(5);
  await expect(page.locator('#pcolsList .vb-opt[aria-checked=true]')).toHaveAttribute('data-v', '2');
  await expect(page.locator('#pcolsList .vb-opt[data-v="2"]')).toBeFocused();
  // the arrow keys and Enter choose; the list closes, the button keeps its text and gets the focus back
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(list).toBeHidden();
  await expect(btn).toBeFocused();
  expect(await page.evaluate(() => [layout.pcols, $('pcols').value])).toEqual(['row', 'row']);
  await expect(btn.locator('.mb-full')).toHaveText(label);
  // a click on an item; a click outside or Escape closes without a change
  await btn.click();
  await expect(page.locator('#pcolsList .vb-opt[aria-checked=true]')).toHaveAttribute('data-v', 'row');
  await page.click('#pcolsList .vb-opt[data-v="rows"]');
  await expect(page.locator('#panels')).toHaveClass(/rows/);
  await btn.click();
  await page.mouse.click(5, 5);
  await expect(list).toBeHidden();
  await btn.click();
  await page.keyboard.press('Escape');
  await expect(list).toBeHidden();
  expect(await page.evaluate(() => layout.pcols)).toBe('rows');
  // the items follow the language; a change elsewhere (Reset layout) is checked when the list opens again
  await page.selectOption('#langSel', 'ja');
  await expect(btn.locator('.mb-full')).toHaveText('図の並び方');
  await page.evaluate(() => resetLayout());
  await btn.click();
  await expect(page.locator('#pcolsList .vb-opt[aria-checked=true]')).toHaveText('2列');
});

test('the metrics view is chosen in a drop-down list too; all menus of the bar are packed from the left', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1700, height: 900 });
  const btn = page.locator('#mviewBtn'),
    label = await page.evaluate(() => T('Metrics display'));
  // closed: only "Metrics display"; open: cards checked
  await expect(btn.locator('.mb-full')).toHaveText(label);
  await expect(btn).not.toContainText(await page.evaluate(() => T('Cards')));
  await btn.click();
  await expect(page.locator('#mviewList .vb-opt[aria-checked=true]')).toHaveAttribute('data-v', 'cards');
  await page.click('#mviewList .vb-opt[data-v="table"]');
  await expect(page.locator('#mviewList')).toBeHidden();
  await expect(page.locator('#metrics .mtab')).toHaveCount(1);
  expect(await page.evaluate(() => layout.mview)).toBe('table');
  await expect(btn.locator('.mb-full')).toHaveText(label);
  // only one list open at a time
  await btn.click();
  await page.click('#pcolsBtn');
  await expect(page.locator('#mviewList')).toBeHidden();
  await expect(page.locator('#pcolsList')).toBeVisible();
  await page.keyboard.press('Escape');
  // packed from the left: each menu right after the one before, the space left over at the right end
  const xs = await Promise.all(
    ['#smenuBtn-file', '#panelBtn', '#smenuBtn-sys', '#smenuBtn-ana', '#pcolsBtn', '#mviewBtn'].map(s =>
      boxOf(page, s),
    ),
  );
  for (let i = 1; i < xs.length; i++) expect(xs[i].x - (xs[i - 1].x + xs[i - 1].width)).toBeLessThan(40);
  const vb = await boxOf(page, '#menubar'),
    last = xs[xs.length - 1];
  expect(vb.x + vb.width - (last.x + last.width)).toBeGreaterThan(400);
  // no "Reset layout" button any more
  await expect(page.locator('#layoutReset')).toHaveCount(0);
});

test('"Reset the layout" in the File tab brings back the first layout and keeps the settings', async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 900 });
  // a changed layout and a changed setting
  await pickView(page, '#pcols', 'rows');
  await togglePanel(page, 'bode');
  await togglePanel(page, 'tf');
  await pickView(page, '#mview', 'table');
  await dragY(page, '#panel-time .pgrip', 80);
  await page.evaluate(() => {
    S.Kp = 3.5;
    syncControls();
    update();
  });
  // the button in the File tab, beside "Reset to defaults"
  await openCard(page, 'compare');
  const btn = page.locator('#layoutDefault');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText(await page.evaluate(() => T('Reset the layout')));
  await btn.click();
  // the layout as at first: 2 columns, the first panels, no stored sizes; the metrics view and the tab are kept
  expect(
    await page.evaluate(() => [layout.pcols, layout.rows, [...shownPanels].sort(), Object.keys(layout.h).length]),
  ).toEqual([null, null, ['diag', 'tf', 'time'], 0]);
  await expect(page.locator('#panels')).not.toHaveClass(/rows/);
  await expect(page.locator('#panel-bode')).toBeHidden();
  expect(await page.evaluate(() => [layout.mview, layout.stab])).toEqual(['table', 'file']);
  // the setting is unchanged
  expect(await page.evaluate(() => S.Kp)).toBe(3.5);
  // kept after a reload
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  expect(await page.evaluate(() => [layout.pcols, [...shownPanels].sort()])).toEqual([null, ['diag', 'tf', 'time']]);
});

test('the metric cards keep their rows when the width changes', async ({ page }) => {
  const rows = () =>
    page.$$eval('#metrics .m', ms => new Set(ms.map(m => Math.round(m.getBoundingClientRect().top))).size);
  // the time response alone, as wide as the plot area (beside the transfer functions it is half as wide)
  await togglePanel(page, 'tf');
  for (const [dOn, want] of [
    [false, 2], // 6 cards: 3 × 2
    [true, 2], // 8 cards: 4 × 2
  ] as const) {
    await page.evaluate(d => {
      S.dOn = d;
      update();
    }, dOn);
    for (const width of [1900, 1500, 1200]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      expect(await rows(), `disturbance ${dOn}, width ${width}`).toBe(want);
    }
  }
  expect(await page.evaluate(() => [1, 4, 5, 6, 8].map(metricCols))).toEqual([1, 4, 3, 3, 4]);
});

test('the × of a panel hides it, like its item in "Plots to show"; not the last one', async ({ page }) => {
  const shown = () => page.evaluate(() => [...shownPanels].sort());
  const close = (k: string) => page.locator(`#panel-${k} .pclose`);
  // every panel has one, at the right end of its title
  await expect(page.locator('.pclose')).toHaveCount(11);
  expect(await shown()).toEqual(['diag', 'tf', 'time']);
  const t = await boxOf(page, '#panel-tf h2'),
    c = await boxOf(page, '#panel-tf .pclose');
  expect(c.x).toBeGreaterThan(t.x + t.width - 2);
  // a click hides the panel (no move starts), and the list of plots shows it as hidden
  await close('tf').click();
  await expect(page.locator('#panel-tf')).toBeHidden();
  expect(await shown()).toEqual(['diag', 'time']);
  await expect(page.locator('.tab[data-tab=tf]')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => layout.panels)).toEqual(['diag', 'time']);
  // kept after a reload; shown again from the list
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#tex-C svg'));
  await expect(page.locator('#panel-tf')).toBeHidden();
  await togglePanel(page, 'tf');
  await expect(page.locator('#panel-tf')).toBeVisible();
  // the keyboard: Enter on a focused × hides its panel
  await close('time').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#panel-time')).toBeHidden();
  // the last panel shown: its × is not available
  await close('tf').click();
  expect(await shown()).toEqual(['diag']);
  await expect(close('diag')).toBeDisabled();
  await close('diag').click({ force: true });
  expect(await shown()).toEqual(['diag']);
  // with another panel shown, it is available again
  await togglePanel(page, 'bode');
  await expect(close('diag')).toBeEnabled();
});

test('menu bar design: a dark bar, an icon on each menu on wide screens, the current and the open menu underlined', async ({
  page,
}) => {
  const underlined = (id: string) =>
    page.evaluate(
      i => getComputedStyle(document.getElementById(i)!, '::after').transform !== 'matrix(0, 0, 0, 1, 0, 0)',
      id,
    );
  // a dark bar with light text
  const [bg, fg] = await page.evaluate(() => [
    getComputedStyle($('menubar')).backgroundColor,
    getComputedStyle(document.querySelector('#menubar .vb-ddbtn')!).color,
  ]);
  const lum = (c: string) => (c.match(/\d+/g) ?? []).slice(0, 3).reduce((a, v) => a + Number(v), 0) / 3;
  expect(lum(bg)).toBeLessThan(60);
  expect(lum(fg)).toBeGreaterThan(180);
  // an icon on each of the six menus, shown on a wide screen and left out on a narrower one
  await expect(page.locator('#menubar .vb-ddbtn > .mb-ic')).toHaveCount(6);
  await page.setViewportSize({ width: 1300, height: 800 });
  await expect(page.locator('#panelBtn .mb-ic')).toBeVisible();
  // the menu of the card in the settings panel is underlined; an open menu too, and only while open
  expect(await underlined('smenuBtn-sys')).toBe(true);
  await page.waitForTimeout(250); // transitions
  expect(await underlined('panelBtn')).toBe(false);
  await page.click('#panelBtn');
  await page.waitForTimeout(250);
  expect(await underlined('panelBtn')).toBe(true);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  expect(await underlined('panelBtn')).toBe(false);
  // one row from 770 px in every language (without the icons below 960 px)
  for (const lang of ['en', 'ja', 'zh', 'ko', 'th']) {
    await page.selectOption('#langSel', lang);
    for (const width of [770, 1300]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(page.locator('#panelBtn .mb-ic')).toBeVisible({ visible: width > 960 });
      const tops = new Set(
        await page.evaluate(() =>
          [...document.querySelectorAll('#menubar .vb-ddbtn')].map(b => Math.round(b.getBoundingClientRect().y)),
        ),
      );
      expect(tops.size, `${lang} at ${width} px`).toBe(1);
    }
  }
});

test('phones: the menus show short names, so that they fit in at most two rows in every language', async ({ page }) => {
  const ids = ['#smenuBtn-file', '#panelBtn', '#smenuBtn-sys', '#smenuBtn-ana', '#pcolsBtn', '#mviewBtn'];
  const short = ['File', 'Plots', 'System', 'Design', 'Layout', 'Metrics'];
  for (const lang of ['en', 'ja', 'zh', 'ko', 'th']) {
    await page.setViewportSize({ width: 1300, height: 800 });
    await page.selectOption('#langSel', lang);
    // wide: the full names
    await expect(page.locator('#pcolsBtn .mb-full')).toBeVisible();
    await expect(page.locator('#pcolsBtn .mb-short')).toBeHidden();
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 800 });
      const names = await page.evaluate(k => k.map(x => T(x)), short);
      for (let i = 0; i < ids.length; i++) {
        await expect(page.locator(`${ids[i]} .mb-short`)).toHaveText(names[i]);
        await expect(page.locator(`${ids[i]} .mb-full`)).toBeHidden();
      }
      const tops = new Set(
        await page.evaluate(() =>
          [...document.querySelectorAll('#menubar .vb-ddbtn, #helpBtn')].map(b =>
            Math.round(b.getBoundingClientRect().y),
          ),
        ),
      );
      expect(tops.size, `${lang} at ${width} px`).toBeLessThanOrEqual(2);
    }
  }
});
