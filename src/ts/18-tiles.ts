// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ===== Arrangement and height of the plot panels =====
   Height (every layout): the bottom edge of a panel changes the heights of all its plots by the same ratio.
   Free arrangement (Layout: "Free"):
   The panels sit in columns side by side; each column stacks its panels without gaps. The ⠿ handle (or the
   title) of a panel moves it: within a column, to another column or into a new column (up to MAX_COLS). The
   boundary between two columns changes their widths; the plots keep their own height handles. On a narrow
   screen the columns are shown one below the other.
   The layout is applied while 17-events-layout.ts loads, before this file has run: what that uses is made of
   function declarations (and MAX_COLS from 09-drawing.ts). */
import { i18nTitle } from './02-i18n.ts';
import { $, byId, qs } from './06-ui-build.ts';
import { MAX_COLS, PANELS, TEX_FS_DEFAULT, presetCols, texFsForHeight, texFsShown } from './09-drawing.ts';
import { redraw } from './16-pole-zero.ts';
import { arrangeRows, dropAtRows, moveRowTo, rowsFromPreset, stepRowTile } from './19-rows.ts';
import {
  applyPanels,
  diagMaxH,
  dragger,
  isHidden,
  layout,
  saveLayout,
  scheduleRedraw,
  shownPanels,
} from './17-events-layout.ts';

const MIN_COL_W = 320; // narrowest column: when the boundary is dragged and when a column is added [px]

// ---- Operations on the arrangement (no page access)

// A valid arrangement from stored data: every panel exactly once (missing ones go to the column with the fewest
// panels; the block diagram, missing from arrangements saved before it was a panel, on top of the first column),
// at most MAX_COLS columns, positive widths; null when nothing usable is stored
export function normTiles(src: unknown): Tiles | null {
  if (!src || typeof src !== 'object' || !Array.isArray((src as Tiles).cols)) return null;
  const seen = new Set<string>(),
    cols: Tiles['cols'] = [];
  for (const c of (src as Tiles).cols.slice(0, MAX_COLS)) {
    if (!c || typeof c !== 'object' || !Array.isArray(c.panels)) continue;
    const panels: string[] = [];
    for (const k of c.panels as unknown[])
      if (typeof k === 'string' && (PANELS as readonly string[]).includes(k) && !seen.has(k)) {
        seen.add(k);
        panels.push(k);
      }
    if (!panels.length) continue;
    const w = typeof c.w === 'number' && isFinite(c.w) && c.w > 0 ? Math.min(c.w, 100) : 1;
    cols.push({ w, panels });
  }
  if (!cols.length) return null;
  PANELS.filter(k => !seen.has(k)).forEach(k =>
    k === 'diag' ? cols[0].panels.unshift(k) : fewest(cols).panels.push(k),
  );
  return { cols };
}
function fewest(cols: Tiles['cols']) {
  return cols.reduce((a, c) => (c.panels.length < a.panels.length ? c : a));
}

// The arrangement that looks like a preset layout: the shown panels row by row in 1, 2 or n columns (the block
// diagram, across the whole width in the preset, on top of the first column); the hidden panels go to the column
// with the fewest panels
export function tilesFromPreset(mode: string, shown: string[]): Tiles {
  const vis = PANELS.filter(k => k !== 'diag' && shown.includes(k)),
    n = Math.min(MAX_COLS, presetCols(mode, shown)),
    cols: Tiles['cols'] = Array.from({ length: n }, () => ({ w: 1, panels: [] as string[] }));
  if (shown.includes('diag')) cols[0].panels.push('diag');
  vis.forEach((k, i) => cols[i % n].panels.push(k));
  PANELS.filter(k => !shown.includes(k)).forEach(k => fewest(cols).panels.push(k));
  return { cols };
}

/** Where a panel is dropped: before the index-th shown panel of column col (index = number shown: at the end),
    or into a new column inserted before column newCol (newCol = number of columns: at the right end) */
export type TileDrop = { col: number; index: number } | { newCol: number };

// The arrangement after moving panel k to the drop place; columns left without panels are removed
export function moveTile(t: Tiles, k: string, to: TileDrop, shown: Set<string>): Tiles {
  const cols = t.cols.map(c => ({ w: c.w, panels: c.panels.filter(p => p !== k) })),
    visW = t.cols.filter(c => c.panels.some(p => shown.has(p))).map(c => c.w);
  if ('newCol' in to) {
    if (t.cols.length >= MAX_COLS && !t.cols.some(c => c.panels.length === 1 && c.panels[0] === k)) return t;
    const w = visW.length ? visW.reduce((a, b) => a + b, 0) / visW.length : 1; // average width of the shown
    cols.splice(Math.max(0, Math.min(to.newCol, cols.length)), 0, { w, panels: [k] });
  } else {
    const c = cols[to.col];
    if (!c) return t;
    const vis = c.panels.filter(p => shown.has(p)),
      before = vis[to.index];
    if (before !== undefined) c.panels.splice(c.panels.indexOf(before), 0, k);
    else if (vis.length) c.panels.splice(c.panels.indexOf(vis[vis.length - 1]) + 1, 0, k);
    else c.panels.push(k);
  }
  return { cols: cols.filter(c => c.panels.length) };
}

// The drop place for moving panel k one step with the arrow keys (null: it cannot go further that way)
export function stepTile(
  t: Tiles,
  k: string,
  dir: 'up' | 'down' | 'left' | 'right',
  shown: Set<string>,
): TileDrop | null {
  const visCols = t.cols.map((c, i) => ({ i, vis: c.panels.filter(p => shown.has(p)) })).filter(c => c.vis.length),
    at = visCols.findIndex(c => c.vis.includes(k));
  if (at < 0) return null;
  const { i, vis } = visCols[at],
    pos = vis.indexOf(k);
  if (dir === 'up') return pos > 0 ? { col: i, index: pos - 1 } : null;
  if (dir === 'down') return pos < vis.length - 1 ? { col: i, index: pos + 1 } : null; // after the next one
  const next = visCols[at + (dir === 'left' ? -1 : 1)];
  if (next) return { col: next.i, index: Math.min(pos, next.vis.length) };
  // at the outer edge: a new column there, if the panel shares its column with another
  if (vis.length < 2 || t.cols.length >= MAX_COLS) return null;
  return { newCol: dir === 'left' ? 0 : t.cols.length };
}

// ---- The page

function narrow() {
  return typeof matchMedia === 'function' && matchMedia('(max-width:920px)').matches; // same as the CSS
}
// Whether the panels area has room for one more shown column
function roomForColumn() {
  return $('panels').getBoundingClientRect().width / ($('panels').querySelectorAll('.pcol').length + 1) >= MIN_COL_W;
}
function panelOf(k: string) {
  return byId(`panel-${k}`);
}
// Puts the panels into their columns (free), their rows (rows) or back into the grid of the preset layouts
export function arrangePanels(mode: string) {
  const host = $('panels'),
    focus = document.activeElement,
    free = mode === 'free';
  host.classList.toggle('free', free);
  host.classList.toggle('rows', mode === 'rows');
  PANELS.forEach(k => {
    panelOf(k).style.flexGrow = ''; // the width in a row
    host.append(panelOf(k));
  });
  host.querySelectorAll('.pcol, .pcol-grip, .prow').forEach(e => e.remove());
  if (mode === 'rows') arrangeRows(host);
  if (free && layout.tiles) {
    let prev = -1;
    layout.tiles.cols.forEach((c, i) => {
      if (!c.panels.some(k => shownPanels.has(k))) return; // only hidden panels: the column is not shown
      if (prev >= 0) host.append(makeGrip(prev, i));
      const col = document.createElement('div');
      col.className = 'pcol';
      col.dataset.col = String(i);
      col.style.flexGrow = String(c.w);
      c.panels.forEach(k => col.append(panelOf(k)));
      host.append(col);
      prev = i;
    });
  }
  if (focus && focus !== document.activeElement) (focus as HTMLElement).focus?.(); // moving a node loses the focus
}
// Switches to the free layout, starting from what the preset layout shows (the arrangement in rows is kept as it is)
export function ensureFree() {
  if (layout.pcols === 'rows') {
    if (!layout.rows) {
      layout.rows = rowsFromPreset('2', [...shownPanels]);
      applyPanels();
    }
    return;
  }
  if (layout.pcols === 'free' && layout.tiles) return;
  layout.tiles = tilesFromPreset(layout.pcols || '2', [...shownPanels]);
  layout.pcols = 'free';
  applyPanels();
}
function moveTo(k: string, to: TileDrop) {
  if (!layout.tiles) return;
  layout.tiles = moveTile(layout.tiles, k, to, shownPanels);
  saveLayout();
  applyPanels();
  requestAnimationFrame(redraw);
}

// The boundary between two shown columns: drag to share their width, arrow keys, double-click for equal widths
function makeGrip(left: number, right: number) {
  const g = document.createElement('div');
  g.className = 'pcol-grip';
  g.tabIndex = 0;
  g.setAttribute('role', 'separator');
  g.setAttribute('aria-orientation', 'vertical');
  i18nTitle(g, 'Drag to change the widths of the columns (arrow keys; double-click: equal widths)');
  const cols = () => layout.tiles?.cols ?? [],
    els = () => [left, right].map(i => qs(`.pcol[data-col="${i}"]`, $('panels'))) as [HTMLElement, HTMLElement],
    share = (fracLeft: number) => {
      const c = cols(),
        sum = c[left].w + c[right].w;
      c[left].w = sum * fracLeft;
      c[right].w = sum - c[left].w;
      const [l, r] = els();
      l.style.flexGrow = String(c[left].w);
      r.style.flexGrow = String(c[right].w);
      scheduleRedraw();
    },
    widths = () => els().map(e => e.getBoundingClientRect().width) as [number, number];
  g.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const [wl, wr] = widths(),
      total = wl + wr,
      x0 = e.clientX;
    g.classList.add('drag');
    g.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const lo = Math.min(MIN_COL_W, total / 2);
      share(Math.max(lo, Math.min(total - lo, wl + ev.clientX - x0)) / total);
    };
    const up = () => {
      g.classList.remove('drag');
      g.removeEventListener('pointermove', move);
      g.removeEventListener('pointerup', up);
      g.removeEventListener('pointercancel', up);
      saveLayout();
      redraw();
    };
    g.addEventListener('pointermove', move);
    g.addEventListener('pointerup', up);
    g.addEventListener('pointercancel', up);
  });
  g.addEventListener('dblclick', () => {
    share(0.5);
    saveLayout();
  });
  g.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const [wl, wr] = widths();
    share(Math.max(0.15, Math.min(0.85, wl / (wl + wr) + (e.key === 'ArrowLeft' ? -0.05 : 0.05))));
    saveLayout();
  });
  return g;
}

// Where a panel dragged to (x, y) would go, and the line that shows it (relative to the panels area)
function dropAt(k: string, x: number, y: number): { to: TileDrop; line: [number, number, number, number] } | null {
  const host = $('panels'),
    hr = host.getBoundingClientRect(),
    t = layout.tiles,
    cols = [...host.querySelectorAll<HTMLElement>('.pcol')];
  if (!t || !cols.length) return null;
  const rects = cols.map(c => c.getBoundingClientRect()),
    dist = rects.map(r => (x < r.left ? r.left - x : x > r.right ? x - r.right : 0)),
    n = dist.indexOf(Math.min(...dist)),
    r = rects[n],
    full = Number(cols[n].dataset.col),
    edge = Math.min(48, r.width / 5),
    alone = cols[n].querySelectorAll('.tabpanel').length === 1 && !!cols[n].querySelector(`#panel-${k}`),
    canAdd = !alone && t.cols.length < MAX_COLS && roomForColumn();
  if (canAdd && x < r.left + edge) return { to: { newCol: full }, line: [r.left - hr.left - 7, 0, 3, hr.height] };
  if (canAdd && x > r.right - edge)
    return { to: { newCol: full + 1 }, line: [Math.min(r.right - hr.left + 4, hr.width - 3), 0, 3, hr.height] };
  const cards = ([...cols[n].children] as HTMLElement[]).filter(
      c => c.style.display !== 'none' && c.id !== `panel-${k}`,
    ),
    index = cards.filter(c => {
      const cr = c.getBoundingClientRect();
      return cr.top + cr.height / 2 < y;
    }).length,
    ly =
      index < cards.length
        ? cards[index].getBoundingClientRect().top - 7
        : cards.length
          ? cards[cards.length - 1].getBoundingClientRect().bottom + 4
          : r.top;
  // index counts the shown panels other than k; moveTile counts them without k as well
  return { to: { col: full, index }, line: [r.left - hr.left, ly - hr.top, r.width, 3] };
}

// Dragging a panel by its handle or title
function startMove(e: PointerEvent, k: string) {
  if (e.button !== 0 || narrow() || (e.target as HTMLElement).closest('[data-csv], .pclose')) return;
  const x0 = e.clientX,
    y0 = e.clientY,
    line = $('panelDrop');
  const rows = () => layout.pcols === 'rows';
  let on = false,
    drop: ReturnType<typeof dropAt> | ReturnType<typeof dropAtRows> = null;
  const show = (d: typeof drop) => {
    line.style.display = d ? 'block' : 'none';
    if (d) [line.style.left, line.style.top, line.style.width, line.style.height] = d.line.map(v => `${v}px`);
  };
  const move = (ev: PointerEvent) => {
    if (!on) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
      on = true;
      ensureFree();
      panelOf(k).classList.add('dragging');
      document.body.classList.add('pdrag');
    }
    drop = rows() ? dropAtRows(k, ev.clientX, ev.clientY) : dropAt(k, ev.clientX, ev.clientY);
    show(drop);
  };
  const stop = (apply: boolean) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', esc, true);
    panelOf(k).classList.remove('dragging');
    document.body.classList.remove('pdrag');
    show(null);
    if (on && apply && drop) {
      if ('row' in drop.to || 'newRow' in drop.to) moveRowTo(k, drop.to);
      else moveTo(k, drop.to);
    }
  };
  const up = () => stop(true),
    cancel = () => stop(false),
    esc = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        ev.stopPropagation();
        stop(false);
      }
    };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', esc, true);
}

// The ⠿ handle of each panel; the arrow keys move the panel one step
const KEY_DIR: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};
PANELS.forEach(k => {
  const row = qs('.h2row', panelOf(k)),
    h = document.createElement('button');
  h.className = 'pmove';
  h.type = 'button';
  h.innerHTML = '<span aria-hidden="true">⠿</span>'; // the title is its name
  i18nTitle(h, 'Drag to move this plot (arrow keys also move it)');
  row.prepend(h);
  row.addEventListener('pointerdown', e => startMove(e, k));
  h.addEventListener('keydown', e => {
    const dir = KEY_DIR[e.key];
    if (!dir || narrow()) return;
    e.preventDefault();
    ensureFree();
    if (layout.pcols === 'rows') {
      const to = layout.rows && stepRowTile(layout.rows, k, dir, shownPanels);
      if (to) moveRowTo(k, to);
    } else {
      const to = layout.tiles && stepTile(layout.tiles, k, dir, shownPanels);
      if (to && !('newCol' in to && !roomForColumn())) moveTo(k, to);
    }
    h.focus();
  });
});

// ---- Height of a panel: its bottom edge scales all its shown plots by the same ratio

/** A plot of a panel with the heights its own handle allows */
interface PanelPlot {
  id: string;
  min: number;
  max: number;
}
// The plots of panel k that are shown (a plot hidden with its own handle is left as it is)
function panelPlots(k: string): PanelPlot[] {
  return [...panelOf(k).querySelectorAll<HTMLElement>('.hgrip[data-target]')]
    .map(g => ({ id: g.dataset.target ?? '', min: Number(g.dataset.min), max: Number(g.dataset.max) }))
    .filter(p => p.id && !isHidden(p.id));
}
// Ratio f that scales heights h0 so that their sum changes by dh, limited so that every plot stays within its
// range (all plots keep the same ratio: the first one to reach its limit stops the others)
export function scaleRatio(h0: number[], plots: PanelPlot[], dh: number): number {
  const sum = h0.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return 1;
  const lo = Math.max(...plots.map((p, i) => p.min / h0[i])),
    hi = Math.min(...plots.map((p, i) => p.max / h0[i]));
  return Math.max(lo, Math.min(hi, (sum + dh) / sum));
}
function setPlotHeights(plots: PanelPlot[], h0: number[], f: number) {
  plots.forEach((p, i) => {
    let v = Math.round(h0[i] * f);
    if (p.id === 'diagBox') {
      v = Math.max(p.min, Math.min(v, diagMaxH())); // the diagram follows the height until it fills the width
      byId(p.id).classList.add('sized');
    }
    byId(p.id).style.height = v + 'px';
    layout.h[p.id] = v;
  });
  scheduleRedraw();
}
// How many times wider the formulas may become and still fit the width of their boxes (the widest formula decides;
// Infinity before they are drawn). 2 % is left for rounding
function texWidthRatio(): number {
  let r = Infinity;
  ['tex-C', 'tex-P'].forEach(id => {
    const el = byId(id);
    el.querySelectorAll('mjx-container > svg').forEach(svg => {
      const w = svg.getBoundingClientRect().width;
      if (w > 0 && el.clientWidth > 0) r = Math.min(r, (el.clientWidth * 0.98) / w);
    });
  });
  return r;
}
// Show the formulas at the chosen size, or smaller so that they fit the width of the panel. Called after they are
// drawn (renderTeX), when the layout is applied, when the size is chosen, and when the width of the panel changes
export function fitTex() {
  const box = $('tf-wrap'),
    cur = parseFloat(getComputedStyle($('tex-P')).fontSize) || TEX_FS_DEFAULT,
    f = texFsShown(layout.texFs || TEX_FS_DEFAULT, cur, texWidthRatio());
  if (f === TEX_FS_DEFAULT && !layout.texFs) box.style.removeProperty('--texFs');
  else box.style.setProperty('--texFs', f + 'px');
}
// ...when the width of the formulas' boxes changes (the window, the columns, the panel shown again)
if (typeof ResizeObserver !== 'undefined') {
  let lastW = -1;
  new ResizeObserver(() => {
    const w = $('tex-C').clientWidth;
    if (w === lastW) return; // a new size of the formulas changes only their height
    lastW = w;
    fitTex();
  }).observe($('tex-C'));
}
// Bottom edge of the transfer functions panel: the formulas are scaled to fit the height (their size, layout.texFs)
function tfGrip(g: HTMLElement) {
  const box = $('tf-wrap');
  let f0 = 14,
    h0 = 0,
    wr = Infinity;
  const measure = () => {
    f0 = parseFloat(getComputedStyle($('tex-P')).fontSize) || 14;
    h0 = box.getBoundingClientRect().height;
    wr = texWidthRatio();
  };
  const setFs = (f: number | null) => {
    layout.texFs = f;
    fitTex();
  };
  dragger(
    g,
    'y',
    () => {
      measure();
      return 0;
    },
    dh => setFs(texFsForHeight(f0, h0, dh, wr)),
    () => saveLayout(),
  );
  g.addEventListener('dblclick', () => {
    setFs(null);
    saveLayout();
  });
  g.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    measure();
    setFs(texFsForHeight(f0, h0, (e.key === 'ArrowDown' ? 0.1 : -0.1) * h0, wr));
    saveLayout();
  });
}
PANELS.forEach(k => {
  const g = document.createElement('div');
  g.className = 'pgrip';
  g.tabIndex = 0;
  g.setAttribute('role', 'separator');
  g.setAttribute('aria-orientation', 'horizontal');
  panelOf(k).append(g);
  if (k === 'tf') {
    i18nTitle(g, 'Drag to change the height of this area (the formulas are scaled to fit; double-click: original)');
    tfGrip(g);
    return;
  }
  i18nTitle(g, 'Drag to change the height of this area (all its plots in the same ratio; double-click: original)');
  let plots: PanelPlot[] = [],
    h0: number[] = [];
  const measure = () => {
    plots = panelPlots(k);
    h0 = plots.map(p => byId(p.id).getBoundingClientRect().height);
  };
  dragger(
    g,
    'y',
    () => {
      measure();
      return 0;
    },
    dh => setPlotHeights(plots, h0, scaleRatio(h0, plots, dh)),
    () => {
      saveLayout();
      redraw();
    },
  );
  g.addEventListener('dblclick', () => {
    panelPlots(k).forEach(p => {
      delete layout.h[p.id];
      byId(p.id).style.height = '';
      if (p.id === 'diagBox') byId(p.id).classList.remove('sized');
    });
    saveLayout();
    redraw();
  });
  g.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    measure();
    const sum = h0.reduce((a, b) => a + b, 0);
    setPlotHeights(plots, h0, scaleRatio(h0, plots, (e.key === 'ArrowDown' ? 0.1 : -0.1) * sum));
    saveLayout();
    redraw();
  });
});
