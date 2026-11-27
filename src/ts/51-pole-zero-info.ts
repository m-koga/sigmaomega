// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Pole-zero map: the text under it (poles, stability, the rules of the root locus) ================= */
import { LANG, T, TXT_PZ1, TXT_PZ2, TXT_PZ3 } from './02-i18n.ts';
import { numStr } from './03-math.ts';
import { S } from './11-state.ts';
import type { LocusRules } from './21-root-locus-rules.ts';
import { locus, rules, stableKRanges } from './23-loop-analysis.ts';
import { poleRegion, specKRanges } from './27-specs.ts';
import { $, byId } from './40-dom.ts';
export function pzInfo(pz: PZResult) {
  const cl = pz.cl,
    tol = 1e-6;
  const unst = cl.some(z => z[0] > tol),
    marg = !unst && cl.some(z => Math.abs(z[0]) <= tol);
  const b = $('pzBanner');
  b.classList.toggle('pz-ok', !unst && !marg);
  b.textContent = unst
    ? T('The closed-loop system is unstable (poles in the right half-plane)')
    : marg
      ? T('The closed-loop system is marginally stable (poles on the imaginary axis)')
      : T('The closed-loop system is stable (all poles in the left half-plane)');
  // Show conjugate pairs on one row
  const rows: Complex[] = [];
  cl.slice()
    .sort((a, b) => b[0] - a[0] || b[1] - a[1])
    .forEach(z => {
      if (z[1] < 0) return;
      rows.push(z);
    });
  const maxRe = rows.length ? rows[0][0] : 0;
  const tr = rows
    .map(z => {
      const [x, y] = z,
        wn = Math.hypot(x, y),
        zeta = wn > 1e-12 ? -x / wn : null;
      const val = y === 0 ? numStr(x) : `${numStr(x)} ± ${numStr(y)}j`;
      const tau = Math.abs(x) > 1e-12 ? numStr(1 / Math.abs(x)) : '∞';
      const dom = Math.abs(x - maxRe) <= 1e-9 * (1 + Math.abs(maxRe));
      return `<tr class="${dom ? 'dom' : ''}"><td>${val}${dom ? (LANG === 'ja' ? '　' : '') + T(' (dominant)') : ''}</td><td>${zeta === null ? '—' : numStr(zeta)}</td><td>${numStr(wn)}</td><td>${y === 0 ? '—' : numStr(Math.abs(y))}</td><td>${tau}</td></tr>`;
    })
    .join('');
  $('pzTable').innerHTML =
    `<div class="pzwrap-tbl"><table class="pzt"><thead><tr><th>${T('Closed-loop pole')}</th><th>${T('Damping ratio ζ')}</th><th>${T('Natural frequency ωn [rad/s]')}</th><th>${T('Damped frequency ωd [rad/s]')}</th><th>${T('Time constant 1/|Re| [s]')}</th></tr></thead><tbody>${tr}</tbody></table></div>`;
  const ranges = stableKRanges();
  const fk = (k: number) => (k === 0 ? '0' : !isFinite(k) ? '∞' : numStr(k));
  const rs = ranges.length
    ? ranges
        .map(([a, b]) => (b === Infinity ? `k > ${fk(a)}` : a === 0 ? `0 < k < ${fk(b)}` : `${fk(a)} < k < ${fk(b)}`))
        .join(', ')
    : T('none');
  const gm = ranges.find(([a, b]) => a < 1 && 1 < b && isFinite(b));
  $('pzRange').innerHTML =
    T('Stable range of the gain factor k on the root locus (k = 1 is the current setting): {r}', {
      r: `<b>${rs}</b>`,
    }) +
    (gm
      ? ' ' +
        T('(the gain can be increased {x} times, i.e. a gain margin of {g} dB)', {
          x: numStr(gm[1]),
          g: numStr(20 * Math.log10(gm[1])),
        })
      : '');
  const reg = poleRegion();
  if (reg) {
    const rr = specKRanges(locus(), reg).map(([a, b]) =>
      b === Infinity ? `k > ${numStr(a)}` : a === 0 ? `0 < k < ${numStr(b)}` : `${numStr(a)} < k < ${numStr(b)}`,
    );
    $('pzRange').innerHTML +=
      '<br>' +
      T('Design region (second-order approximation): ζ ≥ {z}, −Re ≥ {s}', {
        z: numStr(reg.zmin),
        s: numStr(reg.smin),
      }) +
      '　' +
      T('Gain factor k meeting the pole specifications on the root locus: {r}', {
        r: `<b>${rr.length ? rr.join(', ') : T('none')}</b>`,
      });
  }
  renderRules(rules());
  $('pzNote').innerHTML = T(TXT_PZ1) + (pz.pade ? T(TXT_PZ2, { L: numStr(pz.L) }) : '') + (S.sat ? T(TXT_PZ3) : '');
  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetPromise([$('pzNote')]).catch(() => {});
  }
}
// The construction rules of the root locus as a table: each rule with its formula and its values
const cStr = (z: Complex) =>
  z[1] === 0 ? numStr(z[0]) : `${numStr(z[0])} ${z[1] < 0 ? '−' : '+'} ${numStr(Math.abs(z[1]))}j`;
const inf = (x: number) => (x === -Infinity ? '−∞' : x === Infinity ? '∞' : numStr(x));
const degs = (as: number[]) => as.map(a => `${numStr(a)}°`).join(', ');
// The values of the rules as text ('none' when there is nothing): the real-axis segments, the breakaway and
// break-in points, the imaginary-axis crossings, and the departure or arrival angles
const atPoint = (z: Complex, mult: number) => cStr(z) + (mult > 1 ? ` (×${mult})` : '');
function segmentsText(r: LocusRules): string {
  return r.segments.length
    ? r.segments.map(([a, b]) => `${isFinite(a) ? '[' : '('}${inf(a)}, ${inf(b)}${isFinite(b) ? ']' : ')'}`).join(', ')
    : T('none');
}
function breakawayText(r: LocusRules): string {
  return r.breakaway.length
    ? r.breakaway
        .map(
          b =>
            `${cStr(b.s)}${b.s[1] !== 0 ? ` ${T('(and its conjugate)')}` : ''} (k = ${numStr(b.k)}, ${b.kind === 'breakaway' ? T('breakaway') : T('break-in')})`,
        )
        .join('<br>')
    : T('none');
}
function crossingsText(r: LocusRules): string {
  return r.crossings.length
    ? r.crossings.map(c => `${c.w === 0 ? 's = 0' : `s = ±j${numStr(c.w)}`} (k = ${numStr(c.k)})`).join('<br>')
    : T('none');
}
function anglesText(list: LocusRules['departures']): string {
  return list.length
    ? list
        .map(
          d =>
            `${atPoint(d.at, d.mult)}: ${degs(d.angles)}` +
            (d.at[1] > 0 ? ` ${T('(conjugate: {a})', { a: degs(d.angles.map(a => -a)) })}` : ''),
        )
        .join('<br>')
    : T('none');
}
// The rows of the table of rules: [rule, how it is found, value]
function rulesRows(r: LocusRules): [string, string, string][] {
  const q = r.n - r.m,
    pos = r.sign > 0;
  return [
    [
      T('Poles and zeros of L(s)'),
      T('n poles, m zeros: n branches start at the poles (k = 0); m end at the zeros, n − m go to infinity (k → ∞)'),
      `n = ${r.n}, m = ${r.m}, n − m = ${q}`,
    ],
    [
      T('Real axis'),
      pos
        ? T('on the locus where the number of real poles and zeros to the right is odd')
        : T('on the locus where the number of real poles and zeros to the right is even'),
      segmentsText(r),
    ],
    [
      T('Asymptotes'),
      (pos ? 'θ = (2q + 1)·180° / (n − m)' : 'θ = q·360° / (n − m)') + ',  σ = (Σp − Σz) / (n − m)',
      q > 0 ? `θ = ${degs(r.asymAngles)};  σ = ${numStr(r.centroid ?? 0)}` : T('none'),
    ],
    [T('Breakaway and break-in points'), `dk/ds = 0 ⇔ N(s)D′(s) − N′(s)D(s) = 0, k = −D(s)/N(s) > 0`, breakawayText(r)],
    [T('Imaginary-axis crossings'), `D(jω) + k N(jω) = 0`, crossingsText(r)],
    [
      T('Departure angles from poles'),
      (pos ? 'rθ = 180°' : 'rθ = 0°') + ' + Σ∠(p − zᵢ) − Σ∠(p − pᵢ)',
      anglesText(r.departures),
    ],
    [
      T('Arrival angles at zeros'),
      (pos ? 'rφ = 180°' : 'rφ = 0°') + ' + Σ∠(z − pᵢ) − Σ∠(z − zᵢ)',
      anglesText(r.arrivals),
    ],
  ];
}
// The notes under the table: what L(s) and r are, the 0° locus, and the dead time
function rulesNotes(r: LocusRules): string {
  return [
    T(
      'L(s) = N(s)/D(s) is the loop transfer function with the controller multiplied by k; r: the multiplicity of the pole or zero. Angles are measured from the positive real axis.',
    ),
    r.sign < 0
      ? T(
          'The leading coefficients of N(s) and D(s) have opposite signs, so for k > 0 the angle condition is 0° (the complementary root locus).',
        )
      : '',
    r.approx ? T('With a dead time, the rules are for its third-order Padé approximation, like the root locus.') : '',
  ]
    .filter(Boolean)
    .map(t => `<p class="note">${t}</p>`)
    .join('');
}
export function renderRules(r: LocusRules | null) {
  const box = byId('pzRulesBox');
  if (!r) {
    box.innerHTML = `<p class="note">${T('No root locus: the controller gain is zero.')}</p>`;
    return;
  }
  box.innerHTML =
    `<div class="pzwrap-tbl"><table class="pzt rules"><thead><tr><th>${T('Rule')}</th><th>${T('Value')}</th></tr></thead><tbody>` +
    rulesRows(r)
      .map(([a, b, c]) => `<tr><td>${a}<span class="how">${b}</span></td><td>${c}</td></tr>`)
      .join('') +
    `</tbody></table></div>${rulesNotes(r)}`;
}
