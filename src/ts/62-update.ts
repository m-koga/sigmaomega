// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Updating and redrawing ================= */
import { S, lastFr, lastFrB, lastPZ, lastSim, setResults } from './11-state.ts';
import { bodeRange, bodeResp, freqResp } from './15-frequency.ts';
import { simulate } from './16-simulation.ts';
import { computePZ } from './17-loop.ts';
import { resetLoopCache } from './23-loop-analysis.ts';
import { sweepRuns } from './28-sweep.ts';
import { PANELS, shownPanels } from './41-view.ts';
import type { PanelKey } from './41-view.ts';
import { drawTime } from './46-time-plot.ts';
import { drawBode } from './47-bode-plot.ts';
import { drawNyq } from './48-nyquist-plot.ts';
import { drawNich } from './49-nichols-chart.ts';
import { drawPZ } from './50-pole-zero-map.ts';
import { pzInfo } from './51-pole-zero-info.ts';
import { syncControls } from './54-settings-sync.ts';
import { scheduleFormulas } from './55-formulas.ts';
import { renderPoles } from './56-poles-table.ts';
import { scheduleRouth } from './57-routh-panel.ts';
import { renderBodeAsym, renderNyqCrit } from './58-plot-notes.ts';
import { scheduleSSE } from './59-steady-state-panel.ts';
import { renderComp, renderSpecs, renderTune } from './60-design-cards.ts';
import { renderSweepTable, renderSweepUI } from './61-sweep-panel.ts';

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
/** What the files after this one add: AFTER_UPDATE, called by update() after the computation (the panels rendered a
 *  moment after a change); DRAW_HOOKS, called by redraw() before and after drawing a panel */
export const AFTER_UPDATE: (() => void)[] = [];
export const DRAW_HOOKS: Partial<Record<PanelKey, { before: (() => void)[]; after: (() => void)[] }>> = {};
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
  AFTER_UPDATE.forEach(f => f());
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
    DRAW_HOOKS.nyq?.before.forEach(f => f());
    drawNyq(lastFr);
    renderNyqCrit();
    DRAW_HOOKS.nyq?.after.forEach(f => f());
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
