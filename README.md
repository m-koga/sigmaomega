<img src="src/icon.svg" width="96" alt="SigmaOmega icon">

# SigmaOmega — Feedback Control Simulator

English | [日本語](README.ja.md)

SigmaOmega is a browser-based simulator for feedback control systems. Its name comes from *s* = σ + *j*ω of the Laplace transform. (Inside the code and the browser storage the old short name `ctrlsim` is kept, so that saved settings, files and links still work.) The published page is a single file, `index.html` (MathJax is loaded from a CDN to render formulas); it is built from the sources in `src/`.

## Features

- A dark menu bar under the header holds every menu (File, Plots to show, System setup, Analysis & design, Plot arrangement, Metrics display), each with a line icon; the open menu and the one whose card is shown are underlined in red; the settings panel below it shows one card at a time, chosen from the menus File, System setup and Analysis & design, and can be folded into a narrow strip (≪); metrics can be shown as cards or as a table; on smartphones a bottom bar switches between the settings and the plots
- A user manual in the app: Help at the right end of the menu bar opens it (eleven sections with a contents list, among them a step-by-step walkthrough of the four exercises with screenshots, in every language of the page)

- Plant: six presets, or enter any transfer function (including dead time)
- Controller: P / PI / PD / PID, lead, lag, and lead-lag compensators, or enter any transfer function
- Response of the plant alone to the reference (open loop) overlaid on the time response, or shown by itself (no reference and no feedback loop) with its own metrics
- Reference: step, ramp, parabola, trapezoid, pulse, square wave, sine wave, impulse (with its peak, the area ∫y dt and its theory A·T(0))
- Disturbance, measurement noise, and actuator saturation (with anti-windup)
- Time response with response metrics, Bode plot (gain and phase margins; frequency range automatic or set by hand, back to automatic when the poles, zeros, dead time or simulation time change), Nyquist plot (with the Nyquist criterion: P, N counted from the crossings of the real axis to the left of −1, and Z = N + P), and pole-zero map (closed-loop pole list)
- Nichols chart of L(jω) with the M contours of the closed loop and the critical point
- Bode asymptotes of L (straight-line approximations of the gain and the phase, with the break frequencies, and optionally the line of each factor whose sum they are) on the plot, and a table of the break frequencies, slopes, the gap to the true gain and the change of phase
- Root locus (loop gain multiplied by k): values on hover, click to apply the gain, stable range of k, optional ζ/ωn grid, and optional construction rules (real-axis segments, asymptotes, breakaway and break-in points, imaginary-axis crossings, departure and arrival angles) drawn on the map and listed with their values
- Disturbance response: Bode plots of Gyd = P/(1+L) and Gyr = Cr P/(1+L), peak disturbance gain, maximum deviation and recovery time; 2-DOF PID with set-point weights b and c (the block diagram switches to the form u = Cr(s) r − C(s) y; it shows the saturation, the disturbance d and the noise n only while they are used, and gets shorter without them)
- Export: save the data of each plot as CSV (time response with the sweep, frequency responses of L, P, C, S, T, Gyd, Gyr, Nyquist, Nichols, poles and zeros) and each plot as a PNG image
- Scenarios: save all settings with a name and a task note in the browser or to a .json file, copy them as text or a link for students, load them back, optionally together with the layout; example exercises included
- Sensitivity S(jω) and complementary sensitivity T(jω) on the Bode plot, peak sensitivity Ms, peak Mt, closed-loop bandwidth, the 1/Ms circle on the Nyquist plot, and Ms as a design specification
- Parameter sweep: overlay responses for up to 8 values of a plant or controller parameter on all plots, with a table of overshoot, settling time, margins, stability and specification checks
- Lead, lag and lead-lag compensator design from a target phase margin by the classical frequency-response steps (each step with its values, the margin reached, applied with one click)
- Estimation exercise: estimate K, T and L of a hidden first-order lag + dead time plant from its step response, or the parameters of one of three hidden plants (two first-order lags, first-order lag + dead time, second-order system) from its Bode plot (the same exercise number gives the same plant), checked within 10 %, with the answer and "Use this plant"
- PID auto-tuning by tuning rules (Ziegler–Nichols step response and ultimate sensitivity, CHR, IMC): shows the identified model and the gains, applied with one click
- Design specifications (overshoot, settling time, rise time, steady-state error, phase margin, gain margin, damping ratio ζ) with ✓/✗ checks, limits drawn on the plots, the design region on the pole-zero map, and the range of k on the root locus that meets the pole specifications
- The block diagram is a panel like the plots: on top across the whole width in the preset layouts, anywhere in the free arrangement (plots to its left or right, its width set by the column boundary); its bottom edge changes its height, and the diagram is never wider than its area
- Every panel (the plots, the block diagram and the transfer functions) has a × at the right end of its title that hides it, like its item in "Plots to show"; the last panel shown cannot be hidden
- The transfer functions C(s) and P(s) are a panel like the plots (shown at first beside the time response); drag its bottom edge to change its height, and the formulas are scaled to fit (no wider than the panel; shown smaller by themselves while the panel is too narrow for the chosen size)
- The loop transfer functions L(s), S(s), T(s), G_yr(s) and G_yd(s) are a panel of their own ("Loop transfer functions" in "Plots to show"): its buttons choose which are shown, each as its definition and as a rational function with the numbers substituted (the dead time kept as e^(−Ls), common factors not cancelled); the bottom edge scales the formulas like those of the transfer functions panel, with a size of its own
- The poles and zeros of P(s), C(s), L(s), S(s), T(s), G_yr(s) and G_yd(s) in a panel of their own ("Poles and zeros" in "Plots to show"): its buttons choose the transfer functions, and a table lists their poles and zeros side by side (poles in the right half-plane in red; with a dead time the closed-loop poles from the third-order Padé approximation)
- The Routh–Hurwitz stability test in a panel of its own ("Routh–Hurwitz test" in "Analysis & design"): the characteristic equation and its Routh table (ε for a zero first entry, the auxiliary polynomial for a row of zeros), the number of sign changes and the verdict, and the stable range of the gain factor k (and of K_P with P control) derived from the first column as functions of k, compared with the root locus
- The system type and steady-state error in a panel of its own ("Steady-state error" in "Analysis & design"): the type of L(s) and the error constants K_p, K_v, K_a, and the steady-state errors to a step, ramp and parabola of the reference and to a step disturbance, beside the simulation (with set-point weights, from 1 − G_yr(s))
- Arrange the panels in rows, each row with its own number of panels side by side (layout "Rows": for example the block diagram alone, then two plots, then three; the panels of a row as tall as the tallest): drag ⠿ into another row or a new row, and drag the boundary between two panels of a row to change their widths
- Choose the plots to show in a drop-down list (a check for each, several at a time) and show them side by side in 1 column, 2 columns or 1 row, or arrange them freely: drag the ⠿ handle of a plot (or use the arrow keys) to move it within a column, to another column or into a new column, and drag the boundary between columns to change their widths (remembered in the browser); drag the bottom edge of a plot area to change its height, with all its plots scaled by the same ratio; zoom and pan every plot (wheel, drag, double-click to reset)
- Resize and show/hide display areas (saved in the browser)
- Multilingual: Japanese, English, Chinese (Simplified), Korean, Thai, French, German, Spanish, Portuguese and Russian (switch at the top right; follows the browser language on first visit, English if not supported; the choice is saved in the browser)

## Usage

There are three ways to use SigmaOmega:

- **Online**: <https://m-koga.github.io/sigmaomega/> (GitHub Pages; updated with each release). On a phone or a computer the page can be installed as an app (Add to Home Screen, or Install in the browser's menu).
- **Download**: each [release](https://github.com/m-koga/sigmaomega/releases) has `index.html`, the whole simulator in one file: save it and open it in a browser. `sigmaomega-site-vX.Y.Z.zip` holds the web site (page, manifest and icons) for your own server.
- **From the source**: `npm ci && npm run build`, then open `index.html`.

The page loads its fonts and the formula renderer (MathJax) from the internet; without a connection it still works, with the fonts of the system and the formulas shown in their TeX source.

### Citing SigmaOmega

[CITATION.cff](CITATION.cff) gives the reference (GitHub shows it as *Cite this repository*). It is generated with the version and date of each release.

The full specification (screens, functions, computation methods, non-functional requirements, development and tests) is in [SPEC.md](SPEC.md) ([日本語](SPEC.ja.md)). Update it, in both languages, whenever a change alters the behavior it describes.

The numerical accuracy (how it was evaluated against exact solutions and independent references, and the results) is in [ACCURACY.md](ACCURACY.md) ([日本語](ACCURACY.ja.md)); the user manual summarizes it in its section "Numerical accuracy".

The time efficiency (how long the page takes to open, to respond to a change, to follow a slider and to change the language, measured in Chrome at normal speed and with the processor slowed down 4 times, with the upper limits of the work done) is in [PERFORMANCE.md](PERFORMANCE.md) ([日本語](PERFORMANCE.ja.md)); the user manual summarizes it in its section "Time efficiency".

## Automated tests

Requires Node.js 22.18 or later. Run `npm install` once (it installs TypeScript for the type check, and Playwright for the browser tests).

```
npm test        # build index.html, type-check src/ts, then run all the unit tests
npm run test:all   # the unit tests and the browser tests
```

The unit tests load the page script directly from `src/` (all files except the start-up file `src/ts/99-init.ts`, with the types removed) on stand-in objects instead of a real page, so they need no build and no browser; every top-level name of the script is available to the tests (for example `api.S`, `api.simulate`), with its type (`tests/app-api.d.ts`, generated by `npm run typecheck`). Useful ways to run them:

```
node --test tests/simulation.test.ts              # one file
node --test --test-name-pattern="root locus"      # tests whose name matches
npm run test:watch                                 # rerun on every change
```

They check the following (`tests/` folder).

| File | What it checks |
|---|---|
| `simulation.test.ts` | Step responses against analytical solutions (first- and second-order closed loops, rise and settling time, overshoot), first-order convergence in the step size, every reference type, dead time, ramp and sine references, saturation and anti-windup, measurement noise, divergence; impulse response equal to the derivative of the step response, with the area A·T(0); the plant alone (open loop) against its analytical step and impulse responses, with dead time, and its divergence; the metrics of the plant alone relative to its own final value |
| `frequency.test.ts` | Bode plot (L = P + C), phase margin, lead and lag compensators, every controller's frequency response against its transfer function, simulated sine responses of every controller against the closed-loop frequency response, sensitivity peaks and bandwidth, disturbance and reference transfer functions, a Bode range set by hand (kept for a gain, dropped when a pole, zero or the simulation time changes) |
| `pole-zero.test.ts` | Closed-loop poles, stability verdict, root locus against analytical roots and the stable gain range, design regions |
| `design.test.ts` | Design specifications, every tuning rule against the published tables, parameter sweep, 2-DOF PID, disturbance metrics against analytical values |
| `files.test.ts` | Scenarios (save, load, validation, examples, files, layout), stored panel lists (the transfer functions panel added to lists saved before it existed) and CSV export, the layout defaults from one place (defaultLayout) |
| `kinds.test.ts` | Every entry of the tables of plants, controllers, tuning rules and plots is complete (parameters, ranges, formulas, labels), a PID-type transfer function matches its frequency response, the loop gain scales every controller, every plant with every controller simulates, every tuning rule gives gains for each controller type and checks what it needs |
| `tiles.test.ts` | Free arrangement of the plots: stored arrangements are checked (every plot once, missing plots added), the preset layouts as a starting point, moving a plot within a column, to another column and into a new column (hidden plots keep their place, at most four columns), moving with the arrow keys, arrangements in scenarios, the ratio that scales the plots of an area (limited by the first plot to reach its limit) |
| `rows.test.ts` | Arrangement of the plots in rows: stored arrangements are checked (every panel once, the block diagram on top and other missing panels in a new row), rows from the preset layouts (hidden plots together at the bottom), moving a panel within a row, into another row and into a new row (full rows take no more), rows showing more than four split, the arrow keys, arrangements in scenarios |
| `smoke.test.ts` | Every plant with every controller: simulation, frequency response, and poles are computed and consistent |
| `parser.test.ts` | Parsing of transfer function input and its errors, root finding |
| `i18n.test.ts` | Every UI string has translations in all languages with matching placeholders and formula markup, no Japanese is written directly in the UI strings, and the default language follows the browser |
| `leftovers.test.ts` | Leftovers of removed features: every dictionary entry, every class and id of the style sheet and every stored layout item is still used by the page (the UI strings are collected in `ui-strings.ts`, shared with `i18n.test.ts`) |
| `build.test.ts` | `index.html` is up to date with `src/`, the version number of the page matches the change log, and each figure of the user manual has its screenshot in every language of the manual, all put into the page |
| `publish-edits.test.ts` | Publishing as text replacements (`scripts/publish-edits.ts`): the edits give the new page, each old text unique when applied (also for a line that occurs many times, at the first and last lines), scattered changes merged into at most 64 edits, the lines read back after publishing (changed, around deleted lines, samples of long regions); the compact page script drops only blanks, keeps the lines, has no long runs of spaces and compiles |
| `help.test.ts` | The user manual: every language of the page has it (`src/help/<lang>.html`); every figure and table has an id and a caption and is referred to in the text, every reference has its target, and every language has the same chapters, figures, tables, references, screenshots and structure (paragraphs, lists, tables, keys, code) as the English text |
| `pages.test.ts` | The GitHub Pages files (`scripts/pages.ts`): the page differs from `index.html` only by the manifest link and the theme colour, and the manifest names the app and icons that exist with the right sizes |
| `modules.test.ts` | The layers of `src/ts`: every file is in a layer by its number and starts with its title; a file imports only from files with a lower number (so there are no cycles), and the files below 40 (basics, model, computing) do not touch the page; no file is longer than 600 lines (the change log excepted) and no function longer than 80 lines |
| `license-headers.test.ts` | Every source file starts with the SPDX license identifier and the copyright line |
| `tutorial.test.ts` | The numbers quoted in the user manual's chapter "Trying the exercises": each step of the four exercises (manual tuning, tuning rules, the sweep of K_I, set-point weights, stabilizing an unstable plant) gives the values the manual states |
| `performance.test.ts` | Time efficiency (PERFORMANCE.md): the root locus and the stable gain ranges, the root finding with large poles, the simulation with the most time steps and a sweep of 8 values stay far below the time they took before they were made faster, and the analyses of the loop (straight-line approximation, Nyquist count, root-locus rules, steady-state errors, Routh–Hurwitz) stay fast |
| `accuracy.test.ts` | Numerical accuracy (ACCURACY.md): the time response against the exact closed loop and against a continuous reference with the exact dead time, the response metrics, the margins and Ms against a dense frequency scan, the discretization, the roots and the Padé approximation, and the sine metrics, the closed-loop peaks and bandwidth, the stable range of k, the steady-state errors, the Nyquist count, the straight-line approximation and the root-locus rules stay within the stated bounds |
| `loop.test.ts` | Loop transfer functions: L, S, T, G_yr and G_yd as rational functions equal their frequency responses (dead time, 2-DOF PID, PI-D, compensators, entered transfer functions); their formulas (definition, rational function, e^(−Ls)) and the choice of formulas by the buttons; the poles of P, C and L, the closed-loop poles as roots of 1 + L, the zeros as roots of the numerators, and the Padé poles with a dead time |
| `routh.test.ts` | Routh–Hurwitz test: textbook tables (ε for a zero first entry, auxiliary polynomial for a row of zeros); the sign changes equal the closed-loop poles in the right half-plane; the first column equals the ratios of Hurwitz determinants; the stable range of k equals the one from the root locus (also with a dead time) |
| `steady-state.test.ts` | System type and steady-state error: the type and K_p, K_v, K_a (P, PI, integrating plant, dead time, a zero at the origin); the errors equal the textbook formulas without set-point weights and differ with them; the errors to the reference and to a step disturbance agree with long simulations |
| `locus-rules.test.ts` | Construction rules of the root locus, each checked against the roots of D(s) + k N(s): real-axis segments, asymptotes (far roots for a large k), breakaway and break-in points (double roots), imaginary-axis crossings, departure and arrival angles (roots for a small and a large k), on eight settings (triple pole, dead time with its 0° locus, a cancelled pair); textbook examples |
| `nyquist.test.ts` | Nyquist criterion: Z = N + P equals the closed-loop poles in the right half-plane on twelve settings (unstable plant, integrators, dead time, compensator), N equals the sum of the crossings; textbook examples (crossing at −1.5 for ω = ±√3, passing through −1, N = −1 for an unstable plant, an integrator on the imaginary axis) |
| `bode-asymptote.test.ts` | Bode gain asymptotes: they meet the true gain far from the break frequencies and end with −20(n − m) dB/dec on seven settings; textbook examples (first-order lag: −3 dB at the break; complex pair: −20 log10(2ζ); integrator); the phase approximation meets the true phase far from the breaks (also with a dead time), −45° at the break of a first-order lag; the lines of the factors add up to the asymptotes (10/s and the pole −1 of 10/(s(s + 1))) |
| `nichols.test.ts` | Nichols chart: every point of the M contours has |L/(1 + L)| = M (closed curves for M > 0 dB, −6.02 dB at −180° for M = 0 dB), and the curve's largest closed-loop gain equals Mt |
| `compensator.test.ts` | Lead and lag compensator design on the textbook example 10/(s(s + 1)) with a target of 50° (each step's value, the margin reached, the same margin once applied), and the cases with no design (target met, too much phase, no crossover); lead-lag on Ogata's 20/(s(s + 1)(s + 2)) (the new crossover at the phase crossover √2 or given, α, β, the margin reached) |
| `exercise.test.ts` | Estimation exercise: the same plant for the same number, within the ranges, different for different numbers; the step response (63.2 % after T) and the check of the estimates; for the Bode plot, each kind of plant about as often, the gain and phase against the plant's transfer function, the resonance peak, T1 and T2 in either order, the frequency range |
| `version.test.ts` | Consistency of version numbers, matching English and Japanese change log items, CHANGELOG.md and CHANGELOG.ja.md being up to date |

### Browser tests

The page itself is tested in a browser with [Playwright](https://playwright.dev/) (`ui/` folder). This needs a one-time installation:

```
npm install
npx playwright install chromium    # can be skipped if Chrome or Chromium is installed
npm run test:ui
```

The browser is the one installed by Playwright, otherwise an installed Chrome or Chromium is found automatically (or set `CHROME_PATH=/path/to/chrome`). `index.html` is built from `src/` before the tests start, and MathJax is served from `node_modules`, so the tests run offline. At least two tests run at a time; each test has its own browser context with empty storage, opens the small `ui/start.html` first (storage written by the first page of a new context is sometimes lost on a reload of a local file) and then loads the simulator once. While working on a change, run only the tests concerned; run all of them once before publishing. Useful ways to run them:

```
npx playwright test ui/layout.spec.ts            # one file
npx playwright test -g "smartphone"              # tests whose name matches
npx playwright test --headed                     # watch the browser
npx playwright test --debug                      # step through a test
npx playwright show-trace test-results/…/trace.zip   # inspect a failed test
```

| File | What it checks |
|---|---|
| `layout.spec.ts` | Columns at wide and narrow widths, one-line header, settings panel drop-down lists (one card shown, remembered, keys, a tab stored by an earlier version) and folding, the drop-down lists of the layout and the metrics view (only their names while closed, the chosen one checked, keys, closing, one open at a time, language), the menus packed from the left, "Reset the layout" in the File tab (layout back, settings kept), the drop-down list of the plots to show (several choices while open, keys, closing, the last plot, reload, language), the menu bar (every menu in order, one row on wide screens and two on narrow ones, lists on the screen, above the settings panel and the plots while they scroll), metric cards keeping their rows, the sections under each plot in one area chosen with tabs (time response: response metrics, simulation time, display; Bode plot: curves, stability margins, break frequencies, note; Nyquist plot: options, Nyquist criterion, note; pole-zero map: display, stability, gain ranges, pole list, note, how to use), whose handle scales the shown tab and hides the whole area with its tabs, the transfer functions panel beside the time response (P(s) then C(s) at the left in one column at every width, with their equals signs lined up and equal spacing, also with C_r(s) of a 2-DOF PID; hidden and remembered with its tab, added to a layout saved before it existed; its bottom edge scales the formulas to fit the height and stops at the width: drag, reload, arrow keys, double-click; shown smaller while they do not fit after a narrower window or a longer formula, and back with room), the block diagram as a panel (on top across the whole width in the presets, its bottom edge up to the width, in a column of its own beside the time response, its width by the column boundary, hidden with its button, back after "Reset the layout") and its 2-DOF form, the diagram never wider than its area (also after a longer diagram; the handle stops at the width), the × of each panel (hides it, the list of plots follows, kept after a reload, keyboard, not for the last panel), the design of the menu bar (dark, icons on wide screens, underlines, one row from 770 px in every language), short menu names on phones (at most two rows in every language), smartphone bottom bar |
| `plots.spec.ts` | Showing and arranging plots, Bode curve buttons, table view of the metrics and independent resizing, hiding areas, CSV and PNG downloads, when the buttons of the plots (also the pole-zero map) are shown: pointer, keyboard focus, zoom, not after a click, the legend of a single Bode curve, the frequency range of the Bode plot set by hand (margins unchanged, back to automatic, Auto button, values that are not a range), zoom of the block diagram (buttons, wheel, drag, double-click, Fit, the area keeps its size, whole again after a new drawing, PNG of the part shown) |
| `design.spec.ts` | Specification verdicts, auto-tuning applied to the controller, parameter sweep table |
| `files.spec.ts` | Example exercises and the task note, scenarios saved with the layout, scenario files, rejected text |
| `interaction.spec.ts` | Zooming and panning plots (wheel, drag, buttons, double-click, linked time axes), pole-zero map (tooltip, zoom, pan, clicking the root locus applies the gain), plant and controller entered as transfer functions, held comparison responses, panel border and formula size, simulation time, copying scenarios as text and as a link, two-click delete, analysis inputs |
| `tiles.spec.ts` | Free arrangement: dragging a plot into a new column or onto another column (kept after a reload, Escape cancels), the column boundary (drag, minimum width, double-click for equal widths, arrow keys), the arrow keys on the handle, a hidden plot coming back in its place, switching between the preset layouts and the free one, narrow screens (one column, no handles), the transfer functions panel moved like the plots, the bottom edge of an area (all plots by the same ratio, limits, reload, arrow keys, double-click, a hidden plot left as it is) |
| `rows.spec.ts` | Layout "Rows": rows of one, two and three panels (widths, levels, equal heights in a row, reload), dragging a panel into another row and into a new row (the drop line, Escape), the arrow keys on the handle (full rows), the boundary between two panels of a row (drag, reload, arrow keys, double-click), a hidden panel coming back in its row, switching layouts, narrow screens, reset |
| `loop.spec.ts` | Panels "Loop transfer functions" and "Poles and zeros": shown from the menu, the buttons choose the formulas or the transfer functions (none: a hint), the formulas follow the settings (dead time), the bottom edge scales the formulas apart from the transfer functions panel, and poles in the right half-plane are red |
| `routh.spec.ts` | Panel "Routh–Hurwitz test": shown from the menu, the Routh table and the verdict follow the settings (stable, unstable in red), the stable range of k and K_P, formulas typeset |
| `steady-state.spec.ts` | Panel "Steady-state error": shown from the menu, the type and the error constants follow the controller (P → PI), the current reference row with the theory and the simulation, the step disturbance, the warning when unstable, formulas typeset |
| `locus-rules.spec.ts` | Root locus construction rules: off at first, the tab lists the asymptotes, crossings and departure angles, the option adds them to the legend of the map, they follow the settings (breakaway point), kept in the scenario view options |
| `nyquist.spec.ts` | Nyquist criterion tab: P, N, Z and the verdict follow the settings (unstable, stable with an unstable plant), the crossing at −1.5, the crossing marks off at first and kept in the scenario view options |
| `bode-asymptote.spec.ts` | Bode asymptotes: the button (off at first, kept in the scenario view options), the table of break frequencies (−3.01 dB at the break of a first-order lag), following the controller |
| `nichols.spec.ts` | Nichols chart: shown from the menu, the phase axis covers −180°, zoomed by the wheel |
| `failures.spec.ts` | Failures: a CSV or PNG that cannot be saved (clipboard fallback, error message), copying that fails (older copy command, text selected for copying by hand), full or broken browser storage, an unreadable scenario file, a broken scenario link, the artifact viewer's save capability answering late; input checks for number boxes and plant transfer functions, dead time kept per plant, folded sections opened with the keyboard |
| `details.spec.ts` | Less frequent paths: sliders and reference type, parameter sweeps in the Bode, Nyquist and pole-zero plots, specification lines, a Bode plot zoomed into less than a decade, pole-zero map options, root locus click with a transfer-function controller, scenario names with special characters, files with a list of scenarios, estimation exercises from the step response and from the Bode plot, timed messages, the artifact viewer's downloads capability (saved, declined, unavailable), cards without folding, area handles, change log, startup with each settings card remembered |
| `help.spec.ts` | The user manual: the Help button, its sections and contents list, closing (Escape, ×, a click beside it) and the focus, every language (its own text and screenshots, without a note), phones |
| `i18n.spec.ts` | Default language from the browser, and no untranslated text in any of the five languages |

### Coverage

```
npm run coverage            # unit tests and browser tests
npm run coverage -- --unit  # unit tests only (no browser needed)
```

This runs the tests while recording which parts of `src/ts/*.ts` are executed, and prints a table per file: the share of code characters run by the unit tests, the browser tests and both together, and the share of lines and functions. The functions that never ran are listed in `coverage/uncovered.txt`, the lines that never ran in `coverage/uncovered-lines.txt` (`coverage/summary.json` holds the numbers). At version 1.73.6 the tests together run 98.0% of the code characters, 98.9% of the lines and 1009 of 1018 functions. The browser tests run on a page whose script keeps every character in place (`ui/global-setup.ts` builds it when `COV_DIR` is set; the published page is compacted), and `index.html` is built again afterwards.

After adding or changing features, run `npm test` (and `npm run test:ui` for changes to the page) and make sure all tests pass before publishing.
On every push to GitHub, GitHub Actions (`.github/workflows/test.yml`) runs the same tests (a pushed version tag also starts the release, `.github/workflows/release.yml`; see "Versions and change log"); see the "Actions" tab of the repository for results.

## Development (source files and build)

To contribute, see [CONTRIBUTING.md](CONTRIBUTING.md) for the setup and the rules for changes.

The page is edited in `src/` and built into the single file `index.html`, which is what is published and distributed. Do not edit `index.html` directly.

| File | Contents |
|---|---|
| `src/index.html` | Page template (HTML) with placeholders for the version number, style sheet, and script |
| `src/style.css` | Style sheet |
| `src/i18n.json` | Translation dictionary (keys are the English strings) |
| `src/icon.svg` | The icon (σ and ω on the axes of the s-plane), drawn with strokes only; the build puts it into the header and uses it as the favicon |
| `src/icon-180.png` | The home-screen icon (apple-touch-icon, 180×180, without rounded corners), made from `src/icon.svg` by `npm run icon` (`scripts/icon-png.ts`) |
| `src/icon-192.png`, `src/icon-512.png`, `src/icon-maskable-512.png` | Icons of the web app manifest (with rounded corners; the maskable one full-bleed with the drawing at 80 % for Android), also made by `npm run icon` |
| `src/manifest.webmanifest` | Web app manifest of the GitHub Pages site (name, colours, icons) |
| `src/help/<lang>.html` | The user manual in each language of the page: one `<section id="…" title="…">` per chapter, put into the script by the build |
| `src/help-img/` | Screenshots of the user manual, `<name>.<lang>.webp` in every language of the manual (made by `npm run shots`, or `npm run shots -- fr de` for some languages; `scripts/help-shots.ts`) |
| `src/ts/01-changelog.ts` … `99-init.ts` | Script in TypeScript, in layers, one topic per file (see [Structure of the script](#structure-of-the-script)): basics 01–09 (change log, translation, complex numbers and polynomials, parser), model 10–14 (definitions, state), computing 15–39 (frequency response, simulation, loop, Routh–Hurwitz test, Bode asymptotes, Nyquist criterion, root-locus rules, steady-state error, analyses of the current loop, tuning rules, compensator design, exercises, design specifications, parameter sweep), page basics 40–44 (elements and files, view state), showing 45–69 (plots, pole-zero map, block diagram, settings shown, formulas, poles, Routh test, notes under the plots, steady-state errors, design cards, sweep, update and redraw), controls 70–98 (settings panel, controller input, exercise, design controls, static parts of the panel, plot interaction, export, rows, free arrangement, page layout, scenarios and their card, menu bar, zoom of the block diagram, user manual, language switch), 99 start-up. Each file is an ES module that imports what it uses from lower-numbered files; the build joins them in file-name order into one script. |
| `src/ts/types.d.ts` | Types shared by the script: the state `State`, the layout `Layout`, scenarios `Scenario`, polynomials `Poly`, complex numbers `Complex`, the dictionary, and globals such as MathJax |
| `src/ts/element-ids.d.ts` | Element type of every id in the page (generated by `npm run build` from `src/index.html` and the HTML written in `src/ts`; do not edit) |
| `tsconfig.json` | Settings of the type check of `src/ts` |
| `tsconfig.node.json` | Settings of the type check of the build scripts and the tests (`scripts/`, `tests/`, `ui/`, `playwright.config.ts`) |
| `CONTRIBUTING.md`, `CONTRIBUTING.ja.md` | How to set up, build, test and contribute, and the rules for changes |
| `PERFORMANCE.md`, `PERFORMANCE.ja.md`, `scripts/performance.ts` | Time efficiency: the measurements and their results, and the script that makes them in a browser (`npm run performance`) |
| `ACCURACY.md`, `ACCURACY.ja.md`, `scripts/accuracy.ts` | Numerical accuracy: the evaluation and its results, and the script that computes them (`npm run accuracy`) |
| `CLAUDE.md`, `.claude/` | For the maintainer only: the procedure for the AI coding assistant he works with (Claude Code; the skill is in Japanese), see `.claude/README.md`. Not needed to use or contribute |
| `LICENSE`, `NOTICE` | The Apache License 2.0, and the copyright and attribution notice to be passed on with copies |
| `tests/app-api.d.ts` | Type of the page script as the tests see it: every exported name of `src/ts` with its type, also declared as globals for code run in the page by the browser tests (generated by `npm run typecheck`; do not edit) |

```
npm run build    # build index.html from src/
npm run check    # check that index.html is up to date
npm run typecheck   # type-check src/ts, the build scripts and the tests with TypeScript
npm run format   # format the TypeScript files with Prettier (npm run format:check only checks)
npm test         # build, type-check, then run the automated tests
npm run docs     # build, then generate CHANGELOG.md and CHANGELOG.ja.md
npm run pixcmp -- old.html   # compare the plots, metrics, analysis panels and block diagram of an older build with index.html exactly
npm run accuracy # compare the results with exact solutions and print the tables of ACCURACY.md (about 25 s)
npm run performance # measure the times in Chrome and print the tables of PERFORMANCE.md (about 4 minutes)
npm run edits -- 1.62.1      # text replacements from the published version 1.62.1 to index.html (/tmp/publish-edits.json),
                             # and the lines to read back after publishing (/tmp/publish-edits-checks.json)
npm run icon     # make the PNG icons (src/icon-180.png, -192, -512, -maskable-512) from src/icon.svg again (then npm run build)
npm run pages    # write the GitHub Pages site to site/: index.html with a manifest link, the manifest and its icons
npm run shots    # take the screenshots of the user manual from index.html again (src/help-img; then npm run build)
```

The build uses only Node.js (`scripts/build.ts`): Node's built-in type stripping replaces the TypeScript types with spaces, so every line and column of the script is the same as in `src/ts`; the unit tests and the coverage report use this script. For `index.html` the blanked text is then removed within each line (`compact()`), so the page keeps the lines of `src/ts` (error messages in the browser point at the right line) and has no long runs of spaces. That keeps the page small and lets an account that may edit the shared artifact but does not own it publish a new version with `edit_version`: `npm run edits -- <live version>` (`scripts/publish-edits.ts`) finds the published page in the git history by its version number and writes the exact text replacements that turn it into `index.html` (at most 64, with at most 64 KiB of replaced text). It also writes the lines to read back after publishing (`makeChecks()`): the number of lines of the page, and for every changed region its lines (or, for a long one, its first and last lines and samples in between), so that a mistake in copying the replacements is found. The screenshots of the user manual (`src/help-img/*.webp`) are put into the page by the build as base64 text on short lines, one `<script type="text/plain" data-help-img="<name>.<lang>">` each at the end of the body; the manual shows them in `<figure data-img="<name>">`. Retake them with `npm run shots` when a change alters what they show. New pictures make the page larger than `edit_version` can take, so a version with new screenshots is published by the owner's account. GitHub Actions checks that the committed `index.html` matches the build of `src/` and that the type check passes.

### Structure of the script

```
user input ──▶ S (settings)  ──▶ update() ──▶ syncControls()            (54)  inputs shown as in S
 (events in 70–81)                (62)          simulate(S)       (16)  ──▶ lastSim ─┐
                                                freqResp(S)       (15)  ──▶ lastFr  ─┤  (11, setResults)
                                                computePZ(S)      (23)  ──▶ lastPZ  ─┼─▶ redraw() ──▶ drawTime, drawBode,
                                                sweepRuns(S)      (28)  ──▶ lastSweep┘   (62)         drawNyq, drawPZ (46–50)
                                                renderSpecs/Tune/Sweep (60, 61)          metrics, margins, tables
layout (41: sizes, panels, folds) ──▶ applyLayout() (79) ──▶ redraw()      scenarios (80, 81): S and layout saved and loaded
```

The files are in layers, each using only the ones below it (`tests/modules.test.ts` checks this):

| Files | Layer | What it holds |
| --- | --- | --- |
| 01–09 | Basics | change log, translation (`T()`), complex numbers and polynomials, parser |
| 10–14 | Model | the tables of definitions; the settings `S`, what follows from them (`ctrlRational`, `refValue`, …) and the last results |
| 15–39 | Computing | frequency response, simulation; the loop (`17-loop.ts`) and its analyses, one file each: Routh–Hurwitz test, Bode asymptotes, Nyquist criterion, root-locus rules, steady-state error, and the analyses of the current loop kept once per change; tuning rules, compensator design, estimation exercises, design specifications, parameter sweep. No access to the page |
| 40–44 | Page basics | elements (`$`, `byId`), files and messages, translation of the page; the view state: layout, shown panels, plot views, colours |
| 45–69 | Showing | one file per plot (common frame and axes, time response, Bode, Nyquist, Nichols, pole-zero map with its text and its view) and per panel (block diagram, settings shown in the inputs, formulas, table of poles, Routh test, notes under the plots, steady-state errors, design cards, sweep); `update()` and `redraw()` |
| 70–98 | Controls | the settings panel (its events, controller input, estimation exercise, design controls, building its static parts), plot interaction, export, arrangement of the panels, page layout, scenarios (what is saved, and their card), menu bar, block diagram zoom, user manual, language switch |
| 99 | Start-up | builds the page (left out of the unit tests) |

Each file holds one topic, named in its title comment, and the number of a file says its layer. The numbers leave room in every layer, so a new file takes a free number next to the files it belongs with and nothing is renumbered. `tests/modules.test.ts` checks that every file is in a layer, starts with its title, imports only from lower numbers, and is at most 600 lines long (the change log, which is data, excepted); the files below 40 do not touch the page.

A lower file never calls a higher one: rendering does not call `update()`, and what a click should do is set up by the controls (for example, the table of the parameter sweep is drawn by `61-sweep-panel.ts`, and a click on a row is handled once by `buildSweep()` in `73-design-controls.ts`).

- `S` (`11-state.ts`, type `State`) holds every setting. An event handler changes `S` and calls `update()`, which computes everything once and keeps the results in `lastSim`, `lastFr`, `lastPZ` and `lastSweep`; `redraw()` draws the plots that are shown from these results (it is also called when only the view changes: zoom, size, panels).
- The calculations (files 03–39: `16-simulation.ts`, `15-frequency.ts`, the transfer functions in `11-state.ts` and `17-loop.ts` and the analyses after it, the tuning rules in `24-tuning.ts`, the compensator design in `25-compensator.ts`, the specifications in `27-specs.ts`, the sweep in `28-sweep.ts`) do not touch the page: they take the settings as their last parameter `st` (default: `S`) and return results. To compute with other settings, pass a copy, e.g. `simulate({ ...S, Kp: 4 })`; the parameter sweep works this way and leaves `S` unchanged. `tests/state.test.ts` checks that every calculation gives the same result with a copy as with changed global settings.
- The layout (`layout`, `41-view.ts`; applied by `79-layout.ts`) is separate from the settings: it is saved in the browser and can be saved with a scenario.
- Colours of the plots are in `COLORS` at the top of `41-view.ts`, named by role (`output`, `alert`, `spec`, ...).
- Common changes: a plant, a controller, a parameter, a tuning rule, a panel or plot, a design specification, a compensator design or a language → see [Adding plants, controllers, tuning rules, panels, specifications and languages](#adding-plants-controllers-tuning-rules-panels-specifications-and-languages); a UI string → write it in English with `T('…')` and add its translations to `src/i18n.json`; an element with an id → `npm run build` updates the element types.
- A function is at most 80 lines long (`tests/modules.test.ts`): a longer one is split into named parts, each with a comment saying what it does (for example `drawBode` uses `bodeAsymCurves`, `bodeGainRange`, `bodePhaseRange` and `bodeNoteHTML`). Event handlers of more than a few lines are named functions too, assigned in the `build…()` function of their card.
- A refactoring that should not change what is shown is checked with `npm run pixcmp` against the previous build: it compares every canvas, the text of the metrics and of the analysis panels (Routh table, steady-state errors, Bode asymptotes, Nyquist criterion, root-locus rules, tuning and compensator cards for each method) and the block diagram for every combination of its parts.
- Unused variables and parameters are type errors (`noUnusedLocals`, `noUnusedParameters`); a parameter that must stay can be named with a leading underscore (`_t`).

### Adding plants, controllers, tuning rules, panels, specifications and languages

The kinds of plant and controller, their parameters, the tuning rules, the plots, the design specifications and the languages are each described by one table; the menus, the inputs, the formulas, the calculations, the buttons and the scenario files follow from it.

- **Plant**: add an entry to `PLANTS` with its menu name `name`, its parameters `p`, the formula with symbols `tex` and with the numbers substituted `texNum`, the transfer function `tf` (numerator, denominator, dead time `L`), and `unstable` if the plant alone is unstable (for the Nyquist criterion).
- **Controller**: add an entry to `CONTROLLERS` with its menu name `label`, its short name `name`, its parameters `p`, the parameters scaled with the loop gain `gain` (root locus), and its transfer function `rational`; `defaults` gives initial values that differ from those in `CTRL` (P control starts with K<sub>P</sub> = 1; when the kind is switched, a parameter still at the initial value of the previous kind takes that of the new one, a value changed by hand is kept). A `kind: 'tf'` controller (like the lead and lag compensators) also gives its formula `texNum`; a `kind: 'pid'` controller uses the parallel PID form with the terms whose gains (`Kp`, `Ki`, `Kd`) are among its parameters, and gets 2-DOF, derivative on y and anti-windup.
- **Parameter**: new parameters go to `PARAMS` (plants) or `CTRL` (controllers) in `10-definitions.ts`, with the slider (`min`, `max`, `step`), the initial value `val`, the range accepted for typed values `hard` (`[-BIG, BIG]` when any value is accepted), and optionally the symbol `sym` used in the sweep and in exported files and the values `sweep` that the parameter sweep starts with (otherwise ×0.5, ×1, ×2, ×4 of the current value); new names and labels need their translations in `src/i18n.json`.
- **Tuning rule**: add an entry to `TUNE_RULES` in `24-tuning.ts` with its menu name `label`, the plant model it uses `model` (`'step'`: the reaction-curve model K, T, L from the step response; `'ult'`: the ultimate gain and period), what it needs (`needT`: the time constant T, not defined with an integrator; `needDead`: an apparent dead time L > 0), and its gains `gains` for P, PI and PID in the standard form (Kp, Ti, Td). A rule given as a table of coefficients can use `reactionRule()`, like the Ziegler–Nichols and CHR rules. The sign of the plant gain and the conversion to KP, KI, KD are done for every rule.
- **Plot**: put its canvas in a `<div class="plot-wrap">` of `index.html` (with a `<div class="hgrip">` below it for its height), add an entry to `PLOTS` in `10-definitions.ts` with its label `label` (shown on the handle while the area is hidden), its PNG file name `file`, whether it zooms `zoom`, and optionally the plot sharing its horizontal axis `linkX` or equal axis scales `keepAspect`. Zoomable plots get the wheel and drag zoom and the ＋ − Fit PNG buttons.
- **Panel** (a plot, or a panel of text such as the Routh table): add an entry to `PANEL_DEFS` in `41-view.ts` with its item in the menu `label`, the menu `menu` (`'plots'`: "Plots to show"; `'ana'`: "Analysis & design") and `text` (a panel without a plot), put its `<div class="card tabpanel" id="panel-KEY">` with a `<div class="h2row">` title row in `index.html`, and say what `redraw()` draws in it in `PANEL_DRAW` (`62-update.ts`; `null` for a panel that `update()` renders). Its item in the menu, its × and its place in the arrangements follow. A plot with data to save gets a button `data-csv="KEY"` in its title row and an entry in `CSV_EXPORTS` (`76-export.ts`) that returns the text and the file name.
- **Compensator design**: add an entry to `COMP_METHODS` in `25-compensator.ts` with its item in the menu `label`, its design function `design` (the classical steps, from the frequency response of K<sub>c</sub>P(s)), the parameters `params` it sets in the controller of the same name (a kind of `CONTROLLERS`), and `askWc` when the new crossover can be given; and the steps it shows in `COMP_STEPS` (`60-design-cards.ts`).
- **Design specification**: add an entry to `SPECS` in `10-definitions.ts` with its label `label` (ending with ≤ or ≥), the unit `unit`, the smallest limit that can be typed `low`, `bound` (`'max'`: the measured value must be ≤ the limit; `'min'`: ≥) and the default (`on`, `v`), and its measurement to `SPEC_MEASURES` in `27-specs.ts` (from the step-response metrics, the frequency response or the closed-loop poles; `null` when it does not apply). The row of the card, the default, the check, the column of the sweep table and the saved scenarios follow; a line on a plot is drawn by `specMarks()` in `46-time-plot.ts`.
- **Language**: add an entry to `LANGUAGES` in `02-i18n.ts` with the `lang` attribute of the page `tag`, its name in the menu `name`, the font of the plots `font` and the language of the change log `docs` (`'ja'` or `'en'`; `'en'` shows a note that it is in English), add its translations to every entry of `src/i18n.json` and its code to `I18nDict` (`types.d.ts`), and add its font to the Google Fonts link of `index.html`. Translate the user manual into `src/help/<lang>.html` (the same chapters, figures, tables and references as `en.html`; `tests/help.test.ts` compares them, and the names in bold are those of the page in that language) and take its screenshots with `npm run shots -- <lang>`.
- `tests/kinds.test.ts` then checks the new entry without new tests: its parameters and ranges are defined, its formulas have numbers, a PID-type transfer function matches its frequency response, the loop gain scales it, and it simulates and has a frequency response with every other kind; every tuning rule gives gains for each controller type and its needs are checked; every plot has a file name and a label; every parameter has typed-value limits around its slider and sweep values within them; every specification has a measurement and a default that can be typed; every language is in the menu with its font; every panel has its card in the page and every CSV button its export; every compensator design sets a controller of its name with parameters it has, and improves the phase margin of a third-order lag. Entries missing from `PANEL_DRAW` and `COMP_STEPS` are type errors. `tests/i18n.test.ts` asks for the translations of a new language.

### Code style

- The TypeScript files are formatted with [Prettier](https://prettier.io/) (`.prettierrc.json`: 120 columns, single quotes; the Babel parser `babel-ts`, because Prettier's default TypeScript parser needs the JavaScript API that TypeScript 7 no longer has). Run `npm run format` before committing; GitHub Actions checks it with `npm run format:check`. Generated files are left out (`.prettierignore`).
- Long tasks are split into named steps with a one-line comment each, for example `plot()` (frame, grid, axis labels, marks, curves, legend), `drawPZ()`, `drawTime()`, `drawBode()` and `syncControls()`. Drawing steps share a small "frame" object (`PlotFrame`, `PZFrame`: context, plot area, ranges and the mapping from values to pixels).
- A comment goes on its own line or at the end of a line that it explains, never in the middle of a line of code.

### TypeScript

- The script is written in TypeScript and type-checked with `npm run typecheck` (also part of `npm test`). The page itself is still one plain JavaScript file.
- Only TypeScript that can simply be erased is allowed: types, interfaces, `as`, optional parameters and the like. `enum`, `namespace` and parameter properties are rejected (`erasableSyntaxOnly` in `tsconfig.json`).
- Each file is an ES module: it imports what it uses from the other files (`import { S } from './11-state.ts'`) and exports what they use, so the dependencies of a file can be read at its top, and a name used without an import is a type error. Imports of types only use `import type`. Types used everywhere (`State`, `Poly`, ...) are global, in `src/ts/types.d.ts`, and need no import.
- The imports are for the type checker: the build blanks the import lines and `export` keywords and joins the files in file-name order into one classic script, so no bundler is needed and every line and column stays as in `src/ts`. Only `import { … } from './NN-name.ts'` and `export` before `function`, `const` or `let` are allowed (`npm run build` refuses other forms). The file-name order is the order in which top-level code runs, and a file imports only from files with a lower number (`tests/modules.test.ts`), so the files can be read from the bottom up and there are no cycles. A new file gets the number of its layer; code that a lower file needs goes down to that file, not the other way.
- A variable can be changed only by the file that declares it (an imported binding cannot be assigned): other files call a small function of that file, such as `setResults()`, `setLayout()`, `setShownPanels()`, `resetPZView()` or `setLangCode()`.
- Elements are taken with `$(id)`, which accepts only ids that exist in the page and returns the element with its type: `$('Tsim')` is an `HTMLInputElement`, `$('cvY')` an `HTMLCanvasElement`. A misspelled id, or `.value` on a canvas, is a type error. Ids built in the script, such as `` $(`in-${k}`) ``, are checked against the patterns of the ids written in the HTML (`id="in-${k}"`). When an id is known only when the page runs (from a `data-` attribute or an object key), use `byId(id)` (or `byId<HTMLCanvasElement>(id)` for a specific element type).
- When you add an element with an id, run `npm run build` (or `npm test`) so that `src/ts/element-ids.d.ts` includes it; `npm run check` reports a file that is not up to date.
- Every function and variable has a type, and `noImplicitAny` is on, so new code must be typed too. The shared types are in `src/ts/types.d.ts`: the state `State`, the layout `Layout`, scenarios `Scenario`, polynomials `Poly`, complex numbers `Complex`, transfer functions `TF` and `Rational`, results of the simulation `SimResult`, frequency response `FreqResult` and pole-zero map `PZResult`, sweep runs `SweepRun`, specification results `SpecEval`, plot options `PlotOptions`, and the keys of the numeric settings `NumKey`.
- `any` is used on purpose only for MathJax, the artifact viewer's API, and the checking of scenario data read from files, links or text (`scMerge`, `scLayout`), which can contain anything.
- `strictNullChecks` is on: a value that can be `null` or `undefined` (no simulation yet, an optional field, a `data-` attribute, ...) must be checked before it is used. For things that are always there, use the helpers in `40-dom.ts`: `qs(selector, root)` for an element of the page found by a CSS selector, `ctx2d(canvas)` for the 2D context of a canvas, and `must(value, what)` for anything else. They throw an error naming what is missing instead of failing later with "cannot read properties of null".
- Results that either succeed or fail are typed as unions, so a check of `err` tells TypeScript which one it is (for example `TuneResult` in `24-tuning.ts`: `if(r.err!==undefined)` → the error, otherwise the gains).
- The build scripts, the unit tests and the browser tests are TypeScript too. They are ES modules (`"type": "module"` in `package.json`) that Node.js and Playwright run directly, without a build step; local imports name the `.ts` file (`import { fresh } from './harness.ts'`), and imports of types only use `import type`. They are checked with `tsconfig.node.json`, which includes `src/ts` so that the tests know the types of the page script: `fresh().simulate()` is a `SimResult`, and code passed to `page.evaluate()` in the browser tests can use `S`, `$('bodeS')` and the other names of the page with their types.
- In the tests, `defined(x)` (a value that must not be null or undefined) and `success(r)` (a tuning result that must not be an error) fail the test with a clear message and narrow the type; `boxOf(page, selector)` gives the position of an element that must be shown.
- All strict checks are on (`"strict": true` in both tsconfig files), so the migration to TypeScript is complete. An error caught in `catch` has the type `unknown`; read it with `errMessage(e)` and `errCode(e)` (in `40-dom.ts`).

## Translation

- UI strings are written in English and translated into Japanese, Chinese, Korean, Thai, French, German, Spanish, Portuguese and Russian through the dictionary in `src/i18n.json` (keys are the English strings). Wrap UI strings in `T('…')`.
- On first visit the display language follows the browser language (English if it is not supported). The selected language is saved in the browser.
- When you add or change a string, add its translations to the dictionary under the same English key. Strings missing from the dictionary are shown in English (and `npm test` reports them).
- The in-app change log shows Japanese items in Japanese and English items in all other languages.

## Versions and change log

- The version number is the first entry of the `CHANGELOG` array in `src/ts/01-changelog.ts` and is shown at the top right of the page (`npm run build` also writes it into `<meta name="version">`).
- Add a new version at the top of the `CHANGELOG` array, with English items in `en` and Japanese items in `ja`.
- The change log files are generated by `npm run docs`: [CHANGELOG.md](CHANGELOG.md) (English) and [CHANGELOG.ja.md](CHANGELOG.ja.md) (Japanese), together with [CITATION.cff](CITATION.cff) (version and date of the newest entry). Do not edit them directly.
- The README exists in English (this file) and Japanese ([README.ja.md](README.ja.md)). Update both when the content changes.
- **Releases.** The maintainer makes a release by hand by pushing a tag of the newest version: `git tag v1.73.5 && git push origin v1.73.5`. The workflow `.github/workflows/release.yml` then checks that the tag is the newest version of the change log, runs the unit tests, and publishes a GitHub release with `index.html` and the site as a zip file, its notes taken from the change log in English and Japanese (`node scripts/gen-docs.ts --notes`). When GitHub Pages is set to deploy from GitHub Actions (Settings › Pages › Source: GitHub Actions), it then starts itself again on `main` for that tag and deploys the site of the tag (`npm run pages`) to <https://m-koga.github.io/sigmaomega/> (the `github-pages` environment lets only `main` deploy, not tags); otherwise that step is skipped. Running the workflow by hand (Actions › Release › Run workflow) deploys the current `main`, or the version tag given as *tag*, to Pages without a release.
- **DOI.** After the repository is public, linking it to [Zenodo](https://zenodo.org/) (sign in with GitHub, then switch the repository on) gives each release a DOI; Zenodo reads `CITATION.cff`.

## Third-party software

`index.html` contains no code written by others. When the page is opened, the browser loads the following from the internet. As with any web page, these services (and the server of the page) learn the visitor's IP address and browser; the simulator itself sends no settings or results anywhere, and a link made with *Copy link* keeps the settings after `#`, which browsers do not send to the server.

| Software | License | How it is used |
| --- | --- | --- |
| [MathJax](https://www.mathjax.org/) 3 | Apache-2.0 | Renders the formulas; loaded from the jsDelivr CDN |
| [Noto Sans JP, SC, KR and Thai](https://fonts.google.com/noto) | SIL Open Font License 1.1 | Fonts of the interface; loaded from Google Fonts |
| [JetBrains Mono](https://www.jetbrains.com/lp/mono/) | SIL Open Font License 1.1 | Font of the numbers; loaded from Google Fonts |

Used only for development (not part of the page):

| Software | License | Used for |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) 22.18 or later | MIT | Build and unit tests (its built-in type stripping) |
| [TypeScript](https://www.typescriptlang.org/) | Apache-2.0 | Type checking |
| [Playwright](https://playwright.dev/) | Apache-2.0 | Browser tests, pixel comparison, screenshots of the manual, PNG icons |
| [Prettier](https://prettier.io/) | MIT | Formatting |
| [@types/node](https://www.npmjs.com/package/@types/node) | MIT | Types of Node.js |
| MathJax (npm package) | Apache-2.0 | Served locally in the tests, so that they run offline |
| [Pillow](https://python-pillow.org/) (Python) | MIT-CMU | Converts and shrinks the screenshots and icons |

The versions are those in `package.json` / `package-lock.json`.

## Author and copyright

Masanobu Koga (Kyushu Institute of Technology)

Copyright © 2026 Masanobu Koga. The notice is made by the build from `author` in `package.json` and the years of the change log, and is shown at the top of the page source and at the bottom of the change log and the user manual (with the license).

## License

Licensed under the [Apache License, Version 2.0](LICENSE) (`Apache-2.0`); see also [NOTICE](NOTICE). Every source file starts with the lines `SPDX-License-Identifier: Apache-2.0` and `Copyright 2026 Masanobu Koga` (in the comment syntax of the file); a new file needs them too (`tests/license-headers.test.ts` checks it). You may use, copy, modify and distribute the software, also in modified form, if you keep the copyright notice and the license, state the changes you made, and pass on the NOTICE file. The software is provided "as is", without warranties of any kind: check results that matter against other means.

## Developed with AI assistance

SigmaOmega was developed with the assistance of [Claude](https://www.anthropic.com/claude), an AI model by Anthropic. The author decided the features, the control-engineering content and the design, and reviewed the results; most of the code, tests and documentation were written by Claude under his direction (the commits are marked `Co-Authored-By: Claude`). The computations are checked by automated tests against analytical solutions and published tables, and every number quoted in the user manual is checked by a test.
