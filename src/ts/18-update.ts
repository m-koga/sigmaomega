// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Updating and redrawing ================= */
import { S, lastFr, lastFrB, lastPZ, lastSim, setResults } from './06-state.ts';
import { bodeRange, bodeResp, freqResp } from './07-frequency.ts';
import { simulate } from './08-simulation.ts';
import { computePZ, resetLoopCache } from './09-loop.ts';
import { sweepRuns } from './12-sweep.ts';
import { shownPanels } from './14-view.ts';
import { drawBode, drawNyq, drawTime } from './15-drawing.ts';
import { drawPZ, pzInfo } from './16-pole-zero.ts';
import {
  renderPoles,
  scheduleRouth,
  scheduleSSE,
  renderSpecs,
  renderSweepTable,
  renderSweepUI,
  renderTune,
  scheduleFormulas,
  syncControls,
} from './17-panels.ts';

export let rt: Timer | undefined;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(redraw, 80);
});
export let rafId = 0;
export function scheduleRedraw() {
  if (!rafId)
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      redraw();
    });
}
// Compute everything for the current settings and draw it
export function update() {
  syncControls();
  setResults({ sim: simulate() });
  // a range set by hand returns to the automatic one when the poles, zeros, dead time or simulation time change
  if (S.wr.on && !bodeRange()) S.wr.on = false;
  setResults({ fr: freqResp(), frB: bodeResp(), pz: computePZ() });
  resetLoopCache();
  renderPoles();
  scheduleRouth();
  scheduleSSE();
  renderSpecs();
  renderTune();
  renderSweepUI();
  setResults({ sweep: sweepRuns() });
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
