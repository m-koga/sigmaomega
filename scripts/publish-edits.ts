// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Edits that turn the published page into the new index.html, for the artifact tool edit_version, and the lines to
// read back after publishing to check that the edits were copied exactly (<out>-checks.json)
// (an account that may edit the shared artifact but does not own it cannot upload the file with publish_files).
// The page that is live is found by its version number: the newest commit whose index.html has
// <meta name="version" content="X">. The edits are exact replacements, applied in order; each old_text occurs
// exactly once in the page as it stands when it is applied, and applying all of them gives index.html exactly.
//   Usage: npm run edits -- <live version, e.g. 1.62.1> [<out.json>]   (default out: /tmp/publish-edits.json;
//          the checks go to /tmp/publish-edits-checks.json)
// Limits of edit_version: at most 64 edits, at most 64 KiB of old_text in all. Every edit is also copied by hand
// into the call, so the new text is limited to 64 KiB as well (new screenshots of the manual, for example, are
// larger). A larger change has to be published by the owner of the artifact with publish_files.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
export const MAX_EDITS = 64,
  MAX_OLD = 64 * 1024,
  MAX_NEW = 64 * 1024;

export interface Edit {
  old_text: string;
  new_text: string;
}

// Hunks of a line diff (git diff --no-index): old lines [a, a + n) are replaced by the new lines, which are the
// lines [b, b + lines.length) of the new page with their context (0-based)
interface Hunk {
  a: number;
  n: number;
  b: number;
  lines: string[];
}
function diffHunks(oldText: string, newText: string, context: number): Hunk[] {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync('/tmp'), 'edits-')),
    fa = path.join(dir, 'old'),
    fb = path.join(dir, 'new');
  fs.writeFileSync(fa, oldText);
  fs.writeFileSync(fb, newText);
  let out = '';
  try {
    out = execFileSync('git', ['diff', '--no-index', '--no-color', `-U${context}`, fa, fb], {
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    });
  } catch (e) {
    out = (e as { stdout?: string }).stdout ?? ''; // exit code 1: the files differ
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const hunks: Hunk[] = [];
  let h: Hunk | null = null;
  for (const l of out.split('\n')) {
    const m = l.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (m) {
      const n = m[2] === undefined ? 1 : +m[2],
        nb = m[4] === undefined ? 1 : +m[4];
      // a hunk with no old (or no new) lines starts after line a (or b)
      h = { a: n === 0 ? +m[1] : +m[1] - 1, n, b: nb === 0 ? +m[3] : +m[3] - 1, lines: [] };
      hunks.push(h);
    } else if (h && (l[0] === ' ' || l[0] === '+')) h.lines.push(l.slice(1));
  }
  if (/\\ No newline at end of file/.test(out)) throw new Error('both pages must end with a newline');
  return hunks;
}

const count = (s: string, sub: string) => {
  let k = 0;
  for (let i = s.indexOf(sub); i >= 0; i = s.indexOf(sub, i + 1)) if (++k > 1) break;
  return k;
};

// Edits for one context size: each hunk grows by whole lines until its old text is unique in the page as it
// stands when it is applied
function editsFor(oldText: string, newText: string, context: number): Edit[] {
  let cur = oldText.split('\n'); // the last element is '' (the page ends with a newline)
  let shift = 0;
  const edits: Edit[] = [];
  for (const h of diffHunks(oldText, newText, context)) {
    const a = h.a + shift,
      doc = cur.join('\n'),
      text = (x: string[]) => x.map(l => l + '\n').join('');
    // the old lines [s, e) of the hunk, with a line more above (or below, at the top) until they are unique
    let s = a,
      e = a + h.n;
    while (!(e > s && count(doc, text(cur.slice(s, e))) === 1)) {
      if (s > 0) s--;
      else if (e < cur.length - 1) e++;
      else throw new Error('no unique text for a change');
    }
    const oldLines = cur.slice(s, e),
      newLines = [...cur.slice(s, a), ...h.lines, ...cur.slice(a + h.n, e)];
    edits.push({ old_text: text(oldLines), new_text: text(newLines) });
    cur = [...cur.slice(0, s), ...newLines, ...cur.slice(e)];
    shift += newLines.length - oldLines.length;
  }
  if (cur.join('\n') !== newText) throw new Error('the edits do not give the new page');
  return edits;
}

// The edits with the smallest context that gives at most MAX_EDITS of them (nearby changes are merged)
export function makeEdits(oldText: string, newText: string): Edit[] {
  if (oldText === newText) return [];
  for (let c = 1; ; c *= 2) {
    const edits = editsFor(oldText, newText, c);
    if (edits.length <= MAX_EDITS || c > 1 << 16) return withoutTitle(oldText, newText, edits);
  }
}

// edit_version refuses an edit that touches the <title> element unless the artifact is renamed in the same call, so
// an unchanged title line is trimmed off the context of an edit (with the lines between it and the end of the edit).
// The trimmed edits are used only if they still give the new page.
const TITLE = /^<title>.*<\/title>$/;
export function trimTitle(e: Edit): Edit {
  const a = e.old_text.split('\n'),
    b = e.new_text.split('\n');
  let head = 0; // common leading lines
  while (head < a.length - 1 && head < b.length - 1 && a[head] === b[head]) head++;
  let tail = 0; // common trailing lines (the last element is '' after the final newline)
  while (tail < a.length - head - 1 && tail < b.length - head - 1 && a[a.length - 2 - tail] === b[b.length - 2 - tail])
    tail++;
  let from = 0,
    to = 0; // lines to drop at the start and at the end
  for (let i = 0; i < head; i++) if (TITLE.test(a[i])) from = i + 1;
  for (let i = 0; i < tail; i++) if (TITLE.test(a[a.length - 2 - i])) to = i + 1;
  if (!from && !to) return e;
  const cut = (x: string[]) => x.slice(from, x.length - 1 - to).join('\n') + '\n';
  return { old_text: cut(a), new_text: cut(b) };
}
function withoutTitle(oldText: string, newText: string, edits: Edit[]): Edit[] {
  const trimmed = edits.map(trimTitle);
  try {
    if (applyEdits(oldText, trimmed) === newText) return trimmed;
  } catch {
    // an edit became ambiguous: keep the edits as they were
  }
  return edits;
}

/** A check after publishing: the lines [offset, offset + limit) of the published page (1-based, as read_artifact
 * counts them) must be text */
export interface Check {
  offset: number;
  limit: number;
  text: string;
}
// Lines of the new page to read back after publishing, so that a mistake in copying the edits is found: every changed
// region (a hunk of the diff without context) is read whole when it is short (at most 8 lines), otherwise its first
// and last 3 lines and 2 lines every 40 lines in between; a region that only lost lines is checked where they were
// (the lines around the gap). Reads at most 10 lines apart are joined, to need fewer reads.
export function makeChecks(oldText: string, newText: string): Check[] {
  const lines = newText.split('\n'),
    last = lines.length - 1; // the page ends with a newline: lines[last] is ''
  const want: [number, number][] = []; // [from, to) 0-based
  for (const h of diffHunks(oldText, newText, 0)) {
    const d = h.lines.length,
      b = h.b;
    if (d === 0) want.push([Math.max(0, b - 1), Math.min(last, b + 1)]);
    else if (d <= 8) want.push([b, b + d]);
    else {
      want.push([b, b + 3], [b + d - 3, b + d]);
      for (let i = b + 40; i < b + d - 3; i += 40) want.push([i, Math.min(i + 2, b + d - 3)]);
    }
  }
  want.sort((x, y) => x[0] - y[0]);
  const joined: [number, number][] = [];
  for (const r of want) {
    const p = joined[joined.length - 1];
    if (p && r[0] <= p[1] + 10) p[1] = Math.max(p[1], r[1]);
    else joined.push([r[0], r[1]]);
  }
  return joined.map(([f, t]) => ({ offset: f + 1, limit: t - f, text: lines.slice(f, t).join('\n') }));
}

// Apply edits as edit_version does (for the checks)
export function applyEdits(text: string, edits: Edit[]): string {
  for (const e of edits) {
    if (count(text, e.old_text) !== 1)
      throw new Error('old_text does not occur exactly once: ' + e.old_text.slice(0, 80));
    text = text.replace(e.old_text, () => e.new_text);
  }
  return text;
}

const versionOf = (html: string) => html.match(/<meta name="version" content="([^"]+)">/)?.[1] ?? null;

// index.html of the newest commit with the given version
function publishedPage(version: string): { commit: string; html: string } {
  const commits = execFileSync('git', ['log', '--format=%H', '--', 'index.html'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  for (const c of commits) {
    const html = execFileSync('git', ['show', `${c}:index.html`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
    if (versionOf(html) === version) return { commit: c.slice(0, 7), html };
  }
  throw new Error(
    `no commit has index.html of version ${version} (in a shallow clone: git fetch --depth=50 origin main)`,
  );
}

if (process.argv[1] === import.meta.filename) {
  const [live, outArg] = process.argv.slice(2);
  if (!live) {
    console.error('usage: npm run edits -- <live version> [<out.json>]');
    process.exit(2);
  }
  const out = outArg ?? '/tmp/publish-edits.json',
    checksOut = out.replace(/\.json$/, '') + '-checks.json',
    cur = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'),
    { commit, html } = publishedPage(live.replace(/^v/, ''));
  const edits = makeEdits(html, cur);
  if (applyEdits(html, edits) !== cur) throw new Error('the edits do not give index.html');
  const oldBytes = edits.reduce((a, e) => a + Buffer.byteLength(e.old_text), 0),
    newBytes = edits.reduce((a, e) => a + Buffer.byteLength(e.new_text), 0);
  fs.writeFileSync(out, JSON.stringify(edits, null, 1) + '\n');
  const checks = makeChecks(html, cur),
    totalLines = cur.split('\n').length - 1;
  fs.writeFileSync(checksOut, JSON.stringify({ version: versionOf(cur), totalLines, checks }, null, 1) + '\n');
  console.log(
    `v${live} (${commit}) → v${versionOf(cur)}: ${edits.length} edits, old_text ${(oldBytes / 1024).toFixed(1)} KiB, ` +
      `new_text ${(newBytes / 1024).toFixed(1)} KiB → ${out}`,
  );
  console.log(
    `after publishing: total_lines ${totalLines}, and ${checks.length} reads (read_artifact offset/limit) → ${checksOut}`,
  );
  const runs = edits.filter(e => /\S {4,}\S/.test(e.old_text + e.new_text)).length;
  if (runs) console.log(`note: ${runs} edits contain runs of 4 or more spaces; copy them exactly`);
  if (edits.length > MAX_EDITS || oldBytes > MAX_OLD || newBytes > MAX_NEW) {
    console.error(
      `too large for edit_version (at most ${MAX_EDITS} edits, 64 KiB of old_text and 64 KiB of new_text): ` +
        `publish with the owner's account`,
    );
    process.exit(1);
  }
}
