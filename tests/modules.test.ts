// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// The modules of src/ts are in layers, and the number of a file says its layer (LAYERS): a file imports only from
// files with a lower number, so that there are no cycles and a file can be read (and changed) knowing only the
// files below it. The basics, the model and the computing (math, definitions, state, responses, analyses, tuning,
// specifications, sweep) do not touch the page; the layers from 40 show it. Each file holds one topic, said in its
// title, and is not too long; and no function is too long.
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
/* The layers, from the bottom: the numbers of their files (with room for new files), and whether they may use the
   page. A new file gets a free number in its layer, next to the files it belongs with. */
const LAYERS = [
  { name: 'basics', first: 1, last: 9, page: false }, // change log, translation, math, parser
  { name: 'model', first: 10, last: 14, page: false }, // definitions, settings
  { name: 'computing', first: 15, last: 39, page: false }, // responses, analyses of the loop, tuning, specs, sweep
  { name: 'page basics', first: 40, last: 44, page: true }, // elements, files, messages; view state
  { name: 'showing', first: 45, last: 69, page: true }, // plots, panels, formulas, update() and redraw()
  { name: 'controls', first: 70, last: 98, page: true }, // settings panel, interaction, layout, scenarios, help
  { name: 'start-up', first: 99, last: 99, page: true },
];
const layerOf = (f: string) => LAYERS.find(l => num(f) >= l.first && num(f) <= l.last);
// The longest a file may be (lines): a longer one holds more than one topic and is split. The change log is data.
const MAX_FILE_LINES = 600;
const DATA_FILES = ['01-changelog.ts'];
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

test('every file is in a layer', () => {
  assert.deepEqual(
    files.filter(f => !layerOf(f)),
    [],
  );
  assert.ok(
    files.some(f => num(f) === 99),
    'the start-up file',
  );
});

test('every file starts with its title (what it holds) after the license lines', () => {
  const bad = files.filter(f => !/^(?:\/\/[^\n]*\n){2}\/\* =+ \S[^\n]* =+/.test(source(f)));
  assert.deepEqual(bad, []);
});

test(`no file is longer than ${MAX_FILE_LINES} lines (one topic per file)`, () => {
  const long = files
    .filter(f => !DATA_FILES.includes(f))
    .map(f => [f, source(f).split('\n').length - 1] as const)
    .filter(([, n]) => n > MAX_FILE_LINES)
    .map(([f, n]) => `${f}: ${n} lines`);
  assert.deepEqual(long, []);
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

test('the basics, the model and the computing (files 01-39) do not touch the page', () => {
  const bad: string[] = [];
  for (const f of files.filter(f => !layerOf(f)?.page)) {
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
