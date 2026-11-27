// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Switching the language ================= */
import { setLangCode } from './02-i18n.ts';
import type { Lang } from './02-i18n.ts';
import { $, applyStaticI18n } from './40-dom.ts';
import { bodeDescDefault } from './47-bode-plot.ts';
import { renderTeX } from './55-formulas.ts';
import { update } from './62-update.ts';
import { buildPlant } from './70-controls.ts';
import { buildCtrlCustom } from './71-controller-input.ts';
import { ghostText } from './73-design-controls.ts';
import { buildStatic } from './74-settings-panel.ts';
import { refreshGripLabels, renderChangelog } from './79-layout.ts';
import { renderScenarios } from './81-scenario-card.ts';

export function setLang(l: Lang) {
  setLangCode(l);
  try {
    localStorage.setItem('ctrlsim-lang', l);
  } catch (e) {}
  $('langSel').value = l;
  applyStaticI18n();
  buildPlant();
  buildStatic();
  buildCtrlCustom();
  ghostText();
  refreshGripLabels();
  renderChangelog();
  renderScenarios();
  bodeDescDefault();
  update();
  renderTeX();
}
