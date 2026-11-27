# SigmaOmega への貢献

[English](CONTRIBUTING.md) | 日本語

関心を持っていただきありがとうございます。不具合の報告、マニュアルや翻訳の修正、改良の提案を、GitHub の Issue とプルリクエストで歓迎します。

## 準備

- Node.js 22.18 以降（ビルドに Node.js 組み込みの型の除去機能を使います）。その後 `npm ci`。
- ブラウザのテストは Chromium を使います：`npx playwright install chromium`。インストール済みの Chrome を使うときは `CHROME_PATH` を設定します。

## ビルドとテスト

```
npm run build      # src/ から index.html を作る
npm test           # ビルド、型チェック、単体テスト
npm run test:ui    # ブラウザのテスト（Playwright）
npm run format     # TypeScript のファイルを整形（CI は npm run format:check で確かめる）
npm run docs       # ビルドし、CHANGELOG.md・CHANGELOG.ja.md を作り直す
npm run pixcmp -- old.html   # 古いビルドと index.html の図・パネル・ブロック線図を比べる
npm run accuracy   # 結果を厳密解と比べる（ACCURACY.md の表）
npm run performance  # Chrome で時間を計測する（PERFORMANCE.md の表）
```

`npm test`、`npm run test:ui`、`npm run check`、`npm run format:check` がすべて通る必要があります。プルリクエストごとに GitHub Actions でも実行されます。テストとソースファイルの一覧は README.ja.md にあります。

## 決まり

- **生成されるファイルではなくソースを直す。** `index.html`、`CHANGELOG*.md`、`CITATION.cff`、`src/ts/element-ids.d.ts`、`tests/app-api.d.ts` はビルドが書きます。マージの衝突を解いたあとも、`npm run docs`、`npm test` で作り直してください。
- **版番号と更新履歴。** アプリを変えたら、`src/ts/01-changelog.ts` の `CHANGELOG` の先頭に新しい版を加えます（セマンティック バージョニング：2 番目の数は新機能、3 番目は修正と文言）。項目は英語（`en`）と日本語（`ja`）で同じ内容にします。
- **言語。** 画面の文字列、コメント、テスト名は英語で書き、画面の文字列は `src/i18n.json` で訳します（日本語・中国語・韓国語・タイ語）。利用者マニュアル（`src/ts/84-help.ts`）は英語と日本語で書きます。README、SPEC、CONTRIBUTING は英語版と日本語版の両方を更新します。
- **仕様書。** `SPEC.md`／`SPEC.ja.md` に書いてある内容を変えたときは、両方を更新します。
- **マニュアルの数値**は `tests/tutorial.test.ts` が確かめます。計算を変えて数値が変わったら、テストと一緒にマニュアルも直します。マニュアルのスクリーンショットは `npm run shots` で撮り直します。
- **描画。** 図や指標が変わりうる変更では、前のビルドと `npm run pixcmp` で比べ、違いがあれば理由を説明してください。
- **ファイルと関数の長さ。** `src/ts` の各ファイルは 1 つの話題を持ち、それをタイトルに書きます。ファイルの番号はその層を表します（README の「スクリプトの構成」）。新しいファイルにはその層の空いた番号を付け、番号の小さいファイルからだけ import します。ファイルは 600 行以内、関数は 80 行以内にします（`tests/modules.test.ts`）。長くなったら名前付きの部分に分けてください。
- **数値精度。** 計算を変えたときも `tests/accuracy.test.ts` が通る必要があります。結果が変わったら `npm run accuracy` を実行し、`ACCURACY.md`・`ACCURACY.ja.md` の表を更新します。
- **時間効率。** 計算や描画を変えたときも `tests/performance.test.ts` が通る必要があります。時間が目立って変わったら `npm run performance` を実行し、`PERFORMANCE.md` と `PERFORMANCE.ja.md` の表を更新してください。
- **ライセンスの表示。** 新しいソースファイルの先頭には、`SPDX-License-Identifier: Apache-2.0` と `Copyright 2026 Masanobu Koga` の 2 行をコメントで入れます（`tests/license-headers.test.ts`）。

## 保守

- **依存関係。** Dependabot（`.github/dependabot.yml`）が、開発用のツール（npm）や GitHub Actions に新しい版が出ると、週に 1 回プルリクエストを作ります。マイナーとパッチの更新はまとめて 1 つになります。テストが通ればマージしてください。MathJax は 3 のままにします（ページは CDN から読み込みます）。MathJax 4 へ移すときは、`src/index.html` と `package.json` を一緒に手で変えます。
- **カバレッジ。** `npm run coverage` で、単体テストとブラウザのテストが実行したコードを測ります（一度も実行されなかった関数は `coverage/uncovered.txt`）。新しいコードもテストで実行されるようにしてください。
- **リリース**は、開発者が版のタグを push して行います（README.ja.md の「版の管理と更新履歴」）。

## 貢献のライセンス

SigmaOmega は Apache License 2.0（[LICENSE](LICENSE)）で公開しています。特に断りがなければ、送っていただいた貢献も同じ条件で提供されたものとします（ライセンスの第 5 条）。

## 開発者（メンテナー）向けのファイル

`CLAUDE.md` と `.claude/` は、開発者が使う AI のコーディング支援ツール向けの手順です（`.claude/README.md`）。貢献する方は読む必要はありません。
