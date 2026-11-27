// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Pole-zero map: drawing, view and tooltips ================= */
import { LANG, T, TXT_PZ1, TXT_PZ2, TXT_PZ3, UIFONT } from './02-i18n.ts';
import { numStr } from './03-math.ts';
import { S, lastPZ, lastSweep } from './06-state.ts';
import { locus, rules, stableKRanges } from './09-loop.ts';
import type { LocusRules } from './09-loop.ts';
import { poleRegion, specKRanges } from './11-specs.ts';
import { SWEEP_COLORS, sweepName } from './12-sweep.ts';
import { $, byId, ctx2d } from './13-dom.ts';
import { COLORS } from './14-view.ts';
import { niceTicks, strokeLine } from './15-drawing.ts';

// View of the map and the points drawn on it (for the tooltip and clicks)
export let pzView: PZView | null = null,
  pzPts: { px: number; py: number; p: PZPoint }[] = [],
  pzLocusPts: { px: number; py: number; k: number; z: Complex }[] = [],
  pzLegendKeys: string[] = []; // the kinds of items in the legend as last drawn
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
  const r = $('pzRules').checked ? rules() : null;
  if (r) {
    r.breakaway.forEach(b => pts.push({ z: b.s, k: 'rl' }));
    r.crossings.forEach(c => pts.push({ z: [0, c.w], k: 'rl' }));
  }
  return pts.length
    ? pts
    : [
        { z: [-1, 1], k: 'view' },
        { z: [1, -1], k: 'view' },
      ];
}
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
  const rl = $('pzRules').checked ? rules() : null;
  if (rl) drawLocusRules(f, rl);
  const pts = pzVisible(pz);
  drawPZPoints(f, pts);
  g.restore();
  drawPZAxes(f);
  drawPZLegend(f, pts, rl);
  if (rl) drawRuleAngles(f, rl);
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

// Construction rules of the root locus under the poles and zeros: the real-axis segments (a wide band), the
// asymptotes (dashed, from the centroid), the breakaway and break-in points (squares) and the imaginary-axis
// crossings (diamonds)
export function drawLocusRules(f: PZFrame, r: LocusRules) {
  const { g, X, Y, xmin, xmax } = f,
    far = 4 * (f.pw + f.ph);
  g.save();
  g.lineCap = 'butt';
  g.strokeStyle = COLORS.locusAxis;
  g.lineWidth = 7;
  r.segments.forEach(([a, b]) => {
    const x1 = X(Math.max(a, xmin - 1)),
      x2 = X(Math.min(b, xmax + 1));
    if (x2 > x1) strokeLine(g, x1, Y(0), x2, Y(0));
  });
  g.strokeStyle = g.fillStyle = COLORS.locusRules;
  if (r.centroid !== null) {
    const cx = X(r.centroid),
      cy = Y(0);
    g.lineWidth = 1.3;
    g.setLineDash([7, 5]);
    r.asymAngles.forEach(a => {
      const t = (a * Math.PI) / 180;
      strokeLine(g, cx, cy, cx + far * Math.cos(t), cy - far * Math.sin(t));
    });
    g.setLineDash([]);
    g.beginPath();
    g.arc(cx, cy, 3.5, 0, 2 * Math.PI);
    g.fill();
  }
  g.lineWidth = 2;
  r.breakaway.forEach(b => {
    [1, -1].forEach(sg => {
      if (sg < 0 && b.s[1] === 0) return;
      g.strokeRect(X(b.s[0]) - 5, Y(sg * b.s[1]) - 5, 10, 10);
    });
  });
  r.crossings.forEach(c => {
    [1, -1].forEach(sg => {
      if (sg < 0 && c.w === 0) return;
      pzDiamond(g, X(0), Y(sg * c.w), 6.5);
      g.stroke();
    });
  });
  g.restore();
}
// Diamond (◇) path centred at (px, py); size: half the width [px]
export function pzDiamond(g: CanvasRenderingContext2D, px: number, py: number, size: number) {
  g.beginPath();
  g.moveTo(px, py - size);
  g.lineTo(px + size, py);
  g.lineTo(px, py + size);
  g.lineTo(px - size, py);
  g.closePath();
}
// Departure angles (arrows leaving the poles) and arrival angles (arrows into the zeros), with their values in
// degrees; a complex pole or zero and its conjugate (mirrored)
export function drawRuleAngles(f: PZFrame, r: LocusRules) {
  const { g, X, Y, m, pw, ph } = f,
    len = 34;
  g.save();
  g.beginPath();
  g.rect(m.l, m.t, pw, ph);
  g.clip();
  g.strokeStyle = g.fillStyle = COLORS.locusRules;
  g.lineWidth = 1.6;
  g.font = '11px "JetBrains Mono", monospace';
  g.textAlign = 'center';
  const arrow = (x0: number, y0: number, x1: number, y1: number) => {
    strokeLine(g, x0, y0, x1, y1);
    const t = Math.atan2(y1 - y0, x1 - x0);
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x1 - 7 * Math.cos(t - 0.45), y1 - 7 * Math.sin(t - 0.45));
    g.lineTo(x1 - 7 * Math.cos(t + 0.45), y1 - 7 * Math.sin(t + 0.45));
    g.closePath();
    g.fill();
  };
  const draw = (list: LocusRules['departures'], out: boolean) =>
    list.forEach(({ at, angles }) =>
      [1, -1].forEach(sg => {
        if (sg < 0 && at[1] === 0) return;
        const px = X(at[0]),
          py = Y(sg * at[1]);
        angles.forEach(a0 => {
          const a = sg * a0,
            t = (a * Math.PI) / 180,
            ex = px + len * Math.cos(t),
            ey = py - len * Math.sin(t),
            sx = px + 8 * Math.cos(t),
            sy = py - 8 * Math.sin(t);
          if (out) arrow(sx, sy, ex, ey);
          else arrow(ex, ey, sx, sy);
          const lx = px + (len + 16) * Math.cos(t),
            ly = py - (len + 16) * Math.sin(t) + 4,
            label = `${numStr(a)}°`;
          g.lineWidth = 3;
          g.strokeStyle = COLORS.white;
          g.strokeText(label, lx, ly);
          g.fillText(label, lx, ly);
          g.lineWidth = 1.6;
          g.strokeStyle = COLORS.locusRules;
        });
      }),
    );
  draw(r.departures, true);
  draw(r.arrivals, false);
  g.restore();
}

// Colour of a kind of point: plant, controller, closed loop, root locus, or sweep run i ('sw' + i)
export function pzColor(k: string): string {
  if (k.startsWith('sw')) return SWEEP_COLORS[+k.slice(2)];
  if (k === 'rl') return LOCUS_COLOR;
  if (['ra', 'as', 'ba', 'ix', 'an'].includes(k)) return COLORS.locusRules;
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
export function drawPZLegend(f: PZFrame, pts: PZPoint[], rl: LocusRules | null = null) {
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
  if (rl) {
    if (rl.segments.length) leg.push(['ra', T('Root locus on the real axis')]);
    if (rl.asymAngles.length) leg.push(['as', T('Asymptotes and their centroid')]);
    if (rl.breakaway.length) leg.push(['ba', T('Breakaway or break-in point')]);
    if (rl.crossings.length) leg.push(['ix', T('Imaginary-axis crossing')]);
    if (rl.departures.length || rl.arrivals.length) leg.push(['an', T('Departure or arrival angle')]);
  }
  if (pzSweepPts().length && lastSweep) lastSweep.forEach((r, i) => leg.push(['sw' + i, T(sweepName(S.sweep.p, r.v))]));
  pzLegendKeys = leg.map(l => l[0]);
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
    else if (k === 'ra') {
      g.strokeStyle = COLORS.locusAxis;
      g.lineWidth = 7;
      strokeLine(g, px - 7, py, px + 7, py);
    } else if (k === 'as') {
      g.lineWidth = 1.3;
      g.setLineDash([4, 3]);
      strokeLine(g, px - 8, py, px + 8, py);
      g.setLineDash([]);
    } else if (k === 'ba') g.strokeRect(px - 4.5, py - 4.5, 9, 9);
    else if (k === 'ix') {
      pzDiamond(g, px, py, 5.5);
      g.stroke();
    } else if (k === 'an') {
      g.lineWidth = 1.6;
      strokeLine(g, px - 7, py, px + 5, py);
      g.beginPath();
      g.moveTo(px + 8, py);
      g.lineTo(px + 2, py - 3.5);
      g.lineTo(px + 2, py + 3.5);
      g.closePath();
      g.fill();
    } else if (k === 'pp' || k === 'cp') pzCross(g, px, py, 5);
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
// View of the pole-zero map; the automatic view is fixed when the user first zooms or pans
// Back to the automatic view of the map
export function resetPZView() {
  pzView = null;
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
