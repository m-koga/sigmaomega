// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Notes under the plots: break frequencies of the Bode gain asymptotes, the Nyquist stability criterion ================= */
import { T } from './02-i18n.ts';
import { numStr } from './03-math.ts';
import { evalLoopTF, loopTFs } from './17-loop.ts';
import { bodeAsymptote } from './19-bode-asymptote.ts';
import { nyqCount } from './23-loop-analysis.ts';
import { byId } from './40-dom.ts';
/* ---- Break frequencies of the Bode gain asymptotes ---- */
// The tab "Break frequencies" under the Bode plot: the low-frequency line K/ω^q, and for each break frequency the
// poles and zeros there, the change of slope, the slope after it, and the true gain minus the asymptote there
export function renderBodeAsym() {
  const box = byId('bodeAsym'),
    a = bodeAsymptote();
  if (!a) {
    box.innerHTML = `<p class="note">${T('No loop: the controller gain is zero.')}</p>`;
    return;
  }
  const g = loopTFs().L,
    trueDb = (w: number) => {
      const v = evalLoopTF(g, w);
      return 20 * Math.log10(Math.hypot(v[0], v[1]));
    },
    slope = (s: number) => `${s > 0 ? '+' : ''}${numStr(s)} dB/dec`,
    root = (r: { z: Complex; mult: number }, what: string) => {
      const [x, y] = r.z,
        wn = Math.hypot(x, y),
        m = r.mult > 1 ? ` (×${r.mult})` : '',
        rhp = x > 0 ? ` ${T('(right half-plane)')}` : '';
      return y > 0
        ? `${T(what === 'pole' ? 'complex poles' : 'complex zeros')} ${numStr(x)} ± j${numStr(y)}${m}, ζ = ${numStr(-x / wn)}${rhp}`
        : `${T(what === 'pole' ? 'pole' : 'zero')} s = ${numStr(x)}${m}${rhp}`;
    };
  const low =
    a.q === 0
      ? `|L(jω)| ≈ ${numStr(Math.abs(a.K))} (${numStr(20 * Math.log10(Math.abs(a.K)))} dB), ${slope(0)}`
      : `|L(jω)| ≈ ${numStr(Math.abs(a.K))} / ω${a.q === 1 ? '' : `<sup>${a.q}</sup>`}, ${slope(-20 * a.q)}`;
  // the change of phase of a pole (sgn −1) or zero (+1) and the frequencies over which the straight line makes it
  const phaseOf = (r: { z: Complex; mult: number }, sgn: number) => {
    const wn = Math.hypot(r.z[0], r.z[1]),
      d = sgn * (r.z[0] < 0 ? 1 : -1) * (r.z[1] > 0 ? 180 : 90) * r.mult,
      [lo, hi] =
        r.z[1] > 0
          ? [wn * Math.pow(10, -Math.abs(r.z[0]) / wn), wn * Math.pow(10, Math.abs(r.z[0]) / wn)]
          : [wn / 10, wn * 10];
    return `${d > 0 ? '+' : ''}${d}° (${numStr(lo)}–${numStr(hi)} rad/s)`;
  };
  const rows = a.breaks
    .map(
      b =>
        `<tr><td>${numStr(b.w)}</td><td>${[...b.poles.map(r => root(r, 'pole')), ...b.zeros.map(r => root(r, 'zero'))].join('<br>')}</td>` +
        `<td>${slope(b.dSlope)}</td><td>${slope(b.slope)}</td><td>${numStr(trueDb(b.w) - a.gain(b.w))} dB</td>` +
        `<td>${[...b.poles.map(r => phaseOf(r, -1)), ...b.zeros.map(r => phaseOf(r, 1))].join('<br>')}</td></tr>`,
    )
    .join('');
  box.innerHTML =
    `<p>${T('Low frequencies:')} ${low}</p>` +
    (a.breaks.length
      ? `<div class="pzwrap-tbl"><table class="pzt rules asym"><thead><tr><th>${T('Break frequency [rad/s]')}</th><th>${T('Poles and zeros')}</th><th>${T('Change of slope')}</th><th>${T('Slope after')}</th><th>${T('True − asymptote')}</th><th>${T('Change of phase')}</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p>${T('No break frequency: the asymptote is a single line.')}</p>`) +
    `<p class="note">${T('Gain: each pole changes the slope by −20 dB/dec and each zero by +20 dB/dec at its break frequency |s| (a complex pair by ±40 at ωn). At a real break the true gain differs by 3 dB; at a complex pair by −20 log10(2ζ) dB. Phase: a real pole changes it by −90° and a zero by +90° along a straight line from ω_b/10 to 10ω_b, a complex pair by ∓180° from ωn·10^(−ζ) to ωn·10^ζ (the opposite sign in the right half-plane). The dead time does not change the gain and adds its exact phase −ωL.')}</p>`;
}
/* ---- Nyquist stability criterion ---- */
// The tab "Nyquist criterion" under the Nyquist plot: P, N and Z = N + P with the verdict, and the crossings of the
// real axis to the left of −1 that give N
export function renderNyqCrit() {
  const box = byId('nyqCrit'),
    c = nyqCount();
  if (!c) {
    box.innerHTML = `<p class="note">${T('No loop: the controller gain is zero.')}</p>`;
    return;
  }
  const cStr = (z: Complex) =>
      z[1] === 0 ? numStr(z[0]) : `${numStr(z[0])} ${z[1] < 0 ? '−' : '+'} ${numStr(Math.abs(z[1]))}j`,
    rhp = c.rhp.length ? ` (s = ${c.rhp.map(cStr).join(', ')})` : '',
    axis = c.axis.length
      ? `<p class="note">${T('Poles on the imaginary axis: {list}. The contour passes them on their right by small half circles, so they are not counted in P; on these half circles L(s) goes around at a large radius (not drawn).', { list: c.axis.map(a => (a.w === 0 ? 's = 0' : `s = ±j${numStr(a.w)}`) + (a.mult > 1 ? ` (×${a.mult})` : '')).join(', ') })}</p>`
      : '';
  const verdict = c.through
    ? `<p class="verdict">${T('L(jω) passes through −1: the closed loop has poles on the imaginary axis (marginally stable), and N is not defined.')}</p>`
    : c.Z === 0
      ? `<p class="verdict ok">${T('Z = 0: no closed-loop pole in the right half-plane. The closed loop is stable.')}</p>`
      : `<p class="verdict bad">${T('Z = {z}: closed-loop poles in the right half-plane. The closed loop is unstable.', { z: c.Z })}</p>`;
  const nv = c.through ? '—' : String(c.N),
    zv = c.through ? '—' : String(c.Z);
  const tab =
    `<table class="pzt rules"><tbody>` +
    `<tr><td>P${`<span class="how">${T('open-loop poles of L(s) in the right half-plane')}</span>`}</td><td>${c.P}${rhp}</td></tr>` +
    `<tr><td>N${`<span class="how">${T('clockwise encirclements of −1 by L(jω), ω from −∞ to ∞ (counterclockwise ones count −1)')}</span>`}</td><td>${nv}</td></tr>` +
    `<tr><td>Z = N + P${`<span class="how">${T('closed-loop poles in the right half-plane')}</span>`}</td><td>${zv}</td></tr>` +
    `</tbody></table>`;
  const dirText = (d: number) => (d > 0 ? T('upward (clockwise)') : T('downward (counterclockwise)'));
  const cross = c.crossings.length
    ? `<table class="pzt rules"><thead><tr><th>${T('Where')}</th><th>${T('Direction')}</th><th>${T('Count')}</th></tr></thead><tbody>` +
      c.crossings
        .map(
          k =>
            `<tr><td>${
              k.arc === null
                ? `Re L = ${numStr(k.x)}<span class="how">ω = ${numStr(k.w)}</span>`
                : `${T('on the half circle around {p}', { p: k.arc === 0 ? 's = 0' : `s = j${numStr(k.arc)}` })}<span class="how">${T('|L| → ∞')}</span>`
            }</td><td>${dirText(k.dir)}</td><td>${k.dir > 0 ? '+1' : '−1'}</td></tr>`,
        )
        .join('') +
      `<tr><td><b>${T('Sum')}</b></td><td></td><td><b>${c.crossings.reduce((s, k) => s + k.dir, 0)}</b></td></tr></tbody></table>`
    : `<p>${T('L(jω) does not cross the real axis to the left of −1: N = 0.')}</p>`;
  const notes = [
    c.P > 0 && !c.through
      ? T('With P > 0, the closed loop is stable only when L(jω) encircles −1 counterclockwise P times (N = −P).')
      : '',
    c.delay ? T('With a dead time, the count uses e^(−jωL) itself (not the Padé approximation): it is exact.') : '',
  ]
    .filter(Boolean)
    .map(t => `<p class="note">${t}</p>`)
    .join('');
  box.innerHTML =
    `<p><b>${T('Nyquist criterion')}</b>: Z = N + P</p>${tab}${verdict}${axis}` +
    `<h4>${T('Counting N: crossings of the real axis to the left of −1')}</h4>` +
    `<p class="note">${T('Each crossing from below to above is one clockwise encirclement (+1), from above to below one counterclockwise (−1); the sum is N.')}</p>` +
    cross +
    notes;
}
