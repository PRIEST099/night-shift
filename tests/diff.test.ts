import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { fingerprints, hauntingId } from '../src/pure/fingerprint.js'
import { diffPatrols, workList } from '../src/pure/diff.js'
import { slugify } from '../src/pure/slug.js'
import { SEVERITY_RANK } from '../src/pure/types.js'
import type { HauntingRecord, PageRecord } from '../src/pure/types.js'
import { pages, rawHaunting, toRecords, typeArb, snippetArb, kindArb, severityArb } from './arbitraries/history.js'

const RUNS = { numRuns: 150 }
const keyOf = (h: { page: string; fingerprint: string }) => `${h.page}\n${h.fingerprint}`

function shuffled<T>(arr: T[], seed: number[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = (seed[i % Math.max(1, seed.length)] ?? 0) % (i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

const shufflePages = (ps: PageRecord[], seed: number[]): PageRecord[] =>
  shuffled(ps, seed).map((p, i) => ({ ...p, hauntings: shuffled(p.hauntings, seed.map((s) => s + i)) }))

describe('fingerprints', () => {
  test('P1 independence from everything but type, kind and htmlSnippet', () => {
    fc.assert(
      fc.property(fc.array(rawHaunting, { maxLength: 10 }), fc.string(), (raws, noise) => {
        const base = fingerprints(raws)
        const changed = fingerprints(raws.map((r) => ({ ...r, id: noise, selector: noise, severity: 'Banished', wcag: [noise] })))
        expect(changed).toEqual(base)
      }),
      RUNS
    )
  })

  test('P2 uniqueness: pairwise distinct, identical keys get consecutive #n', () => {
    fc.assert(
      fc.property(fc.array(fc.record({ type: typeArb, kind: kindArb, htmlSnippet: snippetArb }), { maxLength: 15 }), (list) => {
        const prints = fingerprints(list)
        expect(new Set(prints).size).toBe(prints.length)
        const counters = new Map<string, number>()
        list.forEach((h, i) => {
          const key = `${h.type}|${h.kind}|${h.htmlSnippet}`
          const n = counters.get(key) ?? 0
          expect(prints[i]).toBe(`${key}#${n}`)
          counters.set(key, n + 1)
        })
      }),
      RUNS
    )
  })

  test('kind undefined and empty give the same key', () => {
    expect(fingerprints([{ type: 'A', htmlSnippet: 'x' }])).toEqual(fingerprints([{ type: 'A', kind: '', htmlSnippet: 'x' }]))
  })

  test('haunting id is deterministic and directory-safe', () => {
    const id = hauntingId('/index.html', 'NamelessSpirit', 'NamelessSpirit||<a>#0')
    expect(id).toMatch(/^index-html-NamelessSpirit-[0-9a-f]{8}$/)
    expect(id).toBe(hauntingId('/index.html', 'NamelessSpirit', 'NamelessSpirit||<a>#0'))
    fc.assert(fc.property(fc.string(), fc.string(), (p, f) => /^[A-Za-z0-9-]+$/.test(hauntingId(p, 'The Veiled!', f))), RUNS)
  })
})

describe('slug', () => {
  test.each([
    ['/index.html', 'index-html'],
    ['/', 'root'],
    ['https://Example.com/a/b?x=1', 'example-com-a-b-x-1'],
    ['/../..', 'root'],
  ])('%s -> %s', (input, expected) => expect(slugify(input)).toBe(expected))

  test('always filesystem safe and at most 40 chars', () => {
    fc.assert(fc.property(fc.string(), (s) => /^[a-z0-9-]{1,40}$/.test(slugify(s)) && !slugify(s).endsWith('-')), RUNS)
  })
})

describe('diff', () => {
  test('P4 identity: diff(x, x) has no new and no worsened', () => {
    fc.assert(
      fc.property(pages, (ps) => {
        const d = diffPatrols({ pages: ps }, { pages: ps })
        expect(d.new).toEqual([])
        expect(d.worsened).toEqual([])
        expect(d.resolved).toEqual([])
      }),
      RUNS
    )
  })

  test('P5 completeness: with no previous patrol everything is new; shuffling does not change the result; sets are disjoint', () => {
    fc.assert(
      fc.property(pages, pages, fc.array(fc.nat(), { minLength: 1, maxLength: 12 }), (prev, curr, seed) => {
        const none = diffPatrols(undefined, { pages: curr })
        expect(none.new.length).toBe(curr.reduce((n, p) => n + p.hauntings.length, 0))
        expect(none.worsened).toEqual([])
        expect(none.resolved).toEqual([])

        const a = diffPatrols({ pages: prev }, { pages: curr })
        const b = diffPatrols({ pages: shufflePages(prev, seed) }, { pages: shufflePages(curr, seed.map((s) => s + 1)) })
        for (const k of ['new', 'worsened', 'resolved'] as const) {
          expect(a[k].map(keyOf).sort()).toEqual(b[k].map(keyOf).sort())
        }
        const all = [...a.new, ...a.worsened, ...a.resolved].map(keyOf)
        expect(new Set(all).size).toBe(all.length)
      }),
      RUNS
    )
  })

  test('P6 worsened rule: only a higher severity is reported, and once', () => {
    fc.assert(
      fc.property(rawHaunting, severityArb, severityArb, (raw, before, after) => {
        const page = '/a'
        const mk = (severity: typeof before): PageRecord => ({
          page,
          url: 'http://x/a',
          score: 0,
          hauntings: toRecords(page, [{ ...raw, severity }]),
        })
        const d = diffPatrols({ pages: [mk(before)] }, { pages: [mk(after)] })
        expect(d.new).toEqual([])
        if (SEVERITY_RANK[after] > SEVERITY_RANK[before]) expect(d.worsened).toHaveLength(1)
        else expect(d.worsened).toEqual([])
      }),
      RUNS
    )
  })

  test('failed pages: a failing current page resolves nothing, a failing previous page counts as absent', () => {
    const h = toRecords('/a', [{ type: 'LostSoul', kind: '', htmlSnippet: '<a>', severity: 'Wraith', id: '', selector: '', wcag: [] }])
    const ok: PageRecord = { page: '/a', url: 'u', score: 1, hauntings: h }
    const bad: PageRecord = { page: '/a', url: 'u', score: 0, hauntings: [], error: 'boom' }
    expect(diffPatrols({ pages: [ok] }, { pages: [bad] }).resolved).toEqual([])
    expect(diffPatrols({ pages: [bad] }, { pages: [ok] }).new).toHaveLength(1)
  })

  test('resolved lists hauntings that disappeared', () => {
    const h = toRecords('/a', [{ type: 'LostSoul', kind: '', htmlSnippet: '<a>', severity: 'Wraith', id: '', selector: '', wcag: [] }])
    const d = diffPatrols({ pages: [{ page: '/a', url: 'u', score: 1, hauntings: h }] }, { pages: [{ page: '/a', url: 'u', score: 0, hauntings: [] }] })
    expect(d.resolved).toHaveLength(1)
  })
})

describe('workList', () => {
  const mk = (n: number, severity: HauntingRecord['severity'], page = '/a') =>
    toRecords(page, Array.from({ length: n }, (_, i) => ({ type: 'LostSoul', kind: '', htmlSnippet: `<a${i}${severity}>`, severity, id: '', selector: '', wcag: [] })))

  test('is capped, Wraith first, Banished excluded', () => {
    const page: PageRecord = { page: '/a', url: 'u', score: 5, hauntings: [...mk(3, 'Restless'), ...mk(2, 'Banished'), ...mk(4, 'Wraith')] }
    const d = diffPatrols(undefined, { pages: [page] })
    const list = workList(d, 5)
    expect(list).toHaveLength(5)
    expect(list.slice(0, 4).every((h) => h.severity === 'Wraith')).toBe(true)
    expect(list[4]?.severity).toBe('Restless')
    expect(list.some((h) => h.severity === 'Banished')).toBe(false)
    expect(workList(d, 0)).toEqual([])
    expect(workList(d, 100)).toHaveLength(7)
  })

  test('orders by page then DOM order within one severity', () => {
    const p1: PageRecord = { page: '/a', url: 'u', score: 5, hauntings: mk(2, 'Wraith', '/a') }
    const p2: PageRecord = { page: '/b', url: 'u', score: 5, hauntings: mk(2, 'Wraith', '/b') }
    const list = workList(diffPatrols(undefined, { pages: [p1, p2] }), 10)
    expect(list.map((h) => `${h.page}:${h.domIndex}`)).toEqual(['/a:0', '/a:1', '/b:0', '/b:1'])
  })

  test('cap and eligibility hold for any diff', () => {
    fc.assert(
      fc.property(pages, fc.integer({ min: 0, max: 20 }), (ps, cap) => {
        const list = workList(diffPatrols(undefined, { pages: ps }), cap)
        expect(list.length).toBeLessThanOrEqual(cap)
        expect(list.every((h) => h.severity !== 'Banished')).toBe(true)
        const ranks = list.map((h) => SEVERITY_RANK[h.severity])
        expect([...ranks].sort((x, y) => y - x)).toEqual(ranks)
      }),
      RUNS
    )
  })
})
