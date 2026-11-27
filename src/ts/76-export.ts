// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Export of results (CSV, PNG) ================= */
import { T } from './02-i18n.ts';
import { numStr } from './03-math.ts';
import { paramSym } from './10-definitions.ts';
import { S, lastFr, lastFrB, lastPZ, lastSim, lastSweep, refValue } from './11-state.ts';
import { $, copyText, saveFile, toast } from './40-dom.ts';
import { plantAlone } from './46-time-plot.ts';

/** A cell of a CSV file */
type CsvCell = string | number | null | undefined;
export const csvNum = (v: number | null | undefined) =>
  v === null || v === undefined || !isFinite(v) ? '' : String(+(+v).toPrecision(8));
export const csvRow = (a: CsvCell[]) =>
  a
    .map(x =>
      typeof x === 'number' ? csvNum(x) : /[",\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x),
    )
    .join(',');
export const csvText = (rows: CsvCell[][]) => '﻿' + rows.map(csvRow).join('\r\n') + '\r\n'; // BOM so that Excel reads UTF-8
// Time response: t, r, y, u (and y, u of each value of the parameter sweep)
// plant: the output of the plant alone (open loop) when it is shown, empty where it stopped (diverged)
export function timeCSV(sim: SimResult, sweep: SweepRun[] | null, plant: number[] | null = null): string {
  const sw = (sweep || []).filter(r => r.sim.T.length === sim.T.length),
    p = S.sweep.p,
    nm = (v: number) => `${paramSym(p)}=${numStr(v)}`;
  const head = [
    't',
    'r',
    'y',
    'u',
    ...sw.map(r => `y (${nm(r.v)})`),
    ...sw.map(r => `u (${nm(r.v)})`),
    ...(plant ? ['y (plant alone)'] : []),
  ];
  const rows: CsvCell[][] = [head];
  for (let i = 0; i < sim.T.length; i++)
    rows.push([
      sim.T[i],
      sim.R[i],
      sim.Y[i],
      sim.U[i],
      ...sw.map(r => r.sim.Y[i]),
      ...sw.map(r => r.sim.U[i]),
      ...(plant ? [i < plant.length ? plant[i] : ''] : []),
    ]);
  return csvText(rows);
}
// The plant alone (shown alone): time, its input (the signal set as the reference) and its output
export function plantCSV(t: number[], y: number[]): string {
  const rows: CsvCell[][] = [['t', 'u', 'y']];
  t.forEach((v, i) => rows.push([v, refValue(v), y[i]]));
  return csvText(rows);
}
// Frequency response: gains [dB] and phases [deg] of L, P, C, S, T, Gyd, Gyr
export function freqCSV(fr: FreqResult): string {
  const sets: [string, { mag: number[]; ph: number[] }][] = [
    ['L', { mag: fr.mag, ph: fr.ph }],
    ['P', fr.P],
    ['C', fr.C],
    ['S', fr.S],
    ['T', fr.T],
    ['Gyd', fr.D],
    ['Gyr', fr.Gyr],
  ];
  const rows: CsvCell[][] = [['omega [rad/s]', ...sets.flatMap(([n]) => [`|${n}| [dB]`, `arg ${n} [deg]`])]];
  for (let i = 0; i < fr.W.length; i++) rows.push([fr.W[i], ...sets.flatMap(([, s]) => [s.mag[i], s.ph[i]])]);
  return csvText(rows);
}
// Nyquist plot: real and imaginary parts of L(jω)
export function nyqCSV(fr: FreqResult): string {
  const rows: CsvCell[][] = [['omega [rad/s]', 'Re L', 'Im L']];
  for (let i = 0; i < fr.W.length; i++) rows.push([fr.W[i], fr.Lc[i][0], fr.Lc[i][1]]);
  return csvText(rows);
}
// Nichols chart: frequency, phase and gain of L
export function nichCSV(fr: FreqResult): string {
  const rows: CsvCell[][] = [['omega [rad/s]', 'phase L [deg]', 'gain L [dB]']];
  for (let i = 0; i < fr.W.length; i++) rows.push([fr.W[i], fr.ph[i], fr.mag[i]]);
  return csvText(rows);
}
// Poles and zeros: kind, real part, imaginary part, damping ratio, natural frequency
export function pzCSV(pz: PZResult): string {
  const rows: CsvCell[][] = [['kind', 'Re', 'Im', 'zeta', 'omega_n [rad/s]']];
  (
    [
      ['plant pole', pz.pp],
      ['plant zero', pz.pz],
      ['controller pole', pz.cp],
      ['controller zero', pz.cz],
      ['closed-loop pole', pz.cl],
    ] as [string, Complex[]][]
  ).forEach(([k, list]) =>
    list.forEach(z => {
      const w = Math.hypot(z[0], z[1]);
      rows.push([k, z[0], z[1], w > 1e-12 ? -z[0] / w : '', w]);
    }),
  );
  if (pz.pade) rows.push(['note: dead time is approximated by a 3rd-order Pade approximation', '', '', '', '']);
  return csvText(rows);
}
/** The CSV file of a panel: its text and file name, or null when there is nothing to save yet */
type CsvFile = { text: string; name: string } | null;
// The CSV file behind each button data-csv="KEY" in the title of a panel (a new plot with data to save gets an entry
// here and such a button; tests/kinds.test.ts checks that they match)
export const CSV_EXPORTS: Record<string, () => CsvFile> = {
  time: () => {
    if (!lastSim) return null;
    if ($('timePlantOnly').checked) {
      const s = plantAlone()[0];
      return { text: plantCSV(s.x, s.y), name: 'plant_response.csv' };
    }
    return { text: timeCSV(lastSim, lastSweep, plantAlone()[0]?.y ?? null), name: 'time_response.csv' };
  },
  bode: () => lastFr && { text: freqCSV(lastFrB || lastFr), name: 'frequency_response.csv' },
  nyq: () => lastFr && { text: nyqCSV(lastFr), name: 'nyquist.csv' },
  nich: () => lastFr && { text: nichCSV(lastFr), name: 'nichols.csv' },
  pz: () => lastPZ && { text: pzCSV(lastPZ), name: 'poles_zeros.csv' },
};
export async function exportCSV(kind: string) {
  const f = CSV_EXPORTS[kind]?.();
  if (!f) return;
  const { text, name } = f;
  const r = await saveFile(name, text, 'text/csv');
  if (r === 'saved') toast(T('Saved as "{f}" (usually in the Downloads folder)', { f: name }));
  else if (r === 'unavailable') {
    const ok = await copyText(text.replace(/^﻿/, ''));
    toast(
      ok
        ? T('This page cannot save files. The data was copied to the clipboard instead; paste it into a spreadsheet.')
        : T('Could not save the file here.'),
      !ok,
    );
  }
}
document
  .querySelectorAll<HTMLElement>('[data-csv]')
  .forEach(b => b.addEventListener('click', () => exportCSV(b.dataset.csv!))); // selected by [data-csv]
