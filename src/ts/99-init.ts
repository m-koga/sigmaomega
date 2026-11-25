// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Start-up =================
   Builds the user interface and runs the first simulation.
   This file is the last one of the script; the unit tests load all the other files without it,
   so that the computation can be tested without a real page. */
import { LANG, isLang, langOptions } from './02-i18n.ts';
import { $, applyStaticI18n } from './13-dom.ts';
import { bodeDescDefault } from './15-drawing.ts';
import { renderTeX } from './17-panels.ts';
import { update } from './18-update.ts';
import {
  buildCtrlCustom,
  buildMenus,
  buildPlant,
  buildSpecs,
  buildStatic,
  buildSweep,
  ghostText,
} from './19-controls.ts';
import { renderChangelog } from './24-layout.ts';
import { buildScenarios, loadScenarioFromURL } from './25-scenarios.ts';
import { setLang } from './29-language.ts';

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
