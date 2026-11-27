// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The user manual (src/help/<lang>.html, shown by src/ts/84-help.ts): every language of the page has it; its figures
// and tables have ids and captions, and the text refers to each of them; every language has the same chapters,
// figures, tables, references and markup of names (<b>, <i>, <code>, <kbd>) as the English text, in the same places
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, plain } from './harness.ts';

const api = fresh(),
  HELP = plain(api.HELP) as Record<string, [string, string, string][]>,
  LANGS = Object.keys(api.LANGUAGES);
// the ids of the figures and tables of a text, in order
const items = (html: string) =>
  [...html.matchAll(/<(figure|table)\b([^>]*)>/g)].map(m => {
    const id = m[2].match(/data-id="([\w-]+)"/);
    assert.ok(id, `<${m[1]}${m[2]}> has no data-id`);
    return `${m[1]}:${id[1]}`;
  });
// the references to figures and tables, the screenshots, and the number of each structural tag, of a text
const refs = (html: string) =>
  [...html.matchAll(/<a class="hp-ref" href="#" data-ref="([\w-]+)"><\/a>/g)].map(m => m[1]);
const imgs = (html: string) => [...html.matchAll(/<figure class="hp-fig" data-img="([\w-]+)"/g)].map(m => m[1]);
const TAGS = ['p', 'h4', 'ol', 'ul', 'li', 'dl', 'dt', 'dd', 'table', 'tr', 'td', 'th', 'figure', 'code', 'kbd'];
const tags = (html: string) =>
  Object.fromEntries(TAGS.map(t => [t, (html.match(new RegExp(`<${t}[\\s>]`, 'g')) || []).length]));

test('the manual is written in every language of the page', () => {
  assert.deepEqual(Object.keys(HELP).sort(), [...LANGS].sort());
});

for (const lang of LANGS) {
  test(`manual (${lang}): every figure and table has a caption and is referred to; every reference has its target`, () => {
    const all = HELP[lang].map(c => c[2]).join('\n'),
      ids = items(all).map(i => i.split(':')[1]),
      rs = refs(all);
    assert.equal(new Set(ids).size, ids.length, 'an id is used twice');
    for (const m of all.matchAll(/<table\b[^>]*>\s*(<caption>)?/g)) assert.ok(m[1], `a table without a caption`);
    for (const m of all.matchAll(/<figure\b[^>]*>\s*(<figcaption>)?/g)) assert.ok(m[1], `a figure without a caption`);
    for (const id of ids) assert.ok(rs.includes(id), `${id} is not referred to in the text`);
    for (const r of rs) assert.ok(ids.includes(r), `the reference ${r} has no figure or table`);
    // every reference is written as an empty link (its text is the number, filled in when the manual is shown)
    assert.equal((all.match(/class="hp-ref"/g) || []).length, rs.length);
  });
  if (lang === 'en') continue;
  test(`manual (${lang}): the same chapters, figures, tables, references and structure as the English text`, () => {
    assert.deepEqual(
      HELP[lang].map(c => c[0]),
      HELP.en.map(c => c[0]),
      'chapters',
    );
    HELP.en.forEach(([id, , en], i) => {
      const t = HELP[lang][i][2];
      assert.deepEqual(items(t), items(en), `${id}: figures and tables`);
      assert.deepEqual(refs(t), refs(en), `${id}: references`);
      assert.deepEqual(imgs(t), imgs(en), `${id}: screenshots`);
      assert.deepEqual(tags(t), tags(en), `${id}: structure`);
    });
  });
}
