// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The modules of src/ts are in layers: a file imports only from files with a lower number, so that there are no
// cycles and a file can be read (and changed) knowing only the files below it. Files 01-12 compute (math,
// definitions, state, responses, tuning, specifications, sweep) and do not touch the page; 13 and above show it.
// And no function is too long.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as prettier from 'prettier';

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

// The longest a function may be: a longer one is split into named parts (each with a comment saying what it does),
// so that every function can be read and tested on its own. Tables of data (the change log, the manual) are not
// functions and are not counted.
const MAX_FUNCTION_LINES = 80;
// The syntax tree of a file, from the parser Prettier formats the sources with (not part of Prettier's typed API)
const parse = (text: string) =>
  (prettier as unknown as { __debug: { parse(t: string, o: object): Promise<{ ast: unknown }> } }).__debug.parse(text, {
    parser: 'babel-ts',
  });
test(`no function is longer than ${MAX_FUNCTION_LINES} lines`, async () => {
  const long: string[] = [];
  const walk = (n: unknown, file: string, name: string) => {
    if (!n || typeof n !== 'object') return;
    const node = n as { type?: string; loc?: { start: { line: number }; end: { line: number } } } & Record<
      string,
      unknown
    >;
    let here = name;
    if (typeof node.type === 'string' && /Function|ObjectMethod|ClassMethod/.test(node.type) && node.loc) {
      const id = (node.id as { name?: string } | undefined)?.name;
      here = id ?? name;
      const lines = node.loc.end.line - node.loc.start.line + 1;
      if (lines > MAX_FUNCTION_LINES)
        long.push(`${file}:${node.loc.start.line} ${here || '(function)'}: ${lines} lines`);
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'loc' || k.endsWith('omments')) continue;
      const child =
        node.type === 'VariableDeclarator' && k === 'init' ? ((node.id as { name?: string }).name ?? here) : here;
      if (Array.isArray(v)) v.forEach(c => walk(c, file, child));
      else walk(v, file, child);
    }
  };
  for (const f of files) {
    const { ast } = await parse(source(f));
    walk(ast, f, '');
  }
  assert.deepEqual(long, [], `functions longer than ${MAX_FUNCTION_LINES} lines:\n` + long.join('\n'));
});
