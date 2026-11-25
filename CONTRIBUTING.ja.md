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
npm run pixcmp -- old.html   # 古いビルドと index.html の図をピクセル単位で比べる
```

`npm test`、`npm run test:ui`、`npm run check`、`npm run format:check` がすべて通る必要があります。プルリクエストごとに GitHub Actions でも実行されます。テストとソースファイルの一覧は README.ja.md にあります。

## 決まり

- **生成されるファイルではなくソースを直す。** `index.html`、`CHANGELOG*.md`、`CITATION.cff`、`src/ts/element-ids.d.ts`、`tests/app-api.d.ts` はビルドが書きます。マージの衝突を解いたあとも、`npm run docs`、`npm test` で作り直してください。
- **版番号と更新履歴。** アプリを変えたら、`src/ts/01-changelog.ts` の `CHANGELOG` の先頭に新しい版を加えます（セマンティック バージョニング：2 番目の数は新機能、3 番目は修正と文言）。項目は英語（`en`）と日本語（`ja`）で同じ内容にします。
- **言語。** 画面の文字列、コメント、テスト名は英語で書き、画面の文字列は `src/i18n.json` で訳します（日本語・中国語・韓国語・タイ語）。利用者マニュアル（`src/ts/22-help.ts`）は英語と日本語で書きます。README、SPEC、CONTRIBUTING は英語版と日本語版の両方を更新します。
- **仕様書。** `SPEC.md`／`SPEC.ja.md` に書いてある内容を変えたときは、両方を更新します。
- **マニュアルの数値**は `tests/tutorial.test.ts` が確かめます。計算を変えて数値が変わったら、テストと一緒にマニュアルも直します。マニュアルのスクリーンショットは `npm run shots` で撮り直します。
- **描画。** 図や指標が変わりうる変更では、前のビルドと `npm run pixcmp` で比べ、違いがあれば理由を説明してください。
- **ライセンスの表示。** 新しいソースファイルの先頭には、`SPDX-License-Identifier: Apache-2.0` と `Copyright 2026 Masanobu Koga` の 2 行をコメントで入れます（`tests/license-headers.test.ts`）。

## 貢献のライセンス

SigmaOmega は Apache License 2.0（[LICENSE](LICENSE)）で公開しています。特に断りがなければ、送っていただいた貢献も同じ条件で提供されたものとします（ライセンスの第 5 条）。

## 開発者（メンテナー）向けのファイル

`CLAUDE.md` と `.claude/` は、開発者が使う AI のコーディング支援ツール向けの手順です（`.claude/README.md`）。貢献する方は読む必要はありません。
