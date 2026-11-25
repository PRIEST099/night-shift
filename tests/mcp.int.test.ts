import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterAll, describe, expect, test } from 'vitest'
import { createNightShiftServer } from '../src/commands/mcp.js'
import { integrationGate, makeIntRepo, repoRoot } from './helpers/int.js'

const gate = integrationGate()
const repo = gate.skip ? undefined : makeIntRepo(['patrol.yaml', 'demo/cursed-shop-copy'])
afterAll(() => repo?.cleanup())

const PATROL = '20260102T000000Z'

describe.skipIf(gate.skip)('the Night Shift MCP tools against the real THE UNSEEN server', () => {
  test('audit, diff, workdir, write_fix_file, verify (reject then keep) and report, as the crew calls them', async () => {
    const { root, ctx } = repo!
    const server = createNightShiftServer({ env: ctx.env, cwd: root })
    const [a, b] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'int', version: '0.0.0' })
    await Promise.all([server.connect(a), client.connect(b)])
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const r = (await client.callTool({ name, arguments: { home: root, ...args } })) as { isError?: boolean; content: { text: string }[] }
      return { isError: r.isError === true, body: JSON.parse(r.content[0]!.text) as Record<string, any> }
    }
    try {
      expect((await call('validate')).body.ok).toBe(true)
      const audit = await call('audit', { site: 'cursed-shop', patrolId: PATROL })
      expect(audit.isError, JSON.stringify(audit.body)).toBe(false)
      const diff = await call('diff', { site: 'cursed-shop', patrolId: PATROL })
      const planted = (diff.body.new as { id: string; htmlSnippet: string }[]).find((h) => h.htmlSnippet.includes('subscribe-sparkle'))
      expect(planted).toBeDefined()
      const id = planted!.id

      const first = (await call('workdir', { site: 'cursed-shop', hauntingId: id, patrolId: PATROL })).body.workdir as string
      // index.html is larger than one read_source reply, so look for the region first.
      expect((await call('find_in_source', { site: 'cursed-shop', workdir: first, path: 'index.html', query: 'subscribe-sparkle' })).body.totalMatches).toBeGreaterThanOrEqual(1)
      const bad = readFileSync(path.join(repoRoot, 'demo', 'bad-fix', 'index.html'), 'utf8')
      await call('write_fix_file', { workdir: first, path: 'index.html', content: bad })
      const rejected = await call('verify', { site: 'cursed-shop', workdir: first, hauntingId: id, apply: true })
      expect(rejected.isError).toBe(false)
      expect(rejected.body).toMatchObject({ code: 3, decision: 'reject' })
      expect(rejected.body.record.reasons.some((r: { code: string; message: string }) => r.code === 'new-haunting' && /Veiled/.test(r.message))).toBe(true)
      expect(existsSync(path.join(root, 'demo', 'cursed-shop-fixed'))).toBe(false)

      const second = (await call('workdir', { site: 'cursed-shop', hauntingId: id, patrolId: PATROL, attempt: 2 })).body.workdir as string
      const good = readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'correct-fix', 'index.html'), 'utf8')
      await call('write_fix_file', { workdir: second, path: 'index.html', content: good })
      const kept = await call('verify', { site: 'cursed-shop', workdir: second, hauntingId: id, apply: true })
      expect(kept.body).toMatchObject({ code: 0, decision: 'keep', record: { attempt: 2, applied: true } })

      const report = await call('report', { patrolId: PATROL })
      expect(report.isError, JSON.stringify(report.body)).toBe(false)
      expect(report.body.sites[0].fixes).toMatchObject([{ hauntingId: id, decision: 'kept', attempts: 2 }])
      expect(existsSync(path.join(root, 'REPORT.md'))).toBe(true)
      expect(existsSync(path.join(root, 'report.json'))).toBe(true)
    } finally {
      await client.close()
    }
  })
})
