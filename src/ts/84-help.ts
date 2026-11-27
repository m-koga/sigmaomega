// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ===== User manual (Help) =====
   The "Help" button at the right end of the menu bar opens the user manual in a dialog: a list of the sections on
   the left (above the text on narrow screens) and the text on the right. The manual is written in every language of
   the page (src/help/<lang>.html, not through the dictionary), with its screenshots in that language
   (src/help-img/<name>.<lang>.webp). It is drawn in the language of the page each time it is opened. */
import { LANG, T } from './02-i18n.ts';
import { $ } from './40-dom.ts';

/* The manual in each language: its chapters in order, each [id, title, HTML]. The text is in src/help/<lang>.html
   (one <section id="…" title="…"> per chapter), which the build puts here like the dictionary (scripts/build.ts);
   every language of LANGUAGES has its file, with the same chapters, figures, tables and references
   (tests/help.test.ts). */
type HelpText = Record<string, [string, string, string][]>;
// prettier-ignore
export const HELP: HelpText = /*@@HELP@@*/{};
/** The chapters of the manual in a language (English when it has none) */
export const helpChapters = (lang: string = LANG): [string, string, string][] => HELP[lang] ?? HELP.en;

// The manual in the language of the page
export function renderHelp() {
  const ch = helpChapters();
  $('helpToc').innerHTML = ch
    .map(([id, title], i) => `<button type="button" class="hp-link" data-sec="${id}">${i + 1}. ${title}</button>`)
    .join('');
  $('helpBody').innerHTML = ch
    .map(([id, title, html], i) => `<section id="help-${id}"><h3>${i + 1}. ${title}</h3>${html}</section>`)
    .join('');
  // the screenshots (<figure data-img="name">) in the language of the page (English when there is none); the
  // pictures are put into the page by the build (<script type="text/plain" data-help-img="name.lang" data-w="width">)
  $('helpBody')
    .querySelectorAll<HTMLElement>('figure[data-img]')
    .forEach(f => {
      const key = f.dataset.img,
        data =
          document.querySelector<HTMLElement>(`script[data-help-img="${key}.${LANG}"]`) ??
          document.querySelector<HTMLElement>(`script[data-help-img="${key}.en"]`);
      if (!data) return;
      const img = document.createElement('img');
      img.src = 'data:image/webp;base64,' + (data.textContent || '').replace(/\s/g, '');
      img.width = Number(data.dataset.w);
      img.alt = f.textContent || '';
      img.loading = 'lazy';
      f.prepend(img);
    });
  numberHelp();
}

// Figures and tables are numbered by section ("Fig. 8.1", "Table 2.1"; "図 8.1", "表 2.1", through the dictionary):
// each <figure> and <table> has data-id and a caption, which gets the number in front. A reference in the text,
// <a class="hp-ref" data-ref="id">, gets the number as its text and scrolls to the figure or table when clicked.
// Returns the number of each id (for the tests)
export function numberHelp(): Record<string, string> {
  const nums: Record<string, string> = {};
  $('helpBody')
    .querySelectorAll<HTMLElement>('section')
    .forEach((sec, i) => {
      const count = { fig: 0, tab: 0 };
      sec.querySelectorAll<HTMLElement>('figure[data-id], table[data-id]').forEach(el => {
        const fig = el.tagName === 'FIGURE',
          n = `${i + 1}.${++count[fig ? 'fig' : 'tab']}`,
          label = T(fig ? 'Fig. {n}' : 'Table {n}', { n }),
          cap = el.querySelector(fig ? 'figcaption' : 'caption');
        nums[el.dataset.id as string] = label;
        el.id = `help-fig-${el.dataset.id}`;
        if (cap) cap.insertAdjacentHTML('afterbegin', `<span class="hp-num">${label}</span>`);
      });
    });
  $('helpBody')
    .querySelectorAll<HTMLElement>('a.hp-ref')
    .forEach(a => (a.textContent = nums[a.dataset.ref as string] ?? '?'));
  return nums;
}

// Open and close: the Help button, ×, a click beside the dialog, Escape; the focus returns to the Help button
(() => {
  const btn = $('helpBtn'),
    back = $('helpBack');
  const close = () => {
    back.classList.remove('open');
    btn.focus();
  };
  btn.onclick = () => {
    renderHelp();
    back.classList.add('open');
    $('helpBody').scrollTop = 0;
    $('helpClose').focus();
  };
  $('helpClose').onclick = close;
  back.addEventListener('click', e => {
    if (e.target === back) close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && back.classList.contains('open')) close();
  });
  // the list of sections scrolls the text to the section
  $('helpToc').addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('.hp-link');
    if (!b) return;
    const sec = document.getElementById(`help-${b.dataset.sec}`);
    // (the text is positioned, so the offset of a section is counted from the top of the text)
    if (sec) $('helpBody').scrollTop = sec.offsetTop;
  });
  // a reference to a figure or table scrolls the text so that it is in view, and marks it for a moment
  $('helpBody').addEventListener('click', e => {
    const a = (e.target as Element).closest<HTMLElement>('a.hp-ref');
    if (!a) return;
    e.preventDefault();
    const el = document.getElementById(`help-fig-${a.dataset.ref}`);
    if (!el) return;
    const body = $('helpBody'),
      y = el.getBoundingClientRect().top - body.getBoundingClientRect().top;
    body.scrollTop += y - 12;
    el.classList.remove('hp-hit');
    void el.offsetWidth; // (restarts the animation)
    el.classList.add('hp-hit');
  });
})();
