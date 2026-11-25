import fc from 'fast-check'
import { fingerprints, hauntingId } from '../../src/pure/fingerprint.js'
import type { HauntingRecord, HistoryFile, PageRecord, Severity } from '../../src/pure/types.js'

export const severityArb: fc.Arbitrary<Severity> = fc.constantFrom('Wraith', 'Restless', 'Banished')
export const typeArb = fc.constantFrom('NamelessSpirit', 'TheVeiled', 'HollowPortrait', 'TheFog', 'LostSoul', 'ShatteredOrder')
export const kindArb = fc.constantFrom('', '', 'no-h1', 'heading-skip')
export const snippetArb = fc.constantFrom('<a>', '<button>', '<img src="a">', '<input>', '<div role="x">', '<h2>')

export type RawH = { type: string; kind: string; htmlSnippet: string; severity: Severity; id: string; selector: string; wcag: string[] }

export const rawHaunting: fc.Arbitrary<RawH> = fc.record({
  type: typeArb,
  kind: kindArb,
  htmlSnippet: snippetArb,
  severity: severityArb,
  id: fc.string({ maxLength: 8 }),
  selector: fc.string({ maxLength: 8 }),
  wcag: fc.array(fc.constantFrom('1.1.1', '4.1.2', '2.4.7'), { maxLength: 2 }),
})

export function toRecords(page: string, raws: RawH[]): HauntingRecord[] {
  const prints = fingerprints(raws)
  return raws.map((r, i) => ({
    fingerprint: prints[i]!,
    id: hauntingId(page, r.type, prints[i]!),
    type: r.type,
    kind: r.kind,
    severity: r.severity,
    selector: r.selector,
    htmlSnippet: r.htmlSnippet,
    wcag: r.wcag,
  }))
}

export const pagePathArb = fc.constantFrom('/index.html', '/product.html', '/checkout.html', '/', '/a')

export const pageRecord = (pageArb: fc.Arbitrary<string> = pagePathArb): fc.Arbitrary<PageRecord> =>
  fc
    .record({
      page: pageArb,
      score: fc.integer({ min: 0, max: 100 }),
      raws: fc.array(rawHaunting, { maxLength: 8 }),
      port: fc.integer({ min: 1000, max: 65000 }),
    })
    .map(({ page, score, raws, port }) => ({ page, url: `http://127.0.0.1:${port}${page}`, score, hauntings: toRecords(page, raws) }))

export const pages: fc.Arbitrary<PageRecord[]> = fc.uniqueArray(pageRecord(), { maxLength: 4, selector: (p) => p.page })

export const history: fc.Arbitrary<HistoryFile> = fc
  .tuple(fc.constantFrom('shop', 'blog'), pages)
  .map(([site, ps]) => ({ schemaVersion: 1 as const, site, patrolId: '20260101T000000Z', startedAt: '2026-01-01T00:00:00.000Z', pages: ps }))
