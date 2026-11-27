# Change Log

English | [日本語](CHANGELOG.ja.md)

Version numbers follow [Semantic Versioning](https://semver.org/) (the second number for new features, the third for fixes and wording).

> This file is generated from the change log in `src/ts/01-changelog.ts` by `npm run docs`. Do not edit it directly.

## v1.97.0 (2026-11-27)
- Portuguese and Russian: the language menu at the top right has Português and Русский, and a browser set to Portuguese or Russian opens the page in that language. Every text of the page is translated (the user manual and the change log are shown in English, with a note, as in the other languages but Japanese)

## v1.96.0 (2026-11-27)
- Spanish: the language menu at the top right has Español, and a browser set to Spanish opens the page in Spanish. Every text of the page is translated (the user manual and the change log are shown in English, with a note, as in the other languages but Japanese)

## v1.95.0 (2026-11-27)
- French and German: the language menu at the top right has Français and Deutsch, and a browser set to French or German opens the page in that language. Every text of the page is translated (the user manual and the change log are shown in English, with a note, as in Chinese, Korean and Thai)

## v1.94.3 (2026-11-27)
- Development: the script is in 57 files of one topic each instead of 30 (the largest held up to 1,300 lines and a dozen topics): the analyses of the loop (Routh–Hurwitz test, Bode asymptotes, Nyquist criterion, root-locus rules, steady-state error), the tuning rules, the compensator design and the exercises, each plot, each panel (block diagram, formulas, poles, Routh test, steady-state errors, design cards, sweep), the parts of the settings panel and the scenarios have their own files
- Development: the number of a file says its layer (basics 01–09, model 10–14, computing 15–39, page basics 40–44, showing 45–69, controls 70–98, start-up 99), with room for new files in each; the test of the modules checks that every file is in a layer, starts with its title and is at most 600 lines long, and that the files below 40 do not touch the page. The page is unchanged (pixel comparison identical)

## v1.94.2 (2026-11-27)
- Development: the panels are one table (PANEL_DEFS: their item in the menu, the menu, a panel without a plot), from which the items of "Plots to show" and "Analysis & design" are made; what redraw() draws in each panel is a table checked by the type checker (PANEL_DRAW), and so are the CSV files of the plots (CSV_EXPORTS). Adding a panel is one entry in each, plus its card in the page
- Development: the kinds of compensator design are one table (COMP_METHODS: item in the menu, design function, the parameters set in the controller of the same name, whether ωc can be given), with the steps each shows in COMP_STEPS; their menu, the ωc input, applying the result and checking a loaded scenario follow from it (they were written out in five files). Tests check the new tables; the page, its menus and the plots are unchanged (pixel comparison identical)

## v1.94.1 (2026-11-27)
- Development: the ten functions of more than 80 lines (the Bode plot, the root-locus rules, the Nyquist criterion, the block diagram, the steady-state error and compensator panels, the exercise and scenario cards, the frequency response and the root-locus rules panel) are split into named parts, each with a comment saying what it does; the block diagram and the scenario buttons lose their repeated code; tests/modules.test.ts now keeps every function at 80 lines or fewer
- Development: npm run pixcmp also compares the analysis panels (Routh table, steady-state errors, Bode asymptotes, Nyquist criterion, root-locus rules, tuning and the compensator card for each method) and the block diagram for every combination of its parts, so that a refactoring of them is checked too; with it, this version shows exactly what 1.94.0 showed. A test of the Nichols CSV export was added (it was the one export no test ran)

## v1.94.0 (2026-11-27)
- Menus: "Routh–Hurwitz test" and "Steady-state error" moved from "Plots to show" to "Analysis & design", below its cards. They still show or hide their panels among the plots (checked when shown), and "All" in "Plots to show" now shows the nine plots of its list.

## v1.93.0 (2026-11-27)
- Estimation exercise: "Read from" adds the Bode plot. The exercise number gives one of three hidden plants, K/((T1 s + 1)(T2 s + 1)), K e^(−Ls)/(Ts + 1) or K ωn²/(s² + 2ζωn s + ωn²); its gain and phase are drawn, the mouse reads ω, the gain and the phase, and the three estimates are checked within 10 % (T1 and T2 in either order). "Use this plant" sets that plant.
- Development: the legend of a plot can be placed at the bottom left.

## v1.92.1 (2026-11-27)
- Fix: the page stopped while starting when the lead and lag compensator card had been open at the last visit (it was drawn before it was built), leaving the page in English, without plots and unusable.

## v1.92.0 (2026-11-27)
- Lead and lag compensator design: the new kind "Lead-lag compensator" combines both by the classical steps: the new crossover ωc (the phase crossover of K_c P, or a value given), the phase lead φm to add there with α and T1 = 1/(ωc√α), and the lag β = |K_c P(jωc)|/√α with T2 = 10/ωc, so that ωc becomes the gain crossover; "Apply to the controller" sets the lead-lag compensator

## v1.91.1 (2026-11-27)
- Time response: "Only the plant alone" is now the first option of the tab "Display", and while it is chosen the block diagram shows the plant alone, u → P(s) → y

## v1.91.0 (2026-11-27)
- Time response: the option "Only the plant alone" (tab "Display") shows the plant by itself, with no reference and no feedback loop: the input set as the reference drives P(s) directly, the upper plot shows only the plant's output and the lower one its input, the metrics are the plant's own (final value, rise time, overshoot and settling time relative to the final value, steady-state gain y/u), an unstable plant gets its own banner, and the CSV holds t, u and y of the plant

## v1.90.0 (2026-11-27)
- Time response: the new tab "Display" under the plot can add the response of the plant alone to r(t) (open loop: P(s) with its dead time driven by the reference itself, without the controller and the feedback), drawn as a green dashed line beside the closed-loop output y for comparison, and saved as a column of the CSV

## v1.89.0 (2026-11-27)
- Bode plot: the new button "Factors of the asymptotes" (off at first) draws the gain and phase lines of each factor of L(jω) — K/s^q, each pole and zero (a complex pair as one), the dead time — in its own color, named in the legend, so that the asymptote can be seen as their sum, as when it is drawn by hand

## v1.88.1 (2026-11-27)
- Bode plot: the tab "Note" describes the method of the straight-line approximation (button "L asymptotes") for the gain, the phase and the dead time; the tab makes the area taller only while shown

## v1.88.0 (2026-11-27)
- Bode plot: the button "L asymptotes" also draws the straight-line approximation of the phase of L(jω): a real pole changes it by −90° and a zero by +90° along a straight line from ω_b/10 to 10ω_b, a complex pair by ∓180° from ωn·10^(−ζ) to ωn·10^ζ, with the exact −ωL of the dead time. The tab "Break frequencies" adds the change of phase of each break with its frequency range

## v1.87.1 (2026-11-27)
- Fix: the Bode gain asymptotes (button "L asymptotes") were drawn in a blue close to that of L(jω) and hidden under its curve away from the break frequencies, so that they looked missing; they are now drawn in magenta, thicker, with larger circles at the break frequencies

## v1.87.0 (2026-11-27)
- New card "Estimation exercise" (Analysis & design): the unit step response of a hidden plant K e^(−Ls)/(Ts + 1), with t and y read under the mouse; enter estimates of K, T and L and "Check" draws their response over it and marks each one within 10 %; "Show the answer" gives the true values and "Use this plant" sets them as the plant. The same exercise number always gives the same plant (kept with the scenario), so a class can work on the same exercise

## v1.86.0 (2026-11-27)
- New card "Lead and lag compensator design" (Analysis & design): from the target phase margin PM*, the gain K_c (for the steady-state error) and an allowance θ, it works through the classical frequency-response steps for K_c P(s) one by one — lead: φm, α, the new crossover ωm where |K_c P| = √α, and T1; lag: the frequency where the phase is −180° + PM* + θ, β and T2 = 10/ω — and shows the phase margin reached; "Apply to the controller" sets the compensator
- Development: npm run pixcmp matches the canvases of the two pages by id, so that a new plot does not show as differences in the others

## v1.85.0 (2026-11-27)
- New panel "Nichols chart" (in "Plots to show", hidden at first): the gain of L(jω) [dB] against its phase [deg], over the M contours of the closed loop |T| (12 … −20 dB, labelled) and the critical point (−180°, 0 dB). The largest M the curve touches is the resonance peak Mt; the margins are read where it crosses −180° and 0 dB. It zooms like the other plots, and its data can be saved as CSV

## v1.84.0 (2026-11-27)
- Bode plot: straight-line (asymptotic) approximation of the gain of L(jω). The new button "L asymptotes" (off at first) draws it with its break frequencies (○): K/ω^q at low frequencies and a change of slope of ±20 dB/dec per real pole or zero (±40 per complex pair) at |s|. The new tab "Break frequencies" lists each one with its poles and zeros, the change of slope, the slope after it and the gap to the true gain (3 dB at a real break, −20 log10(2ζ) at a complex pair), for checking a Bode plot drawn by hand

## v1.83.0 (2026-11-27)
- New reference type "Impulse" A δ(t − t0): applied in the simulation as a pulse of area A over one substep (the recorded r and u leave the impulse out; a vertical line marks t0). Its metrics: the peak of y and its time, the area ∫ y dt beside its theory A·T(0) (A·Gyr(0) with set-point weights), y at the end and the largest |u| without the impulse

## v1.82.0 (2026-11-27)
- Nyquist plot: the Nyquist stability criterion. The new tab "Nyquist criterion" shows P (open-loop poles in the right half-plane), N (clockwise encirclements of −1) and Z = N + P (closed-loop poles in the right half-plane) with the verdict, and lists the crossings of the real axis to the left of −1 one by one (upward +1, downward −1) so that N can be counted by hand. The count follows the Nyquist contour, passing poles on the imaginary axis (integrators) by small half circles, and uses the exact dead time; when L(jω) passes through −1 it says so (marginally stable). The new option "Crossings of the real axis to the left of −1" marks them on the plot (▲ +1, ▼ −1)

## v1.81.0 (2026-11-27)
- Pole-zero map: construction rules of the root locus. The new option "Construction rules of the root locus" (off at first) draws the real-axis segments, the asymptotes from their centroid, the breakaway and break-in points, the imaginary-axis crossings and the departure and arrival angles with their values; the new tab "Locus rules" lists each rule with how it is found and its value (k at the breakaway points and crossings), for checking a locus sketched by hand. The 0° locus (leading coefficients of opposite signs, as with the Padé approximation of a dead time), repeated poles and cancelled pole-zero pairs are handled

## v1.80.0 (2026-11-27)
- New panel "Steady-state error" (in "Plots to show", hidden at first): the system type of L(s) and the position, velocity and acceleration error constants K_p, K_v, K_a; the steady-state errors to a step, ramp and parabola of the reference (per unit input and for the current setting, with the textbook formulas) and to a step disturbance at the plant input, beside the error at the end of the simulation. With set-point weights the errors come from 1 − G_yr(s), and the values of the textbook formulas are shown in small type

## v1.79.0 (2026-11-26)
- New panel "Routh–Hurwitz test" (in "Plots to show", hidden at first): the characteristic equation 1 + L(s) = 0 and its Routh table for the current setting, with the first column in bold, negative entries in red, the number of sign changes and the verdict (ε for a zero first entry, the auxiliary polynomial for a row of zeros); below, with the controller multiplied by a gain factor k, the first column as functions of k (ratios of Hurwitz determinants) and the range of k (and of K_P with P control) where all are positive, compared with the range from the root locus

## v1.78.0 (2026-11-26)
- The panel "Poles" is now "Poles and zeros": its table lists the zeros of each chosen transfer function beside its poles (the roots of the numerators as written in the loop transfer functions panel: for example the zeros of S(s) are the poles of P(s) and C(s); the dead time has no zeros); the columns of ζ, ωn, ωd and the time constant are removed

## v1.77.0 (2026-11-26)
- New panel "Poles" (in "Plots to show", hidden at first): its buttons choose which of P(s), C(s), L(s), S(s), T(s), G_yr(s) and G_yd(s) are listed, and a table gives their poles with ζ, ωn, ωd and the time constant 1/|Re| (a conjugate pair on one row; poles in the right half-plane in red). The poles are those of the transfer functions as written in the loop transfer functions panel (common factors not cancelled); with a dead time the closed-loop poles come from the third-order Padé approximation, as noted under the table. The height of the table is changed at its bottom edge; the choice is saved with the layout of a scenario
- Layout "Rows": when the panels hidden at first are gathered in rows at the bottom, the plots come first, so that they come back side by side
- Fix of ACCURACY.md and the manual section "Numerical accuracy": the error of repeated roots was measured only from the exact root to the nearest computed one, which hides the spread of the computed roots; measured both ways, a pole repeated k times is found to a few times 10^(−16/k) (2×10⁻⁵ for a triple pole, not 2.2×10⁻⁶)

## v1.76.0 (2026-11-26)
- New panel "Loop transfer functions" (in "Plots to show", hidden at first): its buttons choose which of L(s), S(s), T(s), G_yr(s) and G_yd(s) are shown, each as its definition and as a rational function with the numbers substituted, for example L(s) = C(s)P(s) = (22s² + 41s + 20)/(s³ + 21s² + 20s). The dead time is kept as e^(−Ls), the denominator is monic, and common factors are not cancelled; G_yr(s) uses C_r(s) with set-point weights. The bottom edge of the panel scales the formulas like that of the transfer functions panel, with a size of its own; the choice is saved with the layout of a scenario

## v1.75.1 (2026-11-26)
- Exercise 1 (PID control of a third-order plant): the overshoot specification is now at most 12 % (was 10 %), so that CHR (set-point, 0 % overshoot), whose overshoot is about 11 %, meets every specification as the exercise intends; the task text, the user manual and its screenshot were updated
- The vertical range of the output plot now includes the specification lines that are shown (the overshoot limit, the settling band, the error limits), so a limit just above the response is no longer cut off

## v1.75.0 (2026-11-26)
- Faster: with the pole-zero map shown, a change takes 2 to 60 times less time (start-up settings 223 → 26 ms, an eighth-order plant 2.6 s → 43 ms on the test computer). The roots were found by an iteration that stopped at an absolute step of 1e-13, which large roots (the root locus at high gain) and repeated roots never reach, so it always ran 2000 times; it now stops at a step relative to the root, or when the polynomial is as small as its rounding error allows, and the stable gain ranges reuse the roots of the root locus. The results are unchanged (accuracy tests pass, every plot pixel-identical)
- New document PERFORMANCE.md (English and Japanese) and a section "Time efficiency" of the user manual: how long the page takes to open, to respond to a change and to follow a slider, in Chrome at normal speed and with the processor slowed down 4 times, judged against the RAIL and INP guidelines, with the upper limits of the work for one change; npm run performance measures it, and tests/performance.test.ts keeps the heaviest computations fast

## v1.74.0 (2026-11-26)
- More accurate time responses: the controller output held over each simulation step is now the exact average of the continuous controller over the step (the derivative part of a PID decays within a step), and the step is also chosen small enough for the derivative filter N and for fast poles of a controller entered as a transfer function. The largest error against the exact closed loop drops from about 1–6 % to about 0.3 % (for example 3rd-order lag + PID with N = 100: from 6.4 % to 0.004 %)
- A dead time that is not a whole number of simulation steps is no longer rounded to one
- Rise and settling times are interpolated between the recorded points, and the overshoot is taken from a parabola through the peak, so they no longer change in steps of the simulation time / 4000; the peak sensitivity Ms and the peak Mt are refined between the points of the frequency grid (for a sharp peak near instability, from 30.55 to the exact 31.00)
- Fix: some numbers of the exercises in the user manual came from the less accurate computation. Exercise 1: the PID tuning rules give 55 %, 11 % and 15 % overshoot, so none of them meets every specification as it is (the manual said CHR did, with 9.9 %); exercise 3 overshoots by about 19 % (not 21 %), and by 0.3 % with b = 0.7, c = 0; the settling times of exercises 1 and 2 are 8.4 s and 8.8 s. The screenshots of the manual were taken again
- User manual: a new section "Numerical accuracy" with the error bounds of each result and what to keep in mind; ACCURACY.md and ACCURACY.ja.md describe the evaluation against exact solutions and independent references, and its results
- Development: npm run accuracy (scripts/accuracy.ts) computes the comparisons and prints the tables of ACCURACY.md; tests/accuracy.test.ts checks the stated bounds

## v1.73.9 (2026-11-26)
- Development: the script is in layers with no cycles: each file of src/ts imports only from files with a lower number (it used to have two cycles, one of 4 and one of 12 files), and files 01–12 (math, parser, definitions, state, frequency response, simulation, loop and root locus, tuning rules, specifications, sweep) do not touch the page; tests/modules.test.ts checks both
- Development: new files for what was mixed with other topics: complex numbers and polynomials (03-math), the loop and root locus (09-loop), page elements and files (13-dom), the view state (14-view: layout, shown plots, plot views, colours), the contents of the panels and formulas (17-panels), update and redraw (18-update), and the language switch (29-language); what is drawn is separate from what reacts to input (for example, a click on a row of the sweep table is set up once with the other controls); the page and the plots are unchanged (pixel comparison identical)

## v1.73.8 (2026-11-25)
- Development: each parameter carries its own limits for typed values, its symbol and its first sweep values (they were in three separate lists), the design specifications are one table (label, unit, smallest limit, direction, default and measurement) from which the rows of the card, the defaults and the checks are made, and the languages are one table (page language, name, font of the plots, language of the manual) from which the language menu is made; adding a parameter, a specification or a language is now one entry, checked by the tests; the page and the plots are unchanged (pixel comparison identical)
- Development: the test that no Japanese is written in the script outside the dictionary now checks the whole script (it had stopped at the dictionary)

## v1.73.7 (2026-11-25)
- Development: the parser of transfer functions is split into its steps (normalizing the input, the coefficient vector, the tokens, and the grammar, which is written out in a comment), and the simulation into the choice of the time step, the controller (PID or transfer function, with its state), the dead time and the noise, so that the main loop shows only the signal flow; results are unchanged (pixel comparison identical)

## v1.73.6 (2026-11-25)
- Development: the coverage report counts the browser tests again (they had counted as 0% since the page script was compacted); together the tests run 98.9% of the lines and 1009 of 1018 functions
- Development: the edits for publishing leave an unchanged <title> line out, which edit_version refuses to touch
- Development: GitHub Actions moved to the versions on Node.js 24 (checkout, setup-node, upload/download-artifact v6), and Dependabot proposes updates of the tools and the actions once a week
- Release: a version tag now also reaches GitHub Pages: the release starts the workflow again on main for the tag, since the github-pages environment does not let a tag deploy

## v1.73.5 (2026-11-25)
- Distribution: a version tag pushed by the developer makes a GitHub release with index.html and the web site as a zip file, its notes taken from the change log, and deploys the site to GitHub Pages when Pages is set to GitHub Actions (.github/workflows/release.yml)
- Citation: CITATION.cff (generated by npm run docs with the version and date of the newest entry), shown by GitHub as "Cite this repository" and read by Zenodo for a DOI

## v1.73.4 (2026-11-25)
- Development: every source file (TypeScript, style sheet, icon, workflow, generated type files) starts with the lines "SPDX-License-Identifier: Apache-2.0" and "Copyright 2026 Masanobu Koga"; a test checks it

## v1.73.3 (2026-11-25)
- License: Apache License 2.0 (LICENSE and NOTICE), shown with the copyright notice under the change log and the user manual, with a link to the license
- User manual: the statement about data is now exact: the simulator sends no settings or results, but the page loads fonts and MathJax from the internet (which, as for any web page, learn the IP address); details in section 9
- README: the license, and a note that the simulator was developed with AI assistance (Claude)

## v1.73.2 (2026-11-25)
- Copyright notice "Copyright © 2026 Masanobu Koga" at the bottom of the change log and the user manual, and at the top of the page source (the author is also given in the page head)

## v1.73.1 (2026-11-25)
- Development: for a GitHub Pages site, npm run pages writes site/ with the page, a web app manifest (src/manifest.webmanifest) and its icons (192×192 and 512×512, and a 512×512 maskable one for Android), so that the site can be installed as an app; npm run icon makes the icons from src/icon.svg

## v1.73.0 (2026-11-25)
- Home-screen icon: the same design as a 180×180 PNG (apple-touch-icon), used when the page is added to the home screen of a smartphone or tablet
- Development: npm run icon makes src/icon-180.png from src/icon.svg

## v1.72.0 (2026-11-25)
- Icon: σ and ω on the axes of the s-plane (s = σ + jω), shown before the name in the header and as the icon of the browser tab

## v1.71.0 (2026-11-25)
- New name: SigmaOmega, with the subtitle "Feedback Control Simulator" (from s = σ + jω of the Laplace transform). The header shows the name with the subtitle in the language of the page, and the browser tab shows both; the user manual explains the name
- Saved settings, files and links of earlier versions still work (the storage keys keep the earlier short name ctrlsim)

## v1.70.0 (2026-11-24)
- User manual: figures and tables are numbered by section (Fig. 8.1, Table 2.1) with captions, and the text refers to each of them by its number; a click on a reference scrolls to the figure or table and marks it for a moment
- User manual: in exercise 2 the table of the sweep is shown only as its screenshot; the text gives the values that matter
- Development: unit tests check that every figure and table has an id and a caption and is referred to, and that the English and Japanese texts have the same ones (tests/help.test.ts)

## v1.69.0 (2026-11-24)
- User manual: the chapter "Trying the exercises" shows screenshots of the plots and tables it describes (six pictures with captions, in English or in Japanese with the language of the manual)
- Development: the screenshots are taken from the built page by npm run shots (scripts/help-shots.ts) and put into the page by the build; tests check that each figure has its pictures and that they are shown

## v1.68.0 (2026-11-24)
- User manual: new chapter "Trying the exercises", which walks through the four built-in exercises step by step with the values the simulator shows (manual tuning and the tuning rules for the third-order plant, a sweep of K_I for the plant with dead time, set-point weights of the 2-DOF PID, stabilizing an unstable plant with P and PI control)
- Development: unit tests check every number quoted in the chapter (tests/tutorial.test.ts)

## v1.67.1 (2026-11-24)
- On phones (640 px wide or less) the menus show short names (File, Plots, System, Design, Layout, Metrics) with less space around them, so that the menu bar takes at most two rows in every language (one row in Japanese, Chinese and Korean at 390 px); English and Thai took three rows before
- Development: browser test of the short names on phones in five languages

## v1.67.0 (2026-11-24)
- User manual in the app: "Help" at the right end of the menu bar opens it in a dialog, with nine sections (getting started, the screen, setting up the system, reading and working with the plots, design aids, saving and sharing, language and keyboard, troubleshooting) and a contents list. In English and Japanese; in Chinese, Korean and Thai the English text is shown with a note. On phones the button shows only its icon
- Development: the manual is in the new file 22-help.ts; browser tests of the manual (help.spec.ts)

## v1.66.0 (2026-11-24)
- New design of the menu bar: a dark bar with a line icon before each menu (left out below about 960 px wide, so that the menus stay on one row in every language). The open menu and the one whose card is in the settings panel are underlined in red; the lists fade in, and a list near the right edge is moved left to stay on the screen
- Development: browser test of the menu bar design (colours, icons, underlines, one row from 770 px in five languages)

## v1.65.0 (2026-11-24)
- Every panel (the plots, the block diagram and the transfer functions) has a × at the right end of its title: a click hides the panel, as its item in "Plots to show" does (shown again from there). The last panel shown cannot be hidden, so its × is not available
- Development: browser test of the × (hiding, the list of plots, reload, keyboard, the last panel)

## v1.64.0 (2026-11-24)
- Block diagram: the button "Fit to width" is removed. The bottom edge of the panel still changes the size of the diagram (up to the width of the panel), and the zoom buttons show a part of it
- Development: the browser test of the block diagram checks the width limit without the button

## v1.63.1 (2026-11-24)
- Development: npm run edits also writes the lines to read back after a page is published as text replacements (the number of lines, and the changed lines with samples of long changes), so that a mistake in copying the replacements is found; unit test of these checks

## v1.63.0 (2026-11-24)
- Block diagram: the buttons ＋, −, Fit and PNG, as on the plots (shown while the pointer is over the diagram or while zoomed). Zooming shows a part of the drawing in the same area: the wheel zooms at the pointer, a drag pans, a double-click or Fit shows the whole drawing (also after it is drawn again for other parts). PNG saves the part shown (block_diagram.png)
- Development: the zoom of the block diagram is in the new file 21-diagram-zoom.ts; browser test of the buttons, wheel, drag, double-click and PNG

## v1.62.2 (2026-11-24)
- Change log: the wording of a Japanese item of 1.61.5 is corrected

## v1.62.1 (2026-11-24)
- Development: the published page no longer has the runs of spaces left where the types were removed (the lines stay those of src/ts; about 27 KB smaller). An account that may edit the shared artifact but does not own it can publish a new version as text replacements (npm run edits)

## v1.62.0 (2026-11-24)
- Bode plot: the frequency range can be set by hand ("Frequency range" under the plot, in rad/s). It stays until "Auto" is pressed or the poles, zeros, dead time or simulation time change (changing only a gain keeps it). The sweep curves and the CSV follow it; the stability margins and the Nyquist plot keep using the automatic range

## v1.61.5 (2026-11-24)
- Development: the specification of the simulator in English and Japanese (SPEC.md, SPEC.ja.md)
- Development: the development procedure for Claude is kept in the repository (CLAUDE.md, .claude/skills/control-sim-dev), so that work from several Claude accounts follows the same rules (pull before work, rebuild generated files on conflicts, no force push)
- Development: npm run pixcmp compares the plots and metrics of two builds pixel by pixel (scripts/pixcmp.ts)

## v1.61.4 (2026-11-24)
- Development: leftovers of removed features deleted: 15 dictionary entries (such as "Show all", "Hide all", the old labels "Layout" and "Metrics", old tab names of the areas), 3 style rules (vb-lbl, vb-sep, vb-sel) and the stored layout item of folded cards (cards; a stored value is ignored)
- Development: new unit tests (tests/leftovers.test.ts) report dictionary entries, classes and ids of the style sheet, and stored layout items that nothing uses any more; the UI strings are collected once in tests/ui-strings.ts for these and the translation tests

## v1.61.3 (2026-11-24)
- Development: the defaults of the layout are listed once, in defaultLayout() (17-events-layout.ts), used at start, by resetLayout and for scenarios without a layout (they were written out three times)
- Development: the drop-down lists of the menu bar share one function, dropdown(), in the new file 20-menubar.ts (the opening, closing and keys were written three times in 17-events-layout.ts)
- Development: unit test of the single defaults

## v1.61.2 (2026-11-23)
- The Bode plot names its curve in the legend also when only one curve is shown (such as L(jω) at first); it was named only with two or more
- Development: browser test of the legend of a single curve

## v1.61.1 (2026-11-23)
- The note at the bottom of "Save and load" ("A scenario holds every setting: …") is removed

## v1.61.0 (2026-11-23)
- A menu bar under the header holds every menu of the page, in this order: File, Plots to show, System setup, Analysis & design, Plot arrangement, Metrics display; the settings panel and the plots lie below it side by side. The menus of the settings panel and the plot selection bar above the plots are gone
- On a narrow screen the menu bar wraps to a second row (the ⚙ menu is gone) and stays at the top while the page scrolls; its lists open across the screen. Choosing a card shows the settings panel (unfolds it; on a phone switches to the settings), choosing plots, their arrangement or the metrics view on a phone switches to the plots
- Development: browser tests of the menu bar (order, rows at each width, lists on the screen, position above the panels); two tests of a failed PNG save wait longer for the asynchronous image

## v1.60.0 (2026-11-23)
- The settings panel shows one card at a time, chosen from three drop-down lists instead of tabs: "System setup" (plant P(s), controller C(s), reference, disturbance & noise, actuator saturation), "Analysis & design" (design specifications, auto-tuning, parameter sweep) and "File" (save and load, compare & reset). The list of the shown card is marked and the chosen item checked; the choice is remembered in the browser and in scenarios with the layout (a tab stored by an earlier version opens its first card)
- The cards no longer fold (their headings are plain headings), and "Show all / Hide all" is gone
- Development: the cards and their groups (CARD_KEYS, CARD_GROUP) are in 03-definitions.ts; browser test of the drop-down lists; the browser tests open the cards they use (openCard in ui/fixtures.ts)

## v1.59.0 (2026-11-23)
- New button "Reset the layout" in the File tab of the settings panel (beside "Reset to defaults"): the plots shown, their arrangement and the sizes of the areas go back to the first layout; the settings, the metrics view and the open tab are kept
- Development: browser test of the button (layout back, settings kept, reload)

## v1.58.9 (2026-11-23)
- The button "Reset layout" is removed from the plot selection bar
- Development: the reset of the layout is kept as resetLayout() for scripts and tests; the browser tests call it instead of the button and check that the button is gone

## v1.58.8 (2026-11-23)
- The metrics view (cards or table) is chosen in a drop-down list like the layout: closed, it reads only "Metrics display" (the label "Metrics" is gone); open, the chosen view is checked
- The menus of the plot selection bar are packed from the left (the layout, metrics and reset choices were at the right end); opening one drop-down list closes the others
- On a narrow screen the choices in the ⚙ menu are one below the other and the menu opens from the left, so that it stays on the screen (it ran past the right edge)
- Development: browser test of the metrics drop-down and the packing; the tests choose the metrics view through it

## v1.58.7 (2026-11-23)
- The layout of the plots is chosen in a drop-down list like the plots to show: closed, it reads only "Plot arrangement" (it showed the chosen layout, after the label "Layout", which is gone); open, the chosen layout is checked. Arrow keys and Enter choose; Escape or a click outside closes it (inside the ⚙ menu, Escape closes the list first)
- Development: browser test of the layout drop-down; the tests choose the layout through it

## v1.58.6 (2026-11-23)
- The drop-down list of the plots to show reads only "Plots to show" while it is closed (it listed the names of the plots shown); the separate label "Show" before it is gone. The checks in the open list show what is shown
- Development: the browser test of the drop-down list checks the fixed label in two languages

## v1.58.5 (2026-11-23)
- Fix: the buttons of the pole-zero map (＋, −, Fit, PNG) were always shown; like those of the other plots they now appear while the pointer is over the plot, while one of them has the keyboard focus, or while the map is zoomed or moved (touch screens: always)
- Fix: after a click on a plot button (such as "Fit"), the buttons of that plot stayed shown until something else was clicked; the keyboard focus still keeps them shown
- Development: browser test of when the buttons of the plots are shown

## v1.58.4 (2026-11-23)
- Transfer functions panel: the formulas are always in one column, also in a wide panel (they were side by side from 720 px), so that their equals signs always line up
- Development: browser test of one column in a wide panel

## v1.58.3 (2026-11-23)
- Transfer functions panel: the equals signs of P(s), C(s) and (with a 2-DOF PID) C_r(s) line up one below the other, and the formulas are equally spaced (the space grows with their size); C_r(s) is a formula of its own
- Development: browser test of the aligned equals signs and the equal spacing (with and without a 2-DOF PID)

## v1.58.2 (2026-11-23)
- Transfer functions panel: P(s) first, then C(s), both at the left (they were C(s) first and centred)
- Development: browser test of the order and the left alignment

## v1.58.1 (2026-11-23)
- Layout "Rows": the panels of a row are as tall as the tallest one (the room is left below their content), and follow it when it changes; the handle at the bottom edge stays at the bottom of each panel
- Development: browser test of the equal heights in a row

## v1.58.0 (2026-11-23)
- New layout "Rows (drag ⠿)": the panels sit in rows, each with its own number side by side (1 to 4), so one row can hold the block diagram alone, the next two plots and the next three. Drag a panel by ⠿ (or its title) into another row, between the panels of a row, or near the top or bottom edge of a row into a new row; the arrow keys on ⠿ move it one step. The boundary between two panels of a row changes their widths (arrow keys; double-click: equal widths). Kept in the browser and in scenarios with the layout
- Chosen from another layout, the rows start from what it shows: the block diagram alone on top, then the panels as in that layout; the hidden plots together in a row at the bottom, so that "All" gives rows of one, two and three
- The free arrangement in columns stays as "Free (drag ⠿)"; switching between the layouts keeps both arrangements
- Development: unit tests of the arrangement in rows (stored data, start from a layout, moves, full rows, arrow keys, scenarios) and browser tests (rows of one, two and three, dragging, Escape, arrow keys, boundaries, hidden panels, other layouts, narrow screens, reset); the page code for rows is in src/ts/19-rows.ts

## v1.57.0 (2026-11-23)
- The plots to show are chosen in a drop-down list ("Show" in the plot selection bar) instead of a row of buttons: a check for each plot, several chosen one after another while the list stays open, "All" at the bottom; it closes with the button, a click outside or Escape (arrow keys move between the items). The button names the plots shown
- With the shorter bar, the layout, metrics and "Reset layout" choices stay in the bar on most screens instead of the ⚙ menu
- Development: browser test of the drop-down list (open, several choices, keys, closing, the last plot, reload, language); the other browser tests choose plots through the list

## v1.56.0 (2026-11-23)
- The block diagram is a panel like the plots ("Block diagram" in the plot selection bar): on top across the whole width in the layouts 1 column, 2 columns and 1 row; in the free arrangement it can be moved into any column, so plots can sit to its left or right, and its width follows the column boundary
- The bottom edge of the block diagram panel changes its height (the diagram follows it), as for the plots; the diagram is never wider than its area: it stops growing when it fills the width, and is made smaller when the area becomes narrower or the diagram longer, instead of a scroll bar
- "Reset layout" moved into the plot selection bar (in the ⚙ menu when the bar is narrow)
- A layout saved earlier (in the browser or in a scenario) shows the block diagram too; in a saved free arrangement it goes on top of the first column
- Development: tests of the block diagram panel (place in the presets, bottom edge, columns, hiding, reset), of the panel lists and arrangements with it, and of the width limit; browser tests that click "Reset layout" open the ⚙ menu when needed

## v1.55.2 (2026-11-23)
- The transfer functions are shown smaller by themselves while they do not fit the width of their panel: after the window or the columns become narrower, or a formula becomes longer (another controller or plant). The chosen size is kept, and they grow back to it when there is room again
- Development: tests of the size the formulas are shown at, and of a narrower window and a longer formula in the browser
- Development: fix for the browser test of the width limit, which failed in CI: the arrow keys may go half a pixel further with other fonts (the formulas still fit)

## v1.55.1 (2026-11-23)
- The bottom edge of the transfer functions panel enlarges the formulas only until they fill the width of the panel (they no longer run past it with a scroll bar); the arrow keys stop there too
- Development: tests of the size limited by the width (the formulas fit after a long drag)

## v1.55.0 (2026-11-23)
- The height of the transfer functions panel can be changed: drag its bottom edge (as for the plots), and the formulas are enlarged or shrunk to fit the height. The arrow keys on the edge change it in steps; double-click restores the original size
- The separate handle under the formulas is gone (the bottom edge of the panel does its work); the formulas are hidden with the "Transfer functions" button instead
- Development: tests of the size of the formulas for a height and of the bottom edge of the panel (drag, reload, arrow keys, double-click)

## v1.54.0 (2026-11-22)
- The transfer functions C(s) and P(s) are a panel of the plot area ("Transfer functions" in the plot selection bar): shown at first beside the time response, and shown, hidden and moved (2 columns, free arrangement) like the plots. The handle under the formulas still changes their size
- The block diagram uses the whole width of its card and keeps its previous size on a wide screen ("Fit to width" or its handle makes it larger)
- A layout saved earlier (in the browser or in a scenario) shows the transfer functions panel too, unless the formulas had been hidden
- Development: tests of the new panel, of reading stored panel lists, and of moving the panel; browser tests that need the layout or metrics choice open the ⚙ menu when the bar is too narrow for them

## v1.53.2 (2026-11-22)
- Development: the browser tests run at least two at a time and load the simulator once per test instead of twice (a small start page first), which shortens them from about 200 s to about 120 s
- Development: fix for browser tests that reload the page: what the first page of a new browser context saved was sometimes lost on the reload

## v1.53.1 (2026-11-22)
- The title "Feedback Control Simulator" is shown all in black (the word "Simulator" was red), and is translated as a whole

## v1.53.0 (2026-11-22)
- The "Fit to width" button of the block diagram now enlarges or shrinks the diagram to the width of its area (it only shrank a diagram wider than the area before). It is shown whenever the diagram does not fit the width: narrower (for example without saturation, disturbance and noise) or wider than the area

## v1.52.1 (2026-11-22)
- P control starts with the proportional gain K_P = 1 (the other PID-type controllers keep 2). When the kind of controller is switched, a gain still at the initial value of the previous kind takes that of the new one; a gain changed by hand is kept

## v1.52.0 (2026-11-22)
- The block diagram shows the saturation only while it is enabled (it was shown faded before), and is drawn from the parts in use: without the saturation or the disturbance the blocks move closer together and the diagram gets shorter, at the same scale. The noise and the 2-DOF form are placed the same way

## v1.51.1 (2026-11-22)
- The block diagram shows the disturbance d (with its summing point) only while the step disturbance is added, and the measurement noise n only while its standard deviation is greater than 0; otherwise the signal line runs straight through (they were shown faded before)

## v1.51.0 (2026-11-22)
- The sections under the Bode plot (Curves, Stability margins, Note), the Nyquist plot (Options, Note) and the pole-zero map (Display, Stability, Gain ranges, Pole list, Note, How to use) are in one area each, chosen with tabs like the time response. Each area has one handle: it scales what the selected tab shows (each section keeps its own size), hides the whole area with its tabs when dragged far up, and shows it again at the original sizes with a double-click. The selected tab of each area is remembered; changing how the metrics are shown brings the Response metrics and Stability margins tabs forward
- Fix: after resetting the size of the stability margins and reloading, they took the size of the response metrics again

## v1.50.1 (2026-11-22)
- The tabs "Response metrics" and "Simulation time" are inside their area, which has one handle: dragging it down enlarges what the selected tab shows (each tab keeps its own size), dragging it far up hides the whole area with its tabs, and double-click shows it with both tabs at their original size

## v1.50.0 (2026-11-22)
- The response metrics and the simulation time of the time response area are in one place, chosen with the tabs "Response metrics" and "Simulation time" (arrow keys, Home and End also move between them). The place keeps the height of the taller one, so switching does not move what is below; the chosen tab is remembered in the browser, and changing how the metrics are shown brings their tab forward

## v1.49.0 (2026-11-22)
- The height of the time response, Bode plot, Nyquist plot and pole-zero map areas changes by dragging their bottom edge (in every layout): all the plots of the area grow or shrink by the same ratio, and stop together when one reaches its smallest or largest height. Arrow keys: ±10 %; double-click: original heights. A plot hidden with its own handle is left as it is; the handles under each plot still change one plot

## v1.48.0 (2026-11-22)
- New layout "Free" for the time response, Bode plot, Nyquist plot and pole-zero map: drag the ⠿ handle (or the title) of a plot to move it within a column, onto another column or into a new column at the left or right (up to four columns); the arrow keys on the handle move it one step. Drag the boundary between two columns to change their widths (double-click: equal widths; arrow keys). The heights stay adjustable with the handles under the plots
- The free arrangement is remembered in the browser; a hidden plot comes back in its place, and choosing 1 column, 2 columns or 1 row keeps it for when "Free" is chosen again. Dragging a plot while a preset layout is shown switches to "Free" from what is shown. On a narrow screen the columns are shown one below the other

## v1.47.2 (2026-11-22)
- The plot selection bar stays in one row at every window width: the plot buttons scroll sideways when they do not fit, and the Layout and Metrics choices move into a ⚙ menu when the row is too narrow for them (a label is no longer separated from its choice)
- The metric cards keep their rows when the window width changes: the number of columns comes from the number of cards (4 cards in one row, 6 as 3 × 2, 8 as 4 × 2); only a very narrow panel uses two columns

## v1.47.1 (2026-11-22)
- Development: each tuning rule is one entry of TUNE_RULES (13-tuning.ts) with its menu name, the plant model it uses, what it needs and its gains, and each plot is one entry of PLOTS (03-definitions.ts) with its label, PNG file name and zoom settings; the zoom buttons and help of the plots are made from the table, so adding a rule or a plot takes one entry (see the README); tests check every entry

## v1.47.0 (2026-11-22)
- Development: each kind of plant and controller is described by one entry of a table (PLANTS, CONTROLLERS in 03-definitions.ts) with its menu name, parameters, transfer function and formulas; the menus, inputs, formulas, root locus gain and the stability check follow from it, so adding a kind takes one entry (see "Adding plants, controllers, tuning rules and plots" in the README); a new test checks every entry and every combination
- The note "(with dead time)" in the block diagram is shown only when the dead time is greater than zero, also for the first-order lag + dead time plant

## v1.46.16 (2026-11-22)
- Development: new browser tests for what happens when saving, copying or loading fails (plot data copied to the clipboard when a file cannot be saved, errors when neither works or a plot image cannot be made, copying by hand, full or broken browser storage, unreadable scenario files, broken scenario links, the artifact viewer answering late), and for input checks (number boxes, plant transfer functions, dead time kept per plant, folded sections opened with the keyboard); unit tests for scenarios with unreadable transfer functions and for the tuning messages
- Development: npm run coverage also lists the lines never run, per file, in coverage/uncovered-lines.txt

## v1.46.15 (2026-11-22)
- Development: each source file is an ES module that imports what it uses from the others, so its dependencies are explicit and a missing import is a type error; the build joins the modules into one script as before (no bundler), and variables are changed only by the file that declares them

## v1.46.14 (2026-11-22)
- Development: the calculations (simulation, frequency response, poles and zeros, tuning, specifications) take the settings as a parameter instead of reading the page state, so the parameter sweep no longer changes the settings while it runs; plot colours are named by role in one place; unused code is reported by the type check; the README describes the structure of the script

## v1.46.13 (2026-11-22)
- Fix: hovering a pole or zero on the pole-zero map shows its values again (since 1.46.10 the tooltip appeared only near the root locus)
- Development: the code is formatted with Prettier (checked by GitHub Actions), and long drawing and update functions are split into named steps; the plots are drawn exactly as before

## v1.46.12 (2026-11-22)
- Development: the build scripts, the unit tests and the browser tests are now TypeScript too (ES modules run directly by Node.js 22.18 or later and Playwright), type-checked with strict settings; the tests see the types of the page script

## v1.46.11 (2026-11-22)
- Development: all strict checks of TypeScript are on ("strict"), which completes the migration to TypeScript; errors caught in catch blocks are read safely

## v1.46.10 (2026-11-22)
- Development: the type check now also checks values that can be null or undefined (strictNullChecks); the tuning results are typed as either gains or an error, and a missing element of the page is reported by name

## v1.46.9 (2026-11-21)
- Development: every function and variable of the script has a type (transfer functions, simulation and frequency response results, pole-zero map, sweep, specifications, plots, scenarios, tuning, layout), and the type check now requires types (noImplicitAny)

## v1.46.8 (2026-11-21)
- Development: elements taken by id have their types — $(id) accepts only ids that exist in the page and returns the element type (input, select, canvas, ...), from a map generated from the HTML by the build; byId(id) is used for ids known only at run time

## v1.46.7 (2026-11-21)
- Development: the script is now written in TypeScript (src/ts) and type-checked by npm test and GitHub Actions; the state, layout, scenarios and main helpers have types, and the build removes the types so the page is unchanged

## v1.46.6 (2026-11-21)
- Development: browser tests for the functions that were never run by the tests (sweeps in every plot, pole-zero map options, scenario details, file saving in the artifact viewer, area handles, card folding, change log, timed messages); the tests now run about 95% of the code and all but four error handlers

## v1.46.5 (2026-11-21)
- Development: npm run coverage shows the test coverage of each source file (unit tests, browser tests, both), and new browser tests cover zooming and panning plots, the pole-zero map, transfer function input, held responses, panel and formula sizes, and copying and deleting scenarios (about 91% of the code is now run by the tests)
- Development: remove two unused functions

## v1.46.4 (2026-11-21)
- Development: tests are easier to run — the unit tests load the script directly from src/ (no build needed, every top-level name available), the start-up code is in its own file, the browser tests build the page automatically and find an installed Chrome, and npm run test:all / test:watch were added

## v1.46.3 (2026-11-21)
- Development: add browser tests with Playwright (npm run test:ui): layout at several widths, settings panel, plots and metrics, design aids, scenarios and files, and untranslated text in all five languages; they also run on GitHub Actions

## v1.46.2 (2026-11-21)
- Improve the accuracy of the simulation: the controller update interval is chosen so that the hold delay causes at most about 0.6° of phase error at the gain crossover and at the frequency of a sine or square reference (previously about 3°)
- Tests: reorganized by topic and extended (analytical step responses, every reference type, every controller against its frequency response, every plant with every controller, all tuning tables, analytical disturbance metrics)

## v1.46.1 (2026-11-21)
- Development: the sources are split into src/ (page template, style sheet, translation dictionary, script files) and built into the single file index.html by npm run build; the app itself is unchanged

## v1.46.0 (2026-11-21)
- Smartphones: a bottom bar switches between the settings and the plots (the plots are shown first)
- Smartphones: the plot selection bar stays in one row and scrolls sideways; inputs use 16 px text so that the page does not zoom in
- Touch screens: the plot buttons are always visible and the resize handles are larger

## v1.45.0 (2026-11-21)
- Save the layout with a scenario (shown plots, arrangement, area sizes, curves and options of the plots, tabs and folded cards) and restore it when loading; both can be turned off
- Mark saved scenarios that include a layout (▣)

## v1.44.1 (2026-11-21)
- Keep the header on one line: the description is shortened with an ellipsis (full text on hover) and hidden on narrow screens

## v1.44.0 (2026-11-21)
- When the enlarged block diagram does not fit and a scroll bar appears, show a "Fit to width" button that shrinks the diagram to the width of the area

## v1.43.0 (2026-11-21)
- Make the block diagram compact: when the right column is wide, the diagram and the formulas of C(s) and P(s) are placed side by side

## v1.42.1 (2026-11-21)
- Fix: the response metrics (time response) and the stability margins (Bode plot) can now be resized and hidden independently

## v1.42.0 (2026-11-21)
- Add a table view of the response metrics and stability margins (selected with "Metrics" in the plot selection bar); it shows the values in compact rows, in two columns where the width allows

## v1.41.0 (2026-11-21)
- Add a button (≪) that folds the whole settings panel into a narrow strip so that the plots use the full width; click the strip to show the panel again

## v1.40.0 (2026-11-21)
- Keep the plot selection bar (plots to show, arrangement) at the top of the right column while scrolling

## v1.39.0 (2026-11-21)
- Show the curve selection of the Bode plot as compact toggle buttons with line samples (L, P, C, S, T, Gyd, Gyr); the full description appears on hover and below the buttons

## v1.38.0 (2026-11-21)
- Group the cards of the settings panel into three tabs: System setup (plant, controller, reference, saturation), Analysis & design (specifications, auto-tuning, sweep) and File (save and load, compare and reset)
- Move auto-tuning from the controller card to its own card
- "Show all" and "Hide all" act on the current tab

## v1.37.1 (2026-11-21)
- Rename the card "Scenarios (save and load)" to "Save and load"

## v1.37.0 (2026-11-21)
- Add "Save data (CSV)" to the time response (t, r, y, u, and the sweep), Bode plot (gains and phases of L, P, C, S, T, Gyd, Gyr), Nyquist plot and pole-zero map
- Add a PNG button to each plot to save it as an image

## v1.36.7 (2026-11-21)
- Left-align the formulas of C(s) and Cr(s)

## v1.36.6 (2026-11-21)
- For 2-DOF PID and PI-D, show the reference-side controller Cr(s) (with numbers) under C(s) instead of the control law u

## v1.36.5 (2026-11-21)
- Show the 2-DOF control law as u = (numbers) without the intermediate form Cr(s) r − C(s) y

## v1.36.4 (2026-11-21)
- "Show the specifications on the plots" is now off by default

## v1.36.3 (2026-11-21)
- Show P(s) with the numbers only as well (the symbolic form with K, T, ... is no longer shown)

## v1.36.2 (2026-11-21)
- Show C(s) with the numbers only (the symbolic form with KP, KI, ... is no longer shown)

## v1.36.1 (2026-11-21)
- Show C(s) on the left and P(s) on the right under the block diagram, in the same order as the blocks

## v1.36.0 (2026-11-21)
- Draw the block diagram in the 2-DOF form u = Cr(s) r − C(s) y when 2-DOF PID or PI-D is selected, with a label showing b and c (or PI-D)
- Show the PI-D control law under C(s) as well

## v1.35.0 (2026-11-21)
- Add 2-DOF PID with set-point weights b and c (the control law is shown under C(s)); b and c can also be swept
- Add the Bode plots of the disturbance-to-output Gyd = P/(1+L) and the reference-to-output Gyr = Cr P/(1+L), and the peak disturbance gain
- Show the maximum deviation and the recovery time for the step disturbance
- Add an example exercise on set-point weighting

## v1.34.3 (2026-11-21)
- Make the area under the pole-zero map that shows the stable and specification-meeting gain ranges on the root locus resizable and hideable on its own

## v1.34.2 (2026-11-21)
- Make the option area of the Nyquist plot (circle of radius 1/Ms) resizable and hideable like the other areas

## v1.34.1 (2026-11-21)
- Keep the settings panel beside the plots down to a window width of 641 px (it used to move above the block diagram below 921 px, for example in the artifact viewer next to the chat); the panel narrows with the window
- Stack the formulas of P(s) and C(s) when the right column is narrow

## v1.34.0 (2026-11-21)
- Add "Save to a file" and "Load from a file" for scenarios (.json); a file with a list of scenarios is added to the list in the browser

## v1.33.0 (2026-11-21)
- Add scenarios: save all settings with a name and a task note in the browser, copy them as text or as a link, and load them from pasted text or from the link
- Show the task note of a loaded scenario above the block diagram
- Add three example exercises (third-order PID, PI with dead time, stabilizing an unstable plant)

## v1.32.0 (2026-11-21)
- Add the sensitivity function S(jω) and the complementary sensitivity function T(jω) to the Bode plot
- Show the peak sensitivity Ms, the peak of T (Mt) and the closed-loop bandwidth, and the circle of radius 1/Ms around −1 on the Nyquist plot
- Add the peak sensitivity Ms to the design specifications

## v1.31.0 (2026-11-21)
- Add a parameter sweep: overlay the time response, Bode and Nyquist plots of L(jω) and closed-loop poles for up to 8 values of a plant or controller parameter
- Show a table of overshoot, settling time, phase and gain margins, stability and specification checks for each value; click a row to apply the value

## v1.30.0 (2026-11-21)
- Add PID auto-tuning by tuning rules: Ziegler–Nichols (step response and ultimate sensitivity), CHR (set-point and disturbance, 0% and 20% overshoot) and IMC
- Show the identified model (K, T, L or Ku, Pu) and the tuned gains, and apply them to the controller with one click

## v1.29.0 (2026-11-21)
- Add design specifications (overshoot, settling time, rise time, steady-state error, phase margin, gain margin, closed-loop damping ratio) with pass/fail checks
- Show the specification limits on the time response and Bode plots and the design region on the pole-zero map (second-order approximations)
- Show the gain factor k on the root locus for which all closed-loop poles meet the pole specifications

## v1.28.0 (2026-11-21)
- Add the root locus to the pole-zero map (loop gain multiplied by k from 0 to ∞; k = 1 is the current setting)
- Hover over the root locus to see k, the pole, ζ, and ωn; click to apply that gain to the controller
- Show the stable range of k on the root locus and the corresponding gain margin
- Optional ζ and ωn grid

## v1.27.0 (2026-11-21)
- Zoom and pan the time response, Bode, and Nyquist plots like the pole-zero map (wheel to zoom, Shift/Alt for horizontal/vertical only, drag to pan, double-click to reset, buttons at the top left)
- The time response plots and the Bode plots share their horizontal axes; the Nyquist plot keeps its aspect ratio

## v1.26.2 (2026-11-21)
- The default language follows the browser language again (English if the browser language is not supported)

## v1.26.1 (2026-11-21)
- Write code comments in English
- Rename the artifact to "Feedback Control Simulator"

## v1.26.0 (2026-11-21)
- UI strings in index.html are now written in English; Japanese is one of the translations
- Japanese is the default display language (the selected language is saved in the browser)

## v1.25.1 (2026-11-21)
- Show the change log in English when a language other than Japanese is selected
- Generate English and Japanese versions of README and CHANGELOG

## v1.25.0 (2026-11-21)
- Add Thai

## v1.24.0 (2026-11-21)
- Multilingual support: switch among Japanese, English, Chinese (Simplified), and Korean at the top right (follows the browser language on first visit)

## v1.23.3 (2026-11-21)
- Change the page heading to "Feedback Control Simulator"

## v1.23.2 (2026-11-21)
- Rename to "Feedback Control Simulator"

## v1.23.1 (2026-11-21)
- Change the page subtitle to "time response, frequency response, and pole-zero map"

## v1.23.0 (2026-11-21)
- Enter parameters of the plant, controller, reference, disturbance, saturation, etc. as numbers (values outside the slider range are allowed)

## v1.22.1 (2026-11-21)
- Move the pole-zero selection (plant, controller, closed loop) below the map

## v1.22.0 (2026-11-21)
- Allow resizing and hiding of the non-plot areas of the pole-zero map (selection, instructions, stability verdict, closed-loop pole list, note)

## v1.21.0 (2026-11-21)
- Allow resizing and hiding of the Nyquist plot note (solid/dashed lines)

## v1.20.1 (2026-11-21)
- Show the area name on the handle of a hidden area (e.g. "Output y(t) plot" is hidden)

## v1.20.0 (2026-11-21)
- Allow resizing and hiding of the Bode plot note (how gain and phase margins are found)

## v1.19.1 (2026-11-21)
- Move the Bode plot curve selection (open loop, plant, controller) below the plots

## v1.19.0 (2026-11-21)
- Allow resizing and hiding of the Bode plot curve selection (open loop, plant, controller)

## v1.18.0 (2026-11-21)
- Allow resizing and hiding of the simulation time setting

## v1.17.0 (2026-11-21)
- Show several of time response, Bode plot, Nyquist plot, and pole-zero map at the same time
- Choose the layout (1 column, 2 columns, 1 row); saved in the browser

## v1.16.0 (2026-11-21)
- Overlay the open loop L(jω), plant P(jω), and controller C(jω) in the Bode plot by selection

## v1.15.0 (2026-11-21)
- Add lead, lag, and lead-lag compensators
- Show the maximum phase lead (lag), its frequency, and the low- and high-frequency gains

## v1.14.2 (2026-11-21)
- Shorten the output line of P(s) in the block diagram to reduce the overall width (fits better when enlarged)

## v1.14.1 (2026-11-21)
- Make the P(s) block in the block diagram as narrow as C(s) (the dead-time note is shown below the block)

## v1.14.0 (2026-11-21)
- Add version number and change log display (click the version at the top right)

## v1.13.0 (2026-11-21)
- Add the "Pole-zero map" tab: poles and zeros of the plant, controller, and closed loop in the complex plane
- Show the closed-loop pole list (damping ratio, natural frequency, time constant) and stability verdict
- Handle dead time with a third-order Padé approximation

## v1.12.0 (2026-11-21)
- Extend the simulation time to 0.01–10000 s (log-scale slider and numeric input)
- Compute the state equations with exact discretization by the matrix exponential
- Update the controller between recorded points when the closed loop is fast
- Choose the frequency range of the Bode and Nyquist plots automatically

## v1.11.0 (2026-11-21)
- Show P(s) and C(s) in two lines: symbolic form and with numbers substituted

## v1.10.0 (2026-11-21)
- Add reference types: step, ramp, parabola, trapezoid, pulse, square wave, sine wave
- Show response metrics according to the reference type (amplitude ratio, phase difference, and theory for sine waves)

## v1.9.4 (2026-11-21)
- Rename to "Control System Simulator (analysis and design of feedback control systems)"

## v1.9.3 (2026-11-21)
- Revise the page subtitle

## v1.9.2 (2026-11-21)
- Remove "PID" from the name

## v1.9.1 (2026-11-21)
- Hide "Examples, Properties, Syntax, Dead time" of the transfer function input by default

## v1.9.0 (2026-11-21)
- Show/hide "Examples, Properties, Syntax, Dead time" of the transfer function input individually

## v1.8.0 (2026-11-21)
- Show/hide each card on the left by clicking its heading; add "Show all / Hide all"

## v1.7.2 (2026-11-21)
- Fix resizing of the formulas (P(s), C(s)) having no effect

## v1.7.1 (2026-11-21)
- Reduce the minimum font size of the formulas to 4 px

## v1.7.0 (2026-11-21)
- Hide an area by shrinking it below its minimum size

## v1.6.0 (2026-11-21)
- Allow resizing of the response metrics and stability margins

## v1.5.0 (2026-11-21)
- Allow resizing of the transfer function (formula) display

## v1.4.0 (2026-11-21)
- Change the heights of the block diagram and plots and the column widths by dragging (saved in the browser)

## v1.3.0 (2026-11-21)
- Scroll the left and right columns independently

## v1.2.0 (2026-11-21)
- Enter the controller as a transfer function (can be converted from the PID settings)

## v1.1.0 (2026-11-21)
- Enter the plant as a transfer function (poles/zeros display, dead time)

## v1.0.0 (2026-11-21)
- First release: PID feedback control system (6 plants, disturbance, noise, saturation)
- Time response, Bode plot, Nyquist plot; hold and compare responses
