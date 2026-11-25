# Real unattended crew run, 2026-11-25 22:10 SAST (cron `night-shift/nightly-patrol`, triggered once)

Recorded by the product lead from Kiro Crew 0.13.1 on Windows. Scenario: `npm run demo:regress` shipped one icon-only "Buy now" button to the demo copy, and nobody approved anything during the run (the owner opted into `hooks.auto_approve_sources: ["cron"]`).

## Crew security log (every Night Shift tool call)

| Time (UTC) | Caller | Tool | Outcome |
|---|---|---|---|
| 20:11:09 | warden (cron session) | `@night-shift:shift/validate` | auto_approved |
| 20:11:16 | cron:095976da | `@night-shift:shift/audit` | auto_approved |
| 20:11:40 | cron:095976da | `@night-shift:shift/diff` | auto_approved |
| 20:11:41 | cron:095976da | `@night-shift:unseen/explain_haunting` | auto_approved |
| 20:11:53 | cron:095976da | `@night-shift:shift/workdir` | auto_approved |
| 20:11:53 | cron:095976da | `@night-shift:shift/diff` | auto_approved |
| 20:11:54 | cron:095976da | `@night-shift:shift/find_in_source` | auto_approved |
| 20:11:58 | cron:095976da | `@night-shift:shift/edit_fix_file` | auto_approved |
| 20:12:07 | cron:095976da | `@night-shift:shift/verify` | auto_approved |
| 20:12:49 | warden (cron session) | `@night-shift:shift/report` | auto_approved |

## The kept fix (demo/cursed-shop-fixed/product.html, line 739)

```diff
- <button class="wishlist-btn buy-now-btn" onclick="location.href='checkout.html'">
+ <button class="wishlist-btn buy-now-btn" aria-label="Buy now" onclick="location.href='checkout.html'">
```

## Morning report written by the Warden

## Night Shift morning report: patrol 20261125T201116Z

Generated 2026-11-25T20:13:09.389Z. Lower scores are better.

### cursed-shop (owner: demo-team)

| Score before | Score after | Change |
| --- | --- | --- |
| 84.3 | 84.3 | 0.0 |

New hauntings: 1. Worsened: 0. Resolved: 0.

#### Kept fixes

- `product-html-NamelessSpirit-e5f92791`: NamelessSpirit (Wraith) on /product.html, 1 attempt. Changed: product.html.

#### Rejected fixes

None.

#### Not attempted

None.

## The Warden's final message (Crew session `cron_095976da`)

> # Cron Job Result: night-shift/nightly-patrol | 2026-11-25 22:13:13 SAST
> 
> 
> 
> Report: `D:\kiroween 2026\night-shift\REPORT.md`
> 
> | Haunting | Decision |
> |---|---|
> | `product-html-NamelessSpirit-e5f92791` | kept (1 try) |
> 
> - The fix adds `aria-label="Buy now"` to the `.buy-now-btn` button on `/product.html`.
> - The fix sits in the work copy. I did not change your live site.
> - Score: 84.3 before, 84.3 after. The `/product.html` page score went from 87 to 85. The Exorcist kept the fix anyway.
> - Last night the Scribe hit its file limit. This time it worked.
> 
> Owner to do: run `npm run build:ui` to update the dashboard. I can't run it.
> 
> Automated checks find only about 30 to 40 percent of WCAG issues. This does not mean the site meets a standard.
