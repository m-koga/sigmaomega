// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= PID tuning rules ================= */
import { T } from './02-i18n.ts';
import { PLANTS } from './03-definitions.ts';
import { lastOf, numStr, polyRoots, trimPoly } from './04-parser.ts';
import { S } from './05-state.ts';
import { $, buildCtrlCustom, renderTeX, showCtrlParam } from './06-ui-build.ts';
import { discretize, makeSS, ssOut, ssStepD } from './07-simulation.ts';
import { bodeSeries, evalPr, freqRange } from './08-frequency.ts';
import { update } from './16-pole-zero.ts';
import { layout } from './17-events-layout.ts';

/** A tuning rule or plant model that cannot be applied: why (a code for tuneErr) */
interface TuneFail {
  err: string;
}
/** Reaction-curve model: max slope R, apparent dead time L, gain K and time constant T (null with an integrator), sign, time scale */
interface StepModel {
  err?: undefined;
  kind: 'step';
  R: number;
  L: number;
  K: number | null;
  T: number | null;
  sgn: number;
  tau: number;
}
/** Ultimate gain Ku, period Pu and frequency wu, sign of the DC gain */
interface UltimateModel {
  err?: undefined;
  kind: 'ult';
  Ku: number;
  Pu: number;
  wu: number;
  sgn: number;
}
type PlantModel = StepModel | UltimateModel;
/** Gains of the standard form (Kp, Ti, Td) and the IMC filter time constant λ */
interface TuneGains {
  Kp: number;
  Ti?: number;
  Td?: number;
  lam?: number;
}
/** Result of a tuning rule, with the model it used (or why it cannot be applied) */
type TuneResult = (TuneGains & { err?: undefined; model: PlantModel }) | { err: string; model: PlantModel | TuneFail };
/* ---- Tuning rules ----
   To add a rule, add an entry to TUNE_RULES with its menu name (and its translations in i18n.json), the plant
   model it uses and its gains for each controller type; the menu, the checks and the result follow from it. */
type TuneType = 'P' | 'PI' | 'PID';
export const TUNE_TYPES: TuneType[] = ['P', 'PI', 'PID'];
interface RuleBase {
  /** name in the menu (English; translated) */
  label: string;
  /** the rule needs the time constant T of the model (not defined for a plant with an integrator) */
  needT?: boolean;
  /** the rule needs an apparent dead time L > 0 (its gain is infinite without one) */
  needDead?: boolean;
}
/** A rule from the reaction-curve model (StepModel) or from the ultimate gain and period (UltimateModel):
    gains of the standard form for the controller type (positive DC gain; the sign is applied by tuneRule),
    or why the rule cannot give that type. lam: IMC filter time constant (null: automatic) */
type TuneRuleDef =
  | (RuleBase & { model: 'step'; gains: (m: StepModel, type: TuneType, lam: number | null) => TuneGains | TuneFail })
  | (RuleBase & { model: 'ult'; gains: (m: UltimateModel, type: TuneType) => TuneGains | TuneFail });
// Rule given as a table of rows [P: Kp·R·L], [PI: Kp·R·L, Ti], [PID: Kp·R·L, Ti, Td] (Ti, Td from L and T)
const reactionRule =
  (rows: (L: number, T: number) => number[][]) =>
  (m: StepModel, type: TuneType): TuneGains => {
    const tab = rows(m.L, m.T ?? 0)[TUNE_TYPES.indexOf(type)], // T is used only by rules that need it (checked)
      r: TuneGains = { Kp: tab[0] / (m.R * m.L) };
    if (tab[1] !== undefined) r.Ti = tab[1];
    if (tab[2] !== undefined) r.Td = tab[2];
    return r;
  };
export const TUNE_RULES: Record<string, TuneRuleDef> = {
  'zn-step': {
    label: 'Ziegler–Nichols (step response)',
    model: 'step',
    needDead: true,
    gains: reactionRule(L => [[1], [0.9, (10 * L) / 3], [1.2, 2 * L, 0.5 * L]]),
  },
  'zn-ult': {
    label: 'Ziegler–Nichols (ultimate sensitivity)',
    model: 'ult',
    gains: (u, type) =>
      type === 'P'
        ? { Kp: 0.5 * u.Ku }
        : type === 'PI'
          ? { Kp: 0.45 * u.Ku, Ti: u.Pu / 1.2 }
          : { Kp: 0.6 * u.Ku, Ti: u.Pu / 2, Td: u.Pu / 8 },
  },
  'chr-sp0': {
    label: 'CHR (set-point, 0% overshoot)',
    model: 'step',
    needDead: true,
    needT: true,
    gains: reactionRule((L, T) => [[0.3], [0.35, 1.2 * T], [0.6, T, 0.5 * L]]),
  },
  'chr-sp20': {
    label: 'CHR (set-point, 20% overshoot)',
    model: 'step',
    needDead: true,
    needT: true,
    gains: reactionRule((L, T) => [[0.7], [0.6, T], [0.95, 1.4 * T, 0.47 * L]]),
  },
  'chr-ld0': {
    label: 'CHR (disturbance, 0% overshoot)',
    model: 'step',
    needDead: true,
    gains: reactionRule(L => [[0.3], [0.6, 4 * L], [0.95, 2.4 * L, 0.42 * L]]),
  },
  'chr-ld20': {
    label: 'CHR (disturbance, 20% overshoot)',
    model: 'step',
    needDead: true,
    gains: reactionRule(L => [[0.7], [0.7, 2.3 * L], [1.2, 2 * L, 0.42 * L]]),
  },
  imc: {
    label: 'IMC (first-order lag + dead time model)',
    model: 'step',
    needT: true,
    gains: (m, type, lam) => {
      if (type === 'P') return { err: 'noP' };
      const K = m.K ?? 0, // K and T are defined: the rule needs T (checked by tuneRule)
        T = m.T ?? 0,
        L = m.L,
        l = lam !== null && lam > 0 ? lam : Math.max(type === 'PI' ? 1.7 * L : 0.8 * L, 0.25 * T),
        r: TuneGains =
          type === 'PI'
            ? { Kp: (2 * T + L) / (2 * K * l), Ti: T + L / 2 }
            : { Kp: (2 * T + L) / (K * (2 * l + L)), Ti: T + L / 2, Td: (T * L) / (2 * T + L) };
      r.lam = l;
      return r;
    },
  },
};
export const TUNE_METHODS = Object.keys(TUNE_RULES);
export const tuneLabel = (m: string) => T(TUNE_RULES[m].label);
export function tuneErr(code: string): string {
  switch (code) {
    case 'unstable':
      return T('Not applicable: the plant is unstable.');
    case 'dc0':
      return T('Not applicable: the DC gain of the plant is zero.');
    case 'noDead':
      return T(
        'Not applicable: the apparent dead time L is almost zero, so this rule gives an infinite gain. Try IMC, or a plant of higher order or with dead time.',
      );
    case 'needT':
      return T(
        'Not applicable: this rule needs the time constant T, which is not defined for a plant with an integrator.',
      );
    case 'noCross':
      return T('Not applicable: the phase of P(jω) does not reach −180°, so the ultimate gain is infinite.');
    default:
      return T('IMC tuning gives PI or PID controllers. Select PI or PID.');
  }
}
// Plant poles: unstable (Re > 0, or on the imaginary axis other than a single integrator), integrator, slowest stable pole
export function plantPoleInfo(tf: TF): { unstable: boolean; integ: boolean; smin: number | null } {
  const rs = polyRoots(trimPoly(tf.den)),
    tiny = (z: Complex) => Math.hypot(z[0], z[1]) < 1e-9;
  const nz = rs.filter(tiny).length,
    others = rs.filter(z => !tiny(z));
  const unstable = nz > 1 || others.some(z => z[0] > -1e-9);
  return { unstable, integ: nz === 1, smin: others.length ? Math.min(...others.map(z => -z[0])) : null };
}
// Reaction-curve model from the unit step response of P(s): tangent at the steepest point
// returns {R (max slope), L (apparent dead time, including the plant dead time), K, T (null with an integrator), sgn}
export function plantStepModel(st: State = S): StepModel | TuneFail {
  const tf = PLANTS[st.plant].tf(st),
    num = trimPoly(tf.num),
    den = trimPoly(tf.den),
    pi = plantPoleInfo(tf);
  if (pi.unstable) return { err: 'unstable' };
  if (pi.smin === null) return { err: 'noDead' };
  const K = pi.integ ? null : lastOf(num) / lastOf(den);
  if (K !== null && Math.abs(K) < 1e-12) return { err: 'dc0' };
  const N = 4000,
    h = 12 / pi.smin / N,
    ss = discretize(makeSS(num, den), h);
  let x = new Array(ss.n).fill(0);
  const y = [ssOut(ss, x, 1)];
  for (let i = 1; i <= N; i++) {
    x = ssStepD(ss, x, 1);
    y.push(ssOut(ss, x, 1));
  }
  const sgn = K !== null ? Math.sign(K) : Math.sign(y[N] - y[N - 1]) || 1;
  let R = -Infinity,
    ti = 0,
    yi = 0;
  for (let i = 0; i < N; i++) {
    const s = (sgn * (y[i + 1] - y[i])) / h;
    if (s > R) {
      R = s;
      ti = (i + 0.5) * h;
      yi = (sgn * (y[i] + y[i + 1])) / 2;
    }
  }
  if (!(R > 0)) return { err: 'dc0' };
  const L0 = Math.max(0, ti - yi / R),
    L = L0 + tf.L,
    tau = K !== null ? Math.abs(K) / R : 1 / pi.smin;
  return { kind: 'step', R, L, K: K !== null ? Math.abs(K) : null, T: K !== null ? Math.abs(K) / R : null, sgn, tau };
}
// Ultimate gain and period: the frequency where the phase of P(jω) (including dead time) reaches −180°
export function plantUltimate(st: State = S): UltimateModel | TuneFail {
  const tf = PLANTS[st.plant].tf(st),
    pi = plantPoleInfo(tf);
  if (pi.unstable) return { err: 'unstable' };
  const num = trimPoly(tf.num),
    den = trimPoly(tf.den);
  const g0 = pi.integ ? lastOf(num) / lastOf(den, 2) : lastOf(num) / lastOf(den);
  if (Math.abs(g0) < 1e-12) return { err: 'dc0' };
  const sgn = Math.sign(g0),
    [a, b] = freqRange(tf, st),
    lo = a - 2,
    hi = b + 2,
    NW = Math.round(400 * (hi - lo));
  const W: number[] = [];
  for (let i = 0; i < NW; i++) W.push(Math.pow(10, lo + ((hi - lo) * i) / (NW - 1)));
  const sr = bodeSeries(
    W,
    (w): Complex => {
      const p = evalPr(w, tf);
      return [sgn * p[0], sgn * p[1]];
    },
    tf.L,
  );
  for (let i = 1; i < NW; i++) {
    if (sr.ph[i - 1] > -180 && sr.ph[i] <= -180) {
      const t = (sr.ph[i - 1] + 180) / (sr.ph[i - 1] - sr.ph[i]);
      const wu = Math.pow(10, Math.log10(W[i - 1]) + t * (Math.log10(W[i]) - Math.log10(W[i - 1])));
      const md = sr.mag[i - 1] + t * (sr.mag[i] - sr.mag[i - 1]);
      return { kind: 'ult', Ku: Math.pow(10, -md / 20), Pu: (2 * Math.PI) / wu, wu, sgn };
    }
  }
  return { err: 'noCross' };
}
// Apply a tuning rule. type: 'P' | 'PI' | 'PID'; lam: IMC filter time constant (null = automatic)
// returns {Kp, Ti, Td, lam, model} or {err, model}
export function tuneRule(method: string, type: string, lam: number | null = null, st: State = S): TuneResult {
  const rule = TUNE_RULES[method],
    tt = (TUNE_TYPES as string[]).includes(type) ? (type as TuneType) : 'PID';
  let r: TuneGains | TuneFail, m: PlantModel;
  if (rule.model === 'ult') {
    const u = plantUltimate(st);
    if (u.err !== undefined) return { err: u.err, model: u };
    m = u;
    r = rule.gains(u, tt);
  } else {
    const sm = plantStepModel(st);
    if (sm.err !== undefined) return { err: sm.err, model: sm };
    m = sm;
    if (rule.needDead && sm.L < 1e-3 * sm.tau) return { err: 'noDead', model: m };
    if (rule.needT && sm.T === null) return { err: 'needT', model: m };
    r = rule.gains(sm, tt, lam);
  }
  if ('err' in r) return { err: r.err, model: m };
  r.Kp *= m.sgn;
  return { ...r, model: m };
}
// Gains of the parallel form C(s) = KP + KI/s + KD s/(s/N+1)
export const tuneGains = (r: TuneGains) => ({ Kp: r.Kp, Ki: r.Ti ? r.Kp / r.Ti : 0, Kd: r.Td ? r.Kp * r.Td : 0 });
export let lastTune: TuneResult | null = null;
export function tuneVisible() {
  const c = document.querySelector<HTMLElement>('.side > .card[data-card="tune"]');
  return !!c && layout.scard === 'tune'; // the card shown in the settings panel
}
export function buildTune() {
  const opt = (v: string, l: string, cur: string) =>
    `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`;
  const inner = `<div class="tune-grid">
      <label for="tuneMethod">${T('Method')}</label><select id="tuneMethod">${TUNE_METHODS.map(m => opt(m, tuneLabel(m), S.tune.method)).join('')}</select>
      <label for="tuneType">${T('Controller type')}</label><select id="tuneType">${TUNE_TYPES.map(m => opt(m, T(m + ' control'), S.tune.type)).join('')}</select>
      <label for="tuneLam" id="tuneLamL">${T('IMC filter time constant λ')}</label><input type="number" id="tuneLam" step="any" min="0" placeholder="${T('auto')}" value="${S.tune.lam ?? ''}">
    </div>
    <div class="poles" id="tuneOut"></div>
    <button class="chip" id="tuneApply">${T('Apply to the controller')}</button>
    <div class="hint">${T('The model is identified from the step or frequency response of P(s) alone, so the closed-loop response can differ from what the rule aims for. The derivative filter N keeps its current value.')}</div>`;
  $('ctrl-tune').innerHTML = inner;
  $('tuneMethod').onchange = () => {
    S.tune.method = $('tuneMethod').value;
    renderTune();
  };
  $('tuneType').onchange = () => {
    S.tune.type = $('tuneType').value;
    renderTune();
  };
  $('tuneLam').onchange = () => {
    const v = parseFloat($('tuneLam').value);
    S.tune.lam = isFinite(v) && v > 0 ? v : null;
    $('tuneLam').value = String(S.tune.lam ?? '');
    renderTune();
  };
  $('tuneLam').onkeydown = e => {
    if (e.key === 'Enter') $('tuneLam').blur();
  };
  $('tuneApply').onclick = applyTune;
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
export function applyTune() {
  const r = lastTune;
  if (!r || r.err !== undefined) return;
  const g = tuneGains(r),
    type = S.tune.type;
  S.mode = type;
  S.lastPid = type;
  S.Kp = +g.Kp.toPrecision(4);
  if (type !== 'P') S.Ki = +g.Ki.toPrecision(4);
  if (type === 'PID') S.Kd = +g.Kd.toPrecision(4);
  (['Kp', 'Ki', 'Kd'] as NumKey[]).forEach(showCtrlParam);
  buildCtrlCustom();
  renderTeX();
  update();
}
