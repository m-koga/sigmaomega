// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Design specifications ================= */
import { T, i18nText } from './02-i18n.ts';
import { SPECS, SPEC_KEYS } from './03-definitions.ts';
import { numStr } from './04-parser.ts';
import { S } from './05-state.ts';
import { $, byId } from './06-ui-build.ts';
import { stepMetrics } from './07-simulation.ts';
import { lastFr, lastPZ, lastSim, redraw, resetLocus } from './16-pole-zero.ts';

export const specOn = (k: SpecKey, st: State = S): boolean => st.spec[k].on;
// Design region for the poles (second-order approximations): ζ ≥ ζmin, −Re ≥ σmin
export function poleRegion(st: State = S): { zmin: number; smin: number } | null {
  let zmin = 0,
    smin = 0;
  if (specOn('zeta', st)) zmin = Math.max(zmin, st.spec.zeta.v);
  if (specOn('os', st) && st.spec.os.v > 0) {
    const l = Math.log(st.spec.os.v / 100);
    zmin = Math.max(zmin, -l / Math.sqrt(Math.PI * Math.PI + l * l));
  }
  if (specOn('ts', st) && st.spec.ts.v > 0) smin = 4 / st.spec.ts.v; // 2% settling ≈ 4/σ
  return specOn('zeta', st) || specOn('os', st) || specOn('ts', st) ? { zmin: Math.min(zmin, 0.999), smin } : null;
}
export const inRegion = (z: Complex, reg: { zmin: number; smin: number }) => {
  const [x, y] = z,
    w = Math.hypot(x, y);
  if (x >= 0) return false;
  return -x / w >= reg.zmin - 1e-9 && -x >= reg.smin - 1e-9;
};
/** What the measurements of one evaluation are taken from */
interface SpecContext {
  /** step-response metrics (null: no step or trapezoid reference, or diverged) */
  mt: StepMetrics | null;
  /** the time response diverged (time-domain specifications fail) */
  diverged: boolean;
  fr: FreqResult | null;
  pz: PZResult | null;
}
/** A measured value: value null shows `none` (or —); fail: not met whatever the value; noneOk: a null value is met */
interface SpecMeasure {
  value: number | null;
  none?: string;
  noneOk?: boolean;
  fail?: boolean;
}
// A time-domain specification: measured on the step response of a step or trapezoid reference
const timeSpec =
  (f: (m: NonNullable<StepMetrics>) => number | null, none?: string) =>
  (c: SpecContext): SpecMeasure | null =>
    c.diverged ? { value: null, none, fail: true } : c.mt && { value: f(c.mt), none };
// The measurement of each specification (null: it does not apply to the current response)
export const SPEC_MEASURES: Record<SpecKey, (c: SpecContext) => SpecMeasure | null> = {
  os: timeSpec(m => m.os),
  ts: timeSpec(m => m.ts, 'Not settled'),
  tr: timeSpec(m => m.rise),
  sse: timeSpec(m => Math.abs(m.sse)),
  // no crossover: an infinite margin
  pm: c => c.fr && { value: c.fr.pm, none: '∞', noneOk: true },
  gm: c => c.fr && { value: c.fr.gm, none: '∞', noneOk: true },
  // the sensitivity is meaningful for a stable closed loop only
  ms: c => (c.fr && c.fr.ms !== null ? { value: c.fr.ms, fail: !!c.pz && !c.pz.cl.every(z => z[0] < 0) } : null),
  // the smallest damping ratio of the closed-loop poles
  zeta: c =>
    c.pz && c.pz.cl.length
      ? {
          value: Math.min(
            ...c.pz.cl.map(([x, y]) => {
              const w = Math.hypot(x, y);
              return w > 1e-12 ? -x / w : 0;
            }),
          ),
        }
      : null,
};
// Whether a measured value meets the limit of specification k
export function specMet(k: SpecKey, m: SpecMeasure, st: State = S): boolean {
  if (m.fail) return false;
  if (m.value === null) return !!m.noneOk;
  const lim = st.spec[k].v;
  return SPECS[k].bound === 'max' ? m.value <= lim : m.value >= lim;
}
// Evaluate every specification: {key, on, applicable, value, ok, none}
export function evalSpecs(
  sim: SimResult | null = lastSim,
  fr: FreqResult | null = lastFr,
  pz: PZResult | null = lastPZ,
  st: State = S,
): SpecEval {
  const timeOK = !!sim && (st.refType === 'step' || st.refType === 'trap'),
    diverged = timeOK && sim.diverged,
    c: SpecContext = { mt: timeOK && !diverged ? stepMetrics(sim, st) : null, diverged, fr, pz };
  return Object.fromEntries(
    SPEC_KEYS.map(k => {
      const m = SPEC_MEASURES[k](c);
      return [
        k,
        {
          key: k,
          on: specOn(k, st),
          applicable: !!m,
          value: m ? m.value : null,
          ok: m ? specMet(k, m, st) : null,
          none: m?.none,
        },
      ];
    }),
  ) as SpecEval;
}
export const specIcon = (k: SpecKey, ev: SpecEval | null | undefined): string => {
  const e = ev && ev[k];
  if (!e || !e.on || !e.applicable || e.ok === null) return '';
  return e.ok ? '<span class="sp ok">✓</span>' : '<span class="sp ng">✗</span>';
};
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
export function buildSpecs() {
  specRows();
  SPEC_KEYS.forEach(k => {
    const cb = byId<HTMLInputElement>(`spec-${k}-on`),
      inp = byId<HTMLInputElement>(`spec-${k}`);
    cb.checked = S.spec[k].on;
    inp.value = String(S.spec[k].v);
    cb.onchange = () => {
      S.spec[k].on = cb.checked;
      afterSpec();
    };
    inp.onchange = () => {
      const v = parseFloat(inp.value);
      if (isFinite(v) && v >= SPECS[k].low) S.spec[k].v = v;
      inp.value = String(S.spec[k].v);
      afterSpec();
    };
    inp.onkeydown = e => {
      if (e.key === 'Enter') inp.blur();
    };
  });
  $('spec-show').checked = S.spec.show;
  $('spec-show').onchange = () => {
    S.spec.show = $('spec-show').checked;
    afterSpec();
  };
}
export function afterSpec() {
  resetLocus();
  renderSpecs();
  redraw();
}
// Ranges [a, b] of the gain factor k on the root locus for which all closed-loop poles are in the design region
export function specKRanges(locus: LocusPoint[], reg: { zmin: number; smin: number }): [number, number][] {
  const ok = locus.map(({ k, r }) => ({ k, ok: r.every(z => inRegion(z, reg)) })),
    out: [number, number][] = [];
  for (let i = 0; i < ok.length; i++) {
    if (!ok[i].ok) continue;
    let j = i;
    while (j + 1 < ok.length && ok[j + 1].ok) j++;
    out.push([
      i === 0 ? 0 : Math.sqrt(ok[i - 1].k * ok[i].k),
      j === ok.length - 1 ? Infinity : Math.sqrt(ok[j].k * ok[j + 1].k),
    ]);
    i = j;
  }
  return out;
}
