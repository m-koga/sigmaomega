// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Test coverage of the page script (src/ts/*.ts)
//   npm run coverage            unit tests and browser tests
//   npm run coverage -- --unit  unit tests only (no browser needed)
// The unit tests are run with V8 coverage (NODE_V8_COVERAGE), the browser tests with Playwright's
// JavaScript coverage (COV_DIR, see ui/fixtures.ts). The ranges are mapped back to the source files.
// Output: a table on the console, coverage/summary.json, coverage/uncovered.txt (functions never run) and
// coverage/uncovered-lines.txt (code lines not run, by file, as ranges).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildScript, scriptParts, I18N_MARK } from './build.ts';

const ROOT = path.join(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'coverage');
const unitOnly = process.argv.includes('--unit');

// ---- run the tests with coverage
function run(cmd: string, args: string[], env: Record<string, string>): boolean {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: process.platform === 'win32',
  });
  return r.status === 0;
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'unit'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'ui'), { recursive: true });
let ok = run(process.execPath, [path.join(import.meta.dirname, 'build.ts')], {});
ok = run(process.execPath, ['--test', 'tests/*.test.ts'], { NODE_V8_COVERAGE: path.join(OUT, 'unit') }) && ok;
if (!unitOnly) {
  // the browser tests run on a page whose script keeps every character in place (the published page is compacted),
  // so that the coverage can be mapped to the source files (ui/global-setup.ts builds it when COV_DIR is set);
  // the normal page is built again afterwards
  try {
    ok = run('npx', ['playwright', 'test'], { COV_DIR: path.join(OUT, 'ui') }) && ok;
  } finally {
    run(process.execPath, [path.join(import.meta.dirname, 'build.ts')], {});
  }
}

// ---- the page script and the place of each source file in it
const { js } = buildScript(); // the unit tests run the same script without 99-init.ts (same offsets)
const i18n = fs.readFileSync(path.join(ROOT, 'src', 'i18n.json'), 'utf8').replace(/\s+$/, '');
/** A source file in the page script: [start, end) offsets and the range of the inserted dictionary */
interface Part {
  f: string;
  start: number;
  end: number;
  data: [number, number] | null;
}
const parts: Part[] = [];
let pos = 0;
// (type stripping keeps every character in place, so offsets and lines are those of src/ts)
for (const { file: f, js: s } of scriptParts()) {
  let t = s,
    data: [number, number] | null = null;
  const k = t.indexOf(I18N_MARK);
  if (k >= 0) {
    data = [pos + k, pos + k + i18n.length];
    t = t.replace(I18N_MARK, () => i18n);
  } // dictionary: data, not code
  parts.push({ f, start: pos, end: pos + t.length, data });
  pos += t.length;
}
if (pos !== js.length) throw new Error('source files do not add up to the page script');

// ---- merge the coverage: a character is covered if the innermost range containing it ran at least once
// V8 coverage of one script: functions with their ranges (offsets in the script) and call counts
interface V8Range {
  startOffset: number;
  endOffset: number;
  count: number;
}
interface V8Script {
  url?: string;
  source?: string;
  functions: { functionName: string; ranges: V8Range[] }[];
}
/** Coverage of the page script: covered characters, and call counts of the functions by start offset */
interface Coverage {
  covered: Uint8Array;
  fn: Map<number, { name: string; count: number }>;
}
function collect(dir: string, kind: 'unit' | 'ui'): Coverage {
  const covered = new Uint8Array(js.length),
    fn: Coverage['fn'] = new Map();
  if (!fs.existsSync(dir)) return { covered, fn };
  for (const file of fs.readdirSync(dir)) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    for (const r of (Array.isArray(d) ? d : d.result || []) as V8Script[]) {
      let base = 0;
      if (kind === 'unit') {
        if (!String(r.url).includes('page script')) continue;
      } else {
        if (!r.source || !r.source.includes(js)) continue;
        base = r.source.indexOf(js);
      }
      const ranges = r.functions
        .flatMap(f => f.ranges)
        .sort((a, b) => b.endOffset - b.startOffset - (a.endOffset - a.startOffset));
      const cnt = new Int8Array(js.length).fill(-1);
      for (const g of ranges) {
        const v = g.count > 0 ? 1 : 0;
        for (let i = Math.max(0, g.startOffset - base), e = Math.min(js.length, g.endOffset - base); i < e; i++)
          cnt[i] = v;
      }
      for (let i = 0; i < js.length; i++) if (cnt[i] === 1) covered[i] = 1;
      for (const f of r.functions) {
        const g = f.ranges[0],
          start = g.startOffset - base;
        if (start < 0 || g.endOffset - base > js.length || g.endOffset - g.startOffset >= js.length - 1) continue; // the whole script
        const e = fn.get(start) || { name: f.functionName, count: 0 };
        e.count += g.count;
        fn.set(start, e);
      }
    }
  }
  return { covered, fn };
}
const unit = collect(path.join(OUT, 'unit'), 'unit');
const ui = unitOnly ? null : collect(path.join(OUT, 'ui'), 'ui');
const all: Coverage = { covered: unit.covered.map((v, i) => v | (ui ? ui.covered[i] : 0)), fn: new Map(unit.fn) };
if (ui)
  for (const [k, e] of ui.fn) {
    const a = all.fn.get(k) || { name: e.name, count: 0 };
    all.fn.set(k, { name: a.name || e.name, count: a.count + e.count });
  }

// ---- per file: lines (first character of each code line), code characters, functions
const code = js
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:'"\\])\/\/.*$/gm, (m, a) => a + ' '.repeat(m.length - a.length)); // comments do not count
const lineOf = (i: number) => js.slice(0, i).split('\n').length;
/** Counts of one file: code lines, code characters and functions, and how many of them ran */
interface Row {
  file: string;
  lines: number;
  linesHit: number;
  chars: number;
  charsHit: number;
  fns: number;
  fnsHit: number;
}
function measure(c: Coverage): Row[] {
  return parts.map(p => {
    let lines = 0,
      linesHit = 0,
      chars = 0,
      charsHit = 0,
      fns = 0,
      fnsHit = 0,
      ls = p.start;
    const inData = (i: number) => !!p.data && i >= p.data[0] && i < p.data[1];
    for (let i = p.start; i <= p.end; i++) {
      if (i === p.end || js[i] === '\n') {
        const k = code.slice(ls, i).search(/\S/);
        if (k >= 0 && !inData(ls)) {
          lines++;
          if (c.covered[ls + k]) linesHit++;
        }
        ls = i + 1;
      }
      if (i < p.end && !inData(i) && /\S/.test(code[i])) {
        chars++;
        if (c.covered[i]) charsHit++;
      }
    }
    for (const [k, e] of c.fn)
      if (k >= p.start && k < p.end) {
        fns++;
        if (e.count > 0) fnsHit++;
      }
    return { file: p.f, lines, linesHit, chars, charsHit, fns, fnsHit };
  });
}
const pct = (a: number, b: number) => (b ? (100 * a) / b : 100);
const total = (rows: Row[]) =>
  rows.reduce(
    (t, r) => {
      for (const k of ['lines', 'linesHit', 'chars', 'charsHit', 'fns', 'fnsHit'] as const) t[k] += r[k];
      return t;
    },
    { file: 'TOTAL', lines: 0, linesHit: 0, chars: 0, charsHit: 0, fns: 0, fnsHit: 0 } as Row,
  );
const rUnit = measure(unit),
  rUi = ui ? measure(ui) : null,
  rAll = measure(all);
const f1 = (v: number) => v.toFixed(1).padStart(6) + '%';
console.log('\nCoverage of src/ts (code characters; lines and functions for all tests together)\n');
console.log(
  'file'.padEnd(22) +
    'unit'.padStart(8) +
    (ui ? 'browser'.padStart(9) + 'all'.padStart(8) : '') +
    '   lines   functions',
);
[...rAll, total(rAll)].forEach((r, i) => {
  const u = i < rAll.length ? rUnit[i] : total(rUnit),
    b = rUi && (i < rAll.length ? rUi[i] : total(rUi));
  console.log(
    r.file.padEnd(22) +
      f1(pct(u.charsHit, u.chars)) +
      (b ? ' ' + f1(pct(b.charsHit, b.chars)) + f1(pct(r.charsHit, r.chars)) : '') +
      ' ' +
      f1(pct(r.linesHit, r.lines)) +
      '   ' +
      `${r.fnsHit}/${r.fns}`.padStart(7),
  );
});

// ---- files
const summary = {
  unitOnly,
  files: rAll.map((r, i) => ({ ...r, unit: rUnit[i], browser: rUi ? rUi[i] : null })),
  total: total(rAll),
};
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
const never = [...all.fn]
  .filter(([, e]) => e.count === 0)
  .sort((a, b) => a[0] - b[0])
  .map(([k, e]) => {
    const p = parts.find(x => k >= x.start && x.end > k)!; // every function is in one of the files
    let line = lineOf(k) - lineOf(p.start) + 1;
    if (p.data && k >= p.data[1]) line -= i18n.split('\n').length - 1; // the inserted dictionary is not in the source file
    return `src/ts/${p.f}:${line}  ${e.name || js.slice(k, k + 50).replace(/\s+/g, ' ')}`;
  });
fs.writeFileSync(path.join(OUT, 'uncovered.txt'), never.join('\n') + '\n');
console.log(`\nFunctions never run: ${never.length} (listed in coverage/uncovered.txt)`);

// Code lines not run (the first character of the line not covered), as ranges per file
const lineRanges = parts.map(p => {
  const lines: number[] = [];
  let ls = p.start,
    n = 1;
  for (let i = p.start; i <= p.end; i++) {
    if (i === p.end || js[i] === '\n') {
      const k = code.slice(ls, i).search(/\S/);
      if (k >= 0 && !(p.data && ls >= p.data[0] && ls < p.data[1]) && !all.covered[ls + k]) lines.push(n);
      if (!(p.data && ls >= p.data[0] && ls < p.data[1])) n++;
      ls = i + 1;
    }
  }
  const ranges: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let j = i;
    while (j + 1 < lines.length && lines[j + 1] === lines[j] + 1) j++;
    ranges.push(i === j ? `${lines[i]}` : `${lines[i]}-${lines[j]}`);
    i = j;
  }
  return `src/ts/${p.f}: ${ranges.join(', ') || '—'}`;
});
fs.writeFileSync(path.join(OUT, 'uncovered-lines.txt'), lineRanges.join('\n') + '\n');
if (!ok) {
  console.error('Some tests failed.');
  process.exit(1);
}
