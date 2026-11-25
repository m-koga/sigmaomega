// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Every source file starts with the SPDX license identifier and the copyright line (Apache-2.0, see LICENSE);
// a new file needs them too
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const LINES = ['SPDX-License-Identifier: Apache-2.0', 'Copyright 2026 Masanobu Koga'];
const ts = LINES.map(l => `// ${l}\n`).join('');
const list = (dir: string, ext: string) =>
  fs
    .readdirSync(path.join(ROOT, dir))
    .filter(f => f.endsWith(ext))
    .map(f => `${dir}/${f}`);

const HEADERS: [string[], string][] = [
  [
    [
      ...list('src/ts', '.ts'),
      ...list('scripts', '.ts'),
      ...list('tests', '.ts'),
      ...list('ui', '.ts'),
      'playwright.config.ts',
    ],
    ts,
  ],
  [['src/style.css'], LINES.map(l => `/* ${l} */\n`).join('')],
  [list('.github/workflows', '.yml'), LINES.map(l => `# ${l}\n`).join('')],
  [['ui/start.html'], '<!doctype html>\n' + LINES.map(l => `<!-- ${l} -->\n`).join('')],
];

test('every source file starts with the SPDX identifier and the copyright line', () => {
  const missing = HEADERS.flatMap(([files, head]) =>
    files.filter(f => !fs.readFileSync(path.join(ROOT, f), 'utf8').startsWith(head)),
  );
  assert.deepEqual(missing, []);
  assert.match(
    fs.readFileSync(path.join(ROOT, 'src/icon.svg'), 'utf8'),
    /SPDX-License-Identifier: Apache-2\.0\. Copyright 2026 Masanobu Koga/,
  );
});
