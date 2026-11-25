// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Switching the language ================= */
import { setLangCode } from './02-i18n.ts';
import type { Lang } from './02-i18n.ts';
import { $, applyStaticI18n } from './13-dom.ts';
import { bodeDescDefault } from './15-drawing.ts';
import { renderTeX } from './17-panels.ts';
import { update } from './18-update.ts';
import { buildCtrlCustom, buildPlant, buildStatic, ghostText } from './19-controls.ts';
import { refreshGripLabels, renderChangelog } from './24-layout.ts';
import { renderScenarios } from './25-scenarios.ts';

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
