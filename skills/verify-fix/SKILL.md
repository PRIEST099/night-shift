---
name: verify-fix
description: Verify one fix attempt with night-shift verify and report keep or reject with the reasons. Use when asked to verify, check or judge a fix, or act as the Exorcist.
---

# Verify a fix

Never edit source. The decision is made by the CLI, not by you.

1. Call the `verify` tool (`night-shift verify <site> <work-dir> --haunting <haunting-id> --apply`) with `apply` true.
   - It serves the base (the fixed directory if it exists, else the source) and the work directory, audits the site's pages in both, then decides.
   - `--apply` copies the changed files into the fixed directory only when the decision is keep.
2. Read the exit code, which the tool returns as `code`.
   - `0` keep: the target haunting is gone and no `type|kind` count rose on any page.
   - `3` reject: report the reasons.
   - `1` error: report the error text and stop. Do not guess a decision.
3. Read the fix record the tool returns (it is also written to `.night-shift/fixes/<patrol-id>/<haunting-id>.json`). Report `keep` or `reject`, the `attempt`, and each reason as written:
   - `target-still-present`: the haunting is still on its page, or the page failed to audit.
   - `new-haunting`: a haunting type and kind appears more often than before. The reason names the type, page and a snippet.
   - `unsafe-change`: a disallowed file type, an added script, or an added fixed-position overlay.
4. Give the Warden the reasons verbatim so the Scribe can change approach. Do not soften a rejection.

You may call the unseen tool `explain_haunting` to explain a new haunting, for example The Veiled, which a fix creates when it hides a focusable control with `aria-hidden`.
