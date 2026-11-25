import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { decide } from '../src/pure/decide.js'
import { checkSafety, countFixedOverlays, countScripts } from '../src/pure/safety.js'
import { typeKindKey } from '../src/pure/fingerprint.js'
import type { PageRecord } from '../src/pure/types.js'
import { pages, rawHaunting, toRecords } from './arbitraries/history.js'

const RUNS = { numRuns: 200 }

const withTargetPage = (after: PageRecord[]): PageRecord[] =>
  after.some((p) => p.page === '/a') ? after : [...after, { page: '/a', url: 'u', score: 0, hauntings: [] }]

const counts = (p: PageRecord): Map<string, number> => {
  const m = new Map<string, number>()
  for (const h of p.hauntings) m.set(typeKindKey(h), (m.get(typeKindKey(h)) ?? 0) + 1)
  return m
}

describe('decide', () => {
  test('P7 target present: always rejected with target-still-present', () => {
    fc.assert(
      fc.property(pages, pages, fc.nat(), (before, after, pick) => {
        const withHaunting = after.filter((p) => p.hauntings.length > 0)
        fc.pre(withHaunting.length > 0)
        const page = withHaunting[pick % withHaunting.length]!
        const target = { page: page.page, fingerprint: page.hauntings[pick % page.hauntings.length]!.fingerprint }
        const d = decide(before, after, target)
        expect(d.decision).toBe('reject')
        expect(d.reasons.some((r) => r.code === 'target-still-present')).toBe(true)
      }),
      RUNS
    )
  })

  test('P7 a page that failed to audit after the fix is rejected', () => {
    const bad: PageRecord = { page: '/a', url: 'u', score: 0, hauntings: [], error: 'boom' }
    const d = decide([], [bad], { page: '/a', fingerprint: 'x#0' })
    expect(d.decision).toBe('reject')
    expect(d.reasons[0]?.code).toBe('target-still-present')
  })

  test('P8 target gone: reject exactly when some type|kind count rose, naming that key; otherwise keep with no reasons', () => {
    fc.assert(
      fc.property(pages, pages, (before, afterRaw) => {
        const after = withTargetPage(afterRaw)
        const target = { page: '/a', fingerprint: 'NotThere||<x>#0' }
        const d = decide(before, after, target)
        const rose: string[] = []
        for (const a of after) {
          const b = before.find((p) => p.page === a.page)
          if (!b) continue
          const was = counts(b)
          for (const [k, n] of counts(a)) if (n > (was.get(k) ?? 0)) rose.push(`${k}\n${a.page}`)
        }
        const newReasons = d.reasons.filter((r) => r.code === 'new-haunting')
        if (rose.length === 0) {
          expect(d.decision).toBe('keep')
          expect(d.reasons).toEqual([])
        } else {
          expect(d.decision).toBe('reject')
          expect(newReasons.map((r) => `${r.type}|${r.kind ?? ''}\n${r.page}`).sort()).toEqual(rose.sort())
          for (const r of newReasons) expect(r.message).toContain(r.type!)
        }
      }),
      RUNS
    )
  })

  test('P8 adding hauntings to before never turns a keep into a reject', () => {
    fc.assert(
      fc.property(pages, pages, fc.array(rawHaunting, { maxLength: 5 }), (beforeRaw, afterRaw, extra) => {
        const after = withTargetPage(afterRaw)
        const target = { page: '/a', fingerprint: 'NotThere||<x>#0' }
        const keepBefore = decide(beforeRaw, after, target)
        const richer = beforeRaw.map((p) => ({ ...p, hauntings: [...p.hauntings, ...toRecords(p.page, extra)] }))
        if (keepBefore.decision === 'keep') expect(decide(richer, after, target).decision).toBe('keep')
        // A "before" that already holds everything in "after" can never reject.
        const superset = after.map((p) => ({ ...p, hauntings: [...p.hauntings, ...toRecords(p.page, extra)] }))
        expect(decide(superset, after, target).decision).toBe('keep')
      }),
      RUNS
    )
  })

  test('the count rule keeps a fix that changes the snippet of the element it fixed', () => {
    const h = (snippet: string, type = 'NamelessSpirit') => toRecords('/a', [{ type, kind: '', htmlSnippet: snippet, severity: 'Wraith', id: '', selector: '', wcag: [] }])
    const before: PageRecord[] = [{ page: '/a', url: 'u', score: 9, hauntings: [...h('<a id=1>'), ...toRecords('/a', [{ type: 'TheFog', kind: '', htmlSnippet: '<p>', severity: 'Restless', id: '', selector: '', wcag: [] }])] }]
    const after: PageRecord[] = [{ page: '/a', url: 'u', score: 4, hauntings: toRecords('/a', [{ type: 'TheFog', kind: '', htmlSnippet: '<p class="changed">', severity: 'Restless', id: '', selector: '', wcag: [] }]) }]
    expect(decide(before, after, { page: '/a', fingerprint: before[0]!.hauntings[0]!.fingerprint }).decision).toBe('keep')
  })
})

describe('P9 safety', () => {
  const html = (inner: string) => `<html><body>${inner}</body></html>`
  const attr = fc.stringMatching(/^[a-z]{1,8}$/)

  test('P9 added script, added fixed overlay and disallowed extension are rejected', () => {
    fc.assert(
      fc.property(attr, attr, (a, b) => {
        const base = html(`<a href="#">${a}</a>`)
        expect(checkSafety([{ path: 'index.html', base, fix: `${base}<script>${b}</script>` }]).map((r) => r.code)).toEqual(['unsafe-change'])
        expect(checkSafety([{ path: 'x.css', base: `.a{color:red}`, fix: `.a{color:red}.${a}{position:fixed;z-index:9}` }]).map((r) => r.code)).toEqual(['unsafe-change'])
        expect(checkSafety([{ path: 'index.html', base, fix: `${base}<div style="position: fixed; top:0; z-index: 10">${b}</div>` }]).length).toBe(1)
        expect(checkSafety([{ path: `img/${a}.png`, base: undefined, fix: undefined }]).map((r) => r.code)).toEqual(['unsafe-change'])
        expect(checkSafety([{ path: `${a}.php`, base: undefined, fix: 'x' }]).length).toBe(1)
      }),
      RUNS
    )
  })

  test('P9 attribute-only HTML changes are not flagged', () => {
    fc.assert(
      fc.property(attr, attr, (label, text) => {
        const base = html(`<a href="#"><img alt="" src="x.png">${text}</a>`)
        const fix = html(`<a href="#" aria-label="${label}"><img alt="" src="x.png">${text}</a>`)
        expect(checkSafety([{ path: 'index.html', base, fix }])).toEqual([])
      }),
      RUNS
    )
  })

  test('scripts and overlays already in the base are not flagged; binary content is treated as unchanged', () => {
    const base = html('<script>a</script><div style="position:fixed;z-index:3"></div>')
    expect(checkSafety([{ path: 'index.html', base, fix: base.replace('<html>', '<html lang="en">') }])).toEqual([])
    expect(checkSafety([{ path: 'logo.svg', base: undefined, fix: undefined }])).toEqual([])
    expect(countScripts('<SCRIPT src=a></script><script>')).toBe(2)
    expect(countFixedOverlays('.a{position:fixed}.b{z-index:1}')).toBe(0)
  })
})

