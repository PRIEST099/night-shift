---
name: draft-fix
description: Choose and write one minimal source fix for one accessibility haunting in a work directory. Use when asked to fix a haunting, draft a fix, or act as the Scribe.
---

# Draft a fix

Work only inside the directory printed by `night-shift workdir <site> <haunting-id> --patrol-id <id>`. Make the smallest source change that removes the haunting. Run `night-shift` for anything deterministic; do not write your own audit.

## Choose the fix by type

- **NamelessSpirit** (control with no accessible name): add visible text, or `aria-label` / `aria-labelledby` that says what the control does. For an icon-only link or button, name the control, not the image. If it is truly decorative and unnecessary, remove it from the tab order and hide it in one change (`tabindex="-1"` together with `aria-hidden="true"`), or delete the element.
- **HollowPortrait** (image with no text alternative): meaningful image gets `alt` that says what it conveys; a decorative one gets `alt=""`.
- **WhisperingField** (input with no label): add a `<label for>` or `aria-label`.
- **LostSoul**: give the link or control a name or fix its target. **TheFog**: raise contrast in CSS. **ShatteredOrder**: fix the heading or landmark structure. **SilentTongue**: add or correct `lang`.
- When unsure, call `explain_haunting` and `suggest_fix` with the haunting id, then apply the smallest edit by hand.

## The Veiled warning

Never hide a focusable control with `aria-hidden="true"` alone. The control stays in the tab order, so a screen reader user can still reach it and hears nothing: THE UNSEEN reports a new Veiled haunting and the Exorcist rejects the fix. Name the control instead, or remove it from the tab order and hide it together.

## Forbidden

- No overlay: no `position: fixed` with a `z-index`.
- No injected script or runtime DOM patch.
- No `aria-hidden` to hide a problem from assistive technology.
- No new file types other than html, css, js, svg, json.
- No edits outside the work directory.

If the Exorcist rejected a previous attempt, read its reasons and change the approach. Do not repeat the same edit. Return the work directory path and one sentence about the change. Do not run `night-shift verify`.
