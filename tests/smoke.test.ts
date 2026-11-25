// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Every plant with every controller: simulation and analyses run and give finite results
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh } from './harness.ts';

test('all plants × all controllers: simulation, frequency response and poles are computed', () => {
  const a = fresh();
  const plants = Object.keys(a.PLANTS),
    modes = ['P', 'PI', 'PD', 'PID', 'lead', 'lag', 'leadlag', 'custom'];
  assert.ok(plants.length >= 7);
  let runs = 0;
  for (const plant of plants)
    for (const mode of modes) {
      a.defaults();
      Object.assign(a.S, { plant, mode });
      const sim = a.simulate();
      assert.ok(sim.T.length > 100, `${plant}/${mode}: samples`);
      if (!sim.diverged)
        assert.ok(sim.Y.every(Number.isFinite) && sim.U.every(Number.isFinite), `${plant}/${mode}: finite output`);
      const fr = a.freqResp();
      assert.ok(fr.W.length > 100 && fr.mag.every(v => !Number.isNaN(v)), `${plant}/${mode}: frequency response`);
      const pz = a.computePZ();
      assert.ok(
        Array.isArray(pz.cl) && pz.cl.every(z => z.every(Number.isFinite)),
        `${plant}/${mode}: closed-loop poles`,
      );
      // a diverging simulation and the pole verdict agree
      if (sim.diverged)
        assert.ok(
          pz.cl.some(z => z[0] >= -1e-9),
          `${plant}/${mode}: diverged but all poles stable`,
        );
      runs++;
    }
  assert.equal(runs, plants.length * modes.length);
});
