// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Build index.html from src/ before the browser tests, so that any way of starting them tests the current sources.
// With COV_DIR set (npm run coverage), the page keeps every character of its script in place, so that the coverage
// can be mapped back to src/ts; scripts/coverage.ts builds the normal page again afterwards.
import fs from 'node:fs';
import path from 'node:path';
import { build } from '../scripts/build.ts';

export default () => {
  const out = path.join(import.meta.dirname, '..', 'index.html'),
    { html } = build({ compact: !process.env.COV_DIR });
  if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== html) fs.writeFileSync(out, html);
};
