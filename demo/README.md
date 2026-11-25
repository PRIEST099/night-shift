# Demo target: the Cursed Shop copy

`demo/cursed-shop-copy/` is a copy of `../the-unseen/apps/cursed-shop` (the three HTML pages and `img/`, no `package.json`, `verify.mjs` or `expected-hauntings.json`). Night Shift only ever edits copies of it. The original is never written to.

## The planted case

One element was added to `index.html`, in the hero section, next to the "Explore Collection" button:

```html
<button type="button" class="sparkle-link subscribe-sparkle" onclick="..."><img src="img/sparkle.svg" alt="" class="sparkle" width="24" height="24"></button>
```

It looks like a decoration (a small gold star), but it is a focusable button with no accessible name. THE UNSEEN reports it as a **Nameless Spirit** with severity **Wraith** (a nameless button whose class mentions `subscribe`, a core task word). Its haunting id is `index-html-NamelessSpirit-d3eefb7e`.

There are two ways to fix it:

| Fix | Result |
| --- | --- |
| Obvious: add `aria-hidden="true"` to the button | The button is still in the tab order, so a screen reader user can reach it and hears nothing. THE UNSEEN reports a new **Veiled** haunting. `night-shift verify` rejects the fix with `new-haunting`. |
| Correct: add `aria-label="Jump to the collection"` | The button has a name. `night-shift verify` keeps the fix. |

## `demo/bad-fix/` is a recorded attempt, not an agent run

`demo/bad-fix/` is a full copy of the site with the obvious `aria-hidden` fix applied. It was written by hand as the kind of change a Scribe might make. It is a **recorded attempt, not an agent run**. In a live Crew run the Scribe may or may not choose this fix; the Exorcist behaves the same either way, because the decision comes from `night-shift verify`, not from the agent.

The rejection is real. `npm run demo:reject` audits the copy and runs `night-shift verify` on `demo/bad-fix/` with the real THE UNSEEN server, so it needs the sibling checkout built (see the README). It exits 0 when verify rejects the fix (verify itself exits 3):

```
npm run build
npm run demo:reject
```

The correct fix is stored as a test fixture in `tests/fixtures/correct-fix/`, also a recorded attempt. The integration test `tests/verify.int.test.ts` checks both: the bad fix exits 3 with a `new-haunting` reason naming `TheVeiled`, and the correct fix exits 0.

## Why the score may not move

The Haunting Score is capped and weighted by type. The Cursed Shop has many Nameless Spirits, so removing one does not always change a page's score. `docs/sample-report/` shows this: the fix is kept and the score change is 0.0.

## Folders

- `demo/work/<patrol-id>/<haunting-id>/` holds fix attempts made by `night-shift workdir`. Ignored by git.
- `demo/cursed-shop-fixed/` is created by `night-shift verify --apply` from `source` plus the kept files. Ignored by git.
