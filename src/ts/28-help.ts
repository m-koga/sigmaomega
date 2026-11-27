// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Masanobu Koga
/* ===== User manual (Help) =====
   The "Help" button at the right end of the menu bar opens the user manual in a dialog: a list of the sections on
   the left (above the text on narrow screens) and the text on the right. The manual is written in English and
   Japanese here (like the change log, not through the dictionary); in Chinese, Korean and Thai the English text is
   shown with a note. It is drawn in the language of the page each time it is opened. */
import { T, docsLang, docsTranslated } from './02-i18n.ts';
import { $ } from './13-dom.ts';

/** A section of the manual: its id, and its title and HTML in English and Japanese */
interface HelpSection {
  id: string;
  en: [string, string];
  ja: [string, string];
}

// prettier-ignore
export const HELP: HelpSection[] = [
  {
    id: 'start',
    en: ['Getting started', `
<p><b>SigmaOmega</b> (Feedback Control Simulator) lets you try the analysis and design of a feedback control system in the browser. Choose a plant and a controller and change their values: the time response, the Bode and Nyquist plots and the pole-zero map are drawn again at once. Everything is computed in your browser, and the simulator sends neither your settings nor the results anywhere (section 9 says what the page loads from the internet).</p>
<p>The name comes from the complex variable <i>s</i> = σ + <i>j</i>ω of the Laplace transform: the real part σ of a pole sets how fast the response dies out (or grows), and the frequency response is <i>s</i> on the imaginary axis, <i>s</i> = <i>j</i>ω. The simulator shows the whole <i>s</i>-plane and these two views of it together.</p>
<p>The system is a single loop: the reference <i>r</i> goes to the controller <i>C</i>(<i>s</i>), whose output <i>u</i> drives the plant <i>P</i>(<i>s</i>) with output <i>y</i>. A disturbance <i>d</i> can be added at the plant input and measurement noise <i>n</i> at the output.</p>
<h4>A first try</h4>
<ol>
<li>In <b>System setup › Plant P(s)</b>, choose a plant, for example <b>Third-order lag</b>.</li>
<li>In <b>System setup › Controller C(s)</b>, choose <b>PID</b> and move the sliders of <i>K</i><sub>P</sub>, <i>K</i><sub>I</sub> and <i>K</i><sub>D</sub>.</li>
<li>Watch the step response and its metrics (overshoot, settling time, …) under the plot.</li>
<li>Open <b>Plots to show</b> and add the <b>Bode plot</b> or the <b>Pole-zero map</b> to see the same change in the frequency domain and in the poles.</li>
</ol>
<p>For step-by-step examples, see section 8, <b>Trying the exercises</b>.</p>
<p>Terms used here: <i>L</i> = <i>CP</i> is the open-loop transfer function, <i>S</i> = 1/(1+<i>L</i>) the sensitivity and <i>T</i> = <i>L</i>/(1+<i>L</i>) the complementary sensitivity. A <b>panel</b> is a frame with one plot, a <b>card</b> a group of inputs in the settings panel, and a <b>scenario</b> a named copy of all the settings.</p>`],
    ja: ['はじめに', `
<p><b>SigmaOmega</b>（フィードバック制御シミュレーター）は、フィードバック制御系の解析と設計をブラウザで試せるソフトウェアです。制御対象と制御器を選んで値を変えると、時間応答・ボード線図・ナイキスト線図・極・零点配置がその場で描き直されます。計算はすべてブラウザの中で行い、入力した設定や計算結果をシミュレーターが外部に送ることはありません（ページがインターネットから読み込むものは 9 章）。</p>
<p>名前は、ラプラス変換の複素変数 <i>s</i> = σ + <i>j</i>ω に由来します。極の実部 σ は応答が減衰する（または発散する）速さを決め、周波数応答は虚軸上の <i>s</i> = <i>j</i>ω で求めます。このシミュレーターは、<i>s</i> 平面全体とこの 2 つの見方をまとめて示します。</p>
<p>扱う系は 1 つのループです。目標値 <i>r</i> が制御器 <i>C</i>(<i>s</i>) に入り、その出力（操作量）<i>u</i> が制御対象 <i>P</i>(<i>s</i>) を動かして出力 <i>y</i> になります。制御対象の入力に外乱 <i>d</i>、出力の測定にノイズ <i>n</i> を加えることもできます。</p>
<h4>まず試してみる</h4>
<ol>
<li><b>系の設定 › 制御対象 P(s)</b> で制御対象を選びます（例：<b>3次遅れ系</b>）。</li>
<li><b>系の設定 › 制御器 C(s)</b> で <b>PID</b> を選び、<i>K</i><sub>P</sub>・<i>K</i><sub>I</sub>・<i>K</i><sub>D</sub> のスライダーを動かします。</li>
<li>ステップ応答と、図の下の応答指標（オーバーシュート、整定時間など）の変化を見ます。</li>
<li><b>表示する図</b> から <b>ボード線図</b> や <b>極・零点配置</b> を加えると、同じ変化を周波数領域や極の動きで確かめられます。</li>
</ol>
<p>具体的な手順の例は 8 章 <b>例題で試す</b> にあります。</p>
<p>用語：<i>L</i> = <i>CP</i> は開ループ伝達関数、<i>S</i> = 1/(1+<i>L</i>) は感度関数、<i>T</i> = <i>L</i>/(1+<i>L</i>) は相補感度関数です。<b>区画</b>は 1 つの図を表示する枠、<b>カード</b>は設定パネルの入力のまとまり、<b>例題</b>はすべての設定に名前を付けて保存したものです。</p>`],
  },
  {
    id: 'screen',
    en: ['The screen', `
<p>From top to bottom: the <b>header</b> (title, language, version number), the <b>menu bar</b> (its menus are listed in <a class="hp-ref" href="#" data-ref="menus"></a>), and below it the <b>settings panel</b> (left) beside the <b>plot panels</b> (right).</p>
<table data-id="menus"><caption>The menus of the menu bar</caption>
<tr><th>Menu</th><th>What it does</th></tr>
<tr><td>File</td><td>Cards <b>Save and load</b> and <b>Compare &amp; reset</b></td></tr>
<tr><td>Plots to show</td><td>Shows or hides the panels (several at once; <b>All</b> shows every panel)</td></tr>
<tr><td>System setup</td><td>Cards for the plant, the controller, the reference, disturbance and noise, and the actuator saturation</td></tr>
<tr><td>Analysis &amp; design</td><td>Cards <b>Design specifications</b>, <b>Auto-tuning</b>, <b>Lead and lag compensator design</b>, <b>Parameter sweep</b> and <b>Estimation exercise</b></td></tr>
<tr><td>Plot arrangement</td><td>How the panels are arranged (section 5)</td></tr>
<tr><td>Metrics display</td><td>Metrics as cards or as a table</td></tr>
<tr><td>Help</td><td>This manual</td></tr>
</table>
<ul>
<li>The settings panel shows one card at a time, the one chosen from a menu; that menu is underlined in red. Drag the right edge of the panel to change its width, and use <b>≪</b> to fold it into a narrow strip.</li>
<li>The version number at the top right opens the change log.</li>
</ul>`],
    ja: ['画面の構成', `
<p>画面は上から <b>ヘッダー</b>（タイトル、言語、版番号）、<b>メニューバー</b>（メニューは <a class="hp-ref" href="#" data-ref="menus"></a> のとおり）、その下に <b>設定パネル</b>（左）と <b>図の区画</b>（右）が並びます。</p>
<table data-id="menus"><caption>メニューバーのメニュー</caption>
<tr><th>メニュー</th><th>内容</th></tr>
<tr><td>ファイル</td><td><b>保存と読み込み</b>、<b>比較・リセット</b> のカード</td></tr>
<tr><td>表示する図</td><td>区画の表示・非表示（続けて複数選べる。<b>すべて</b> で全部表示）</td></tr>
<tr><td>系の設定</td><td>制御対象、制御器、目標値・外乱・ノイズ、操作量の飽和のカード</td></tr>
<tr><td>解析・設計</td><td><b>設計仕様</b>、<b>自動調整</b>、<b>位相進み・遅れ補償器の設計</b>、<b>パラメータの掃引</b>、<b>推定の演習</b> のカード</td></tr>
<tr><td>図の並び方</td><td>区画の並べ方（5 章）</td></tr>
<tr><td>指標の表示</td><td>指標をカードで表示するか表で表示するか</td></tr>
<tr><td>使い方</td><td>このマニュアル</td></tr>
</table>
<ul>
<li>設定パネルには、メニューで選んだカードを 1 枚だけ表示します。そのカードがあるメニューには赤い下線が付きます。パネルの右端をドラッグすると幅が変わり、<b>≪</b> で細い帯に折りたためます。</li>
<li>右上の版番号を押すと更新履歴を表示します。</li>
</ul>`],
  },
  {
    id: 'system',
    en: ['Setting up the control system', `
<p>Values are set with a slider or typed in the number field beside it. A typed value outside the range of the slider is accepted on <kbd>Enter</kbd>.</p>
<h4>Plant P(s)</h4>
<p>First-order lag <i>K</i>/(<i>Ts</i>+1), second-order system, third-order lag <i>K</i>/(<i>Ts</i>+1)<sup>3</sup>, first-order lag with dead time, integrator with first-order lag, unstable first-order <i>K</i>/(<i>Ts</i>−1), or <b>Enter transfer function</b>.</p>
<p>A transfer function is written as polynomials in <i>s</i>, such as <code>2*s + 1</code> or <code>(s+1)^2(0.5s+1)</code> (the <code>*</code> may be left out), or as coefficients in descending powers such as <code>[1 3 2]</code>. The denominator may be up to degree 10, and the numerator degree must be lower (strictly proper). A dead time <i>L</i> can be added. The poles, zeros, DC gain and stability are shown as you type, and a mistake is explained.</p>
<h4>Controller C(s)</h4>
<ul>
<li><b>P, PI, PD, PID</b> with gains <i>K</i><sub>P</sub>, <i>K</i><sub>I</sub>, <i>K</i><sub>D</sub>; the derivative is filtered with the coefficient <i>N</i>.</li>
<li><b>PI-D</b> (the derivative acts on <i>y</i> only) and the <b>2-DOF PID</b> with set-point weights <i>b</i> and <i>c</i>; the block diagram changes to the form <i>u</i> = <i>C</i><sub>r</sub>(<i>s</i>)<i>r</i> − <i>C</i>(<i>s</i>)<i>y</i>.</li>
<li><b>Lead</b>, <b>lag</b> and <b>lead-lag</b> compensators.</li>
<li><b>Enter transfer function</b> (proper; the current PID settings can be converted into it).</li>
<li><b>Anti-windup</b> (conditional integration) for the PID types when the actuator saturates.</li>
</ul>
<h4>Reference, disturbance and noise</h4>
<p>The reference can be a step, ramp, parabola, trapezoid, single pulse, square wave, sine wave or impulse, with its start time, size and period. A step disturbance can be added at the plant input at a chosen time, and measurement noise with a standard deviation σ<sub>n</sub> (the same settings always give the same noise).</p>
<h4>Actuator saturation and simulation time</h4>
<p>The saturation limits |<i>u</i>| ≤ <i>u</i><sub>max</sub>. The simulation time is set under the time response (tab <b>Simulation time</b>), from 0.01 to 10000 s.</p>`],
    ja: ['制御系を設定する', `
<p>値はスライダーで動かすか、横の数値欄に入力します。数値欄では、<kbd>Enter</kbd> を押すとスライダーの範囲外の値も使えます。</p>
<h4>制御対象 P(s)</h4>
<p>1次遅れ系 <i>K</i>/(<i>Ts</i>+1)、2次遅れ系、3次遅れ系 <i>K</i>/(<i>Ts</i>+1)<sup>3</sup>、むだ時間 + 1次遅れ系、積分 + 1次遅れ系、不安定 1次系 <i>K</i>/(<i>Ts</i>−1)、または <b>伝達関数を入力</b> から選びます。</p>
<p>伝達関数は <code>2*s + 1</code>、<code>(s+1)^2(0.5s+1)</code> のような <i>s</i> の多項式（<code>*</code> は省略可）か、<code>[1 3 2]</code> のような降べきの係数で書きます。分母は 10 次まで、分子の次数は分母より低くします（厳密にプロパー）。むだ時間 <i>L</i> も加えられます。入力中に極・零点・直流ゲイン・安定性を表示し、誤りがあれば理由を示します。</p>
<h4>制御器 C(s)</h4>
<ul>
<li><b>P、PI、PD、PID</b>：ゲイン <i>K</i><sub>P</sub>、<i>K</i><sub>I</sub>、<i>K</i><sub>D</sub>。微分には係数 <i>N</i> のフィルターが付きます。</li>
<li><b>微分先行型 PI-D</b>（D 項は <i>y</i> だけに作用）と、目標値の重み <i>b</i>、<i>c</i> をもつ <b>2自由度 PID</b>。ブロック線図は <i>u</i> = <i>C</i><sub>r</sub>(<i>s</i>)<i>r</i> − <i>C</i>(<i>s</i>)<i>y</i> の形に変わります。</li>
<li><b>位相進み</b>、<b>位相遅れ</b>、<b>位相進み遅れ</b> 補償。</li>
<li><b>伝達関数を入力</b>（プロパーであること。今の PID の設定から変換もできます）。</li>
<li>PID 系では、操作量が飽和したときの <b>アンチワインドアップ</b>（条件付き積分）を選べます。</li>
</ul>
<h4>目標値・外乱・ノイズ</h4>
<p>目標値はステップ、ランプ、放物線、台形、パルス（単発）、矩形波、正弦波、インパルスから選び、開始時刻・大きさ・周期などを設定します。制御対象の入力に、指定した時刻からステップ外乱を加えられます。測定ノイズは標準偏差 σ<sub>n</sub> で指定します（同じ設定なら毎回同じ波形になります）。</p>
<h4>操作量の飽和とシミュレーション時間</h4>
<p>飽和は |<i>u</i>| ≤ <i>u</i><sub>max</sub> で操作量を制限します。シミュレーション時間は時間応答の下のタブ <b>シミュレーション時間</b> で 0.01〜10000 s の範囲で設定します。</p>`],
  },
  {
    id: 'plots',
    en: ['Reading the plots', `
<p><a class="hp-ref" href="#" data-ref="panels"></a> lists the panels that can be shown and what each of them shows.</p>
<table data-id="panels"><caption>The panels and what they show</caption>
<tr><th>Panel</th><th>What it shows</th></tr>
<tr><td>Block diagram</td><td>The current loop; the saturation, the disturbance and the noise are drawn only when they are used</td></tr>
<tr><td>Time response</td><td><i>r</i>, <i>y</i> and <i>u</i>, with the response metrics under it: rise time (10 → 90 %), overshoot, settling time (±2 %), steady-state error, and the peak deviation and recovery time after a disturbance; for a sine reference the amplitude ratio and the phase difference. The tab <b>Display</b> under the plot adds the response of the plant alone to <i>r</i>(<i>t</i>) (open loop: <i>P</i>(<i>s</i>) driven by the reference, without the controller and the feedback), for comparison with the closed loop. <b>Only the plant alone</b> shows the plant by itself: no reference and no feedback loop, the input set as the reference drives <i>P</i>(<i>s</i>) directly; the lower plot shows that input, and the metrics (final value, rise time, overshoot, settling time, steady-state gain) are those of the plant's own response; the block diagram then shows the plant alone, <i>u</i> → <i>P</i>(<i>s</i>) → <i>y</i></td></tr>
<tr><td>Transfer functions</td><td><i>P</i>(<i>s</i>) and <i>C</i>(<i>s</i>) (and <i>C</i><sub>r</sub>(<i>s</i>)) as formulas</td></tr>
<tr><td>Loop transfer functions</td><td>The ones chosen with the buttons of the panel among <i>L</i>(<i>s</i>), <i>S</i>(<i>s</i>), <i>T</i>(<i>s</i>), <i>G</i><sub>yr</sub>(<i>s</i>) and <i>G</i><sub>yd</sub>(<i>s</i>), each as its definition and as a rational function with the numbers (the dead time kept as e<sup>−<i>Ls</i></sup>; common factors not cancelled)</td></tr>
<tr><td>Poles and zeros</td><td>A table of the poles and zeros of the transfer functions chosen with the buttons of the panel among <i>P</i>(<i>s</i>), <i>C</i>(<i>s</i>), <i>L</i>(<i>s</i>), <i>S</i>(<i>s</i>), <i>T</i>(<i>s</i>), <i>G</i><sub>yr</sub>(<i>s</i>) and <i>G</i><sub>yd</sub>(<i>s</i>) (as written in the loop transfer functions panel: common factors not cancelled); poles in the right half-plane in red (with a dead time, the closed-loop poles come from a third-order Padé approximation)</td></tr>
<tr><td>Routh–Hurwitz test</td><td>The characteristic equation 1 + <i>L</i>(<i>s</i>) = 0 and its Routh table for the current setting (the first column in bold, negative entries in red; the number of sign changes gives the number of closed-loop poles in the right half-plane; a zero first entry is replaced by ε, and a row of zeros by the derivative of the auxiliary polynomial). Below, with the controller multiplied by a gain factor <i>k</i>, the first column as functions of <i>k</i> and the range of <i>k</i> (and of <i>K</i><sub>P</sub> with P control) in which they are all positive, compared with the range from the root locus (with a dead time, from a third-order Padé approximation)</td></tr>
<tr><td>Steady-state error</td><td>The system type of <i>L</i>(<i>s</i>) (its poles at the origin) and the position, velocity and acceleration error constants <i>K</i><sub>p</sub>, <i>K</i><sub>v</sub>, <i>K</i><sub>a</sub>; the steady-state errors to a step, ramp and parabola of the reference (per unit input and for the current setting) and to a step disturbance at the plant input, beside the error at the end of the simulation. With set-point weights the errors come from 1 − <i>G</i><sub>yr</sub>(<i>s</i>), and the values of the textbook formulas are shown in small type. The values hold only when the closed loop is stable</td></tr>
<tr><td>Bode plot</td><td>Gain and phase of <i>L</i>, <i>P</i>, <i>C</i>, <i>S</i>, <i>T</i>, <i>G</i><sub>yd</sub> and <i>G</i><sub>yr</sub> (buttons under the plot, tab <b>Curves</b>), with the gain and phase margins, Ms, Mt, the bandwidth and the peak disturbance gain. The button <b>L asymptotes</b> adds the straight-line approximations of the gain and the phase of <i>L</i> with the break frequencies (○), and the tab <b>Break frequencies</b> lists them with the poles and zeros there, the slopes, the gap to the true gain and the change of phase; the button <b>Factors of the asymptotes</b> draws the straight line of each factor (<i>K</i>/<i>s</i><sup><i>q</i></sup>, each pole and zero, the dead time), whose sum is the asymptote; the tab <b>Note</b> describes how the approximation is made (for checking a Bode plot drawn by hand)</td></tr>
<tr><td>Nyquist plot</td><td><i>L</i>(<i>j</i>ω) around the point −1, optionally with the circle of radius 1/Ms. The tab “Nyquist criterion” counts the open-loop poles in the right half-plane <i>P</i>, the clockwise encirclements of −1 <i>N</i> (as the sum of the crossings of the real axis to the left of −1, listed one by one) and <i>Z</i> = <i>N</i> + <i>P</i>, the closed-loop poles in the right half-plane; the option “Crossings of the real axis to the left of −1” marks them on the plot (▲ +1, ▼ −1)</td></tr>
<tr><td>Nichols chart</td><td>The gain of <i>L</i>(<i>j</i>ω) [dB] against its phase [deg], over the M contours where the closed loop |<i>T</i>(<i>j</i>ω)| is constant (labelled in dB) and the critical point (−180°, 0 dB): the largest M the curve touches is the resonance peak <i>M</i><sub>t</sub>, and the margins are read where the curve crosses −180° and 0 dB</td></tr>
<tr><td>Pole-zero map</td><td>Closed-loop poles, the poles and zeros of the plant and the controller, the root locus, a grid of ζ and ω<sub>n</sub>, the stability, the range of <i>k</i> for stability and the list of poles. The option “Construction rules of the root locus” draws the real-axis segments, the asymptotes and their centroid, the breakaway and break-in points, the imaginary-axis crossings and the departure and arrival angles, and the tab “Locus rules” lists them with how each is found and its value (for checking a locus sketched by hand)</td></tr>
</table>
<h4>Frequency range of the Bode plot</h4>
<p>The range is chosen automatically from the poles, zeros, dead time and simulation time. Type other limits in <b>Frequency range</b> under the plot to set it by hand; <b>Auto</b> brings back the automatic range, which also returns by itself when the poles, zeros, dead time or simulation time change. The margins are always found in the automatic range.</p>
<h4>Root locus</h4>
<p>The root locus shows the closed-loop poles as the loop gain is multiplied by <i>k</i> from 0 to ∞. Point at the locus to see <i>k</i>, the pole, ζ and ω<sub>n</sub> there; click to apply that <i>k</i> to the controller gain. With a dead time the poles use a third-order Padé approximation, and saturation is not included.</p>
<p>When the response diverges, no metrics are shown and the divergence is reported.</p>`],
    ja: ['図を読む', `
<p>表示できる区画と、それぞれに表示する内容を <a class="hp-ref" href="#" data-ref="panels"></a> に示します。</p>
<table data-id="panels"><caption>区画と表示する内容</caption>
<tr><th>区画</th><th>表示する内容</th></tr>
<tr><td>ブロック線図</td><td>今の制御系の構成。飽和・外乱・ノイズは使っているときだけ描きます</td></tr>
<tr><td>時間応答</td><td><i>r</i>、<i>y</i>、<i>u</i> と、その下の応答指標：立ち上がり時間（10 → 90 %）、オーバーシュート、整定時間（±2 %）、定常偏差、外乱による最大変動と回復時間。正弦波の目標値では振幅比と位相差。図の下のタブ <b>表示</b> で、制御対象単体の <i>r</i>(<i>t</i>) に対する応答（開ループ：制御器もフィードバックもなく、<i>P</i>(<i>s</i>) に目標値をそのまま入力）を重ね、閉ループの応答と比べられます。<b>制御対象単体のみ</b> を選ぶと、目標値もフィードバック系もなく、目標値として設定した入力を <i>P</i>(<i>s</i>) に直接加えた応答だけを表示します。下の図にはその入力を示し、応答指標（最終値、立ち上がり時間、オーバーシュート、整定時間、定常ゲイン）も制御対象の応答のものになります。ブロック線図も制御対象単体（<i>u</i> → <i>P</i>(<i>s</i>) → <i>y</i>）の表示に切り替わります</td></tr>
<tr><td>伝達関数</td><td><i>P</i>(<i>s</i>)、<i>C</i>(<i>s</i>)（と <i>C</i><sub>r</sub>(<i>s</i>)）の式</td></tr>
<tr><td>ループの伝達関数</td><td><i>L</i>(<i>s</i>)、<i>S</i>(<i>s</i>)、<i>T</i>(<i>s</i>)、<i>G</i><sub>yr</sub>(<i>s</i>)、<i>G</i><sub>yd</sub>(<i>s</i>) のうち区画のボタンで選んだもの。それぞれ定義と、数値を入れた有理式（むだ時間は e<sup>−<i>Ls</i></sup> のまま。共通因子は約分しない）</td></tr>
<tr><td>極と零点</td><td><i>P</i>(<i>s</i>)、<i>C</i>(<i>s</i>)、<i>L</i>(<i>s</i>)、<i>S</i>(<i>s</i>)、<i>T</i>(<i>s</i>)、<i>G</i><sub>yr</sub>(<i>s</i>)、<i>G</i><sub>yd</sub>(<i>s</i>) のうち区画のボタンで選んだものの極と零点の表（ループの伝達関数の区画と同じく共通因子は約分しない）。右半平面の極は赤で表示（むだ時間があるとき、閉ループの極は 3 次の Padé 近似によるもの）</td></tr>
<tr><td>ラウス・フルビッツの安定判別</td><td>特性方程式 1 + <i>L</i>(<i>s</i>) = 0 と、現在の設定でのラウス表（第 1 列は太字、負の値は赤。符号の変化の回数が右半平面にある閉ループの極の数。第 1 列の 0 は ε で置き換え、すべて 0 の行は補助多項式の微分で置き換える）。その下に、制御器をゲイン倍率 <i>k</i> 倍したときの第 1 列を <i>k</i> の式で示し、すべてが正となる <i>k</i> の範囲（P 制御では <i>K</i><sub>P</sub> の範囲も）を根軌跡から求めた範囲と比べる（むだ時間があるときは 3 次の Padé 近似による）</td></tr>
<tr><td>定常偏差</td><td><i>L</i>(<i>s</i>) の型（原点の極の数）と、位置・速度・加速度偏差定数 <i>K</i><sub>p</sub>、<i>K</i><sub>v</sub>、<i>K</i><sub>a</sub>。目標値のステップ・ランプ・放物線入力（単位入力と現在の設定）と、制御対象の入力に加わるステップ外乱に対する定常偏差を、シミュレーションの終わりの偏差と並べて示す。目標値の重みがあるときは 1 − <i>G</i><sub>yr</sub>(<i>s</i>) から求め、教科書の式による値を小さな字で示す。値は閉ループが安定なときだけ成り立つ</td></tr>
<tr><td>ボード線図</td><td><i>L</i>、<i>P</i>、<i>C</i>、<i>S</i>、<i>T</i>、<i>G</i><sub>yd</sub>、<i>G</i><sub>yr</sub> のゲインと位相（図の下のタブ <b>曲線</b> のボタンで切り替え）。ゲイン余裕、位相余裕、Ms、Mt、帯域幅、外乱ゲインの最大値。ボタン <b>L の折れ線近似</b> で <i>L</i> のゲインと位相の折れ線近似と折れ点周波数（○）を重ね、タブ <b>折れ点周波数</b> に、各折れ点の極・零点、傾き、実際のゲインとの差、位相の変化を示します。ボタン <b>折れ線の成分</b> で各因子（<i>K</i>/<i>s</i><sup><i>q</i></sup>、各極・零点、むだ時間）の直線を描き、その和が折れ線近似になる様子を示します。近似の方法はタブ <b>注記</b> に記載しています（手で描いたボード線図の確認に使えます）</td></tr>
<tr><td>ナイキスト線図</td><td>点 −1 のまわりの <i>L</i>(<i>j</i>ω)。半径 1/Ms の円も表示できます。タブ「ナイキストの安定判別」に、右半平面にある開ループの極の数 <i>P</i>、−1 を時計回りに回る回数 <i>N</i>（−1 より左での実軸との交差を一つずつ数えた和）、右半平面にある閉ループの極の数 <i>Z</i> = <i>N</i> + <i>P</i> を示します。表示項目「−1 より左での実軸との交差」で交差を図に示します（▲ +1、▼ −1）</td></tr>
<tr><td>ニコルス線図</td><td><i>L</i>(<i>j</i>ω) の位相 [deg] に対するゲイン [dB] を、閉ループの |<i>T</i>(<i>j</i>ω)| が一定となる M 軌跡（dB でラベル）と臨界点（−180°, 0 dB）に重ねて描きます。曲線が接する最大の M が共振ピーク <i>M</i><sub>t</sub> で、曲線が −180° と 0 dB を横切るところから安定余裕を読み取れます</td></tr>
<tr><td>極・零点配置</td><td>閉ループ極、制御対象と制御器の極・零点、根軌跡、ζ と ω<sub>n</sub> の格子、安定性、安定な <i>k</i> の範囲、極の一覧。「根軌跡の作図規則」を選ぶと、実軸上の根軌跡、漸近線とその交点、分岐点・合流点、虚軸との交点、出発角・到着角を描き、タブ「作図規則」に求め方と値を一覧で示す（手で描いた根軌跡の確認に使える）</td></tr>
</table>
<h4>ボード線図の周波数範囲</h4>
<p>範囲は極・零点・むだ時間・シミュレーション時間から自動で決まります。図の下の <b>周波数範囲</b> に値を入れると手動で設定でき、<b>自動</b> で自動の範囲に戻ります。極・零点・むだ時間・シミュレーション時間が変わったときも自動の範囲に戻ります。安定余裕は常に自動の範囲で求めます。</p>
<h4>根軌跡</h4>
<p>根軌跡は、ループゲインを <i>k</i> 倍（0〜∞）したときの閉ループ極の動きです。軌跡にマウスを乗せるとその点の <i>k</i>、極、ζ、ω<sub>n</sub> を表示し、クリックするとその <i>k</i> を制御器のゲインに掛けます。むだ時間は 3 次のパデ近似で極を求め、飽和は含みません。</p>
<p>応答が発散したときは指標を表示せず、発散したことを知らせます。</p>`],
  },
  {
    id: 'handling',
    en: ['Working with the plots', `
<h4>Show, hide and zoom</h4>
<ul>
<li>Choose the panels in <b>Plots to show</b>, or hide one with the <b>×</b> at the right end of its title (the last panel stays).</li>
<li>Over a plot, the <b>wheel</b> zooms (<kbd>Shift</kbd>: horizontally only, <kbd>Alt</kbd>: vertically only), a <b>drag</b> pans and a <b>double-click</b> shows the whole plot. The buttons <b>＋</b>, <b>−</b>, <b>Fit</b> and <b>PNG</b> appear while the pointer is over the plot. The block diagram zooms in the same way.</li>
<li><b>Save data (CSV)</b> in the title of a plot saves its data; <b>PNG</b> saves the picture. Where files cannot be saved, the data is copied to the clipboard instead.</li>
</ul>
<h4>Arrangement and sizes</h4>
<p>The menu <b>Plot arrangement</b> offers the layouts of <a class="hp-ref" href="#" data-ref="arrange"></a>.</p>
<table data-id="arrange"><caption>The choices of Plot arrangement</caption>
<tr><th>Plot arrangement</th><th>Layout</th></tr>
<tr><td>1 column, 2 columns, 1 row</td><td>The block diagram across the top, the other panels below</td></tr>
<tr><td>Free (drag ⠿)</td><td>Up to 4 columns: drag the <b>⠿</b> handle (or the title) of a panel to another place, a column or a new column</td></tr>
<tr><td>Rows (drag ⠿)</td><td>Rows of 1 to 3 panels side by side; drag <b>⠿</b> to another row or a new row</td></tr>
</table>
<ul>
<li>The bottom edge of a panel and the borders between columns change the sizes; a double-click brings back the original size, and <kbd>Esc</kbd> cancels a drag. The arrow keys also work on a focused handle.</li>
<li>The area under each plot (metrics, options, notes) has tabs; its handle changes its size or hides it.</li>
<li>The layout is remembered in the browser. <b>File › Compare &amp; reset › Reset the layout</b> brings back the first one.</li>
</ul>`],
    ja: ['図を操作する', `
<h4>表示・非表示と拡大</h4>
<ul>
<li>区画は <b>表示する図</b> で選びます。見出しの右端の <b>×</b> でも非表示にできます（最後の 1 つは残ります）。</li>
<li>図の上で <b>ホイール</b> を回すと拡大・縮小（<kbd>Shift</kbd>：横方向のみ、<kbd>Alt</kbd>：縦方向のみ）、<b>ドラッグ</b> で移動、<b>ダブルクリック</b> で全体表示です。マウスを乗せると <b>＋</b>、<b>−</b>、<b>全体表示</b>、<b>PNG</b> のボタンが出ます。ブロック線図も同じように拡大できます。</li>
<li>図の見出しの <b>データを保存（CSV）</b> でデータを、<b>PNG</b> で画像を保存します。ファイルを保存できない環境では、代わりにクリップボードにコピーします。</li>
</ul>
<h4>並べ方と大きさ</h4>
<p>メニュー <b>図の並び方</b> では <a class="hp-ref" href="#" data-ref="arrange"></a> の配置を選べます。</p>
<table data-id="arrange"><caption>図の並び方の選択肢</caption>
<tr><th>図の並び方</th><th>配置</th></tr>
<tr><td>縦に1列、2列、横に1行</td><td>ブロック線図を上段に全幅、その下にほかの区画</td></tr>
<tr><td>自由（⠿ をドラッグ）</td><td>最大 4 列。区画の <b>⠿</b>（または見出し）をドラッグして、別の位置・列・新しい列へ移動</td></tr>
<tr><td>行（⠿ をドラッグ）</td><td>1 行に 1〜3 個の区画を横に並べる。<b>⠿</b> をドラッグして別の行・新しい行へ移動</td></tr>
</table>
<ul>
<li>区画の下端や列の境界をドラッグすると大きさが変わります。ダブルクリックで元の大きさに戻り、ドラッグ中の <kbd>Esc</kbd> で取り消せます。つまみを選んで矢印キーでも操作できます。</li>
<li>各図の下の区画（指標・表示項目・注記）はタブで切り替えます。つまみで大きさを変えたり隠したりできます。</li>
<li>レイアウトはブラウザに記憶されます。<b>ファイル › 比較・リセット › レイアウトを既定に戻す</b> で最初の状態に戻ります。</li>
</ul>`],
  },
  {
    id: 'design',
    en: ['Design aids', `
<h4>Design specifications</h4>
<p>Switch on the specifications you want: overshoot, settling time, rise time, steady-state error, phase margin, gain margin, peak sensitivity Ms and damping ratio ζ. Each one is checked with ✓ or ✗. With <b>Show the specifications on the plots</b>, the limits are drawn in the plots, and the pole-zero map shows the region where the poles should be and the range of <i>k</i> on the root locus that keeps them there.</p>
<h4>Auto-tuning (tuning rules)</h4>
<p>Choose a rule (Ziegler–Nichols step response or ultimate sensitivity, CHR for set-point or disturbance response, IMC) and the controller type (P, PI, PID). The model found from the plant and the computed gains are shown; <b>Apply to the controller</b> puts them into the controller. When a rule cannot be used (for example for an unstable plant), the reason is shown.</p>
<h4>Lead and lag compensator design</h4>
<p>Choose a lead or lag compensator, the target phase margin PM*, the gain <i>K</i><sub>c</sub> (chosen for the steady-state error) and the allowance θ. The card works through the classical frequency-response steps for <i>K</i><sub>c</sub><i>P</i>(<i>s</i>) one by one — lead: the phase to add φ<sub>m</sub>, α, the new crossover ω<sub>m</sub> where |<i>K</i><sub>c</sub><i>P</i>| = √α, and <i>T</i><sub>1</sub>; lag: the new crossover where the phase is −180° + PM* + θ, β and <i>T</i><sub>2</sub> = 10/ω; lead-lag: the new crossover ω<sub>c</sub> (the phase crossover of <i>K</i><sub>c</sub><i>P</i>, or a value you give), the phase to add there φ<sub>m</sub>, α, <i>T</i><sub>1</sub> = 1/(ω<sub>c</sub>√α), β = |<i>K</i><sub>c</sub><i>P</i>(<i>j</i>ω<sub>c</sub>)|/√α and <i>T</i><sub>2</sub> = 10/ω<sub>c</sub> — and shows the phase margin reached. <b>Apply to the controller</b> sets the compensator. When the margin falls short (a lead shifts the crossover where the phase drops fast), increase θ.</p>
<h4>Parameter sweep</h4>
<p>Choose one parameter of the plant or the controller and give up to 8 values separated by commas. The results for every value are drawn in all plots in different colors, and a table lists the overshoot, settling time, margins, stability and the checks of the specifications. Click a row to use that value.</p>
<h4>Estimation exercise</h4>
<p>The card shows the unit step response of a hidden plant <i>P</i>(<i>s</i>) = <i>K</i>e<sup>−<i>Ls</i></sup>/(<i>Ts</i> + 1); moving the mouse over the plot reads <i>t</i> and <i>y</i>. Enter the estimates of <i>K</i>, <i>T</i> and <i>L</i> and press <b>Check</b>: the estimated response is drawn over the true one, and each estimate gets ✓ when it is within 10 %. <b>Show the answer</b> gives the true values, and <b>Use this plant</b> sets them as the plant. The same <b>Exercise number</b> always gives the same plant, so a teacher can give everyone the same exercise (or save it in a scenario); <b>New exercise</b> picks a number at random.</p>
<p>With <b>Read from</b> set to <b>Bode plot</b>, the card draws the gain and the phase of a hidden plant instead, and moving the mouse over them reads ω, the gain and the phase. The exercise number decides which of three plants it is: <i>K</i>/((<i>T</i><sub>1</sub><i>s</i> + 1)(<i>T</i><sub>2</sub><i>s</i> + 1)) (estimate <i>K</i>, <i>T</i><sub>1</sub> and <i>T</i><sub>2</sub>, in either order, from the low-frequency gain and the corner frequencies), <i>K</i>e<sup>−<i>Ls</i></sup>/(<i>Ts</i> + 1) (<i>L</i> from the extra phase lag ω<i>L</i>), or <i>K</i>ω<sub><i>n</i></sub><sup>2</sup>/(<i>s</i><sup>2</sup> + 2ζω<sub><i>n</i></sub><i>s</i> + ω<sub><i>n</i></sub><sup>2</sup>) (ω<sub><i>n</i></sub> where the phase is −90°, ζ from the resonance peak). The card names the form and the values to enter; the check, the answer and <b>Use this plant</b> work as for the step response.</p>
<h4>Comparing responses</h4>
<p><b>File › Compare &amp; reset › Hold current response</b> keeps the current response as a gray line (up to 4) to compare with later settings. <b>Clear held</b> removes them, and <b>Reset to defaults</b> brings back the first settings.</p>`],
    ja: ['設計を支援する機能', `
<h4>設計仕様</h4>
<p>使う仕様を選びます：オーバーシュート、整定時間、立ち上がり時間、定常偏差、位相余裕、ゲイン余裕、最大感度 Ms、減衰係数 ζ。それぞれ ✓ か ✗ で判定します。<b>仕様をグラフに表示</b> を選ぶと、図に仕様の線を描き、極・零点配置には極があるべき領域と、極をその中に保つ根軌跡上の <i>k</i> の範囲を表示します。</p>
<h4>自動調整（チューニング則）</h4>
<p>調整則（ジーグラ・ニコルスのステップ応答法・限界感度法、CHR の目標値応答・外乱応答、IMC）と制御器の種類（P、PI、PID）を選ぶと、制御対象から求めたモデルと計算したゲインを表示します。<b>制御器に適用</b> でそのゲインを制御器に入れます。使えないとき（不安定な制御対象など）は理由を表示します。</p>
<h4>位相進み・遅れ補償器の設計</h4>
<p>位相進み補償器か位相遅れ補償器を選び、目標の位相余裕 PM*、ゲイン <i>K</i><sub>c</sub>（定常偏差から決める）、余裕 θ を入力します。<i>K</i><sub>c</sub><i>P</i>(<i>s</i>) の周波数応答から、古典的な手順を一つずつ示します。位相進みでは、加える位相 φ<sub>m</sub>、α、|<i>K</i><sub>c</sub><i>P</i>| = √α となる新しい交差周波数 ω<sub>m</sub>、<i>T</i><sub>1</sub>。位相遅れでは、位相が −180° + PM* + θ となる新しい交差周波数、β、<i>T</i><sub>2</sub> = 10/ω。位相進み遅れでは、新しい交差周波数 ω<sub>c</sub>（<i>K</i><sub>c</sub><i>P</i> の位相交差周波数、または入力した値）、そこで加える位相 φ<sub>m</sub>、α、<i>T</i><sub>1</sub> = 1/(ω<sub>c</sub>√α)、β = |<i>K</i><sub>c</sub><i>P</i>(<i>j</i>ω<sub>c</sub>)|/√α、<i>T</i><sub>2</sub> = 10/ω<sub>c</sub>。最後に得られる位相余裕を示します。<b>制御器に適用</b> で補償器を設定します。位相余裕が目標に届かないとき（位相進みで、位相が急に下がるところへ交差周波数がずれたときなど）は θ を大きくします。</p>
<h4>パラメータの掃引</h4>
<p>制御対象か制御器のパラメータを 1 つ選び、値をカンマで区切って最大 8 個入力します。すべての値の結果を色を変えてすべての図に重ね、オーバーシュート、整定時間、安定余裕、安定性、設計仕様の判定を表にします。表の行をクリックするとその値を設定に使います。</p>
<h4>推定の演習</h4>
<p>隠された制御対象 <i>P</i>(<i>s</i>) = <i>K</i>e<sup>−<i>Ls</i></sup>/(<i>Ts</i> + 1) の単位ステップ応答を表示します。グラフにマウスを重ねると <i>t</i> と <i>y</i> を読めます。<i>K</i>、<i>T</i>、<i>L</i> の推定値を入力して <b>答え合わせ</b> を押すと、推定値による応答を真の応答に重ね、10 % 以内の推定値に ✓ を付けます。<b>答えを表示</b> で真の値を示し、<b>この制御対象を使う</b> でその値を制御対象に設定します。<b>演習の番号</b> が同じなら制御対象も同じなので、全員に同じ演習を出せます（例題に保存することもできます）。<b>新しい演習</b> は番号を無作為に選びます。</p>
<p><b>読み取る応答</b> を <b>ボード線図</b> にすると、隠された制御対象のゲインと位相を描きます。グラフにマウスを重ねると ω、ゲイン、位相を読めます。制御対象は演習の番号で次の 3 つのどれかに決まります：<i>K</i>/((<i>T</i><sub>1</sub><i>s</i> + 1)(<i>T</i><sub>2</sub><i>s</i> + 1))（低周波のゲインと折れ点周波数から <i>K</i>、<i>T</i><sub>1</sub>、<i>T</i><sub>2</sub> を推定。<i>T</i><sub>1</sub> と <i>T</i><sub>2</sub> の順は問わない）、<i>K</i>e<sup>−<i>Ls</i></sup>/(<i>Ts</i> + 1)（<i>L</i> は余分な位相の遅れ ω<i>L</i> から）、<i>K</i>ω<sub><i>n</i></sub><sup>2</sup>/(<i>s</i><sup>2</sup> + 2ζω<sub><i>n</i></sub><i>s</i> + ω<sub><i>n</i></sub><sup>2</sup>)（位相が −90° になる角周波数が ω<sub><i>n</i></sub>、ζ は共振のピークから）。カードに制御対象の形と入力する値を示します。答え合わせ、答えの表示、<b>この制御対象を使う</b> はステップ応答と同じです。</p>
<h4>応答を比べる</h4>
<p><b>ファイル › 比較・リセット › 現在の応答を保持</b> で今の応答を灰色の線として残し（最大 4 本）、設定を変えた後の応答と比べられます。<b>保持をクリア</b> で消し、<b>初期値に戻す</b> で最初の設定に戻ります。</p>`],
  },
  {
    id: 'files',
    en: ['Saving and sharing', `
<p>The card <b>File › Save and load</b> keeps all the settings as a <b>scenario</b> with a name and a task or note (shown when it is loaded). The layout can be saved with it, and applied or not when it is loaded. The buttons of the card are listed in <a class="hp-ref" href="#" data-ref="save"></a>.</p>
<table data-id="save"><caption>The buttons of Save and load</caption>
<tr><th>Button</th><th>What it does</th></tr>
<tr><td>Save in this browser</td><td>Keeps the scenario in this browser; it appears in the list below, where it can be loaded or deleted</td></tr>
<tr><td>Save to a file / Load from a file</td><td>A .json file to keep or hand out (a file with several scenarios can also be loaded)</td></tr>
<tr><td>Copy as text / Load from text</td><td>Text to paste into a message or a document, and load again</td></tr>
<tr><td>Copy link</td><td>A link that opens the page with the scenario (where the page is served directly)</td></tr>
</table>
<p>The list <b>Examples</b> holds exercises, such as PID control of a third-order plant with limits on the overshoot, settling time and phase margin. Loading one shows its task above the plots.</p>`],
    ja: ['保存と共有', `
<p><b>ファイル › 保存と読み込み</b> のカードで、すべての設定を名前と課題・メモ（読み込んだときに表示）付きの <b>例題</b> として保存できます。レイアウトも一緒に保存でき、読み込むときに反映するかどうかも選べます。カードのボタンを <a class="hp-ref" href="#" data-ref="save"></a> に示します。</p>
<table data-id="save"><caption>保存と読み込みのボタン</caption>
<tr><th>ボタン</th><th>内容</th></tr>
<tr><td>このブラウザに保存</td><td>このブラウザに保存し、下の一覧から読み込み・削除</td></tr>
<tr><td>ファイルに書き出す／ファイルから読み込む</td><td>保存や配布用の .json ファイル（複数の例題を含むファイルも読み込めます）</td></tr>
<tr><td>テキストとしてコピー／テキストから読み込む</td><td>メッセージや文書に貼り付けられるテキストにして、また読み込む</td></tr>
<tr><td>リンクをコピー</td><td>例題を開いた状態でページを開くリンク（ページを直接配信している場合）</td></tr>
</table>
<p><b>例</b> の一覧には演習用の例題があります（3次遅れ系の PID 制御で、オーバーシュート・整定時間・位相余裕に条件があるものなど）。読み込むと、図の上に課題を表示します。</p>`],
  },
  {
    id: 'examples',
    en: ['Trying the exercises', `
<p>Four exercises come with the simulator. Load one with <b>File › Save and load</b>, list <b>Examples</b>, button <b>Load</b>; its task is shown above the plots. The numbers below are those the simulator shows for the settings given (rounded).</p>
<p>Before you start, open <b>Analysis &amp; design › Design specifications</b> and tick <b>Show the specifications on the plots</b>, and choose the plots you need in <b>Plots to show</b>. To compare a new setting with the old one, use <b>File › Compare &amp; reset › Hold current response</b> first.</p>
<h4>Exercise 1: PID control of a third-order plant</h4>
<p>Plant 1/(<i>s</i>+1)<sup>3</sup>, PID with <i>K</i><sub>P</sub> = 1, <i>K</i><sub>I</sub> = 0.3, <i>K</i><sub>D</sub> = 0.5. Specifications: overshoot ≤ 12 %, settling time ≤ 10 s, phase margin ≥ 45° (and gain margin ≥ 6 dB).</p>
<ol>
<li>Add the <b>Bode plot</b>. At first the overshoot is 0 % and the phase margin about 88°, but the settling time is about 15 s: ✗. The loop is safe but slow.</li>
<li>Raise <i>K</i><sub>I</sub> from 0.3 to 0.4. The settling time drops to about 8.4 s and every specification is ✓ (phase margin about 76°; <a class="hp-ref" href="#" data-ref="ex1-time"></a>).
<figure class="hp-fig" data-img="ex1-time" data-id="ex1-time"><figcaption><i>K</i><sub>I</sub> = 0.4 (blue) against the first setting <i>K</i><sub>I</sub> = 0.3 (gray, held). The dashed red line is the overshoot limit and the dotted green lines the settling band; the metrics under the plot show ✓.</figcaption></figure></li>
<li>Compare with the tuning rules (<b>Analysis &amp; design › Auto-tuning</b>, controller type PID, <b>Apply to the controller</b>); <a class="hp-ref" href="#" data-ref="rules"></a> gives the results:
<table data-id="rules"><caption>Exercise 1: the PID tuning rules compared</caption>
<tr><th>Rule</th><th>Overshoot</th><th>Settling time</th><th>Phase margin</th></tr>
<tr><td>Ziegler–Nichols (step response)</td><td>about 55 %</td><td>about 13 s</td><td>about 21°</td></tr>
<tr><td>CHR (set-point, 0% overshoot)</td><td>about 11 %</td><td>about 7.3 s</td><td>about 52°</td></tr>
<tr><td>IMC</td><td>about 15 %</td><td>about 11 s</td><td>about 48°</td></tr>
</table>
Only CHR (set-point, 0 % overshoot) meets all the specifications: its overshoot of about 11 % is within the limit of 12 %. Ziegler–Nichols aims at a fast, oscillating response (a quarter decay ratio), so its overshoot is large and its phase margin small.</li>
</ol>
<h4>Exercise 2: PI control of a plant with dead time</h4>
<p>Plant <i>e</i><sup>−<i>s</i></sup>/(2<i>s</i>+1), PI with <i>K</i><sub>P</sub> = 0.5, <i>K</i><sub>I</sub> = 0.2. Specifications: phase margin ≥ 60°, gain margin ≥ 6 dB, peak sensitivity Ms ≤ 1.6.</p>
<ol>
<li>Add the <b>Bode plot</b> and the <b>Nyquist plot</b> (tick the 1/Ms circle). The margins are large (phase margin about 83°, Ms about 1.22), but the response is slow (settling time about 19 s).</li>
<li>Set <i>K</i><sub>P</sub> = 0.7. In <b>Analysis &amp; design › Parameter sweep</b>, tick the box, choose the parameter <i>K</i><sub>I</sub> and type the values <code>0.2, 0.3, 0.4, 0.5, 0.6</code>. Each value is drawn in its own color, and the table of the sweep compares them (<a class="hp-ref" href="#" data-ref="ex2-table"></a>).
<figure class="hp-fig" data-img="ex2-table" data-id="ex2-table"><figcaption>The table of the sweep (<i>K</i><sub>P</sub> = 0.7). PM is the phase margin, GM the gain margin; the last column tells whether every specification is met.</figcaption></figure>
With <i>K</i><sub>I</sub> = 0.4 the settling time is about 8.8 s, the phase margin about 64° and Ms 1.41. From 0.5 on, the phase margin falls below 60° (about 55°), and at 0.6 Ms also exceeds 1.6 (1.70); with 0.2 every specification is met, but the response is slow (about 22 s). In the Nyquist plot the curves come closer to −1 as <i>K</i><sub>I</sub> grows (<a class="hp-ref" href="#" data-ref="ex2-nyq"></a>). Click the row 0.4 to use that value: it is the fastest one that keeps every specification.
<figure class="hp-fig" data-img="ex2-nyq" data-id="ex2-nyq"><figcaption>The Nyquist plot near −1 (zoomed with the wheel). The purple circle has the radius 1/Ms of the current setting, the dotted green one that of the specification Ms = 1.6.</figcaption></figure></li>
<li>For comparison, the PI rules give: Ziegler–Nichols (step response) Ms about 2.3 and gain margin about 5.7 dB (✗), CHR (set-point, 0 % overshoot) all ✓ but slower (about 12 s), IMC Ms about 2.0 (✗).</li>
</ol>
<h4>Exercise 3: set-point weighting (2-DOF PID)</h4>
<p>Plant <i>e</i><sup>−0.5<i>s</i></sup>/(<i>s</i>+1), 2-DOF PID tuned for disturbance rejection (<i>K</i><sub>P</sub> = 1.9, <i>K</i><sub>I</sub> = 1.583, <i>K</i><sub>D</sub> = 0.399) with weights <i>b</i> = <i>c</i> = 1, and a disturbance <i>d</i> = 0.5 from <i>t</i> = 15 s. Specification: overshoot ≤ 10 %.</p>
<ol>
<li>The step response overshoots by about 19 % (✗; the gray line in <a class="hp-ref" href="#" data-ref="ex3-time"></a>). After <i>t</i> = 15 s the disturbance gives a peak deviation of about 0.21, recovered in about 3.2 s.</li>
<li>In <b>System setup › Controller C(s)</b>, set <i>b</i> = 0.7 and <i>c</i> = 0. The overshoot drops to about 0.3 % (✓; the blue line in <a class="hp-ref" href="#" data-ref="ex3-time"></a>). With <i>b</i> = 0.5 it is almost 0 %, but the response is slower (settling time about 3.6 s instead of 2.4 s).</li>
<li>Look at the disturbance response after <i>t</i> = 15 s: the peak deviation and the recovery time do not change, nor do the stability margins. The weights act only on the path from the reference (<i>C</i><sub>r</sub>), not on the feedback. In the Bode plot, <i>G</i><sub>yr</sub> changes while <i>G</i><sub>yd</sub> stays the same.
<figure class="hp-fig" data-img="ex3-time" data-id="ex3-time"><figcaption><i>b</i> = 0.7, <i>c</i> = 0 (blue) against <i>b</i> = <i>c</i> = 1 (gray, held). The overshoot to the set-point is gone, while after <i>t</i> = 15 s the two responses to the disturbance lie on each other.</figcaption></figure></li>
<li>The gain margin (about 4.9 dB) stays below 6 dB whatever <i>b</i> and <i>c</i> are: it belongs to the feedback gains.</li>
</ol>
<h4>Exercise 4: stabilizing an unstable plant</h4>
<p>Plant 1/(<i>s</i>−1), P control with <i>K</i><sub>P</sub> = 0.5. Specification: damping ratio ζ ≥ 0.5.</p>
<ol>
<li>The output grows without bound: the closed loop is unstable. Add the <b>Pole-zero map</b>: the closed-loop pole is in the right half-plane (<a class="hp-ref" href="#" data-ref="ex4-pz"></a>), and the note gives the stable range <i>k</i> &gt; 2 of the gain factor, that is <i>K</i><sub>P</sub> &gt; 1.
<figure class="hp-fig" data-img="ex4-pz" data-id="ex4-pz"><figcaption>P control with <i>K</i><sub>P</sub> = 0.5: the closed-loop pole (●) is at +0.5, in the right half-plane (shaded). The tab <b>Gain range</b> gives the stable range <i>k</i> &gt; 2.</figcaption></figure></li>
<li>Click the root locus to the left of the origin, or set <i>K</i><sub>P</sub> = 2: the loop is stable, but the output settles at 2 instead of 1. With <i>K</i><sub>P</sub> = 5 it settles at 1.25. With P control the final value is <i>K</i><sub>P</sub>/(<i>K</i><sub>P</sub> − 1), never 1.</li>
<li>Choose <b>PI</b> with <i>K</i><sub>P</sub> = 3 and <i>K</i><sub>I</sub> = 2: the closed-loop poles are −1 ± <i>j</i> (ζ ≈ 0.71, ✓), the steady-state error is 0 and the settling time about 3.3 s (<a class="hp-ref" href="#" data-ref="ex4-time"></a>).
<figure class="hp-fig" data-img="ex4-time" data-id="ex4-time"><figcaption>PI with <i>K</i><sub>P</sub> = 3, <i>K</i><sub>I</sub> = 2: the output settles at 1. The large overshoot comes from the zero of the controller (next step).</figcaption></figure></li>
<li>Try <i>K</i><sub>I</sub> = 1: the poles meet at −1 (ζ = 1), yet the overshoot stays about 45 %. It comes from the zero of the controller at −<i>K</i><sub>I</sub>/<i>K</i><sub>P</sub>, not from the poles.</li>
</ol>`],
    ja: ['例題で試す', `
<p>シミュレーターには 4 つの演習用の例題があります。<b>ファイル › 保存と読み込み</b> の <b>例</b> の一覧で <b>読み込む</b> を押すと読み込まれ、図の上に課題を表示します。以下の数値は、書いてある設定のときにシミュレーターが表示する値です（四捨五入）。</p>
<p>始める前に、<b>解析・設計 › 設計仕様</b> で <b>仕様をグラフに表示</b> を選び、必要な図を <b>表示する図</b> で加えておきます。設定を変える前の応答と比べたいときは、先に <b>ファイル › 比較・リセット › 現在の応答を保持</b> を押します。</p>
<h4>演習 1：3次系の PID 制御</h4>
<p>制御対象 1/(<i>s</i>+1)<sup>3</sup>、PID（<i>K</i><sub>P</sub> = 1、<i>K</i><sub>I</sub> = 0.3、<i>K</i><sub>D</sub> = 0.5）。仕様：オーバーシュート 12 % 以下、整定時間 10 s 以下、位相余裕 45° 以上（とゲイン余裕 6 dB 以上）。</p>
<ol>
<li><b>ボード線図</b> を加えます。最初はオーバーシュート 0 %、位相余裕 約 88° ですが、整定時間が 約 15 s で ✗ です。安定ですが遅い応答です。</li>
<li><i>K</i><sub>I</sub> を 0.3 から 0.4 に上げます。整定時間が 約 8.4 s になり、すべての仕様が ✓ になります（位相余裕 約 76°、<a class="hp-ref" href="#" data-ref="ex1-time"></a>）。
<figure class="hp-fig" data-img="ex1-time" data-id="ex1-time"><figcaption><i>K</i><sub>I</sub> = 0.4（青）と最初の設定 <i>K</i><sub>I</sub> = 0.3（灰色、保持した応答）。赤の破線がオーバーシュートの上限、緑の点線が整定の幅です。図の下の指標に ✓ が付きます。</figcaption></figure></li>
<li>チューニング則と比べます（<b>解析・設計 › 自動調整</b>、制御器の種類 PID、<b>制御器に適用</b>）。結果を <a class="hp-ref" href="#" data-ref="rules"></a> に示します：
<table data-id="rules"><caption>演習 1：PID のチューニング則の比較</caption>
<tr><th>調整則</th><th>オーバーシュート</th><th>整定時間</th><th>位相余裕</th></tr>
<tr><td>ジーグラ・ニコルス（ステップ応答法）</td><td>約 55 %</td><td>約 13 s</td><td>約 21°</td></tr>
<tr><td>CHR（目標値追従、オーバーシュート 0%）</td><td>約 11 %</td><td>約 7.3 s</td><td>約 52°</td></tr>
<tr><td>IMC</td><td>約 15 %</td><td>約 11 s</td><td>約 48°</td></tr>
</table>
すべての仕様を満たすのは CHR（目標値追従、オーバーシュート 0%）だけです（オーバーシュート 約 11 % は上限の 12 % 以内）。ジーグラ・ニコルスは減衰比 1/4 の速く振動する応答をねらうため、オーバーシュートが大きく位相余裕が小さくなります。</li>
</ol>
<h4>演習 2：むだ時間を含む系の PI 制御</h4>
<p>制御対象 <i>e</i><sup>−<i>s</i></sup>/(2<i>s</i>+1)、PI（<i>K</i><sub>P</sub> = 0.5、<i>K</i><sub>I</sub> = 0.2）。仕様：位相余裕 60° 以上、ゲイン余裕 6 dB 以上、最大感度 Ms 1.6 以下。</p>
<ol>
<li><b>ボード線図</b> と <b>ナイキスト線図</b>（1/Ms の円も表示）を加えます。余裕は大きい（位相余裕 約 83°、Ms 約 1.22）ものの、応答は遅めです（整定時間 約 19 s）。</li>
<li><i>K</i><sub>P</sub> = 0.7 にしてから、<b>解析・設計 › パラメータの掃引</b> でチェックを入れ、パラメータに <i>K</i><sub>I</sub> を選び、値に <code>0.2, 0.3, 0.4, 0.5, 0.6</code> と入力します。値ごとに色の違う線が重なり、掃引の表で比べられます（<a class="hp-ref" href="#" data-ref="ex2-table"></a>）。
<figure class="hp-fig" data-img="ex2-table" data-id="ex2-table"><figcaption>掃引の表（<i>K</i><sub>P</sub> = 0.7）。PM は位相余裕、GM はゲイン余裕、最後の列はすべての仕様を満たすかどうかです。</figcaption></figure>
<i>K</i><sub>I</sub> = 0.4 では整定時間 約 8.8 s、位相余裕 約 64°、Ms 1.41 です。0.5 以上では位相余裕が 60° を下回り（約 55°）、0.6 では Ms も 1.6 を超えます（1.70）。0.2 はすべての仕様を満たしますが、応答が遅くなります（約 22 s）。<i>K</i><sub>I</sub> が大きいほど、ナイキスト線図の曲線が −1 に近づきます（<a class="hp-ref" href="#" data-ref="ex2-nyq"></a>）。表の 0.4 の行をクリックしてその値を使います。仕様をすべて満たす中で最も速い設定です。
<figure class="hp-fig" data-img="ex2-nyq" data-id="ex2-nyq"><figcaption>−1 の付近のナイキスト線図（ホイールで拡大）。紫の円は現在の設定の半径 1/Ms、緑の点線の円は仕様 Ms = 1.6 の半径です。</figcaption></figure></li>
<li>比較として、PI のチューニング則では、ジーグラ・ニコルス（ステップ応答法）が Ms 約 2.3、ゲイン余裕 約 5.7 dB で ✗、CHR（目標値追従、オーバーシュート 0%）はすべて ✓ ですが遅め（約 12 s）、IMC は Ms 約 2.0 で ✗ です。</li>
</ol>
<h4>演習 3：目標値の重み付け（2自由度 PID）</h4>
<p>制御対象 <i>e</i><sup>−0.5<i>s</i></sup>/(<i>s</i>+1)、外乱抑制向けに調整した 2自由度 PID（<i>K</i><sub>P</sub> = 1.9、<i>K</i><sub>I</sub> = 1.583、<i>K</i><sub>D</sub> = 0.399）、重み <i>b</i> = <i>c</i> = 1、<i>t</i> = 15 s から外乱 <i>d</i> = 0.5。仕様：オーバーシュート 10 % 以下。</p>
<ol>
<li>ステップ応答のオーバーシュートは 約 19 %（✗、<a class="hp-ref" href="#" data-ref="ex3-time"></a> の灰色の線）です。<i>t</i> = 15 s 以降は、外乱による最大変動が 約 0.21、回復時間が 約 3.2 s です。</li>
<li><b>系の設定 › 制御器 C(s)</b> で <i>b</i> = 0.7、<i>c</i> = 0 にします。オーバーシュートは 約 0.3 %（✓、<a class="hp-ref" href="#" data-ref="ex3-time"></a> の青い線）に下がります。<i>b</i> = 0.5 ではほぼ 0 % ですが、応答は遅くなります（整定時間 約 2.4 s → 約 3.6 s）。</li>
<li><i>t</i> = 15 s 以降の外乱応答を見ます。最大変動も回復時間も、安定余裕も変わりません。重みは目標値からの経路（<i>C</i><sub>r</sub>）だけに作用し、フィードバックには影響しないためです。ボード線図でも <i>G</i><sub>yr</sub> は変わり、<i>G</i><sub>yd</sub> は変わりません。
<figure class="hp-fig" data-img="ex3-time" data-id="ex3-time"><figcaption><i>b</i> = 0.7、<i>c</i> = 0（青）と <i>b</i> = <i>c</i> = 1（灰色、保持した応答）。目標値に対するオーバーシュートはなくなり、<i>t</i> = 15 s 以降の外乱に対する応答は 2 本が重なっています。</figcaption></figure></li>
<li>ゲイン余裕（約 4.9 dB）は <i>b</i>、<i>c</i> をどう変えても 6 dB に届きません。フィードバックのゲインで決まる量だからです。</li>
</ol>
<h4>演習 4：不安定な制御対象の安定化</h4>
<p>制御対象 1/(<i>s</i>−1)、P 制御（<i>K</i><sub>P</sub> = 0.5）。仕様：減衰係数 ζ 0.5 以上。</p>
<ol>
<li>出力が限りなく大きくなり、閉ループは不安定です。<b>極・零点配置</b> を加えると、閉ループ極が右半平面にあり（<a class="hp-ref" href="#" data-ref="ex4-pz"></a>）、注記に安定なゲイン倍率の範囲 <i>k</i> &gt; 2、つまり <i>K</i><sub>P</sub> &gt; 1 が表示されます。
<figure class="hp-fig" data-img="ex4-pz" data-id="ex4-pz"><figcaption>P 制御（<i>K</i><sub>P</sub> = 0.5）：閉ループ極（●）は +0.5 で、右半平面（色付きの領域）にあります。<b>ゲインの範囲</b> のタブに安定な範囲 <i>k</i> &gt; 2 が表示されます。</figcaption></figure></li>
<li>根軌跡の原点より左の点をクリックするか、<i>K</i><sub>P</sub> = 2 にすると安定になりますが、出力は 1 ではなく 2 に落ち着きます。<i>K</i><sub>P</sub> = 5 では 1.25 です。P 制御では最終値が <i>K</i><sub>P</sub>/(<i>K</i><sub>P</sub> − 1) となり、1 にはなりません。</li>
<li>制御器を <b>PI</b> にし、<i>K</i><sub>P</sub> = 3、<i>K</i><sub>I</sub> = 2 とします。閉ループ極は −1 ± <i>j</i>（ζ ≈ 0.71、✓）、定常偏差は 0、整定時間は 約 3.3 s です（<a class="hp-ref" href="#" data-ref="ex4-time"></a>）。
<figure class="hp-fig" data-img="ex4-time" data-id="ex4-time"><figcaption>PI（<i>K</i><sub>P</sub> = 3、<i>K</i><sub>I</sub> = 2）：出力は 1 に落ち着きます。大きなオーバーシュートは制御器の零点によるものです（次の手順）。</figcaption></figure></li>
<li><i>K</i><sub>I</sub> = 1 も試します。極は −1 で重なり（ζ = 1）ますが、オーバーシュートは 約 45 % のままです。これは極ではなく、制御器の零点 −<i>K</i><sub>I</sub>/<i>K</i><sub>P</sub> によるものです。</li>
</ol>`],
  },
  {
    id: 'other',
    en: ['Language, smartphones, keyboard and data', `
<ul>
<li><b>Language</b>: choose English, Japanese, Chinese, Korean or Thai at the top right; the choice is remembered.</li>
<li><b>Narrow screens</b>: the panels are shown in one column and the menus without their icons. On a smartphone, the bar at the bottom switches between <b>Setup</b> and <b>Plots</b>.</li>
<li><b>Keyboard</b>: every menu, handle and button can be used with the keyboard. In a menu, <kbd>↑</kbd> <kbd>↓</kbd> move and <kbd>Enter</kbd> chooses; <kbd>Esc</kbd> closes a menu or this manual.</li>
<li><b>Data</b>: the computation runs in your browser, and the simulator sends neither your settings nor the results anywhere. Saved scenarios, the layout and the language are kept in this browser only. When the page opens, the browser loads the fonts from Google Fonts and the formula display (MathJax) from jsDelivr; as with any web page, these services and the server of the page learn your IP address and browser, but not your settings. A link made with <b>Copy link</b> carries the settings after <code>#</code> in the address, a part that the browser does not send to the server.</li>
</ul>`],
    ja: ['言語・スマートフォン・キーボード・データ', `
<ul>
<li><b>言語</b>：右上で日本語・英語・中国語・韓国語・タイ語を選べます。選んだ言語は記憶されます。</li>
<li><b>狭い画面</b>：区画を 1 列に並べ、メニューのアイコンを省きます。スマートフォンでは画面下のバーで <b>設定</b> と <b>図</b> を切り替えます。</li>
<li><b>キーボード</b>：すべてのメニュー・つまみ・ボタンをキーボードで操作できます。メニューでは <kbd>↑</kbd> <kbd>↓</kbd> で移動し <kbd>Enter</kbd> で選びます。<kbd>Esc</kbd> でメニューやこのマニュアルを閉じます。</li>
<li><b>データ</b>：計算はブラウザの中で行い、入力した設定や計算結果をシミュレーターが外部に送ることはありません。保存した例題・レイアウト・言語は、このブラウザの中だけに保存します。ページを開くとき、ブラウザは Google Fonts からフォントを、jsDelivr から数式表示の MathJax を読み込みます。このとき、一般のウェブページと同じく、それらのサービスとページを配信するサーバーには IP アドレスやブラウザの種類が伝わりますが、設定は伝わりません。<b>リンクをコピー</b> で作るリンクは、設定をアドレスの <code>#</code> の後に入れます。この部分はブラウザがサーバーに送りません。</li>
</ul>`],
  },
  {
    id: 'accuracy',
    en: ['Numerical accuracy', `
<p>The results are computed numerically and carry small errors. Compared with exact solutions and with independent, far more accurate computations, they stay within these bounds:</p>
<ul>
<li><b>Time response</b>: within about 0.3 % of the size of the response; the overshoot within 0.1 percentage point, the rise and settling times within 0.5 %.</li>
<li><b>Bode and Nyquist plots</b>: computed directly from the transfer functions (the dead time exactly); the phase margin within 0.02°, the gain margin within 0.001 dB, Ms within 10<sup>−6</sup> (relative).</li>
<li><b>Poles and zeros</b>: within 10<sup>−9</sup> when they are distinct. A pole repeated <i>k</i> times can only be found to a few times 10<sup>−16/<i>k</i></sup> (2×10<sup>−5</sup> for a triple pole): a limit of the problem itself, not of the method.</li>
<li><b>Dead time</b>: the time and frequency responses use the exact delay; the poles and the root locus use a third-order Padé approximation (the dominant poles within about 10<sup>−3</sup> for <i>L</i>/<i>T</i> ≤ 3).</li>
</ul>
<p>Keep in mind: the response is recorded at 4000 points over the simulation time, so a change much faster than (simulation time)/4000 cannot be resolved; shorten the simulation time to see it. The plotted <i>u</i> is its value at those points, so a very short peak (such as the derivative kick, which lasts about 1/<i>N</i>) may look lower than it is.</p>
<p>The methods and all the results are in <a href="https://github.com/m-koga/sigmaomega/blob/main/ACCURACY.md" target="_blank" rel="noopener">ACCURACY.md</a> on GitHub.</p>`],
    ja: ['数値精度', `
<p>結果は数値計算で求めているため、わずかな誤差を含みます。厳密解や、別の方法ではるかに高い精度で求めた値と比べると、誤差は次の範囲に収まります。</p>
<ul>
<li><b>時間応答</b>：応答の大きさの 約 0.3 % 以内。オーバーシュートは 0.1 ポイント以内、立ち上がり時間と整定時間は 0.5 % 以内。</li>
<li><b>ボード線図・ナイキスト線図</b>：伝達関数から直接計算します（むだ時間も厳密）。位相余裕は 0.02° 以内、ゲイン余裕は 0.001 dB 以内、Ms は相対誤差 10<sup>−6</sup> 以内。</li>
<li><b>極・零点</b>：互いに異なる値なら 10<sup>−9</sup> 以内。<i>k</i> 重の極は 10<sup>−16/<i>k</i></sup> の数倍（3 重なら 2×10<sup>−5</sup>）までしか求まりません。これは計算方法ではなく問題そのものの限界です。</li>
<li><b>むだ時間</b>：時間応答と周波数応答では厳密な遅れを使います。極と根軌跡は 3 次の Padé 近似によるもので、<i>L</i>/<i>T</i> ≤ 3 なら主な極の誤差は 約 10<sup>−3</sup> です。</li>
</ul>
<p>注意：応答はシミュレーション時間を 4000 点に分けて記録するため、（シミュレーション時間）/4000 よりずっと速い変化は捉えられません。その場合はシミュレーション時間を短くしてください。図の <i>u</i> もこの点での値なので、ごく短いピーク（約 1/<i>N</i> で消える微分の立ち上がりなど）は実際より低く見えることがあります。</p>
<p>評価の方法とすべての結果は、GitHub の <a href="https://github.com/m-koga/sigmaomega/blob/main/ACCURACY.ja.md" target="_blank" rel="noopener">ACCURACY.ja.md</a> にあります。</p>`],
  },
  {
    id: 'performance',
    en: ['Time efficiency', `
<p>Everything is computed in your browser, again after every change. Measured in Chrome on an ordinary computer, and with the processor slowed down 4 times (like a phone):</p>
<ul>
<li><b>Opening the page</b>: the plots are ready after about 0.25 s (0.8 s on the slower processor) and the formulas a little later, once the page has been downloaded (about 0.4 MB, and 0.7 MB for the formulas on the first visit).</li>
<li><b>Changing a value</b>: everything is computed and drawn again in 4–19 ms with the panels shown at a first visit, and in 22–43 ms with every panel (0.1–0.2 s on the slower processor): it feels immediate.</li>
<li><b>Dragging a slider</b>: the plots follow about 20–50 times a second (6–11 on the slower processor), each time with the complete result.</li>
<li><b>Parameter sweep</b>: eight full computations per change, 0.06–0.2 s (up to about 1 s on the slower processor).</li>
</ul>
<p>The work for one change has an upper limit (at most 400,000 time steps, 2400 frequencies and 8 sweep values), so the page never stalls for long. On a slow device, hide the panels you do not need (the pole-zero map with its root locus adds the most) and switch the sweep off while you drag sliders.</p>
<p>How it was measured and all the results are in <a href="https://github.com/m-koga/sigmaomega/blob/main/PERFORMANCE.md" target="_blank" rel="noopener">PERFORMANCE.md</a> on GitHub.</p>`],
    ja: ['時間効率', `
<p>計算はすべてブラウザの中で、変更のたびに行います。一般的な計算機の Chrome で計測した結果と、処理速度を 4 分の 1 にした場合（スマートフォン程度）の結果は次のとおりです。</p>
<ul>
<li><b>ページを開く</b>：ページのダウンロード（約 0.4 MB。初めて開くときは式の表示用に 0.7 MB が加わる）の後、約 0.25 秒（処理速度 4 分の 1 では 0.8 秒）で図が表示され、少し遅れて式が表示されます。</li>
<li><b>値を変える</b>：すべての計算と描画のやり直しは、最初に表示される図だけなら 4〜19 ms、すべての図を表示して 22〜43 ms です（処理速度 4 分の 1 では 0.1〜0.2 秒）。すぐに反応したと感じられる速さです。</li>
<li><b>スライダーをドラッグする</b>：図が 1 秒に 約 20〜50 回（処理速度 4 分の 1 では 6〜11 回）、そのつど完全な結果で追従します。</li>
<li><b>パラメータの掃引</b>：1 回の変更で 8 回分の計算をすべて行い、0.06〜0.2 秒かかります（処理速度 4 分の 1 では最大 約 1 秒）。</li>
</ul>
<p>1 回の変更で行う計算の量には上限があるため（時間刻みは最大 40 万、周波数は最大 2400 点、掃引は最大 8 個の値）、ページが長く止まることはありません。遅い機器では、使わない図を隠し（根軌跡付きの極・零点配置が最も重い）、スライダーを動かす間は掃引を切ってください。</p>
<p>計測の方法とすべての結果は、GitHub の <a href="https://github.com/m-koga/sigmaomega/blob/main/PERFORMANCE.ja.md" target="_blank" rel="noopener">PERFORMANCE.ja.md</a> にあります。</p>`],
  },
  {
    id: 'faq',
    en: ['When something does not work', `
<dl>
<dt>No metrics are shown and the plot runs off.</dt><dd>The closed loop is unstable and the response diverged. Lower the gains, or look at the pole-zero map and the stable range of <i>k</i>.</dd>
<dt>The plot shows only part of the curve.</dt><dd>It may be zoomed: press <b>Fit</b> or double-click the plot. For the Bode plot, also check whether a frequency range was set by hand (<b>Auto</b> brings back the automatic one).</dd>
<dt>A transfer function is not accepted.</dt><dd>Read the message under the input. The plant must be strictly proper and the controller proper; an ideal derivative <i>K</i><sub>D</sub><i>s</i> needs a filter such as <i>K</i><sub>D</sub><i>s</i>/(τ<i>s</i>+1).</dd>
<dt>A file or a picture is not saved.</dt><dd>Some viewers do not allow downloads; the data is then copied to the clipboard (or shown selected so it can be copied by hand).</dd>
<dt>The layout is in a muddle.</dt><dd>Use <b>File › Compare &amp; reset › Reset the layout</b>; the settings are kept.</dd>
</dl>`],
    ja: ['うまくいかないとき', `
<dl>
<dt>指標が表示されず、線が図の外へ飛び出す</dt><dd>閉ループが不安定で応答が発散しています。ゲインを下げるか、極・零点配置と安定な <i>k</i> の範囲を確かめてください。</dd>
<dt>線の一部しか見えない</dt><dd>拡大されている可能性があります。<b>全体表示</b> を押すか、図をダブルクリックしてください。ボード線図では、周波数範囲を手動で設定していないかも確かめてください（<b>自動</b> で戻ります）。</dd>
<dt>伝達関数を受け付けない</dt><dd>入力欄の下のメッセージを確かめてください。制御対象は厳密にプロパー、制御器はプロパーである必要があります。理想微分 <i>K</i><sub>D</sub><i>s</i> は <i>K</i><sub>D</sub><i>s</i>/(τ<i>s</i>+1) のようにフィルターを付けて書きます。</dd>
<dt>ファイルや画像が保存されない</dt><dd>ダウンロードできない表示環境があります。その場合はクリップボードにコピーします（それもできないときは、手でコピーできるよう文字列を選択して表示します）。</dd>
<dt>レイアウトが崩れた</dt><dd><b>ファイル › 比較・リセット › レイアウトを既定に戻す</b> を使ってください。設定はそのまま残ります。</dd>
</dl>`],
  },
];

// The manual in the language of the page (English for Chinese, Korean and Thai, with a note)
export function renderHelp() {
  const ja = docsLang() === 'ja',
    text = (s: HelpSection) => (ja ? s.ja : s.en);
  $('helpToc').innerHTML = HELP.map(
    (s, i) => `<button type="button" class="hp-link" data-sec="${s.id}">${i + 1}. ${text(s)[0]}</button>`,
  ).join('');
  $('helpBody').innerHTML =
    (docsTranslated() ? '' : `<p class="note">${T('(The user manual is shown in English.)')}</p>`) +
    HELP.map((s, i) => `<section id="help-${s.id}"><h3>${i + 1}. ${text(s)[0]}</h3>${text(s)[1]}</section>`).join('');
  // the screenshots (<figure data-img="name">): the Japanese one in Japanese, else the English one; the pictures
  // are put into the page by the build (<script type="text/plain" data-help-img="name.lang" data-w="width">)
  $('helpBody')
    .querySelectorAll<HTMLElement>('figure[data-img]')
    .forEach(f => {
      const key = f.dataset.img,
        data = document.querySelector<HTMLElement>(`script[data-help-img="${key}.${ja ? 'ja' : 'en'}"]`);
      if (!data) return;
      const img = document.createElement('img');
      img.src = 'data:image/webp;base64,' + (data.textContent || '').replace(/\s/g, '');
      img.width = Number(data.dataset.w);
      img.alt = f.textContent || '';
      img.loading = 'lazy';
      f.prepend(img);
    });
  numberHelp(ja);
}

// Figures and tables are numbered by section ("Fig. 8.1", "Table 2.1"; "図 8.1", "表 2.1"): each <figure> and
// <table> has data-id and a caption, which gets the number in front. A reference in the text,
// <a class="hp-ref" data-ref="id">, gets the number as its text and scrolls to the figure or table when clicked.
// Returns the number of each id (for the tests)
export function numberHelp(ja: boolean): Record<string, string> {
  const nums: Record<string, string> = {};
  $('helpBody')
    .querySelectorAll<HTMLElement>('section')
    .forEach((sec, i) => {
      const count = { fig: 0, tab: 0 };
      sec.querySelectorAll<HTMLElement>('figure[data-id], table[data-id]').forEach(el => {
        const fig = el.tagName === 'FIGURE',
          n = `${i + 1}.${++count[fig ? 'fig' : 'tab']}`,
          label = fig ? (ja ? `図 ${n}` : `Fig. ${n}`) : ja ? `表 ${n}` : `Table ${n}`,
          cap = el.querySelector(fig ? 'figcaption' : 'caption');
        nums[el.dataset.id as string] = label;
        el.id = `help-fig-${el.dataset.id}`;
        if (cap) cap.insertAdjacentHTML('afterbegin', `<span class="hp-num">${label}</span>`);
      });
    });
  $('helpBody')
    .querySelectorAll<HTMLElement>('a.hp-ref')
    .forEach(a => (a.textContent = nums[a.dataset.ref as string] ?? '?'));
  return nums;
}

// Open and close: the Help button, ×, a click beside the dialog, Escape; the focus returns to the Help button
(() => {
  const btn = $('helpBtn'),
    back = $('helpBack');
  const close = () => {
    back.classList.remove('open');
    btn.focus();
  };
  btn.onclick = () => {
    renderHelp();
    back.classList.add('open');
    $('helpBody').scrollTop = 0;
    $('helpClose').focus();
  };
  $('helpClose').onclick = close;
  back.addEventListener('click', e => {
    if (e.target === back) close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && back.classList.contains('open')) close();
  });
  // the list of sections scrolls the text to the section
  $('helpToc').addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('.hp-link');
    if (!b) return;
    const sec = document.getElementById(`help-${b.dataset.sec}`);
    // (the text is positioned, so the offset of a section is counted from the top of the text)
    if (sec) $('helpBody').scrollTop = sec.offsetTop;
  });
  // a reference to a figure or table scrolls the text so that it is in view, and marks it for a moment
  $('helpBody').addEventListener('click', e => {
    const a = (e.target as Element).closest<HTMLElement>('a.hp-ref');
    if (!a) return;
    e.preventDefault();
    const el = document.getElementById(`help-fig-${a.dataset.ref}`);
    if (!el) return;
    const body = $('helpBody'),
      y = el.getBoundingClientRect().top - body.getBoundingClientRect().top;
    body.scrollTop += y - 12;
    el.classList.remove('hp-hit');
    void el.offsetWidth; // (restarts the animation)
    el.classList.add('hp-hit');
  });
})();
