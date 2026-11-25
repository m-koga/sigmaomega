// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// What happens when saving, copying or loading fails: files that cannot be saved, a clipboard that is not
// available, browser storage that is full or broken, unreadable files and links
import { test, expect, setup, PAGE, openCard } from './fixtures.ts';
import type { Page } from '@playwright/test';

// Saving a file fails (the download link cannot be made); the clipboard can fail too
const failFileSave = (page: Page) =>
  page.evaluate(() => {
    URL.createObjectURL = () => {
      throw new Error('no downloads here');
    };
  });
const failClipboard = (page: Page) =>
  page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
    document.execCommand = () => false;
  });

test.describe('saving plot data and images', () => {
  test('CSV data that cannot be saved as a file is copied to the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await failFileSave(page);
    await page.click('[data-csv=time]');
    await expect(page.locator('#toast')).toHaveText(
      await page.evaluate(() =>
        T('This page cannot save files. The data was copied to the clipboard instead; paste it into a spreadsheet.'),
      ),
    );
    await expect(page.locator('#toast')).not.toHaveClass(/err/);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text.split('\n')[0]).toMatch(/^t,r,y,u/); // the CSV header
  });

  test('when neither the file nor the clipboard works, an error is shown', async ({ page }) => {
    await failFileSave(page);
    await failClipboard(page);
    await page.click('[data-csv=time]');
    await expect(page.locator('#toast')).toHaveClass(/err/);
    await expect(page.locator('#toast')).toHaveText(await page.evaluate(() => T('Could not save the file here.')));
  });

  test('a plot image that cannot be made gives an error', async ({ page }) => {
    await page.hover('#cvY');
    await page.evaluate(() => {
      HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
        cb(null); // the image could not be made
      };
    });
    await page.click('.plot-tools[data-for=cvY] [data-z=png]');
    // (the image is made asynchronously: slow while many tests run at once)
    await expect(page.locator('#toast')).toHaveClass(/err/, { timeout: 15000 });
  });

  test('a plot image that cannot be saved gives an error', async ({ page }) => {
    await failFileSave(page);
    await page.hover('#cvY');
    await page.click('.plot-tools[data-for=cvY] [data-z=png]');
    // (the image is made asynchronously: slow while many tests run at once)
    await expect(page.locator('#toast')).toHaveClass(/err/, { timeout: 15000 });
  });
});

test.describe('scenarios', () => {
  test('copying uses the older copy command when the clipboard API is refused', async ({ page }) => {
    await openCard(page, 'scen');
    await page.evaluate(() => {
      navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
      document.execCommand = () => true;
    });
    await page.click('#sc-copy');
    await expect(page.locator('#sc-msg')).toHaveText(await page.evaluate(() => T('Copied to the clipboard')));
  });

  test('when copying fails, the text or link is selected for copying by hand', async ({ page }) => {
    await openCard(page, 'scen');
    await failClipboard(page);
    const byHand = await page.evaluate(() => T('Copy the selected text below'));
    await page.click('#sc-copy');
    await expect(page.locator('#sc-msg')).toHaveText(byHand);
    await expect(page.locator('#sc-msg')).toHaveClass(/err/);
    expect(JSON.parse(await page.inputValue('#sc-text')).S.plant).toBeTruthy();
    await page.click('#sc-link');
    await expect(page.locator('#sc-msg')).toHaveText(byHand);
    expect(await page.inputValue('#sc-text')).toContain('#s=');
  });

  test('browser storage that is full or broken does not break saving and loading', async ({ page }) => {
    await openCard(page, 'scen');
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('full', 'QuotaExceededError');
      };
    });
    await page.fill('#sc-name', 'kept');
    await page.click('#sc-save');
    await expect(page.locator('#sc-msg')).toHaveText(
      await page.evaluate(() => T('Could not save (browser storage is not available)')),
    );
    // broken data in the storage: no saved scenarios, and no error
    await page.evaluate(() => {
      Storage.prototype.getItem = () => '{not json';
      renderScenarios();
    });
    expect(await page.evaluate(() => scLoadAll())).toEqual([]);
    await expect(page.locator('[data-sc-del]')).toHaveCount(0);
  });

  test('a file that is not a scenario file gives an error message', async ({ page }) => {
    await openCard(page, 'scen');
    await page.setInputFiles('#sc-file', {
      name: 'x.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{not json'),
    });
    await expect(page.locator('#sc-msg')).toHaveClass(/err/);
  });

  test('a broken scenario link opens the page with the default settings', async ({ page, context }) => {
    const p2 = await context.newPage();
    await setup(p2);
    await p2.goto(PAGE + '#s=not-a-scenario');
    await p2.waitForFunction(() => document.querySelector('#tex-C svg'));
    expect(await p2.evaluate(() => S.plant)).toBe(await page.evaluate(() => S.plant));
    await p2.close();
  });
});

test.describe('the save capability of the artifact viewer', () => {
  // The capability is requested at start; a save before the answer requests it again
  const stub = async (page: Page, ok: boolean) => {
    await page.addInitScript(ok => {
      window.__saved = [];
      window.claude = {
        use: async () => {
          if (!ok) throw new Error('not declared');
          return { save: async ({ filename }: { filename: string }) => void window.__saved.push(filename) };
        },
      };
    }, ok);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#tex-C svg'));
    await openCard(page, 'scen');
    await page.evaluate(() => {
      scDownloads = undefined; // as if the answer had not come yet
    });
  };

  test('saved when the capability is given', async ({ page }) => {
    await stub(page, true);
    await page.fill('#sc-name', 'late');
    await page.click('#sc-export');
    await expect(page.locator('#sc-msg')).toContainText('late.json');
    expect(await page.evaluate(() => window.__saved)).toEqual(['late.json']);
  });

  test('shown as text when the capability is refused', async ({ page }) => {
    await stub(page, false);
    await page.fill('#sc-name', 'refused');
    await page.click('#sc-export');
    await expect(page.locator('#sc-msg')).toHaveClass(/err/);
    expect(JSON.parse(await page.inputValue('#sc-text')).name).toBe('refused');
  });
});

test.describe('input checks', () => {
  test('a number box restores a value that is not a number and clamps one out of range', async ({ page }) => {
    await page.selectOption('#plant', 'second'); // has the damping ratio ζ
    await page.fill('#v-zeta', ''); // not a number (a number box gives '' for anything else)
    await page.press('#v-zeta', 'Enter');
    expect(parseFloat(await page.inputValue('#v-zeta'))).toBe(await page.evaluate(() => S.zeta));
    const [lo, hi] = await page.evaluate(() => hardRange('zeta'));
    await page.fill('#v-zeta', String(hi * 10));
    await page.press('#v-zeta', 'Enter');
    expect(await page.evaluate(() => S.zeta)).toBe(hi);
    await expect(page.locator('#v-zeta')).toHaveClass(/clamped/);
    expect(lo).toBeLessThan(hi);
  });

  test('a plant transfer function must not have a zero numerator or be improper', async ({ page }) => {
    await page.selectOption('#plant', 'custom');
    for (const [num, den] of [
      ['0', 's+1'],
      ['s^2', 's+1'],
    ]) {
      await page.fill('#cNum', num);
      await page.fill('#cDen', den);
      await page.press('#cDen', 'Enter');
      await expect(page.locator('#cErr')).not.toBeEmpty();
    }
  });

  test('switching from a transfer function to a preset keeps the dead time of each', async ({ page }) => {
    await page.selectOption('#plant', 'custom');
    await page.click('[data-sub=p-L] .sub-h'); // the dead time is in a folded section
    await page.locator('#v-L').fill('0.7');
    await page.press('#v-L', 'Enter');
    await page.selectOption('#plant', 'dead');
    expect(await page.evaluate(() => [S.L, S.L_custom])).toEqual([await page.evaluate(() => PARAMS.L.val), 0.7]);
    await page.selectOption('#plant', 'custom');
    expect(await page.evaluate(() => S.L)).toBe(0.7);
  });

  test('a folded section opens with the keyboard', async ({ page }) => {
    await page.selectOption('#plant', 'custom');
    const sub = page.locator('[data-sub=p-ex]');
    await expect(sub).toHaveClass(/folded/);
    await sub.locator('.sub-h').focus();
    await page.keyboard.press('Enter');
    await expect(sub).not.toHaveClass(/folded/);
  });
});
