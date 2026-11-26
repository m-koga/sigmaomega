// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Arrangement of the plot panels in rows: stored data, presets as a starting point, moves, arrow keys
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, plain } from './harness.ts';

const a = fresh();
const rows = (t: RowTiles) => plain(t.rows.map(r => r.panels));
const ALL = new Set(['diag', 'time', 'tf', 'bode', 'nyq', 'pz']);
const T3: RowTiles = {
  rows: [
    { panels: ['diag'], w: [1] },
    { panels: ['time', 'tf'], w: [2, 1] },
    { panels: ['bode', 'nyq', 'pz'], w: [1, 1, 1] },
  ],
};

test('stored rows: every panel once, missing panels added, widths checked, garbage ignored', () => {
  const t = a.normRows({
    rows: [
      { panels: ['time', 'bogus', 'time', 7, 'tf'], w: [2, 9, 9, 9, -1] },
      { panels: [] },
      'x',
      { panels: ['bode'], w: 'no' },
    ],
  })!;
  // the block diagram (missing) in a row of its own on top; the other missing panels together in new rows at the
  // bottom (at most four to a row)
  assert.deepEqual(rows(t), [['diag'], ['time', 'tf'], ['bode'], ['loop', 'poles', 'routh', 'nyq'], ['pz']]);
  // widths kept with their panels; invalid ones become 1
  assert.deepEqual(plain(t.rows[1].w), [2, 1]);
  assert.deepEqual(plain(t.rows[3].w), [1, 1, 1, 1]);
  assert.equal(a.normRows(null), null);
  assert.equal(a.normRows({ rows: [{ panels: ['bogus'] }] }), null);
});

test('rows from the preset layouts: the block diagram alone on top, then n panels to a row', () => {
  assert.deepEqual(rows(a.rowsFromPreset('2', ['diag', 'time', 'tf', 'bode', 'nyq', 'pz'])), [
    ['diag'],
    ['time', 'tf'],
    ['bode', 'nyq'],
    ['pz'],
    ['loop', 'poles', 'routh'],
  ]);
  // the hidden panels together in rows at the bottom (at most four to a row), the plots before the panels of
  // formulas, poles and the Routh–Hurwitz test
  assert.deepEqual(rows(a.rowsFromPreset('1', ['time', 'bode'])), [
    ['time'],
    ['bode'],
    ['diag', 'nyq', 'pz', 'tf'],
    ['loop', 'poles', 'routh'],
  ]);
  assert.deepEqual(rows(a.rowsFromPreset('row', ['diag', 'time', 'bode', 'nyq'])), [
    ['diag'],
    ['time', 'bode', 'nyq'],
    ['pz', 'tf', 'loop', 'poles'],
    ['routh'],
  ]);
  assert.deepEqual(rows(a.rowsFromPreset('2', ['time'])), [
    ['time'],
    ['diag', 'bode', 'nyq', 'pz'],
    ['tf', 'loop', 'poles', 'routh'],
  ]);
  // the panels shown at first: the block diagram, the time response beside the transfer functions, and the other
  // panels, hidden, in rows of at most four: the three plots together first
  assert.deepEqual(rows(a.rowsFromPreset('2', a.DEFAULT_PANELS)), [
    ['diag'],
    ['time', 'tf'],
    ['bode', 'nyq', 'pz', 'loop'],
    ['poles', 'routh'],
  ]);
  // every panel once, widths 1
  const t = a.rowsFromPreset('2', ['time', 'nyq']);
  assert.deepEqual(plain(t.rows.flatMap(r => r.panels)).sort(), [...a.PANELS].sort());
  assert.ok(t.rows.every(r => r.w.length === r.panels.length && r.w.every(w => w === 1)));
});

test('moving a panel within a row, into another row and into a new row', () => {
  // into the row of the time response, between it and the transfer functions
  let t = a.moveRowTile(T3, 'pz', { row: 1, index: 1 }, ALL);
  assert.deepEqual(rows(t), [['diag'], ['time', 'pz', 'tf'], ['bode', 'nyq']]);
  // its width: the average of the shown panels of its new row (2 and 1)
  assert.deepEqual(plain(t.rows[1].w), [2, 1.5, 1]);
  // the block diagram beside the time response: its row disappears
  t = a.moveRowTile(T3, 'diag', { row: 1, index: 0 }, ALL);
  assert.deepEqual(rows(t), [
    ['diag', 'time', 'tf'],
    ['bode', 'nyq', 'pz'],
  ]);
  // into a new row at the bottom and on top
  assert.deepEqual(rows(a.moveRowTile(T3, 'tf', { newRow: 3 }, ALL)), [
    ['diag'],
    ['time'],
    ['bode', 'nyq', 'pz'],
    ['tf'],
  ]);
  assert.deepEqual(rows(a.moveRowTile(T3, 'nyq', { newRow: 0 }, ALL)), [
    ['nyq'],
    ['diag'],
    ['time', 'tf'],
    ['bode', 'pz'],
  ]);
  // at the end of a row; within its own row
  assert.deepEqual(rows(a.moveRowTile(T3, 'diag', { row: 2, index: 3 }, ALL)), [
    ['time', 'tf'],
    ['bode', 'nyq', 'pz', 'diag'],
  ]);
  assert.deepEqual(rows(a.moveRowTile(T3, 'bode', { row: 2, index: 2 }, ALL)), [
    ['diag'],
    ['time', 'tf'],
    ['nyq', 'pz', 'bode'],
  ]);
  // a full row (four shown) takes no more
  const full = a.moveRowTile(T3, 'diag', { row: 2, index: 0 }, ALL);
  assert.deepEqual(rows(a.moveRowTile(full, 'time', { row: 1, index: 0 }, ALL)), rows(full));
  // hidden panels keep their place and do not count
  const shown = new Set(['diag', 'time', 'bode']);
  assert.deepEqual(rows(a.moveRowTile(T3, 'bode', { row: 1, index: 1 }, shown)), [
    ['diag'],
    ['time', 'bode', 'tf'],
    ['nyq', 'pz'],
  ]);
});

test('a row showing more than four panels is split: the panels beyond go into a new row below', () => {
  const t: RowTiles = {
    rows: [
      { panels: ['diag'], w: [1] },
      { panels: ['time', 'tf', 'bode', 'nyq', 'pz'], w: [5, 4, 3, 2, 1] },
    ],
  };
  const s = a.splitFullRows(t, ALL);
  assert.deepEqual(rows(s), [['diag'], ['time', 'tf', 'bode', 'nyq'], ['pz']]);
  assert.deepEqual(plain(s.rows[2].w), [1]);
  // hidden panels do not count, and stay where they are
  assert.equal(a.splitFullRows(t, new Set(['time', 'tf', 'bode', 'pz'])), t);
  assert.deepEqual(rows(a.splitFullRows(t, new Set(['diag', 'time', 'tf', 'bode', 'nyq']))), rows(t));
});

test('the arrow keys move a panel one step in the rows', () => {
  const step = (k: string, d: 'up' | 'down' | 'left' | 'right', s = ALL) => plain(a.stepRowTile(T3, k, d, s));
  // within a row
  assert.deepEqual(step('nyq', 'left'), { row: 2, index: 0 });
  assert.deepEqual(step('nyq', 'right'), { row: 2, index: 2 });
  assert.equal(step('bode', 'left'), null);
  assert.equal(step('pz', 'right'), null);
  // into the neighbouring row at the same place
  assert.deepEqual(step('tf', 'down'), { row: 2, index: 1 });
  assert.deepEqual(step('pz', 'up'), { row: 1, index: 2 });
  assert.deepEqual(step('time', 'up'), { row: 0, index: 0 });
  // alone in the top row: no further up; sharing the bottom row: a new row below
  assert.equal(step('diag', 'up'), null);
  assert.deepEqual(step('bode', 'down'), { newRow: 3 });
  // hidden panels are skipped: tf hidden, time alone in its row
  assert.deepEqual(step('time', 'down', new Set(['diag', 'time', 'bode'])), { row: 2, index: 0 });
  // a full row takes no more
  const full = a.moveRowTile(T3, 'diag', { row: 2, index: 0 }, ALL);
  assert.equal(plain(a.stepRowTile(full, 'time', 'down', ALL)), null);
  // the result of a step is a valid move
  const d = a.stepRowTile(T3, 'tf', 'down', ALL)!;
  assert.deepEqual(rows(a.moveRowTile(T3, 'tf', d, ALL)), [['diag'], ['time'], ['bode', 'tf', 'nyq', 'pz']]);
});

test('scenario layouts keep a valid arrangement in rows and the layout "rows"', () => {
  const L = a.scLayout({ pcols: 'rows', rows: { rows: [{ panels: ['pz', 'time'], w: [1, 3] }] } });
  assert.equal(L.pcols, 'rows');
  assert.deepEqual(rows(L.rows!), [['diag'], ['pz', 'time'], ['tf', 'loop', 'poles', 'routh'], ['bode', 'nyq']]);
  assert.equal(a.scLayout({ rows: { rows: 'broken' } }).rows, null);
  assert.equal(a.scLayout(null).rows, null);
});
