// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Browser tests of the page (npm run test:ui). See ui/fixtures.ts for the common setup.
import fs from 'node:fs';
import os from 'node:os';
import { defineConfig, chromium } from '@playwright/test';

// Browser: CHROME_PATH if set; otherwise the browser installed by "npx playwright install chromium";
// otherwise a Chrome or Chromium found in the usual places.
function browserPath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try {
    if (fs.existsSync(chromium.executablePath())) return undefined;
  } catch (e) {
    /* not installed */
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].find(p => fs.existsSync(p));
}
const executablePath = browserPath();

export default defineConfig({
  testDir: 'ui',
  testMatch: '*.spec.ts',
  globalSetup: './ui/global-setup.ts',
  timeout: 60_000,
  fullyParallel: true,
  // at least two tests at a time (the default, half the CPUs, is one on a 2-CPU machine)
  workers: Math.max(2, Math.floor(os.cpus().length / 2)),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    browserName: 'chromium',
    launchOptions: executablePath ? { executablePath } : {},
    viewport: { width: 1400, height: 900 },
    locale: 'ja-JP',
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
});
