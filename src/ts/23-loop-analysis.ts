// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ================= Analyses of the current loop: the root locus, its stable gains, its rules and the Nyquist count, computed once per change ================= */
import { S } from './11-state.ts';
import { LOCUS_KS, rootLocus, stableRanges } from './17-loop.ts';
import { nyquistCount, nyquistPath } from './20-nyquist-criterion.ts';
import type { NyquistCount } from './20-nyquist-criterion.ts';
import { locusRules } from './21-root-locus-rules.ts';
import type { LocusRules } from './21-root-locus-rules.ts';
export let lastLocus: LocusPoint[] | null = null,
  lastRanges: [number, number][] | null = null,
  lastRules: LocusRules | null | undefined,
  lastNyq: NyquistCount | null | undefined,
  lastPath: ReturnType<typeof nyquistPath> | undefined;
// Root locus and stable ranges of k, computed when first needed after each update
export const locus = (): LocusPoint[] => (lastLocus ??= rootLocus(LOCUS_KS));
export const stableKRanges = (): [number, number][] => (lastRanges ??= stableRanges(S, locus()));
// Construction rules of the root locus, computed when first needed after each update
export const rules = (): LocusRules | null => (lastRules === undefined ? (lastRules = locusRules()) : lastRules);
// Counting for the Nyquist criterion, computed when first needed after each update
export const nyqCount = (): NyquistCount | null => (lastNyq === undefined ? (lastNyq = nyquistCount()) : lastNyq);
// The Nyquist contour sampled with its image L(s), computed when first needed after each update (its mapping is shown)
export const nyqPath = () => (lastPath === undefined ? (lastPath = nyquistPath()) : lastPath);
// The root locus is computed again when next needed (the pole specifications changed)
export function resetLocus() {
  lastLocus = null;
}
// The root locus and the stable gain ranges are computed again when next needed (the loop changed)
export function resetLoopCache() {
  lastLocus = null;
  lastRanges = null;
  lastRules = undefined;
  lastNyq = undefined;
  lastPath = undefined;
}
