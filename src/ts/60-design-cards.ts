// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Design cards: specifications, tuning rule, lead and lag compensator design ================= */
import { T } from './02-i18n.ts';
import { numStr } from './03-math.ts';
import { SPECS, SPEC_KEYS } from './10-definitions.ts';
import { S } from './11-state.ts';
import { tuneErr, tuneGains, tuneRule } from './24-tuning.ts';
import type { TuneResult } from './24-tuning.ts';
import { COMP_METHODS, compDesign, isCompMethod } from './25-compensator.ts';
import type { CompDesign, CompMethod, CompSettings } from './25-compensator.ts';
import { evalSpecs, specIcon } from './27-specs.ts';
import { $, byId, i18nText } from './40-dom.ts';
import { layout } from './41-view.ts';
/* ---- Design specifications: rows of the card and their results ---- */
export function renderSpecs(): SpecEval {
  specRows();
  const ev = evalSpecs();
  let n = 0,
    bad = 0;
  SPEC_KEYS.forEach(k => {
    const e = ev[k],
      row = byId(`specrow-${k}`),
      res = byId(`res-${k}`);
    row.classList.toggle('off', !e.on);
    const unit = SPECS[k].unit,
      v = e.value === null ? (e.applicable && e.none ? T(e.none) : '—') : numStr(e.value) + (unit ? ' ' + unit : '');
    res.innerHTML = (e.on && e.applicable ? specIcon(k, ev) : '') + v;
    if (e.on && e.applicable) {
      n++;
      if (!e.ok) bad++;
    }
  });
  const sum = $('specSum');
  sum.className = 'spec-sum' + (n ? (bad ? ' ng' : ' ok') : '');
  sum.textContent = !n
    ? T('No specifications enabled')
    : bad
      ? T('{n} specification(s) not met', { n: bad })
      : T('All enabled specifications are met');
  return ev;
}
// The rows of the card, made once from SPECS: the ids specrow-k, spec-k-on, spec-k and res-k
export function specRows() {
  const box = $('specRows');
  if (box.childElementCount) return;
  for (const k of SPEC_KEYS) {
    const d = SPECS[k],
      row = document.createElement('div');
    row.className = 'spec-row';
    row.id = `specrow-${k}`;
    row.innerHTML =
      `<label class="chk"><input type="checkbox" id="spec-${k}-on"><span></span></label>` +
      `<span class="spec-in"><input type="number" class="num" id="spec-${k}" step="any" min="${d.low}">` +
      ` <span class="spec-u">${d.unit}</span></span><span class="spec-res" id="res-${k}"></span>`;
    i18nText(row.querySelector('label span') as HTMLElement, d.label);
    box.append(row);
  }
}
/* ---- Tuning rule: the model and the gains shown in its card ---- */
export let lastTune: TuneResult | null = null;
export function tuneVisible() {
  const c = document.querySelector<HTMLElement>('.side > .card[data-card="tune"]');
  return !!c && layout.scard === 'tune'; // the card shown in the settings panel
}
export function renderTune() {
  const box = $('tuneOut');
  if (!box) return;
  const imc = S.tune.method === 'imc';
  $('tuneLam').style.display = $('tuneLamL').style.display = imc ? '' : 'none';
  if (!tuneVisible()) {
    lastTune = null;
    return;
  } // computed only while its card is shown
  const r = (lastTune = tuneRule(S.tune.method, S.tune.type, S.tune.lam)),
    m = r.model,
    n = numStr,
    out: string[] = [];
  if (m.err === undefined && m.kind === 'ult')
    out.push(T('Ultimate gain Ku = {Ku}, ultimate period Pu = {Pu} s', { Ku: n(m.sgn * m.Ku), Pu: n(m.Pu) }));
  else if (m.err === undefined) {
    out.push(
      m.K !== null
        ? T('Model from the step response of P(s) (tangent at the steepest point): K = {K}, T = {T}, L = {L}', {
            K: n(m.sgn * m.K),
            T: n(m.T ?? NaN),
            L: n(m.L),
          })
        : T('Model from the step response of P(s) (tangent at the steepest point): slope R = {R}, L = {L}', {
            R: n(m.sgn * m.R),
            L: n(m.L),
          }),
    );
  }
  if (r.err !== undefined) out.push(`<span class="err">${tuneErr(r.err)}</span>`);
  else {
    if (imc) out.push(T('λ = {l} (automatic value when blank)', { l: n(r.lam ?? NaN) }));
    const g = tuneGains(r),
      ks: string[] = [`K<sub>P</sub> = <b>${n(r.Kp)}</b>`],
      ts: string[] = [];
    if (r.Ti !== undefined) {
      ks.push(`K<sub>I</sub> = <b>${n(g.Ki)}</b>`);
      ts.push(`T<sub>I</sub> = ${n(r.Ti)}`);
    }
    if (r.Td !== undefined) {
      ks.push(`K<sub>D</sub> = <b>${n(g.Kd)}</b>`);
      ts.push(`T<sub>D</sub> = ${n(r.Td)}`);
    }
    out.push(ks.join('　'));
    if (ts.length) out.push('(' + ts.join('　') + ')');
  }
  box.innerHTML = out.join('<br>');
  $('tuneApply').disabled = !!r.err;
}
/* ---- Lead and lag compensator design: the steps and the result ---- */
export let lastComp: CompDesign | null = null;
export function compVisible() {
  return layout.scard === 'comp'; // the card shown in the settings panel
}
// The steps of a lead-lag design: the new crossover ωc, the phase to add there, then the lead (α, T₁) and the lag
// (β, T₂)
function compStepsLeadLag(c: CompSettings, d: CompDesign): string[] {
  const n = numStr,
    steps: string[] = [];
  if (d.wc === undefined) return steps;
  steps.push(
    T(
      d.wcAuto
        ? 'New crossover ωc = {w} rad/s, where the phase of K_c P(jω) is −180° (the phase crossover); there |K_c P| = {db} dB'
        : 'New crossover ωc = {w} rad/s (given); there |K_c P| = {db} dB and its phase is {p}°',
      { w: n(d.wc), db: n(d.gcDb!), p: n(d.phc!) },
    ),
  );
  if (d.phiM !== undefined)
    steps.push(
      T('Phase to add at ωc: φm = PM* + θ − (180° + ∠K_c P(jωc)) = {a} + {c} − ({s}) = {p}°', {
        a: n(c.pm),
        c: n(c.theta),
        s: n(180 + d.phc!),
        p: n(d.phiM),
      }),
    );
  if (d.alpha !== undefined) steps.push(T('α = (1 − sin φm)/(1 + sin φm) = {a}', { a: n(d.alpha) }));
  if (d.T1 !== undefined)
    steps.push(
      T('T₁ = 1/(ωc √α) = {t} s (the largest phase lead at ωc, raising the gain by 1/√α there)', { t: n(d.T1) }),
    );
  if (d.beta !== undefined)
    steps.push(
      T('β = |K_c P(jωc)|/√α = {b}: the lag lowers the gain by 1/β, so that ωc becomes the gain crossover', {
        b: n(d.beta),
      }),
    );
  if (d.T2 !== undefined)
    steps.push(T('T₂ = 10/ω = {t} s (the zero a decade below the new crossover)', { t: n(d.T2) }));
  return steps;
}
// The steps of a lead design: the phase to add, α, the new crossover ωm and T₁
function compStepsLead(c: CompSettings, d: CompDesign): string[] {
  const n = numStr,
    steps: string[] = [];
  if (d.phiM !== undefined)
    steps.push(
      T('Phase to add: φm = PM* − PM + θ = {a} − {b} + {c} = {p}°', {
        a: n(c.pm),
        b: n(d.pm0!),
        c: n(c.theta),
        p: n(d.phiM),
      }),
    );
  if (d.alpha !== undefined) steps.push(T('α = (1 − sin φm)/(1 + sin φm) = {a}', { a: n(d.alpha) }));
  if (d.wm !== undefined)
    steps.push(
      T(
        'The lead raises the gain by 1/√α at ωm, so the new crossover is where |K_c P(jω)| = √α ({db} dB): ωm = {w} rad/s',
        {
          db: n(10 * Math.log10(d.alpha!)),
          w: n(d.wm),
        },
      ),
    );
  if (d.T1 !== undefined) steps.push(T('T₁ = 1/(ωm √α) = {t} s', { t: n(d.T1) }));
  return steps;
}
// The steps of a lag design: the new crossover, β and T₂
function compStepsLag(d: CompDesign): string[] {
  const n = numStr,
    steps: string[] = [];
  if (d.phiT !== undefined && d.wg !== undefined)
    steps.push(
      T('New crossover where the phase of K_c P(jω) is −180° + PM* + θ = {p}°: ω = {w} rad/s', {
        p: n(d.phiT),
        w: n(d.wg),
      }),
    );
  if (d.beta !== undefined)
    steps.push(
      T('β = |K_c P(jω)| there = {b} ({db} dB): the lag lowers the gain by 1/β', {
        b: n(d.beta),
        db: n(20 * Math.log10(d.beta)),
      }),
    );
  if (d.T2 !== undefined)
    steps.push(T('T₂ = 10/ω = {t} s (the zero a decade below the new crossover)', { t: n(d.T2) }));
  return steps;
}
// A complex number with its conjugate: −1 ± 2j
const pairStr = (z: Complex) => (Math.abs(z[1]) < 1e-9 ? numStr(z[0]) : `${numStr(z[0])} ± ${numStr(Math.abs(z[1]))}j`);
// The steps of a lead design on the root locus: the dominant poles to place, the angle condition, the bisector
// method, the magnitude condition and the compensator
function compStepsLocus(c: CompSettings, d: CompDesign): string[] {
  const n = numStr,
    steps: string[] = [];
  if (!d.sd) return steps;
  const zeta = c.zeta ?? 0.5,
    wn = c.wn ?? 2;
  steps.push(
    T(
      'Dominant poles to place: s_d = −ζωn ± jωn√(1 − ζ²) = {s} (overshoot ≈ {os} %, settling time ≈ 4/(ζωn) = {ts} s)',
      {
        s: pairStr(d.sd),
        os: n(100 * Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta))),
        ts: n(4 / (zeta * wn)),
      },
    ),
  );
  if (d.angP !== undefined && d.phi !== undefined)
    steps.push(
      T(
        'Angle condition ∠C(s_d)P(s_d) = −180°: the plant gives ∠P(s_d) = {a}°, so the lead must add φ = −180° − ∠P(s_d) = {p}°',
        { a: n(d.angP), p: n(d.phi) },
      ),
    );
  if (d.z !== undefined && d.p !== undefined && d.gamma !== undefined)
    steps.push(
      T(
        'Bisector method: γ = {g}° is the angle at s_d between the horizontal line and the line to the origin; the zero and the pole lie on the rays from s_d at γ/2 ± φ/2: zero z = {z}, pole p = {p}',
        { g: n(d.gamma), z: n(d.z), p: n(d.p) },
      ),
    );
  if (d.K !== undefined && d.Kc !== undefined && d.T1 !== undefined && d.alpha !== undefined) {
    steps.push(T('Magnitude condition |C(s_d)P(s_d)| = 1: K = |s_d − p| / (|s_d − z| |P(s_d)|) = {k}', { k: n(d.K) }));
    steps.push(
      T('C(s) = K (s − z)/(s − p) = K_c (T₁s + 1)/(αT₁s + 1): K_c = K z/p = {kc}, T₁ = −1/z = {t} s, α = z/p = {a}', {
        kc: n(d.Kc),
        t: n(d.T1),
        a: n(d.alpha),
      }),
    );
  }
  return steps;
}
// The closed-loop poles with the designed lead, and whether s_d is dominant among them
function compLocusOutcome(d: CompDesign): string {
  if (!d.cl || !d.sd) return '';
  const sd = d.sd,
    list = d.cl.filter(z => z[1] >= -1e-9).sort((a, b) => b[0] - a[0]),
    slower = list.filter(
      z => z[0] > sd[0] * 0.999 && Math.hypot(z[0] - sd[0], Math.abs(z[1]) - sd[1]) > 1e-3 * Math.hypot(...sd),
    );
  return (
    `<p><b>${T('Closed-loop poles')}</b>: ${list.map(pairStr).join(', ')}</p>` +
    (slower.length
      ? `<p class="err">${T('Poles at least as slow as s_d remain ({p}): s_d is not dominant, and the response differs from the second-order one.', { p: slower.map(pairStr).join(', ') })}</p>`
      : '')
  );
}
// The steps shown for each kind of compensator design (every kind of COMP_METHODS needs an entry)
const COMP_STEPS: Record<CompMethod, (c: CompSettings, d: CompDesign) => string[]> = {
  lead: compStepsLead,
  lag: (_c, d) => compStepsLag(d),
  leadlag: compStepsLeadLag,
  rlead: compStepsLocus,
};
// Why no compensator was designed, or the phase margin it gives
function compOutcomeHTML(c: CompSettings, d: CompDesign): string {
  const n = numStr,
    locus = isCompMethod(c.method) && COMP_METHODS[c.method].locus;
  const err = d.err
    ? `<p class="err">${T(
        {
          'no-crossover': 'No gain crossover: the phase margin is not defined.',
          'not-needed': 'The target phase margin is already met: no compensator is needed.',
          'too-much': locus
            ? 'The phase to add is more than γ: one lead stage cannot add it (lower ωn or ζ, or use two stages).'
            : 'More than 80° to add: one lead stage is not enough (use two, or lower the target).',
          'no-frequency': 'No frequency with the required gain or phase was found.',
          'lead-not-needed': 'No phase lead is needed at ωc: a lag compensator is enough.',
          'lag-not-needed': 'No attenuation is needed at ωc: a lead compensator is enough.',
          'on-locus': 's_d is already on the root locus: the gain K = {k} alone places it (no lead is needed).',
          'needs-lag':
            'The phase of P(s_d) is above −180°: a lead cannot place s_d (it would need a phase lag; or choose s_d farther from the origin).',
          'bad-target': 'Give a damping ratio 0 < ζ < 1 and a natural frequency ωn > 0.',
        }[d.err],
        { k: n(d.K ?? 0) },
      )}</p>`
    : '';
  const res =
    d.err === undefined
      ? `<p><b>${T('Result')}</b>: ${
          d.pm === null
            ? T('no gain crossover')
            : T('phase margin {pm}° at ω = {w} rad/s', { pm: n(d.pm), w: n(d.wgc!) })
        }${d.pm !== null && d.pm < c.pm - 0.5 && !locus ? ` <span class="err">${T('(short of the target: increase θ and design again)')}</span>` : ''}</p>`
      : '';
  return err + (locus && d.err === undefined ? compLocusOutcome(d) : '') + res;
}
export function renderComp() {
  const box = byId('compOut');
  // the card is built after the layout is restored at startup; update() renders it then
  if (!box || !compVisible()) {
    lastComp = null;
    return;
  } // computed only while its card is shown
  const c = S.comp,
    d = (lastComp = compDesign(c)),
    n = numStr,
    steps: string[] = [];
  if (!(isCompMethod(c.method) && COMP_METHODS[c.method].locus))
    steps.push(
      d.pm0 === null
        ? T('With K_c = {k}, |K_c P(jω)| does not cross 0 dB (no gain crossover).', { k: n(c.kc) })
        : T(
            'With K_c = {k} (chosen for the steady-state error), K_c P(s) has the gain crossover ω = {w} rad/s and the phase margin {pm}°.',
            {
              k: n(c.kc),
              w: n(d.wgc0!),
              pm: n(d.pm0),
            },
          ),
    );
  if (isCompMethod(c.method)) steps.push(...COMP_STEPS[c.method](c, d));
  box.innerHTML = `<ol class="comp-steps">${steps.map(s => `<li>${s.replace(/K_c/g, 'K<sub>c</sub>')}</li>`).join('')}</ol>${compOutcomeHTML(c, d)}`;
  $('compApply').disabled = d.err !== undefined;
}
