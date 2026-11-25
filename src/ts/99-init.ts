// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Start-up =================
   Builds the user interface and runs the first simulation.
   This file is the last one of the script; the unit tests load all the other files without it,
   so that the computation can be tested without a real page. */
import { LANG, applyStaticI18n, isLang } from './02-i18n.ts';
import { $, buildCtrlCustom, buildMenus, buildPlant, buildStatic, renderTeX } from './06-ui-build.ts';
import { bodeDescDefault } from './09-drawing.ts';
import { buildSweep } from './10-sweep.ts';
import { buildScenarios, loadScenarioFromURL } from './12-scenarios.ts';
import { buildSpecs } from './14-specs.ts';
import { update } from './16-pole-zero.ts';
import { ghostText, renderChangelog, setLang } from './17-events-layout.ts';

$('langSel').onchange = () => {
  const v = $('langSel').value;
  if (isLang(v)) setLang(v);
};
$('langSel').value = LANG;
buildMenus();
applyStaticI18n();
ghostText();
renderChangelog();
bodeDescDefault();
buildPlant();
buildStatic();
buildCtrlCustom();
buildSpecs();
buildSweep();
buildScenarios();
update();
renderTeX();
loadScenarioFromURL();
