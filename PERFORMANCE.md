# Time efficiency of SigmaOmega

English | [日本語](PERFORMANCE.ja.md)

SigmaOmega computes everything in your browser, again after every change. This document states how long that takes, how this was measured and where the limits lie, so that you know what to expect on your computer or phone. It describes version 1.98.2. Every table under [Results](#results) is printed by `npm run performance` (`scripts/performance.ts`), and `tests/performance.test.ts` checks on every change that the heaviest computations stay fast.

## Summary

| What you do | How long it takes (this computer / processor 4× slower) | Judged against the guidelines below |
| --- | --- | --- |
| Open the page | Plots drawn and usable after 0.33 s / 1.3 s, formulas after 0.52 s / 2.3 s, plus the download (about 1.4 MB for the page, 0.7 MB for the formulas, compressed) | Fast on this computer; about a second on the slower processor. On a slow mobile connection the download takes about 7 s (10 s with the formulas) on the first visit |
| Move a slider or type a value | Everything computed and drawn again in 4–23 ms with the panels of a first visit, 31–60 ms with every panel / 0.16–0.28 s | Feels immediate (under 0.1 s) on this computer; about a "good" response (0.2 s) on the slower processor with every panel shown |
| Drag a slider | The plots follow about 20–30 times a second / 5–7 times a second | Smooth enough to follow on this computer; jerky but usable on the slower processor |
| Use a parameter sweep of 8 values | 58–216 ms / 0.4–1.1 s per change | Noticeable with the heaviest settings, especially on a slow device |
| Change the language | 0.15 s / 0.7 s | Good on this computer; noticeable, but done once, on the slower processor |

The work done for one change has an upper limit whatever the settings (see [What is computed](#what-is-computed-and-its-upper-limits)), so the page never stalls for long. What to keep in mind is in [Limits](#limits-and-what-to-keep-in-mind).

Since version 1.75.0, when this document was first written, the page has gained many panels and analyses, eight languages and a manual in each of them: a change with every panel shown takes about 1.2–1.5 times as long, and the start-up about 1.3 times; see [Changes since version 1.75.0](#changes-since-version-1750). Version 1.75.0 itself made a change with the pole-zero map shown 2 to 60 times faster; see [Improvement in version 1.75.0](#improvement-in-version-1750).

## What is computed and its upper limits

- **Nothing is sent to a server.** The page computes in the browser; after it has loaded, no network is needed (see section 9 of the user manual for what the page loads).
- **After every change** (a slider, a typed value, a menu), `update()` computes everything once and draws the panels that are shown. Changing only the view (zoom, size, panels) draws again without computing.
- **Simulation**: 4000 recorded points, with 1 to 100 time steps between two of them (chosen from the fastest dynamics of the loop; see [ACCURACY.md](ACCURACY.md)). At most 400,000 steps.
- **Frequency response**: 150 frequencies per decade, at most 2400.
- **Poles and zeros**: the roots of the characteristic polynomial, after every change (the specifications use them). The root locus at 642 values of the gain factor *k* and the stable ranges of *k* are computed only while the pole-zero map is shown.
- **Analyses of the loop**: the straight-line approximation of the Bode plot, the counting of the Nyquist criterion and the construction rules of the root locus are computed only while they are shown, once per change. The Routh–Hurwitz test and the steady-state error are panels of text and formulas: like the formulas, they are drawn a moment (0.12 s) after the last change, so they never hold up the plots.
- **Parameter sweep**: at most 8 values, each a full simulation and frequency response.
- **Formulas**: typeset by MathJax a moment after the last change, so they never hold up the plots.
- **Language**: changing it writes every text of the page again (menus, cards, tables, the manual if open) and draws the panels again; the dictionaries and manuals of all ten languages are in the page, so nothing is loaded.

## How it was measured

| | |
| --- | --- |
| Computer | A cloud server: Intel Xeon at 2.1 GHz, 2 cores (about an ordinary laptop) |
| Browser | Chrome 153 (headless, through Playwright) |
| Slower processor | The same, with Chrome's CPU throttling at 4×: the setting Lighthouse uses to turn a fast desktop into a mid-range phone ([Lighthouse: throttling](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)). Since this computer is not a fast desktop, this is a conservative stand-in for a phone |
| Network | Left out: MathJax was served from the computer itself and the web fonts were not loaded. The download is estimated from the file sizes |
| Settings | The start-up settings, the four exercises of the manual, an eighth-order plant, the settings with the most time steps (PID with *N* = 100 over 200 s), and parameter sweeps of 8 values |
| Panels | Every panel shown (block diagram, time response, transfer functions, loop transfer functions, poles and zeros, Routh–Hurwitz test, steady-state error, Bode plot, Nichols chart, Nyquist plot, pole-zero map), with every curve and analysis they offer (the Bode plots of *L*, *P*, *C*, *S* and *T* with the straight-line approximation, the Nyquist count and Ms, the root locus with its construction rules, the controller poles and the grid), unless the table says otherwise: the heaviest case |
| Times | Median of repeated runs, measured in the page with `performance.now()`; the slider was dragged with the mouse, and each input event was timed from the event to the next frame of the screen |

The guidelines used to judge the results are Google's [RAIL model](https://web.dev/articles/rail) and [Interaction to Next Paint (INP)](https://web.dev/articles/inp):

- A response within 100 ms feels immediate; for that, an input should be handled within 50 ms.
- An animation, such as following a drag, is smooth at 60 frames a second, which leaves a page about 10 ms per frame.
- An interaction that shows its result within 200 ms is "good"; more than 500 ms is "poor".

## Results

Measured on 2026-11-27: Intel(R) Xeon(R) Processor @ 2.10GHz, 2 cores; Chrome 153.0.8010.12 (headless); Node.js v22.23.5.

### Download size

| File | Size | Compressed (gzip) | From |
|---|---|---|---|
| The page (index.html, with the manual's pictures) | 2737 KB | 1408 KB | the site |
| MathJax (tex-svg.js, for the formulas) | 2059 KB | 659 KB | cdn.jsdelivr.net |

At 10 Mbit/s this is about 1.2 s for the page and 0.5 s more for MathJax; on a slow mobile connection (1.6 Mbit/s, Lighthouse's mobile setting) about 7 s and 3.3 s. MathJax loads in the background: the plots do not wait for it. The browser keeps both, so later visits do not download them again. About two thirds of the page are the screenshots of the manual in its ten languages; they are kept as text the browser does not run and are shown only when the manual is opened.

### Start-up (without the network)

| | This computer | Processor 4× slower |
|---|---|---|
| First paint | 200 ms | 444 ms |
| Ready: plots drawn, inputs usable | 328 ms | 1317 ms |
| Formulas typeset (MathJax) | 515 ms | 2250 ms |

(The browser shows the page for the first time while the script is still building and drawing the panels; the page is ready when they are drawn.)

### Computing and drawing, by part (this computer)

Every panel shown. Median of repeated runs, in ms; "substeps": the time steps of the simulation (4000 recorded points × substeps between them).

| Settings | Substeps | Simulation | Frequency response | Poles | Root locus | Analyses | Sweep | Drawing | All (update) | All, slowest run | Routh and steady-state panels |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Start-up settings (first-order lag, PID) | 20000 | 1.0 | 1.6 | 0.0 | 3.0 | 0.6 | — | 18 | 31 | 94 | 44 |
| Exercise 1 (third-order lag, PID) | 32000 | 1.9 | 1.7 | 0.1 | 6.5 | 1.1 | — | 20 | 33 | 50 | 45 |
| Exercise 2 (dead time, PI) | 4000 | 0.4 | 1.2 | 0.0 | 7.1 | 3.1 | — | 19 | 38 | 50 | 52 |
| Eighth-order plant 1/(s+1)^8, PID | 20000 | 2.7 | 2.5 | 0.5 | 25 | 4.4 | — | 21 | 60 | 70 | 71 |
| Most time steps (PID, N = 100, 200 s) | 400000 | 17 | 1.8 | 0.0 | 2.7 | 0.6 | — | 18 | 46 | 56 | 42 |
| Exercise 1 with a sweep of 8 values | 32000 | 2.0 | 1.8 | 0.0 | 7.2 | 1.1 | 43 | 22 | 87 | 162 | 40 |
| Most time steps with a sweep of 8 values | 400000 | 18 | 1.9 | 0.0 | 2.9 | 0.8 | 159 | 25 | 216 | 227 | 35 |

"Analyses": the straight-line approximation, the Nyquist count and the root-locus rules (part of "All"). "Routh and steady-state panels": these two panels with their formulas, drawn 0.12 s after the last change and not part of "All"; most of their time is MathJax typesetting the formulas in them. "All" is more than the sum of the parts: it also updates the inputs, the specifications and the tables.

### Computing and drawing everything again (update), by the panels shown (this computer)

| Settings | Panels of a first visit (block diagram, time response, formulas) | Every panel (with the pole-zero map and its root locus) |
|---|---|---|
| Start-up settings (first-order lag, PID) | 6.6 ms | 31 ms |
| Exercise 1 (third-order lag, PID) | 6.4 ms | 33 ms |
| Exercise 2 (dead time, PI) | 4.3 ms | 38 ms |
| Eighth-order plant 1/(s+1)^8, PID | 12 ms | 60 ms |
| Most time steps (PID, N = 100, 200 s) | 23 ms | 46 ms |
| Exercise 1 with a sweep of 8 values | 58 ms | 87 ms |
| Most time steps with a sweep of 8 values | 192 ms | 216 ms |

### Computing and drawing everything again (update), this computer and 4× slower

| Settings | This computer | Processor 4× slower |
|---|---|---|
| Start-up settings (first-order lag, PID) | 31 ms | 159 ms |
| Exercise 1 (third-order lag, PID) | 33 ms | 166 ms |
| Exercise 2 (dead time, PI) | 38 ms | 159 ms |
| Eighth-order plant 1/(s+1)^8, PID | 60 ms | 282 ms |
| Most time steps (PID, N = 100, 200 s) | 46 ms | 232 ms |
| Exercise 1 with a sweep of 8 values | 87 ms | 392 ms |
| Most time steps with a sweep of 8 values | 216 ms | 1092 ms |

### Changing the language

Start-up settings, every panel shown; median of 7 changes between English, German, Japanese, Russian, French and Chinese.

| | This computer | Processor 4× slower |
|---|---|---|
| Changing the language | 146 ms | 692 ms |

### Dragging the K_P slider with the mouse

40 mouse moves across the slider; every move computes and draws everything again. Handling: the time the page takes for one input event; to the next frame: from the event to the next frame of the screen, in which the result is shown. Median / slowest, in ms.

| Settings | Processor | Events | Handling | To the next frame |
|---|---|---|---|---|
| Start-up settings (first-order lag, PID) | this computer | 41 | 33 / 71 | 33 / 74 |
| Start-up settings (first-order lag, PID) | 4× slower | 41 | 145 / 194 | 146 / 251 |
| Exercise 1 (third-order lag, PID) | this computer | 41 | 37 / 59 | 37 / 70 |
| Exercise 1 (third-order lag, PID) | 4× slower | 41 | 188 / 252 | 189 / 318 |
| Most time steps (PID, N = 100, 200 s) | this computer | 41 | 46 / 100 | 47 / 101 |
| Most time steps (PID, N = 100, 200 s) | 4× slower | 41 | 217 / 381 | 217 / 384 |
| Exercise 1 with a sweep of 8 values | this computer | 41 | 88 / 174 | 88 / 174 |
| Exercise 1 with a sweep of 8 values | 4× slower | 41 | 420 / 543 | 421 / 673 |

## What the results mean

- **Opening the page.** On this computer the plots are ready in a third of a second, and in about 1.3 s on the slower processor; the formulas follow. On a first visit over a slow connection, the download comes first.
- **Changing a value.** With the panels shown at a first visit, a change takes 4–23 ms even with the most time steps. With every panel and every analysis, it takes 31–60 ms: well under the 100 ms that feels immediate. On the slower processor it takes 0.16–0.28 s, about the 200 ms of a "good" response. The Routh–Hurwitz and steady-state panels follow 0.12 s later, taking another 35–71 ms (mostly their formulas), when they are shown.
- **Dragging a slider.** Every position of the slider computes everything, so the plots follow the drag at 20–30 updates a second on this computer and at about 5–7 on the slower processor. That is less than the 60 frames of a perfectly smooth animation, but each step shows a complete result, computed as accurately as after a single change.
- **Parameter sweep.** Eight full computations per change: 0.06–0.22 s on this computer; up to about 1.1 s on the slower processor with the heaviest settings.
- **Changing the language.** 0.15 s on this computer and 0.7 s on the slower processor: every text is written again. It is done once, not while working.

## Changes since version 1.75.0

Since this document was first written (version 1.75.0), the page has gained panels (poles and zeros, loop transfer functions, Routh–Hurwitz test, steady-state error, Nichols chart), analyses (the straight-line approximation of the Bode plot, the Nyquist count, the construction rules of the root locus), design cards, eight languages and the manual in each of them. Start-up of three versions, measured one after the other on the same computer (median of 7):

| Version | Page (compressed) | Ready: this computer | Ready: 4× slower |
|---|---|---|---|
| 1.75.0 | 0.4 MB | 228 ms | 845 ms |
| 1.97.0 (before the manual in every language) | 0.5 MB | 267 ms | 1093 ms |
| 1.98.1 | 1.4 MB | 300 ms | 1277 ms |

The start-up has grown by about a third: half of it from the new panels and languages (more to build when the page opens), half from the manuals (the browser has to read a larger page). A change with every panel shown now takes 31–60 ms instead of 22–43 ms, mostly because there is more to draw (Drawing 18–25 ms instead of 8–15 ms); the measurements now also show every curve and analysis, which the earlier ones did not. The computations themselves (simulation, frequency response, root locus) take the same time as before.

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
- **The parameter sweep is the heaviest part.** With the most time steps it takes about 1.1 s per change on the slower processor. Turn the sweep off while you drag sliders, and on when you want to compare.
- **Hide what you do not need.** The pole-zero map with its root locus, the Bode and Nyquist plots and the Nichols chart add to every change, and the Routh–Hurwitz and steady-state panels to the moment after it; hiding them makes changes faster. The page opens with three panels only (block diagram, time response, transfer functions).
- **Formulas.** MathJax typesets the formulas after the plots; on a slow device they appear about a second later. The first visit downloads MathJax (0.7 MB compressed) from cdn.jsdelivr.net; without that connection the page works, but the formulas are shown as their TeX source.
- **Web fonts** (Noto Sans) were not measured. They load in the background; until then the text is shown in a font of the system.
- **Other browsers.** The measurements were made in Chrome; Firefox and Safari run the same script but were not measured.

## Reproducing the measurements

```
npm ci
npm run build
npm run performance                    # prints the tables above (about 4 minutes)
node --test tests/performance.test.ts  # checks that the heaviest computations stay fast
```

`scripts/performance.ts` uses `CHROME_PATH`, or `/usr/bin/google-chrome`, or Playwright's own Chromium. The times depend on the computer: compare the ratios rather than the milliseconds.
