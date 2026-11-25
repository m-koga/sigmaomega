// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Layout of the page: areas under the plots, their handles, the settings panel and the plot panels ================= */
import { APP_VERSION, CHANGELOG } from './01-changelog.ts';
import { T, TXT_COLLAPSED, TXT_TIP, docsLang, docsTranslated } from './02-i18n.ts';
import { CARD_GROUP, CARD_KEYS, PLOTS, sideCardOf } from './05-definitions.ts';
import { $, byId, dragger, i18nText, i18nTitle, qs } from './13-dom.ts';
import {
  DEFAULT_PANELS,
  INFO_AREAS,
  PANELS,
  defaultLayout,
  isHidden,
  layout,
  rowsFromPreset,
  saveLayout,
  setLayout,
  setShownPanels,
  shownPanels,
  subFolded,
  tilesFromPreset,
} from './14-view.ts';
import { diagMaxH, fitTex, renderTune } from './17-panels.ts';
import { redraw, scheduleRedraw } from './18-update.ts';
import { applyPanels } from './23-tiles.ts';

/* ===== Resizing display areas (drag) ===== */

// Area key for each handle, and the elements of that area
document.querySelectorAll<HTMLElement>('.hgrip[data-target]').forEach(g => (g.dataset.key = g.dataset.target));
// Scale of each metrics area: response metrics (time response) and stability margins (Bode plot)
export const METRIC_SCALE: Record<string, 'ms' | 'msb'> = { metrics: 'ms', margins: 'msb' };
Object.keys(INFO_AREAS).forEach(a =>
  document.querySelectorAll<HTMLElement>(`.hgrip[data-scale="${a}"]`).forEach(g => (g.dataset.key = a)),
);
// Areas scaled as a whole with CSS zoom: data-scale of the handle -> target element
export const ZOOM_AREAS: Record<string, string> = {
  bodeopts: 'bodeOpts',
  bodenote: 'bodeNote',
  nyqopts: 'nyqOpts',
  nyqnote: 'nyqNote',
  pzopts: 'pzOpts',
  pzhelp: 'pzHelp',
  pzbanner: 'pzBanner',
  pzrange: 'pzRange',
  pztable: 'pzTable',
  pznote: 'pzNote',
};
// Area names shown on the handle while the area is hidden
export const AREA_LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(PLOTS).map(([k, v]) => [k, v.label])),
  diagBox: 'Block diagram',
  ...Object.fromEntries(Object.entries(INFO_AREAS).map(([k, v]) => [k, v.label])),
};
export function refreshGripLabels() {
  document.querySelectorAll<HTMLElement>('.hgrip[data-key]').forEach(g => {
    const k = g.dataset.key!; // selected by [data-key]
    const name = AREA_LABELS[k] || 'This area';
    g.dataset.label = T(name);
    g.dataset.msg = T(TXT_COLLAPSED, { name: T(name) });
  });
  document.querySelectorAll<HTMLElement>('.hgrip').forEach(g => (g.title = T(TXT_TIP)));
}
refreshGripLabels();
export const areaEls = (key: string): HTMLElement[] =>
  INFO_AREAS[key]
    ? [byId(key)]
    : ZOOM_AREAS[key]
      ? [byId(ZOOM_AREAS[key])]
      : PLOTS[key]
        ? [byId(key).closest<HTMLElement>('.plot-wrap, .pz-wrap') || byId(key)]
        : key === 'margins'
          ? [$('margins')]
          : [byId(key)];
export function setHidden(key: string, on: boolean) {
  if (on) layout.hidden[key] = true;
  else delete layout.hidden[key];
  areaEls(key).forEach(el => (el.style.display = on ? 'none' : ''));
  document.querySelectorAll<HTMLElement>(`.hgrip[data-key="${key}"]`).forEach(g => g.classList.toggle('collapsed', on));
}

export function applyLayout() {
  const wrap = qs('.wrap');
  if (layout.sideW) wrap.style.setProperty('--sideW', layout.sideW + 'px');
  else wrap.style.removeProperty('--sideW');
  Object.entries(METRIC_SCALE).forEach(([id, k]) => {
    const m = byId(id);
    if (layout[k]) m.style.setProperty('--ms', String(layout[k]));
    else m.style.removeProperty('--ms');
  });
  fitTex();
  document.querySelectorAll<HTMLElement>('.hgrip[data-target]').forEach(g => {
    const id = g.dataset.target!,
      t = byId(id),
      v = layout.h[id]; // selected by [data-target]
    if (v) {
      t.style.height = v + 'px';
      if (t.id === 'diagBox') t.classList.add('sized');
    } else {
      t.style.height = '';
      if (t.id === 'diagBox') t.classList.remove('sized');
    }
  });
  if (layout.ts) $('tsimRow').style.setProperty('--ts', String(layout.ts));
  else $('tsimRow').style.removeProperty('--ts');
  Object.entries(ZOOM_AREAS).forEach(([k, id]) => {
    const v = layout.zs[k];
    if (v) byId(id).style.setProperty('--zs', String(v));
    else byId(id).style.removeProperty('--zs');
  });
  ['diagBox', ...Object.keys(PLOTS), ...Object.keys(INFO_AREAS)].forEach(k => setHidden(k, isHidden(k)));
  setSideCard(layout.scard);
  setSideCollapsed(!!layout.sideCollapsed);
  setMobileView(layout.mtab || 'plot');
  $('mview').value = layout.mview || 'cards';
  Object.keys(INFO_AREAS).forEach(a => setInfoTab(a, layout.itabs[a]));
  setShownPanels(layout.panels || DEFAULT_PANELS);
  applyPanels();
  document.querySelectorAll<HTMLElement>('.sub').forEach(s => {
    const f = subFolded(s.dataset.sub ?? '');
    s.classList.toggle('folded', f);
    qs('.sub-h', s).setAttribute('aria-expanded', f ? 'false' : 'true');
  });
}
// Cards of the settings panel: each card gets its key; the heading stays a plain heading (one card is shown at a time)
export const sideCards = [...document.querySelectorAll<HTMLElement>('.side > .card')];
sideCards.forEach((card, i) => {
  card.dataset.card = CARD_KEYS[i];
  const h2 = qs('h2', card),
    body = document.createElement('div');
  body.className = 'card-body';
  while (h2.nextSibling) body.appendChild(h2.nextSibling);
  card.appendChild(body);
});
// Smartphones: the bottom bar shows either the settings or the plots
export function setMobileView(v: string) {
  layout.mtab = v === 'set' ? 'set' : 'plot';
  document.body.classList.toggle('m-set', layout.mtab === 'set');
  document.body.classList.toggle('m-plot', layout.mtab === 'plot');
  document
    .querySelectorAll<HTMLElement>('#mnav button')
    .forEach(b => b.classList.toggle('on', b.dataset.m === layout.mtab));
  if (layout.mtab === 'plot') requestAnimationFrame(redraw);
}
document.querySelectorAll<HTMLElement>('#mnav button').forEach(b =>
  b.addEventListener('click', () => {
    const same = layout.mtab === b.dataset.m;
    setMobileView(b.dataset.m ?? 'plot');
    saveLayout();
    if (!same) window.scrollTo(0, 0);
  }),
);
// The menus of the menu bar act on the settings panel or on the plots: what they act on is brought into view. On a
// phone (bottom bar shown) the settings or the plots are shown; a folded settings panel is unfolded
const onPhone = () => getComputedStyle($('mnav')).display !== 'none';
export function showSettings() {
  if (layout.sideCollapsed) setSideCollapsed(false);
  if (onPhone() && layout.mtab !== 'set') setMobileView('set');
}
export function showPlotsOnPhone() {
  if (onPhone() && layout.mtab === 'set') {
    setMobileView('plot');
    saveLayout();
  }
}
export function setSideCollapsed(on: boolean) {
  layout.sideCollapsed = !!on;
  qs('.wrap').classList.toggle('side-collapsed', !!on);
  requestAnimationFrame(redraw);
}
$('mview').onchange = () => {
  layout.mview = $('mview').value === 'table' ? 'table' : 'cards';
  // show what was changed
  setInfoTab('tinfo', 'metrics');
  setInfoTab('binfo', 'margins');
  saveLayout();
  redraw();
};
$('sideHide').onclick = () => {
  setSideCollapsed(true);
  saveLayout();
};
$('sideOpen').onclick = () => {
  setSideCollapsed(false);
  saveLayout();
};
// Shows card `key` alone in the settings panel; the button of its drop-down list is marked
export function setSideCard(key: string) {
  key = sideCardOf(key);
  layout.scard = key;
  layout.stab = CARD_GROUP[key];
  sideCards.forEach(c => c.classList.toggle('tab-hidden', c.dataset.card !== key));
  document.querySelectorAll<HTMLElement>('.smenu-btn').forEach(b => {
    const on = b.dataset.group === layout.stab;
    b.classList.toggle('on', on);
    b.setAttribute('aria-current', on ? 'true' : 'false');
  });
  if (key === 'tune') renderTune();
}
// Shows section key of area a (the first one when key is not one of its sections)
export function setInfoTab(a: string, key: string | undefined) {
  const d = INFO_AREAS[a],
    k = d.tabs.some(([t]) => t === key) ? (key as string) : d.tabs[0][0];
  layout.itabs[a] = k;
  const area = byId(a);
  area.querySelectorAll<HTMLElement>('.ptab').forEach(b => {
    const on = b.dataset.itab === k; // set by the tab bar below
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
  });
  area.querySelectorAll<HTMLElement>('.tsec').forEach(sec => sec.classList.toggle('off', sec.dataset.sec !== k));
}
// Tab bars from INFO_AREAS (arrow keys, Home and End move between the tabs)
Object.entries(INFO_AREAS).forEach(([a, d]) => {
  const area = byId(a),
    bar = qs('.ptabs', area),
    tabs = d.tabs.map(([k, label]) => {
      const b = document.createElement('button'),
        sec = qs(`.tsec[data-sec="${k}"]`, area);
      b.className = 'ptab';
      b.type = 'button';
      b.dataset.itab = k;
      b.id = `itab-${k}`;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', (sec.id ||= `isec-${k}`));
      sec.setAttribute('role', 'tabpanel');
      sec.setAttribute('aria-labelledby', b.id);
      i18nText(b, label);
      bar.append(b);
      return b;
    });
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => {
      setInfoTab(a, b.dataset.itab);
      saveLayout();
    });
    b.addEventListener('keydown', e => {
      const n = tabs.length,
        j =
          e.key === 'ArrowRight'
            ? (i + 1) % n
            : e.key === 'ArrowLeft'
              ? (i + n - 1) % n
              : e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? n - 1
                  : -1;
      if (j < 0) return;
      e.preventDefault();
      tabs[j].focus();
      tabs[j].click();
    });
  });
});
export function panelsChanged() {
  layout.panels = PANELS.filter(k => shownPanels.has(k));
  saveLayout();
  applyPanels();
  requestAnimationFrame(redraw);
}
document.querySelectorAll<HTMLElement>('.tab[data-tab]').forEach(
  t =>
    (t.onclick = () => {
      const k = t.dataset.tab!; // selected by [data-tab]
      if (shownPanels.has(k)) {
        if (shownPanels.size === 1) return;
        shownPanels.delete(k);
      } else shownPanels.add(k);
      panelsChanged();
      showPlotsOnPhone();
    }),
);
// The × at the right end of the title of each panel hides the panel, as its item in "Plots to show" does (that list
// shows it again); not for the last panel shown
export const TXT_PCLOSE = 'Hide this plot (show it again from "Plots to show")';
PANELS.forEach(k => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pclose';
  b.dataset.close = k;
  b.textContent = '×';
  i18nTitle(b, TXT_PCLOSE);
  b.disabled = shownPanels.size === 1;
  b.onclick = () => {
    if (!shownPanels.has(k) || shownPanels.size === 1) return;
    shownPanels.delete(k);
    panelsChanged();
  };
  qs('.h2row', $(`panel-${k}`)).append(b);
});
$('panelsAll').onclick = () => {
  PANELS.forEach(k => shownPanels.add(k));
  panelsChanged();
  showPlotsOnPhone();
};
// (the drop-down lists of the menu bar: 26-menubar.ts)
$('pcols').onchange = () => {
  const prev = layout.pcols || '2';
  layout.pcols = $('pcols').value;
  // the free layout starts from what was shown (and is kept while a preset is chosen)
  if (layout.pcols === 'free' && !layout.tiles) layout.tiles = tilesFromPreset(prev, [...shownPanels]);
  if (layout.pcols === 'rows' && !layout.rows) layout.rows = rowsFromPreset(prev, [...shownPanels]);
  saveLayout();
  applyPanels();
  requestAnimationFrame(redraw);
};
export const TIP = T(TXT_TIP);

// Vertical: height of the block diagram and plots (hidden below half the minimum); the block diagram stops when it
// fills the width
document.querySelectorAll<HTMLElement>('.hgrip[data-target]').forEach(g => {
  const id = g.dataset.target!,
    t = byId(id),
    mn = Number(g.dataset.min),
    mx = Number(g.dataset.max); // selected by [data-target]
  g.title = TIP;
  dragger(
    g,
    'y',
    () => (isHidden(id) ? 0 : t.getBoundingClientRect().height),
    (v: number) => {
      if (v < mn * 0.5) {
        if (!isHidden(id)) setHidden(id, true);
        return;
      }
      if (isHidden(id)) setHidden(id, false);
      v = Math.round(Math.max(mn, Math.min(mx, id === 'diagBox' ? diagMaxH() : Infinity, v)));
      t.style.height = v + 'px';
      layout.h[id] = v;
      if (id === 'diagBox') t.classList.add('sized');
      else scheduleRedraw();
    },
    () => {
      saveLayout();
      redraw();
    },
  );
  g.addEventListener('dblclick', () => {
    delete layout.h[id];
    setHidden(id, false);
    saveLayout();
    applyLayout();
    redraw();
  });
});
// Horizontal: border between the left and right columns
(() => {
  const vs = $('vsplit'),
    side = qs('.side'),
    wrap = qs('.wrap');
  dragger(
    vs,
    'x',
    () => side.getBoundingClientRect().width,
    (v: number) => {
      const max = Math.max(260, window.innerWidth - 420);
      v = Math.round(Math.max(240, Math.min(max, v)));
      layout.sideW = v;
      wrap.style.setProperty('--sideW', v + 'px');
      scheduleRedraw();
    },
    () => {
      saveLayout();
      redraw();
    },
  );
  vs.addEventListener('dblclick', () => {
    layout.sideW = null;
    saveLayout();
    applyLayout();
    redraw();
  });
})();
// Everything of the layout back to the defaults, except the open settings tab, the metrics view and the chosen tabs
// under the plots (there is no button for it any more; kept for scripts and tests)
export function resetLayout() {
  const { stab, scard, mview, itabs, mtab } = layout;
  setLayout({ ...defaultLayout(), stab, scard, mview, itabs, mtab });

  saveLayout();
  applyLayout();
  redraw();
}

// "Reset the layout" (File tab of the settings panel)
$('layoutDefault').onclick = () => resetLayout();

// Scale of each section of the areas under the plots (0.6-3x): its value in the layout and how it is shown
function secScale(key: string): { get: () => number | null; set: (v: number | null) => void } {
  const css = (el: HTMLElement, prop: string, v: number | null) =>
    v ? el.style.setProperty(prop, String(v)) : el.style.removeProperty(prop);
  if (key === 'tsim')
    return {
      get: () => layout.ts,
      set: v => {
        layout.ts = v;
        css($('tsimRow'), '--ts', v);
      },
    };
  const mk = METRIC_SCALE[key];
  if (mk)
    return {
      get: () => layout[mk],
      set: v => {
        layout[mk] = v;
        css(byId(key), '--ms', v);
      },
    };
  return {
    get: () => layout.zs[key] ?? null,
    set: v => {
      if (v) layout.zs[key] = v;
      else delete layout.zs[key];
      css(byId(ZOOM_AREAS[key]), '--zs', v);
    },
  };
}
// The handle of an area scales the shown section (each keeps its own scale) and hides the whole area with its
// tabs below 0.4x; double-click shows it with every section at its original size
Object.entries(INFO_AREAS).forEach(([a, d]) =>
  document.querySelectorAll<HTMLElement>(`.hgrip[data-scale="${a}"]`).forEach(g => {
    const K = 100,
      cur = () => secScale(layout.itabs[a] ?? d.tabs[0][0]);
    g.title = TIP;
    dragger(
      g,
      'y',
      () => (isHidden(a) ? 0 : (cur().get() || 1) * K),
      (v: number) => {
        const s = v / K;
        if (s < 0.4) {
          if (!isHidden(a)) setHidden(a, true);
          return;
        }
        if (isHidden(a)) setHidden(a, false);
        cur().set(Math.round(Math.max(0.6, Math.min(3, s)) * 20) / 20); // not applyLayout: it moves the panels
      },
      () => saveLayout(),
    );
    g.addEventListener('dblclick', () => {
      d.tabs.forEach(([k]) => secScale(k).set(null));
      setHidden(a, false);
      saveLayout();
      applyLayout();
    });
  }),
);
applyLayout();
// Redraw the plots when the right column width changes (e.g. a scrollbar appears)
if (window.ResizeObserver) {
  let lastW = 0;
  new ResizeObserver(es => {
    const w = Math.round(es[0].contentRect.width);
    if (w !== lastW) {
      lastW = w;
      scheduleRedraw();
    }
  }).observe(qs('.main'));
}

// Change log in the dialog (English, or Japanese when the page is in Japanese)
export function renderChangelog() {
  $('clBody').innerHTML =
    (docsTranslated() ? '' : `<p class="note">${T('(The change log is shown in English.)')}</p>`) +
    CHANGELOG.map(
      e =>
        `<div class="cl-item"><span class="cl-v">v${e.v}</span><span class="cl-d">${e.d}</span><ul>${(docsLang() === 'ja' ? e.ja : e.en).map(x => `<li>${x}</li>`).join('')}</ul></div>`,
    ).join('');
}

(() => {
  const btn = $('verBtn'),
    back = $('clBack');
  btn.textContent = `v${APP_VERSION}（${CHANGELOG[0].d}）`;

  renderChangelog();
  const open = () => {
      back.classList.add('open');
      $('clClose').focus();
    },
    close = () => {
      back.classList.remove('open');
      btn.focus();
    };
  btn.onclick = open;
  $('clClose').onclick = close;
  back.addEventListener('click', e => {
    if (e.target === back) close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && back.classList.contains('open')) close();
  });
})();
