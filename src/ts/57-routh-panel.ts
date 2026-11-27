// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Routh–Hurwitz stability test panel ================= */
import { T } from './02-i18n.ts';
import { cT, lastOf, nT, numStr, pMul, polyTeX } from './03-math.ts';
import { S } from './11-state.ts';
import { charPolyK, hurwitzK, positiveKRanges, routhArray } from './18-routh.ts';
import { stableKRanges } from './23-loop-analysis.ts';
import { byId } from './40-dom.ts';
/* ---- Routh–Hurwitz stability test ---- */
// Ranges of a positive variable as text: "0 < k < 8", "k > 0.5", "none"
export function rangeText(rs: [number, number][], v: string): string {
  if (!rs.length) return T('none');
  return rs
    .map(([a, b]) =>
      b === Infinity
        ? `${v} > ${numStr(a)}`
        : a === 0
          ? `0 < ${v} < ${numStr(b)}`
          : `${numStr(a)} < ${v} < ${numStr(b)}`,
    )
    .join(', ');
}
// D(s) + k N(s) with the coefficients of each power written as d + n k
function charKTeX(D: Poly, N: Poly): string {
  const n = D.length - 1,
    terms: string[] = [];
  D.forEach((d, i) => {
    const m = n - i,
      c = N[i],
      sv = m === 0 ? '' : m === 1 ? 's' : `s^{${m}}`;
    if (Math.abs(d) < 1e-14 && Math.abs(c) < 1e-14) return;
    let t: string;
    if (Math.abs(c) < 1e-14) t = (Math.abs(d - 1) < 1e-12 && m > 0 ? '' : nT(d)) + sv;
    else if (Math.abs(d) < 1e-14) t = `${cT(c)}k${sv}`;
    else t = `\\left(${polyTeX([c, d], 'k')}\\right)${sv}`;
    terms.push(t);
  });
  return terms.join('+').replace(/\+-/g, '-') || '0';
}
// An entry of the first column as a fraction of polynomials in k: the common powers of k cancelled; a constant
// denominator is kept as it is (as by hand), otherwise numerator and denominator are divided by the leading
// coefficient of the denominator
function kFracTeX(num: Poly, den: Poly): string {
  let a = num.slice(),
    b = den.slice();
  while (a.length > 1 && b.length > 1 && Math.abs(lastOf(a)) < 1e-12 && Math.abs(lastOf(b)) < 1e-12) {
    a = a.slice(0, -1);
    b = b.slice(0, -1);
  }
  if (b.length === 1) {
    if (Math.abs(b[0] - 1) < 1e-12) return polyTeX(a, 'k');
    if (b[0] < 0) {
      a = a.map(v => -v);
      b = [-b[0]];
    }
    return `\\dfrac{${polyTeX(a, 'k')}}{${nT(b[0])}}`;
  }
  const c = b[0];
  a = a.map(v => v / c);
  b = b.map(v => v / c);
  return `\\dfrac{${polyTeX(a, 'k')}}{${polyTeX(b, 'k')}}`;
}
const pw = (m: number) => (m ? `s<sup>${m}</sup>` : 's<sup>0</sup>');
let routhTimer: Timer | undefined;
export function scheduleRouth() {
  clearTimeout(routhTimer);
  routhTimer = setTimeout(renderRouth, 120);
}
// The panel: the characteristic equation, the Routh table at the current setting with its verdict, and the first
// column with the gain factor k (C(s) → k C(s)) left as a letter, with the stable range of k
export function renderRouth() {
  const box = byId('routhBox'),
    { D, N, approx } = charPolyK(),
    chr = D.map((d, i) => d + N[i]),
    n = chr.length - 1,
    r = routhArray(chr),
    w = r.rows[0].length;
  const cell = (v: number, i: number, j: number) => {
    if (j >= Math.ceil((n - i + 1) / 2)) return '<td></td>'; // beyond the entries of the row
    const isEps = j === 0 && r.eps.includes(i);
    const cls = [j === 0 ? 'fc' : '', j === 0 && v < 0 ? 'neg' : ''].filter(Boolean).join(' ');
    return `<td${cls ? ` class="${cls}"` : ''}>${isEps ? 'ε' : j > 0 && Math.abs(v) < 1e-300 ? '0' : numStr(v)}</td>`;
  };
  const rows = r.rows
    .map(
      (row, i) =>
        `<tr><th class="pw">${pw(n - i)}${r.aux.includes(i) ? ' *' : ''}</th>${row.map((v, j) => cell(v, i, j)).join('')}<td>${row[0] > 0 ? '+' : row[0] < 0 ? '−' : '0'}</td></tr>`,
    )
    .join('');
  const head = `<tr><th></th>${Array.from({ length: w }, () => '<th></th>').join('')}<th>${T('Sign of the first column')}</th></tr>`;
  const verdict =
    r.changes > 0
      ? `<p class="verdict bad">${r.changes === 1 ? T('One sign change in the first column: one root in the right half-plane. The closed loop is unstable.') : T('{n} sign changes in the first column: {n} roots in the right half-plane. The closed loop is unstable.', { n: r.changes })}</p>`
      : r.aux.length
        ? `<p class="verdict">${T('No sign change, but a row of zeros: roots symmetric about the origin lie on the imaginary axis. The closed loop is marginally stable.')}</p>`
        : `<p class="verdict ok">${T('No sign change in the first column: every root is in the left half-plane. The closed loop is stable.')}</p>`;
  const special = [
    r.eps.length ? T('ε: a zero in the first column, replaced by a small positive number ε.') : '',
    r.aux.length
      ? T('*: a row of zeros, replaced by the derivative of the auxiliary polynomial of the row above.')
      : '',
  ]
    .filter(Boolean)
    .map(t => `<p class="note">${t}</p>`)
    .join('');
  // the first column with k: a0, Δ1, Δ2/Δ1, …, Δn/Δn−1 (the last one is the constant term an(k))
  const H = hurwitzK(D, N),
    entries: [string, Poly][] = [[nT(D[0]), [D[0]]]];
  H.forEach((h, i) => {
    if (i === 0) entries.push([polyTeX(h, 'k'), h]);
    else if (i === n - 1) entries.push([polyTeX([N[n], D[n]], 'k'), [N[n], D[n]]]);
    else entries.push([kFracTeX(h, H[i - 1]), pMul(h, H[i - 1])]);
  });
  const krows = entries
    .map(
      ([tex, sgn], i) =>
        `<tr><th class="pw">${pw(n - i)}</th><td class="kcol">\\(${tex}\\)</td><td>${rangeText(positiveKRanges([sgn]), 'k')}</td></tr>`,
    )
    .join('');
  const kr = positiveKRanges([[D[0]], ...H]),
    rl = stableKRanges(),
    pOnly = S.mode === 'P';
  box.innerHTML =
    `<h4>${T('Characteristic equation')}</h4>` +
    `\\[1+L(s)=0\\;\\Longleftrightarrow\\;${polyTeX(chr)}=0\\]` +
    `<h4>${T('Routh table (current setting)')}</h4>` +
    `<table class="pzt">${head}${rows}</table>${verdict}${special}` +
    `<h4>${T('Stable range of the gain factor k')}</h4>` +
    `<p>${T('With the controller multiplied by k (C(s) → kC(s); k = 1 is the current setting), the characteristic equation is')}</p>` +
    `\\[${charKTeX(D, N)}=0\\]` +
    `<p>${T('The first column of the Routh table, as a function of k ({list} with the Hurwitz determinants {d}):', { list: '\\(a_0, \\Delta_1, \\Delta_2/\\Delta_1, \\ldots, \\Delta_n/\\Delta_{n-1}\\)', d: '\\(\\Delta_i\\)' })}</p>` +
    `<table class="pzt"><tr><th></th><th>${T('First column')}</th><th>${T('Positive for')}</th></tr>${krows}</table>` +
    `<p class="verdict">${T('Every entry positive (stable): {r}', { r: rangeText(kr, 'k') })}</p>` +
    (pOnly
      ? `<p>${T('With P control, K_P = k × {kp}: {r}', {
          kp: numStr(S.Kp),
          r: rangeText(
            kr.map(([a, b]) => [a * S.Kp, b * S.Kp] as [number, number]),
            'K_P',
          ),
        }).replace(/K_P/g, 'K<sub>P</sub>')}</p>`
      : '') +
    `<p class="note">${T('The root locus gives: {r}', { r: rangeText(rl, 'k') })}</p>` +
    (approx
      ? `<p class="note">${T('With a dead time, e^(−Ls) is replaced by its third-order Padé approximation, as in the pole-zero map: the results are approximate. The Nyquist plot and the margins use the exact delay.')}</p>`
      : '');
  if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([box]).catch(() => {});
}
