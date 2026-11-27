# Numerical accuracy of SigmaOmega

English | [日本語](ACCURACY.ja.md)

SigmaOmega computes its results numerically, so they carry small errors. This document states how large those errors are, how this was found and where the limits lie, so that you can judge how far to trust a number on the screen. It describes version 1.99.1 and covers both the simulation and the analyses of the loop (stability tests, steady-state errors, straight-line approximations, root-locus rules); every table below is printed by `npm run accuracy` (`scripts/accuracy.ts`), and `tests/accuracy.test.ts` checks the bounds on every change.

## Summary

Compared with exact solutions and with independent references computed far more accurately, the results stay within these bounds:

| Result | Accuracy |
| --- | --- |
| Time response y(t) | Within about 0.3 % of the size of the response (often 0.02–0.05 %) when the dominant poles have ζ ≥ 0.2; up to 1 % for ζ = 0.1 and 2 % for ζ = 0.05 (lightly damped loops, see [below](#time-response-of-lightly-damped-loops)) |
| Overshoot | Within 0.1 percentage point for well-damped loops; about 0.3 point for ζ = 0.2–0.35, 0.6–1 for ζ = 0.16, 1.1–1.3 for ζ ≤ 0.1 (the app slightly larger) |
| Rise time, settling time | Within 0.5 % (usually within 0.2 %); for ζ < 0.2 the settling time can be later by up to half a period π/ω_d |
| Phase margin, gain margin | Within 0.02°, within 0.001 dB |
| Peak sensitivity Ms | Within 10⁻⁶ (relative), sharp peaks included |
| Bode and Nyquist plots | Computed directly from the transfer functions (the dead time exactly); only the rounding of double-precision arithmetic |
| Poles and zeros | Within 10⁻⁹ when distinct; a pole repeated k times only to a few times 10⁻¹⁶ᐟᵏ (2×10⁻⁵ for a triple pole; a limit of the problem itself) |
| Poles with a dead time | Third-order Padé approximation: the dominant poles within about 10⁻³ for L/T ≤ 3 |
| Sine reference: amplitude ratio, phase difference | Within 1 %, within 0.3° |
| Closed-loop Mt, peak disturbance gain max\|Gyd\|, bandwidth ωBW | Within 10⁻⁵, within 10⁻⁵, within 2×10⁻⁴ (relative) |
| Stable range of the gain factor k | Routh–Hurwitz within 10⁻⁹, root locus within 10⁻⁶ (relative); with a dead time, from the Padé approximation (0.04 % off for L/T = 1) |
| System type, error constants, steady-state errors | Exact (up to rounding) |
| Nyquist criterion Z = N + P | Agrees with the roots in all 189 cases tried |
| Straight-line approximation of the Bode plot | Break frequencies equal the \|roots\| (a triple root within 5×10⁻⁸); the lines exact up to rounding |
| Construction rules of the root locus | Centroid, breakaway points, imaginary-axis crossings and angles exact up to rounding (10⁻¹⁵) |

What to keep in mind is in [Limits](#limits-and-what-to-keep-in-mind).

## How the results are computed

The methods are described in section 9 of the specification ([SPEC.md](SPEC.md)). In short:

- **Time response.** The plant is converted to a state-space model and discretized exactly for an input held over each step (zero-order hold, with the matrix exponential). The response is recorded at 4000 points; between two of them the controller is updated in up to 100 substeps *h*, chosen so that ω·*h* ≤ 0.02 at the gain crossover frequency, at the frequency of a periodic reference and at the fastest dynamics of the controller (the derivative filter *N*). The controller output held over a substep is the exact average of the continuous controller over that substep. A dead time delays the plant input by *L*/*h* substeps, without rounding.
- **Response metrics.** Crossing times are interpolated linearly between the recorded points; the overshoot comes from a parabola through the peak.
- **Frequency response.** *L*(*j*ω), *S*, *T* and the other responses are evaluated directly at 150 frequencies per decade; the margins are interpolated between them, and the peaks Ms and Mt are refined between them.
- **Poles and zeros.** The Durand–Kerner method on the characteristic polynomial; a dead time is replaced by a third-order Padé approximation.
- **Closed-loop peaks and bandwidth.** The peaks of |*T*| (Mt) and of |*G*<sub>yd</sub>| are refined between the grid points by golden-section search, like Ms; the bandwidth (|*T*| 3 dB below its low-frequency value) is interpolated linearly in dB between them.
- **Stable range of the gain factor *k*.** Routh–Hurwitz: the characteristic polynomial *D*(*s*) + *kN*(*s*), its Hurwitz determinants as polynomials in *k*, and the ranges where all of them are positive (from their roots). Root locus: the poles on a grid of *k* from 10⁻⁴ to 10⁴, each boundary refined by bisection. A dead time is replaced by the Padé approximation in both.
- **Steady-state errors.** The system type and the error constants from the lowest coefficients of *L*(*s*); the errors from the series of 1 − *G*<sub>yr</sub>(*s*) and *G*<sub>yd</sub>(*s*) at *s* = 0 (a dead time does not change them).
- **Nyquist criterion.** *P* from the roots of the open-loop denominator; *N* as the sum of the crossings of the real axis to the left of −1 along the Nyquist contour (small half circles around poles on the imaginary axis), with the exact dead time.
- **Straight-line approximation and root-locus rules.** Built from the poles and zeros (repeated roots grouped), with the textbook formulas: the centroid, the breakaway points as the real roots of *N*′*D* − *ND*′ on the locus, the imaginary-axis crossings from the Routh table, and the departure and arrival angles from the angle condition.

## How the accuracy was evaluated

Each result was compared with a reference that does not share the method under test:

| Result | Reference |
| --- | --- |
| Time response without dead time | The exact closed loop *T*(*s*) = *L*/(1 + *L*), integrated by the classical Runge–Kutta method (RK4) with a step of 10⁻⁴ s; its own error is below 10⁻¹¹ |
| Time response with dead time | The continuous-time PID (with its derivative filter and set-point weights) and the plant with the exact delay, integrated by RK4 with a step of 10⁻⁴ s |
| Overshoot, rise and settling times | The same references sampled at 100,000 points |
| Margins and Ms | *L*(*j*ω) with the exact dead time on 5000 points per decade over 10⁻⁴ … 10⁴ rad/s, crossings refined by bisection and the peak by golden-section search |
| Discretization | The exact step response of 1/(*s*+1)ⁿ: 1 − e⁻ᵗ Σⱼ₌₀ⁿ⁻¹ tʲ/j! |
| Roots | Polynomials with known roots; the error is the largest distance from a computed root to the nearest exact one or the other way round, so that every one of repeated roots counts |
| Poles with a dead time | Newton's method on the exact characteristic equation *s* + 1 + *K*ₚ e⁻ᴸˢ = 0 (first-order lag + dead time with P control), started from the Padé pole |
| Sine reference | The closed-loop frequency response \|*T*(*j*ω)\| and ∠*T*(*j*ω) |
| Mt, max\|Gyd\|, ωBW | \|*T*(*j*ω)\| and \|*P*/(1 + *L*)\| with the exact dead time on 5000 points per decade, the peaks refined by golden-section search and the bandwidth by bisection |
| Stable range of *k* | The gains where a closed-loop pole crosses the imaginary axis, found without the app's methods: 1 + *kL*(*j*ω) = 0 where *L*(*j*ω) is real and negative (a dense scan of Im *L* refined by bisection, with the exact dead time), and our own Routh table between them; closed forms where they exist (0 < *k* < 8 for 1/(*s*+1)³, *k* > 2 for 1/(*s*−1) with *K*<sub>P</sub> = 0.5) |
| Steady-state errors | Values worked out by hand from *L*(*s*) (for example *K*<sub>a</sub> = 0.5 and a parabola error of 2 for (*s*+0.5)/(*s*²(*s*+1))) |
| Nyquist criterion | The number of closed-loop poles in the right half-plane, from the roots of the characteristic polynomial, for 8 plants × 4 controllers × 6 gains |
| Straight-line approximation | Our own piecewise-linear gain and phase built from the exact poles and zeros, on 1e-3 … 1e3 rad/s |
| Root-locus rules | Closed forms (for example the breakaway point −1 + 1/√3 of 1/(*s*(*s*+1)(*s*+2)), its crossing at ω = √2 with *k* = 6, the departure angle −45° of 1/(*s*(*s*²+2*s*+2)), the points −3 ± √6 of (*s*+3)/(*s*(*s*+1))) |

## Results

The errors are absolute, for a unit step reference; "m" is the number of substeps between two recorded points and *h* the substep. The overshoot is measured against the reference, as in the app (a P control that stays below the reference has 0 %).

### Time response (no dead time)

| Case | m | h [s] | Max. error of y | Overshoot [%] app / exact | Rise time [s] app / exact | Settling time [s] app / exact |
|---|---|---|---|---|---|---|
| 1st-order lag + P | 1 | 0.0013 | 3.1×10<sup>-4</sup> | 0.00 / 0.00 | — / — | — / — |
| 1st-order lag + PI | 1 | 0.0025 | 4.6×10<sup>-4</sup> | 0.00 / 0.00 | 2.194 / 2.197 | 3.907 / 3.912 |
| 1st-order lag + PID | 5 | 0.0010 | 2.2×10<sup>-3</sup> | 0.00 / 0.00 | 3.232 / 3.233 | 6.449 / 6.450 |
| 2nd-order (ζ = 0.2) + P | 1 | 0.0075 | 1.8×10<sup>-3</sup> | 0.00 / 0.00 | — / — | — / — |
| 3rd-order lag + PID | 8 | 0.00094 | 1.7×10<sup>-4</sup> | 0.00 / 0.00 | 1.977 / 1.978 | 12.105 / 12.106 |
| 3rd-order lag + PID, N = 100 | 38 | 0.00020 | 3.5×10<sup>-5</sup> | 0.00 / 0.00 | 2.046 / 2.047 | 12.098 / 12.098 |
| 3rd-order lag + PID, fast | 3 | 0.0017 | 8.2×10<sup>-4</sup> | 11.05 / 10.97 | 0.778 / 0.779 | 7.245 / 7.248 |
| Integrator + 1st-order lag + PD | 5 | 0.0010 | 1.8×10<sup>-4</sup> | 3.35 / 3.34 | 1.914 / 1.915 | 5.190 / 5.189 |
| 3rd-order lag + lead | 4 | 0.0019 | 3.2×10<sup>-4</sup> | 0.00 / 0.00 | — / — | — / — |

### Time response of lightly damped loops

The error of the time response grows as the damping falls. *K*/(*s*(*Ts* + 1)) with P control gives a pure second-order closed loop with ζ = 1/(2√(*K K*<sub>P</sub> *T*)); its exact overshoot is 100 e<sup>−πζ/√(1−ζ²)</sup> %. The error of *y* is relative to the size of the response.

| Case | ζ of the dominant poles | m | h [s] | Max. error of y (relative) | Overshoot [%] app / exact | Rise time [s] app / exact | Settling time [s] app / exact |
|---|---|---|---|---|---|---|---|
| Integrator + 1st-order lag + P, ζ = 0.35 | 0.354 | 1 | 0.0075 | 0.26 % | 30.81 / 30.50 | 0.983 / 0.986 | 7.760 / 7.742 |
| Integrator + 1st-order lag + P, ζ = 0.16 | 0.158 | 2 | 0.0037 | 0.45 % | 61.06 / 60.47 | 0.366 / 0.367 | 7.334 / 7.317 |
| Integrator + 1st-order lag + P, ζ = 0.16, 100 s | 0.158 | 4 | 0.0063 | 0.75 % | 61.45 / 60.47 | 0.366 / 0.366 | 8.101 / 7.318 |
| Integrator + 1st-order lag + P, ζ = 0.10 | 0.1 | 2 | 0.0037 | 1.03 % | 74.02 / 72.92 | 0.220 / 0.221 | 8.217 / 7.677 |
| Integrator + 1st-order lag + P, ζ = 0.05 | 0.05 | 4 | 0.0019 | 1.96 % | 86.72 / 85.45 | 0.106 / 0.106 | 8.527 / 7.601 |
| 2nd-order (ζ = 0.2) + PI | 0.2 | 2 | 0.0075 | 0.30 % | 5.09 / 4.78 | 1.326 / 1.330 | 27.701 / 27.666 |

### Time response with dead time

| Case | h [s] | Max. error of y | Overshoot [%] app / exact | Settling time [s] app / exact |
|---|---|---|---|---|
| L = 0.5 (a whole number of substeps), P | 0.0050 | 5.2×10<sup>-4</sup> | 0.00 / 0.00 | — / — |
| L = 0.537 (not a whole number), P | 0.0050 | 5.3×10<sup>-4</sup> | 0.00 / 0.00 | — / — |
| Exercise 2: L = 1, T = 2, PI | 0.010 | 1.2×10<sup>-3</sup> | 2.55 / 2.49 | 8.792 / 8.757 |
| Exercise 3: L = 0.5, PID | 0.00094 | 1.4×10<sup>-3</sup> | 18.66 / 18.61 | 2.688 / 2.684 |

### Frequency response

| Case | Phase margin [°] app / exact | Gain margin [dB] app / exact | Ms app / exact |
|---|---|---|---|
| 1st-order lag + PID | 149.641 / 149.641 | — / — | 0.99999 / 0.99999 |
| 3rd-order lag + PID | 70.117 / 70.116 | 27.0606 / 27.0605 | 1.36560 / 1.36560 |
| 1st-order lag + dead time (L = 1) + PI | 71.037 / 71.038 | 10.8784 / 10.8786 | 1.47156 / 1.47156 |
| 2nd-order (ζ = 0.05) + P | 14.115 / 14.106 | — / — | 4.28068 / 4.28068 |
| 3rd-order lag + P, near instability | 2.168 / 2.166 | 0.5610 / 0.5606 | 31.00000 / 31.00000 |

### Polynomial roots

| Polynomial | Max. error of the roots |
|---|---|
| (s+1)^2 (a 2-fold root) | 7.6×10<sup>-10</sup> |
| (s+1)^3 (a 3-fold root) | 1.7×10<sup>-5</sup> |
| (s+1)^4 (a 4-fold root) | 3.1×10<sup>-4</sup> |
| (s+1)^6 (a 6-fold root) | 6.2×10<sup>-3</sup> |
| (s+1)^8 (a 8-fold root) | 2.7×10<sup>-2</sup> |
| (s+1)(s+2)…(s+10) | 4.4×10<sup>-10</sup> |
| (s+0.001)(s+1000) | 0 |
| s² + 2·0.9·s + 1 | 1.1×10<sup>-16</sup> |

### Discretization of the plant

| Plant | Max. error of the step response |
|---|---|
| 1/(s+1)^1 | 1.1×10<sup>-15</sup> |
| 1/(s+1)^3 | 3.7×10<sup>-15</sup> |
| 1/(s+1)^6 | 4.6×10<sup>-14</sup> |
| 1/(s+1)^10 | 2.4×10<sup>-14</sup> |

### Poles with dead time (third-order Padé approximation)

First-order lag 1/(*s*+1) with the dead time *L* and P control.

| L/T | K_P | Dominant pole: Padé | exact | Error |
|---|---|---|---|---|
| 0.2 | 1 | -2.7244 ± 0.0000j | -2.7244 ± 0.0000j | 3.8×10<sup>-7</sup> |
| 0.5 | 1 | -1.9042 ± 2.4288j | -1.9045 ± 2.4285j | 3.9×10<sup>-4</sup> |
| 1 | 1 | -0.6053 ± 1.7877j | -0.6050 ± 1.7882j | 6.1×10<sup>-4</sup> |
| 2 | 0.5 | -0.4307 ± 1.0356j | -0.4305 ± 1.0366j | 9.8×10<sup>-4</sup> |
| 3 | 0.5 | -0.2566 ± 0.7773j | -0.2557 ± 0.7780j | 1.2×10<sup>-3</sup> |

### Sine reference

First-order lag + PID; errors against |*T*(*j*ω)| and ∠*T*(*j*ω).

| Period [s] | Error of the amplitude ratio | Error of the phase difference [°] |
|---|---|---|
| 20 | 0.01 % | -0.01 |
| 5 | 0.02 % | -0.04 |
| 1 | 0.05 % | -0.13 |
| 0.3 | 0.75 % | -0.30 |

### Closed-loop frequency response

| Case | Mt app / exact | ωBW [rad/s] app / exact | max\|Gyd\| app / exact |
|---|---|---|---|
| 3rd-order lag + PID | 1.00000 / 1.00000 | 1.2768 / 1.2769 | 0.42862 / 0.42862 |
| 2nd-order (ζ = 0.05) + P | 4.08589 / 4.08589 | 1.9001 / 1.9001 | 8.17178 / 8.17178 |
| 1st-order lag + dead time (L = 1) + PI | 1.00000 / 1.00000 | 0.8095 / 0.8095 | 1.01044 / 1.01044 |
| Integrator + 1st-order lag + PD | 1.00000 / 1.00000 | 1.0926 / 1.0926 | 1.00000 / 1.00000 |

### Stable range of the gain factor k

The ranges of *k* (the controller multiplied by *k*; *k* = 1 is the setting) in which the closed loop is stable. The root locus covers 10⁻⁴ ≤ *k* ≤ 10⁴, so a range that goes on beyond 10⁴ is shown as ∞.

| Case | Routh–Hurwitz | Root locus | Exact | Largest error (Routh / locus) |
|---|---|---|---|---|
| 3rd-order lag + P (exact: 0 < k < 8) | 0 … 8 | 0 … 8 | 0 … 8 | 0 / 3.0×10<sup>-9</sup> |
| 3rd-order lag + PID | 0 … 22.5437 | 0 … 22.5437 | 0 … 22.5437 | 1.6×10<sup>-16</sup> / 1.9×10<sup>-9</sup> |
| Unstable 1st-order + P (exact: k > 2) | 2 … ∞ | 2 … ∞ | 2 … ∞ | 0 / 1.0×10<sup>-9</sup> |
| 1/(s(s+1)(s+2)) + PD | 0 … 45.0876 | 0 … 45.0876 | 0 … 45.0876 | 1.6×10<sup>-16</sup> / 1.9×10<sup>-9</sup> |
| 1st-order lag + dead time (L = 1) + P | 0 … 2.26272 | 0 … 2.26272 | 0 … 2.26183 | 4.0×10<sup>-4</sup> / 4.0×10<sup>-4</sup> |

### Steady-state error

The error constant of the type (*K*<sub>p</sub>, *K*<sub>v</sub> or *K*<sub>a</sub>), the error to the reference of that order (step, ramp, parabola) and the error to a unit step disturbance at the plant input.

| Case | Type | Error constant app / exact | Error to the reference app / exact | Error to a step disturbance app / exact |
|---|---|---|---|---|
| 1st-order lag + P (K_p = 2) | 0 / 0 | 2.000000 / 2.000000 | 0.333333 / 0.333333 | -0.333333 / -0.333333 |
| 3rd-order lag + PI (K_v = 0.5) | 1 / 1 | 0.500000 / 0.500000 | 2.000000 / 2.000000 | 0.000000 / 0.000000 |
| Integrator + 1st-order lag + PI (K_a = 0.5) | 2 / 2 | 0.500000 / 0.500000 | 2.000000 / 2.000000 | 0.000000 / 0.000000 |
| 1st-order lag + dead time (L = 1) + PI (K_v = 0.4) | 1 / 1 | 0.400000 / 0.400000 | 2.500000 / 2.500000 | 0.000000 / 0.000000 |

### Nyquist criterion

Every combination of the plant with P, PI, PD and PID control (*K*<sub>P</sub> from 0.1 to 30, *K*<sub>I</sub> = 0.5 *K*<sub>P</sub>, *K*<sub>D</sub> = 0.3 *K*<sub>P</sub>); cases with a closed-loop pole on the imaginary axis, where *N* is not defined, are left out.

| Plant | Cases | Z = N + P equal to the roots in the right half-plane | Left out (a pole on the axis) |
|---|---|---|---|
| 1st-order lag | 24 | 24 | 0 |
| 2nd-order (ζ = 0.2) | 24 | 24 | 0 |
| 3rd-order lag | 24 | 24 | 0 |
| Integrator + 1st-order lag | 24 | 24 | 0 |
| Unstable 1st-order | 21 | 21 | 3 |
| 1/(s(s+1)(s+2)) | 24 | 24 | 0 |
| (s+2)/((s−1)(s+3)) | 24 | 24 | 0 |
| (1−s)/((s+1)(0.1s+1)) | 24 | 24 | 0 |

### Straight-line approximation of the Bode plot

| Case | Break frequencies | Error of the break frequencies | Error of the gain asymptote [dB] | Error of the phase asymptote [°] |
|---|---|---|---|---|
| 3rd-order lag + P: a triple pole at 1 | 1 | 4.6×10<sup>-8</sup> | 1.2×10<sup>-6</sup> | 2.7×10<sup>-6</sup> |
| 2nd-order (ζ = 0.2, ωn = 2) + P | 2 | 0 | 0 | 0 |
| 1st-order lag (T = 0.5) + PI: zero 0.5, pole 2, integrator | 0.5, 2 | 0 | 7.1×10<sup>-15</sup> | 0 |
| (1−s)/((s+1)(0.1s+1)) + P: a zero in the right half-plane | 1, 10 | 0 | 3.6×10<sup>-15</sup> | 0 |

### Construction rules of the root locus

The values found by the app; the last column is the largest difference from the exact values.

| L(s) | Centroid | Breakaway / break-in (s, k) | Imaginary-axis crossings (ω, k) | Departure angle | Largest error |
|---|---|---|---|---|---|
| 1/(s(s+1)(s+2)) | -1.00000 | (-0.42265, 0.38490) | (1.41421, 6.00000) | — | 1.5×10<sup>-16</sup> |
| 1/(s(s²+2s+2)): departure from −1 + j | -0.66667 | — | (1.41421, 4.00000) | -45.000° | 2.2×10<sup>-16</sup> |
| (s+3)/(s(s+1)): breakaway and break-in | — | (-0.55051, 0.10102), (-5.44949, 9.89898) | — | — | 4.3×10<sup>-16</sup> |

## Limits and what to keep in mind

- **The time response is first-order accurate in the substep *h*.** The controller sees the output at the start of each substep and holds its output over it, so the error is proportional to *h*. The substep is chosen to keep it at about 0.3 % or less; shortening the simulation time makes *h* smaller.
- **Lightly damped loops.** Seeing the output once per substep acts like a delay of *h*/2, which lowers the damping a little (the phase at the crossover by about ω·*h*/2 ≈ 0.5°). With little damping this matters, and it adds up over the many periods of the response: the oscillation decays slightly more slowly than it should. For ζ = 0.1 the error of *y* reaches about 1 % and the overshoot is about 1 point too large; for ζ = 0.05 about 2 % and 1.3 points. The settling time of such a loop can then be later by up to half a period π/ω<sub>d</sub>, when a peak is near the edge of the ±2 % band. A shorter simulation time can make *h* smaller, and the error with it (for ζ = 0.16, 0.45 % over 30 s against 0.75 % over 100 s).
- **Very long simulation times.** At most 100 substeps are used between two recorded points. When the simulation time is more than about 8000/ω (ω: the gain crossover frequency, or *N*), *h* becomes larger than the target and the error grows. For example, with a crossover at 10 rad/s, keep the simulation time below about 800 s.
- **Changes faster than the recorded points.** The response is recorded at 4000 points, so a change much faster than (simulation time)/4000 cannot be resolved, even with interpolation. For example, a rise time of 0.125 s simulated for 2000 s (a point every 0.5 s) is shown as about 0.41 s. Shorten the simulation time to see a fast response.
- **The plotted *u*.** The control input is shown at the recorded points, so a very short peak, such as the derivative kick that decays in about 1/*N*, may look lower than it is.
- **Repeated poles.** A pole repeated *k* times can only be computed to a few times 10⁻¹⁶ᐟᵏ (for example 2×10⁻⁵ for a triple pole, 3×10⁻² for an eightfold one), because a tiny rounding error in the coefficients moves such roots that much; their ζ and ωₙ are correspondingly approximate. An imaginary part below 10⁻⁴·(1 + |Re|) is shown as 0.
- **Dead time in the pole-zero map.** The poles, the root locus and the stable range of *k* use a third-order Padé approximation: the dominant poles are close (table above), but the actual system has infinitely many poles, and fast poles of the approximation have no exact counterpart. The Bode and Nyquist plots, the margins and the time response use the exact delay.
- **Frequency grid.** The margins are interpolated between 150 frequencies per decade (errors in the table above), and only the first crossing in the frequency range is reported.
- **The stable range of *k* with a dead time** comes from the Padé approximation, like the pole-zero map (0.04 % off for *L*/*T* = 1, and more for longer delays); the exact limit is the gain margin, read from the Bode or Nyquist plot. The root locus is followed for 10⁻⁴ ≤ *k* ≤ 10⁴ only.
- **The bandwidth** is interpolated linearly in dB between the grid points (within 2×10⁻⁴); a peak of |*G*<sub>yd</sub>| was taken at the grid points only before version 1.98.1, which could make it up to 1.6 % too small for a lightly damped loop (ζ = 0.05).
- **Nyquist count** is not given when *L*(*j*ω) passes through −1 (a closed-loop pole on the imaginary axis).
- **Repeated poles and zeros** in the straight-line approximation and the root-locus rules are grouped by distance (10⁻³), so their break frequencies are as accurate as their mean (5×10⁻⁸ for a triple root).
- **Saturation, anti-windup and noise** are simulated with the same steps, but they have no exact solution to compare with; the accuracy above refers to linear systems.

## Reproducing the evaluation

```
npm ci
npm run accuracy                  # prints the tables above (about 25 s)
node --test tests/accuracy.test.ts  # checks the bounds
```

The references are in `scripts/accuracy.ts`, independent of the simulator's own discretization: the plant and controller are taken from the app as transfer functions, and everything else is computed there.
