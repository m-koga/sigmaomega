// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The modules of src/ts are in layers: a file imports only from files with a lower number, so that there are no
// cycles and a file can be read (and changed) knowing only the files below it. Files 01-12 compute (math,
// definitions, state, responses, tuning, specifications, sweep) and do not touch the page; 13 and above show it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(import.meta.dirname, '..', 'src', 'ts');
const files = fs
  .readdirSync(DIR)
  .filter(f => /^\d\d-[\w-]+\.ts$/.test(f))
  .sort();
const num = (f: string) => Number(f.slice(0, 2));
// The last file of the computing layer (no page access)
const COMPUTE_LAST = 12;
const source = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8');
// The code without comments and string contents (enough to look for names)
const code = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");

test('every file has its own number', () => {
  const nums = files.map(num);
  assert.equal(new Set(nums).size, nums.length, files.join(', '));
});

test('a file imports only from files with a lower number (no cycles)', () => {
  const bad: string[] = [];
  for (const f of files)
    for (const m of source(f).matchAll(/^import (?:type )?\{[^}]*\} from '\.\/([\w.-]+\.ts)';/gm)) {
      const g = m[1];
      assert.ok(files.includes(g), `${f} imports ${g}, which does not exist`);
      if (num(g) >= num(f)) bad.push(`${f} -> ${g}`);
    }
  assert.deepEqual(bad, [], 'imports from a higher-numbered file:\n' + bad.join('\n'));
});

test('the computing files (01-12) do not touch the page', () => {
  const bad: string[] = [];
  for (const f of files.filter(f => num(f) <= COMPUTE_LAST)) {
    const c = code(source(f));
    for (const m of c.matchAll(/\b(document|window)\s*\.|\$\(|\bbyId\(|\bcanvas\b/g)) bad.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(bad, []);
});
