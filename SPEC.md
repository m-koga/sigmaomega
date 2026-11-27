# SigmaOmega — Feedback Control Simulator: Specification

English | [日本語](SPEC.ja.md)

SigmaOmega (Feedback Control Simulator) is teaching software for control engineering that runs entirely in the browser. When you choose a plant and a controller and change their values, the time response, frequency response and pole-zero map are redrawn at once. This document describes version 1.61.4 (24 November 2026).

## 1. Overview

| Item | Description |
| --- | --- |
| Name | SigmaOmega, with the subtitle Feedback Control Simulator (translated with the page; the name is not). From *s* = σ + *j*ω. The keys of the browser storage and of saved files keep the earlier short name `ctrlsim` |
| Author | Masanobu Koga, Kyushu Institute of Technology |
| License | Apache License 2.0 (`LICENSE`, `NOTICE`; shown with the copyright notice; every source file starts with `SPDX-License-Identifier: Apache-2.0` and the copyright line) |
| Copyright | Copyright © 2026 Masanobu Koga (at the top of the page source and at the bottom of the change log and the user manual; the years run from the first to the last entry of the change log) |
| Purpose | Let students try the analysis and design of feedback control systems, based on block diagrams, in lectures and exercises |
| Main users | Students of control engineering; teachers showing examples in lectures |
| How it is used | Open one HTML file (`index.html`) in a browser. No server-side computation or sign-in |
| Publication | A claude.ai artifact (shared within the organization); source on GitHub (`m-koga/sigmaomega`). A version tag pushed by the maintainer makes a GitHub release with `index.html` and the site as a zip file, and deploys the site to GitHub Pages when Pages is set to GitHub Actions (`.github/workflows/release.yml`); `CITATION.cff` gives the reference. For the GitHub Pages site, `npm run pages` writes the page with a web app manifest and its icons (192×192, 512×512 and a maskable 512×512), so that the site can be installed as an app |
| Systems covered | Single-input single-output linear time-invariant systems (dead time included) in a single feedback loop |

Terms: P(s) is the plant, C(s) the controller, L(s) = C(s)P(s) the open-loop transfer function, S = 1/(1+L) the sensitivity function and T = L/(1+L) the complementary sensitivity function. A "panel" is a frame that shows one plot, a "card" is a group of inputs in the settings panel, and a "scenario" is a named copy of all the settings.

## 2. Screen layout

From top to bottom the screen has three bands: the header, the menu bar, and the settings panel (left) beside the plot panels (right). The header holds the icon (σ and ω on the axes of the s-plane, also the icon of the browser tab, and as a 180×180 PNG the icon added to the home screen of a phone), the name SigmaOmega with the subtitle Feedback Control Simulator (the subtitle is left out on screens 480 px wide or less), the version number (which opens the change log) and the language selector.

### 2.1 Menu bar

All menus sit in the menu bar in the order below. The menu bar is a dark band; each menu shows a line icon before its name (left out below about 960 px wide, so that the menus stay on one line). Each is a drop-down: when closed it shows only its name; when open, the selected items carry a ✓. The open menu, and the menu whose card is in the settings panel, are underlined in red; the lists fade in under the bar and are moved left when they would run past the right edge.

| Menu | Items | Choosing an item |
| --- | --- | --- |
| File | Save and load, Compare & reset | Shows that one card in the settings panel |
| Plots to show | Block diagram, Time response, Transfer functions, Loop transfer functions, Poles and zeros, Bode plot, Nyquist plot, Nichols chart, Pole-zero map, All | Shows or hides plot panels (several at once; the list stays open; the last panel cannot be hidden); All shows these nine |
| System setup | Plant P(s), Controller C(s), Reference/disturbance/noise, Actuator saturation | Shows that card in the settings panel |
| Analysis & design | Design specifications, Auto-tuning (tuning rules), Lead and lag compensator design, Parameter sweep, Estimation exercise; below a separator, Routh–Hurwitz test, Steady-state error | A card: shows it in the settings panel. The last two show or hide their panels like the items of Plots to show (checked when shown; the list stays open) |
| Plot arrangement | 1 column, 2 columns, 1 row, Free (drag ⠿), Rows (drag ⠿) | Changes how the plot panels are arranged |
| Metrics display | Cards, Table | Changes how the response metrics are shown |
| Help (button at the right end) | — | Opens the user manual in a dialog: a list of its eleven sections (one of them walks through the four exercises step by step, with screenshots of the plots and tables it describes, of the English or the Japanese screen); figures and tables are numbered by section (Fig. 8.1, Table 2.1) with captions, and a reference in the text scrolls to its figure or table beside the text (above it on phones), in English and Japanese (English with a note in Chinese, Korean, Thai, French, German and Spanish); × , Esc or a click beside it closes it. On phones the button shows only its icon |

A drop-down opens and closes with its button, and closes on a click outside the list or on Esc. While it is open, ↑ and ↓ move between items and Enter chooses one. Only one drop-down is open at a time.

### 2.2 Settings panel

- The panel shows only the one card chosen from a menu (at first, Plant P(s)). The menu that holds the shown card is marked on its button.
- Its width changes by dragging its right edge, and ≪ folds it into a narrow strip. Choosing a card while it is folded opens it again.

### 2.3 Plot panels

There are eleven panels: block diagram, time response, transfer functions, loop transfer functions, poles and zeros, Routh–Hurwitz test, steady-state error, Bode plot, Nyquist plot, Nichols chart and pole-zero map. At first the block diagram (full width at the top) and the time response and transfer functions (side by side below it) are shown. The ⠿ handle in each panel's title moves the panel, and its bottom edge changes its height (section 7). The plot buttons (+, −, Fit, PNG) appear only while the mouse is over the plot, while it has keyboard focus, or while it is zoomed. The × at the right end of each panel's title hides the panel, like its item in "Plots to show" (which shows it again); it is not available for the last panel shown.

### 2.4 Narrow screens and smartphones

| Screen width | Display |
| --- | --- |
| About 800 px or more | Menu bar on one line; settings panel and plots side by side |
| 920 px or less | Plot panels in one column (the ⠿ handles are hidden) |
| Under about 800 px | Menu bar wraps onto two lines |
| 640 px or less | The menus show short names (File, Plots, System, Design, Layout, Metrics) and Help only its icon, so that the menu bar takes at most two lines in every language |
| Smartphone | A bar at the bottom switches between "Settings" and "Plots". The menu bar stays at the top and lists open across the full screen width. Choosing a card switches to "Settings"; choosing plots, an arrangement or a metrics display switches to "Plots" |

## 3. System settings

The system is a single loop: reference r → controller C(s) → control input u → plant P(s) → output y. The disturbance d is added at the plant input and the measurement noise n at the measured output. Values are entered with sliders or number fields; a number field also accepts, on Enter, values outside the slider's range.

### 3.1 Plant P(s)

| Kind | Transfer function | Parameters |
| --- | --- | --- |
| First-order lag | K/(Ts+1) | K, T |
| Second-order system | Kωn²/(s²+2ζωn s+ωn²) | K, ζ, ωn |
| Third-order lag (equal time constants) | K/(Ts+1)³ | K, T |
| First-order lag + dead time | K e^(−Ls)/(Ts+1) | K, T, L |
| Integrator + first-order lag | K/(s(Ts+1)) | K, T |
| Unstable first-order | K/(Ts−1) | K, T |
| Enter transfer function | N(s)/D(s)·e^(−Ls) | Numerator and denominator polynomials, dead time L |

An entered transfer function is written as an expression in s, such as `2*s + 1` or `(s+1)^2(0.5s+1)`, or as a coefficient vector in descending powers, such as `[1 3 2]`. The denominator may be up to degree 10, and the numerator degree must be less than the denominator degree (strictly proper). The poles, zeros, DC gain and stability are shown as it is typed, and errors are explained.

### 3.2 Controller C(s)

| Kind | Parameters | Notes |
| --- | --- | --- |
| P / PI / PD / PID | K_P, K_I, K_D, derivative filter coefficient N | The derivative is filtered: K_D s·N/(s+N) |
| PI-D | Same | The derivative acts on the output y only |
| Two-degree-of-freedom PID | Same, plus set-point weights b and c | u = C_r(s) r − C(s) y; the block diagram changes to this form |
| Lead, lag and lead-lag compensators | K_c, T_1, α (0<α<1), T_2, β (β>1) | |
| Enter transfer function | Numerator N_c(s), denominator D_c(s) | Must be proper. Can be converted from P/PI/PD/PID settings |

Anti-windup (conditional integration) and PI-D are available only for P/PI/PD/PID.

### 3.3 Reference, disturbance and noise

- Reference r(t): step, ramp (constant velocity), parabola (constant acceleration), trapezoid, pulse (single), square wave, sine wave, impulse A δ(t − t_0). The start time t_0 is set, together with the size, slope, period T_p and so on for each kind. The impulse is applied in the simulation as a pulse of area A over the substep that contains t_0; the recorded r and u leave it out (a vertical line marks t_0).
- Disturbance: a step added at the plant input, with its size d and the time it is applied.
- Measurement noise: normally distributed with standard deviation σ_n. The random seed is fixed, so the same settings always give the same waveform.

### 3.4 Actuator saturation

A saturation \|u\| ≤ u_max can be added. With PID-type controllers, anti-windup can stop the integration while the input is saturated. Saturation, disturbance and noise appear in the block diagram only when they are used.

## 4. Analysis

Every change of a setting recomputes all shown plots and metrics. In every plot the wheel zooms, dragging pans and a double-click resets the view.

| Plot | Shows | Main metrics |
| --- | --- | --- |
| Block diagram | The current structure (one or two degrees of freedom; saturation, disturbance and noise only when used) | — |
| Transfer functions | P(s) and C(s) (and C_r(s) with two degrees of freedom) in one column, aligned at "=" | — |
| Loop transfer functions | The ones chosen with the buttons of the panel among L(s), S(s), T(s), G_yr(s) and G_yd(s) (at first L(s) and G_yr(s)), each as "name = definition = rational function with the numbers", aligned at the first "="; the dead time is kept as e^(−Ls), the denominator made monic, common factors not cancelled | — |
| Poles and zeros | A table of the poles and zeros of the transfer functions chosen with the buttons of the panel among P(s), C(s), L(s), S(s), T(s), G_yr(s) and G_yd(s) (at first P(s), C(s) and T(s)), as written in the loop transfer functions panel (common factors not cancelled; the dead time has no zeros): a conjugate pair as one entry, sorted from the right, the poles and the zeros side by side; poles with Re > 0 in red. With a dead time the closed-loop poles come from the third-order Padé approximation (noted under the table) | — |
| Routh–Hurwitz test | The characteristic equation 1 + L(s) = 0 (numerator plus denominator of L, as written in the loop transfer functions panel) and its Routh table for the current setting: the first column in bold, negative entries in red, the number of sign changes (= closed-loop poles with Re > 0) and the verdict. A zero first entry is replaced by ε → +0; a row of zeros (marked *) by the derivative of the auxiliary polynomial (poles on the imaginary axis: marginally stable). Below: with the controller multiplied by a gain factor k, the first column as a0, Δ1, Δ2/Δ1, …, Δn/Δn−1 (Hurwitz determinants, polynomials in k), the range of k > 0 where each is positive, the range where all are positive (with P control also as K_P), and the range from the root locus for comparison. With a dead time, the third-order Padé approximation is used (noted) | — |
| Steady-state error | The system type of L(s) (poles at the origin, from N(s)/D(s) without the dead time, since e^(−Ls) → 1) with L(s) ≃ K/s^type, and the error constants K_p = lim L, K_v = lim sL, K_a = lim s²L (∞ above the type, 0 below; all 0 when L(s) has a zero at the origin). The steady-state errors of e = r − y to a step, ramp and parabola of the reference, from the Taylor series of E(s)/R(s) = 1 − G_yr(s) at s = 0 (per unit input; for the current reference — step or trapezoid, ramp, parabola — also with its amplitude, the row highlighted, beside the simulated error at the end of the window before the disturbance). Without set-point weights these equal r0/(1+K_p), v/K_v, a/K_a; with them the formula values are shown in small type. The error to a step disturbance at the plant input, −d·G_yd(0), beside its simulated change. A warning when the closed loop is unstable or has a pole at the origin; notes on dead time, saturation and noise | — |
| Time response | r, y, u and the held responses for comparison (gray, up to 4); optionally (tab “Display”, off at first) the response of the plant alone to r(t) — P(s) with its dead time driven by r itself (an impulse as in the closed loop), without the controller, the feedback, the saturation, the disturbance and the noise, on the same time points; a diverging response stops and leaves the plot. “Only the plant alone” (off at first) shows the plant by itself instead: the titles change, the upper plot has only the plant's output and the lower one its input (the signal set as the reference; an impulse marked by a line), the metrics are the plant's own — for a step or trapezoid the final value, rise time, overshoot and settling time relative to the final value and the steady-state gain y/u, for an impulse its peak, time and area, otherwise y at the end and the largest |y| — and a diverging plant gets its own banner; the block diagram shows the plant alone, u → P(s) → y (with the dead-time note). This option is the first of the tab | Rise time (10% → 90%), overshoot, settling time (±2%), steady-state error, peak deviation and recovery time after a disturbance; for a sine reference, amplitude ratio and phase difference; for an impulse, the peak of y and its time, the area ∫y dt beside its theory A·T(0) (A·Gyr(0) with set-point weights), y at the end and the largest |u| without the impulse |
| Bode plot | L, P, C, S, T, G_yd = P/(1+L) and G_yr = C_r P/(1+L), switched with buttons; the legend is shown even for one curve; the frequency range can be set by hand (section 9); the button “L asymptotes” (off at first) adds the straight-line approximation of the gain of L — K/ω^q at low frequencies, a change of slope of ±20 dB/dec per real pole or zero and ±40 per complex pair at |s|, the dead time left out — and of its phase — −90°·q at low frequencies, a change of ∓90° per real pole or zero along a straight line from ω_b/10 to 10ω_b and ∓180° per complex pair from ω_n·10^(−ζ) to ω_n·10^ζ (opposite signs in the right half-plane), plus the exact −ωL of the dead time, shifted by a multiple of 360° onto the plotted phase — with the break frequencies (○); the button “Factors of the asymptotes” (off at first) draws the gain and phase lines of each factor — K/s^q (carrying the 360° shift), each distinct pole and zero (a complex pair as one, with its multiplicity), the dead time — in its own color, named in the legend; their sum is the asymptote | Gain margin, phase margin, peak sensitivity Ms, Mt, closed-loop bandwidth, peak disturbance gain; break frequencies (tab: the low-frequency line, each break frequency with its poles and zeros, the change of slope, the slope after, the true gain minus the asymptote there, and the change of phase with the frequencies over which it is made; this tab makes the area taller only while shown); note (the frequency range of the margins, and the method of the straight-line approximation for the gain, the phase and the dead time; this tab also makes the area taller only while shown) |
| Nyquist plot | L(jω), the point −1, a circle of radius 1/Ms, the crossings of the real axis to the left of −1 (option, off at first: ▲ from below to above = clockwise +1, ▼ = −1, with the count of the crossings at that point, ω > 0 and ω < 0 together) | The Nyquist criterion (tab: P open-loop poles in the right half-plane, N clockwise encirclements of −1 along the Nyquist contour — passing poles on the imaginary axis by small half circles on their right, with the exact dead time — Z = N + P with the verdict, the crossings one by one with ω or on a half circle, their sum; when L(jω) passes through −1, marginally stable and N not defined; this tab makes the area taller only while shown), note |
| Nichols chart | The gain of L(jω) [dB] against its phase [deg] (ω > 0, with the sweep), over the M contours of the closed loop |T| = |L/(1+L)| for M = 12, 6, 3, 1, 0.5, 0, −1, −3, −6, −12, −20 dB (repeating every 360°, labels at the critical point for M ≥ 0 and to its right for M < 0), the critical points (−180° − 360°k, 0 dB) and a line at −180°; zoomed like the other plots | Note (how to read Mt and the margins) |
| Pole-zero map | Closed-loop poles, zeros, root locus (loop gain scaled by k), construction rules of the root locus (option, off at first: real-axis segments as a band, asymptotes dashed from their centroid, breakaway and break-in points □, imaginary-axis crossings ◇, departure and arrival angles as arrows with their values), ζ and ωn grid, design region | Stability, range of k for stability, the construction rules (tab “Locus rules”: n and m, real-axis segments, asymptote angles and centroid, breakaway and break-in points with k, imaginary-axis crossings with k, departure and arrival angles; for the 0° locus when the leading coefficients of N and D have opposite signs; with a dead time from the Padé approximation; this tab makes the area taller only while shown), list of poles (ζ, ωn) |

### 4.1 Using the root locus

- Hovering over the locus shows k, the pole, ζ and ωn at that point.
- Clicking applies that k as a factor on the controller gain (also for a controller entered as a transfer function).
- Dead time is replaced by a third-order Padé approximation to compute the poles, and a note says so. When saturation is used, a note says the pole-zero map is that of the linear system without saturation.

### 4.2 Metrics display

Metrics are shown in the area under each plot, as cards or as a table, chosen in the "Metrics display" menu. The area has tabs (for the time response: response metrics and simulation time), a handle to resize it, and can be hidden. When the response diverges, no metrics are shown and the divergence is reported.

### 4.3 Comparison

Holding the current response in the "Compare & reset" card overlays it as a gray line on later responses (up to 4). The same card clears the held responses and resets the settings to their defaults.

## 5. Design support

Five cards in the "Analysis & design" menu check design specifications, tune controllers with tuning rules, design lead and lag compensators, sweep parameters, and give an estimation exercise.

### 5.1 Design specifications

Each specification is switched on or off, and each one that is on is checked with ✓/✗.

| Specification | Unit | Shown in |
| --- | --- | --- |
| Overshoot (at most) | % | Limit line in the time response; ζ boundary in the pole-zero map |
| Settling time (at most) | s | Limit line in the time response; −Re ≥ 4/t_s in the pole-zero map |
| Rise time (at most) | s | Limit line in the time response |
| Steady-state error (at most) | — | — |
| Phase margin (at least) | ° | Bode plot |
| Gain margin (at least) | dB | Bode plot |
| Peak sensitivity Ms (at most) | — | Circle in the Nyquist plot |
| Damping ratio ζ (at least) | — | Design region in the pole-zero map |

The overshoot, settling-time and ζ specifications define a design region for the poles (second-order approximation), and the range of k on the root locus that keeps the poles in that region is shown.

### 5.2 Auto-tuning (tuning rules)

A model is identified from the plant, and the gains for the chosen rule and controller type (P, PI, PID) are computed and shown. The "Apply" button puts them into the controller.

| Rule | Model used |
| --- | --- |
| Ziegler–Nichols (step response) | First-order lag + dead time identified from the step response |
| Ziegler–Nichols (ultimate sensitivity) | Ultimate gain and ultimate period |
| CHR (set-point, 0% / 20% overshoot) | Step-response model |
| CHR (disturbance, 0% / 20% overshoot) | Step-response model |
| IMC | First-order lag + dead time model. Filter time constant λ given, or automatic (max(1.7L, 0.25T) for PI, max(0.8L, 0.25T) for PID) |

For unstable plants, or types a rule does not cover, the reason is shown instead of gains.

### 5.3 Lead and lag compensator design

From the frequency response of K_c P(s) (K_c given, for the steady-state error; the dead time included), with the target phase margin PM* and the allowance θ:

| Kind | Steps | Compensator |
| --- | --- | --- |
| Lead | ω_gc and PM of K_c P; φ_m = PM* − PM + θ; α = (1 − sin φ_m)/(1 + sin φ_m); ω_m where \|K_c P(jω)\| = √α; T_1 = 1/(ω_m √α) | C(s) = K_c (T_1 s + 1)/(α T_1 s + 1) |
| Lag | ω_gc and PM of K_c P; ω where the phase of K_c P is −180° + PM* + θ; β = \|K_c P(jω)\| there; T_2 = 10/ω | C(s) = K_c (T_2 s + 1)/(β T_2 s + 1) |
| Lead-lag | ω_gc and PM of K_c P; the new crossover ω_c (the phase crossover of K_c P, where its phase is −180°, or given); φ_m = PM* + θ − (180° + ∠K_c P(jω_c)); α as for the lead; T_1 = 1/(ω_c √α); β = \|K_c P(jω_c)\|/√α; T_2 = 10/ω_c | C(s) = K_c (T_1 s + 1)/(α T_1 s + 1) · (T_2 s + 1)/(β T_2 s + 1) |

The phase margin of C(s)P(s) is then computed. No design is made when K_c P has no gain crossover, when its phase margin already meets PM*, when a lead would have to add more than 80°, or when no frequency has the required gain or phase; for the lead-lag also when no phase lead is needed at ω_c (a lag is enough) or no attenuation (a lead is enough). The new crossover ω_c is asked only for the lead-lag (blank: automatic). "Apply to the controller" sets the compensator (rounded to 4 significant digits). The settings are kept with the scenario.

### 5.4 Parameter sweep

One parameter of the plant or the controller is given up to 8 values, and the results for every value are overlaid in all plots in different colors. A table lists overshoot, settling time, stability margins, stability and the specification checks for each value; choosing a row applies that value to the settings.

### 5.5 Estimation exercise

The exercise number n (from 1) determines a hidden plant K e^(−Ls)/(Ts + 1) through a seeded random generator: K in 0.5 … 3 (2 decimals), T in 0.5 … 5 s (1 decimal), L in 0.1 … min(2, T) s (steps of 0.05). The card draws its unit step response over 0 … L + 5T (rounded up to an even number of seconds) with the unit step, and shows t and y under the mouse. "Check" draws the response of the estimates over it and marks each estimate ✓ when its relative error is at most 10 %; "Show the answer" gives the true values; "Use this plant" sets the plant to the first-order lag + dead time with those values. "New exercise" chooses n at random; n is kept with the scenario. The exercise does not change the simulation until "Use this plant".

"Read from" (kept with the scenario) switches to the Bode plot. The exercise number n then determines, through another seeded generator, one of three hidden plants, each about as often: K/((T1 s + 1)(T2 s + 1)) with K in 0.5 … 5 (2 decimals), T1 in 1 … 10 s (1 decimal), T2 = T1/(5 … 20) (2 significant digits); K e^(−Ls)/(Ts + 1) with the ranges above; K ωn²/(s² + 2ζωn s + ωn²) with K in 0.5 … 3 (2 decimals), ωn in 0.5 … 10 rad/s (log-uniform, 2 significant digits), ζ in 0.1 … 0.7 (steps of 0.05). The card draws the gain [dB] and the continuous phase [deg] over whole decades from a decade below the lowest corner (1/T1, 1/T or ωn/100) to beyond the highest (10/T2, 10/T or 100 ωn), in the vertical range of the true curves, and shows ω, the gain and the phase under the mouse. The labels of the three inputs follow the plant. The check is the same (T1 and T2 may be entered in either order); "Use this plant" sets the transfer function K/((T1 s + 1)(T2 s + 1)) (entered transfer function, L = 0), the first-order lag + dead time, or the second-order system.

## 6. Files

Scenarios are handled in the "Save and load" card of the "File" menu, and each plot's buttons export its data and image. "Compare & reset" holds responses (4.3) and resets to defaults.

### 6.1 Scenarios

A scenario holds all the settings with a name and a task text. Whether it includes the layout (plots shown, arrangement and sizes), and whether loading applies a saved layout, can each be chosen. Loaded values are checked; out-of-range or broken content is rejected with a reason.

| Action | Destination / format |
| --- | --- |
| Save in this browser | Browser storage (`ctrlsim-scenarios-v1`) |
| Save to / load from a file | .json file; a file with several scenarios can also be loaded |
| Copy as text | Clipboard; paste the text to load it |
| Copy as link | Encoded in `#s=` of the page URL; opening the link loads the scenario |
| Delete | Confirmed by a second click |

Three exercise scenarios are included (for example: PID control of a third-order plant with at most 12% overshoot, a settling time of at most 10 s and a phase margin of at least 45°; PI control of a plant with dead time with a phase margin of at least 60° and Ms of at most 1.6).

### 6.2 Export

| Plot | CSV columns | PNG |
| --- | --- | --- |
| Time response | t, r, y, u, y and u for each swept value, and y of the plant alone when it is shown (with only the plant alone: t, u, y of the plant, file plant_response.csv) | Yes |
| Bode plot | ω and the gain [dB] and phase [deg] of L, P, C, S, T, G_yd and G_yr | Yes |
| Nyquist plot | ω, Re L, Im L | Yes |
| Nichols chart | ω, phase of L [deg], gain of L [dB] | Yes |
| Pole-zero map | Kind, Re, Im, ζ, ωn | Yes |

Where files cannot be saved (for example in the artifact viewer), the content is copied to the clipboard instead; if that also fails, the text is shown selected so it can be copied by hand.

### 6.3 Reset the layout

"Reset the layout" in "Compare & reset" brings back the first layout: the plots shown, their arrangement and the panel sizes. The system settings, the card shown and the metrics display are kept.

## 7. Display and layout

The plot panels are arranged in one of five ways, and their positions, widths and heights are remembered in the browser (storage key `ctrlsim-layout-v1`).

| Arrangement | Layout | What can be changed |
| --- | --- | --- |
| 1 column | Block diagram full width at the top, then the plots in one column | Heights |
| 2 columns | Block diagram full width at the top, then two columns | Heights |
| 1 row | Block diagram full width at the top, then one row | Heights |
| Free (drag ⠿) | Up to 4 columns, each a stack of panels | Move a panel within a column, to another column or to a new column by dragging ⠿ or with the arrow keys; column widths at the column borders |
| Rows (drag ⠿) | Each row holds 1, 2 or 3 panels side by side; panels in a row take the height of the tallest | Move a panel to another row or a new row with ⠿ (a full row takes no more); widths at the borders within a row |

Common operations:

- Borders and bottom handles work by dragging, with the arrow keys, and by double-click (reset). Esc cancels a drag.
- A hidden panel keeps its place in the layout and returns there when shown again.
- In the free arrangement, the area's bottom edge resizes all plots by the same factor, stopping when the first plot reaches its limit.

### 7.1 Transfer functions panel

- P(s) and C(s) are shown in that order, left-aligned in one column, with their "=" aligned and equal spacing between formulas. With two-degree-of-freedom PID, C_r(s) is added in the same way.
- Changing the panel height at its bottom edge scales the formulas to fit the height, stopping at the panel width.
- When the window narrows or a formula grows longer, the formulas shrink automatically, and return to their size when there is room again.

### 7.2 Loop transfer functions panel

- The buttons at the top choose the formulas; with none chosen, a note says so. The choice is saved with the layout of a scenario.
- The bottom edge scales the formulas as in the transfer functions panel (7.1), with a size of its own (stored with the layout); they also shrink to fit the width.
- G_yr(s) is defined with C_r(s) when set-point weights (or PI-D) make the controller act on the reference differently, otherwise with C(s).

### 7.3 Block diagram panel

- Its width and height can be changed, and the diagram never exceeds the panel width. The height handle stops where the diagram fills the width.
- Like the plots, it has the buttons +, −, Fit and PNG (shown while the mouse is over it, while one of them has keyboard focus, or while zoomed). Zooming changes only the part of the drawing shown, not the size of the panel: the wheel zooms at the pointer (up to 8 times), a drag pans, a double-click or Fit shows the whole drawing again, and so does a new drawing (another structure or language). PNG saves the part shown, at twice its size on the screen, as block_diagram.png.
- In the free and rows arrangements, plots can be placed to its left and right like any other panel.

### 7.4 Accessibility

All menus, handles and moves can be operated with the keyboard. Plot buttons also appear when the plot has keyboard focus.

## 8. Languages

The interface can be shown in five languages, chosen at the top right of the header.

| Item | Specification |
| --- | --- |
| Languages | English, Japanese, Chinese (Simplified), Korean, Thai, French, German, Spanish |
| First language | The first supported language in the browser's language settings; otherwise English |
| Remembered | The chosen language is saved in the browser (`ctrlsim-lang`) |
| Dictionary | `src/i18n.json`. Keys are the English strings; 629 entries in version 1.96.0, each with Japanese, Chinese, Korean, Thai, French, German and Spanish translations |
| Covered | Menus, cards, metrics, notes, messages, tooltips, the change log (English and Japanese), names and task texts of the exercise scenarios |

Formulas are shown with MathJax (TeX, SVG output); TeX inside translated text is used as is in every language. Tests check that placeholders such as `{n}` match in every translation (section 11).

## 9. Computation methods

The time response is computed by exact discretization of the plant; the frequency response is computed directly by substituting s = jω into the transfer functions. Everything runs in JavaScript in the browser.

| Computation | Method |
| --- | --- |
| State-space model | Transfer function converted to controllable canonical form |
| Discretization | Exact zero-order-hold discretization with the matrix exponential (scaling and squaring + Taylor series) |
| Time step | 4,000 recorded points (dt = simulation time / 4000). Each step is split into up to 100 substeps h so that ωh ≤ 0.02 (phase error at most 0.6°) at the gain crossover frequency, at the frequency of a periodic reference and at the fastest dynamics of the controller (the derivative filter N, or the largest pole of a controller given as a transfer function); the controller is updated at each substep |
| Controller | The output held over each substep is the exact average of the continuous controller's output over it, for the error held over the substep: for PID types the integral part adds e·h/2 and the filtered derivative part is scaled by (1 − e^(−Nh))/(Nh); a controller given as a transfer function uses the average obtained from the exponential of an augmented matrix. So a PID and the same controller entered as a transfer function give the same response |
| Dead time | In the time response, a buffer delaying the input by L/h substeps; when L/h is not a whole number, the delayed input over a substep is the average of the two held values it overlaps (no rounding). In the frequency response, e^(−jωL) exactly. For the poles, a third-order Padé approximation |
| Noise | Seeded pseudo-random numbers (Mulberry32) with the Box–Muller method |
| Divergence | The simulation stops when y or u is no longer finite or the magnitude of y exceeds a limit |
| Response metrics | Rise 10% → 90% and settling ±2%, with the crossing times interpolated linearly between the recorded points; overshoot from a parabola through the largest recorded point and its neighbours; steady-state error at the last point. For a sine reference, amplitude ratio and phase difference from the Fourier coefficients over the last whole periods. Ms and Mt: the largest value on the frequency grid, refined between the neighbouring grid points by golden-section search |
| Frequency range | Chosen automatically from the poles and zeros of the plant and controller, the dead time and the simulation time (from 1/100 of the smallest to 100 times the largest, in whole decades); logarithmically spaced, 150 points per decade (at most 2,400). The range of the Bode plot can be set by hand under the plot ("Frequency range", 10⁻⁷ – 10⁷ rad/s); it stays until "Auto" is pressed or the poles, zeros, dead time or simulation time change (a gain alone keeps it), and also applies to the curves of a parameter sweep and to the CSV of the Bode plot. The stability margins and the other frequency-domain metrics, and the Nyquist plot, always use the automatic range |
| Polynomial roots | Durand–Kerner method |
| Root locus | Roots of the characteristic polynomial for each loop-gain factor k, starting from the roots for the previous k so that branches connect |
| Disturbance metrics | Peak deviation after the disturbance is applied, and the recovery time after it |

The numerical accuracy of these methods, the way it was evaluated and the results are in [ACCURACY.md](ACCURACY.md) (`npm run accuracy` prints the tables; `tests/accuracy.test.ts` checks the bounds). Tests also check that the time response matches the analytic solutions of first- and second-order closed loops, and that the frequency response matches simulations with sine inputs (section 11).

The work for one change has upper limits: at most 4000 recorded points × 100 time steps, 2400 frequencies, 642 gain values for the root locus (only while the pole-zero map is shown) and 8 sweep values. The times measured in Chrome, at normal speed and with the processor slowed down 4 times, are in [PERFORMANCE.md](PERFORMANCE.md) (`npm run performance`; `tests/performance.test.ts` checks that the heaviest computations stay fast).

## 10. Non-functional requirements

| Item | Requirement |
| --- | --- |
| Distribution | One HTML file (about 531 KB in version 1.61.4) containing the stylesheet, script, translation dictionary and change log |
| External dependencies | MathJax 3 from the jsDelivr CDN only. Everything except formulas works without it |
| Server | None for computing. All computation and storage happens in the browser, and the simulator sends no settings or results anywhere. When the page opens, the browser loads the fonts (Google Fonts) and MathJax (jsDelivr); these requests carry the IP address and browser, as for any web page, but no settings. A link made with Copy link keeps the settings after `#`, which is not sent to the server |
| Environment | Current browsers (tested with Chromium). Desktop, tablet and smartphone screen widths (section 2.4) |
| Responsiveness | Moving a slider redraws all plots immediately |
| Storage | `ctrlsim-layout-v1` (layout), `ctrlsim-scenarios-v1` (scenarios), `ctrlsim-lang` (language). Content saved by earlier versions is converted so it can still be loaded |
| Failure handling | When browser storage is full, broken or unavailable, when files cannot be saved, or when copying fails, the page keeps working and shows the reason and an alternative |
| Input checking | Numbers are range-checked and the corrected value is shown. Transfer functions and scenario text, files and links are rejected with a reason when wrong |
| Reproducibility | The same settings give the same results, noise included |
| Operability | Mouse, touch and keyboard (section 7.4) |

## 11. Development and quality assurance

The source is TypeScript in `src/` (57 script files in layers, one topic each, about 13,400 lines), built into `index.html`. The number of a file says its layer; a file uses only files with a lower number, and the files below 40 do not touch the page (`tests/modules.test.ts`). In version 1.61.4 all 109 unit tests and 99 browser tests pass.

### 11.1 Source layout

| File | Contents |
| --- | --- |
| `src/index.html`, `src/style.css`, `src/i18n.json` | Page template, stylesheet, translation dictionary |
| `01-changelog` to `04-parser` | Basics: change log, translation, complex numbers and polynomials, transfer-function parser |
| `10-definitions`, `11-state` | Model: definitions of plants, controllers, references, parameters and specifications; the settings, what follows from them, and the last results |
| `15-frequency` to `28-sweep` | Computing (no access to the page): frequency response, simulation, the loop and root locus, Routh–Hurwitz test, Bode asymptotes, Nyquist criterion, root-locus rules, steady-state error, analyses of the current loop, auto-tuning rules, compensator design, estimation exercises, design specifications, parameter sweep |
| `40-dom`, `41-view` | Page basics: elements, files, messages and translation of the page; view state (layout and its defaults `defaultLayout()`, shown plots, zoomed views, colours) |
| `45-plot` to `62-update` | Showing: the plots (one file each) and the pole-zero map, the block diagram, the contents of the panels and formulas, `update()` and `redraw()` |
| `70-controls` to `74-settings-panel`, `75-zoom`, `76-export` | Settings panel and its events (controller input, estimation exercise, design controls); interaction with the plots (zoom, pole-zero map, plot options); export |
| `77-rows`, `78-tiles`, `79-layout` | Arrangement in rows, free arrangement in columns, layout of the page |
| `80-scenarios`, `81-scenario-card` | Scenarios: what is saved and how it is applied; their card (save and load) |
| `82-menubar` | Menu bar and the shared drop-down `dropdown()` |
| `83-diagram-zoom` | Zoom, pan and PNG of the block diagram |
| `84-help` | User manual (text in English and Japanese, its screenshots and its dialog) |
| `85-language` | Switching the language |
| `99-init` | Start-up |

### 11.2 From build to release

1. Edit `src/` (never edit `index.html` directly).
2. `npm run build`: with Node.js only, remove the types and import/export, and join the files in name order into one script. The lines stay the same as in `src/ts`; within a line the removed text leaves no run of spaces, so that a new version can be published as a few exact text replacements (the unit tests and the coverage use the script with every column in place).
3. `npm test`: type check and unit tests. For changes to the page, also run `npm run test:ui`.
4. Update the version number and the change log (English and Japanese), and generate CHANGELOG.md and CHANGELOG.ja.md with `npm run docs`. When the specification changes, update this document (SPEC.md and SPEC.ja.md) too.
5. Pushing to GitHub runs GitHub Actions: build up to date, formatting, unit tests and browser tests (Node.js 22).
6. Update and publish the artifact: the owner's account uploads `index.html`; another account that may edit the shared artifact replaces only the changed text (`npm run edits -- <live version>` makes the replacements, at most 64 and 64 KiB of replaced text; a larger change is published by the owner; afterwards the changed lines are read back and compared). Tags are made by the author by hand.

### 11.3 Tests

| Kind | Files | Main checks |
| --- | --- | --- |
| Unit tests (`tests/`, 17 files) | simulation, frequency, pole-zero, design, kinds, smoke, parser | Agreement with analytic solutions and published tuning tables, every combination of plant and controller, parsing |
| | files, tiles, rows | Scenarios, checking and converting saved layouts, moving panels |
| | i18n, leftovers | Missing translations, hard-coded UI strings, unused translations, CSS and stored items |
| | build, version, publish-edits, tutorial, help, pages | `index.html` up to date, version number and change log consistent, the compact page script, publishing as text replacements, the numbers quoted in the manual's walkthrough of the exercises, the manual's figures, tables and references, the files of the GitHub Pages site |
| Browser tests (`ui/`, Playwright, 11 files) | layout, plots, interaction, tiles, rows | Menus, panel arrangement and sizes, formula scaling, zoom and pan, smartphones |
| | design, files, failures, details, i18n, help | Design support, scenarios, failure handling, rarely used operations, display in five languages, the user manual |

Coverage is measured with `npm run coverage` (98.9% of lines and 1009 of 1018 functions as of version 1.73.6). Changes that should not alter the look of the page are checked by comparing screenshots before and after pixel by pixel.
