// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The user manual (src/ts/22-help.ts): its figures and tables have ids and captions, and the text refers to each
// of them; the English and the Japanese text have the same figures and tables in the same places
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, plain } from './harness.ts';

const HELP = plain(fresh().HELP) as { id: string; en: [string, string]; ja: [string, string] }[];
// the ids of the figures and tables of a text, in order
const items = (html: string) =>
  [...html.matchAll(/<(figure|table)\b([^>]*)>/g)].map(m => {
    const id = m[2].match(/data-id="([\w-]+)"/);
    assert.ok(id, `<${m[1]}${m[2]}> has no data-id`);
    return `${m[1]}:${id[1]}`;
  });

for (const lang of ['en', 'ja'] as const) {
  test(`manual (${lang}): every figure and table has a caption and is referred to; every reference has its target`, () => {
    const all = HELP.map(s => s[lang][1]).join('\n'),
      ids = items(all).map(i => i.split(':')[1]),
      refs = [...all.matchAll(/<a class="hp-ref" href="#" data-ref="([\w-]+)"><\/a>/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, 'an id is used twice');
    for (const m of all.matchAll(/<table\b[^>]*>\s*(<caption>)?/g)) assert.ok(m[1], `a table without a caption`);
    for (const m of all.matchAll(/<figure\b[^>]*>\s*(<figcaption>)?/g)) assert.ok(m[1], `a figure without a caption`);
    for (const id of ids) assert.ok(refs.includes(id), `${id} is not referred to in the text`);
    for (const r of refs) assert.ok(ids.includes(r), `the reference ${r} has no figure or table`);
    // every reference is written as an empty link (its text is the number, filled in when the manual is shown)
    assert.equal((all.match(/class="hp-ref"/g) || []).length, refs.length);
  });
}

test('manual: the English and the Japanese text have the same figures and tables in the same sections', () => {
  for (const s of HELP) assert.deepEqual(items(s.ja[1]), items(s.en[1]), s.id);
});
