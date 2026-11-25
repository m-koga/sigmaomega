// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The files of the GitHub Pages site: index.html (the build of src/, with a link to the web app manifest and the
// colour of the browser's title bar added in its head), the manifest src/manifest.webmanifest and the icons it
// names (src/icon-192.png, icon-512.png, icon-maskable-512.png; made by npm run icon). The claude.ai artifact
// cannot hold these extra files, so the page there has no manifest.
//   Usage: npm run pages              (writes site/, which is not committed)
//          npm run pages -- <folder>  (writes another folder)
import fs from 'node:fs';
import path from 'node:path';
import { build } from './build.ts';

const ROOT = path.join(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
export const MANIFEST = 'manifest.webmanifest';
// put after the home-screen icon in the head
const ANCHOR = /(<link rel="apple-touch-icon" href="[^"]*">\n)/;

export function pagesFiles(): Record<string, string | Buffer> {
  const manifest = fs.readFileSync(path.join(SRC, MANIFEST), 'utf8');
  const { icons, theme_color } = JSON.parse(manifest) as { icons: { src: string }[]; theme_color: string };
  const { html } = build();
  if (!ANCHOR.test(html)) throw new Error('the apple-touch-icon link was not found in index.html');
  const files: Record<string, string | Buffer> = {
    'index.html': html.replace(
      ANCHOR,
      `$1<link rel="manifest" href="${MANIFEST}">\n<meta name="theme-color" content="${theme_color}">\n`,
    ),
    [MANIFEST]: manifest,
  };
  for (const { src } of icons) files[src] = fs.readFileSync(path.join(SRC, src));
  return files;
}

if (process.argv[1] === import.meta.filename) {
  const out = path.resolve(process.argv[2] ?? path.join(ROOT, 'site'));
  fs.mkdirSync(out, { recursive: true });
  for (const [name, data] of Object.entries(pagesFiles())) {
    fs.writeFileSync(path.join(out, name), data);
    console.log(`${path.relative(ROOT, path.join(out, name))}: ${(Buffer.byteLength(data) / 1024).toFixed(1)} KB`);
  }
}
