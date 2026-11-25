// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Leftovers of removed features: dictionary entries, style rules and stored layout items that nothing uses any more.
// When one of these tests fails after a change, remove what it names (or, if it is still used in a way these tests
// do not see, say so in the code that uses it)
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, load } from './harness.ts';
import { uiStrings } from './ui-strings.ts';

const { api, html } = load();
// (the build keeps the columns of the source: type annotations become spaces, hence \s* in the patterns)
const part = (s: string, re: RegExp) => re.exec(s)?.[0] ?? '';
// The script of the page without the dictionary and the change log (they name every key and old features)
const script = ([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()?.[1] ?? '')
  .replace(/const I18N\s*=\s*\{[\s\S]*?\n(?=\s*\/\*\* The display languages)/, '')
  .replace(/const CHANGELOG\s*=\s*\[[\s\S]*?\n\];/, '');
const style = part(html, /<style>[\s\S]*?<\/style>/);
const body = part(html, /<body>[\s\S]*?(?=<script>)/);
// The ways a string is written in the script
const quoted = (k: string) => {
  const esc = (q: string) => k.replace(/\\/g, '\\\\').replaceAll(q, '\\' + q);
  return [`'${esc("'")}'`, JSON.stringify(k), '`' + esc('`') + '`'];
};

test('every dictionary entry is still used by the page', () => {
  const used = new Set(uiStrings(api, html));
  const unused = Object.keys(api.I18N).filter(k => !used.has(k) && !quoted(k).some(q => script.includes(q)));
  assert.deepEqual(unused, [], 'dictionary entries nothing uses (src/i18n.json):\n' + unused.join('\n'));
});

test('every class and id of the style sheet is still used by the page', () => {
  // the selectors only: comments and the declarations (colours such as #fff) taken out
  let sel = style.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let prev = ''; prev !== sel;) [prev, sel] = [sel, sel.replace(/\{[^{}]*\}/g, ' ')];
  const names = new Set([...sel.matchAll(/[.#]([a-zA-Z][\w-]*)/g)].map(m => m[1]));
  const page = body + script;
  const unused = [...names].filter(n => !new RegExp(`(^|[^\\w-])${n}($|[^\\w-])`).test(page));
  assert.deepEqual(unused, [], 'style rules for classes or ids nothing uses (src/style.css):\n' + unused.join('\n'));
});

test('every item of the stored layout is still used by the page', () => {
  // without the places that only list, copy or check the items: the defaults, the reading of the stored layout and
  // the check of a scenario's layout
  let s = script
    .replace(/function defaultLayout\(\)[\s\S]*?\n\}\n/, '')
    .replace(/function scLayout\([\s\S]*?\n\}\n/, '');
  s = s.replace(/^\s*(\w+): s\.\1\b[^\n]*$/gm, '');
  const unused = Object.keys(fresh().defaultLayout()).filter(
    k => !new RegExp(`\\.${k}\\b|'${k}'|[{,]\\s*${k}\\s*[,}]`).test(s),
  );
  assert.deepEqual(unused, [], 'layout items nothing reads (Layout in src/ts/types.d.ts):\n' + unused.join('\n'));
});
