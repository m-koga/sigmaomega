// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Types shared by the page script =================
   Declarations only: the build ignores .d.ts files. This file has no import or export, so its types are
   global and need no import; types that come from a function refer to its module with import(). */

/** Polynomial coefficients, highest power first: [1, 3, 2] is s^2 + 3s + 2 */
type Poly = number[];
/** Complex number [re, im] */
type Complex = [number, number];

/** Definition of a numeric setting (slider and number box) */
interface ParamDef {
  /** label (English, translated; TeX between \\( \\)) */
  label: string;
  /** slider range and step */
  min: number;
  max: number;
  step: number;
  /** initial value */
  val: number;
  /** limits of a typed value (typed values may leave the slider range) */
  hard: readonly [number, number];
  /** short plain symbol for tables, legends and file names (KP, β); default: the key */
  sym?: string;
  /** values offered by "Values around the current setting" in the parameter sweep (default: ×0.5, ×1, ×2, ×4) */
  sweep?: number[];
  [extra: string]: unknown;
}
type ParamDefs = Record<string, ParamDef>;

/** One design specification: checked or not, and its limit */
interface SpecItem {
  on: boolean;
  v: number;
}
/** Definition of a design specification (SPECS in 10-definitions.ts) */
interface SpecDef {
  /** text before the limit, in English (translated through the dictionary) */
  label: string;
  /** unit of the limit and of the measured value ('' when none) */
  unit: string;
  /** smallest limit that can be typed */
  low: number;
  /** 'max': the measured value must be ≤ the limit; 'min': ≥ */
  bound: 'max' | 'min';
  /** default: checked or not, and the limit */
  on: boolean;
  v: number;
}
/** The design specifications (the keys of SPECS), and whether they are drawn on the plots */
type Specs = Record<SpecKey, SpecItem> & { show: boolean };

/** State of the simulator (the settings panel); saved in scenarios */
interface State {
  // plant parameters
  K: number;
  T: number;
  zeta: number;
  wn: number;
  L: number;
  // controller parameters
  Kp: number;
  Ki: number;
  Kd: number;
  N: number;
  Kc: number;
  T1: number;
  alpha: number;
  T2: number;
  beta: number;
  // 2-DOF weights
  tdof: boolean;
  bw: number;
  cw: number;
  // reference, noise, disturbance, saturation
  refType: string;
  R: number;
  rT0: number;
  rPer: number;
  rW: number;
  noise: number;
  d: number;
  td: number;
  dOn: boolean;
  dOnMeas: boolean;
  sat: boolean;
  umax: number;
  aw: boolean;
  Tsim: number;
  /** plant kind ('first', 'second', ..., 'custom') */
  plant: string;
  /** controller kind ('P', 'PI', 'PID', ..., 'lead', 'lag', 'custom') */
  mode: string;
  /** last PID-type mode chosen (for "Convert from PID settings") */
  lastPid?: string;
  // plant entered as a transfer function
  cNumStr: string;
  cDenStr: string;
  cNum: Poly;
  cDen: Poly;
  cUnstable: boolean;
  L_custom: number;
  // controller entered as a transfer function
  ccNumStr: string;
  ccDenStr: string;
  ccNum: Poly;
  ccDen: Poly;
  ccUnstable: boolean;
  ccTouched?: boolean;
  spec: Specs;
  tune: { method: string; type: string; lam: number | null };
  /** lead/lag compensator design: kind, target phase margin [deg], gain Kc, allowance θ [deg] */
  comp: { method: string; pm: number; kc: number; theta: number; wc: number | null };
  /** estimation exercise: its number (the hidden plant follows from it) */
  /** estimation exercise: its number, and the response read (the step response or the Bode plot) */
  ex: { n: number; kind: 'step' | 'bode' };
  sweep: { on: boolean; p: NumKey; vals: number[] };
  /** frequency range of the Bode plot set by hand [rad/s]; sig: what the automatic range depended on then */
  wr: { on: boolean; lo: number; hi: number; sig: string };
}

/** Free arrangement of the plot panels: columns side by side, each with its panels from top to bottom.
    Every panel is in one column, also the hidden ones (so that they come back in their place).
    w: relative width of the column */
interface Tiles {
  cols: { w: number; panels: string[] }[];
}

/** Arrangement of the plot panels in rows (Layout: "Rows"): rows from top to bottom, each with its panels side by
    side (1-4 shown in a row). Every panel is in one row, also the hidden ones (so that they come back in their
    place). w: relative width of each panel in its row (same length as panels) */
interface RowTiles {
  rows: { panels: string[]; w: number[] }[];
}

/** Layout of the page (saved in the browser and optionally in scenarios) */
interface Layout {
  sideW: number | null;
  /** heights of plots and areas, by element id */
  h: Record<string, number>;
  /** size (px) of the formulas of the transfer functions panel and of the loop transfer functions panel */
  texFs: number | null;
  loopFs: number | null;
  ms: number | null;
  msb: number | null;
  ts: number | null;
  /** scale of zoomable areas, by key */
  zs: Record<string, number>;
  hidden: Record<string, boolean>;
  subs: Record<string, boolean>;
  panels: string[] | null;
  /** version of the panel list (PANELS_V in 41-view.ts) */
  pv: number;
  /** '1', '2', 'row' or 'free' (tiles) */
  pcols: string | null;
  tiles: Tiles | null;
  /** arrangement in rows (Layout: "Rows") */
  rows: RowTiles | null;
  stab: string;
  /** the card shown in the settings panel (stab: its drop-down list) */
  scard: string;
  sideCollapsed: boolean;
  mview: 'cards' | 'table';
  /** selected tab of each area under a plot (INFO_AREAS): area -> section */
  itabs: Record<string, string>;
  mtab: 'plot' | 'set';
}

/** Translation dictionary: English text → language code → translation */
type I18nDict = Record<string, Partial<Record<'ja' | 'zh' | 'ko' | 'th' | 'fr' | 'de' | 'es', string>>>;
/** Values inserted into a translated string ({name} placeholders) */
type TVars = Record<string, string | number>;

// ---- globals provided by the page or the environment
/** MathJax (loaded from a CDN; may be missing) */
declare var MathJax: any;
/** claude.ai artifact viewer API (only inside the viewer) */
declare var claude: { use(name: string): Promise<any> } | undefined;
// Functions the script puts on window: renderTeX is called by MathJax when it has loaded (src/index.html);
// diagViewReset shows the whole block diagram after a new drawing (83-diagram-zoom.ts)
interface Window {
  renderTeX?: () => void;
  diagViewReset?: () => void;
}

/** A scenario: the settings (and optionally the layout) saved in the browser, in a file, as text or in a link */
interface Scenario {
  app?: string;
  format?: number;
  version?: string;
  name?: string;
  note?: string;
  /** settings (the keys of State that are saved) */
  S: Partial<State>;
  layout?: Partial<Layout>;
  /** check boxes of the plots */
  view?: Record<string, boolean>;
  /** time of saving (ISO 8601) */
  saved?: string;
}

/** Coordinates of a drawn plot, kept on its canvas for zooming, panning and the cursor readout */
interface PlotTransform {
  m: { l: number; r: number; t: number; b: number };
  pw: number;
  ph: number;
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  /** logarithmic x axis */
  lx: boolean;
}
interface HTMLCanvasElement {
  _tf?: PlotTransform;
}

/** Rational function num/den (descending powers) */
interface Rational {
  num: Poly;
  den: Poly;
}
/** Plant: rational part and dead time L [s] */
interface TF extends Rational {
  L: number;
}
/** State space of a proper rational function (controllable canonical form), discretized by discretize() */
interface StateSpace {
  n: number;
  c: number[];
  D: number;
  /** denominator normalized to a monic polynomial */
  dn: number[];
  Ad?: number[][];
  Bd?: number[];
}
/** State space after discretize(): x[k+1] = Ad x[k] + Bd u[k] */
interface DiscreteSS extends StateSpace {
  Ad: number[][];
  Bd: number[];
}
/** Keys of the numeric settings in State (sliders and number boxes) */
type NumKey = { [K in keyof State]-?: State[K] extends number ? K : never }[keyof State];

// Results of the main computations (inferred from the functions that make them)
type SimResult = ReturnType<typeof import('./16-simulation.ts').simulate>;
type FreqResult = ReturnType<typeof import('./15-frequency.ts').freqResp>;
type BodeSeries = ReturnType<typeof import('./15-frequency.ts').bodeSeries>;
type StepMetrics = ReturnType<typeof import('./16-simulation.ts').stepMetrics>;

/** Handle of setTimeout */
type Timer = ReturnType<typeof setTimeout>;

type PZResult = ReturnType<typeof import('./17-loop.ts').computePZ>;
type SpecKey = keyof typeof import('./10-definitions.ts').SPECS;
/** Result of one specification: checked or not, whether it applies, measured value, met or not */
interface SpecResult {
  key: SpecKey;
  on: boolean;
  applicable: boolean;
  value: number | null;
  ok: boolean | null;
  /** text shown when value is null and the specification applies (English; '∞', 'Not settled') */
  none?: string;
}
type SpecEval = Record<SpecKey, SpecResult>;
/** One run of the parameter sweep */
interface SweepRun {
  v: number;
  sim: SimResult;
  fr: FreqResult;
  /** frequency response over the Bode range set by hand (null: automatic) */
  frB: FreqResult | null;
  pz: PZResult;
  mt: StepMetrics | null;
  ev: SpecEval;
  stable: boolean;
}
/** Closed-loop poles on the root locus for the gain factor k */
interface LocusPoint {
  k: number;
  r: Complex[];
}
/** A point of the pole-zero map: pp/pz plant pole/zero, cp/cz controller pole/zero, cl closed-loop pole,
 *  sw closed-loop pole of sweep run i (value v), rl root locus */
interface PZPoint {
  z: Complex;
  k: string;
  i?: number;
  v?: number;
}
/** View of the pole-zero map: centre and scale [px per unit] */
interface PZView {
  cx: number;
  cy: number;
  k: number;
}
/** A held response drawn for comparison */
interface Ghost {
  T: number[];
  Y: number[];
}

/** Options of plot(): curves, ranges, labels and extra marks */
interface PlotSeries {
  x: number[];
  y: number[];
  color: string;
  width?: number;
  dash?: number[];
  name?: string;
}
interface PlotLine {
  v: number;
  color: string;
  dash?: number[];
  label?: string;
}
interface PlotOptions {
  series: PlotSeries[];
  xmin: number;
  xmax: number;
  /** vertical range (automatic when missing) */
  ymin?: number;
  ymax?: number;
  xlog?: boolean;
  xlabel?: string;
  ylabel?: string;
  hlines?: PlotLine[];
  vlines?: PlotLine[];
  yticks?: (lo: number, hi: number) => number[];
  circles?: { cx: number; cy: number; r: number; color: string; width?: number; dash?: number[] }[];
  bands?: { x0: number; x1: number; y0: number; y1: number; fill: string; stroke?: string }[];
  segs?: { x0: number; x1: number; y: number; color: string; dash?: number[] }[];
  /** place of the legend: top right (default) or bottom left */
  legend?: 'tr' | 'bl';
  /** marks: × (default) or a small circle */
  points?: PlotPoint[];
}
/** A panel of the plot area (PANEL_DEFS in 41-view.ts) */
interface PanelDef {
  /** its item in the menu, in English */
  label: string;
  /** the menu with its item: "Plots to show" or "Analysis & design" */
  menu: 'plots' | 'ana';
  /** a panel without a plot */
  text: boolean;
}
/** A point marked on a plot */
interface PlotPoint {
  x: number;
  y: number;
  color: string;
  shape?: 'x' | 'o';
}
/** Label and value of a metric */
type Metric = [string, string];
