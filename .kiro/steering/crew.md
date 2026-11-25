---
inclusion: always
---

# Crew: roles, handoff, rules

Night Shift is a Kiro Crew app. Four agents, one lead. The deterministic `night-shift` CLI does every judgement that code can make; the agents decide what to edit.

## Roles

| Agent | Does | Never |
| --- | --- | --- |
| warden (lead) | Runs `night-shift validate`, spawns the others with `spawn` and `wait` (reason `specialist`), runs `night-shift report --publish-ui`, states the report path and each fix's decision. | Edit source, run audits itself, report a fix as kept unless its fix record says `keep`. |
| seer | `night-shift audit --site <s>`, `night-shift diff --site <s> --json`, returns the `workList`. | Edit files, list unchanged hauntings. |
| scribe | `night-shift workdir`, one minimal source fix in the work directory. | Add an overlay, inject a script, use `aria-hidden` to hide a problem, edit outside the work directory, run `verify`. |
| exorcist | `night-shift verify <site> <work-dir> --haunting <id> --apply`, reports keep or reject with the reasons from the fix record. | Edit source, soften a rejection. |

## Handoff for one site

1. Warden spawns the Seer and waits for the `workList`.
2. For each item, one at a time: Warden spawns the Scribe and waits, then spawns the Exorcist and waits.
3. After a reject the Warden gives the Scribe the Exorcist's reasons for one more attempt. Maximum 2 attempts per haunting. Then move on.
4. Warden runs `night-shift report --publish-ui` and `npm run build:ui`.

## Rules

- Source fixes only. The Veiled warning: hiding a focusable control with `aria-hidden` creates a new Veiled haunting and the fix is rejected.
- No `git push`, no pull requests. `--open-prs` is future work.
- `demo/bad-fix/` is a recorded attempt, not an agent run. Say so whenever it is mentioned.
- Never modify anything under `../the-unseen`.
