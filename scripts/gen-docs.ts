// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Generate the English (CHANGELOG.md) and Japanese (CHANGELOG.ja.md) change logs
// from the CHANGELOG array in src/ts/01-changelog.ts, read from the built index.html (en: English, ja: Japanese).
//   Usage: npm run docs
import fs from 'node:fs';
import path from 'node:path';
import { load } from '../tests/harness.ts';

const ROOT = path.join(import.meta.dirname, '..');

function render(changelog: { v: string; d: string; en: string[]; ja: string[] }[], lang: 'en' | 'ja'): string {
  const ja = lang === 'ja';
  const head = ja
    ? [
        '# 更新履歴',
        '',
        '[English](CHANGELOG.md) | 日本語',
        '',
        '版番号は[セマンティック バージョニング](https://semver.org/lang/ja/)に従います（機能追加：2 番目、修正・文言：3 番目の数字を上げる）。',
        '',
        '> このファイルは `npm run docs` で `src/ts/01-changelog.ts` の更新履歴から生成されます。直接編集しないでください。',
        '',
      ]
    : [
        '# Change Log',
        '',
        'English | [日本語](CHANGELOG.ja.md)',
        '',
        'Version numbers follow [Semantic Versioning](https://semver.org/) (the second number for new features, the third for fixes and wording).',
        '',
        '> This file is generated from the change log in `src/ts/01-changelog.ts` by `npm run docs`. Do not edit it directly.',
        '',
      ];
  const body = [];
  for (const e of changelog) {
    body.push(ja ? `## v${e.v}（${e.d}）` : `## v${e.v} (${e.d})`);
    for (const item of ja ? e.ja : e.en) body.push('- ' + item);
    body.push('');
  }
  return head.concat(body).join('\n');
}

// Generated content (also used by the tests)
function generate() {
  const { api } = load();
  const cl = JSON.parse(JSON.stringify(api.CHANGELOG));
  return { 'CHANGELOG.md': render(cl, 'en'), 'CHANGELOG.ja.md': render(cl, 'ja') };
}

if (process.argv[1] === import.meta.filename) {
  for (const [name, text] of Object.entries(generate())) {
    fs.writeFileSync(path.join(ROOT, name), text);
    console.log('Generated: ' + name);
  }
}

export { generate };
