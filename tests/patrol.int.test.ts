import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { runCli } from '../src/cli.js'
import { reportSchema } from '../src/pure/report.js'
import { historySchema } from '../src/io/history.js'
import { integrationGate, makeIntRepo } from './helpers/int.js'

const gate = integrationGate()
const repo = gate.skip ? undefined : makeIntRepo(['patrol.yaml', 'demo/cursed-shop-copy'])
afterAll(() => repo?.cleanup())

describe.skipIf(gate.skip)('patrol --no-agents against the served demo copy (real THE UNSEEN server)', () => {
  test('exits 0, writes a valid report with at least one Wraith', async () => {
    const { ctx, root, err } = repo!
    const code = await runCli(['patrol', '--no-agents'], ctx)
    expect(code, err.join('\n')).toBe(0)

    const report = reportSchema.parse(JSON.parse(readFileSync(path.join(root, 'report.json'), 'utf8')))
    expect(report.sites).toHaveLength(1)
    const site = report.sites[0]!
    expect(site.name).toBe('cursed-shop')
    expect(site.newCount).toBeGreaterThan(0)
    expect(site.notAttempted.some((n) => n.severity === 'Wraith')).toBe(true)
    expect(site.fixes).toEqual([])

    const md = readFileSync(path.join(root, 'REPORT.md'), 'utf8')
    expect(md).toContain(`patrol ${report.patrolId}`)
    expect(md).toContain('(Wraith)')

    const history = historySchema.parse(JSON.parse(readFileSync(path.join(root, '.night-shift', 'history', 'cursed-shop', `${report.patrolId}.json`), 'utf8')))
    expect(history.pages.map((p) => p.page)).toEqual(['/index.html', '/product.html', '/checkout.html'])
    expect(history.pages.every((p) => p.error === undefined)).toBe(true)
    const all = history.pages.flatMap((p) => p.hauntings)
    expect(all.some((h) => h.severity === 'Wraith')).toBe(true)
    expect(all.some((h) => h.htmlSnippet.includes('subscribe-sparkle') && h.type === 'NamelessSpirit' && h.severity === 'Wraith')).toBe(true)
  })
})
