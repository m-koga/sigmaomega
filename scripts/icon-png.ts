// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Make the PNG icons from src/icon.svg (run again after changing it: npm run icon && npm run build)
//   src/icon-180.png           home screen of iOS (apple-touch-icon, put into the page by the build); full-bleed,
//                              because the phone rounds the corners itself
//   src/icon-192.png, -512.png the web app manifest (Android and desktop install), purpose "any": with the rounded
//                              corners of the SVG and transparent corners
//   src/icon-maskable-512.png  the manifest, purpose "maskable": full-bleed, the drawing shrunk to 80 % so that it
//                              stays inside the safe zone when the system cuts the icon into a circle or a squircle
// The manifest and the 192/512 icons are used only by the GitHub Pages site (npm run pages, scripts/pages.ts).
// Uses CHROME_PATH, or /usr/bin/google-chrome when it exists, or Playwright's own Chromium; Python 3 with Pillow
// makes the files smaller.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const SRC = path.join(root, 'src');

type Mode = 'full' | 'rounded' | 'maskable';
export const ICONS: { file: string; size: number; mode: Mode }[] = [
  { file: 'icon-180.png', size: 180, mode: 'full' },
  { file: 'icon-192.png', size: 192, mode: 'rounded' },
  { file: 'icon-512.png', size: 512, mode: 'rounded' },
  { file: 'icon-maskable-512.png', size: 512, mode: 'maskable' },
];

// the SVG without its rounded corners
export const fullBleed = (svg: string) => svg.replace(/(<rect width="64" height="64") rx="[\d.]+"/, '$1');
// full-bleed, and everything drawn on the background shrunk to 80 % around the centre
export const maskable = (svg: string) =>
  fullBleed(svg)
    .replace(/(<rect width="64" height="64"[^>]*\/>)/, '$1<g transform="translate(6.4 6.4) scale(0.8)">')
    .replace(/<\/svg>\s*$/, '</g></svg>\n');

export function iconSvg(mode: Mode) {
  const svg = fs.readFileSync(path.join(SRC, 'icon.svg'), 'utf8');
  return mode === 'full' ? fullBleed(svg) : mode === 'maskable' ? maskable(svg) : svg;
}

if (process.argv[1] === import.meta.filename) {
  const chrome =
    process.env.CHROME_PATH || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
  const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
  for (const { file, size, mode } of ICONS) {
    const out = path.join(SRC, file);
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">` +
        iconSvg(mode).replace('<svg ', `<svg width="${size}" height="${size}" `) +
        `</body></html>`,
    );
    // transparent corners only for the rounded icons
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: size, height: size }, omitBackground: true });
    await page.close();
    execFileSync('python3', [
      '-c',
      `import sys
from PIL import Image
im = Image.open(sys.argv[1])
im = im.convert('RGBA' if sys.argv[2] == 'rounded' else 'RGB')
im.save(sys.argv[1], optimize=True)`,
      out,
      mode,
    ]);
    console.log(
      `${path.relative(root, out)}: ${size}×${size} ${mode}, ${(fs.statSync(out).size / 1024).toFixed(1)} KB`,
    );
  }
  await browser.close();
}
