# Numerical accuracy of SigmaOmega

English | [日本語](ACCURACY.ja.md)

SigmaOmega computes its results numerically, so they carry small errors. This document states how large those errors are, how this was found and where the limits lie, so that you can judge how far to trust a number on the screen. It describes version 1.74.0; every table below is printed by `npm run accuracy` (`scripts/accuracy.ts`), and `tests/accuracy.test.ts` checks the bounds on every change.

## Summary

Compared with exact solutions and with independent references computed far more accurately, the results stay within these bounds:

| Result | Accuracy |
| --- | --- |
| Time response y(t) | Within about 0.3 % of the size of the response (often 0.02–0.05 %) |
| Overshoot | Within 0.1 percentage point |
| Rise time, settling time | Within 0.5 % (usually within 0.2 %) |
| Phase margin, gain margin | Within 0.02°, within 0.001 dB |
| Peak sensitivity Ms | Within 10⁻⁶ (relative), sharp peaks included |
| Bode and Nyquist plots | Computed directly from the transfer functions (the dead time exactly); only the rounding of double-precision arithmetic |
| Poles and zeros | Within 10⁻⁹ when distinct; a pole repeated k times only to about 10⁻¹⁶ᐟᵏ (a limit of the problem itself) |
| Poles with a dead time | Third-order Padé approximation: the dominant poles within about 10⁻³ for L/T ≤ 3 |
| Sine reference: amplitude ratio, phase difference | Within 1 %, within 0.3° |

What to keep in mind is in [Limits](#limits-and-what-to-keep-in-mind).

## How the results are computed

The methods are described in section 9 of the specification ([SPEC.md](SPEC.md)). In short:

- **Time response.** The plant is converted to a state-space model and discretized exactly for an input held over each step (zero-order hold, with the matrix exponential). The response is recorded at 4000 points; between two of them the controller is updated in up to 100 substeps *h*, chosen so that ω·*h* ≤ 0.02 at the gain crossover frequency, at the frequency of a periodic reference and at the fastest dynamics of the controller (the derivative filter *N*). The controller output held over a substep is the exact average of the continuous controller over that substep. A dead time delays the plant input by *L*/*h* substeps, without rounding.
- **Response metrics.** Crossing times are interpolated linearly between the recorded points; the overshoot comes from a parabola through the peak.
- **Frequency response.** *L*(*j*ω), *S*, *T* and the other responses are evaluated directly at 150 frequencies per decade; the margins are interpolated between them, and the peaks Ms and Mt are refined between them.
- **Poles and zeros.** The Durand–Kerner method on the characteristic polynomial; a dead time is replaced by a third-order Padé approximation.

## How the accuracy was evaluated

Each result was compared with a reference that does not share the method under test:

| Result | Reference |
| --- | --- |
| Time response without dead time | The exact closed loop *T*(*s*) = *L*/(1 + *L*), integrated by the classical Runge–Kutta method (RK4) with a step of 10⁻⁴ s; its own error is below 10⁻¹¹ |
| Time response with dead time | The continuous-time PID (with its derivative filter and set-point weights) and the plant with the exact delay, integrated by RK4 with a step of 10⁻⁴ s |
| Overshoot, rise and settling times | The same references sampled at 100,000 points |
| Margins and Ms | *L*(*j*ω) with the exact dead time on 5000 points per decade over 10⁻⁴ … 10⁴ rad/s, crossings refined by bisection and the peak by golden-section search |
| Discretization | The exact step response of 1/(*s*+1)ⁿ: 1 − e⁻ᵗ Σⱼ₌₀ⁿ⁻¹ tʲ/j! |
| Roots | Polynomials with known roots |
| Poles with a dead time | Newton's method on the exact characteristic equation *s* + 1 + *K*ₚ e⁻ᴸˢ = 0 (first-order lag + dead time with P control), started from the Padé pole |
| Sine reference | The closed-loop frequency response \|*T*(*j*ω)\| and ∠*T*(*j*ω) |

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
| (s+1)^2 (a 2-fold root) | 0 |
| (s+1)^3 (a 3-fold root) | 2.2×10<sup>-6</sup> |
| (s+1)^4 (a 4-fold root) | 6.3×10<sup>-5</sup> |
| (s+1)^6 (a 6-fold root) | 1.1×10<sup>-3</sup> |
| (s+1)^8 (a 8-fold root) | 1.2×10<sup>-2</sup> |
| (s+1)(s+2)…(s+10) | 1.4×10<sup>-10</sup> |
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

## Limits and what to keep in mind

- **The time response is first-order accurate in the substep *h*.** The controller sees the output at the start of each substep and holds its output over it, so the error is proportional to *h*. The substep is chosen to keep it at about 0.3 % or less; shortening the simulation time makes *h* smaller.
- **Very long simulation times.** At most 100 substeps are used between two recorded points. When the simulation time is more than about 8000/ω (ω: the gain crossover frequency, or *N*), *h* becomes larger than the target and the error grows. For example, with a crossover at 10 rad/s, keep the simulation time below about 800 s.
- **Changes faster than the recorded points.** The response is recorded at 4000 points, so a change much faster than (simulation time)/4000 cannot be resolved, even with interpolation. For example, a rise time of 0.125 s simulated for 2000 s (a point every 0.5 s) is shown as about 0.41 s. Shorten the simulation time to see a fast response.
- **The plotted *u*.** The control input is shown at the recorded points, so a very short peak, such as the derivative kick that decays in about 1/*N*, may look lower than it is.
- **Repeated poles.** A pole repeated *k* times can only be computed to about 10⁻¹⁶ᐟᵏ (for example 10⁻⁵ for a triple pole, 10⁻² for an eightfold one), because a tiny rounding error in the coefficients moves such roots that much; their ζ and ωₙ are correspondingly approximate. An imaginary part below 10⁻⁴·(1 + |Re|) is shown as 0.
- **Dead time in the pole-zero map.** The poles, the root locus and the stable range of *k* use a third-order Padé approximation: the dominant poles are close (table above), but the actual system has infinitely many poles, and fast poles of the approximation have no exact counterpart. The Bode and Nyquist plots, the margins and the time response use the exact delay.
- **Frequency grid.** The margins are interpolated between 150 frequencies per decade (errors in the table above), and only the first crossing in the frequency range is reported.
- **Saturation, anti-windup and noise** are simulated with the same steps, but they have no exact solution to compare with; the accuracy above refers to linear systems.

## Reproducing the evaluation

```
npm ci
npm run accuracy                  # prints the tables above (about 30 s)
node --test tests/accuracy.test.ts  # checks the bounds
```

The references are in `scripts/accuracy.ts`, independent of the simulator's own discretization: the plant and controller are taken from the app as transfer functions, and everything else is computed there.
