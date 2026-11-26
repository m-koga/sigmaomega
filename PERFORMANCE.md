# Time efficiency of SigmaOmega

English | [日本語](PERFORMANCE.ja.md)

SigmaOmega computes everything in your browser, again after every change. This document states how long that takes, how this was measured and where the limits lie, so that you know what to expect on your computer or phone. It describes version 1.75.0. Every table under [Results](#results) is printed by `npm run performance` (`scripts/performance.ts`), and `tests/performance.test.ts` checks on every change that the heaviest computations stay fast.

## Summary

| What you do | How long it takes (this computer / processor 4× slower) | Judged against the guidelines below |
| --- | --- | --- |
| Open the page | Plots drawn and usable after 0.24 s / 0.78 s, formulas after 0.39 s / 1.4 s, plus the download (about 0.4 MB for the page, 0.7 MB for the formulas, compressed) | Fast; on a slow mobile connection the download takes a few seconds on the first visit |
| Move a slider or type a value | Everything computed and drawn again in 4–19 ms with the panels of a first visit, 22–43 ms with every panel / 0.1–0.2 s | Feels immediate (under 0.1 s) on this computer; about at the limit of a "good" response (0.2 s) on the slower processor |
| Drag a slider | The plots follow about 20–50 times a second / 6–11 times a second | Smooth enough to follow on this computer; jerky but usable on the slower processor |
| Use a parameter sweep of 8 values | 61–204 ms / 0.3–1.0 s per change | Noticeable with the heaviest settings, especially on a slow device |

The work done for one change has an upper limit whatever the settings (see [What is computed](#what-is-computed-and-its-upper-limits)), so the page never stalls for long. What to keep in mind is in [Limits](#limits-and-what-to-keep-in-mind).

In this version, a change with the pole-zero map shown became 2 to 60 times faster; see [Improvement in version 1.75.0](#improvement-in-version-1750).

## What is computed and its upper limits

- **Nothing is sent to a server.** The page computes in the browser; after it has loaded, no network is needed (see section 9 of the user manual for what the page loads).
- **After every change** (a slider, a typed value, a menu), `update()` computes everything once and draws the panels that are shown. Changing only the view (zoom, size, panels) draws again without computing.
- **Simulation**: 4000 recorded points, with 1 to 100 time steps between two of them (chosen from the fastest dynamics of the loop; see [ACCURACY.md](ACCURACY.md)). At most 400,000 steps.
- **Frequency response**: 150 frequencies per decade, at most 2400.
- **Poles and zeros**: the roots of the characteristic polynomial, after every change (the specifications use them). The root locus at 642 values of the gain factor *k* and the stable ranges of *k* are computed only while the pole-zero map is shown.
- **Parameter sweep**: at most 8 values, each a full simulation and frequency response.
- **Formulas**: typeset by MathJax a moment after the last change, so they never hold up the plots.

## How it was measured

| | |
| --- | --- |
| Computer | A cloud server: Intel Xeon at 2.1 GHz, 2 cores (about an ordinary laptop) |
| Browser | Chrome 153 (headless, through Playwright) |
| Slower processor | The same, with Chrome's CPU throttling at 4×: the setting Lighthouse uses to turn a fast desktop into a mid-range phone ([Lighthouse: throttling](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)). Since this computer is not a fast desktop, this is a conservative stand-in for a phone |
| Network | Left out: MathJax was served from the computer itself and the web fonts were not loaded. The download is estimated from the file sizes |
| Settings | The start-up settings, the four exercises of the manual, an eighth-order plant, the settings with the most time steps (PID with *N* = 100 over 200 s), and parameter sweeps of 8 values |
| Panels | Every panel shown (block diagram, time response, formulas, Bode plot, Nyquist plot, pole-zero map with the root locus), unless the table says otherwise: the heaviest case |
| Times | Median of repeated runs, measured in the page with `performance.now()`; the slider was dragged with the mouse, and each input event was timed from the event to the next frame of the screen |

The guidelines used to judge the results are Google's [RAIL model](https://web.dev/articles/rail) and [Interaction to Next Paint (INP)](https://web.dev/articles/inp):

- A response within 100 ms feels immediate; for that, an input should be handled within 50 ms.
- An animation, such as following a drag, is smooth at 60 frames a second, which leaves a page about 10 ms per frame.
- An interaction that shows its result within 200 ms is "good"; more than 500 ms is "poor".

## Results

Measured on 2026-11-26: Intel(R) Xeon(R) Processor @ 2.10GHz, 2 cores; Chrome 153.0.8010.12 (headless); Node.js v22.23.5.

### Download size

| File | Size | Compressed (gzip) | From |
|---|---|---|---|
| The page (index.html, with the manual's pictures) | 860 KB | 373 KB | the site |
| MathJax (tex-svg.js, for the formulas) | 2059 KB | 659 KB | cdn.jsdelivr.net |

At 10 Mbit/s this is about 0.3 s for the page and 0.5 s more for MathJax; on a slow mobile connection (1.6 Mbit/s, Lighthouse's mobile setting) about 2 s and 3.3 s. MathJax loads in the background: the plots do not wait for it. The browser keeps both, so later visits do not download them again.

### Start-up (without the network)

| | This computer | Processor 4× slower |
|---|---|---|
| First paint | 268 ms | 320 ms |
| Ready: plots drawn, inputs usable | 243 ms | 780 ms |
| Formulas typeset (MathJax) | 389 ms | 1445 ms |

(The first paint comes just after the page is ready: the script draws the plots before the browser shows the page.)

### Computing and drawing, by part (this computer)

Every panel shown. Median of repeated runs, in ms; "substeps": the time steps of the simulation (4000 recorded points × substeps between them).

| Settings | Substeps | Simulation | Frequency response | Poles | Root locus | Sweep | Drawing | All (update) | All, slowest run |
|---|---|---|---|---|---|---|---|---|---|
| Start-up settings (first-order lag, PID) | 20000 | 1.8 | 1.5 | 0.0 | 2.6 | — | 9.8 | 26 | 49 |
| Exercise 1 (third-order lag, PID) | 32000 | 1.8 | 1.6 | 0.1 | 5.8 | — | 10 | 22 | 34 |
| Exercise 2 (dead time, PI) | 4000 | 0.4 | 1.2 | 0.0 | 4.9 | — | 8.2 | 24 | 43 |
| Eighth-order plant 1/(s+1)^8, PID | 20000 | 2.7 | 2.4 | 2.6 | 24 | — | 8.9 | 43 | 50 |
| Most time steps (PID, N = 100, 200 s) | 400000 | 16 | 1.9 | 0.0 | 3.1 | — | 9.8 | 30 | 43 |
| Exercise 1 with a sweep of 8 values | 32000 | 1.9 | 2.2 | 0.1 | 6.5 | 47 | 15 | 81 | 106 |
| Most time steps with a sweep of 8 values | 400000 | 17 | 2.0 | 0.0 | 3.1 | 177 | 15 | 204 | 247 |

"All" is more than the sum of the parts: it also updates the inputs, the specifications and the tables.

### Computing and drawing everything again (update), by the panels shown (this computer)

| Settings | Panels of a first visit (block diagram, time response, formulas) | Every panel (with the pole-zero map and its root locus) |
|---|---|---|
| Start-up settings (first-order lag, PID) | 4.6 ms | 26 ms |
| Exercise 1 (third-order lag, PID) | 5.5 ms | 22 ms |
| Exercise 2 (dead time, PI) | 3.6 ms | 24 ms |
| Eighth-order plant 1/(s+1)^8, PID | 7.6 ms | 43 ms |
| Most time steps (PID, N = 100, 200 s) | 19 ms | 30 ms |
| Exercise 1 with a sweep of 8 values | 61 ms | 81 ms |
| Most time steps with a sweep of 8 values | 196 ms | 204 ms |

### Computing and drawing everything again (update), this computer and 4× slower

| Settings | This computer | Processor 4× slower |
|---|---|---|
| Start-up settings (first-order lag, PID) | 26 ms | 117 ms |
| Exercise 1 (third-order lag, PID) | 22 ms | 110 ms |
| Exercise 2 (dead time, PI) | 24 ms | 117 ms |
| Eighth-order plant 1/(s+1)^8, PID | 43 ms | 219 ms |
| Most time steps (PID, N = 100, 200 s) | 30 ms | 169 ms |
| Exercise 1 with a sweep of 8 values | 81 ms | 325 ms |
| Most time steps with a sweep of 8 values | 204 ms | 976 ms |

### Dragging the K_P slider with the mouse

40 mouse moves across the slider; every move computes and draws everything again. Handling: the time the page takes for one input event; to the next frame: from the event to the next frame of the screen, in which the result is shown. Median / slowest, in ms.

| Settings | Processor | Events | Handling | To the next frame |
|---|---|---|---|---|
| Start-up settings (first-order lag, PID) | this computer | 41 | 21 / 39 | 21 / 50 |
| Start-up settings (first-order lag, PID) | 4× slower | 41 | 88 / 164 | 88 / 201 |
| Exercise 1 (third-order lag, PID) | this computer | 41 | 25 / 46 | 26 / 56 |
| Exercise 1 (third-order lag, PID) | 4× slower | 41 | 112 / 190 | 112 / 234 |
| Most time steps (PID, N = 100, 200 s) | this computer | 41 | 38 / 73 | 38 / 75 |
| Most time steps (PID, N = 100, 200 s) | 4× slower | 41 | 157 / 238 | 157 / 240 |
| Exercise 1 with a sweep of 8 values | this computer | 41 | 74 / 153 | 75 / 155 |
| Exercise 1 with a sweep of 8 values | 4× slower | 41 | 316 / 431 | 316 / 432 |

## What the results mean

- **Opening the page.** On this computer the plots are ready in a quarter of a second, and in under a second on the slower processor; the formulas follow. On a first visit over a slow connection, the download comes first.
- **Changing a value.** With the panels shown at a first visit, a change takes 4–19 ms even with the most time steps. With every panel, including the pole-zero map, it takes 22–43 ms: well under the 100 ms that feels immediate. On the slower processor it takes 0.1–0.2 s, about the 200 ms of a "good" response.
- **Dragging a slider.** Every position of the slider computes everything, so the plots follow the drag at 20–50 updates a second on this computer and at about 6–11 on the slower processor. That is less than the 60 frames of a perfectly smooth animation, but each step shows a complete result, computed as accurately as after a single change.
- **Parameter sweep.** Eight full computations per change: 0.06–0.2 s on this computer; up to about 1 s on the slower processor with the heaviest settings.

## Improvement in version 1.75.0

The measurements for this document showed that the pole-zero map made every change slow: the roots of the characteristic polynomial were found by an iteration that stopped when its step was below 10⁻¹³. Large roots, such as those of the root locus at high gain (about 6×10⁴), cannot be computed to that absolute precision in double-precision arithmetic, and repeated roots move by more than their rounding error, so the iteration ran its full 2000 steps. It now stops when the step is below 10⁻¹³ relative to the size of the root, or when the polynomial at every root is as small as its rounding error allows; the stable ranges of *k* reuse the roots of the root locus. The results are the same (the numerical-accuracy tests pass and every plot is pixel-identical); the time is not:

| Settings (every panel shown) | 1.74.0 | 1.75.0 | 1.74.0, 4× slower | 1.75.0, 4× slower |
|---|---|---|---|---|
| Start-up settings (first-order lag, PID) | 223 ms | 26 ms | 1754 ms | 117 ms |
| Exercise 1 (third-order lag, PID) | 44 ms | 22 ms | 234 ms | 110 ms |
| Exercise 2 (dead time, PI) | 59 ms | 24 ms | 319 ms | 117 ms |
| Eighth-order plant 1/(s+1)^8, PID | 2630 ms | 43 ms | 19403 ms | 219 ms |
| Most time steps (PID, N = 100, 200 s) | 530 ms | 30 ms | 3450 ms | 169 ms |
| Most time steps with a sweep of 8 values | 783 ms | 204 ms | 3884 ms | 976 ms |

## Limits and what to keep in mind

- **Your device is not this computer.** Phones and older laptops can be slower than the 4× slowdown, and a browser running other heavy pages has less time to spare. The times scale roughly in proportion.
- **The parameter sweep is the heaviest part.** With the most time steps it takes about 1 s per change on the slower processor. Turn the sweep off while you drag sliders, and on when you want to compare.
- **Hide what you do not need.** The pole-zero map with its root locus, and the Bode and Nyquist plots, add to every change; hiding them makes changes faster.
- **Formulas.** MathJax typesets the formulas after the plots; on a slow device they appear about a second later. The first visit downloads MathJax (0.7 MB compressed) from cdn.jsdelivr.net; without that connection the page works, but the formulas are shown as their TeX source.
- **Web fonts** (Noto Sans) were not measured. They load in the background; until then the text is shown in a font of the system.
- **Other browsers.** The measurements were made in Chrome; Firefox and Safari run the same script but were not measured.

## Reproducing the measurements

```
npm ci
npm run build
npm run performance                    # prints the tables above (about 8 minutes)
node --test tests/performance.test.ts  # checks that the heaviest computations stay fast
```

`scripts/performance.ts` uses `CHROME_PATH`, or `/usr/bin/google-chrome`, or Playwright's own Chromium. The times depend on the computer: compare the ratios rather than the milliseconds.
