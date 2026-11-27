// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// i18n tests: UI strings are written in English and translated into Japanese, Chinese, Korean, Thai, French, German, Spanish, Portuguese and Russian through the dictionary
import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './harness.ts';
import { uiStrings } from './ui-strings.ts';

const { api, html } = load();
// the translated languages: every language of the page but English (src/ts/02-i18n.ts, LANGUAGES)
const LANGS = Object.keys(api.LANGUAGES).filter(l => l !== 'en') as (
  'ja' | 'zh' | 'ko' | 'th' | 'fr' | 'de' | 'es' | 'pt' | 'ru'
)[];
const JP = /[぀-ヿ一-鿿]/;
const placeholders = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]))].sort().join(',');
const count = (s: string, sub: string) => s.split(sub).length - 1;

test('the default language follows the browser language (English if not supported)', () => {
  const cases: [string[], string][] = [
    [['ja-JP', 'ja'], 'ja'],
    [['en-US'], 'en'],
    [['zh-CN', 'zh'], 'zh'],
    [['ko-KR'], 'ko'],
    [['th-TH'], 'th'],
    [['fr-FR', 'fr'], 'fr'],
    [['de-DE'], 'de'],
    [['de-AT', 'fr'], 'de'],
    [['es-ES'], 'es'],
    [['es-MX', 'fr'], 'es'],
    [['it-IT', 'ko'], 'ko'],
    [['it-IT', 'pt'], 'pt'],
    [['pt-BR'], 'pt'],
    [['ru-RU'], 'ru'],
    [['it-IT', 'nl'], 'en'],
  ];
  for (const [languages, want] of cases) assert.equal(load({ languages }).api.getLang(), want, `browser ${languages}`);
});

test('every dictionary entry has all translations with matching formatting', () => {
  for (const [en, tr] of Object.entries(api.I18N)) {
    assert.ok(!JP.test(en), `dictionary key contains Japanese: ${en}`);
    for (const l of LANGS) {
      const t = tr[l];
      assert.ok(t && t.length, `missing ${l} translation: ${en}`);
      assert.equal(placeholders(t), placeholders(en), `${l} placeholders differ: ${en}`);
      for (const mark of ['\\(', '\\)', '<code>', '<b>']) {
        assert.equal(count(t, mark), count(en, mark), `${l} count of "${mark}" differs: ${en}`);
      }
    }
  }
});

test('every UI string has a dictionary entry', () => {
  const missing = uiStrings(api, html).filter(k => !api.I18N[k]);
  assert.deepEqual(missing, [], 'strings missing from the dictionary:\n' + missing.join('\n'));
});

test('no Japanese is written directly in the UI strings of index.html', () => {
  let src = html;
  const cut = (from: string, to: string) => {
    const a = src.indexOf(from),
      b = src.indexOf(to, a);
    assert.ok(a >= 0 && b > a, `section not found: ${from}`);
    src = src.slice(0, a) + src.slice(b);
  };
  cut('const I18N', 'const isLang'); // dictionary, and the language table (names of the languages in their scripts)
  cut('const CHANGELOG = [', '\n];'); // change log (ja items)
  cut('const HELP = [', '\n];'); // user manual (ja text)
  src = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/<!--[\s\S]*?-->/g, '');
  const allowed = [
    /aria-label="Language \/ 言語"/,
    /\.replace\(\/\[−–ー\]\/g/, // full-width signs typed in a number
    /\.replace\(\/\[×・\]\/g/, // multiplication signs typed in an expression
    /`図 \$\{n\}`.*`表 \$\{n\}`/, // figure and table labels of the Japanese user manual
  ];
  const left = src
    .split('\n')
    .filter(l => JP.test(l) && !allowed.some(r => r.test(l)))
    .map(l => l.trim().slice(0, 120));
  assert.deepEqual(left, [], 'lines still containing Japanese:\n' + left.join('\n'));
});

test('translation function: language switching and placeholders', () => {
  const s = 'Holding {n} (gray lines)';
  api.setLang('ja');
  assert.equal(api.T(s, { n: 3 }), '保持中：3 本（灰色系の線）');
  api.setLang('ko');
  assert.equal(api.T(s, { n: 3 }), '유지 중: 3개 (회색 선)');
  api.setLang('en');
  assert.equal(api.T(s, { n: 3 }), 'Holding 3 (gray lines)');
  api.setLang('ja');
  assert.equal(api.T('A string not in the dictionary'), 'A string not in the dictionary');
});
