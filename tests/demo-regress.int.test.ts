import { cpSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { runCli } from '../src/cli.js'
import { historySchema } from '../src/io/history.js'
import { fixRecordSchema } from '../src/pure/fix-record.js'
import { applyRegression, REGRESSION_FILE } from '../src/pure/demo-regress.js'
import { integrationGate, makeIntRepo } from './helpers/int.js'

const gate = integrationGate()
const repo = gate.skip ? undefined : makeIntRepo(['patrol.yaml', 'demo/cursed-shop-copy'])
afterAll(() => repo?.cleanup())

const BASELINE = '20260101T000000Z'
const AFTER = '20260102T000000Z'
const BUTTON = '<button class="wishlist-btn buy-now-btn"'

describe.skipIf(gate.skip)('demo:regress against the real THE UNSEEN server', () => {
  test('diff reports exactly one new Wraith Nameless Spirit; aria-hidden is rejected and aria-label is kept', async () => {
    const { ctx, root, out, err } = repo!
    const page = path.join(root, 'demo', 'cursed-shop-copy', REGRESSION_FILE)

    // The working copy may already carry the regression (a demo run leaves it there). Start from the page without it.
    writeFileSync(page, readFileSync(page, 'utf8').replace(/\r?\n\s*<!-- Shipped today:[\s\S]*?buy-now-btn[\s\S]*?<\/button>/, ''), 'utf8')

    expect(await runCli(['audit', '--site', 'cursed-shop', '--patrol-id', BASELINE], ctx), err.join('\n')).toBe(0)

    const regressed = applyRegression(readFileSync(page, 'utf8'))
    expect(regressed.changed).toBe(true)
    writeFileSync(page, regressed.html, 'utf8')

    expect(await runCli(['audit', '--site', 'cursed-shop', '--patrol-id', AFTER], ctx), err.join('\n')).toBe(0)
    out.length = 0
    expect(await runCli(['diff', '--site', 'cursed-shop', '--json'], ctx), err.join('\n')).toBe(0)
    const diff = JSON.parse(out.join('\n')) as { previousPatrolId: string; new: Array<{ id: string; type: string; severity: string; page: string; htmlSnippet: string }>; worsened: unknown[]; workList: unknown[] }
    expect(diff.previousPatrolId).toBe(BASELINE)
    expect(diff.new).toHaveLength(1)
    expect(diff.new[0]).toMatchObject({ type: 'NamelessSpirit', severity: 'Wraith', page: '/product.html' })
    expect(diff.new[0]!.htmlSnippet).toContain('buy-now-btn')
    expect(diff.worsened).toHaveLength(0)
    expect(diff.workList).toHaveLength(1)
    const id = diff.new[0]!.id

    // Both fixes are written into copies of the regressed site.
    for (const name of ['fix-hidden', 'fix-label']) cpSync(path.join(root, 'demo', 'cursed-shop-copy'), path.join(root, 'demo', name), { recursive: true })
    const edit = (dir: string, attr: string): void => {
      const f = path.join(root, 'demo', dir, REGRESSION_FILE)
      const html = readFileSync(f, 'utf8')
      expect(html).toContain(BUTTON)
      writeFileSync(f, html.replace(BUTTON, `${BUTTON} ${attr}`), 'utf8')
    }
    edit('fix-hidden', 'aria-hidden="true"')
    edit('fix-label', 'aria-label="Buy now"')

    const rejected = await runCli(['verify', 'cursed-shop', 'demo/fix-hidden', '--haunting', id, '--patrol-id', AFTER], ctx)
    expect(rejected, err.join('\n')).toBe(3)
    const recordFile = path.join(root, '.night-shift', 'fixes', AFTER, `${id}.json`)
    const bad = fixRecordSchema.parse(JSON.parse(readFileSync(recordFile, 'utf8')))
    expect(bad.decision).toBe('reject')
    expect(bad.reasons.some((r) => r.code === 'new-haunting' && /Veiled/.test(r.message))).toBe(true)

    const kept = await runCli(['verify', 'cursed-shop', 'demo/fix-label', '--haunting', id, '--patrol-id', AFTER], ctx)
    expect(kept, err.join('\n')).toBe(0)
    expect(fixRecordSchema.parse(JSON.parse(readFileSync(recordFile, 'utf8'))).decision).toBe('keep')

    // The history file is valid, so a later patrol can use it as a baseline.
    historySchema.parse(JSON.parse(readFileSync(path.join(root, '.night-shift', 'history', 'cursed-shop', `${AFTER}.json`), 'utf8')))
  })
})
