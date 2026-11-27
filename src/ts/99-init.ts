// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Start-up =================
   Builds the user interface and runs the first simulation.
   This file is the last one of the script; the unit tests load all the other files without it,
   so that the computation can be tested without a real page. */
import { LANG, isLang, langOptions } from './02-i18n.ts';
import { $, applyStaticI18n } from './40-dom.ts';
import { bodeDescDefault } from './47-bode-plot.ts';
import { renderTeX } from './55-formulas.ts';
import { update } from './62-update.ts';
import { buildMenus, buildPlant } from './70-controls.ts';
import { buildCtrlCustom } from './71-controller-input.ts';
import { buildSpecs, buildSweep, ghostText } from './73-design-controls.ts';
import { buildStatic } from './74-settings-panel.ts';
import { renderChangelog } from './79-layout.ts';
import { buildScenarios, loadScenarioFromURL } from './81-scenario-card.ts';
import { setLang } from './85-language.ts';

$('langSel').innerHTML = langOptions();
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
