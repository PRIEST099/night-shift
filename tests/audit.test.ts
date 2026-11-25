import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import http from 'node:http'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { runAudit } from '../src/commands/audit.js'
import { runDiff } from '../src/commands/diff.js'
import type { Ctx } from '../src/commands/ctx.js'
import { readCurrentHistory, readHistory, readPreviousHistory, writeHistory, historyPath } from '../src/io/history.js'
import { parseAuditResult, MCP_DEFAULT_PATH, MCP_ENV_VAR } from '../src/io/mcp-client.js'
import type { AuditPage } from '../src/io/mcp-client.js'
import { startStaticServer } from '../src/io/static-server.js'
import type { HistoryFile } from '../src/pure/types.js'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function tmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'ns-1-4-'))
  dirs.push(d)
  return d
}

function mkCtx(cwd: string, env: NodeJS.ProcessEnv = {}) {
  const out: string[] = []
  const err: string[] = []
  const ctx: Ctx = { cwd, env, log: (m) => out.push(m), error: (m) => err.push(m) }
  return { ctx, out, err }
}

function get(port: number, rawPath: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: rawPath, method: 'GET' }, (res) => {
      let body = ''
      res.on('data', (c: Buffer) => (body += c.toString()))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

describe('static server', () => {
  test('serves files, refuses path traversal, binds to loopback, closes', async () => {
    const root = tmp()
    mkdirSync(path.join(root, 'site'))
    writeFileSync(path.join(root, 'site', 'index.html'), '<h1>hi</h1>')
    writeFileSync(path.join(root, 'patrol.yaml'), 'secret: true')
    const server = await startStaticServer(path.join(root, 'site'))
    try {
      expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
      expect((await get(server.port, '/index.html')).body).toBe('<h1>hi</h1>')
      expect((await get(server.port, '/')).body).toBe('<h1>hi</h1>')
      for (const p of ['/../patrol.yaml', '/%2e%2e/patrol.yaml', '/..%2fpatrol.yaml', '/a/../../patrol.yaml', '/%00']) {
        const r = await get(server.port, p)
        expect(r.status, p).not.toBe(200)
        expect(r.body, p).not.toContain('secret')
      }
      expect((await get(server.port, '/missing')).status).toBe(404)
    } finally {
      await server.close()
    }
    await expect(get(server.port, '/')).rejects.toBeTruthy()
  })
})

describe('history', () => {
  const sample = (patrolId: string): HistoryFile => ({ schemaVersion: 1, site: 's', patrolId, startedAt: 'x', pages: [] })

  test('write is atomic: no temp files remain and the file parses', () => {
    const root = tmp()
    const file = writeHistory(root, sample('20260101T000000Z'))
    expect(readdirSync(path.dirname(file))).toEqual(['20260101T000000Z.json'])
    expect(readHistory(file, () => undefined)?.patrolId).toBe('20260101T000000Z')
  })

  test('a corrupt file is skipped with a warning when finding the previous patrol', () => {
    const root = tmp()
    writeHistory(root, sample('20260101T000000Z'))
    writeHistory(root, sample('20260102T000000Z'))
    writeFileSync(historyPath(root, 's', '20260103T000000Z'), '{ not json')
    const warnings: string[] = []
    const prev = readPreviousHistory(root, 's', '20260104T000000Z', (m) => warnings.push(m))
    expect(prev?.patrolId).toBe('20260102T000000Z')
    expect(warnings.join()).toMatch(/corrupt/)
  })

  test('named patrol ids never become the latest or previous patrol', () => {
    const root = tmp()
    writeHistory(root, sample('20260101T000000Z'))
    writeHistory(root, sample('demo-reject'))
    expect(readPreviousHistory(root, 's', '20260102T000000Z', () => undefined)?.patrolId).toBe('20260101T000000Z')
    expect(readCurrentHistory(root, 's', undefined, () => undefined)?.patrolId).toBe('20260101T000000Z')
    expect(readCurrentHistory(root, 's', 'demo-reject', () => undefined)?.patrolId).toBe('demo-reject')
  })

  test('schema-invalid file is ignored', () => {
    const root = tmp()
    const file = historyPath(root, 's', 'a')
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify({ schemaVersion: 2 }))
    const warnings: string[] = []
    expect(readHistory(file, (m) => warnings.push(m))).toBeUndefined()
    expect(warnings).toHaveLength(1)
  })
})

describe('parseAuditResult', () => {
  test('maps the full structured result and tolerates extra fields', () => {
    const r = parseAuditResult({
      score: 12.5,
      extra: 1,
      hauntings: [{ id: 'h1', selector: 'a.x', type: 'NamelessSpirit', extra: 2 }],
      classified: {
        hauntings: [
          { id: 'h1', type: 'NamelessSpirit', severity: 'Wraith', htmlSnippet: '<a>', wcag: [{ id: '4.1.2', url: 'u' }], more: 1 },
          { id: 'h2', type: 'ShatteredOrder', kind: 'no-h1', severity: 'Restless', htmlSnippet: '', wcag: [] },
        ],
      },
    })
    expect(r).toEqual({
      score: 12.5,
      hauntings: [
        { id: 'h1', type: 'NamelessSpirit', kind: '', severity: 'Wraith', selector: 'a.x', htmlSnippet: '<a>', wcag: ['4.1.2'] },
        { id: 'h2', type: 'ShatteredOrder', kind: 'no-h1', severity: 'Restless', selector: '', htmlSnippet: '', wcag: [] },
      ],
    })
  })

  test('an unexpected shape becomes an error result, not a throw', () => {
    expect('error' in parseAuditResult({ nope: 1 })).toBe(true)
    expect('error' in parseAuditResult(null)).toBe(true)
  })

  test('env variable and default path constants', () => {
    expect(MCP_ENV_VAR).toBe('UNSEEN_MCP_SERVER_JS')
    expect(MCP_DEFAULT_PATH).toBe('../the-unseen/packages/mcp/dist/server.js')
  })
})

describe('audit command', () => {
  function repo(): string {
    const root = tmp()
    mkdirSync(path.join(root, 'site'))
    writeFileSync(path.join(root, 'site', 'index.html'), '<h1>x</h1>')
    writeFileSync(
      path.join(root, 'patrol.yaml'),
      'version: 1\nsites:\n  - name: shop\n    owner: me\n    serve: {dir: site}\n    source: site\n    pages: [/index.html, /broken.html]\n'
    )
    return root
  }

  const fake: AuditPage = async (url) => {
    if (url.endsWith('/broken.html')) return { error: 'TIMEOUT: page too slow' }
    return {
      score: 40,
      hauntings: [
        { id: 'a', type: 'NamelessSpirit', kind: '', severity: 'Wraith', selector: 'a', htmlSnippet: '<a></a>', wcag: ['4.1.2'] },
        { id: 'b', type: 'NamelessSpirit', kind: '', severity: 'Wraith', selector: 'a', htmlSnippet: '<a></a>', wcag: ['4.1.2'] },
      ],
    }
  }

  test('writes the documented shape and records a page error without stopping', async () => {
    const root = repo()
    const { ctx, err } = mkCtx(root)
    const r = await runAudit(ctx, { patrolId: '20260101T000000Z' }, { openAudit: async () => ({ audit: fake, close: async () => undefined }) })
    expect(r.code).toBe(0)
    const h = JSON.parse(readFileSync(historyPath(root, 'shop', '20260101T000000Z'), 'utf8'))
    expect(h).toMatchObject({ schemaVersion: 1, site: 'shop', patrolId: '20260101T000000Z' })
    expect(typeof h.startedAt).toBe('string')
    expect(h.pages).toHaveLength(2)
    expect(h.pages[0].url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/index\.html$/)
    expect(h.pages[0].page).toBe('/index.html')
    expect(h.pages[0].score).toBe(40)
    expect(h.pages[0].hauntings.map((x: { fingerprint: string }) => x.fingerprint)).toEqual(['NamelessSpirit||<a></a>#0', 'NamelessSpirit||<a></a>#1'])
    expect(h.pages[0].hauntings[0].id).toMatch(/^index-html-NamelessSpirit-[0-9a-f]{8}$/)
    expect(Object.keys(h.pages[0].hauntings[0]).sort()).toEqual(['fingerprint', 'htmlSnippet', 'id', 'kind', 'selector', 'severity', 'type', 'wcag'])
    expect(h.pages[1].error).toMatch(/TIMEOUT/)
    expect(h.pages[1].hauntings).toEqual([])
    expect(err.join()).toMatch(/broken\.html/)
    expect(readdirSync(path.dirname(historyPath(root, 'shop', 'x'))).every((f) => !f.endsWith('.tmp'))).toBe(true)
  })

  test('missing server path exits 1 naming UNSEEN_MCP_SERVER_JS', async () => {
    const root = repo()
    const { ctx, err } = mkCtx(root, {})
    const r = await runAudit(ctx, {})
    expect(r.code).toBe(1)
    expect(err.join('\n')).toContain('UNSEEN_MCP_SERVER_JS')
    expect(err.join('\n')).toContain(MCP_DEFAULT_PATH)
    expect(existsSync(path.join(root, '.night-shift'))).toBe(false)
  })

  test('an env path that does not exist also exits 1', async () => {
    const root = repo()
    const { ctx, err } = mkCtx(root, { UNSEEN_MCP_SERVER_JS: path.join(root, 'nope.js') })
    expect((await runAudit(ctx, {})).code).toBe(1)
    expect(err.join()).toContain('nope.js')
  })

  test('unknown site and invalid patrol id exit 1', async () => {
    const root = repo()
    const open = { openAudit: async () => ({ audit: fake, close: async () => undefined }) }
    expect((await runAudit(mkCtx(root).ctx, { site: 'nope' }, open)).code).toBe(1)
    expect((await runAudit(mkCtx(root).ctx, { patrolId: '../x' }, open)).code).toBe(1)
  })

  test('diff compares with the earlier patrol', async () => {
    const root = repo()
    const open = { openAudit: async () => ({ audit: fake, close: async () => undefined }) }
    await runAudit(mkCtx(root).ctx, { patrolId: '20260101T000000Z' }, open)
    const second: AuditPage = async (url) => {
      const r = await fake(url)
      if ('error' in r) return r
      return { ...r, hauntings: [...r.hauntings, { id: 'c', type: 'LostSoul', kind: '', severity: 'Restless', selector: 'x', htmlSnippet: '<input>', wcag: [] }] }
    }
    await runAudit(mkCtx(root).ctx, { patrolId: '20260102T000000Z' }, { openAudit: async () => ({ audit: second, close: async () => undefined }) })
    const { ctx, out } = mkCtx(root)
    const d = runDiff(ctx, { site: 'shop', json: true })
    expect(d.code).toBe(0)
    const json = JSON.parse(out.join('\n'))
    expect(json.previousPatrolId).toBe('20260101T000000Z')
    expect(json.new).toHaveLength(1)
    expect(json.workList[0].type).toBe('LostSoul')
    expect(runDiff(mkCtx(root).ctx, { site: 'zzz' }).code).toBe(1)
  })
})

