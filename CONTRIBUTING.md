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
npm run pixcmp -- old.html   # compare the plots, panels and block diagram of an older build with index.html
npm run accuracy   # compare the results with exact solutions (the tables of ACCURACY.md)
npm run performance  # measure the times in Chrome (the tables of PERFORMANCE.md)
```

All of `npm test`, `npm run test:ui`, `npm run check` and `npm run format:check` must pass; GitHub Actions runs them on every pull request. README.md lists every test file and every source file.

## Rules

- **Edit the sources, not the generated files.** `index.html`, `CHANGELOG*.md`, `CITATION.cff`, `src/ts/element-ids.d.ts` and `tests/app-api.d.ts` are written by the build; regenerate them (`npm run docs`, `npm test`), also after resolving a merge conflict.
- **Version and change log.** Every change of the app gets a new version at the top of `CHANGELOG` in `src/ts/01-changelog.ts` (Semantic Versioning: 2nd number for new features, 3rd for fixes and wording), with the same items in English (`en`) and Japanese (`ja`).
- **Languages.** UI strings, code comments and test names are in English; UI strings are translated through `src/i18n.json` (Japanese, Chinese, Korean, Thai, French, German, Spanish, Portuguese, Russian). The user manual is written in every language of the page (`src/help/<lang>.html`, with the same chapters, figures and tables as `en.html`; `tests/help.test.ts`); a change of the manual is made in every language, and its screenshots are retaken with `npm run shots`. README, SPEC and CONTRIBUTING exist in English and Japanese: update both.
- **Specification.** When a change alters what `SPEC.md` / `SPEC.ja.md` describe, update both.
- **Numbers in the manual** are checked by `tests/tutorial.test.ts`; if a change of the computation alters them, correct the manual together with the test. Screenshots of the manual are retaken with `npm run shots`.
- **Rendering.** For a change that may alter plots or metrics, run `npm run pixcmp` against the previous build and explain any difference.
- **Files and function length.** A file of `src/ts` holds one topic, named in its title, and its number says its layer (see "Structure of the script" in README); a new file takes a free number in its layer, and a file imports only from lower numbers. A file is at most 600 lines and a function at most 80 (`tests/modules.test.ts`); split a longer one into named parts.
- **Numerical accuracy.** A change of the computation must keep `tests/accuracy.test.ts` passing. Run `npm run accuracy` and update the tables in `ACCURACY.md` and `ACCURACY.ja.md` when the results change.
- **Time efficiency.** A change of the computation or the drawing must keep `tests/performance.test.ts` passing. When the times change noticeably, run `npm run performance` and update the tables in `PERFORMANCE.md` and `PERFORMANCE.ja.md`.
- **License headers.** Every new source file starts with `SPDX-License-Identifier: Apache-2.0` and `Copyright 2026 Masanobu Koga` as two comment lines (`tests/license-headers.test.ts`).

## Maintenance

- **Dependencies.** Dependabot (`.github/dependabot.yml`) opens a pull request once a week when the development tools (npm) or the GitHub Actions have new versions; minor and patch updates come grouped. Merge it when the tests pass. MathJax stays on version 3 (the page loads it from the CDN), so a move to MathJax 4 is made by hand in `src/index.html` and `package.json` together.
- **Coverage.** `npm run coverage` measures which code the unit and browser tests run (`coverage/uncovered.txt` lists the functions never run). Keep new code covered by a test.
- **Releases** are made by the maintainer by pushing a version tag (see "Versions and change log" in README.md).

## License of contributions

SigmaOmega is licensed under the Apache License 2.0 ([LICENSE](LICENSE)). Unless you state otherwise, a contribution you submit is licensed under the same terms (section 5 of the license).

## For the maintainer

`CLAUDE.md` and `.claude/` hold the procedure for the maintainer's AI coding assistant (see `.claude/README.md`); contributors can ignore them.
