// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ===== Menu bar =====
   The drop-down lists of the menu bar under the header (src/index.html, nav#menubar), in this order:
   - File, System setup, Analysis & design: the card shown in the settings panel (one at a time, setSideCard); below
     the cards, Analysis & design also shows or hides the panels of the Routh–Hurwitz test and the steady-state error
     (.tab buttons like those of "Plots to show", placed in its list in src/index.html)
   - Plots to show: several panels at a time; the list stays open while they are chosen (its items, the .tab buttons,
     are handled with the panels in 79-layout.ts)
   - Plot arrangement, Metrics display: one choice each, kept in the hidden selects #pcols and #mview
   Every list opens and closes the same way (dropdown below); the buttons only name their lists, the chosen items are
   checked in the open lists. */
import { CARD_GROUP, CARD_GROUPS, CARD_KEYS } from './10-definitions.ts';
import { $, I18N_EL, byId, i18nText, qs } from './40-dom.ts';
import { layout, saveLayout } from './41-view.ts';
import { setSideCard, showPlotsOnPhone, showSettings, sideCards } from './79-layout.ts';

// One drop-down list: the button opens and closes it, a click elsewhere on the page or Escape closes it (Escape gives
// the focus back to the button), the arrow keys move between the items. The click on the button goes on to the page,
// which closes the other lists. onOpen runs before the list is shown (to check the chosen item); focus names the item
// that gets the focus (else the first). Returns the function that opens or closes the list
export function dropdown(
  menu: HTMLElement,
  btn: HTMLElement,
  items: () => HTMLElement[],
  opts: { onOpen?: () => void; focus?: () => HTMLElement | undefined } = {},
): (open: boolean) => void {
  const isOpen = () => menu.classList.contains('open');
  const setOpen = (open: boolean) => {
    if (open) opts.onOpen?.();
    menu.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    keepOnScreen(menu, open);
  };
  btn.onclick = () => {
    const open = !isOpen();
    setOpen(open);
    if (open) (opts.focus?.() || items()[0])?.focus();
  };
  document.addEventListener('click', e => {
    if (isOpen() && !menu.contains(e.target as Node)) setOpen(false);
  });
  menu.addEventListener('keydown', e => {
    const list = items(),
      i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape' && isOpen()) {
      e.stopPropagation();
      setOpen(false);
      btn.focus();
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && i >= 0) {
      e.preventDefault();
      list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length].focus();
    }
  });
  return setOpen;
}

// A list opened under a button near the right edge of the window is moved left so that it stays on the screen (on
// narrow screens the lists are placed across the screen by the style sheet and are left as they are)
function keepOnScreen(menu: HTMLElement, open: boolean) {
  const list = menu.querySelector<HTMLElement>('.vb-ddlist');
  if (!list) return;
  list.style.left = '';
  if (!open || getComputedStyle(menu).position === 'static') return;
  const over = list.getBoundingClientRect().right - (document.documentElement.clientWidth - 8);
  if (over > 0) list.style.left = `${-over}px`;
}

// An item of a single-choice list, named like `named` (its translation key, so that it follows the language);
// data: its data attributes
function menuItem(named: Element, data: Record<string, string>, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'vb-opt';
  b.setAttribute('role', 'menuitemradio');
  Object.assign(b.dataset, data);
  i18nText(b, I18N_EL.find(([e, kind]) => e === named && kind === 'html')?.[2] ?? named.textContent ?? '');
  b.onclick = onClick;
  return b;
}
// Marks the chosen item of a single-choice list
const check = (items: HTMLElement[], on: (b: HTMLElement) => boolean) =>
  items.forEach(b => b.setAttribute('aria-checked', on(b) ? 'true' : 'false'));

// ---- File, System setup, Analysis & design: the cards of the settings panel, named like their headings
CARD_GROUPS.forEach(g => {
  const btn = byId(`smenuBtn-${g}`),
    list = byId(`smenuList-${g}`),
    items: HTMLButtonElement[] = [];
  // the cards, then the panel buttons below the separator (Analysis & design)
  const all = () => [...items, ...list.querySelectorAll<HTMLElement>('.tab')];
  const setOpen = dropdown(byId(`smenu-${g}`), btn, all, {
    onOpen: () => check(items, b => b.dataset.card === layout.scard),
    focus: () => items.find(b => b.dataset.card === layout.scard),
  });
  CARD_KEYS.filter(k => CARD_GROUP[k] === g).forEach(k => {
    const b = menuItem(qs('h2', sideCards[CARD_KEYS.indexOf(k)]), { card: k }, () => {
      setOpen(false);
      setSideCard(k);
      showSettings(); // the chosen card is in view: the panel unfolded, on a phone the settings shown
      saveLayout();
      btn.focus();
    });
    items.push(b);
    list.insertBefore(b, list.querySelector('.vb-ddsep'));
  });
});

// ---- Plots to show: the list stays open while panels are chosen (all its buttons are items)
dropdown($('panelMenu'), $('panelBtn'), () => [...$('panelList').querySelectorAll<HTMLElement>('button')]);

// ---- Plot arrangement, Metrics display: made from the options of the hidden select `id` (the rest of the page reads
// and sets its value); choosing sets the select and runs its change handler
function selectMenu(id: string) {
  const sel = byId<HTMLSelectElement>(id),
    btn = byId(id + 'Btn'),
    list = byId(id + 'List'),
    items: HTMLButtonElement[] = [];
  const setOpen = dropdown(byId(id + 'Menu'), btn, () => items, {
    onOpen: () => check(items, b => b.dataset.v === sel.value),
    focus: () => items.find(b => b.dataset.v === sel.value),
  });
  // (no options in the unit-test environment)
  Array.from(sel.options || []).forEach(o => {
    const b = menuItem(o, { v: o.value }, () => {
      setOpen(false);
      btn.focus();
      showPlotsOnPhone();
      if (sel.value === o.value) return;
      sel.value = o.value;
      sel.dispatchEvent(new Event('change'));
    });
    items.push(b);
    list.append(b);
  });
}
selectMenu('pcols');
selectMenu('mview');
