# Requirements: night-shift

## Introduction

Night Shift is a Kiro Crew app. A crew of four Kiro agents patrols a list of websites overnight with THE UNSEEN (an accessibility auditor exposed as an MCP server). It comes back in the morning with accessibility fixes in source and a report. This spec is the entry for the Best Kiro Crew App bonus prize.

Sources of truth: `../the-unseen/docs/brief/prompts/17-night-shift-crew.md` (product idea) and the product lead's decisions of 2026-11-25, which win over the brief. The Kiro Crew facts below were checked by the product lead against the official docs on 2026-11-25 and are not re-derived here.

## Glossary

- **Crew**: Kiro Crew (`kirocrew`, version 0.13.0 or later), a local open-source agent gateway that drives kiro-cli.
- **App**: a Crew package with an `app.json` manifest at the repo root.
- **THE UNSEEN**: the accessibility auditor. Its MCP server is `packages/mcp/dist/server.js` in the sibling repo `the-unseen`, also installable as the global bin `unseen-mcp`.
- **Haunting**: one accessibility finding. Types include `NamelessSpirit`, `Veiled` (The Veiled) and others. Severity is `Wraith`, `Restless` or `Banished`, in that order of seriousness.
- **Fingerprint**: `type|kind|htmlSnippet` plus `#<n>`, where `n` is the occurrence index of identical keys on the page. Node ids are never part of it, because they change between audits.
- **Patrol**: one run over every site in `patrol.yaml`. Its **patrol id** is the UTC start time as `YYYYMMDDTHHmmssZ`.
- **Core CLI**: the deterministic Node/TypeScript CLI `night-shift`. Agents call it; it never calls agents.
- **Fix attempt**: a work directory holding a modified copy of a site's source, produced by the Scribe for one haunting.
- **Base directory**: the source state a fix attempt started from: the site's fixed directory if it exists, else its source directory.

## Requirements

### Requirement 1: Repo as a Crew app

1. `app.json` sits at the repo root with required fields `name` (`night-shift`, kebab-case), `version` (semver, `0.1.0`), `displayName`, `description`; recommended fields `author`, `license` (`MIT`), `minKiroCrewVersion` (`0.13.0`), `tags`.
2. `app.json` lists `agents` (four paths), `skills` (three folders, each with a `SKILL.md`), `mcpServers` (Requirement 9), `crons` (Requirement 13), `ui` (Requirement 11) and `permissions` (only a `permissions.api` list, and only if the UI uses an API route).
3. `app.json` has no `platform` field, no exec backend and no command cron. There is no `crew.yaml`.
4. Unknown fields in `app.json` are tolerated by the test that validates it.
5. The app installs with `kirocrew app install <path or git URL>` and enables with `kirocrew app enable night-shift`.

### Requirement 2: `patrol.yaml` schema and `night-shift validate`

1. `patrol.yaml` has `version: 1` and `sites[]`. Each site has `name` (kebab-case, unique), `owner` (string), `pages` (non-empty list of paths or absolute http(s) URLs), and either `serve.dir` (a local directory served on a free port) or `baseUrl` (http or https). It may also have `source` (directory with the editable source, required if the site has `serve`), `fixedDir` (where kept fixes are applied) and `repo` (string, informational; no tool reads it).
2. Optional top-level `maxFixesPerSite` (integer 0 to 20, default 5).
3. `night-shift validate [--file patrol.yaml]` prints one line per problem with its YAML path and exits 1 if any exist; otherwise prints `patrol.yaml: ok (N sites, M pages)` and exits 0.
4. Rejected input: unknown top-level or site keys, duplicate site names, empty `pages`, a `pages` URL whose scheme is not http or https, a path with `..`, a `source`, `serve.dir` or `fixedDir` that is absolute or escapes the repo, and `serve` together with `baseUrl`.
5. Validation never reads the network and never throws on malformed YAML; it reports it.

### Requirement 3: Audit and history

1. `night-shift audit [--site <name>] [--patrol-id <id>]` serves each `serve.dir` on a free local port, calls THE UNSEEN for every page, and writes `.night-shift/history/<site>/<patrol-id>.json`.
2. The audit engine is the THE UNSEEN MCP server, reached by a stdio MCP client at `UNSEEN_MCP_SERVER_JS` (default `../the-unseen/packages/mcp/dist/server.js`), calling `audit_url` with `page: 'full'` so every haunting is returned, not only the top 10. If the server file is missing, the command exits 1 naming the variable and the default path.
3. A history file holds `schemaVersion`, `site`, `patrolId`, `startedAt`, and per page: `url`, `score`, and `hauntings[]` with `fingerprint`, `id`, `type`, `kind`, `severity`, `selector`, `htmlSnippet`, `wcag`. A page that fails to audit is recorded with `error` and no hauntings, and does not stop the patrol.
4. A haunting `id` is `<page-slug>-<type>-<first 8 hex of sha256(fingerprint)>`: deterministic and safe as a directory name.
5. Writing a history file is atomic (temp file then rename). A history file that fails to parse is ignored when looking for the previous patrol and the command prints a warning.
6. `.night-shift/` is in `.gitignore`.

### Requirement 4: Diff

1. `night-shift diff --site <name> [--patrol-id <id>]` compares the patrol's history file with the latest earlier history file of the same site and prints the **new** and **worsened** hauntings as JSON (`--json`) or text.
2. A haunting is **new** if its fingerprint is not present in the previous patrol's same page. With no previous patrol, every haunting is new.
3. A haunting is **worsened** if its fingerprint is present in both and its severity rank is higher now.
4. Hauntings that are unchanged, or whose severity fell, are not reported. Fixed hauntings are listed separately as `resolved`.
5. Diff output is a pure function of two history objects: same inputs, same output, input order of hauntings does not matter.
6. Work for the Scribe is the new or worsened hauntings of severity `Wraith` or `Restless`, capped at `maxFixesPerSite`, ordered Wraith first, then by page and DOM order. `night-shift diff` prints this list as `workList`.

### Requirement 5: Verify and the keep/reject decision

1. `night-shift verify <site> <fixDir> --haunting <id> [--base <dir>] [--apply]` serves `<base>` and `<fixDir>` each on a free port, audits the pages of the site in both, and decides keep or reject.
2. The decision is a pure function `decide(before, after, target)`:
   - **Reject, `target-still-present`**: the target fingerprint is still present on its page after the fix, or the page failed to audit after the fix.
   - **Reject, `new-haunting`**: for any `type|kind` key on any page, the count after the fix exceeds the count before. The reason names the type, kind, page and a snippet. (A fix changes the target element's HTML, so a fingerprint comparison alone would call every other haunting on that element new; the count rule avoids that.)
   - **Keep** otherwise. Keep needs no score comparison, but both scores are recorded.
3. A reject also happens, with reason `unsafe-change`, if the fix directory contains an added or changed file outside the allowed extensions (`html`, `css`, `js`, `svg`, `json`) or adds a `<script>` element that was not in the base, or adds an element or rule that positions an overlay (`position: fixed` with a `z-index`) that was not in the base. This enforces "source fixes only, no overlays or injected scripts". A check that cannot be done on a binary file treats it as unchanged.
4. `verify` writes `.night-shift/fixes/<patrol-id>/<haunting-id>.json` with `site`, `hauntingId`, `fingerprint`, `decision`, `reasons[]`, `scoreBefore`, `scoreAfter` (per page), `changedFiles[]`, and `attempt`.
5. With `--apply` and a keep decision, files that differ between `<fixDir>` and `<base>` are copied into the site's `fixedDir` (created from `source` if absent). With a reject decision nothing is written outside `.night-shift/` and `<fixDir>`.
6. Exit code is 0 for keep, 3 for reject, 1 for an error (so a script can tell a rejection from a failure).
7. `night-shift workdir <site> <haunting-id> --patrol-id <id>` creates `demo/work/<patrol-id>/<haunting-id>/` (the path comes from the site's `workRoot`, default `demo/work`) as a copy of the base directory and prints the path. It refuses a path that already exists unless `--attempt <n>` gives a new directory suffix `-<n>`. This helper is additional to the five core subcommands.

### Requirement 6: Report

1. `night-shift report [--patrol-id <id>]` writes `REPORT.md` and `report.json` at the repo root. They are generated, listed in `.gitignore`, and the last demo report is committed as `docs/sample-report/REPORT.md` and `report.json` for the README and the dashboard.
2. `report.json` has `schemaVersion`, `patrolId`, `generatedAt`, and `sites[]`. Each site has `name`, `owner`, `scoreBefore`, `scoreAfter`, `scoreChange`, `newCount`, `worsenedCount`, `resolvedCount`, `fixes[]` and `errors[]`. Each fix has `hauntingId`, `type`, `severity`, `page`, `decision` (`kept` or `rejected`), `reasons[]`, `attempts` and `changedFiles[]`.
3. `scoreBefore` is the site's mean page score in the previous patrol (or in this patrol, if there is none); `scoreAfter` is the mean page score of the site's `fixedDir` re-audited by `report`, or the current score if nothing was kept. Lower is better, as in THE UNSEEN. `scoreChange = scoreAfter - scoreBefore`, rounded to one decimal.
4. `REPORT.md` has a heading with the patrol id, one table per site (score before, after, change), a "Kept fixes" list and a "Rejected fixes" list with each reason, and a "Not attempted" list (new or worsened hauntings beyond the cap, or Banished).
5. `report.json` is valid for every input the CLI can produce, including a patrol with no changes, with all sites failing, and with only rejections. Rendering `REPORT.md` is a pure function of `report.json`.
6. `night-shift report --publish-ui` also copies `report.json` to `ui/src/last-report.json` (Requirement 11).

### Requirement 7: `night-shift patrol --no-agents`

1. `night-shift patrol --no-agents` runs `validate`, `audit` for all sites, `diff` for all sites, and `report`, with no fixes. It exits 0 when the patrol itself completed, even if hauntings were found; it exits 1 on a schema error or a missing audit engine.
2. Without `--no-agents`, `patrol` prints that fixes are driven by the Warden through Crew, with the command to start it, and exits 2.
3. `--open-prs` is not implemented. If passed, the CLI prints that it is future work and exits 2. The README lists it under "Future work". No code in this repo pushes to a remote or creates a pull request.

### Requirement 8: Agents and handoff

1. Four agent files exist: `agents/warden.json`, `seer.json`, `scribe.json`, `exorcist.json`. Each has `name`, `description`, `model: "auto"`, `prompt` and `tools`, and passes `kirocrew agent validate ./agents`.
2. The **Warden** is the lead. Its tools include `@kirocrew-core`. It reads `patrol.yaml` through `night-shift validate`, spawns the other three through `kirocrew-core` `spawn` and `wait`, with the delegation reason `specialist`, and writes the morning report with `night-shift report`. It does not edit source and does not run audits itself.
3. The **Seer** runs `night-shift audit` and `night-shift diff` for one site, and may call THE UNSEEN MCP tools (`explain_haunting`) to describe a haunting. It returns the `workList` to the Warden. It reports only new or worsened hauntings.
4. The **Scribe** receives one haunting. It calls `night-shift workdir`, reads the page source in the work directory, may call `suggest_fix` and `explain_haunting`, and edits the work directory with a minimal source change. It never adds an overlay, a script, or `aria-hidden` to hide a problem from assistive technology, and never edits outside its work directory.
5. The **Exorcist** receives a work directory and a haunting id and runs `night-shift verify`. It never edits source. It returns keep or reject and the reasons from the fix record.
6. The handoff for one site is: Warden spawns Seer, waits for the `workList`; for each item sequentially, spawns Scribe, waits; spawns Exorcist, waits. After a reject, the Warden gives the Scribe the Exorcist's reasons for one more attempt (maximum 2 attempts per haunting). Fixes run one at a time so that each starts from the previous kept fix.
7. The Warden's final message states the report path and each fix's decision. The Warden never reports a fix as kept unless the fix record file says `kept`.

### Requirement 9: THE UNSEEN as the crew's eyes

1. `app.json` `mcpServers` declares a server named `unseen` with `command: "node"` and `args` containing the path from env `UNSEEN_MCP_SERVER_JS`, defaulting to `../the-unseen/packages/mcp/dist/server.js`. The test checks the exact declared default and that the declared env variable is the one the Core CLI reads.
2. The agent tool lists for Seer and Scribe include `@unseen`; the Exorcist's does as well.
3. The README documents the env variable, the default path, and the alternative of installing the global bin `unseen-mcp` and pointing the variable at it.
4. The skills tell agents to run `night-shift` rather than re-implement audit logic.

### Requirement 10: Skills

1. `skills/patrol/SKILL.md` (Warden, Seer): the patrol procedure and command sequence.
2. `skills/draft-fix/SKILL.md` (Scribe): how to choose a minimal source fix per haunting type, with the rules of Requirement 8.4 and the Veiled warning (hiding a focusable control with `aria-hidden` creates a new haunting).
3. `skills/verify-fix/SKILL.md` (Exorcist): how to run `verify`, read exit codes and report reasons.
4. Each file starts with front matter (`name`, `description`), and the `name` equals the folder name.

### Requirement 11: Dashboard page "Morning report"

1. `app.json` `ui` is `{ "entry": "dist/index.mjs", "pages": [{ "route": "/apps/night-shift", "label": "Morning report", "icon": ... }] }`.
2. `ui/dist/` is committed. The bundle is an ES module that imports `@kirocrew/app-sdk` and `@kirocrew/app-sdk/ui` from the host import map. `react`, `react-dom`, `react/jsx-runtime`, `lucide-react` and `@kirocrew/app-sdk` are Vite externals, and `@kirocrew/app-sdk/ui` is external too.
3. The page shows the latest report: per site, owner, score before, after and change; the kept fixes; the rejected fixes with their reasons. With no report it shows an empty state that says how to run a patrol.
4. Data source: a static import of `ui/src/last-report.json`, rebuilt into `ui/dist/` by `npm run build:ui` after `night-shift report --publish-ui`. No backend. The design justifies this.
5. The page is accessible, and THE UNSEEN audits it: one `h1`, landmarks, a `caption` and `th scope` on each table, outcome stated in text and not by colour alone, visible focus, a `lang` on the document it renders into, contrast of at least 4.5:1. A test renders the page to static HTML and asserts these structural properties. A task checkpoint audits the rendered HTML with `audit_html` and expects no Wraith.
6. Rendering is a pure function of a `report.json` object. It never throws on any valid report and shows reasons as text, not as HTML.

### Requirement 12: Demo target and the planted rejection

1. `demo/cursed-shop-copy/` holds the HTML, CSS and `img/` of `../the-unseen/apps/cursed-shop` (no `package.json`, `verify.mjs`, or `expected-hauntings.json`). The original is never read for writing and `the-unseen` is never modified.
2. The copy contains one planted case: a focusable decorative-looking control with no accessible name, where the obvious fix (`aria-hidden="true"` on the focusable control) creates a new Veiled haunting and a correct fix exists (give it an accessible name, or remove it from the tab order and hide it together). The planted case is documented in `demo/README.md`.
3. `demo/bad-fix/` holds a committed fix attempt for the planted case that uses the obvious `aria-hidden` fix. `npm run demo:reject` runs `night-shift verify` on it against the served copy and prints a real rejection with the Veiled reason. This is a recorded Scribe-style attempt, labelled as such in the README. It is not presented as an agent run.
4. `demo/cursed-shop-fixed/` is created only by `verify --apply` and is listed in `.gitignore`, except for the committed sample under `docs/sample-report/`.
5. Fix attempts live in `demo/work/<patrol-id>/<haunting-id>/` and are ignored by git.

### Requirement 13: Cron

1. `app.json` `crons` has one entry: `name: "nightly-patrol"`, `cron_expr: "0 2 * * *"`, `message: "Run the Night Shift patrol from patrol.yaml and write the morning report."`, `agent: "warden"`, `enabled: false`.
2. It is a message cron (`message` and `agent`). There is no `command` field and no `every` field.
3. The README explains how to enable it and states that nothing runs overnight until the user enables it.

### Requirement 14: `.kiro/` and repo hygiene

1. `.kiro/steering/crew.md` (roles, handoff, rules), `product.md`, `tech.md`; this spec; and `.kiro/hooks/test-gate.json` (trigger `Stop`) that runs `npm test` and blocks the agent's turn end (exit 1 with a short stderr message) when tests fail. It exits 0 without running the tests if no file under `src/`, `ui/src/`, `agents/`, `skills/` or `app.json` changed since the last pass.
2. `LICENSE` is MIT. The copyright holder line reads `Night Shift contributors`.
3. `README.md` has a Mermaid architecture diagram, setup for macOS/Linux and for Windows, the demo commands, a sample of the morning report, the cron section, a "Future work" section with `--open-prs`, and a placeholder line for the demo recording.
4. No secrets in the repo. The Core CLI never sends data to any host other than the local MCP server and the local static server.

### Requirement 15: Tests

1. Vitest and fast-check, at least 100 runs per property.
2. Properties are named P1 to P10 in `design.md` and each has its own test.
3. An `app.json` test checks the documented required fields, kebab-case name, semver version, no `platform`, no command cron, every referenced agent and skill path exists, and the cron of Requirement 13.
4. An agent test checks each agent file against the documented shape and the role rules (Warden has `@kirocrew-core`; Exorcist has no `write` tool; Scribe prompt forbids overlays).
5. One integration test runs `night-shift patrol --no-agents` against the served demo copy with the real THE UNSEEN server. It is skipped with a clear message if `UNSEEN_MCP_SERVER_JS` does not resolve, and fails in CI where that variable is set.
6. A second integration test runs `verify` on `demo/bad-fix/` and expects exit 3 with a `new-haunting` reason naming `Veiled`, and runs `verify` on a correct fix and expects exit 0.
