// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Publishing a new version as text replacements (scripts/publish-edits.ts) and the compact script of the page
// (scripts/build.ts) that keeps those replacements small and free of long runs of spaces
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build, buildScript, compact, scriptParts } from '../scripts/build.ts';
import { MAX_EDITS, applyEdits, makeChecks, makeEdits } from '../scripts/publish-edits.ts';

const page = build().html;
const lines = page.split('\n');
// The page with the given lines replaced (index → new text, or null to delete the line)
const changed = (ch: Record<number, string | null>) =>
  lines.flatMap((l, i) => (i in ch ? (ch[i] === null ? [] : [ch[i] as string]) : [l])).join('\n');

test('the edits turn the published page into the new one, each old text unique when it is applied', () => {
  const brace = lines.findIndex((l, i) => i > 6000 && l === '  }'); // a line that occurs many times
  const cases: [string, string][] = [
    ['one line', changed({ 5: '<meta name="version" content="9.9.9">' })],
    ['a repeated line', changed({ [brace]: '  } // changed' })],
    ['insert and delete', changed({ 100: lines[100] + '\n/* new */', 4000: null, 9000: 'x = 1;\n' + lines[9000] })],
    ['first and last lines', changed({ 0: '<!doctype html>', [lines.length - 2]: lines[lines.length - 2] + ' ' })],
  ];
  for (const [name, next] of cases) {
    const edits = makeEdits(page, next);
    assert.equal(applyEdits(page, edits), next, name);
    assert.ok(edits.length >= 1 && edits.length <= 3, `${name}: ${edits.length} edits`);
    assert.ok(
      edits.every(e => e.old_text.length < 2000),
      `${name}: an old text is long`,
    );
  }
  assert.deepEqual(makeEdits(page, page), []);
});

test('many scattered changes are merged into at most 64 edits', () => {
  const ch: Record<number, string> = {};
  for (let i = 50; i < lines.length - 50; i += Math.floor(lines.length / 150)) ch[i] = lines[i] + ' /* c */';
  const next = changed(ch),
    edits = makeEdits(page, next);
  assert.ok(edits.length <= MAX_EDITS, `${edits.length} edits`);
  assert.equal(applyEdits(page, edits), next);
});

test('the compact page script only drops blanks, keeps the lines and runs', () => {
  for (const { file, ts, js } of scriptParts()) {
    const c = compact(ts, js);
    assert.equal(c.split('\n').length, js.split('\n').length, `${file}: lines`);
    assert.equal(c.replace(/\s/g, ''), js.replace(/\s/g, ''), `${file}: more than blanks removed`);
    assert.ok(!/\S {4,}\S/.test(c), `${file}: a long run of spaces is left`);
    assert.ok(c.length < js.length || !/\S/.test(js), `${file}: nothing removed`);
  }
  // the script compiles, and the page uses the compact one
  const { js } = buildScript({ compact: true });
  assert.doesNotThrow(() => new vm.Script(js));
  assert.ok(page.includes(js.slice(0, 2000)));
  assert.ok(!/\S {4,}\S/.test(js.replace(/\/\*[\s\S]*?\*\//g, '')));
});

test('the checks after publishing read the changed lines of the new page', () => {
  const added = Array.from({ length: 100 }, (_, i) => `/* added ${i} */`).join('\n');
  const next = changed({ 5: '<meta name="version" content="9.9.9">', 3000: null, 6000: lines[6000] + '\n' + added }),
    nl = next.split('\n'),
    checks = makeChecks(page, next);
  // what each check expects is what the new page has there (offset counted from 1, as read_artifact does)
  for (const c of checks) assert.equal(c.text, nl.slice(c.offset - 1, c.offset - 1 + c.limit).join('\n'));
  const read = (i: number) => checks.some(c => i >= c.offset - 1 && i < c.offset - 1 + c.limit);
  assert.ok(read(5), 'the changed line');
  assert.ok(read(2999) && read(3000), 'the lines around the deleted one');
  // the 100 added lines (6000 … 6099 in the new page, 0-based, after the deleted line): first and last 3, and samples
  for (const i of [6000, 6002, 6097, 6099, 6040]) assert.ok(read(i), `added line ${i}`);
  assert.ok(!read(6020), 'not every added line is read');
  assert.ok(checks.length <= 6, `${checks.length} reads`);
  assert.deepEqual(makeChecks(page, page), []);
});
