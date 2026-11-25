// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The files of the GitHub Pages site (scripts/pages.ts): the page with its manifest link, the manifest and its icons
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../scripts/build.ts';
import { MANIFEST, pagesFiles } from '../scripts/pages.ts';

const pngSize = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];

test('pages: index.html is the build with the manifest link and the theme colour added, nothing else', () => {
  const files = pagesFiles(),
    page = files['index.html'] as string,
    m = JSON.parse(files[MANIFEST] as string);
  const added = `<link rel="manifest" href="${MANIFEST}">\n<meta name="theme-color" content="${m.theme_color}">\n`;
  assert.equal(page.split(added).length, 2);
  assert.equal(page.replace(added, ''), build().html);
  assert.ok(page.indexOf(added) < page.indexOf('</head>'));
});

test('pages: the manifest names the app and its icons, and every icon is there with its size', () => {
  const files = pagesFiles(),
    m = JSON.parse(files[MANIFEST] as string);
  assert.equal(m.short_name, 'SigmaOmega');
  assert.match(m.name, /^SigmaOmega/);
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  for (const c of [m.theme_color, m.background_color]) assert.match(c, /^#[0-9a-f]{6}$/);
  const sizes = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`).sort();
  assert.deepEqual(sizes, ['192x192 any', '512x512 any', '512x512 maskable']);
  for (const i of m.icons) {
    const b = files[i.src] as Buffer;
    assert.ok(Buffer.isBuffer(b), `${i.src} is missing`);
    assert.equal(b.toString('latin1', 1, 4), 'PNG');
    assert.deepEqual(pngSize(b), i.sizes.split('x').map(Number), i.src);
  }
  // the only files: the page, the manifest and the icons
  assert.deepEqual(
    Object.keys(files).sort(),
    ['index.html', MANIFEST, ...m.icons.map((i: { src: string }) => i.src)].sort(),
  );
});
