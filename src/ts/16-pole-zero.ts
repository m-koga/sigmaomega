// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Pole-zero map ================= */
// Controller transfer function (P/PI/PD/PID are converted to rational form; common factors at the origin are cancelled)
import { LANG, T, TXT_PZ1, TXT_PZ2, TXT_PZ3, UIFONT } from './02-i18n.ts';
import { CONTROLLERS, CTRL, PLANTS, ctrlRational, isTFMode } from './03-definitions.ts';
import { lastOf, numStr, pAdd, pMul, pScale, polyRoots, trimPoly } from './04-parser.ts';
import { S } from './05-state.ts';
import { $, buildCtrlCustom, ctx2d, fmtVal, must, scheduleFormulas, syncControls } from './06-ui-build.ts';
import { simulate } from './07-simulation.ts';
import { WR_MAX, WR_MIN, bodeRange, bodeResp, freqResp, rangeSig } from './08-frequency.ts';
import { COLORS, bodeDescDefault, drawBode, drawNyq, drawTime, niceTicks, strokeLine } from './09-drawing.ts';
import { SWEEP_COLORS, renderSweepTable, renderSweepUI, sweepName, sweepRuns } from './10-sweep.ts';
import { saveCanvasPNG } from './11-export.ts';
import { renderTune } from './13-tuning.ts';
import { poleRegion, renderSpecs, specKRanges } from './14-specs.ts';
import { PLOT_VIEWS } from './15-zoom.ts';
import { shownPanels } from './17-events-layout.ts';

export function ctrlTF(st: State = S): Rational {
  let num: Poly, den: Poly;
  if (isTFMode(st)) {
    const r = ctrlRational(st);
    num = r.num;
    den = r.den;
  } else {
    const Kp = st.Kp,
      Ki = st.Ki,
      Kd = st.Kd,
      N = st.N;
    let m = st.mode;
    if (m === 'PD' && Kd === 0) m = 'P';
    if (m === 'PID' && Kd === 0) m = 'PI';
    if (m === 'P') {
      num = [Kp];
      den = [1];
    } else if (m === 'PI') {
      num = [Kp, Ki];
      den = [1, 0];
    } else if (m === 'PD') {
      num = [Kp + Kd * N, Kp * N];
      den = [1, N];
    } else {
      num = [Kp + Kd * N, Kp * N + Ki, Ki * N];
      den = [1, N, 0];
    }
  }
  num = trimPoly(num.slice());
  den = trimPoly(den.slice());
  while (num.length > 1 && den.length > 1 && Math.abs(lastOf(num)) < 1e-14 && Math.abs(lastOf(den)) < 1e-14) {
    num = num.slice(0, -1);
    den = den.slice(0, -1);
  }
  return { num, den };
}
export const pAddDesc = (a: Poly, b: Poly): Poly => pAdd(a.slice().reverse(), b.slice().reverse()).reverse();
// Open-loop transfer function L(s) = num/den (dead time replaced by a third-order Padé approximation)
export function loopRational(st: State = S) {
  const tf = PLANTS[st.plant].tf(st),
    c = ctrlTF(st);
  let Nd = [1],
    Dd = [1];
  if (tf.L > 0) {
    const L = tf.L;
    Nd = [-(L ** 3) / 120, (L * L) / 10, -L / 2, 1];
    Dd = [L ** 3 / 120, (L * L) / 10, L / 2, 1];
  } // third-order Padé approximation
  return { num: trimPoly(pMul(pMul(tf.num, c.num), Nd)), den: trimPoly(pMul(pMul(tf.den, c.den), Dd)), tf, c };
}
// Pair each root in r with the nearest root of prev (keeps the branches continuous)
export function matchRoots(prev: Complex[], r: Complex[]): Complex[] {
  const used = new Array(r.length).fill(false);
  return prev.map(p => {
    let bi = -1,
      bd = Infinity;
    r.forEach((q, i) => {
      if (used[i]) return;
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    used[bi] = true;
    return r[bi];
  });
}
// Root locus: closed-loop poles of den + k num for the gain factors ks (k = 1 is the current setting)
export function rootLocus(ks: number[], st: State = S): LocusPoint[] {
  const { num, den } = loopRational(st);
  const out: LocusPoint[] = [];
  let prev: Complex[] | null = null;
  for (const k of ks) {
    const chr = trimPoly(pAddDesc(den, pScale(num, k)));
    let r = polyRoots(chr, prev ?? undefined);
    if (prev && prev.length === r.length) r = matchRoots(prev, r);
    out.push({ k, r });
    prev = r;
  }
  return out;
}
export const LOCUS_KS = (() => {
  const a: number[] = [];
  for (let i = 0; i <= 640; i++) a.push(Math.pow(10, -4 + (8 * i) / 640));
  a.push(1);
  return a.sort((x, y) => x - y);
})();
// Ranges of k (within 1e-4 … 1e4) for which all closed-loop poles are in the left half-plane
export function stableRanges(st: State = S): [number, number][] {
  const { num, den } = loopRational(st);
  const maxRe = (k: number) => Math.max(...polyRoots(trimPoly(pAddDesc(den, pScale(num, k)))).map(z => z[0]));
  const ks = LOCUS_KS,
    stable = ks.map(k => maxRe(k) < 0),
    out: [number, number][] = [];
  const edge = (a: number, b: number) => {
    let lo = a,
      hi = b,
      sa = maxRe(a) < 0;
    for (let i = 0; i < 50; i++) {
      const m = Math.sqrt(lo * hi);
      if (maxRe(m) < 0 === sa) lo = m;
      else hi = m;
    }
    return Math.sqrt(lo * hi);
  };
  let start: number | null = stable[0] ? 0 : null;
  for (let i = 1; i < ks.length; i++) {
    if (stable[i] && !stable[i - 1]) start = edge(ks[i - 1], ks[i]);
    if (!stable[i] && stable[i - 1]) {
      out.push([start ?? 0, edge(ks[i - 1], ks[i])]);
      start = null;
    } // start is set while stable
  }
  if (start !== null) out.push([start, Infinity]);
  return out;
}
// Multiply the controller gain by k
export function applyLoopGain(k: number) {
  const gain = CONTROLLERS[S.mode].gain;
  if (gain.length) gain.forEach(p => (S[p] = +(S[p] * k).toPrecision(6)));
  else {
    S.ccNum = pScale(S.ccNum, k).map(v => +v.toPrecision(6));
    S.ccNumStr = '[' + S.ccNum.join(' ') + ']';
    S.ccTouched = true;
    buildCtrlCustom();
  }
  (['Kp', 'Ki', 'Kd', 'Kc'] as NumKey[]).forEach(p => {
    const el = $(`in-${p}`),
      nm = $(`v-${p}`);
    if (el) {
      el.value = String(S[p]);
      nm.value = fmtVal(p, S[p], CTRL[p]);
    }
  });
  update();
}
export function computePZ(st: State = S) {
  const { num, den, tf, c } = loopRational(st);
  const chr = trimPoly(pAddDesc(den, num));
  const allZero = c.num.every(v => v === 0);
  return {
    pp: polyRoots(tf.den),
    pz: polyRoots(tf.num),
    cp: polyRoots(c.den),
    cz: allZero ? [] : polyRoots(c.num),
    cl: polyRoots(chr),
    pade: tf.L > 0,
    L: tf.L,
  };
}
export let lastPZ: PZResult | null = null,
  pzView: PZView | null = null,
  pzPts: { px: number; py: number; p: PZPoint }[] = [],
  pzLocusPts: { px: number; py: number; k: number; z: Complex }[] = [],
  lastLocus: LocusPoint[] | null = null,
  lastRanges: [number, number][] | null = null;
export const LOCUS_COLOR = COLORS.locus;
// Points used for the automatic view: visible poles/zeros, plus the main part of the root locus
// (0.01 ≤ k ≤ 100, within 3 times the extent of the poles and zeros) so that the imaginary-axis crossing is visible
export function pzAutoPts(pz: PZResult): PZPoint[] {
  const pts = pzVisible(pz).concat(pzSweepPts());
  if ($('pzLocus').checked) {
    const R = 3 * Math.max(1, ...pts.map(q => Math.hypot(q.z[0], q.z[1])));
    locus().forEach(({ k, r }) => {
      if (k < 0.01 || k > 100) return;
      r.forEach(z => {
        if (Math.hypot(z[0], z[1]) <= R) pts.push({ z, k: 'rl' });
      });
    });
  }
  return pts.length
    ? pts
    : [
        { z: [-1, 1], k: 'view' },
        { z: [1, -1], k: 'view' },
      ];
}
// Root locus and stable ranges of k, computed when first needed after each update
export const locus = (): LocusPoint[] => (lastLocus ??= rootLocus(LOCUS_KS));
export const stableKRanges = (): [number, number][] => (lastRanges ??= stableRanges());
export const PZC = { plant: COLORS.output, ctrl: COLORS.input, cl: COLORS.alert };
export function pzVisible(pz: PZResult): PZPoint[] {
  const out: PZPoint[] = [];
  if ($('pzPlant').checked) {
    pz.pp.forEach(z => out.push({ z, k: 'pp' }));
    pz.pz.forEach(z => out.push({ z, k: 'pz' }));
  }
  if ($('pzCtrl').checked) {
    pz.cp.forEach(z => out.push({ z, k: 'cp' }));
    pz.cz.forEach(z => out.push({ z, k: 'cz' }));
  }
  if ($('pzCL').checked) {
    pz.cl.forEach(z => out.push({ z, k: 'cl' }));
  }
  return out;
}
// Closed-loop poles of the sweep (drawn when the closed-loop poles are shown)
export function pzSweepPts(): PZPoint[] {
  if (!lastSweep || !$('pzCL').checked) return [];
  const out: PZPoint[] = [];
  lastSweep.forEach((r, i) => r.pz.cl.forEach(z => out.push({ z, k: 'sw', i, v: r.v })));
  return out;
}
export const PZM = { l: 58, r: 16, t: 12, b: 36 };
export function pzAutoView(pts: PZPoint[], pw: number, ph: number): PZView {
  let x0 = 0,
    x1 = 0,
    y = 0;
  pts.forEach(({ z }) => {
    x0 = Math.min(x0, z[0]);
    x1 = Math.max(x1, z[0]);
    y = Math.max(y, Math.abs(z[1]));
  });
  let xs = x1 - x0 || 1,
    ys = 2 * y;
  if (ys < xs * 0.3) ys = xs * 0.3;
  const k = Math.min(pw / (xs * 1.25), ph / (ys * 1.25));
  return { cx: (x0 + x1) / 2, cy: 0, k: isFinite(k) && k > 0 ? k : 50 };
}
export function fmtC(z: Complex): string {
  const [x, y] = z;
  if (y === 0) return numStr(x);
  return `${numStr(x)} ${y >= 0 ? '+' : '−'} ${numStr(Math.abs(y))}j`;
}
export function pzLabel(p: PZPoint): string {
  if (p.k === 'sw') {
    const [x, y] = p.z,
      wn = Math.hypot(x, y);
    return (
      T('Closed-loop pole ({p})', { p: sweepName(S.sweep.p, p.v ?? 0) }) +
      ': ' +
      fmtC(p.z) +
      (wn > 1e-12 ? `　ζ=${numStr(-x / wn)}, ωn=${numStr(wn)}` : '')
    );
  }
  const name = T(
    (
      {
        pp: 'Plant pole',
        pz: 'Plant zero',
        cp: 'Controller pole',
        cz: 'Controller zero',
        cl: 'Closed-loop pole',
      } as Record<string, string>
    )[p.k],
  );
  const [x, y] = p.z,
    wn = Math.hypot(x, y);
  let extra = '';
  if ((p.k === 'cl' || p.k === 'pp' || p.k === 'cp') && wn > 1e-12) extra = `　ζ=${numStr(-x / wn)}, ωn=${numStr(wn)}`;
  return T('{name}: {v}', { name, v: fmtC(p.z) + extra });
}
/** The pole-zero map being drawn: context, size, plot area, view, visible ranges and the mapping to pixels */
interface PZFrame {
  g: CanvasRenderingContext2D;
  H: number;
  m: typeof PZM;
  pw: number;
  ph: number;
  v: PZView;
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  X: (x: number) => number;
  Y: (y: number) => number;
}

// Draw the pole-zero map: half-planes and grid, ζ–ωn grid, design region, root locus, poles and zeros,
// axes and legend. Also records the drawn points (pzPts, pzLocusPts) for the tooltip and clicks.
export function drawPZ(pz: PZResult | null) {
  const f = pz && pzFrame(pz);
  if (!pz || !f) return;
  const { g, m, pw, ph } = f;
  g.save();
  g.beginPath();
  g.rect(m.l, m.t, pw, ph);
  g.clip();
  drawPZBackground(f);
  if ($('pzGrid').checked) drawDampingGrid(f);
  const reg = poleRegion();
  if (reg && S.spec.show) drawDesignRegion(f, reg);
  pzLocusPts = [];
  if ($('pzLocus').checked) drawRootLocus(f);
  const pts = pzVisible(pz);
  drawPZPoints(f, pts);
  g.restore();
  drawPZAxes(f);
  drawPZLegend(f, pts);
}

// Size the canvas, clear it and set up the view (the automatic one unless zoomed or panned)
export function pzFrame(pz: PZResult): PZFrame | null {
  const cv = $('cvPZ'),
    dpr = window.devicePixelRatio || 1,
    W = cv.clientWidth,
    H = cv.clientHeight;
  if (!W) return null;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const g = ctx2d(cv);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const m = PZM,
    pw = W - m.l - m.r,
    ph = H - m.t - m.b,
    v = pzView || pzAutoView(pzAutoPts(pz), pw, ph);
  $('pzTools').classList.toggle('zoomed', !!pzView); // zoomed or panned: the buttons stay, for "Fit"
  const ox = m.l + pw / 2,
    oy = m.t + ph / 2;
  return {
    g,
    H,
    m,
    pw,
    ph,
    v,
    xmin: v.cx - pw / 2 / v.k,
    xmax: v.cx + pw / 2 / v.k,
    ymin: v.cy - ph / 2 / v.k,
    ymax: v.cy + ph / 2 / v.k,
    X: x => ox + (x - v.cx) * v.k,
    Y: y => oy - (y - v.cy) * v.k,
  };
}

// Right half-plane shaded, grid lines, and the real and imaginary axes
export function drawPZBackground(f: PZFrame) {
  const { g, m, pw, ph, X, Y } = f;
  const x0 = Math.max(m.l, Math.min(m.l + pw, X(0)));
  g.fillStyle = COLORS.rightHalfPlane;
  g.fillRect(x0, m.t, m.l + pw - x0, ph);
  g.strokeStyle = COLORS.grid;
  g.lineWidth = 1;
  niceTicks(f.xmin, f.xmax, 8).forEach(t => strokeLine(g, X(t), m.t, X(t), m.t + ph));
  niceTicks(f.ymin, f.ymax, 6).forEach(t => strokeLine(g, m.l, Y(t), m.l + pw, Y(t)));
  g.strokeStyle = COLORS.axisPZ;
  g.lineWidth = 1.3;
  strokeLine(g, m.l, Y(0), m.l + pw, Y(0));
  strokeLine(g, X(0), m.t, X(0), m.t + ph);
}

// ζ–ωn grid: rays of constant damping ratio and circles of constant natural frequency
export function drawDampingGrid(f: PZFrame) {
  const { g, X, Y, xmin, xmax, ymin, ymax } = f;
  g.strokeStyle = COLORS.dampingGrid;
  g.fillStyle = COLORS.dampingLabel;
  g.lineWidth = 1;
  g.setLineDash([4, 4]);
  g.font = '10.5px "JetBrains Mono", monospace';
  g.textAlign = 'center';
  const R = Math.hypot(Math.max(Math.abs(xmin), Math.abs(xmax)), Math.max(Math.abs(ymin), Math.abs(ymax))),
    lr = (0.8 * Math.min(xmax - xmin, ymax - ymin)) / 2; // where the ζ labels are written
  [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].forEach(z => {
    const c = -z,
      s = Math.sqrt(1 - z * z);
    strokeLine(g, X(0), Y(0), X(c * R), Y(s * R));
    strokeLine(g, X(0), Y(0), X(c * R), Y(-s * R));
    g.fillText('ζ=' + z, X(c * lr), Y(s * lr) - 3);
  });
  niceTicks(0, R, 5)
    .filter(w => w > 0)
    .forEach(w => {
      g.beginPath();
      g.arc(X(0), Y(0), w * f.v.k, Math.PI / 2, (3 * Math.PI) / 2);
      g.stroke();
      g.fillText(numStr(w), X(-w), Y(0) + 12);
    });
  g.setLineDash([]);
}

// Design region of the pole specifications (ζ ≥ zmin, −Re ≥ smin): the area outside it is shaded
export function drawDesignRegion(f: PZFrame, reg: { zmin: number; smin: number }) {
  const { g, m, pw, ph, X, Y, xmin, xmax, ymin, ymax } = f;
  const t = Math.sqrt(1 - reg.zmin * reg.zmin) / Math.max(reg.zmin, 1e-6), // slope of the ζ = zmin rays
    s = reg.smin,
    xf = Math.min(xmin, -s) - 10 * (xmax - xmin + ymax - ymin); // far to the left
  g.beginPath();
  g.rect(m.l, m.t, pw, ph);
  g.moveTo(X(-s), Y(t * s));
  g.lineTo(X(xf), Y(-t * xf));
  g.lineTo(X(xf), Y(t * xf));
  g.lineTo(X(-s), Y(-t * s));
  g.closePath();
  g.fillStyle = COLORS.outsideRegion;
  g.fill('evenodd');
  g.strokeStyle = COLORS.spec;
  g.lineWidth = 1.4;
  g.setLineDash([6, 4]);
  g.beginPath();
  g.moveTo(X(xf), Y(-t * xf));
  g.lineTo(X(-s), Y(t * s));
  g.lineTo(X(-s), Y(-t * s));
  g.lineTo(X(xf), Y(t * xf));
  g.stroke();
  g.setLineDash([]);
}

// Root locus, one branch at a time; jumps (a branch going to infinity) are not joined
export function drawRootLocus(f: PZFrame) {
  const { g, X, Y } = f;
  const loc = locus(),
    n = loc.length ? loc[0].r.length : 0,
    lim = 0.5 * Math.min(f.pw, f.ph);
  g.strokeStyle = LOCUS_COLOR;
  g.lineWidth = 1.8;
  for (let b = 0; b < n; b++) {
    g.beginPath();
    let pen = false,
      px0 = 0,
      py0 = 0;
    loc.forEach(({ k, r }) => {
      const z = r[b];
      if (!z) return;
      const px = X(z[0]),
        py = Y(z[1]);
      if (!isFinite(px) || !isFinite(py)) {
        pen = false;
        return;
      }
      if (pen && Math.hypot(px - px0, py - py0) > lim) pen = false;
      if (pen) g.lineTo(px, py);
      else g.moveTo(px, py);
      pen = true;
      px0 = px;
      py0 = py;
      pzLocusPts.push({ px, py, k, z });
    });
    g.stroke();
  }
}

// Colour of a kind of point: plant, controller, closed loop, root locus, or sweep run i ('sw' + i)
export function pzColor(k: string): string {
  if (k.startsWith('sw')) return SWEEP_COLORS[+k.slice(2)];
  if (k === 'rl') return LOCUS_COLOR;
  return k[0] === 'p' ? PZC.plant : k === 'cl' ? PZC.cl : PZC.ctrl;
}

// Cross (×) marking a pole; size: half the width [px]
export function pzCross(g: CanvasRenderingContext2D, px: number, py: number, size: number) {
  g.beginPath();
  g.moveTo(px - size, py - size);
  g.lineTo(px + size, py + size);
  g.moveTo(px + size, py - size);
  g.lineTo(px - size, py + size);
  g.stroke();
}

// Closed-loop poles of the sweep runs (small dots), then the poles and zeros (closed-loop poles on top)
export function drawPZPoints(f: PZFrame, pts: PZPoint[]) {
  const { g, X, Y } = f;
  pzPts = [];
  pzSweepPts().forEach(q => {
    const px = X(q.z[0]),
      py = Y(q.z[1]);
    pzPts.push({ px, py, p: q });
    g.fillStyle = SWEEP_COLORS[q.i ?? 0];
    g.beginPath();
    g.arc(px, py, 4, 0, 2 * Math.PI);
    g.fill();
    g.strokeStyle = COLORS.white;
    g.lineWidth = 0.8;
    g.stroke();
  });
  const order: Record<string, number> = { pp: 0, pz: 1, cp: 2, cz: 3, cl: 4 };
  pts
    .slice()
    .sort((a, b) => order[a.k] - order[b.k])
    .forEach(p => {
      const px = X(p.z[0]),
        py = Y(p.z[1]);
      pzPts.push({ px, py, p });
      g.strokeStyle = g.fillStyle = pzColor(p.k);
      g.lineWidth = 2.2;
      if (p.k === 'pp' || p.k === 'cp') pzCross(g, px, py, 6.5);
      else if (p.k === 'pz' || p.k === 'cz') {
        g.beginPath();
        g.arc(px, py, 6, 0, 2 * Math.PI);
        g.stroke();
      } else {
        g.beginPath();
        g.arc(px, py, 4.8, 0, 2 * Math.PI);
        g.fill();
        g.strokeStyle = COLORS.white;
        g.lineWidth = 1;
        g.stroke();
      }
    });
}

// Frame, tick labels inside the visible area, and axis names
export function drawPZAxes(f: PZFrame) {
  const { g, m, pw, ph, X, Y } = f;
  g.strokeStyle = COLORS.frame;
  g.strokeRect(m.l, m.t, pw, ph);
  g.font = '11px "JetBrains Mono", monospace';
  g.fillStyle = COLORS.tick;
  g.textAlign = 'center';
  niceTicks(f.xmin, f.xmax, 8).forEach(t => {
    const x = X(t);
    if (x >= m.l - 1 && x <= m.l + pw + 1) g.fillText((+t.toPrecision(6)).toString(), x, m.t + ph + 15);
  });
  g.textAlign = 'right';
  niceTicks(f.ymin, f.ymax, 6).forEach(t => {
    const y = Y(t);
    if (y >= m.t - 1 && y <= m.t + ph + 1) g.fillText((+t.toPrecision(6)).toString(), m.l - 6, y + 4);
  });
  g.fillStyle = COLORS.text;
  g.font = '12px ' + UIFONT();
  g.textAlign = 'center';
  g.fillText(T('Real axis Re'), m.l + pw / 2, f.H - 4);
  g.save();
  g.translate(13, m.t + ph / 2);
  g.rotate(-Math.PI / 2);
  g.fillText(T('Imaginary axis Im'), 0, 0);
  g.restore();
}

// Legend: the kinds of points that are shown, the root locus, and the sweep runs
export function drawPZLegend(f: PZFrame, pts: PZPoint[]) {
  const present = new Set(pts.map(q => q.k));
  const leg: [string, string][] = [];
  const add = (k: string, label: string) => {
    if (present.has(k)) leg.push([k, T(label)]);
  };
  if ($('pzPlant').checked) {
    add('pp', 'Plant pole');
    add('pz', 'Plant zero');
  }
  if ($('pzCtrl').checked) {
    add('cp', 'Controller pole');
    add('cz', 'Controller zero');
  }
  if ($('pzCL').checked) add('cl', 'Closed-loop pole');
  if ($('pzLocus').checked && pzLocusPts.length) leg.push(['rl', T('Root locus')]);
  if (pzSweepPts().length && lastSweep) lastSweep.forEach((r, i) => leg.push(['sw' + i, T(sweepName(S.sweep.p, r.v))]));
  if (!leg.length) return;
  const { g, m } = f,
    bx = m.l + 10,
    by = m.t + 10;
  g.font = '12px ' + UIFONT();
  const w = Math.max(...leg.map(l => g.measureText(l[1]).width));
  g.fillStyle = COLORS.legendBackPZ;
  g.fillRect(bx - 4, by - 4, w + 38, leg.length * 18 + 6);
  leg.forEach(([k, t], i) => {
    const px = bx + 10,
      py = by + 9 + i * 18;
    g.strokeStyle = g.fillStyle = pzColor(k);
    g.lineWidth = 2;
    if (k === 'rl') strokeLine(g, px - 7, py, px + 7, py);
    else if (k === 'pp' || k === 'cp') pzCross(g, px, py, 5);
    else if (k === 'pz' || k === 'cz') {
      g.beginPath();
      g.arc(px, py, 5, 0, 2 * Math.PI);
      g.stroke();
    } else {
      g.beginPath();
      g.arc(px, py, 4.5, 0, 2 * Math.PI);
      g.fill();
    }
    g.fillStyle = COLORS.text;
    g.textAlign = 'left';
    g.fillText(t, px + 14, py + 4);
  });
}
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
  $('pzNote').innerHTML = T(TXT_PZ1) + (pz.pade ? T(TXT_PZ2, { L: numStr(pz.L) }) : '') + (S.sat ? T(TXT_PZ3) : '');
  if (window.MathJax && MathJax.typesetPromise) {
    MathJax.typesetPromise([$('pzNote')]).catch(() => {});
  }
}
// View of the pole-zero map; the automatic view is fixed when the user first zooms or pans
// Back to the automatic view of the map
export function resetPZView() {
  pzView = null;
}
// The root locus is computed again when next needed (the pole specifications changed)
export function resetLocus() {
  lastLocus = null;
}
export function pzCurrentView(): PZView {
  if (!pzView) {
    const cv = $('cvPZ');
    pzView = lastPZ
      ? pzAutoView(pzAutoPts(lastPZ), cv.clientWidth - PZM.l - PZM.r, cv.clientHeight - PZM.t - PZM.b)
      : { cx: 0, cy: 0, k: 50 };
  }
  return pzView;
}

// Zoom the map by the factor f, keeping the point under (mx, my) [px on the canvas] in place
export function pzZoomAt(f: number, mx: number, my: number) {
  const cv = $('cvPZ'),
    v = pzCurrentView();
  const ox = PZM.l + (cv.clientWidth - PZM.l - PZM.r) / 2,
    oy = PZM.t + (cv.clientHeight - PZM.t - PZM.b) / 2;
  const wx = v.cx + (mx - ox) / v.k,
    wy = v.cy - (my - oy) / v.k;
  v.k *= f;
  v.cx = wx - (mx - ox) / v.k;
  v.cy = wy + (my - oy) / v.k;
  drawPZ(lastPZ);
}

// Show the tooltip of the map with text near (px, py), kept inside the canvas
export function showPZTip(text: string, px: number, py: number) {
  const tip = $('pzTip');
  tip.textContent = text;
  tip.style.display = 'block';
  tip.style.left = Math.min(Math.max(4, px + 12), $('cvPZ').clientWidth - tip.offsetWidth - 4) + 'px';
  tip.style.top = py - 34 + 'px';
}

// Hover at (mx, my): tooltip of the nearest pole or zero within 10 px, otherwise of the nearest point of the
// root locus within 7 px. Returns the gain factor k of that locus point (applied on a click), or null.
export function pzHover(mx: number, my: number): number | null {
  const nearest = <P extends { px: number; py: number }>(pts: P[], within: number): P | null => {
    let best: P | null = null,
      bd = within;
    for (const q of pts) {
      const d = Math.hypot(q.px - mx, q.py - my);
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  };
  const p = nearest(pzPts, 10),
    l = p ? null : nearest(pzLocusPts, 7);
  $('cvPZ').style.cursor = l ? 'pointer' : '';
  if (p) showPZTip(pzLabel(p.p), p.px, p.py);
  else if (l) {
    const [x, y] = l.z,
      wn = Math.hypot(x, y);
    const zw = wn > 1e-12 ? `  ζ=${numStr(-x / wn)}, ωn=${numStr(wn)}` : '';
    showPZTip(
      T('Root locus: k = {k}', { k: numStr(l.k) }) + '  ' + fmtC(l.z) + zw + '  ' + T('(click to apply this gain)'),
      l.px,
      l.py,
    );
  } else $('pzTip').style.display = 'none';
  return l ? l.k : null;
}

// Interaction with the map: wheel to zoom, drag to pan, double-click or Fit to reset the view, tooltip on hover,
// click on the root locus to apply its gain; buttons to zoom and save as PNG; check boxes of what is shown
(() => {
  const cv = $('cvPZ'),
    tip = $('pzTip'),
    hideTip = () => (tip.style.display = 'none'),
    fit = () => {
      pzView = null;
      drawPZ(lastPZ);
    };
  let drag: { x: number; y: number; cx: number; cy: number } | null = null, // start of a drag (pointer and view centre)
    moved = 0, // largest distance from the start [px]: below 4 px it is a click
    hoverK: number | null = null; // gain of the root locus point under the pointer
  cv.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      pzZoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
      hideTip();
    },
    { passive: false },
  );
  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    cv.setPointerCapture(e.pointerId);
    const v = pzCurrentView();
    drag = { x: e.clientX, y: e.clientY, cx: v.cx, cy: v.cy };
    moved = 0;
    cv.classList.add('panning');
    hideTip();
  });
  cv.addEventListener('pointermove', e => {
    if (drag) {
      moved = Math.max(moved, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
      if (moved < 4) return;
      const v = pzCurrentView();
      v.cx = drag.cx - (e.clientX - drag.x) / v.k;
      v.cy = drag.cy + (e.clientY - drag.y) / v.k;
      drawPZ(lastPZ);
      return;
    }
    const r = cv.getBoundingClientRect();
    hoverK = pzHover(e.clientX - r.left, e.clientY - r.top);
  });
  const end = (e: PointerEvent) => {
    const click = drag && moved < 4;
    drag = null;
    cv.classList.remove('panning');
    if (click && hoverK !== null && e.type === 'pointerup') {
      const k = hoverK;
      hoverK = null;
      hideTip();
      applyLoopGain(k);
    }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', hideTip);
  cv.addEventListener('dblclick', fit);
  const zoomCentre = (f: number) =>
    pzZoomAt(f, cv.clientWidth / 2 + (PZM.l - PZM.r) / 2, cv.clientHeight / 2 + (PZM.t - PZM.b) / 2);
  $('pzIn').onclick = () => zoomCentre(1.4);
  $('pzOut').onclick = () => zoomCentre(1 / 1.4);
  $('pzFit').onclick = fit;
  $('pzPng').onclick = () => saveCanvasPNG(cv);
  (['pzPlant', 'pzCtrl', 'pzCL', 'pzLocus', 'pzGrid'] as const).forEach(id => ($(id).onchange = () => drawPZ(lastPZ)));
})();

// Options of the Bode and Nyquist plots: redraw when a check box changes; the description line of the Bode
// curve buttons shows the hovered or focused one, otherwise the curves that are shown
(() => {
  (['bodeL', 'bodeP', 'bodeC', 'bodeS', 'bodeT', 'bodeD', 'bodeR'] as const).forEach(
    id =>
      ($(id).onchange = () => {
        if (shownPanels.has('bode') && lastFr) drawBode(lastFr, lastFrB || lastFr);
      }),
  );
  document.querySelectorAll<HTMLElement>('#bodeOpts .ctg').forEach(l => {
    l.dataset.desc = l.getAttribute('title') ?? '';
    const show = () => {
      $('bodeDesc').textContent = l.title;
    };
    const inp = must(l.querySelector('input'), 'check box of a Bode curve');
    l.addEventListener('mouseenter', show);
    inp.addEventListener('focus', show);
    l.addEventListener('mouseleave', bodeDescDefault);
    inp.addEventListener('blur', bodeDescDefault);
    inp.addEventListener('change', bodeDescDefault);
  });
  // Frequency range of the Bode plot set by hand; the zoom of the Bode plots is reset to show it
  const resetBodeViews = () =>
    ['cvG', 'cvPh'].forEach(id => {
      if (PLOT_VIEWS[id]) delete PLOT_VIEWS[id].x;
    });
  const commitWr = () => {
    const lo = Math.max(WR_MIN, parseFloat($('wrLo').value)),
      hi = Math.min(WR_MAX, parseFloat($('wrHi').value));
    if (isFinite(lo) && isFinite(hi) && hi > lo) {
      S.wr = { on: true, lo, hi, sig: rangeSig() };
      resetBodeViews();
    }
    update(); // also shows the range again when the input was not valid
  };
  (['wrLo', 'wrHi'] as const).forEach(id => {
    $(id).onchange = commitWr;
    $(id).onkeydown = e => {
      if (e.key === 'Enter') commitWr();
    };
  });
  $('wrAuto').onclick = () => {
    S.wr.on = false;
    resetBodeViews();
    update();
  };
  $('nyqMs').onchange = () => {
    if (shownPanels.has('nyq') && lastFr) drawNyq(lastFr);
  };
})();

// Results of the last update(), drawn by redraw()
export let lastSim: SimResult | null = null,
  lastFr: FreqResult | null = null,
  lastFrB: FreqResult | null = null,
  lastSweep: SweepRun[] | null = null;
// Compute everything for the current settings and draw it
export function update() {
  syncControls();
  lastSim = simulate();
  // a range set by hand returns to the automatic one when the poles, zeros, dead time or simulation time change
  if (S.wr.on && !bodeRange()) S.wr.on = false;
  lastFr = freqResp();
  lastFrB = bodeResp();
  lastPZ = computePZ();
  lastLocus = null;
  lastRanges = null;
  renderSpecs();
  renderTune();
  renderSweepUI();
  lastSweep = sweepRuns();
  renderSweepTable();
  redraw();
  scheduleFormulas();
}
export function redraw() {
  if (!lastSim) return;
  if (shownPanels.has('time')) drawTime(lastSim);
  if (shownPanels.has('bode') && lastFr) drawBode(lastFr, lastFrB || lastFr);
  if (shownPanels.has('nyq') && lastFr) drawNyq(lastFr);
  if (shownPanels.has('pz') && lastPZ) {
    drawPZ(lastPZ);
    pzInfo(lastPZ);
  }
}
