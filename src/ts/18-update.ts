// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Updating and redrawing ================= */
import { S, lastFr, lastFrB, lastPZ, lastSim, setResults } from './06-state.ts';
import { bodeRange, bodeResp, freqResp } from './07-frequency.ts';
import { simulate } from './08-simulation.ts';
import { computePZ, resetLoopCache } from './09-loop.ts';
import { sweepRuns } from './12-sweep.ts';
import { PANELS, shownPanels } from './14-view.ts';
import type { PanelKey } from './14-view.ts';
import { drawBode, drawNich, drawNyq, drawTime } from './15-drawing.ts';
import { drawPZ, pzInfo } from './16-pole-zero.ts';
import {
  renderBodeAsym,
  renderComp,
  renderNyqCrit,
  renderPoles,
  renderSpecs,
  renderSweepTable,
  renderSweepUI,
  renderTune,
  scheduleFormulas,
  scheduleRouth,
  scheduleSSE,
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
  renderComp();
  renderSweepUI();
  setResults({ sweep: sweepRuns() });
  renderSweepTable();
  redraw();
  scheduleFormulas();
}
// What redraw() draws in each panel that is shown (with the text under its plot). null: a panel whose contents
// update() renders (the transfer functions, the poles, the Routh test, the steady-state errors) or that is drawn
// when its parts change (the block diagram). Every panel of PANEL_DEFS needs an entry (a type error otherwise)
const PANEL_DRAW: Record<PanelKey, (() => void) | null> = {
  diag: null,
  time: () => lastSim && drawTime(lastSim),
  tf: null,
  loop: null,
  poles: null,
  routh: null,
  sse: null,
  bode: () => {
    if (!lastFr) return;
    drawBode(lastFr, lastFrB || lastFr);
    renderBodeAsym();
  },
  nyq: () => {
    if (!lastFr) return;
    drawNyq(lastFr);
    renderNyqCrit();
  },
  nich: () => lastFr && drawNich(lastFr),
  pz: () => {
    if (!lastPZ) return;
    drawPZ(lastPZ);
    pzInfo(lastPZ);
  },
};
// Draw the panels that are shown from the last results (also when only the view changes: zoom, size, panels)
export function redraw() {
  if (!lastSim) return;
  for (const k of PANELS) if (shownPanels.has(k)) PANEL_DRAW[k]?.();
}
