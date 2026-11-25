---
name: patrol
description: Run one Night Shift patrol over every site in patrol.yaml. Use when asked to patrol, audit overnight, or write the morning report. For the Warden and the Seer.
---

# Patrol

The deterministic `night-shift` code makes every judgement it can make, and the agents reach it through the Night Shift MCP tools (`night-shift mcp`, mounted as `@night-shift:shift`). Do not re-implement audit, diff, verify or report logic, and do not call the audit tool by hand for a patrol. No agent has a shell or file tools.

## Seer: audit one site

1. Call `audit` with the site. It serves the site on a free local port, audits every page with THE UNSEEN, and writes `.night-shift/history/<site>/<patrol-id>.json`. It returns the patrol id.
2. Call `diff` with the site and the patrol id. Read `workList`: new or worsened Wraith and Restless hauntings, capped at `maxFixesPerSite`, Wraith first. Unchanged hauntings are not work.
3. Return the patrol id and the workList to the Warden. If it is empty, say so.

## Warden: run the whole patrol

1. Call `validate`. If `ok` is false, stop and print the problems.
2. Per site, one at a time: call the `seer` sub-agent and take the workList.
3. Per workList item, one at a time: call the `scribe`, then the `exorcist`. After a reject, send the Exorcist's reasons to the Scribe for one more attempt. Maximum 2 attempts per haunting. These three are native sub-agents of the Warden (`toolsSettings.subagent`), the specialist role.
4. Call `report` with `publishUi`. It runs the same code as `night-shift report --publish-ui`. The dashboard needs `npm run build:ui` afterwards, which is the owner's step.
5. Final message: the path of `REPORT.md` and each fix's decision as the `report` tool lists it. Never call a fix kept unless it says `kept`.

## Rules

- Every tool takes `home`, the repository root. A Crew session does not start in the repository, so the task message names it and the Warden passes it to each specialist as `REPO: <directory>`.
- Fixes run sequentially (one at a time) so each one starts from the previous kept fix.
- Never push to a remote or open a pull request. `--open-prs` is future work.
- Automated checks find roughly 30 to 40 percent of WCAG issues. Do not claim a site meets a standard.
