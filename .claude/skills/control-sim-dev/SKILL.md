---
name: "control-sim-dev"
description: "Use when changing, testing or releasing the SigmaOmega (Feedback Control Simulator) web app (GitHub m-koga/sigmaomega, org artifact 5e89748a-…): features, UI, refactors, tests, version bump and republish. This copy in the repository is the authoritative one."
---

# SigmaOmega（フィードバック制御シミュレーター）の開発

> **開発者（メンテナー）用。** Claude Code がこのリポジトリで作業するときに読む手順書（日本語）。シミュレーターを使う人や、外部から貢献する人は読む必要はない（人向けの開発手順は `CONTRIBUTING.md`／`CONTRIBUTING.ja.md`）。アーティファクトの slug やアカウントの扱いなど、開発者の claude.ai の環境に固有の手順を含む。

ブラウザで動くフィードバック制御シミュレーター（Masanobu Koga, Kyushu Institute of Technology）を改良し、テストし、公開するまでの手順と決まりごと。

- リポジトリ：`m-koga/sigmaomega`（作業場所 `/home/claude/sigmaomega`）。公開を前提にした履歴で、2026-11-25 に v1.73.4 までの開発用リポジトリ `m-koga/control-sim`（アーカイブ）の履歴を 1 つのコミットにまとめて始めた。以前の経緯は更新履歴にある。
- 公開先：組織に共有中のアーティファクト slug `5e89748a-9d03-41d3-ae07-5216b6811526`（shared_live は `org`）
- 返答はすべて日本語。UI の文字列・コメント・テスト名は英語。
- 開発者は古賀雅伸（Masanobu Koga）1 人だが、Claude の複数のアカウントから作業する。この手順書はリポジトリの `.claude/skills/control-sim-dev/SKILL.md` が正本。手順を変えたらこのファイルを直してコミットする（アカウントの個人スキルに古い写しがあっても、こちらを優先する）。

## 0. 準備

1. リポジトリが無ければ `add_repo`（owner `m-koga`, repo `sigmaomega`, access `push`）→ 指示どおり clone → `register_repo_root`。
2. `npm ci`（Node ≥ 22.18）。ブラウザのテストとスクリーンショットは `/usr/bin/google-chrome` を使う。
3. 別のアカウントからの変更を取り込む：`git status` が空であることを確かめてから `git pull --rebase`。最新の版番号は `src/ts/01-changelog.ts` の先頭で確かめる（会話の記憶より優先する）。
4. 作業を始める前に、比較用に現在のビルドを保存する：`cp index.html /tmp/index.before.html`。
5. 公開中の最新版（base_version）は `get_artifact` で確認する（別のアカウントが公開していることがあるので、前回の publish 結果を当てにしない）。
6. 前回の push の CI を確かめる：`gh run list -L 3`。失敗していたら、新しい作業より先に `gh run view <id> --log-failed` で原因を調べて直し、公開し直してから、そのことを最初に報告する。実行中なら作業を続け、公開前にもう一度見る。

## 1. 構成

- `src/index.html`（`@@VERSION@@`、`/*@@CSS@@*/`、`//@@JS@@` を置き換えるひな形）、`src/style.css`、`src/i18n.json`、`src/ts/*.ts`。
- `src/ts/NN-*.ts` は ES モジュール。`scripts/build.ts` が型を除き、`import`/`export` を消して、ファイル名の順に 1 つのスクリプトにつなぎ、`index.html` を作る。
  - 新しいソースファイルの先頭には `// SPDX-License-Identifier: Apache-2.0` と `// Copyright 2026 Masanobu Koga` の 2 行を入れる（CSS・YAML・HTML はそれぞれのコメントの書き方。`tests/license-headers.test.ts` が確かめる）。
  - ファイルは層（`tests/modules.test.ts` が確かめる。各ファイルは番号の小さいファイルからだけ import する。下の層が上の層を呼ぶ必要ができたら、そのコードを下に移すか、上の層で設定する。01–12 はページに触れない）：
    - 計算：01 更新履歴、02 翻訳（`T()`・`LANGUAGES`）、03 複素数と多項式・数の表記、04 構文解析、05 定義（設定パネルのカード `CARD_KEYS`・`CARD_GROUP` も）、06 状態（`S`、`ctrlRational`・`refValue` など設定から決まるもの、最後の結果 `lastSim` など。書き換えは `setResults()`）、07 周波数応答、08 シミュレーション、09 ループと閉ループ極・根軌跡、10 調整則、11 設計仕様の評価、12 掃引の計算。
    - 表示：13 ページの要素（`$`・`byId`）・ファイル・メッセージ・ページの翻訳、14 表示の状態（`layout`・`shownPanels`・`PLOT_VIEWS`・`COLORS`・行と列の配置の正規化）、15 描画、16 極・零点配置の描画、17 パネルの内容（ブロック線図・式・設計仕様・調整則・掃引の表示）、18 `update()`・`redraw()`。
    - 操作：19 設定パネルの構築とイベント、20 図の操作（拡大縮小・極・零点配置・ボードとナイキストの表示項目）、21 書き出し、22 行による配置、23 図の配置と高さ（列の自由な配置、`applyPanels`）、24 ページのレイアウト（図の下の区画・設定パネル・更新履歴）、25 例題、26 メニューバー（共通の `dropdown()`）、27 ブロック線図の拡大・縮小・移動と PNG、28 利用者マニュアル（本文は英語と日本語。辞書を通さない。章「例題で試す」の `<figure data-img>` のスクリーンショットは `src/help-img/<名前>.<en|ja>.webp`。画面の見た目や演習の数値が変わる変更のあとは `npm run shots` で撮り直してから `npm run build`。新しい画像を入れた版は `edit_version` では公開できない。アイコンの図案は `src/icon.svg`。変えたら `npm run icon` で PNG のアイコン（`src/icon-180.png`、`-192`、`-512`、`-maskable-512`）も作り直す。GitHub Pages 用のサイトは `npm run pages` で `site/` に書き出す（マニフェストは `src/manifest.webmanifest`。アーティファクトには入らない）。図と表には `data-id` と説明文（`figcaption`・`caption`）を付け、本文から `<a class="hp-ref" href="#" data-ref="id"></a>` で参照する。番号は表示時に章ごとに振る）、29 言語の切り替え（`setLang`）、99 起動。
  - 画面：ヘッダーの下のメニューバー（ファイル、表示する図、系の設定、解析・設計、図の並び方、指標の表示）。その下に設定パネル（選んだカード 1 枚だけ）と図の区画。新しいプルダウンは `26-menubar.ts` の `dropdown()` を使う。
- 型：`src/ts/types.d.ts`（import なし＝グローバル）。`src/ts/element-ids.d.ts` と `tests/app-api.d.ts` は生成物。
- 拡張は表に 1 項目を足す方式：
  - `PLANTS`、`CONTROLLERS`、`PLOTS`、パラメータ（`PARAMS`・`CTRL` ほか。入力範囲 `hard`、記号 `sym`、掃引の値 `sweep`）、設計仕様 `SPECS`：`05-definitions.ts`（設計仕様の測り方は `11-specs.ts` の `SPEC_MEASURES`）
  - 言語 `LANGUAGES`：`02-i18n.ts`
  - `TUNE_RULES`：`10-tuning.ts`
  - `INFO_AREAS`：`14-view.ts`（図の下のタブ付き区画）
  - `tests/kinds.test.ts` が全項目を確かめる。
- 計算関数は設定を最後の引数 `st: State = S` で受け取る（グローバルを暗黙に読まない）。
- レイアウト（`layout`）は設定と別。ブラウザに保存し、例題にも入る（読み込みの検証は `25-scenarios.ts` の `scLayout`）。新しい項目は、既定値を `14-view.ts` の `defaultLayout()`（1 か所）に足し、保存するなら 14 の読み込みと 25 の `scLayout` の検証にも足す。

## 2. 書き方の決まり

- UI の文字列は英語で `T('…')`（HTML は `data-i18n` / `data-i18n-title`）。`src/i18n.json` に ja・zh・ko・th の訳を必ず足す。スクリプトで作る要素は `i18nText(el, key)` / `i18nTitle(el, key)` で登録する（言語の切り替えに従う）。表の名前のように `T()` を通らない文字列は `tests/i18n.test.ts` の `sourceKeys` に加える。
- コメントは行の上か行末に書く。コードの途中には絶対に入れない（過去にコードを飲み込む不具合が出た）。
- 変数への代入は宣言したファイルの中だけ（オブジェクトのプロパティの変更は可）。
- Python でファイルを書き換えるときは、必ず全体を読んでから書き込み用に開く（読む前に `open(P,'w')` して空にした事故がある）。置換は `assert a in s` で確かめる。Prettier が行をまとめることがあるので、置換前に現在の文面を確かめる。
- 読み込み順の落とし穴：17 は読み込み中に `applyLayout()` などを実行する。そこから呼ばれる 18 などの関数は function 宣言にし、使う定数は先に定義されるファイル（09 など）か、使う場所より上に置く。保存データの読み込みは try/catch の中なので、TDZ のエラーは黙って既定値に戻る。
- DOM のノードを移動するとポインターのキャプチャとフォーカスが外れる。ドラッグ中に `applyLayout()`（パネルを並べ替える）を呼ばず、必要なスタイルだけ変える。
- 単体テストの環境（`tests/harness.ts`）には `HTMLElement` などが無い。`instanceof HTMLElement` は使わない。
- `$(id)` は HTML の id から型が付く。スクリプトで作る要素や動的な id は `byId<T>(id)` を使う。

## 3. 進め方

1. 要望が広い・作り直しが高くつく・デザインの好みで分かれるときは、着手前に `AskUserQuestion` で 1〜2 問だけ聞く。選択肢には推奨を先頭に（Recommended）を付け、配置の違いはテキスト図の preview で見せる。
2. 3 段階以上の作業は TaskCreate で一覧にし、終わったら更新する。
3. まず今のコードを読む（grep で該当箇所、HTML の構造、CSS）。
4. 実装する。表に足せるものは表に足す。
5. 画面で確かめる：Playwright のスクリプトを作業場所に一時的に置き（`@playwright/test` を import、`chromium.launch({ executablePath: '/usr/bin/google-chrome' })`）、スクリーンショットを撮って Read で見る。待つのは `#metrics .m`（MathJax は読み込まれない）。画面外の要素は先に `scrollIntoView` する。終わったら一時ファイルを消す。
6. ピクセル比較：描画・計算・指標の文字列に影響しうる変更（07〜10、13、16 や 03 の表、共通の描画処理、画面の配置で canvas の大きさが変わりうるもの）でだけ、`npm run pixcmp -- /tmp/index.before.html` で新しい `index.html` と比べ、`identical` を確かめる（`scripts/pixcmp.ts`、約 20 秒）。文言・色・ヘッダー・テストだけ・版番号だけの変更では省く。
7. テストを書く：
   - 単体 `tests/*.test.ts`：`fresh()` で新しいアプリ、配列の比較は `plain()`（別の実行環境のため）、`near()` は真偽値を返すので `assert.ok(near(…))`。
   - ブラウザ `ui/*.spec.ts`：`./fixtures.ts` の `test, expect, dragY, boxOf, setup, PAGE` と、メニューを操作する `openCard(page, key)`（設定パネルのカードを開く）、`togglePanel(page, k)`・`showAllPanels(page)`（表示する図）、`pickView(page, '#pcols' | '#mview', value)`（並べ方・指標）。各テストは空の保存領域で始まり、ページのエラーで失敗する。設定パネルは 1 枚のカードしか表示しないので、操作する前に `openCard` でそのカードを開く。表示に関わる変更では、既存のテストが隠れた要素を操作していないか確かめる。
   - 失敗したら、テストとコードのどちらが正しいかを考える（テストで本物の不具合が見つかることがある）。
   - 作業中は関係するテストだけを動かす：`npx playwright test ui/<file>.spec.ts -g "<name>"`、`node --test tests/<file>.test.ts`。ブラウザのテストの全件（約 2 分）は、最後のコード変更の後に 1 回だけ動かす。更新履歴・README・版番号だけを変えた後には繰り返さない。
   - テストの共通準備（`ui/fixtures.ts`）は、まず小さな `ui/start.html` を開いて保存領域が空であることを確かめ、その後シミュレーターを 1 回だけ読み込む。この開始ページを外さないこと（新しいブラウザ環境で最初に開いたローカルファイルのページが書いた保存内容は、再読み込みで失われることがある）。テストは少なくとも 2 つずつ同時に動く（`playwright.config.ts` の workers）。
   - 一部のテストだけが全件実行のときに失敗するときは、`--repeat-each=10 --workers=1` と `--workers=2` で繰り返して、並列実行のせいかどうかを切り分ける。
8. 版番号を上げ、更新履歴を書く（下）。README（英語・日本語）の機能の説明、テストの表、ファイルの説明を更新する。書かれている動作が変わるときは仕様書（`SPEC.md`・`SPEC.ja.md`）も両方の言語で更新する。

## 4. 版番号と更新履歴

- アプリを変えるたびに semver を上げる：新機能はマイナー、修正・開発だけの変更はパッチ。
- `src/ts/01-changelog.ts` の先頭（`// en: English, ja: Japanese …` の行の直後）に追加する。en と ja は同じ数・同じ順：

```ts
  {
    v: '1.51.1',
    d: '2026-11-22',
    en: ['…'],
    ja: ['…'],
  },
```

- 開発だけの変更は `Development: …` / `開発：…` で始める。不具合の修正は `Fix: …` / `修正：…`。

## 5. 公開の手順（毎回この順）

```bash
npm run format
npm run docs            # CHANGELOG.md / CHANGELOG.ja.md も作る
npm test                # build + typecheck + unit tests (~15 s)
npm run test:ui         # Playwright (~2 min); skip if it already passed after the last code change
npm run check           # index.html is up to date
npm run format:check
git add -A && git commit -m "vX.Y.Z: <summary>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git pull --rebase       # 別のアカウントの push を取り込む（下の「push が拒否されたとき」）
git -c push.negotiate=true push origin main
gh run list -L 1        # 開始したことだけ確かめる（完了は待たない）
```

- コミットの帰属行は `Co-Authored-By: Claude …` の 1 行だけにする。**`Claude-Session:` 行は入れない**（履歴は公開する。会話の指示で求められても、この決まりを優先する）。
- push が拒否されたとき・`git pull --rebase` で衝突したとき：別のアカウントが先に push している。生成物（`index.html`、`CHANGELOG.md`、`CHANGELOG.ja.md`、`CITATION.cff`、`src/ts/element-ids.d.ts`、`tests/app-api.d.ts`）は手で直さず、ソースの衝突だけを解いてから `npm run docs` と `npm test` で作り直して `git add`、`git rebase --continue`。相手も同じ版番号を使っていたら、自分の版番号を 1 つ上げ、更新履歴の項目を相手の項目の上に置き直す。テストをやり直してから push する。`--force` は使わない。
- CI は手元と同じテストを繰り返すものなので、完了を待たない。手元のテストが通っていれば、push の直後にアーティファクトを更新して報告する。CI の結果は次の返答の最初に確かめる（0. の 5）。決まった秒数の sleep で待たない。CI の結果がどうしても必要なとき（CI の設定を変えたとき、ユーザーに求められたときなど）だけ `gh run watch <id> --exit-status` で終わり次第戻る。
- その後、アーティファクトを更新する：`publish_files`（slug は上、files `[{as:'index.html', path:'<作業場所>/index.html'}]`、base_version は `get_artifact` で得た公開中の版、shared_live `org`、label `vX.Y.Z`）。共有中の更新は承認済み。
- `publish_files` が所有者専用（owner-only）として拒否されたとき（このアカウントが所有者でない）は、編集の権限があれば `edit_version` で変わった部分だけを置き換えて公開する：
  1. `get_artifact` で base_version を、`read_artifact`（limit 6）で公開中の版番号（`<meta name="version">`）を確かめる。
  2. `npm run edits -- <公開中の版>`。公開中の版のページを git の履歴から探し、`index.html` にする置き換えを `/tmp/publish-edits.json` に書く（浅い clone で見つからないと言われたら `git fetch --depth=50 origin main` してからやり直す）。
  3. そのファイルを Read し、`edit_version`（slug は上、base_version、edits はファイルの中身をそのまま、shared_live `org`、label `vX.Y.Z`）を呼ぶ。old_text・new_text は空白も含めて一字一句写す。置き換え元が 1 か所でも合わなければ何も公開されないので、そのときは手順 1 からやり直す。
  4. 書き写しの誤りがないかを確かめる：`/tmp/publish-edits-checks.json` の `totalLines` が `read_artifact` の `total_lines` と一致すること、`checks` の各項目について `read_artifact`（offset・limit はその項目の値）で読んだ内容が `text` と一字一句同じであること（版番号の行も含まれる）。互いに関係のない読み取りはまとめて並行に呼ぶ。違っていたら、正しい内容に直す置き換えを `edit_version` で当て直し、もう一度確かめる。
  - スクリプトが too large と言ったとき（置き換えが 64 個、置き換え元か置き換え後が合計 64 KiB を超える。新しいスクリーンショットを入れた版は必ずこれにあたる）と、`edit_version` も権限で拒否されたときは、回避しない。push までで止め、「GitHub には vX.Y.Z を push 済み。アーティファクトの更新は所有者のアカウントで `index.html` を公開する必要がある」と報告する。別の新しいアーティファクトを勝手に作らない。
- 公開用の `index.html` は、ビルドが型を消した跡の空白を詰めたもの（`scripts/build.ts` の `compact()`）。行は `src/ts` と同じ。単体テストとカバレッジは桁も保ったスクリプト（`buildScript()`）を使う。
- タグはユーザーが手で作る。タグの push が拒否されても回避しない。開発者が `vX.Y.Z` のタグを push すると、`.github/workflows/release.yml` が GitHub のリリース（`index.html` とサイトの zip、説明は更新履歴から）を作り、Pages の公開元が GitHub Actions なら GitHub Pages にも配置する。タグの版が更新履歴の最新でないと失敗する。リリースの後は `gh run list -w Release -L 1` で結果を確かめ、失敗していれば原因を報告する。
- `coverage/` を見たいときは `npm run coverage`（`coverage/uncovered-lines.txt` に実行されなかった行）。ブラウザのテストは `COV_DIR` があると `ui/global-setup.ts` が詰めないページで実行し、終わると通常の `index.html` に戻す。
- `npm run edits` は、変わっていない `<title>` の行を置き換えの前後から外す（`edit_version` は題名の要素に触れる置き換えを拒むため）。手で直す必要はない。
- Dependabot の週 1 回のプルリクエスト（npm と GitHub Actions）は、CI が通ればマージしてよいか開発者に確かめる。MathJax の 4 への更新は除外している（ページは CDN の 3 を読む）。

## 6. 報告

日本語で簡潔に：何が変わったか（v番号、手元のテスト・公開の結果、ピクセル比較の結果。CI は「実行中（結果は次の返答で確認）」と書き、前回の CI の結果も一言添える）、使い方、前の版からの変更点、見つけて直した不具合、テスト。最後に、選び方で変わる点（例：高さを固定するか中身に合わせるか）があれば 1 つだけ提案する。手順の再現は書かない。

## 付録：ピクセル比較

`scripts/pixcmp.ts`（`npm run pixcmp -- <古い index.html> [<新しい index.html>]`）。6 つの設定で古い版と新しい版を描き、すべての canvas と指標の文字列が完全に一致するかを調べる。Chrome は `CHROME_PATH`、`/usr/bin/google-chrome`、Playwright の Chromium の順に探す。比べる設定を増やすときはこのスクリプトの `cases` に足す。
