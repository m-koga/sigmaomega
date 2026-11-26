// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Free arrangement of the plot panels (23-tiles.ts): reading stored arrangements, starting from a preset layout,
// and moving a panel by dragging or with the arrow keys
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, plain } from './harness.ts';

const a = fresh();
const ALL = new Set(['diag', 'time', 'tf', 'bode', 'nyq', 'pz']);
const cols = (t: Tiles) => plain(t.cols.map(c => c.panels));

test('stored arrangements: every panel once, missing panels added, garbage ignored', () => {
  assert.equal(a.normTiles(null), null);
  assert.equal(a.normTiles({ cols: 'x' }), null);
  assert.equal(a.normTiles({ cols: [{ w: 1, panels: ['nope'] }] }), null);
  const t = a.normTiles({
    cols: [
      { w: 2, panels: ['nyq', 'time', 'nyq', 'bogus', 3] },
      { w: -1, panels: ['bode'] },
      { w: 1, panels: [] },
    ],
  });
  assert.ok(t);
  // missing: the block diagram on top of the first column; tf, loop, poles and pz each to the column with the
  // fewest panels
  assert.deepEqual(cols(t), [
    ['diag', 'nyq', 'time', 'poles', 'pz'],
    ['bode', 'tf', 'loop', 'routh'],
  ]);
  assert.deepEqual(plain(t.cols.map(c => c.w)), [2, 1]); // a width that is not positive becomes 1
  const many = a.normTiles({ cols: ['time', 'bode', 'nyq', 'pz', 'time'].map(k => ({ w: 1, panels: [k] })) });
  assert.equal(many?.cols.length, a.MAX_COLS);
});

test('preset layouts: the shown panels row by row; hidden panels in the column with the fewest', () => {
  // the block diagram (across the whole width in the preset) on top of the first column, the others row by row
  assert.deepEqual(cols(a.tilesFromPreset('2', ['diag', 'time', 'tf', 'bode', 'nyq', 'pz'])), [
    ['diag', 'time', 'bode', 'pz', 'routh'],
    ['tf', 'nyq', 'loop', 'poles'],
  ]);
  assert.deepEqual(cols(a.tilesFromPreset('2', ['time', 'tf', 'bode', 'nyq', 'pz'])), [
    ['time', 'bode', 'pz', 'loop', 'routh'],
    ['tf', 'nyq', 'diag', 'poles'],
  ]);
  assert.deepEqual(cols(a.tilesFromPreset('1', ['bode', 'time'])), [
    ['time', 'bode', 'diag', 'tf', 'loop', 'poles', 'routh', 'nyq', 'pz'],
  ]);
  assert.deepEqual(cols(a.tilesFromPreset('row', ['time', 'nyq', 'pz'])), [
    ['time', 'diag', 'poles'],
    ['nyq', 'tf', 'routh'],
    ['pz', 'loop', 'bode'],
  ]);
  assert.deepEqual(cols(a.tilesFromPreset('2', ['time'])), [
    ['time', 'diag', 'tf', 'loop', 'poles', 'routh', 'bode', 'nyq', 'pz'],
  ]);
  // the panels shown at first: the block diagram above the time response on the left, the transfer functions on
  // the right (the hidden panels shared between the columns)
  assert.deepEqual(cols(a.tilesFromPreset('2', a.DEFAULT_PANELS)), [
    ['diag', 'time', 'poles', 'bode', 'pz'],
    ['tf', 'loop', 'routh', 'nyq'],
  ]);
});

test('moving a panel: within a column, to another column, into a new column', () => {
  const t: Tiles = {
    cols: [
      { w: 1, panels: ['time', 'nyq'] },
      { w: 3, panels: ['bode', 'pz'] },
    ],
  };
  assert.deepEqual(cols(a.moveTile(t, 'nyq', { col: 0, index: 0 }, ALL)), [
    ['nyq', 'time'],
    ['bode', 'pz'],
  ]);
  assert.deepEqual(cols(a.moveTile(t, 'time', { col: 1, index: 1 }, ALL)), [['nyq'], ['bode', 'time', 'pz']]);
  assert.deepEqual(cols(a.moveTile(t, 'time', { col: 1, index: 2 }, ALL)), [['nyq'], ['bode', 'pz', 'time']]);
  const n = a.moveTile(t, 'pz', { newCol: 2 }, ALL);
  assert.deepEqual(cols(n), [['time', 'nyq'], ['bode'], ['pz']]);
  assert.equal(n.cols[2].w, 2); // the average width of the shown columns
  // a column left empty disappears
  assert.deepEqual(cols(a.moveTile(n, 'pz', { col: 0, index: 1 }, ALL)), [['time', 'pz', 'nyq'], ['bode']]);
  // the original is not changed
  assert.deepEqual(cols(t), [
    ['time', 'nyq'],
    ['bode', 'pz'],
  ]);
});

test('moving a panel counts only the shown panels; hidden panels keep their place', () => {
  const t: Tiles = {
      cols: [
        { w: 1, panels: ['time', 'nyq', 'bode'] },
        { w: 1, panels: ['pz'] },
      ],
    },
    shown = new Set(['time', 'bode', 'pz']); // nyq is hidden
  // before the 2nd shown panel (bode): after the hidden nyq is fine, it stays between
  assert.deepEqual(cols(a.moveTile(t, 'pz', { col: 0, index: 1 }, shown)), [['time', 'nyq', 'pz', 'bode']]);
  // at the end: after the last shown panel
  assert.deepEqual(cols(a.moveTile(t, 'time', { col: 1, index: 1 }, shown)), [
    ['nyq', 'bode'],
    ['pz', 'time'],
  ]);
});

test('no more than the maximum number of columns', () => {
  const t: Tiles = { cols: ['time', 'bode', 'nyq'].map(k => ({ w: 1, panels: [k] })) };
  t.cols[0].panels.push('pz');
  assert.equal(t.cols.length + 1, a.MAX_COLS);
  const full = a.moveTile(t, 'pz', { newCol: 3 }, ALL);
  assert.equal(full.cols.length, a.MAX_COLS);
  // a panel alone in its column may still move into a new column: the number stays the same
  assert.equal(a.moveTile(full, 'time', { newCol: 4 }, ALL).cols.length, a.MAX_COLS);
});

test('arrow keys: one step up, down, to the next column, and a new column at the edge', () => {
  const t: Tiles = {
      cols: [
        { w: 1, panels: ['time', 'nyq'] },
        { w: 1, panels: ['bode'] },
      ],
    },
    step = (k: string, dir: 'up' | 'down' | 'left' | 'right') => {
      const to = a.stepTile(t, k, dir, ALL);
      return to ? cols(a.moveTile(t, k, to, ALL)) : null;
    };
  assert.equal(step('time', 'up'), null);
  assert.deepEqual(step('time', 'down'), [['nyq', 'time'], ['bode']]);
  assert.deepEqual(step('nyq', 'up'), [['nyq', 'time'], ['bode']]);
  assert.equal(step('nyq', 'down'), null);
  assert.deepEqual(step('nyq', 'right'), [['time'], ['bode', 'nyq']]);
  assert.deepEqual(step('bode', 'left'), [['bode', 'time', 'nyq']]);
  assert.deepEqual(step('time', 'left'), [['time'], ['nyq'], ['bode']]); // shares its column: a new one
  assert.equal(step('bode', 'right'), null); // alone in its column at the edge
});

test('scenario layouts keep a valid free arrangement and drop a broken one', () => {
  const L = a.scLayout({
    pcols: 'free',
    tiles: {
      cols: [
        { w: 1, panels: ['pz'] },
        { w: 2, panels: ['time'] },
      ],
    },
  });
  assert.equal(L.pcols, 'free');
  assert.ok(L.tiles);
  assert.deepEqual(cols(L.tiles), [
    ['diag', 'pz', 'loop', 'routh', 'nyq'],
    ['time', 'tf', 'poles', 'bode'],
  ]); // missing panels fill the column with the fewest (the block diagram on top of the first)
  assert.equal(a.scLayout({ pcols: 'free', tiles: 'broken' }).tiles, null);
  assert.equal(a.scLayout({ pcols: 'grid9' }).pcols, null);
  // the tab of the time response area
  assert.deepEqual(plain(a.scLayout({ itabs: { tinfo: 'tsim', pinfo: 'pztable', binfo: 'bogus', x: 'y' } }).itabs), {
    tinfo: 'tsim',
    pinfo: 'pztable',
  });
  // the setting of version 1.50
  assert.deepEqual(plain(a.scLayout({ ttab: 'tsim' }).itabs), { tinfo: 'tsim' });
});

test('panel height: all plots scale by the same ratio, stopped by the first plot to reach its limit', () => {
  const plots = [
    { id: 'cvY', min: 120, max: 1200 },
    { id: 'cvU', min: 80, max: 900 },
  ];
  // 300 + 150 = 450 grows by 225: ratio 1.5
  assert.equal(a.scaleRatio([300, 150], plots, 225), 1.5);
  // shrinking: cvU reaches 80 first (ratio 80/150), cvY stops with it
  assert.equal(a.scaleRatio([300, 150], plots, -1000), 80 / 150);
  // growing: cvY reaches 1200 first (ratio 4)
  assert.equal(a.scaleRatio([300, 150], plots, 5000), 4);
  assert.equal(a.scaleRatio([], [], 100), 1, 'no plots: nothing changes');
});
