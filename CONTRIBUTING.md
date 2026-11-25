# Contributing to SigmaOmega

English | [日本語](CONTRIBUTING.ja.md)

Thank you for your interest. Bug reports, corrections of the manual or the translations, and improvements are welcome as GitHub issues and pull requests.

## Setting up

- Node.js 22.18 or later (the build uses Node's built-in type stripping), then `npm ci`.
- Browser tests use Chromium: `npx playwright install chromium`, or set `CHROME_PATH` to an installed Chrome.

## Building and testing

```
npm run build      # build index.html from src/
npm test           # build, type-check, unit tests
npm run test:ui    # browser tests (Playwright)
npm run format     # format the TypeScript files (CI checks npm run format:check)
npm run docs       # build and regenerate CHANGELOG.md / CHANGELOG.ja.md
npm run pixcmp -- old.html   # compare the plots of an older build with index.html pixel by pixel
```

All of `npm test`, `npm run test:ui`, `npm run check` and `npm run format:check` must pass; GitHub Actions runs them on every pull request. README.md lists every test file and every source file.

## Rules

- **Edit the sources, not the generated files.** `index.html`, `CHANGELOG*.md`, `CITATION.cff`, `src/ts/element-ids.d.ts` and `tests/app-api.d.ts` are written by the build; regenerate them (`npm run docs`, `npm test`), also after resolving a merge conflict.
- **Version and change log.** Every change of the app gets a new version at the top of `CHANGELOG` in `src/ts/01-changelog.ts` (Semantic Versioning: 2nd number for new features, 3rd for fixes and wording), with the same items in English (`en`) and Japanese (`ja`).
- **Languages.** UI strings, code comments and test names are in English; UI strings are translated through `src/i18n.json` (Japanese, Chinese, Korean, Thai). The user manual (`src/ts/22-help.ts`) is written in English and Japanese. README, SPEC and CONTRIBUTING exist in English and Japanese: update both.
- **Specification.** When a change alters what `SPEC.md` / `SPEC.ja.md` describe, update both.
- **Numbers in the manual** are checked by `tests/tutorial.test.ts`; if a change of the computation alters them, correct the manual together with the test. Screenshots of the manual are retaken with `npm run shots`.
- **Rendering.** For a change that may alter plots or metrics, run `npm run pixcmp` against the previous build and explain any difference.
- **License headers.** Every new source file starts with `SPDX-License-Identifier: Apache-2.0` and `Copyright 2026 Masanobu Koga` as two comment lines (`tests/license-headers.test.ts`).

## License of contributions

SigmaOmega is licensed under the Apache License 2.0 ([LICENSE](LICENSE)). Unless you state otherwise, a contribution you submit is licensed under the same terms (section 5 of the license).

## For the maintainer

`CLAUDE.md` and `.claude/` hold the procedure for the maintainer's AI coding assistant (see `.claude/README.md`); contributors can ignore them.
