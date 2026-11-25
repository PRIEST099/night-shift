import fc from 'fast-check'
import type { FixRecord } from '../../src/pure/fix-record.js'
import type { SiteInput } from '../../src/pure/report.js'
import { history, severityArb, typeArb } from './history.js'

const reasonText = fc.oneof(
  fc.stringMatching(/^[A-Za-z0-9 <>&"'|`:.,()#-]{1,60}$/).filter((s) => s.trim() === s && s.length > 0 && !s.includes('  ')),
  fc.constantFrom('new-haunting: TheVeiled appeared on /index.html', 'x <script>alert(1)</script> & y', 'a | b')
)

export const fixRecord = (site: string, patrolId: string): fc.Arbitrary<FixRecord> =>
  fc
    .record({
      hauntingId: fc.stringMatching(/^[a-z0-9-]{3,20}$/),
      page: fc.constantFrom('/index.html', '/a'),
      type: typeArb,
      severity: severityArb,
      decision: fc.constantFrom('keep' as const, 'reject' as const),
      reasons: fc.array(reasonText, { maxLength: 3 }),
      changedFiles: fc.array(fc.constantFrom('index.html', 'css/a.css'), { maxLength: 2 }),
      attempt: fc.integer({ min: 1, max: 2 }),
      earlier: fc.array(fc.record({ decision: fc.constantFrom('keep' as const, 'reject' as const), reasons: fc.array(reasonText, { maxLength: 2 }) }), { maxLength: 2 }),
      origin: fc.constantFrom('crew' as const, 'recorded-attempt' as const),
    })
    .map((r) => ({
      schemaVersion: 1 as const,
      patrolId,
      site,
      hauntingId: r.hauntingId,
      fingerprint: `${r.type}||x#0`,
      page: r.page,
      type: r.type,
      severity: r.severity,
      decision: r.decision,
      reasons: r.reasons.map((message) => ({ code: 'new-haunting' as const, message })),
      scoreBefore: {},
      scoreAfter: {},
      changedFiles: r.changedFiles,
      attempt: r.attempt,
      origin: r.origin,
      applied: false,
      verifiedAt: '2026-01-01T00:00:00.000Z',
      previousAttempts: r.earlier.map((e, i) => ({ attempt: i + 1, decision: e.decision, reasons: e.decision === 'keep' ? [] : e.reasons.map((message) => ({ code: 'new-haunting' as const, message })) })),
    }))

export const siteInput: fc.Arbitrary<SiteInput> = fc
  .record({
    name: fc.stringMatching(/^[a-z]{3,8}$/),
    owner: fc.stringMatching(/^[a-zA-Z ]{0,10}$/).map((s) => s.trim()),
    cap: fc.integer({ min: 0, max: 6 }),
    current: fc.option(history, { nil: undefined }),
    previous: fc.option(history, { nil: undefined }),
    rescored: fc.option(fc.integer({ min: 0, max: 1000 }).map((n) => n / 10), { nil: undefined }),
  })
  .chain((s) =>
    fc.uniqueArray(fixRecord(s.name, 'p1'), { maxLength: 4, selector: (r) => r.hauntingId }).map(
      (fixes): SiteInput => ({
        name: s.name,
        owner: s.owner,
        maxFixesPerSite: s.cap,
        current: s.current,
        previous: s.previous,
        fixes,
        rescoredAfter: s.rescored,
      })
    )
  )

export const siteInputs: fc.Arbitrary<SiteInput[]> = fc.uniqueArray(siteInput, { maxLength: 3, selector: (s) => s.name })


