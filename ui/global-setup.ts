// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
// Build index.html from src/ before the browser tests, so that any way of starting them tests the current sources
import fs from 'node:fs';
import path from 'node:path';
import { build } from '../scripts/build.ts';

export default () => {
  const out = path.join(import.meta.dirname, '..', 'index.html'),
    { html } = build();
  if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== html) fs.writeFileSync(out, html);
};
