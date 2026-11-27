// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Pole-zero map: view, zoom and tooltips ================= */
import { T } from './02-i18n.ts';
import { numStr } from './03-math.ts';
import { lastPZ } from './11-state.ts';
import { $ } from './40-dom.ts';
import { PZM, drawPZ, fmtC, pzCurrentView, pzLabel, pzLocusPts, pzPts } from './50-pole-zero-map.ts';

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
  $('cvPZ').style.cursor = p && isPlantPoint(p.p) ? 'grab' : l ? 'pointer' : '';
  if (p) showPZTip(pzLabel(p.p) + (isPlantPoint(p.p) ? '  ' + T('(drag to move it)') : ''), p.px, p.py);
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
// A pole or zero of the plant: it can be dragged to another place
const isPlantPoint = (p: PZPoint) => p.k === 'pp' || p.k === 'pz';
/** The pole or zero of the plant drawn within 10 px of (mx, my), or null */
export function pzPlantAt(mx: number, my: number): PZPoint | null {
  let best: PZPoint | null = null,
    bd = 10;
  for (const q of pzPts) {
    const d = Math.hypot(q.px - mx, q.py - my);
    if (isPlantPoint(q.p) && d < bd) [bd, best] = [d, q.p];
  }
  return best;
}
/** The point of the complex plane at (mx, my) [px on the canvas] in the current view */
export function pzWorldAt(mx: number, my: number): Complex {
  const cv = $('cvPZ'),
    v = pzCurrentView();
  const ox = PZM.l + (cv.clientWidth - PZM.l - PZM.r) / 2,
    oy = PZM.t + (cv.clientHeight - PZM.t - PZM.b) / 2;
  return [v.cx + (mx - ox) / v.k, v.cy - (my - oy) / v.k];
}
