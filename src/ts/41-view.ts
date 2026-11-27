// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= View state: colours, layout, shown plots and plot views ================= */
import { PLOTS, sideCardOf } from './10-definitions.ts';

/* Colours of the plots, by role (the colours of the page itself are in style.css) */
export const COLORS = {
  // axes and text
  text: '#1b1d22', // axis names and legend text
  tick: '#666b75', // tick labels
  grid: '#ecebe6', // grid lines
  gridDecade: '#e4e2dc', // decade lines of a logarithmic axis
  gridMinor: '#f3f2ee', // 2 … 9 × 10^n lines of a logarithmic axis
  zeroLine: '#c9c6be', // zero line, imaginary axis of the Nyquist plot
  frame: '#bdb9b0', // frame of the plot area
  axisPZ: '#9a968c', // real and imaginary axes of the pole-zero map
  legendBack: 'rgba(255,255,255,.88)',
  legendBackPZ: 'rgba(255,255,255,.9)',
  white: '#fff', // outline of dots, background of saved PNG files
  // signals and curves
  reference: '#666b75', // reference r
  output: '#1f5fbf', // output y, L(jω), ωgc, ω > 0 of the Nyquist plot, plant poles and zeros
  input: '#d9822b', // control input u, C(jω), controller poles and zeros
  plant: '#2e7d32', // P(jω), and the response of the plant alone in the time response
  sensitivity: '#8e24aa', // S(jω), Ms circle and limit line
  complementary: '#00897b', // T(jω)
  disturbanceTF: '#8d6e63', // Gyd(jω)
  referenceTF: '#33363d', // Gyr(jω)
  negativeFreq: '#9aa0aa', // ω < 0 of the Nyquist plot
  zeroDb: '#888', // 0 dB line
  locus: '#7b4fa3', // root locus
  locusAxis: 'rgba(123,79,163,.25)', // real-axis segments of the root locus
  locusRules: '#00838f', // asymptotes, breakaway points, imaginary-axis crossings, departure and arrival angles
  nyqCrossing: '#00838f', // crossings of the Nyquist plot with the real axis to the left of −1
  asymptote: '#d81b60', // straight-line approximation of the gain of L(jω) and its break frequencies (a color apart
  // from the blue of L, which it covers away from the breaks)
  mContour: 'rgba(110,110,120,.45)', // M contours of the Nichols chart
  approx: '#d81b60', // second-order approximation of the time response (dashed)
  // the straight lines of the factors of L(jω) that add up to its asymptotes (K/s^q, each pole or zero, dead time)
  asymParts: ['#ef6c00', '#2e7d32', '#6a1b9a', '#00838f', '#9e9d24', '#5d4037', '#1565c0', '#c62828'],
  mLabel: 'rgba(90,90,100,.9)', // their labels
  dampingGrid: 'rgba(123,79,163,.35)', // ζ–ωn grid lines
  dampingLabel: 'rgba(123,79,163,.8)', // ζ–ωn grid labels
  // limits and specifications
  alert: '#c62828', // saturation limits, disturbance time, −180°, ωpc, −1 point, overshoot limit, closed-loop poles
  spec: '#2e7d32', // specification lines: settling band, error limits, GM, PM, Ms circle, design region
  specBand: 'rgba(46,125,50,.16)', // settling band
  rightHalfPlane: 'rgba(198,40,40,0.06)', // unstable half of the pole-zero map
  outsideRegion: 'rgba(60,60,60,.07)', // outside the design region of the pole specifications
};
/* ---- Panels of the plot area ----
   In their order. To add a panel: an entry here; its <div class="card tabpanel" id="panel-KEY"> with a
   <div class="h2row"><h2>…</h2></div> in src/index.html (where its × is added); what redraw() draws in it in
   PANEL_DRAW (62-update.ts); and, for a plot, its canvases in PLOTS (10-definitions.ts) and its CSV in CSV_EXPORTS
   (76-export.ts, with a button data-csv="KEY"). Its item in the menu is made from the entry.
     label: the item in the menu (English, translated through the dictionary); menu: 'plots' ("Plots to show")
     or 'ana' ("Analysis & design"); text: a panel without a plot (when hidden panels are gathered in rows, the
     plots come first, so that they come back side by side) */
export const PANEL_DEFS = {
  diag: { label: 'Block diagram', menu: 'plots', text: false },
  time: { label: 'Time response', menu: 'plots', text: false },
  // the transfer functions C(s), P(s)
  tf: { label: 'Transfer functions', menu: 'plots', text: true },
  // the transfer functions of the loop L(s), S(s), T(s), Gyr(s), Gyd(s)
  loop: { label: 'Loop transfer functions', menu: 'plots', text: true },
  // the poles of P(s), C(s) and of the transfer functions of the loop (a table)
  poles: { label: 'Poles and zeros', menu: 'plots', text: true },
  routh: { label: 'Routh–Hurwitz test', menu: 'ana', text: true },
  // the system type and the steady-state errors
  sse: { label: 'Steady-state error', menu: 'ana', text: true },
  bode: { label: 'Bode plot', menu: 'plots', text: false },
  nyq: { label: 'Nyquist plot', menu: 'plots', text: false },
  nich: { label: 'Nichols chart', menu: 'plots', text: false },
  pz: { label: 'Pole-zero map', menu: 'plots', text: false },
} as const satisfies Record<string, PanelDef>;
export type PanelKey = keyof typeof PANEL_DEFS;
export const PANELS = Object.keys(PANEL_DEFS) as PanelKey[];
// Panels shown when nothing is stored
export const DEFAULT_PANELS = ['diag', 'time', 'tf'];
// Version of the stored panel list: before 2 the transfer functions and before 3 the block diagram were not panels
// but always shown above the plots
export const PANELS_V = 3;
// Hidden areas from stored data without the formulas: hidden with their own handle before they became a panel
// (now the panel is hidden instead, see storedPanels)
export function withoutTex(hidden: Record<string, boolean>): Record<string, boolean> {
  const r = { ...hidden };
  delete r.tex;
  return r;
}
// Shown panels from stored data (valid keys only; null when none). A list saved before the transfer functions
// became a panel gets them added, unless they had been hidden with their handle; one saved before the block diagram
// became a panel gets it added (it was always shown).
export function storedPanels(panels: unknown, pv: unknown, hidden: unknown): string[] | null {
  if (!Array.isArray(panels)) return null;
  const p = PANELS.filter(k => panels.includes(k)) as string[];
  if (!p.length) return null;
  const v = typeof pv === 'number' ? pv : 1,
    texHidden = !!hidden && typeof hidden === 'object' && (hidden as Record<string, unknown>).tex === true;
  if (v < 2 && !texHidden) p.push('tf');
  if (v < 3) p.push('diag');
  return PANELS.filter(k => p.includes(k));
}
// Number of grid columns of a preset layout (1 column, 2 columns, 1 row) for the shown panels; the block diagram
// is not counted: it lies on top across the whole width
export function presetCols(mode: string, shown: Iterable<string>): number {
  const n = [...shown].filter(k => k !== 'diag' && (PANELS as readonly string[]).includes(k)).length;
  return Math.max(1, mode === '1' ? 1 : mode === 'row' ? n : Math.min(2, n));
}
export const MAX_COLS = 4; // columns of the free layout (78-tiles.ts)
/** Zoomed view of a plot (axis ranges set by the user; a missing axis is automatic) */
interface PlotView {
  x?: [number, number];
  y?: [number, number];
}
export const PLOT_VIEWS: Record<string, PlotView> = {};
// Zoomable plots, plots sharing the horizontal axis and plots zooming both axes together, from PLOTS
const plotKeys = Object.keys(PLOTS);
export const PLOT_IDS: string[] = plotKeys.filter(k => PLOTS[k].zoom);
export const LINKX: Record<string, string> = Object.fromEntries(
  plotKeys.flatMap(k => (PLOTS[k].linkX ? [[k, PLOTS[k].linkX]] : [])),
);
export const KEEP_ASPECT: Record<string, boolean> = Object.fromEntries(plotKeys.map(k => [k, !!PLOTS[k].keepAspect]));
export function setPlotView(id: string, axis: 'x' | 'y', range: [number, number]) {
  (PLOT_VIEWS[id] = PLOT_VIEWS[id] || {})[axis] = range;
  if (axis === 'x' && LINKX[id]) (PLOT_VIEWS[LINKX[id]] = PLOT_VIEWS[LINKX[id]] || {}).x = [range[0], range[1]];
}
export function resetPlotView(id: string) {
  delete PLOT_VIEWS[id];
  const o = LINKX[id];
  if (o && PLOT_VIEWS[o]) {
    delete PLOT_VIEWS[o].x;
    if (!PLOT_VIEWS[o].y) delete PLOT_VIEWS[o];
  }
}
export const toU = (v: number, lx: boolean) => (lx ? Math.log10(v) : v),
  fromU = (u: number, lx: boolean) => (lx ? Math.pow(10, u) : u);
// A valid arrangement in rows from stored data: every panel exactly once (the block diagram, when missing, in a row
// of its own on top; other missing panels together in a new row at the bottom), positive widths; null when nothing
// usable
export function normRows(src: unknown): RowTiles | null {
  if (!src || typeof src !== 'object' || !Array.isArray((src as RowTiles).rows)) return null;
  const seen = new Set<string>(),
    rows: RowTiles['rows'] = [];
  for (const r of (src as RowTiles).rows) {
    if (!r || typeof r !== 'object' || !Array.isArray(r.panels)) continue;
    const panels: string[] = [],
      w: number[] = [];
    (r.panels as unknown[]).forEach((k, i) => {
      if (typeof k !== 'string' || !(PANELS as readonly string[]).includes(k) || seen.has(k)) return;
      seen.add(k);
      const v = Array.isArray(r.w) ? r.w[i] : 1;
      panels.push(k);
      w.push(typeof v === 'number' && isFinite(v) && v > 0 ? Math.min(v, 100) : 1);
    });
    if (panels.length) rows.push({ panels, w });
  }
  if (!rows.length) return null;
  if (!seen.has('diag')) rows.unshift({ panels: ['diag'], w: [1] });
  pushRows(
    rows,
    PANELS.filter(k => !seen.has(k) && k !== 'diag'),
  );
  return { rows };
}
// Adds panels at the bottom in new rows of at most MAX_COLS
function pushRows(rows: RowTiles['rows'], panels: string[]) {
  for (let i = 0; i < panels.length; i += MAX_COLS) {
    const p = panels.slice(i, i + MAX_COLS);
    rows.push({ panels: p, w: p.map(() => 1) });
  }
}
// The arrangement with no row showing more than MAX_COLS panels: the panels beyond go into a new row below (a
// hidden panel shown again comes back in its row, which may be full)
export function splitFullRows(t: RowTiles, shown: Set<string>): RowTiles {
  const rows: RowTiles['rows'] = [];
  t.rows.forEach(r => {
    let cur = { panels: [] as string[], w: [] as number[] },
      n = 0;
    r.panels.forEach((k, j) => {
      if (shown.has(k) && n === MAX_COLS) {
        rows.push(cur);
        cur = { panels: [], w: [] };
        n = 0;
      }
      if (shown.has(k)) n++;
      cur.panels.push(k);
      cur.w.push(r.w[j]);
    });
    rows.push(cur);
  });
  return rows.length === t.rows.length ? t : { rows };
}
// Panels without plots that go after the plots when hidden panels are gathered in rows (the plots then come back
// side by side)
const TEXT_PANELS: string[] = PANELS.filter(k => PANEL_DEFS[k].text);
// The arrangement in rows that looks like a preset layout: the block diagram in a row of its own on top, the other
// shown panels n to a row (1 column: one, 2 columns: two, 1 row: all, at most MAX_COLS); the hidden panels together
// in rows at the bottom, the plots first, so that they come back side by side
export function rowsFromPreset(mode: string, shown: string[]): RowTiles {
  const n = Math.min(MAX_COLS, presetCols(mode, shown)),
    vis = PANELS.filter(k => k !== 'diag' && shown.includes(k)),
    rows: RowTiles['rows'] = [];
  if (shown.includes('diag')) rows.push({ panels: ['diag'], w: [1] });
  for (let i = 0; i < vis.length; i += n) {
    const p = vis.slice(i, i + n);
    rows.push({ panels: p, w: p.map(() => 1) });
  }
  const hidden = PANELS.filter(k => !shown.includes(k));
  pushRows(rows, [...hidden.filter(k => !TEXT_PANELS.includes(k)), ...hidden.filter(k => TEXT_PANELS.includes(k))]);
  return { rows };
}
export const MIN_COL_W = 320; // narrowest column: when the boundary is dragged and when a column is added [px]
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
export const LAYOUT_KEY = 'ctrlsim-layout-v1';
// Plots shown (time response, Bode, Nyquist, pole-zero map)
export let shownPanels = new Set<string>(['time']);
// Show these panels (valid keys only; the time response when none)
export function setShownPanels(keys: Iterable<string>) {
  shownPanels = new Set([...keys].filter(k => (PANELS as readonly string[]).includes(k)));
  if (!shownPanels.size) shownPanels.add('time');
}
// Replace the layout (from a scenario); applyLayout() shows it
export function setLayout(l: Layout) {
  layout = l;
}
/* Areas under the plots: their sections are shown one at a time with tabs, and one handle below the area
   scales the shown section and hides the whole area with its tabs. tabs: [section, tab name]
   (defined before the layout is read: infoTabs checks the stored tabs against it) */
export const INFO_AREAS: Record<string, { label: string; tabs: [string, string][] }> = {
  tinfo: {
    label: 'Response metrics and simulation time',
    tabs: [
      ['metrics', 'Response metrics'],
      ['so2', 'Second-order approximation'],
      ['modes', 'Modes'],
      ['tsim', 'Simulation time'],
      ['tdisp', 'Display'],
    ],
  },
  binfo: {
    label: 'Bode plot details',
    tabs: [
      ['bodeopts', 'Curves'],
      ['margins', 'Stability margins'],
      ['bodeasym', 'Break frequencies'],
      ['bodenote', 'Note'],
    ],
  },
  ninfo: {
    label: 'Nyquist plot details',
    tabs: [
      ['nyqopts', 'Options'],
      ['nyqcrit', 'Nyquist criterion'],
      ['nyqmap', 'Contour mapping'],
      ['nyqnote', 'Note'],
    ],
  },
  pinfo: {
    label: 'Pole-zero map details',
    tabs: [
      ['pzopts', 'Display'],
      ['pzbanner', 'Stability'],
      ['pzrange', 'Gain ranges'],
      ['pzrules', 'Locus rules'],
      ['pztable', 'Pole list'],
      ['pznote', 'Note'],
      ['pzhelp', 'How to use'],
    ],
  },
};
// The layout of a first visit: the one place that lists every item of the layout with its default (used at start,
// by resetLayout and for scenarios without a layout, 80-scenarios.ts). A new item is added here, to the Layout type
// and, if it is stored, to the reading below and to scLayout
export function defaultLayout(): Layout {
  return {
    sideW: null,
    h: {},
    texFs: null,
    loopFs: null,
    ms: null,
    msb: null,
    ts: null,
    zs: {},
    hidden: {},
    subs: {},
    panels: null,
    pv: PANELS_V,
    pcols: null,
    tiles: null,
    rows: null,
    stab: 'sys',
    scard: 'plant',
    sideCollapsed: false,
    mview: 'cards',
    itabs: {},
    mtab: 'plot',
  };
}
export let layout: Layout = defaultLayout();
// Selected tab of each area: a known section, else the first (ttab: the setting of version 1.50)
export function infoTabs(src: unknown, ttab?: unknown): Record<string, string> {
  const r: Record<string, string> = {},
    o = src && typeof src === 'object' ? (src as Record<string, unknown>) : {};
  if (ttab === 'tsim' && o.tinfo === undefined) r.tinfo = 'tsim';
  Object.entries(INFO_AREAS).forEach(([a, d]) => {
    const v = o[a];
    if (typeof v === 'string' && d.tabs.some(([k]) => k === v)) r[a] = v;
  });
  return r;
}
try {
  const s = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null');
  if (s && typeof s === 'object')
    layout = {
      ...defaultLayout(), // items not read below keep their defaults
      sideW: s.sideW || null,
      h: s.h || {},
      texFs: s.texFs || null,
      loopFs: s.loopFs || null,
      ms: s.ms || null,
      msb: 'msb' in s ? s.msb || null : s.ms || null, // layouts saved before msb existed: the same as ms
      ts: s.ts || null,
      zs: s.zs || {},
      hidden: withoutTex(s.hidden || {}),
      subs: s.subs || {},
      panels: storedPanels(s.panels, s.pv, s.hidden),
      pv: PANELS_V,
      pcols: s.pcols || null,
      tiles: normTiles(s.tiles),
      rows: normRows(s.rows),
      stab: s.stab || 'sys',
      scard: sideCardOf(s.scard, s.stab),
      sideCollapsed: !!s.sideCollapsed,
      mview: s.mview === 'table' ? 'table' : 'cards',
      itabs: infoTabs(s.itabs, s.ttab),
      mtab: s.mtab === 'set' ? 'set' : 'plot',
    };
} catch (e) {}
export function saveLayout() {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch (e) {}
}
export const isHidden = (key: string) => !!layout.hidden[key];
// Subsections of the input forms (examples, properties, syntax, dead time): click the heading to show/hide (hidden by default)
export const subFolded = (key: string) => !(layout.subs && layout.subs[key] === false);
