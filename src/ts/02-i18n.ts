// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Internationalization: languages, the dictionary and T() =================
   UI strings are written in English and translated into Japanese, Chinese, Korean, Thai, French, German, Spanish,
   Portuguese and Russian
   through the dictionary I18N (keys are the English strings).
   T(english, {vars}) returns the string in the current language; strings missing from the dictionary stay in English. */
// prettier-ignore
export const I18N: I18nDict = /*@@I18N@@*/{}; // the build puts the dictionary (src/i18n.json) here
/** The display languages, in the order of the language menu. To add a language: an entry here, its translations in
 * src/i18n.json (the key of the entry; tests/i18n.test.ts asks for every string), its type in I18nDict
 * (types.d.ts), and its font in the Google Fonts link of src/index.html.
 *   tag: lang attribute of the page; name: its name in the menu, in that language; font: font of the plots;
 *   docs: language of the user manual and the change log ('en' shows a note that they are in English) */
export const LANGUAGES = {
  ja: { tag: 'ja', name: '日本語', font: '"Noto Sans JP",sans-serif', docs: 'ja' },
  en: { tag: 'en', name: 'English', font: '"Noto Sans JP",sans-serif', docs: 'en' },
  zh: { tag: 'zh-Hans', name: '中文（简体）', font: '"Noto Sans SC","Noto Sans JP",sans-serif', docs: 'en' },
  ko: { tag: 'ko', name: '한국어', font: '"Noto Sans KR","Noto Sans JP",sans-serif', docs: 'en' },
  th: { tag: 'th', name: 'ไทย', font: '"Noto Sans Thai","Noto Sans JP",sans-serif', docs: 'en' },
  fr: { tag: 'fr', name: 'Français', font: '"Noto Sans JP",sans-serif', docs: 'en' },
  de: { tag: 'de', name: 'Deutsch', font: '"Noto Sans JP",sans-serif', docs: 'en' },
  es: { tag: 'es', name: 'Español', font: '"Noto Sans JP",sans-serif', docs: 'en' },
  pt: { tag: 'pt', name: 'Português', font: '"Noto Sans JP",sans-serif', docs: 'en' },
  ru: { tag: 'ru', name: 'Русский', font: '"Noto Sans JP",sans-serif', docs: 'en' },
} as const satisfies Record<string, { tag: string; name: string; font: string; docs: 'ja' | 'en' }>;
/** Display language */
export type Lang = keyof typeof LANGUAGES;
export const isLang = (x: unknown): x is Lang =>
  typeof x === 'string' && Object.prototype.hasOwnProperty.call(LANGUAGES, x);
/** Language of the user manual and the change log in the current language; a note is shown when it differs */
export const docsLang = (): 'ja' | 'en' => LANGUAGES[LANG].docs;
export const docsTranslated = (): boolean => LANGUAGES[LANG].docs === LANG;
// Default language: the saved choice if any; otherwise the browser language (English if not supported)
export function detectLang(): Lang {
  const list = (
    navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']
  ).map(x => String(x).toLowerCase());
  for (const x of list) {
    const p = x.split('-')[0];
    if (isLang(p)) return p;
  }
  return 'en';
}
export let LANG: Lang = 'en';
// Change the display language (the page is updated by setLang in 85-language.ts)
export function setLangCode(l: Lang) {
  LANG = l;
}
try {
  const sv = localStorage.getItem('ctrlsim-lang');
  LANG = isLang(sv) ? sv : detectLang();
} catch (e) {
  LANG = detectLang();
}
export function T(k: string, v?: TVars): string {
  let s = k;
  if (LANG !== 'en') {
    const e = I18N[k];
    const t = e && e[LANG];
    if (t) s = t;
  }
  if (v) s = s.replace(/\{(\w+)\}/g, (m, n) => (n in v ? String(v[n]) : m));
  return s;
}
export const PLANT_FMT =
    'Write polynomials in \\(s\\) such as <code>2*s + 1</code> or <code>(s+1)^2(0.5s+1)</code> (* may be omitted; ^ takes integers 0–20). Coefficient vectors in descending powers such as <code>[1 3 2]</code> are also accepted. The numerator degree must be less than the denominator degree (strictly proper); the denominator may be up to degree 10.',
  CTRL_FMT =
    '\\(C(s)=N_c(s)/D_c(s)\\). Same syntax as the plant. The numerator degree must not exceed the denominator degree (proper). An ideal derivative \\(K_D s\\) cannot be written; add a filter such as \\(K_D s/(\\tau s+1)\\). Anti-windup and PI-D are available only for P/PI/PD/PID.';
export const TXT_COLLAPSED = '"{name}" is hidden — drag down to show (double-click to reset)',
  TXT_TIP = 'Drag to resize (going below the minimum hides it). Double-click to reset';
export const TXT_BODE_UNSTABLE =
    'Note: the open-loop transfer function (plant or controller) has poles in the right half-plane, so gain and phase margins alone cannot determine closed-loop stability. Check the Nyquist criterion (the number of counterclockwise encirclements of −1).',
  TXT_BODE_RANGE =
    'Gain and phase margins are found at the first crossover within 10^{a}–10^{b} rad/s (a range chosen automatically from the poles, zeros, and simulation time).';
export const TXT_PZ1 =
    'Closed-loop poles are the roots of the characteristic equation \\(D_P D_C + N_P N_C = 0\\) (\\(P=N_P/D_P,\\ C=N_C/D_C\\)).',
  TXT_PZ2 =
    ' The dead time \\(e^{-{L}s}\\) is replaced by a third-order Padé approximation, so the closed-loop poles are approximate (the actual system has infinitely many poles).',
  TXT_PZ3 = ' Saturation is nonlinear and is not included in the pole calculation.';
export const UIFONT = (): string => LANGUAGES[LANG].font;
// The options of the language menu
export const langOptions = (): string =>
  (Object.keys(LANGUAGES) as Lang[]).map(l => `<option value="${l}">${LANGUAGES[l].name}</option>`).join('');
