// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Common setup of the browser tests
//  - the page is the built index.html, opened as a local file
//  - MathJax is served from node_modules and Google Fonts are skipped, so the tests run offline
//  - every test starts with empty browser storage (each test has its own browser context; checked on a start page)
//    and fails on any JavaScript error of the page
//  - with COV_DIR set (npm run coverage), the JavaScript coverage of each test is written there
import * as base from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const PAGE = 'file://' + path.join(import.meta.dirname, '..', 'index.html');
const START = 'file://' + path.join(import.meta.dirname, 'start.html');
const MATHJAX = fs.readFileSync(createRequire(import.meta.url).resolve('mathjax/es5/tex-svg.js'));

async function setup(page: Page) {
  await page.route('**/*', (route: Route) => {
    const url = route.request().url();
    if (url.includes('mathjax')) return route.fulfill({ body: MATHJAX, contentType: 'application/javascript' });
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com'))
      return route.fulfill({ body: '', contentType: 'text/css' });
    return route.continue();
  });
}

const test = base.test.extend({
  // page: the simulator, loaded and ready (formulas rendered)
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));
    await setup(page);
    if (process.env.COV_DIR) await page.coverage.startJSCoverage({ resetOnNavigation: false });
    /* A tiny page of the same origin first: storage that the first page of a new browser context writes is sometimes
       lost when it reloads (pages opened as local files), and the simulator itself is loaded only once */
    await page.goto(START);
    base.expect(await page.evaluate(() => localStorage.length), 'browser storage at the start of the test').toBe(0);
    await page.goto(PAGE);
    await page.waitForFunction(() => typeof S === 'object' && document.querySelector('#tex-C svg'));
    await use(page);
    if (process.env.COV_DIR) {
      const cov = await page.coverage.stopJSCoverage();
      fs.writeFileSync(
        path.join(process.env.COV_DIR, `${Date.now()}-${Math.random().toString(36).slice(2)}.json`),
        JSON.stringify(cov),
      );
    }
    base.expect(errors, 'JavaScript errors on the page').toEqual([]);
  },
});

// Position and size of the first element matching selector (fails the test when it is not shown)
async function boxOf(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} is not shown`);
  return b;
}

// Drag a resize handle vertically by dy pixels
async function dragY(page: Page, selector: string, dy: number) {
  const g = page.locator(selector).first();
  await g.scrollIntoViewIfNeeded();
  const b = await boxOf(page, selector);
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy, { steps: 8 });
  await page.mouse.up();
}

// Choose in the layout or metrics menu of the menu bar (#pcols, #mview)
// (both are drop-down lists: the button opens one, the item is clicked)
async function pickView(page: Page, selector: string, value: string) {
  await page.click(selector + 'Btn');
  await page.click(`${selector}List .vb-opt[data-v="${value}"]`);
}

// Show or hide panel k from the drop-down list of the plot selection bar (opened first, closed after with Escape)
async function togglePanel(page: Page, k: string) {
  if (!(await page.locator('#panelList').isVisible())) await page.click('#panelBtn');
  await page.click(`#panelList .tab[data-tab=${k}]`);
  await page.keyboard.press('Escape');
}
// Show all panels ("All" in the drop-down list)
async function showAllPanels(page: Page) {
  if (!(await page.locator('#panelList').isVisible())) await page.click('#panelBtn');
  await page.click('#panelsAll');
  await page.keyboard.press('Escape');
}

// Shows card k of the settings panel: its drop-down list (System setup, Analysis & design, File) opened, the card chosen
async function openCard(page: Page, k: string) {
  const g = await page.evaluate(key => CARD_GROUP[key], k);
  await page.click(`#smenuBtn-${g}`);
  await page.click(`#smenuList-${g} .vb-opt[data-card=${k}]`);
}

const expect = base.expect;
export { test, expect, PAGE, setup, dragY, boxOf, pickView, togglePanel, showAllPanels, openCard };
