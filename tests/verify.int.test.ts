import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import { runCli } from '../src/cli.js'
import { fixRecordSchema } from '../src/pure/fix-record.js'
import { historySchema } from '../src/io/history.js'
import { integrationGate, makeIntRepo } from './helpers/int.js'

const gate = integrationGate()
const repo = gate.skip ? undefined : makeIntRepo(['patrol.yaml', 'demo/cursed-shop-copy', 'demo/bad-fix', 'tests/fixtures/correct-fix'])
afterAll(() => repo?.cleanup())

const PATROL = '20260101T000000Z'

describe.skipIf(gate.skip)('verify against the real THE UNSEEN server', () => {
  test('the bad fix exits 3 with a new-haunting reason naming Veiled; the correct fix exits 0', async () => {
    const { ctx, root, err } = repo!
    expect(await runCli(['audit', '--site', 'cursed-shop', '--patrol-id', PATROL], ctx), err.join('\n')).toBe(0)
    const history = historySchema.parse(JSON.parse(readFileSync(path.join(root, '.night-shift', 'history', 'cursed-shop', `${PATROL}.json`), 'utf8')))
    const planted = history.pages.flatMap((p) => p.hauntings).find((h) => h.htmlSnippet.includes('subscribe-sparkle'))
    expect(planted?.type).toBe('NamelessSpirit')
    const id = planted!.id

    const rejected = await runCli(['verify', 'cursed-shop', 'demo/bad-fix', '--haunting', id, '--patrol-id', PATROL, '--recorded-attempt'], ctx)
    expect(rejected, err.join('\n')).toBe(3)
    const recordFile = path.join(root, '.night-shift', 'fixes', PATROL, `${id}.json`)
    const bad = fixRecordSchema.parse(JSON.parse(readFileSync(recordFile, 'utf8')))
    expect(bad.decision).toBe('reject')
    expect(bad.origin).toBe('recorded-attempt')
    expect(bad.reasons.some((r) => r.code === 'new-haunting' && /Veiled/.test(r.message))).toBe(true)
    expect(existsSync(path.join(root, 'demo', 'cursed-shop-fixed'))).toBe(false)

    const kept = await runCli(['verify', 'cursed-shop', 'tests/fixtures/correct-fix', '--haunting', id, '--patrol-id', PATROL, '--apply'], ctx)
    expect(kept, err.join('\n')).toBe(0)
    const good = fixRecordSchema.parse(JSON.parse(readFileSync(recordFile, 'utf8')))
    expect(good).toMatchObject({ decision: 'keep', attempt: 2, applied: true, reasons: [] })
    expect(good.previousAttempts[0]?.decision).toBe('reject')
    expect(readFileSync(path.join(root, 'demo', 'cursed-shop-fixed', 'index.html'), 'utf8')).toContain('aria-label="Jump to the collection"')
  })
})
