// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ===== Arrangement of the plot panels in rows (Layout: "Rows") =====
   The panels sit in rows from top to bottom; each row has its own number of panels side by side (1 to MAX_COLS),
   so one row can hold the block diagram alone, the next two plots and the next three. The ⠿ handle (or the title)
   of a panel moves it: within a row, into another row or into a new row. The boundary between two panels of a row
   changes their widths. On a narrow screen the panels are shown one below the other.
   The stored arrangement is read and checked in 41-view.ts (normRows); 79-layout.ts applies it. */
import { $, byId, i18nTitle } from './40-dom.ts';
import { MAX_COLS, layout, saveLayout, shownPanels } from './41-view.ts';
import { redraw, scheduleRedraw } from './62-update.ts';

// ---- Operations on the arrangement (no page access)

/** Where a panel is dropped: before the index-th shown panel of row `row` (index = number shown: at the end), or
    into a new row inserted before row newRow (newRow = number of rows: at the bottom) */
export type RowDrop = { row: number; index: number } | { newRow: number };

// The arrangement after moving panel k to the drop place (unchanged if the row is full); rows left without
// panels are removed. The moved panel gets the average width of the shown panels of its new row
export function moveRowTile(t: RowTiles, k: string, to: RowDrop, shown: Set<string>): RowTiles {
  const rows = t.rows.map(r => {
    const i = r.panels.indexOf(k);
    return i < 0
      ? { panels: [...r.panels], w: [...r.w] }
      : { panels: r.panels.filter((_, j) => j !== i), w: r.w.filter((_, j) => j !== i) };
  });
  if ('newRow' in to) rows.splice(Math.max(0, Math.min(to.newRow, rows.length)), 0, { panels: [k], w: [1] });
  else {
    const r = rows[to.row];
    if (!r) return t;
    const vis = r.panels.filter(p => shown.has(p));
    if (vis.length >= MAX_COLS) return t;
    const vw = r.w.filter((_, j) => shown.has(r.panels[j])),
      w = vw.length ? vw.reduce((a, b) => a + b, 0) / vw.length : 1,
      before = vis[to.index],
      at = before !== undefined ? r.panels.indexOf(before) : vis.length ? r.panels.indexOf(vis[vis.length - 1]) + 1 : 0;
    r.panels.splice(at, 0, k);
    r.w.splice(at, 0, w);
  }
  return { rows: rows.filter(r => r.panels.length) };
}

// The drop place for moving panel k one step with the arrow keys (null: it cannot go further that way): left and
// right within its row; up and down into the neighbouring row at the same place (if it has room), or into a new
// row above or below if the panel shares its row
export function stepRowTile(
  t: RowTiles,
  k: string,
  dir: 'up' | 'down' | 'left' | 'right',
  shown: Set<string>,
): RowDrop | null {
  const visRows = t.rows.map((r, i) => ({ i, vis: r.panels.filter(p => shown.has(p)) })).filter(r => r.vis.length),
    at = visRows.findIndex(r => r.vis.includes(k));
  if (at < 0) return null;
  const { i, vis } = visRows[at],
    pos = vis.indexOf(k);
  if (dir === 'left') return pos > 0 ? { row: i, index: pos - 1 } : null;
  if (dir === 'right') return pos < vis.length - 1 ? { row: i, index: pos + 1 } : null; // after the next one
  const next = visRows[at + (dir === 'up' ? -1 : 1)];
  if (next) return next.vis.length < MAX_COLS ? { row: next.i, index: Math.min(pos, next.vis.length) } : null;
  if (vis.length < 2) return null;
  return { newRow: dir === 'up' ? i : i + 1 };
}

// ---- The page

const MIN_ROW_PANEL_W = 200; // narrowest panel in a row when the boundary is dragged [px]

// Puts the panels into their rows (called by arrangePanels in 78-tiles.ts)
export function arrangeRows(host: HTMLElement) {
  const t = layout.rows;
  if (!t) return;
  t.rows.forEach((r, i) => {
    if (!r.panels.some(k => shownPanels.has(k))) return; // only hidden panels: the row is not shown
    const row = document.createElement('div');
    row.className = 'prow';
    row.dataset.row = String(i);
    let prev = '';
    r.panels.forEach((k, j) => {
      const el = byId(`panel-${k}`);
      if (shownPanels.has(k)) {
        if (prev) row.append(makeRowGrip(i, prev, k));
        prev = k;
      }
      el.style.flexGrow = String(r.w[j]);
      row.append(el);
    });
    host.append(row);
  });
}

// The boundary between two shown panels a and b of row i: drag to share their width, arrow keys, double-click for
// equal widths
function makeRowGrip(i: number, a: string, b: string) {
  const g = document.createElement('div');
  g.className = 'prow-grip';
  g.tabIndex = 0;
  g.setAttribute('role', 'separator');
  g.setAttribute('aria-orientation', 'vertical');
  i18nTitle(g, 'Drag to change the widths of the panels in this row (arrow keys; double-click: equal widths)');
  const els = () => [a, b].map(k => byId(`panel-${k}`)) as [HTMLElement, HTMLElement],
    share = (fracA: number) => {
      const r = layout.rows?.rows[i];
      if (!r) return;
      const ia = r.panels.indexOf(a),
        ib = r.panels.indexOf(b),
        sum = r.w[ia] + r.w[ib];
      r.w[ia] = sum * fracA;
      r.w[ib] = sum - r.w[ia];
      const [ea, eb] = els();
      ea.style.flexGrow = String(r.w[ia]);
      eb.style.flexGrow = String(r.w[ib]);
      scheduleRedraw();
    },
    widths = () => els().map(e => e.getBoundingClientRect().width) as [number, number];
  g.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const [wa, wb] = widths(),
      total = wa + wb,
      x0 = e.clientX;
    g.classList.add('drag');
    g.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const lo = Math.min(MIN_ROW_PANEL_W, total / 2);
      share(Math.max(lo, Math.min(total - lo, wa + ev.clientX - x0)) / total);
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
    redraw();
  });
  g.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const [wa, wb] = widths();
    share(Math.max(0.15, Math.min(0.85, wa / (wa + wb) + (e.key === 'ArrowLeft' ? -0.05 : 0.05))));
    saveLayout();
    redraw();
  });
  return g;
}

// Where a panel dragged to (x, y) would go in the arrangement in rows, and the line that shows it (relative to the
// panels area): near the top or bottom edge of a row, a new row there; otherwise between the panels of that row
export function dropAtRows(
  k: string,
  x: number,
  y: number,
): { to: RowDrop; line: [number, number, number, number] } | null {
  const host = $('panels'),
    hr = host.getBoundingClientRect(),
    rowEls = [...host.querySelectorAll<HTMLElement>('.prow')];
  if (!layout.rows || !rowEls.length) return null;
  const rects = rowEls.map(r => r.getBoundingClientRect()),
    dist = rects.map(r => (y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0)),
    n = dist.indexOf(Math.min(...dist)),
    r = rects[n],
    full = Number(rowEls[n].dataset.row),
    cards = ([...rowEls[n].children] as HTMLElement[]).filter(
      c => c.classList.contains('tabpanel') && c.style.display !== 'none' && c.id !== `panel-${k}`,
    ),
    alone = !cards.length,
    band = Math.min(40, r.height / 4);
  if (!alone && y < r.top + band) return { to: { newRow: full }, line: [0, r.top - hr.top - 7, hr.width, 3] };
  if (!alone && y > r.bottom - band)
    return { to: { newRow: full + 1 }, line: [0, Math.min(r.bottom - hr.top + 4, hr.height - 3), hr.width, 3] };
  if (cards.length >= MAX_COLS) return null; // the row is full
  const index = cards.filter(c => {
      const cr = c.getBoundingClientRect();
      return cr.left + cr.width / 2 < x;
    }).length,
    lx =
      index < cards.length
        ? cards[index].getBoundingClientRect().left - 7
        : cards.length
          ? cards[cards.length - 1].getBoundingClientRect().right + 4
          : r.left;
  return { to: { row: full, index }, line: [lx - hr.left, r.top - hr.top, 3, r.height] };
}
