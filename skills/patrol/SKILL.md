---
name: patrol
description: Run one Night Shift patrol over every site in patrol.yaml. Use when asked to patrol, audit overnight, or write the morning report. For the Warden and the Seer.
---

# Patrol

Run the deterministic `night-shift` CLI for every judgement it can make. Do not re-implement audit, diff, verify or report logic, and do not call the audit tool by hand for a patrol.

## Seer: audit one site

1. `night-shift audit --site <site>` serves the site on a free local port, audits every page with THE UNSEEN, and writes `.night-shift/history/<site>/<patrol-id>.json`.
2. `night-shift diff --site <site> --json` compares it with the previous patrol. Read `workList`: new or worsened Wraith and Restless hauntings, capped at `maxFixesPerSite`, Wraith first. Unchanged hauntings are not work.
3. Return the patrol id and the workList to the Warden. If it is empty, say so.

## Warden: run the whole patrol

1. `night-shift validate`. Exit 1 means stop and print the problems.
2. Per site, one at a time: spawn the `seer` (reason `specialist`) and wait for the workList.
3. Per workList item, one at a time: spawn the `scribe`, wait, spawn the `exorcist`, wait. After a reject, send the Exorcist's reasons to the Scribe for one more attempt. Maximum 2 attempts per haunting.
4. `night-shift report --publish-ui`, then `npm run build:ui`.
5. Final message: the path of `REPORT.md` and each fix's decision, read from `.night-shift/fixes/<patrol-id>/<haunting-id>.json`. Never call a fix kept unless that file says `keep`.

## Rules

- Fixes run sequentially so each one starts from the previous kept fix.
- Never push to a remote or open a pull request. `--open-prs` is future work.
- Automated checks find roughly 30 to 40 percent of WCAG issues. Do not claim a site meets a standard.
