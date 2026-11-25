import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterAll, describe, expect, test } from 'vitest'
import { createNightShiftServer, MAX_READ_CHARS } from '../src/commands/mcp.js'
import { fixRecordSchema } from '../src/pure/fix-record.js'
import { applyRegression, REGRESSION_FILE } from '../src/pure/demo-regress.js'
import { integrationGate, makeIntRepo } from './helpers/int.js'

const gate = integrationGate()
const repo = gate.skip ? undefined : makeIntRepo(['patrol.yaml', 'demo/cursed-shop-copy'])
afterAll(() => repo?.cleanup())

const BASELINE = '20260101T000000Z'
const AFTER = '20260102T000000Z'
const SITE = 'cursed-shop'
// Inert filler that makes the page larger than the Scribe's 30,000 character reply limit, as in the 21:10 run (33,444).
const FILLER = `<!-- ${'Hand-made candles, poured at night. '.repeat(120)} -->\n`

describe.skipIf(gate.skip)('the 21:10 case: a page larger than 30,000 characters, fixed with targeted tools', () => {
  test('find_in_source, ranged read_source, edit_fix_file and verify keep the aria-label fix', async () => {
    const { root, ctx } = repo!
    const page = path.join(root, 'demo', 'cursed-shop-copy', REGRESSION_FILE)
    const server = createNightShiftServer({ env: ctx.env, cwd: root })
    const [a, b] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'int', version: '0.0.0' })
    await Promise.all([server.connect(a), client.connect(b)])
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const r = (await client.callTool({ name, arguments: { home: root, ...args } })) as { isError?: boolean; content: { text: string }[] }
      return { isError: r.isError === true, body: JSON.parse(r.content[0]!.text) as Record<string, any> }
    }
    try {
      // The baseline patrol, then the change someone shipped.
      // The working copy may already carry the regression (a demo run leaves it there). Start from the page without it.
      const original = readFileSync(page, 'utf8').replace(/\r?\n\s*<!-- Shipped today:[\s\S]*?buy-now-btn[\s\S]*?<\/button>/, '')
      expect(original).not.toContain('buy-now-btn')
      writeFileSync(page, original.replace('<body>', `<body>\n${FILLER}`), 'utf8')
      expect((await call('audit', { site: SITE, patrolId: BASELINE })).isError).toBe(false)
      writeFileSync(page, applyRegression(readFileSync(page, 'utf8')).html, 'utf8')
      expect(readFileSync(page, 'utf8').length).toBeGreaterThan(33_000)
      expect((await call('audit', { site: SITE, patrolId: AFTER })).isError).toBe(false)

      const diff = await call('diff', { site: SITE, patrolId: AFTER })
      const added = diff.body.new as { id: string; type: string; severity: string; htmlSnippet: string }[]
      expect(added).toHaveLength(1)
      expect(added[0]).toMatchObject({ type: 'NamelessSpirit', severity: 'Wraith' })
      const haunting = added[0]!

      const workdir = (await call('workdir', { site: SITE, hauntingId: haunting.id, patrolId: AFTER })).body.workdir as string

      // A whole-page read no longer overflows a 30,000 character reply: it is cut and says where to continue.
      const whole = await call('read_source', { site: SITE, workdir, path: REGRESSION_FILE })
      expect(whole.body.truncated).toBe(true)
      expect(whole.body.content.length).toBeLessThanOrEqual(MAX_READ_CHARS)
      expect(JSON.stringify(whole.body).length).toBeLessThan(30_000)

      const found = await call('find_in_source', { site: SITE, workdir, path: REGRESSION_FILE, query: haunting.htmlSnippet })
      expect(found.isError, JSON.stringify(found.body)).toBe(false)
      expect(found.body.totalMatches, JSON.stringify(haunting)).toBeGreaterThanOrEqual(1)
      const line = found.body.matches[0].line as number

      const region = await call('read_source', { site: SITE, workdir, path: REGRESSION_FILE, startLine: Math.max(1, line - 2), endLine: line + 8 })
      expect(region.body.content).toContain('buy-now-btn')
      expect(JSON.stringify(region.body).length).toBeLessThan(30_000)

      const edit = await call('edit_fix_file', { workdir, path: REGRESSION_FILE, oldText: 'class="wishlist-btn buy-now-btn"', newText: 'class="wishlist-btn buy-now-btn" aria-label="Buy now"' })
      expect(edit.isError, JSON.stringify(edit.body)).toBe(false)
      expect(edit.body.line).toBeGreaterThanOrEqual(line - 2)

      // The edit touched only the work directory.
      expect(readFileSync(page, 'utf8')).not.toContain('aria-label="Buy now"')
      const kept = await call('verify', { site: SITE, workdir, hauntingId: haunting.id, apply: true })
      expect(kept.body, JSON.stringify(kept.body.errors)).toMatchObject({ code: 0, decision: 'keep' })
      const record = fixRecordSchema.parse(JSON.parse(readFileSync(path.join(root, '.night-shift', 'fixes', AFTER, `${haunting.id}.json`), 'utf8')))
      expect(record.decision).toBe('keep')
      expect(existsSync(path.join(root, 'demo', 'cursed-shop-fixed', REGRESSION_FILE))).toBe(true)
    } finally {
      await client.close()
    }
  })
})