// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The single-file index.html must be the build of the sources in src/
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { build, buildScript } from '../scripts/build.ts';

test('index.html is up to date with src/ (npm run build)', () => {
  const cur = fs.readFileSync(path.join(import.meta.dirname, '..', 'index.html'), 'utf8');
  assert.ok(cur === build().html, 'index.html differs from the build of src/. Run: npm run build');
});

test('the version number of the page is the first entry of CHANGELOG', () => {
  const { html, version } = build();
  assert.ok(html.includes(`<meta name="version" content="${version}">`));
  assert.ok(!/@@[A-Z0-9]+@@/.test(html), 'a placeholder is left in the built page');
});

test('the screenshots of the user manual: one in each language for each figure, all in the page', async () => {
  const root = path.join(import.meta.dirname, '..'),
    help = fs.readFileSync(path.join(root, 'src/help/en.html'), 'utf8'),
    figs = [...help.matchAll(/<figure class="hp-fig" data-img="([\w-]+)"/g)].map(m => m[1]),
    names = [...new Set(figs)].sort(),
    langs = fs
      .readdirSync(path.join(root, 'src/help'))
      .filter(f => f.endsWith('.html'))
      .map(f => f.replace('.html', ''));
  // each figure once in the manual (tests/help.test.ts checks that every language has the same ones)
  for (const n of names) assert.equal(figs.filter(f => f === n).length, 1, `figure ${n}`);
  // a picture in each language of the manual for each figure, and no other picture
  const files = fs.readdirSync(path.join(root, 'src/help-img')).sort();
  assert.deepEqual(files, names.flatMap(n => langs.map(l => `${n}.${l}.webp`)).sort());
  // scripts/help-shots.ts takes exactly these
  const { SHOTS } = await import('../scripts/help-shots.ts');
  assert.deepEqual(SHOTS.map(s => s.name).sort(), names);
  // the build puts each one into the page with the width it is shown at
  const { html } = build();
  for (const f of files) {
    const m = html.match(
      new RegExp(`<script type="text/plain" data-help-img="${f.replace('.webp', '')}" data-w="(\\d+)">\\n`),
    );
    assert.ok(m && +m[1] > 200 && +m[1] <= 760, f);
  }
});

test('the icon (src/icon.svg) is in the header and is the favicon', () => {
  const { html } = build();
  const head = html.slice(0, html.indexOf('</head>')),
    m = head.match(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,([^"]+)">/);
  assert.ok(m, 'favicon link');
  const svg = decodeURIComponent(m[1]);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">') && svg.endsWith('</svg>'));
  assert.ok(!/<text\b/.test(svg), 'the icon uses no font');
  const header = html.slice(html.indexOf('<header>'), html.indexOf('</header>'));
  assert.ok(header.includes(`<span class="app-logo" aria-hidden="true">${svg}</span>`));
});

test('the home-screen icon (src/icon-180.png) is a 180×180 PNG without rounded corners, in the page', () => {
  const png = fs.readFileSync(path.join(import.meta.dirname, '..', 'src', 'icon-180.png'));
  assert.equal(png.toString('latin1', 1, 4), 'PNG');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [180, 180]);
  const { html } = build();
  assert.ok(html.includes(`<link rel="apple-touch-icon" href="data:image/png;base64,${png.toString('base64')}">`));
});

test('the copyright notice and the license (package.json, change log), in three places; LICENSE is Apache-2.0', () => {
  const { html } = build();
  const notice = 'Copyright © 2026 Masanobu Koga',
    url = 'https://www.apache.org/licenses/LICENSE-2.0';
  assert.ok(
    html.startsWith(
      `<!DOCTYPE html>\n<!-- SigmaOmega — Feedback Control Simulator. ${notice}. Licensed under the Apache License 2.0 (${url}). -->\n`,
    ),
  );
  assert.ok(html.includes('<meta name="author" content="Masanobu Koga">'));
  const foot = `<div class="cl-foot">${notice} · <a href="${url}" target="_blank" rel="noopener">Apache License 2.0</a></div>`;
  assert.equal(html.split(foot).length - 1, 2);
  const root = path.join(import.meta.dirname, '..');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).license, 'Apache-2.0');
  const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
  assert.match(license, /^\s+Apache License\n\s+Version 2\.0, January 2004\n/);
  assert.match(license, /END OF TERMS AND CONDITIONS/);
  assert.match(fs.readFileSync(path.join(root, 'NOTICE'), 'utf8'), /Copyright 2026 Masanobu Koga/);
});

test('the uncompacted page (coverage of the browser tests) holds the script with every character in place', () => {
  const full = build({ compact: false }).html,
    { js } = buildScript();
  assert.ok(full.includes(js), 'scripts/coverage.ts finds the source files in the page by this script');
  // the published page is the compact one, and differs from the full one only in its script
  const small = build().html;
  assert.ok(!small.includes(js) && small.length < full.length);
});
