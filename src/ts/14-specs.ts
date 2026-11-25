// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Design specifications ================= */
import { T } from './02-i18n.ts';
import { numStr } from './04-parser.ts';
import { S } from './05-state.ts';
import { $ } from './06-ui-build.ts';
import { stepMetrics } from './07-simulation.ts';
import { lastFr, lastPZ, lastSim, redraw, resetLocus } from './16-pole-zero.ts';

export const SPEC_KEYS = ['os', 'ts', 'tr', 'sse', 'pm', 'gm', 'ms', 'zeta'] as const;
export const SPEC_UNITS: Record<SpecKey, string> = {
  os: ' %',
  ts: ' s',
  tr: ' s',
  sse: '',
  pm: ' °',
  gm: ' dB',
  ms: '',
  zeta: '',
};
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
// Evaluate every specification: {key, on, applicable, value, ok}
export function evalSpecs(
  sim: SimResult | null = lastSim,
  fr: FreqResult | null = lastFr,
  pz: PZResult | null = lastPZ,
  st: State = S,
): SpecEval {
  const out = {} as SpecEval;
  const timeOK = sim && (st.refType === 'step' || st.refType === 'trap');
  const mt = timeOK && !sim.diverged ? stepMetrics(sim, st) : null;
  const put = (k: SpecKey, applicable: boolean, value: number | null, ok: boolean | null) => {
    out[k] = { key: k, on: specOn(k, st), applicable, value, ok: applicable ? ok : null };
  };
  const lim = (k: SpecKey) => st.spec[k].v;
  if (timeOK && sim.diverged) {
    (['os', 'ts', 'tr', 'sse'] as SpecKey[]).forEach(k => put(k, true, null, false));
  } else {
    put('os', !!mt, mt ? mt.os : null, mt ? mt.os <= lim('os') : null);
    put('ts', !!mt, mt ? mt.ts : null, mt ? mt.ts !== null && mt.ts <= lim('ts') : null);
    put('tr', !!mt, mt ? mt.rise : null, mt ? mt.rise !== null && mt.rise <= lim('tr') : null);
    put('sse', !!mt, mt ? Math.abs(mt.sse) : null, mt ? Math.abs(mt.sse) <= lim('sse') : null);
  }
  put('pm', !!fr, fr ? fr.pm : null, fr ? (fr.pm === null ? true : fr.pm >= lim('pm')) : null);
  put('gm', !!fr, fr ? fr.gm : null, fr ? (fr.gm === null ? true : fr.gm >= lim('gm')) : null);
  const stableCL = pz ? pz.cl.every(z => z[0] < 0) : true;
  put('ms', !!fr && fr.ms !== null, fr ? fr.ms : null, fr && fr.ms !== null ? stableCL && fr.ms <= lim('ms') : null);
  const zs = pz
    ? pz.cl.map(([x, y]) => {
        const w = Math.hypot(x, y);
        return w > 1e-12 ? -x / w : 0;
      })
    : [];
  const zmin = zs.length ? Math.min(...zs) : null;
  put('zeta', !!pz && zs.length > 0, zmin, zmin !== null ? zmin >= lim('zeta') : null);
  return out;
}
export const specIcon = (k: SpecKey, ev: SpecEval | null | undefined): string => {
  const e = ev && ev[k];
  if (!e || !e.on || !e.applicable || e.ok === null) return '';
  return e.ok ? '<span class="sp ok">✓</span>' : '<span class="sp ng">✗</span>';
};
export function renderSpecs(): SpecEval {
  const ev = evalSpecs();
  let n = 0,
    bad = 0;
  SPEC_KEYS.forEach(k => {
    const e = ev[k],
      row = $(`specrow-${k}`),
      res = $(`res-${k}`);
    row.classList.toggle('off', !e.on);
    let v = '—';
    if (e.value === null || e.value === undefined)
      v = (k === 'pm' || k === 'gm') && e.applicable ? '∞' : k === 'ts' && e.applicable ? T('Not settled') : '—';
    else v = numStr(e.value) + SPEC_UNITS[k];
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
export function buildSpecs() {
  SPEC_KEYS.forEach(k => {
    const cb = $(`spec-${k}-on`),
      inp = $(`spec-${k}`);
    cb.checked = S.spec[k].on;
    inp.value = String(S.spec[k].v);
    cb.onchange = () => {
      S.spec[k].on = cb.checked;
      afterSpec();
    };
    inp.onchange = () => {
      const v = parseFloat(inp.value);
      if (isFinite(v) && v >= (k === 'ms' ? 1 : 0)) S.spec[k].v = v;
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
