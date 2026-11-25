// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Languages: the default follows the browser, and no untranslated text appears in any language
import { test as base, expect, PAGE, setup } from './fixtures.ts';
const test = base;

const JP = /[぀-ヿ一-鿿]/,
  KANA = /[぀-ヿ]/,
  EN_WORD = /\b[A-Za-z][a-z]{3,}\b/g;
// English words that may appear in every language: names, keys, and technical terms given in parentheses
const ALLOWED = new Set([
  'English',
  'Enter',
  'Durand',
  'Kerner',
  'Padé',
  'Pade',
  'Noto',
  'Ziegler',
  'Nichols',
  'Chien',
  'Hrones',
  'Reswick',
  'Shift',
  'proper',
  'zero',
  'order',
  'hold',
  'seed',
]);

// Page states that bring out more text
const STATES = [
  () => {},
  () => {
    PANELS.forEach(k => shownPanels.add(k));
    applyPanels();
    redraw();
  },
  () => {
    document.querySelectorAll('.side > .card').forEach(c => c.classList.remove('tab-hidden', 'folded'));
    document.querySelectorAll('.sub').forEach(s => s.classList.remove('folded'));
  },
  () => {
    S.plant = 'custom';
    S.mode = 'custom';
    buildPlant();
    buildCtrlCustom();
    update();
  },
  () => {
    S.mode = 'leadlag';
    S.sat = true;
    S.dOn = true;
    S.tdof = false;
    update();
  },
  () => {
    S.plant = 'unstable';
    S.mode = 'P';
    S.Kp = 0.3;
    update();
  },
  () => {
    ['diagBox', 'cvY', 'bodenote', 'pztable'].forEach(k => setHidden(k, true));
  },
];
function collect() {
  const out = [],
    w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const el = w.currentNode.parentElement;
    if (!el || el.closest('#clBack, script, mjx-container, code, #langSel, svg')) continue;
    if (el.offsetParent === null && el.tagName !== 'OPTION') continue;
    const t = (w.currentNode.textContent ?? '').trim();
    if (t) out.push(t);
  }
  document.querySelectorAll<HTMLElement>('[title]').forEach(e => e.title && out.push(e.title));
  document.querySelectorAll<HTMLElement>('.hgrip[data-msg]').forEach(e => out.push(e.dataset.msg ?? ''));
  return out;
}

test('the default language follows the browser (English if not supported)', async ({ browser }) => {
  for (const [locale, lang] of [
    ['en-US', 'en'],
    ['ko-KR', 'ko'],
    ['th-TH', 'th'],
    ['fr-FR', 'en'],
  ]) {
    const ctx = await browser.newContext({ locale });
    const page = await ctx.newPage();
    await setup(page);
    await page.goto(PAGE);
    expect(await page.evaluate(() => LANG), locale).toBe(lang);
    await ctx.close();
  }
});

for (const lang of ['en', 'ja', 'zh', 'ko', 'th']) {
  test(`no untranslated text in ${lang}`, async ({ page }) => {
    await page.selectOption('#langSel', lang);
    const bad = new Set();
    for (const st of STATES) {
      await page.evaluate(st);
      for (const t of await page.evaluate(collect)) {
        if (lang === 'en' && JP.test(t)) bad.add(t);
        if (lang === 'zh' && KANA.test(t)) bad.add(t);
        if (lang !== 'en' && (t.match(EN_WORD) || []).some(w => !ALLOWED.has(w))) bad.add(t);
      }
    }
    expect([...bad]).toEqual([]);
  });
}

test('the menus of plants and controllers are made from their tables and follow the language', async ({ page }) => {
  const values = (id: string) => page.$$eval(`#${id} option`, os => os.map(o => (o as HTMLOptionElement).value));
  expect(await values('plant')).toEqual(await page.evaluate(() => Object.keys(PLANTS)));
  expect(await values('mode')).toEqual(await page.evaluate(() => Object.keys(CONTROLLERS)));
  expect(await page.inputValue('#mode')).toBe('PID');
  await page.selectOption('#langSel', 'ja');
  await expect(page.locator('#plant option[value=first]')).toHaveText('1次遅れ系');
  await expect(page.locator('#mode option[value=lead]')).toHaveText(
    await page.evaluate(() => T(CONTROLLERS.lead.label)),
  );
});

test('the language menu, the page language and the rows of the specifications are made from their tables', async ({
  page,
}) => {
  const values = (id: string) => page.$$eval(`#${id} option`, os => os.map(o => (o as HTMLOptionElement).value));
  expect(await values('langSel')).toEqual(await page.evaluate(() => Object.keys(LANGUAGES)));
  for (const l of await page.evaluate(() => Object.keys(LANGUAGES))) {
    await page.selectOption('#langSel', l);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe(
      await page.evaluate(k => LANGUAGES[k as 'ja'].tag, l),
    );
  }
  const keys = await page.evaluate(() => SPEC_KEYS as string[]);
  expect(await page.$$eval('#specRows .spec-row', rs => rs.map(r => r.id))).toEqual(keys.map(k => `specrow-${k}`));
  for (const k of keys) {
    const d = await page.evaluate(key => SPECS[key as 'os'], k);
    expect(await page.getAttribute(`#spec-${k}`, 'min')).toBe(String(d.low));
    expect(await page.inputValue(`#spec-${k}`)).toBe(String(d.v));
    expect(await page.isChecked(`#spec-${k}-on`)).toBe(d.on);
    await expect(page.locator(`#specrow-${k} label span`)).toHaveText(await page.evaluate(t => T(t), d.label));
    await expect(page.locator(`#specrow-${k} .spec-u`)).toHaveText(d.unit);
  }
});

test('the title: the name SigmaOmega in every language, the subtitle translated, both in one colour', async ({
  page,
}) => {
  const h1 = page.locator('header h1'),
    name = h1.locator('.app-name'),
    sub = h1.locator('.app-sub');
  const ink = await page.evaluate(() => getComputedStyle(document.body).color);
  for (const e of [name, sub]) expect(await e.evaluate(x => getComputedStyle(x).color)).toBe(ink);
  for (const [lang, subtitle] of [
    ['en', 'Feedback Control Simulator'],
    ['ja', 'フィードバック制御シミュレーター'],
    ['ko', await page.evaluate(() => I18N['Feedback Control Simulator'].ko as string)],
  ]) {
    await page.selectOption('#langSel', lang);
    await expect(name).toHaveText('SigmaOmega');
    await expect(sub).toHaveText(subtitle);
    expect(await page.title()).toBe(`SigmaOmega — ${subtitle}`);
  }
  // on a phone only the name is shown
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(name).toBeVisible();
  await expect(sub).toBeHidden();
});

test('the icon is drawn before the name and is the favicon', async ({ page }) => {
  const logo = page.locator('header .app-logo svg'),
    name = page.locator('header .app-name');
  const [l, n] = [await logo.boundingBox(), await name.boundingBox()];
  expect(l!.width).toBe(28);
  expect(l!.x + l!.width).toBeLessThanOrEqual(n!.x);
  // vertically centred on the name
  expect(Math.abs(l!.y + l!.height / 2 - (n!.y + n!.height / 2))).toBeLessThan(4);
  expect(await page.locator('link[rel=icon]').getAttribute('href')).toMatch(/^data:image\/svg\+xml,/);
  // the favicon can be decoded as a picture
  const ok = await page.evaluate(async () => {
    const img = new Image();
    img.src = (document.querySelector('link[rel=icon]') as HTMLLinkElement).href;
    await img.decode();
    return img.naturalWidth > 0;
  });
  expect(ok).toBe(true);
  // the home-screen icon: 180×180, its corner not transparent (the phone rounds the corners itself)
  const touch = await page.evaluate(async () => {
    const img = new Image();
    img.src = (document.querySelector('link[rel=apple-touch-icon]') as HTMLLinkElement).href;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = 180;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    return { w: img.naturalWidth, h: img.naturalHeight, corner: [...g.getImageData(0, 0, 1, 1).data] };
  });
  expect([touch.w, touch.h]).toEqual([180, 180]);
  expect(touch.corner[3]).toBe(255);
  expect(touch.corner[0]).toBeLessThan(60);
});
