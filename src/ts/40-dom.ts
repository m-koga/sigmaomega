// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Page elements, numbers in inputs, files and messages ================= */
import { LANG, LANGUAGES, T } from './02-i18n.ts';

// Element by id. Only ids of the page are accepted, and the element has its type (an <input> is an
// HTMLInputElement, a <canvas> an HTMLCanvasElement, ...): see src/ts/element-ids.d.ts, generated from the HTML.
export function $<K extends keyof ElementById>(id: K): ElementById[K] {
  return document.getElementById(id) as ElementById[K];
}
// Element by an id known only when the page runs (from a data attribute or an object key)
export function byId<E extends HTMLElement = HTMLElement>(id: string): E {
  return document.getElementById(id) as E;
}
// A value that is always there (an element of the page, a 2D context, ...): a missing one is a bug, reported clearly
export function must<T>(x: T | null | undefined, what: string): T {
  if (x === null || x === undefined) throw new Error(`missing: ${what}`);
  return x;
}
// Message and code of a caught error (anything can be thrown, so its type is unknown)
export const errMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));
export const errCode = (e: unknown): unknown =>
  typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined;
// An element that is always in the page, by CSS selector (root: where to look)
export function qs<E extends Element = HTMLElement>(sel: string, root: ParentNode = document): E {
  return must(root.querySelector<E>(sel), sel);
}
export const ctx2d = (cv: HTMLCanvasElement) => must(cv.getContext('2d'), '2D context of a canvas');
export function fmt(v: number, step: number): string {
  const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return Number(v).toFixed(dec);
}
export const TIME_KEYS: string[] = ['td', 'rT0', 'rPer', 'rW'];
export function fmtVal(k: string, v: number, d: ParamDef): string {
  return TIME_KEYS.includes(k) || v < d.min || v > d.max || Math.abs(v / d.step - Math.round(v / d.step)) > 1e-6
    ? String(+(+v).toPrecision(6))
    : String(fmt(v, d.step));
}
// Drag a handle along x or y: onStart gives the starting value, onMove gets start + displacement, onEnd is called at the end
export function dragger(
  handle: HTMLElement,
  axis: 'x' | 'y',
  onStart: () => number,
  onMove: (v: number) => void,
  onEnd: () => void,
) {
  handle.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const p0 = axis === 'y' ? e.clientY : e.clientX;
    const s0 = onStart();
    handle.classList.add('drag');
    document.body.classList.add(axis === 'y' ? 'rz-y' : 'rz-x');
    const mv = (ev: PointerEvent) => onMove(s0 + (axis === 'y' ? ev.clientY : ev.clientX) - p0);
    const up = () => {
      handle.removeEventListener('pointermove', mv);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      handle.classList.remove('drag');
      document.body.classList.remove('rz-x', 'rz-y');
      onEnd();
    };
    handle.addEventListener('pointermove', mv);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
}
export let toastTimer: Timer | undefined;
export function toast(msg: string, err?: boolean) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('err', !!err);
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 5000);
}
// Inside the claude.ai artifact viewer, files are offered through the platform's downloads capability;
// elsewhere (GitHub Pages, a local file) an ordinary download link is used
/** downloads capability of the artifact viewer: undefined while it is requested, null if unavailable */
export let scDownloads: { save(file: { filename: string; data: string | Blob }): Promise<unknown> } | null | undefined;
try {
  if (window.claude && typeof window.claude.use === 'function')
    window.claude
      .use('downloads')
      .then(d => {
        scDownloads = d;
      })
      .catch(() => {
        scDownloads = null;
      });
} catch (e) {}
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {}
  try {
    const ta = $('sc-text');
    ta.value = text;
    ta.focus();
    ta.select();
    if (document.execCommand('copy')) return true;
  } catch (e) {}
  return false;
}
// Offer a file to the viewer: the artifact viewer's downloads capability, or an ordinary download link elsewhere.
// Returns 'saved', 'declined' or 'unavailable'.
export async function saveFile(
  filename: string,
  data: string | Blob,
  mime?: string,
): Promise<'saved' | 'declined' | 'unavailable'> {
  if (window.claude && typeof window.claude.use === 'function') {
    let dl = scDownloads;
    if (dl === undefined) {
      try {
        dl = await window.claude.use('downloads');
      } catch (e) {
        dl = null;
      }
    }
    if (!dl) return 'unavailable';
    try {
      await dl.save({ filename, data });
      return 'saved';
    } catch (e) {
      return errCode(e) === 'declined' ? 'declined' : 'unavailable';
    }
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'saved';
  } catch (e) {
    return 'unavailable';
  }
}
// Save a canvas as the PNG file name.png, with a message saying where it went (or that it could not be saved)
export async function savePNG(c: HTMLCanvasElement, base: string) {
  const blob = await new Promise<Blob | null>(res => c.toBlob(res, 'image/png'));
  if (!blob) {
    toast(T('Could not save the file here.'), true);
    return;
  }
  const name = base + '.png',
    r = await saveFile(name, blob, 'image/png');
  if (r === 'saved') toast(T('Saved as "{f}" (usually in the Downloads folder)', { f: name }));
  else if (r === 'unavailable') toast(T('Could not save the file here.'), true);
}
// Record the source (English) text of static strings (data-i18n / data-i18n-title)
export const I18N_EL: [HTMLElement, 'html' | 'title', string][] = [];
// innerHTML serializes "&" as "&amp;"; convert it back to match the dictionary keys
document
  .querySelectorAll<HTMLElement>('[data-i18n]')
  .forEach(el => I18N_EL.push([el, 'html', el.innerHTML.replace(/&amp;/g, '&')]));
document
  .querySelectorAll<HTMLElement>('[data-i18n-title]')
  .forEach(el => I18N_EL.push([el, 'title', el.getAttribute('title') ?? '']));
// An element made by the script whose text is translated now and when the language changes
export function i18nText(el: HTMLElement, key: string) {
  I18N_EL.push([el, 'html', key]);
  el.innerHTML = T(key);
}
// The same for the tooltip (title) of an element made by the script
export function i18nTitle(el: HTMLElement, key: string) {
  I18N_EL.push([el, 'title', key]);
  el.title = T(key);
}
export function applyStaticI18n() {
  I18N_EL.forEach(([el, kind, key]) => {
    if (kind === 'html') el.innerHTML = T(key);
    else el.setAttribute('title', T(key));
  });
  document.documentElement.lang = LANGUAGES[LANG].tag;
  const hp = document.querySelector<HTMLElement>('header p');
  if (hp && hp.textContent) hp.title = hp.textContent; // full description on hover
  document.documentElement.style.setProperty('--t-shown', JSON.stringify(T('Shown ▾')));
  document.documentElement.style.setProperty('--t-hidden', JSON.stringify(T('Hidden ▸')));
  // the name SigmaOmega is not translated; the subtitle is
  document.title = `SigmaOmega — ${T('Feedback Control Simulator')}`;
}
