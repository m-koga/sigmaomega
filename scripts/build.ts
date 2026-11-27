// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Build the single-file index.html from the sources in src/
//   src/index.html     page template (placeholders: @@VERSION@@, /*@@CSS@@*/, //@@JS@@)
//   src/style.css      style sheet
//   src/i18n.json      translation dictionary (keys are the English strings)
//   src/ts/*.ts        script in TypeScript, one ES module per topic; joined in file-name order into one classic script
//                      (02-i18n.ts holds the placeholder /*@@I18N@@*/{} for the dictionary;
//                       99-init.ts builds the page and is left out when the unit tests load the script)
// The types are removed with Node's built-in type stripping, which replaces them with spaces, and the module
// syntax (import lines, the export keyword) is blanked the same way: every character of the script keeps its line
// and column, so error messages and coverage point at src/ts. The imports matter to the type checker only; in the
// page the modules share one scope, and the file-name order is the order in which their top-level code runs.
// Only TypeScript that can be erased is allowed (no enum, namespace or parameter properties);
// tsconfig.json checks this with erasableSyntaxOnly. Type checking is separate: npm run typecheck.
// The build also writes src/ts/element-ids.d.ts (the element type of every id; scripts/gen-element-ids.ts).
// The version number in <meta name="version"> is taken from the first entry of CHANGELOG.
//   Usage: npm run build            (writes index.html)
//          npm run build -- --check (fails if index.html is not up to date)
//          node scripts/build.ts --full (index.html with the script uncompacted, for the coverage report)
import fs from 'node:fs';
import * as nodeModule from 'node:module';
import * as ids from './gen-element-ids.ts'; // element type of every id, for $(id) (src/ts/element-ids.d.ts)
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'index.html');
const INIT_FILE = '99-init.ts';
const I18N_MARK = '/*@@I18N@@*/{}';
// The user manual, one file per language (src/help/<lang>.html: one <section id="…" title="…"> per chapter), put
// into the script at this placeholder of src/ts/84-help.ts as {lang: [[id, title, HTML], …]}, one chapter per line
const HELP_MARK = '/*@@HELP@@*/{}';
const HELP_DIR = path.join(SRC, 'help');
// Screenshots of the user manual (scripts/help-shots.ts), put into the page at the placeholder <!--@@HELPIMG@@-->
// of src/index.html: one <script type="text/plain" data-help-img="<name>.<lang>"> per picture, holding the WebP
// file in base64 on lines of 120 characters (so that a change elsewhere never touches a long line). data-w is the
// width at which the manual shows it: pictures narrower than SHOT_WIDTH were kept at twice their size on the screen.
const HELP_IMG_DIR = path.join(SRC, 'help-img');
const HELP_IMG_MARK = '<!--@@HELPIMG@@-->\n';
// The icon (src/icon.svg): inline in the header at @@ICON@@ (without its comments and line breaks) and as the
// favicon at @@ICON_URI@@ (a data: URI)
export function icon() {
  const svg = read('icon.svg')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .trim();
  return { svg, uri: 'data:image/svg+xml,' + encodeURIComponent(svg).replace(/%20/g, ' ') };
}
// The home-screen icon src/icon-180.png (made from src/icon.svg by npm run icon), at @@TOUCH_ICON@@ as a data: URI
export const touchIcon = () =>
  'data:image/png;base64,' + fs.readFileSync(path.join(SRC, 'icon-180.png')).toString('base64');
export const SHOT_WIDTH = 760;
// Width of a WebP picture (simple lossy, lossless or extended format)
function webpWidth(b: Buffer): number {
  const kind = b.toString('latin1', 12, 16);
  if (b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') throw new Error('not WebP');
  if (kind === 'VP8 ') return b.readUInt16LE(26) & 0x3fff;
  if (kind === 'VP8L') return 1 + (b.readUInt16LE(21) & 0x3fff);
  if (kind === 'VP8X') return 1 + b.readUIntLE(24, 3);
  throw new Error('unknown WebP format');
}
export function helpImages(): { key: string; w: number; b64: string }[] {
  if (!fs.existsSync(HELP_IMG_DIR)) return [];
  return fs
    .readdirSync(HELP_IMG_DIR)
    .filter(f => f.endsWith('.webp'))
    .sort()
    .map(f => {
      const b = fs.readFileSync(path.join(HELP_IMG_DIR, f)),
        w = webpWidth(b);
      return { key: f.replace(/\.webp$/, ''), w: w < SHOT_WIDTH ? Math.round(w / 2) : w, b64: b.toString('base64') };
    });
}

const read = (f: string) => fs.readFileSync(path.join(SRC, f), 'utf8');

// Remove the TypeScript types of one file (Node 22.18 or later); the experimental warning is not shown
function stripTypes(code: string, file: string): string {
  const { stripTypeScriptTypes } = nodeModule;
  if (!stripTypeScriptTypes) throw new Error('Node.js 22.18 or later is needed (type stripping)');
  const emit = process.emitWarning;
  process.emitWarning = ((w: string | Error, ...a: unknown[]) => {
    if (!/stripTypeScriptTypes/.test(String(w))) (emit as (...x: unknown[]) => void).call(process, w, ...a);
  }) as typeof process.emitWarning;
  try {
    return stripTypeScriptTypes(code, { mode: 'strip' });
  } catch (e) {
    throw new Error(`src/ts/${file}: ${e instanceof Error ? e.message : e}`);
  } finally {
    process.emitWarning = emit;
  }
}

// Remove the module syntax, keeping every character in place: import statements become blank, and the export
// keyword before a declaration becomes spaces. The files then share one scope, as one classic script.
// (Imports of types only are already removed with the types.) Other forms of import/export are refused.
function stripModuleSyntax(js: string, file: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  const out = js
    .replace(/^import \{[^}]*\} from '\.\/[\w.-]+\.ts';/gm, blank)
    .replace(/^export (?=(?:async )?function |const |let )/gm, '       ');
  const bad = out.match(/^(?:import|export)\b.*$/m);
  if (bad) throw new Error(`src/ts/${file}: unsupported module syntax: ${bad[0]}`);
  return out;
}

// The script files in order, each with its types and module syntax removed (the dictionary is not inserted yet).
// ts is the source, so that compact() can tell the blanked characters from the spaces of the source.
function scriptParts({ withInit = true } = {}) {
  return fs
    .readdirSync(path.join(SRC, 'ts'))
    .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .sort()
    .filter(f => withInit || f !== INIT_FILE)
    .map(f => {
      const ts = read(path.join('ts', f));
      return { file: f, ts, js: stripModuleSyntax(stripTypes(ts, f), f) };
    });
}

// Remove the characters that were blanked (types, imports, the export keyword) from a script file, keeping its
// lines: a blanked run is dropped (or becomes one space between two word characters, or two operator characters
// that would otherwise join), and a line left with only blanks and indentation becomes empty. The published
// page then has no long runs of spaces, which keeps it small and lets a new version be published as a few
// exact text replacements (scripts/publish-edits.ts). The unit tests and the coverage use the script with
// every character in place (buildScript({ compact: false })).
function compact(ts: string, js: string): string {
  if (ts.length !== js.length) throw new Error('type stripping changed the length of a file');
  const word = /[\w$]/,
    op = /[+\-/*<>=&|]/;
  let out = '',
    line = '',
    blanked = false;
  for (let i = 0; i < js.length;) {
    if (js[i] === ' ' && ts[i] !== ' ') {
      // the run: blanks on this line up to the last blanked character (a space of the source after it stays)
      let j = i;
      for (let k = i; k < js.length && js[k] === ' '; k++) if (ts[k] !== ' ') j = k + 1;
      // a space of the source after the run is not needed after a space or at the start of a line ("export f")
      if (js[j] === ' ' && /(^|\s)$/.test(line)) j++;
      // nor a space before a closing bracket or separator ("x as T)" becomes "x)")
      if (/[)\]};,]/.test(js[j] ?? '') && /\S\s+$/.test(line)) line = line.trimEnd();
      const a = line[line.length - 1] ?? '',
        b = js[j] ?? '';
      if ((word.test(a) && word.test(b)) || (op.test(a) && op.test(b))) line += ' ';
      blanked = true;
      i = j;
      continue;
    }
    if (js[i] === '\n') {
      out += (blanked && !line.trim() ? '' : line) + '\n';
      line = '';
      blanked = false;
    } else line += js[i];
    i++;
  }
  return out + (blanked && !line.trim() ? '' : line);
}

// The page script. withInit: false leaves out the start-up file (for the unit tests); compact: removes the
// blanked characters (for the published page; offsets and columns then no longer match src/ts, lines still do).
function buildScript({ withInit = true, compact: small = false } = {}) {
  const parts = scriptParts({ withInit }),
    files = parts.map(p => p.file);
  let js = parts.map(p => (small ? compact(p.ts, p.js) : p.js)).join('');
  const i18n = read('i18n.json').replace(/\s+$/, '');
  JSON.parse(i18n); // fail early on a broken dictionary
  if (js.split(I18N_MARK).length !== 2)
    throw new Error(`the placeholder ${I18N_MARK} must appear exactly once in src/ts`);
  js = js.replace(I18N_MARK, () => i18n);
  if (js.split(HELP_MARK).length !== 2)
    throw new Error(`the placeholder ${HELP_MARK} must appear exactly once in src/ts`);
  js = js.replace(HELP_MARK, () => helpText());
  const m = js.match(/const CHANGELOG = \[[\s\S]*?\bv: *'([^']+)'/); // first entry (any formatting)
  if (!m) throw new Error('the version number was not found in the first entry of CHANGELOG');
  return { js, files, version: m[1] };
}

// The chapters of the user manual in each language (src/help/<lang>.html), as the text of an object literal
export function helpChapters(): Record<string, [string, string, string][]> {
  const out: Record<string, [string, string, string][]> = {};
  for (const f of fs
    .readdirSync(HELP_DIR)
    .filter(f => f.endsWith('.html'))
    .sort()) {
    const text = fs.readFileSync(path.join(HELP_DIR, f), 'utf8'),
      ch = [...text.matchAll(/^<section id="([\w-]+)" title="([^"]+)">\n([\s\S]*?)\n<\/section>$/gm)].map(
        m => [m[1], m[2], m[3]] as [string, string, string],
      );
    if (!ch.length) throw new Error(`src/help/${f}: no <section id="…" title="…"> found`);
    out[f.replace(/\.html$/, '')] = ch;
  }
  return out;
}
function helpText(): string {
  const h = helpChapters();
  return (
    '{\n' +
    Object.entries(h)
      .map(([l, ch]) => `${JSON.stringify(l)}: [\n${ch.map(c => JSON.stringify(c)).join(',\n')}\n]`)
      .join(',\n') +
    '\n}'
  );
}

// Licenses known to the build (the SPDX id in package.json → its name and text)
const LICENSES: Record<string, { name: string; url: string }> = {
  'Apache-2.0': { name: 'Apache License 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
};
// The copyright notice: the author in package.json, and the years from the first to the last entry of CHANGELOG;
// and the license of package.json
export function copyright(js: string) {
  const { author, license } = JSON.parse(read('../package.json')) as { author?: string; license?: string };
  if (!author) throw new Error('package.json has no author');
  const lic = LICENSES[license ?? ''];
  if (!lic) throw new Error(`package.json: unknown license ${license}`);
  const years = [...js.matchAll(/\bd: *'(\d{4})-\d\d-\d\d'/g)].map(m => Number(m[1]));
  if (!years.length) throw new Error('no dates found in CHANGELOG');
  const [y0, y1] = [Math.min(...years), Math.max(...years)];
  return { author, notice: `Copyright © ${y0 === y1 ? y0 : `${y0}–${y1}`} ${author}`, license: lic };
}

// The page. compact: false keeps every character of the script in place (for the coverage of the browser tests,
// scripts/coverage.ts, which finds the source files in the page by their offsets)
function build({ compact: small = true } = {}) {
  const { js, files, version } = buildScript({ compact: small });
  let html = read('index.html');
  for (const ph of [
    '@@VERSION@@',
    '/*@@CSS@@*/\n',
    '//@@JS@@\n',
    HELP_IMG_MARK,
    '@@ICON@@',
    '@@ICON_URI@@',
    '@@TOUCH_ICON@@',
    '@@AUTHOR@@',
  ]) {
    if (html.split(ph).length !== 2)
      throw new Error(`the placeholder ${ph.trim()} must appear exactly once in src/index.html`);
  }
  const ic = icon(),
    cr = copyright(js);
  // the notice appears in the source, under the change log and under the manual
  for (const ph of ['@@COPYRIGHT@@', '@@LICENSE@@', '@@LICENSE_URL@@'])
    if (html.split(ph).length !== 4) throw new Error(`${ph} must appear 3 times in src/index.html`);
  html = html
    .replaceAll('@@COPYRIGHT@@', cr.notice)
    .replaceAll('@@LICENSE_URL@@', cr.license.url)
    .replaceAll('@@LICENSE@@', cr.license.name)
    .replace('@@AUTHOR@@', cr.author)
    .replace('@@VERSION@@', version)
    .replace('@@ICON_URI@@', () => ic.uri)
    .replace('@@TOUCH_ICON@@', touchIcon)
    .replace('@@ICON@@', () => ic.svg)
    .replace('/*@@CSS@@*/\n', () => read('style.css'))
    .replace('//@@JS@@\n', () => js)
    .replace(HELP_IMG_MARK, () =>
      helpImages()
        .map(
          i =>
            `<script type="text/plain" data-help-img="${i.key}" data-w="${i.w}">\n` +
            i.b64.replace(/.{1,120}/g, '$&\n') +
            '</script>\n',
        )
        .join(''),
    );
  return { html, version, files: files.length };
}

if (process.argv[1] === import.meta.filename) {
  // run as a program (not imported)
  // --full: the script with every character in place (npm run coverage; index.html is built again afterwards)
  const { html, version, files } = build({ compact: !process.argv.includes('--full') });
  if (process.argv.includes('--check')) {
    if (!ids.update({ check: true })) {
      console.error('src/ts/element-ids.d.ts is not up to date with the ids of the page. Run: npm run build');
      process.exit(1);
    }
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur !== html) {
      console.error('index.html is not up to date with src/. Run: npm run build');
      process.exit(1);
    }
    console.log(`index.html is up to date (v${version})`);
  } else {
    ids.update();
    fs.writeFileSync(OUT, html);
    console.log(
      `index.html built: v${version}, ${files} script files, ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`,
    );
  }
}

export { build, buildScript, compact, scriptParts, INIT_FILE, I18N_MARK };
