import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import fc from 'fast-check'
import { afterEach, describe, expect, test } from 'vitest'
import { runCli } from '../src/cli.js'
import type { Ctx } from '../src/commands/ctx.js'
import type { AuditPage } from '../src/io/mcp-client.js'
import { renderReport } from '../src/pure/render-report.js'
import { buildReport, reportSchema, round1 } from '../src/pure/report.js'
import type { Report } from '../src/pure/report.js'
import { siteInputs } from './arbitraries/report.js'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('P10 report', () => {
  test('P10 report.json validates, scoreChange is exact, every fix appears once, Markdown mentions every reason and site', () => {
    fc.assert(
      fc.property(siteInputs, (inputs) => {
        const report = buildReport('p1', '2026-01-01T00:00:00.000Z', inputs)
        expect(reportSchema.safeParse(report).success).toBe(true)
        report.sites.forEach((s, i) => {
          expect(s.scoreChange).toBe(round1(s.scoreAfter - s.scoreBefore))
          const records = inputs[i]!.fixes
          expect(s.fixes.map((f) => f.hauntingId)).toEqual(records.map((r) => r.hauntingId))
          expect(new Set(s.fixes.map((f) => f.hauntingId)).size).toBe(s.fixes.length)
          s.fixes.forEach((f, j) => expect(f.decision).toBe(records[j]!.decision === 'keep' ? 'kept' : 'rejected'))
          const attempted = new Set(s.fixes.map((f) => f.hauntingId))
          expect(s.notAttempted.every((n) => !attempted.has(n.hauntingId))).toBe(true)
        })
        const md = renderReport(report)
        expect(md).toContain('p1')
        for (const s of report.sites) {
          expect(md).toContain(s.name)
          for (const f of s.fixes) {
            for (const r of f.reasons) expect(md).toContain(r)
            for (const a of f.earlierAttempts) for (const r of a.reasons) expect(md).toContain(r)
          }
        }
        expect(renderReport(report)).toBe(md)
      }),
      { numRuns: 150 }
    )
  })

  test('valid for a patrol with no changes, all sites failing, and only rejections', () => {
    const failing = { schemaVersion: 1 as const, site: 'a', patrolId: 'p1', startedAt: 'x', pages: [{ page: '/', url: 'u', score: 0, hauntings: [], error: 'boom' }] }
    const empty = { ...failing, pages: [{ page: '/', url: 'u', score: 3, hauntings: [] }] }
    for (const sites of [
      [],
      [{ name: 'a', owner: '', maxFixesPerSite: 5, current: undefined, previous: undefined, fixes: [] }],
      [{ name: 'a', owner: 'o', maxFixesPerSite: 5, current: failing, previous: undefined, fixes: [] }],
      [{ name: 'a', owner: 'o', maxFixesPerSite: 5, current: empty, previous: empty, fixes: [] }],
    ]) {
      const r = buildReport('p1', 'now', sites)
      expect(reportSchema.safeParse(r).success).toBe(true)
      expect(renderReport(r)).toContain('# Night Shift morning report: patrol p1')
    }
  })

  test('reasons with newlines are collapsed to one line in report.json', () => {
    const rec = {
      schemaVersion: 1 as const, patrolId: 'p1', site: 'a', hauntingId: 'x', fingerprint: 'f', page: '/', type: 'T', severity: 'Wraith' as const,
      decision: 'reject' as const, reasons: [{ code: 'new-haunting' as const, message: 'line one\n  line two' }], scoreBefore: {}, scoreAfter: {},
      changedFiles: [], attempt: 1, origin: 'crew' as const, applied: false, verifiedAt: 'x', previousAttempts: [],
    }
    const r = buildReport('p1', 'now', [{ name: 'a', owner: 'o', maxFixesPerSite: 5, current: undefined, previous: undefined, fixes: [rec] }])
    expect(r.sites[0]!.fixes[0]!.reasons).toEqual(['line one line two'])
  })
})

describe('REPORT.md snapshot', () => {
  const report: Report = {
    schemaVersion: 1,
    patrolId: '20260101T020000Z',
    generatedAt: '2026-01-01T02:05:00.000Z',
    sites: [
      {
        name: 'cursed-shop',
        owner: 'demo-team',
        scoreBefore: 60.5,
        scoreAfter: 52,
        scoreChange: -8.5,
        newCount: 7,
        worsenedCount: 0,
        resolvedCount: 0,
        fixes: [
          { hauntingId: 'index-html-NamelessSpirit-1a2b3c4d', type: 'NamelessSpirit', severity: 'Wraith', page: '/index.html', decision: 'kept', reasons: [], attempts: 1, changedFiles: ['index.html'], origin: 'crew', earlierAttempts: [] },
          {
            hauntingId: 'index-html-NamelessSpirit-9f8e7d6c', type: 'NamelessSpirit', severity: 'Wraith', page: '/index.html', decision: 'rejected',
            reasons: ['new-haunting: TheVeiled appeared on /index.html (0 before, 1 after)'], attempts: 2, changedFiles: ['index.html'], origin: 'recorded-attempt',
            earlierAttempts: [{ attempt: 1, decision: 'rejected', reasons: ['unsafe-change: index.html adds a <script> element'] }],
          },
        ],
        notAttempted: [{ hauntingId: 'product-html-TheFog-00112233', type: 'TheFog', severity: 'Banished', page: '/product.html', why: 'Banished severity' }],
        errors: ['/checkout.html: TIMEOUT'],
      },
    ],
  }

  test('renders the documented sections', () => {
    expect(renderReport(report)).toBe(`# Night Shift morning report: patrol 20260101T020000Z

Generated 2026-01-01T02:05:00.000Z. Lower scores are better.

## cursed-shop (owner: demo-team)

| Score before | Score after | Change |
| --- | --- | --- |
| 60.5 | 52.0 | -8.5 |

New hauntings: 7. Worsened: 0. Resolved: 0.

### Kept fixes

- \`index-html-NamelessSpirit-1a2b3c4d\`: NamelessSpirit (Wraith) on /index.html, 1 attempt. Changed: index.html.

### Rejected fixes

- \`index-html-NamelessSpirit-9f8e7d6c\`: NamelessSpirit (Wraith) on /index.html, 2 attempts. **Recorded attempt, not an agent run.** Changed: index.html.
  - Attempt 1 rejected: unsafe-change: index.html adds a <script> element
  - Reason: new-haunting: TheVeiled appeared on /index.html (0 before, 1 after)

### Not attempted

- \`product-html-TheFog-00112233\`: TheFog (Banished) on /product.html. Banished severity.

### Errors

- /checkout.html: TIMEOUT
`)
  })
})

describe('REPORT.md length', () => {
  test('a rejection that was later replaced by a kept attempt still appears under Rejected fixes', () => {
    const fix = {
      hauntingId: 'x-1', type: 'NamelessSpirit', severity: 'Wraith' as const, page: '/a', decision: 'kept' as const, reasons: [], attempts: 2,
      changedFiles: ['a.html'], origin: 'recorded-attempt' as const,
      earlierAttempts: [{ attempt: 1, decision: 'rejected' as const, reasons: ['new-haunting: TheVeiled on /a'] }],
    }
    const md = renderReport({ schemaVersion: 1, patrolId: 'p', generatedAt: 'g', sites: [{ name: 's', owner: 'o', scoreBefore: 1, scoreAfter: 1, scoreChange: 0, newCount: 1, worsenedCount: 0, resolvedCount: 0, fixes: [fix], notAttempted: [], errors: [] }] })
    const rejectedSection = md.split('### Rejected fixes')[1]!.split('### Not attempted')[0]!
    expect(rejectedSection).toContain('attempt 1 was rejected, then a later attempt was kept')
    expect(rejectedSection).toContain('Reason: new-haunting: TheVeiled on /a')
    expect(rejectedSection).toContain('Recorded attempt, not an agent run.')
    expect(md.split('### Kept fixes')[1]!.split('### Rejected fixes')[0]).not.toContain('TheVeiled')
  })

  test('the Not attempted list is cut at 10 entries and says how many more are in report.json', () => {
    const na = Array.from({ length: 13 }, (_, i) => ({ hauntingId: `h${i}`, type: 'LostSoul', severity: 'Restless' as const, page: '/a', why: 'beyond maxFixesPerSite (5)' }))
    const md = renderReport({ schemaVersion: 1, patrolId: 'p', generatedAt: 'g', sites: [{ name: 's', owner: 'o', scoreBefore: 1, scoreAfter: 1, scoreChange: 0, newCount: 13, worsenedCount: 0, resolvedCount: 0, fixes: [], notAttempted: na, errors: [] }] })
    expect(md).toContain('h9')
    expect(md).not.toContain('h10')
    expect(md).toContain('...and 3 more, listed in report.json.')
  })
})

describe('CLI', () => {
  function run(argv: string[], cwd?: string, deps = {}) {
    const out: string[] = []
    const err: string[] = []
    const dir = cwd ?? mkdtempSync(path.join(tmpdir(), 'ns-cli-'))
    if (!cwd) dirs.push(dir)
    const ctx: Ctx = { cwd: dir, env: {}, log: (m) => out.push(m), error: (m) => err.push(m) }
    return runCli(argv, ctx, deps).then((code) => ({ code, out, err, dir }))
  }

  test('validate: 1 without a file, 0 with the starter file', async () => {
    expect((await run(['validate'])).code).toBe(1)
    const r = await run(['validate'], process.cwd())
    expect(r.code).toBe(0)
    expect(r.out[0]).toMatch(/^patrol\.yaml: ok/)
  })

  test('patrol without --no-agents exits 2 and names Crew', async () => {
    const r = await run(['patrol'])
    expect(r.code).toBe(2)
    expect(r.err.join()).toMatch(/Warden/)
  })

  test('patrol --open-prs exits 2 and says future work', async () => {
    const r = await run(['patrol', '--no-agents', '--open-prs'])
    expect(r.code).toBe(2)
    expect(r.err.join()).toMatch(/future work/)
  })

  test('unknown command and unknown flag exit 1', async () => {
    expect((await run(['bogus'])).code).toBe(1)
    expect((await run(['validate', '--bogus'])).code).toBe(1)
    expect((await run([])).code).toBe(1)
  })

  test('patrol --no-agents with a missing audit engine exits 1 and names the variable', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ns-cli-'))
    dirs.push(dir)
    writeFileSync(path.join(dir, 'patrol.yaml'), 'version: 1\nsites:\n  - {name: a, owner: o, pages: [/], baseUrl: "http://127.0.0.1:9"}\n')
    const r = await run(['patrol', '--no-agents'], dir)
    expect(r.code).toBe(1)
    expect(r.err.join()).toContain('UNSEEN_MCP_SERVER_JS')
  })

  test('patrol --no-agents with a fake engine exits 0 even with hauntings, and writes both reports', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ns-cli-'))
    dirs.push(dir)
    mkdirSync(path.join(dir, 'site'))
    writeFileSync(path.join(dir, 'site', 'index.html'), '<h1>x</h1>')
    writeFileSync(path.join(dir, 'patrol.yaml'), 'version: 1\nsites:\n  - {name: a, owner: o, pages: [/index.html], serve: {dir: site}, source: site}\n')
    const audit: AuditPage = async () => ({
      score: 20,
      hauntings: [{ id: 'x', type: 'NamelessSpirit', kind: '', severity: 'Wraith', selector: 'a', htmlSnippet: '<a></a>', wcag: [] }],
    })
    const r = await run(['patrol', '--no-agents', '--publish-ui'], dir, { openAudit: async () => ({ audit, close: async () => undefined }) })
    expect(r.code).toBe(0)
    const report = reportSchema.parse(JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8')))
    expect(report.sites[0]!.newCount).toBe(1)
    expect(report.sites[0]!.notAttempted).toHaveLength(1)
    expect(readFileSync(path.join(dir, 'REPORT.md'), 'utf8')).toContain('# Night Shift morning report: patrol')
    expect(existsSync(path.join(dir, 'ui', 'src', 'last-report.json'))).toBe(true)
  })

  test('report without any history exits 1', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'ns-cli-'))
    dirs.push(dir)
    writeFileSync(path.join(dir, 'patrol.yaml'), 'version: 1\nsites:\n  - {name: a, owner: o, pages: [/], baseUrl: "http://127.0.0.1:9"}\n')
    expect((await run(['report'], dir)).code).toBe(1)
  })
})


