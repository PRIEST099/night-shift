---
inclusion: always
---

# Product: Night Shift

Night Shift patrols a list of websites overnight with THE UNSEEN and comes back in the morning with accessibility fixes in source and a report. It is an entry for the Best Kiro Crew App prize.

## Users and outcome

A site owner lists sites in `patrol.yaml`. In the morning they read `REPORT.md` (or the dashboard page "Morning report") and see, per site, the score before and after, the fixes that were kept, the fixes that were rejected with the reason, and what was not attempted.

## Principles

- The report must not overclaim. A fix is kept only if the CLI said keep. Automated checks find roughly 30 to 40 percent of WCAG issues, and no text may say a site meets a standard.
- Source fixes only: no overlays, no injected scripts.
- Nothing leaves the machine. Kept fixes go to a local fixed directory. No pushes, no pull requests (`--open-prs` is future work).
- The demo has a planted case. `demo/bad-fix/` is a recorded attempt, not an agent run, and every place that mentions it says so.

## Out of scope

Opening pull requests, a dashboard backend, command crons, Windows-specific Crew platform settings.
