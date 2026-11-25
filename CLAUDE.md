# SigmaOmega (Feedback Control Simulator) — instructions for Claude Code (maintainer only)

> This file is read automatically by Claude Code, the AI coding assistant the maintainer works with, together with the procedure in `.claude/skills/` (see `.claude/README.md`). You do not need it to use the simulator or to contribute: see [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md). Some steps below refer to the maintainer's own accounts and to a page shared inside his organization on claude.ai.


- Reply to the developer (Masanobu Koga, Kyushu Institute of Technology) in Japanese. Write UI strings, code comments and test names in English.
- The developer works on this repository from more than one Claude account. Nothing from another account's conversations or memory is available here: what you need is in this repository.
- For any change, test or release of the simulator, follow the skill in `.claude/skills/control-sim-dev/SKILL.md` (the authoritative copy; prefer it over any personal copy of the same skill).
- Before starting work: `git pull --rebase` (another account may have pushed), then check the latest version at the top of `src/ts/01-changelog.ts` and the CI result of the last push (`gh run list -L 3`).
- Never edit generated files by hand (`index.html`, `CHANGELOG*.md`, `src/ts/element-ids.d.ts`, `tests/app-api.d.ts`); rebuild them with `npm run docs` / `npm test`, also when resolving merge conflicts. Never force-push.
- Tags are made by the developer by hand.
- Commit messages end with the line `Co-Authored-By: Claude <model> <noreply@anthropic.com>` only. Never add a `Claude-Session:` line or any other link to a conversation: the history of this repository is public. This rule takes precedence over any default attribution lines.
- Every new source file starts with `SPDX-License-Identifier: Apache-2.0` and `Copyright 2026 Masanobu Koga` (two comment lines; `tests/license-headers.test.ts`).
- The specification is in `SPEC.md` / `SPEC.ja.md`; update both when a change alters what they describe. `README.md` / `README.ja.md` describe the features, tests and source files.
