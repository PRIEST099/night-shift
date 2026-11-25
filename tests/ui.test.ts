import { readFileSync } from 'node:fs'
import path from 'node:path'
import fc from 'fast-check'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { buildReport, reportSchema } from '../src/pure/report.js'
import type { Report } from '../src/pure/report.js'
import { ReportView } from '../ui/src/render.js'
import { loadReport } from '../ui/src/load-report.js'
import { appSchema, readJson, root } from './helpers/manifest.js'
import { siteInputs } from './arbitraries/report.js'

const view = (report: Report | undefined): string => renderToStaticMarkup(createElement(ReportView, { report }))
const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const count = (html: string, re: RegExp): number => (html.match(re) ?? []).length

describe('P10 dashboard view', () => {
  test('P10 one h1, a caption per table, th scope, escaped reasons, for any report', () => {
    fc.assert(
      fc.property(siteInputs, (inputs) => {
        const report = reportSchema.parse(buildReport('p1', '2026-01-01T00:00:00.000Z', inputs))
        const html = view(report)
        expect(count(html, /<h1[\s>]/g)).toBe(1)
        expect(count(html, /<main[\s>]/g)).toBe(1)
        expect(count(html, /<table[\s>]/g)).toBe(count(html, /<caption[\s>]/g))
        expect(count(html, /<table[\s>]/g)).toBe(report.sites.length)
        for (const th of html.match(/<th[\s>][^>]*>/g) ?? []) expect(th).toContain('scope="col"')
        expect(html).not.toMatch(/<script/i)
        for (const s of report.sites) {
          expect(html).toContain(escapeHtml(s.name))
          for (const f of s.fixes) {
            for (const r of f.reasons) expect(html).toContain(escapeHtml(r))
            for (const a of f.earlierAttempts) for (const r of a.reasons) expect(html).toContain(escapeHtml(r))
            expect(html).toContain(f.decision === 'kept' ? 'Kept' : 'Rejected')
          }
        }
      }),
      { numRuns: 150 }
    )
  })

  test('reasons containing markup are escaped, never rendered as HTML', () => {
    const report = reportSchema.parse(
      buildReport('p1', 'now', [
        {
          name: 's', owner: 'o', maxFixesPerSite: 5, current: undefined, previous: undefined,
          fixes: [{
            schemaVersion: 1, patrolId: 'p1', site: 's', hauntingId: 'h', fingerprint: 'f', page: '/', type: 'T', severity: 'Wraith', decision: 'reject',
            reasons: [{ code: 'new-haunting', message: '<img src=x onerror=alert(1)> & "q"' }], scoreBefore: {}, scoreAfter: {}, changedFiles: [], attempt: 1,
            origin: 'crew', applied: false, verifiedAt: 'x', previousAttempts: [],
          }],
        },
      ])
    )
    const html = view(report)
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;')
  })

  test('outcome is stated in text and the icons are hidden from assistive technology', () => {
    const html = view(loadReport())
    expect(html).toContain('Kept')
    expect(html).toContain('Rejected')
    for (const svg of html.match(/<svg[^>]*>/g) ?? []) expect(svg).toContain('aria-hidden="true"')
  })

  test('empty state says how to run a patrol and still has one h1', () => {
    const html = view(undefined)
    expect(count(html, /<h1[\s>]/g)).toBe(1)
    expect(html).toContain('night-shift patrol --no-agents')
    expect(html).toContain('night-shift report --publish-ui')
    expect(count(html, /<table[\s>]/g)).toBe(0)
  })

  test('a report with no sites renders without a table', () => {
    const html = view(reportSchema.parse(buildReport('p1', 'now', [])))
    expect(html).toContain('No sites were patrolled.')
  })

  test('the document it renders into gets a language', () => {
    expect(view(undefined)).toMatch(/<main[^>]* lang="en"/)
  })
})

describe('dashboard data and bundle', () => {
  test('ui/src/last-report.json is a valid copy of the sample report', () => {
    const last = reportSchema.parse(readJson('ui/src/last-report.json'))
    expect(last).toEqual(reportSchema.parse(readJson('docs/sample-report/report.json')))
    expect(loadReport()).toEqual(last)
  })

  test('app.json ui entry and page match Requirement 11.1', () => {
    const app = appSchema.parse(readJson('app.json'))
    expect(app.ui?.entry).toBe('dist/index.mjs')
    expect(app.ui?.pages).toHaveLength(1)
    expect(app.ui?.pages[0]).toMatchObject({ route: '/apps/night-shift', label: 'Morning report' })
    expect(typeof app.ui?.pages[0]?.['icon']).toBe('string')
  })

  test('the built bundle imports the SDK and only the externals; react is not bundled', () => {
    const js = readFileSync(path.join(root, 'ui', 'dist', 'index.mjs'), 'utf8')
    const specifiers = [...js.matchAll(/^import\s[^;]*?from\s*"([^"]+)"/gm)].map((m) => m[1]!)
    expect(specifiers).toContain('@kirocrew/app-sdk')
    expect(specifiers).toContain('react/jsx-runtime')
    const allowed = new Set(['react', 'react-dom', 'react/jsx-runtime', 'lucide-react', '@kirocrew/app-sdk', '@kirocrew/app-sdk/ui'])
    for (const s of specifiers) expect(allowed.has(s), s).toBe(true)
    expect(js).not.toMatch(/__SECRET_INTERNALS_DO_NOT_USE|ReactCurrentOwner|react\.production|react-dom\.production/)
  })
})
