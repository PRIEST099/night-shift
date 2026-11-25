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

## A realistic regression: `npm run demo:regress` and `npm run demo:reset`

The planted case is already in the baseline, so a patrol on an unchanged copy reports 0 new hauntings (the Scribe and Exorcist are not needed). To give the crew something to do, simulate a change someone shipped today.

```
npm run build            # the scripts use dist/
npm run demo:regress     # apply the change
# run a patrol (or: night-shift audit --site cursed-shop; night-shift diff --site cursed-shop)
npm run demo:reset       # undo it
```

**`npm run demo:regress`** adds one icon-only "Buy now" (express checkout) button to `demo/cursed-shop-copy/product.html`, next to the wishlist button:

```html
<button class="wishlist-btn buy-now-btn" onclick="location.href='checkout.html'">...lightning-bolt svg, no text...</button>
```

It is focusable and has no accessible name, and its class says `buy`, a core task word. THE UNSEEN reports exactly one new **Wraith Nameless Spirit** on `/product.html`. Running it twice changes nothing the second time.

| Fix | Result |
| --- | --- |
| Obvious: add `aria-hidden="true"` | The button stays in the tab order. A new **Veiled** haunting appears and `night-shift verify` rejects the fix with `new-haunting`. |
| Correct: add `aria-label="Buy now"` | `night-shift verify` keeps the fix. |

`tests/demo-regress.int.test.ts` checks all of this against the real server: after the change, `night-shift diff` reports exactly one new Wraith, the `aria-hidden` fix is rejected and the `aria-label` fix is kept. These two fixes are written by the test; they are recorded attempts, not agent runs. A live Crew run may choose either.

**`npm run demo:reset`** runs `git restore` on `demo/cursed-shop-copy/` and deletes `demo/cursed-shop-fixed/`. That folder is created by `night-shift verify --apply` and ignored by git, so git has nothing to restore it from. `.night-shift/history` is kept, so the next patrol has a baseline.

The diff compares a patrol with the one before it. If a patrol ran on the regressed copy and you then reset, the newest history file still holds the regression. Run one patrol on the reset copy first (it reports the button as resolved), then run `demo:regress` and patrol again to get exactly one new Wraith.

**`npm run demo:rebaseline [-- <site>]`** (default site `cursed-shop`) moves the newest history file of the site into `.night-shift/history-archive/<site>/`. Nothing is deleted. Use it after a patrol that already saw the regression: the next patrol then compares against the patrol before the regression, so it reports the new Wraith again. Run `npm run build` first (the script uses `dist/`). Order for a repeat run: `demo:reset`, `demo:rebaseline`, `demo:regress`, then the patrol.
## Why the score may not move

The Haunting Score is capped and weighted by type. The Cursed Shop has many Nameless Spirits, so removing one does not always change a page's score. `docs/sample-report/` shows this: the fix is kept and the score change is 0.0.

## Folders

- `demo/work/<patrol-id>/<haunting-id>/` holds fix attempts made by `night-shift workdir`. Ignored by git.
- `demo/cursed-shop-fixed/` is created by `night-shift verify --apply` from `source` plus the kept files. Ignored by git.
