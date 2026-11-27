// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Settings panel: building its static parts (sliders and cards) ================= */
import { CTRL, DIST, INPUTS, SAT, TDOF, entriesOf } from './10-definitions.ts';
import { S } from './11-state.ts';
import { $ } from './40-dom.ts';
import { PLOT_VIEWS } from './41-view.ts';
import { update } from './62-update.ts';
import { bindSliders, buildRef, slider } from './70-controls.ts';
import { buildExercise } from './72-exercise.ts';
import { buildComp, buildTune } from './73-design-controls.ts';
export function buildStatic() {
  $('ctrl-params').innerHTML = entriesOf(CTRL)
    .map(([k, d]) => slider(k, d))
    .join('');
  bindSliders(CTRL);
  buildTune();
  buildComp();
  buildExercise();
  buildRef();
  $('input-params').innerHTML = entriesOf(INPUTS)
    .map(([k, d]) => slider(k, d))
    .join('');
  bindSliders(INPUTS);
  $('tdof-params').innerHTML = entriesOf(TDOF)
    .map(([k, d]) => slider(k, d))
    .join('');
  bindSliders(TDOF);
  $('dist-params').innerHTML = entriesOf(DIST)
    .map(([k, d]) => slider(k, d))
    .join('');
  bindSliders(DIST);
  $('sat-params').innerHTML = entriesOf(SAT)
    .map(([k, d]) => slider(k, d))
    .join('');
  bindSliders(SAT);
  const ts = $('Tsim'),
    tn = $('TsimNum');
  const showT = () => {
    ts.value = String(Math.log10(S.Tsim));
    tn.value = String(+S.Tsim.toPrecision(4));
  };
  showT();
  const resetTimeViews = () => {
    ['cvY', 'cvU'].forEach(id => {
      if (PLOT_VIEWS[id]) delete PLOT_VIEWS[id].x;
    });
  };
  ts.oninput = () => {
    S.Tsim = +Math.pow(10, parseFloat(ts.value)).toPrecision(3);
    tn.value = String(S.Tsim);
    resetTimeViews();
    update();
  };
  const commitT = () => {
    const v = parseFloat(tn.value);
    if (isFinite(v) && v > 0) {
      S.Tsim = Math.min(10000, Math.max(0.01, v));
    }
    showT();
    resetTimeViews();
    update();
  };
  tn.onchange = commitT;
  tn.onkeydown = e => {
    if (e.key === 'Enter') commitT();
  };
}
