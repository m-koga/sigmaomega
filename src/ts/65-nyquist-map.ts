// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Nyquist plot: the mapping of the Nyquist contour (the s-plane and the point followed on it) ================= */
import { T, UIFONT } from './02-i18n.ts';
import { numStr } from './03-math.ts';
import { nyqPath } from './23-loop-analysis.ts';
import { $, byId, ctx2d } from './40-dom.ts';
import { COLORS } from './41-view.ts';
import { nyqMapAt, setNyqMapAt } from './48-nyquist-plot.ts';
import { DRAW_HOOKS } from './62-update.ts';

/** The tab "Contour mapping" is the one shown under the Nyquist plot */
export const nyqMapShown = () => !byId('nyqMapWrap').closest('.tsec')?.classList.contains('off');
export const MAP_STEPS = 1000; // positions of the slider along the contour
/** Set the point of the contour marked on the Nyquist plot from the slider (none while the tab is not shown) */
export function syncNyqMap() {
  const path = nyqPath();
  setNyqMapAt(
    path && nyqMapShown() ? Math.round((Number($('nyqMapPos').value) / MAP_STEPS) * (path.pts.length - 1)) : null,
  );
}
/** Draw the tab: the s-plane with the point and its values (when the tab is shown) */
export function drawNyqMap() {
  if (!nyqMapShown()) return;
  drawSPlane();
  renderNyqMapRead();
}
// redraw() marks the point on the Nyquist plot and draws the tab with it
DRAW_HOOKS.nyq = { before: [syncNyqMap], after: [drawNyqMap] };
const NS_IND = 7; // radius of the half circles around the poles on the imaginary axis, as drawn [px]
// The s-plane: the right half-plane, the axes, the poles and zeros of L(s), the Nyquist contour (its large half circle
// drawn at 0.85 of the view: it stands for |s| → ∞) and the point followed on it
export function drawSPlane() {
  const cv = $('cvNS'),
    path = nyqPath(),
    dpr = window.devicePixelRatio || 1,
    W = cv.clientWidth,
    H = cv.clientHeight;
  if (!W || !path) return;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const g = ctx2d(cv);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const size = 1.25 * Math.max(1, ...[...path.poles, ...path.zeros].map(z => Math.hypot(...z))),
    k = Math.min(W, H) / (2.3 * size),
    cx = W / 2,
    cy = H / 2,
    X = (x: number) => cx + x * k,
    Y = (y: number) => cy - y * k,
    R = 0.85 * size;
  g.fillStyle = COLORS.rightHalfPlane;
  g.fillRect(cx, 0, W - cx, H);
  g.strokeStyle = COLORS.axisPZ;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, cy);
  g.lineTo(W, cy);
  g.moveTo(cx, 0);
  g.lineTo(cx, H);
  g.stroke();
  drawContour(g, path, X, Y, R, k);
  drawSPoints(g, path, X, Y);
  const i = nyqMapAt;
  if (i !== null && path.pts.length) {
    const [px, py] = contourPx(path.pts[Math.min(i, path.pts.length - 1)], X, Y, R);
    g.fillStyle = COLORS.approx;
    g.strokeStyle = COLORS.white;
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(px, py, 5, 0, 2 * Math.PI);
    g.fill();
    g.stroke();
  }
}
// The ω of the poles of L(s) on the imaginary axis (each once)
const axisPoles = (path: NonNullable<ReturnType<typeof nyqPath>>) =>
  path.pts
    .filter(p => p.arc !== null)
    .map(p => p.arc as number)
    .filter((w, j, a) => a.indexOf(w) === j);
// The contour as drawn: the imaginary axis with half circles to the right of its poles, the large half circle
// (dashed), and arrows along it (clockwise)
function drawContour(
  g: CanvasRenderingContext2D,
  path: NonNullable<ReturnType<typeof nyqPath>>,
  X: (x: number) => number,
  Y: (y: number) => number,
  R: number,
  k: number,
) {
  const ws = axisPoles(path).sort((a, b) => a - b),
    r = NS_IND / k;
  g.strokeStyle = COLORS.output;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(X(0), Y(-R));
  ws.forEach(w => {
    g.lineTo(X(0), Y(w - r));
    g.arc(X(0), Y(w), NS_IND, Math.PI / 2, -Math.PI / 2, true);
  });
  g.lineTo(X(0), Y(R));
  g.stroke();
  g.setLineDash([6, 4]);
  g.beginPath();
  g.arc(X(0), Y(0), R * k, -Math.PI / 2, Math.PI / 2);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = COLORS.output;
  const arrow = (x: number, y: number, a: number) => {
    g.beginPath();
    g.moveTo(x + 7 * Math.cos(a), y + 7 * Math.sin(a));
    g.lineTo(x - 5 * Math.cos(a) - 5 * Math.sin(a), y - 5 * Math.sin(a) + 5 * Math.cos(a));
    g.lineTo(x - 5 * Math.cos(a) + 5 * Math.sin(a), y - 5 * Math.sin(a) - 5 * Math.cos(a));
    g.closePath();
    g.fill();
  };
  arrow(X(0), Y(R / 2), -Math.PI / 2); // up the imaginary axis
  arrow(X(0), Y(-R / 2), -Math.PI / 2);
  arrow(X(R), Y(0), Math.PI / 2); // down along the half circle
  g.font = `11px ${UIFONT}`;
  g.fillStyle = COLORS.text;
  g.fillText('|s| → ∞', X(R * 0.72) + 4, Y(R * 0.72) - 4);
}
// The poles (×, red in the right half-plane) and zeros (○) of L(s)
function drawSPoints(
  g: CanvasRenderingContext2D,
  path: NonNullable<ReturnType<typeof nyqPath>>,
  X: (x: number) => number,
  Y: (y: number) => number,
) {
  g.lineWidth = 2;
  path.poles.forEach(([x, y]) => {
    g.strokeStyle = x > 1e-9 ? COLORS.alert : COLORS.text;
    g.beginPath();
    g.moveTo(X(x) - 5, Y(y) - 5);
    g.lineTo(X(x) + 5, Y(y) + 5);
    g.moveTo(X(x) - 5, Y(y) + 5);
    g.lineTo(X(x) + 5, Y(y) - 5);
    g.stroke();
  });
  g.strokeStyle = COLORS.text;
  path.zeros.forEach(([x, y]) => {
    g.beginPath();
    g.arc(X(x), Y(y), 5, 0, 2 * Math.PI);
    g.stroke();
  });
}
// Where a point of the contour is drawn: on the axis (clamped to the drawn large half circle), on the half circle
// around its pole, or on the large half circle at its angle
function contourPx(
  p: NonNullable<ReturnType<typeof nyqPath>>['pts'][number],
  X: (x: number) => number,
  Y: (y: number) => number,
  R: number,
): [number, number] {
  if (p.big) {
    const a = Math.atan2(p.s[1], p.s[0]);
    return [X(R * Math.cos(a)), Y(R * Math.sin(a))];
  }
  if (p.arc !== null) {
    const a = Math.atan2(p.s[1] - p.arc, p.s[0]);
    return [X(0) + NS_IND * Math.cos(a), Y(p.arc) - NS_IND * Math.sin(a)];
  }
  return [X(0), Y(Math.max(-R, Math.min(R, p.s[1])))];
}
/** The values of the point followed: where it is on the contour, s and L(s), and the turns of the arrow so far */
export function renderNyqMapRead() {
  const box = byId('nyqMapRead'),
    path = nyqPath();
  if (!path || nyqMapAt === null) {
    box.textContent = path ? '' : T('No loop: the controller gain is zero.');
    return;
  }
  const p = path.pts[Math.min(nyqMapAt, path.pts.length - 1)],
    c = (z: Complex) => `${numStr(z[0])} ${z[1] < 0 ? '−' : '+'} ${numStr(Math.abs(z[1]))}j`,
    where = p.big
      ? T('On the half circle at infinity')
      : p.arc !== null
        ? T('On the small half circle around the pole s = {w}j', { w: numStr(p.arc) })
        : T('On the imaginary axis: s = {w}j', { w: numStr(p.s[1]) }),
    last = nyqMapAt >= path.pts.length - 1,
    N = Math.round(p.turns) + 0;
  box.innerHTML =
    `${where}<br>L(s) = ${c(p.l)}<br>` +
    (Math.hypot(...p.l) > 100
      ? T('|L(s)| is large: its image runs along a large arc outside the plot.') + '<br>'
      : '') +
    T('Clockwise turns of the arrow from −1 so far: {t}', { t: numStr(Math.round(p.turns * 100) / 100) }) +
    (last ? `<br><b>N = ${N}, P = ${path.P}, Z = N + P = ${N + path.P}</b>` : '');
}
