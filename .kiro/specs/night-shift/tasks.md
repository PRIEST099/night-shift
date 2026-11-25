# Implementation Plan: night-shift

## Overview

Builds the Night Shift Crew app: the Core CLI, the four agents and three skills, the demo copy with the planted rejection case, the dashboard page, the README and `.kiro` files, and the cron. Tasks are in demo-critical order. Property tests are mandatory (fast-check, at least 100 runs). A task is ticked only when its tests pass. Run from `D:\kiroween 2026\night-shift`. The integration tests need `UNSEEN_MCP_SERVER_JS` (or the sibling default `../the-unseen/packages/mcp/dist/server.js`) and, on this Windows host, `$env:UNSEEN_CHROMIUM_CHANNEL='chromium'`. Nothing in `the-unseen` is modified. No git push, no pull request.

## Tasks

- [x] 1. Core CLI: scaffold, `validate`, `audit`, `diff`, `report`
  - _Requirements: 2, 3, 4, 6, 7, 14.4, 15.1, 15.2_

  - [x] 1.1 Scaffold the package and tooling
    - **Acceptance Criteria:** `package.json` (`night-shift` 0.1.0, `type: module`, `bin.night-shift = dist/cli.js`, scripts `build`, `typecheck`, `test`, `test:integration`, `build:ui`, `demo:reject`), strict `tsconfig.json`, `vitest.config.ts` (integration timeout 180000), `.gitignore` (`node_modules`, `dist` at root, `.night-shift/`, `REPORT.md`, `report.json`, `demo/work/`, `demo/cursed-shop-fixed/`), `LICENSE` (MIT), and a starter `patrol.yaml` for the demo. `ui/dist/` is not ignored.
    - **Checkpoint:** `npm install`, `npm run typecheck` and `npm test` run (no tests yet is allowed).

  - [x] 1.2 Patrol schema and `validate`
    - **Acceptance Criteria:** `pure/schema.ts` (Zod, strict) and `commands/validate.ts` per Requirement 2; messages carry YAML paths.
    - **Tests:** P3 (round trip and each violation in 2.4); examples: malformed YAML reports and does not throw; `--file` honoured; exit codes 0 and 1.

  - [x] 1.3 Fingerprints, slug and diff
    - **Acceptance Criteria:** `pure/fingerprint.ts`, `pure/slug.ts`, `pure/diff.ts` (including `workList` selection and cap) per Requirements 3.4 and 4.
    - **Tests:** P1, P2, P4, P5, P6; example: `workList` is capped, Wraith first, Banished excluded.

  - [x] 1.4 Static server, MCP client, history and `audit`
    - **Acceptance Criteria:** `io/static-server.ts` (127.0.0.1, port 0, path traversal refused, closed in `finally`), `io/mcp-client.ts` (stdio client, `page: 'full'`, Zod-parsed result, clear error for a missing server file), `io/history.ts` (atomic write, corrupt file ignored with warning), `commands/audit.ts`, `commands/diff.ts`.
    - **Tests:** static server refuses `/../patrol.yaml`; history write is atomic and a corrupt file is skipped; `audit` with a fake `AuditPage` writes the documented shape and records a page error without stopping; missing server path exits 1 naming `UNSEEN_MCP_SERVER_JS`.

  - [x] 1.5 `report`, `patrol --no-agents`, CLI entry
    - **Acceptance Criteria:** `pure/report.ts`, `pure/render-report.ts`, `commands/report.ts` (including `--publish-ui`), `commands/patrol.ts`, `cli.ts` with exit codes per Requirement 7 (`--open-prs` and plain `patrol` exit 2).
    - **Tests:** P10 (report part); example snapshot of `REPORT.md` for a fixed report object; CLI exit-code tests.
    - **Checkpoint:** `npm run build` yields an executable `dist/cli.js`; `node dist/cli.js validate` prints `patrol.yaml: ok`.

- [x] 2. `verify`, `workdir` and the keep/reject decision
  - _Requirements: 5, 15.1, 15.2_
  - **Acceptance Criteria:** `pure/decide.ts`, `pure/safety.ts`, `commands/verify.ts`, `commands/workdir.ts`, `io/copy-dir.ts`; fix records written atomically; `--apply` copies only changed files into `fixedDir`; exit codes 0, 3 and 1; the report reads fix records (extend task 1.5 tests with kept and rejected records).
  - **Tests:** P7, P8, P9; with a fake `AuditPage` and temp directories: keep applies files and reject writes nothing outside `.night-shift/` and the fix dir; `workdir` refuses an existing path and honours `--attempt`; attempt counter increments.
  - **Checkpoint:** `npm test` green; reverting the count rule to a fingerprint-only comparison makes P8 fail.

- [x] 3. `app.json`, four agents, three skills
  - _Requirements: 1, 8, 9, 10, 15.3, 15.4_
  - **Acceptance Criteria:** `app.json` per Requirement 1 with `agents`, `skills`, `mcpServers.unseen` (Requirement 9.1) and `ui` placeholder filled in task 5; no `platform`, no `crons` yet. Agent files and skills per Requirements 8 and 10, with prompts that give the handoff sequence, the `specialist` reason, the 2-attempt limit and the forbidden fixes. Tool names are checked against `kirocrew agent validate ./agents` if `kirocrew` is installed; the exact tool strings for read, write and shell that the validator accepts are recorded in Notes.
  - **Tests (`tests/app-manifest.test.ts`, `tests/agents.test.ts`, `tests/skills.test.ts`):** Requirement 15.3 and 15.4 checks; skill front matter `name` equals the folder; the declared MCP env variable matches the one `io/mcp-client.ts` reads, and the default path matches.
  - **Checkpoint:** `kirocrew agent validate ./agents` passes, or Notes records that `kirocrew` is not installed on this host and the structural test is the only check.

- [x] 4. Demo copy and the planted "bad fix" case
  - _Requirements: 12, 15.5, 15.6_
  - **Acceptance Criteria:** `demo/cursed-shop-copy/` copied from `../the-unseen/apps/cursed-shop` with a read-only copy script that is deleted afterwards; the planted case added and described in `demo/README.md`; `demo/bad-fix/` and a correct-fix fixture under `tests/fixtures/`; `npm run demo:reject` prints a real rejection; `git -C ../the-unseen status` is unchanged by this task.
  - **Tests:** `tests/patrol.int.test.ts` runs `night-shift patrol --no-agents` against the served copy with the real server and asserts a report with at least one Wraith and a `report.json` that validates; `tests/verify.int.test.ts` asserts the bad fix exits 3 with a `new-haunting` reason naming `Veiled`, and the correct fix exits 0.
  - **Checkpoint:** a sample report from a full demo run (patrol, one rejection, one kept fix, `report`) is saved under `docs/sample-report/`.

- [x] 5. Dashboard page "Morning report"
  - _Requirements: 11, 15.2_
  - **Acceptance Criteria:** `ui/src/render.tsx`, `ui/src/load-report.ts`, `ui/src/index.tsx`, `ui/src/last-report.json` (copy of the sample report), `vite.config.ts` with the externals of Requirement 11.2, committed `ui/dist/index.mjs`; `app.json` `ui` filled in. The actual SDK export names found at implementation time are recorded in Notes.
  - **Tests:** P10 (view part, using `renderToStaticMarkup`): one `h1`, a `caption` per table, `th scope`, escaped reasons, empty state; the built `ui/dist/index.mjs` has no bundled `react` and imports `@kirocrew/app-sdk`.
  - **Checkpoint:** `audit_html` on the rendered static page with a `lang` wrapper returns no Wraith.

- [x] 6. README and `.kiro/` (steering, hook)
  - _Requirements: 9.3, 14_
  - **Acceptance Criteria:** `README.md` per Requirement 14.3, including the Mermaid diagram from `design.md`, the `UNSEEN_MCP_SERVER_JS` and `unseen-mcp` instructions, `kirocrew app install` and `app enable`, the demo commands and a pasted sample of `REPORT.md` from `docs/sample-report/`; `.kiro/steering/{crew,product,tech}.md`; `.kiro/hooks/test-gate.json` and its script.
  - **Tests:** `tests/readme.test.ts` checks the sections, the Mermaid block, that every `npm run` script mentioned exists, and that the README states `--open-prs` is future work; `tests/test-gate.test.ts` runs the gate script with a stubbed test runner: pass, fail (exit 1, message under 3,000 characters) and nothing-changed (exit 0, runner not called).
  - **Checkpoint:** `npm test` green. If the write tool refuses `.kiro/hooks/`, stage the files and copy them with `node -e fs.copyFileSync`, and record it in Notes.

- [x] 7. Nightly cron
  - _Requirements: 13, 15.3_
  - **Acceptance Criteria:** `app.json` `crons` has the single `nightly-patrol` entry of Requirement 13.1, `enabled: false`; README "Nightly schedule" section explains `kirocrew` enabling and states the default is off.
  - **Tests:** the manifest test asserts the exact entry, no `command`, no `every`, `enabled === false`, and that `agent` names an existing agent file.

- [x] 8. Final verification and handoff
  - _Requirements: 1, 12, 14, 15_
  - **Acceptance Criteria:** `npm run typecheck`, `npm test` and `npm run test:integration` pass; `npm run build:ui` leaves `ui/dist/` unchanged (or the change is committed); `git status` shows no temp or throwaway scripts; `git -C ../the-unseen status` shows no change from this work; Notes list manual items for the product lead.
  - **Checkpoint (manual, product lead):** `kirocrew app install .`, `kirocrew app enable night-shift`, run the Warden once on the demo, record the crew handoffs, the Exorcist rejection and the morning report.

## Notes

- Decisions of 2026-11-25 win over the brief. Differences from `17-night-shift-crew.md`: fixes are applied to `demo/cursed-shop-fixed/` and not to git branches; no branch naming, no `gh`; `--open-prs` is future work only.
- Additions beyond the five core subcommands: `workdir` and `patrol`. Both are thin and listed in Requirements 5.7 and 7.
- The dashboard has no backend, by design (see `design.md`).
- The Crew docs were checked by the product lead on 2026-11-25. If `kirocrew` is installed at implementation time, run `kirocrew agent validate ./agents` and record the result; do not weaken any structural test to make it pass.
- `demo/bad-fix/` is a recorded attempt, not an agent run, and the README must say so.
- Task 3 (2026-11-25, implementation): `kirocrew agent validate ./agents` not run, kirocrew not installed (`kirocrew` is not on PATH). The structural tests in `tests/app-manifest.test.ts`, `tests/agents.test.ts` and `tests/skills.test.ts` are the only check. Tool strings used in the agent files, taken from the V3 agents in `../the-unseen/.kiro/agents` that Kiro CLI loaded: `read`, `write`, `shell`, `@unseen` (an MCP server), `@kirocrew-core` (from the spec). They are unverified against the Crew validator. The `${UNSEEN_MCP_SERVER_JS:-../the-unseen/packages/mcp/dist/server.js}` default syntax in `app.json` `mcpServers.unseen.args` is also unverified against Crew.
- Task 5 (2026-11-25, implementation): `@kirocrew/app-sdk` is not on the npm registry (404) and the Crew docs could not be fetched from this host, so the real SDK export names could not be checked. `ui/src/index.tsx` uses an assumed `defineApp({ pages: [{ route, component }] })` and `ui/src/sdk.d.ts` declares only that. Only `index.tsx` and `sdk.d.ts` need to change when the real names are known. The page itself (`render.tsx`) uses plain semantic HTML and `lucide-react` icons and no SDK components. The `icon` value `"Moon"` in `app.json` `ui.pages` is also a guess. The checkpoint `audit_html` run (tests/ui.int.test.ts) found 0 hauntings, score 0.
- Task 8 (2026-11-25, implementation): `npm run typecheck`, `npm test` (116 tests, 12 files) and `npm run test:integration` (3 tests, real THE UNSEEN server, `UNSEEN_CHROMIUM_CHANNEL=chromium`) pass. `npm run build:ui` leaves `ui/dist/index.mjs` unchanged. `git -C ../the-unseen status` is clean (nothing there was modified). Nothing is committed in this repo: the working tree is left for the product lead to review and commit. The sample report in `docs/sample-report/` and the README paste come from a real run: patrol, one rejected recorded attempt (`demo/bad-fix`, new-haunting naming TheVeiled), one kept recorded attempt (`tests/fixtures/correct-fix`), then `report`. Both are labelled as recorded attempts, not agent runs.
- Manual items for the product lead: (1) install Kiro Crew, run `kirocrew agent validate ./agents`, and record the result; check the tool strings (`read`, `write`, `shell`, `@unseen`, `@kirocrew-core`) and the `${VAR:-default}` syntax in `app.json`. (2) Check the real `@kirocrew/app-sdk` export names and fix `ui/src/index.tsx` and `ui/src/sdk.d.ts`; check the `icon` value. (3) `kirocrew app install .` and `kirocrew app enable night-shift`; run the Warden once on the demo; record the handoffs, the Exorcist rejection and the morning report; replace the recording placeholder in the README. (4) Check how Crew enables a single cron; the nightly cron ships disabled. (5) The Haunting Score barely moves when one of many Nameless Spirits is fixed, so the demo score change is 0.0.
- Found by the product lead's real Crew install (Crew 0.13.1): `app.json` needed `permissions.cron: true` because `crons` is declared, and the `unseen` MCP server entry could not use `${VAR:-default}` or a relative `.js` path (Crew expands neither and copies the app). It is now `unseen-mcp` from PATH with a literal `UNSEEN_CHROMIUM_CHANNEL`. Manifest tests cover both rules. The CLI's own env-or-sibling lookup is unchanged.
- Found by the product lead's real Crew run (`kiro-logs/crew-patrol-1.log`, Crew 0.13.1, Windows): every Warden tool call was denied with "needs approval, and this invocation cannot ask" because the agent files carried no pre-approvals. Evidence and file/line references are in `docs/crew-integration-notes.md`.
- Found by the product lead's real Crew run: Crew copies `toolsSettings` and `allowedTools` from an app agent into `~/.kiro/agents/night-shift--<role>.json`. Each agent now pre-approves only its own `night-shift` subcommands (`shell.denyByDefault` plus `allowedCommands`), reads under `patrol.yaml`, `.night-shift/` and `demo/work/`, and its MCP tools by exact name. The Scribe alone may write, under `demo/work/**` (`write.fallbackAction: "deny"`). The Warden auto-approves `@kirocrew-core/spawn_run`, `spawn_status` and `wait`. `tests/grants.test.ts` pins these grants and rejects any wildcard shell. `kirocrew agent validate ./agents` reports 0 problems. After reinstalling, the generated files contain these grants (checked).
- Found by the product lead's real Crew run: `@unseen` never mounted. Crew mounts the app server as `night-shift:unseen`, so the tool refs are now `@night-shift:unseen`.
- Found by the product lead's real Crew run: sessions run in Crew work directories, not in the repo, and Crew never pre-approves a `cd '<dir>'; ...` chain with quotes or backslashes (it refused the first attempt). The CLI now takes `--home <dir>`, falling back to `NIGHT_SHIFT_HOME` and then the cwd (`src/pure/home.ts`, `tests/home.test.ts`). The agents pass `--home '<repo>'`, and the cron message names the repo. `cron.agent: "warden"` and the spawn names `seer`, `scribe` and `exorcist` resolve by declared name, so nothing was renamed.
- Found by the product lead's real Crew run, still open: the required `kirocrew chat --agent night-shift--warden -m ...` patrol fails at `night-shift validate`. That surface never honours a spec's shell or file pre-approvals (`cli_chat.py` 1070-1074, 1146-1156), and every spawn waits for a person's approval (`subagent_manager/admission/gate.py` 1737-1816). No Seer, Scribe or Exorcist ran and no REPORT.md was written. The transcript is in `docs/patrol-transcripts/2026-11-25-patrol.md`. A gateway probe (`kirocrew spawn run --agent seer`, approved once in the dashboard) showed the Seer's grant working: `night-shift diff` ran unprompted and `git status` was refused. But gateway sessions do not have `%APPDATA%\npm` on PATH, so `night-shift` and `unseen-mcp` were not found. Options for the owner are listed in the notes file. None of them was taken.
- Found by the product lead's real Crew run: `kirocrew app update` is not available on native Windows, and `kirocrew app uninstall` withdraws the app's trust grant. To reinstall, the `night-shift` trust grant the product lead made earlier was restored through the dashboard endpoint, and the app was enabled again. No other Crew setting was changed.
