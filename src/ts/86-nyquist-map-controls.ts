// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Nyquist plot: following the Nyquist contour (the slider and the play button of the tab "Contour mapping") ================= */
import { T } from './02-i18n.ts';
import { lastFr } from './11-state.ts';
import { $ } from './40-dom.ts';
import { shownPanels } from './41-view.ts';
import { drawNyq } from './48-nyquist-plot.ts';
import { MAP_STEPS, drawNyqMap, nyqMapShown, syncNyqMap } from './65-nyquist-map.ts';

let playing = 0; // the animation frame of the play button, 0 when it is not playing
/** Show the point of the contour at the slider: on the s-plane, its image on the Nyquist plot, and its values (the
 *  mark leaves the plot when another tab is chosen) */
export function showNyqMap() {
  if (!shownPanels.has('nyq')) return;
  syncNyqMap();
  if (lastFr) drawNyq(lastFr);
  drawNyqMap();
}
// Play: move along the whole contour in about 10 s (from the start when at the end); pressed again, stop
function togglePlay() {
  const btn = $('nyqMapPlay');
  if (playing) {
    cancelAnimationFrame(playing);
    playing = 0;
    btn.textContent = T('▶ Play');
    return;
  }
  const pos = $('nyqMapPos');
  if (Number(pos.value) >= MAP_STEPS) pos.value = '0';
  const t0 = performance.now(),
    v0 = Number(pos.value);
  btn.textContent = T('■ Stop');
  const frame = (t: number) => {
    const v = Math.min(MAP_STEPS, v0 + ((t - t0) / 10000) * MAP_STEPS);
    pos.value = String(v);
    showNyqMap();
    if (v < MAP_STEPS && nyqMapShown()) playing = requestAnimationFrame(frame);
    else {
      playing = 0;
      btn.textContent = T('▶ Play');
    }
  };
  playing = requestAnimationFrame(frame);
}
$('nyqMapPos').oninput = showNyqMap;
$('nyqMapPlay').onclick = togglePlay;
// choosing a tab under the Nyquist plot shows or removes the mark of the contour mapping
(['click', 'keyup'] as const).forEach(ev =>
  $('ninfo')
    .querySelector('.ptabs')
    ?.addEventListener(ev, () => showNyqMap()),
);
