import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import http from 'node:http'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { runAudit } from '../src/commands/audit.js'
import type { Deps } from '../src/commands/audit.js'
import type { Ctx } from '../src/commands/ctx.js'
import { runReport } from '../src/commands/report.js'
import { runVerify } from '../src/commands/verify.js'
import { runWorkdir } from '../src/commands/workdir.js'
import { runCli } from '../src/cli.js'
import { fixRecordSchema } from '../src/pure/fix-record.js'
import type { AuditPage } from '../src/io/mcp-client.js'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let b = ''
      res.on('data', (c: Buffer) => (b += c.toString()))
      res.on('end', () => resolve(b))
    }).on('error', reject)
  })
}

/** A tiny fake auditor: an empty link is a NamelessSpirit; one hidden with aria-hidden but still focusable is a TheVeiled. */
const fake: AuditPage = async (url) => {
  const html = await fetchText(url)
  const hauntings = [...html.matchAll(/<a\b[^>]*>\s*<\/a>/g)].map((m, i) => {
    const hidden = /aria-hidden="true"/.test(m[0])
    const labelled = /aria-label=/.test(m[0])
    return { id: `h${i}`, type: hidden ? 'TheVeiled' : 'NamelessSpirit', kind: '', severity: 'Wraith' as const, selector: 'a', htmlSnippet: m[0], wcag: [] as string[] }
  }).filter((h) => !/aria-label=/.test(h.htmlSnippet) || h.type === 'TheVeiled')
  return { score: hauntings.length * 10, hauntings }
}
const deps: Deps = { openAudit: async () => ({ audit: fake, close: async () => undefined }), now: () => new Date('2026-01-01T00:00:00Z') }

function repo() {
  const root = mkdtempSync(path.join(tmpdir(), 'ns-verify-'))
  dirs.push(root)
  mkdirSync(path.join(root, 'site'))
  writeFileSync(path.join(root, 'site', 'index.html'), '<html><body><h1>x</h1><a href="#" class="spark"></a><p>text</p></body></html>')
  writeFileSync(path.join(root, 'site', 'style.css'), 'p{color:#111}')
  writeFileSync(
    path.join(root, 'patrol.yaml'),
    'version: 1\nsites:\n  - name: shop\n    owner: me\n    serve: {dir: site}\n    source: site\n    fixedDir: fixed\n    pages: [/index.html]\n'
  )
  const out: string[] = []
  const err: string[] = []
  const ctx: Ctx = { cwd: root, env: {}, log: (m) => out.push(m), error: (m) => err.push(m) }
  return { root, ctx, out, err }
}

const PID = '20260101T000000Z'

async function setup() {
  const r = repo()
  await runAudit(r.ctx, { patrolId: PID }, deps)
  const history = JSON.parse(readFileSync(path.join(r.root, '.night-shift', 'history', 'shop', `${PID}.json`), 'utf8'))
  const id: string = history.pages[0].hauntings[0].id
  return { ...r, id }
}

function tree(dir: string): string[] {
  const out: string[] = []
  const walk = (rel: string) => {
    for (const e of readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) walk(r)
      else out.push(`${r}:${statSync(path.join(dir, r)).size}`)
    }
  }
  walk('')
  return out.sort()
}

function makeFix(root: string, name: string, edit: (html: string) => string, extra?: (dir: string) => void): string {
  const dir = path.join(root, 'work', name)
  mkdirSync(dir, { recursive: true })
  const html = readFileSync(path.join(root, 'site', 'index.html'), 'utf8')
  writeFileSync(path.join(dir, 'index.html'), edit(html))
  writeFileSync(path.join(dir, 'style.css'), 'p{color:#111}')
  extra?.(dir)
  return `work/${name}`
}

describe('verify', () => {
  test('keep with --apply copies only changed files into a new fixedDir created from source', async () => {
    const s = await setup()
    const fix = makeFix(s.root, 'good', (h) => h.replace('class="spark"', 'class="spark" aria-label="Sparkle"'))
    const r = await runVerify(s.ctx, { site: 'shop', fixDir: fix, haunting: s.id, apply: true }, deps)
    expect(r.code).toBe(0)
    expect(r.record).toMatchObject({ decision: 'keep', attempt: 1, applied: true, changedFiles: ['index.html'], origin: 'crew' })
    expect(readFileSync(path.join(s.root, 'fixed', 'index.html'), 'utf8')).toContain('aria-label="Sparkle"')
    expect(existsSync(path.join(s.root, 'fixed', 'style.css'))).toBe(true)
    expect(readFileSync(path.join(s.root, 'site', 'index.html'), 'utf8')).not.toContain('aria-label')
    const file = path.join(s.root, '.night-shift', 'fixes', PID, `${s.id}.json`)
    expect(fixRecordSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).decision).toBe('keep')
    expect(readdirSync(path.dirname(file)).every((f) => !f.endsWith('.tmp'))).toBe(true)
  })

  test('keep without --apply writes nothing outside .night-shift', async () => {
    const s = await setup()
    const fix = makeFix(s.root, 'good', (h) => h.replace('class="spark"', 'class="spark" aria-label="Sparkle"'))
    const before = tree(s.root).filter((f) => !f.startsWith('.night-shift'))
    expect((await runVerify(s.ctx, { site: 'shop', fixDir: fix, haunting: s.id }, deps)).code).toBe(0)
    expect(tree(s.root).filter((f) => !f.startsWith('.night-shift'))).toEqual(before)
    expect(existsSync(path.join(s.root, 'fixed'))).toBe(false)
  })

  test('reject for the obvious aria-hidden fix: exit 3, new-haunting naming TheVeiled, nothing written outside .night-shift and the fix dir', async () => {
    const s = await setup()
    const fix = makeFix(s.root, 'bad', (h) => h.replace('class="spark"', 'class="spark" aria-hidden="true"'))
    const before = tree(s.root).filter((f) => !f.startsWith('.night-shift'))
    const r = await runVerify(s.ctx, { site: 'shop', fixDir: fix, haunting: s.id, apply: true, recordedAttempt: true }, deps)
    expect(r.code).toBe(3)
    expect(r.record?.decision).toBe('reject')
    expect(r.record?.origin).toBe('recorded-attempt')
    expect(r.record?.applied).toBe(false)
    const reason = r.record!.reasons.find((x) => x.code === 'new-haunting')!
    expect(reason.message).toContain('TheVeiled')
    expect(reason.type).toBe('TheVeiled')
    expect(tree(s.root).filter((f) => !f.startsWith('.night-shift'))).toEqual(before)
    expect(existsSync(path.join(s.root, 'fixed'))).toBe(false)
  })

  test('reject for an added script (unsafe-change) even though the haunting is gone', async () => {
    const s = await setup()
    const fix = makeFix(s.root, 'script', (h) => h.replace('class="spark"', 'class="spark" aria-label="S"').replace('</body>', '<script>1</script></body>'))
    const r = await runVerify(s.ctx, { site: 'shop', fixDir: fix, haunting: s.id }, deps)
    expect(r.code).toBe(3)
    expect(r.record?.reasons.map((x) => x.code)).toEqual(['unsafe-change'])
  })

  test('reject when the target is still present', async () => {
    const s = await setup()
    const fix = makeFix(s.root, 'same', (h) => h)
    const r = await runVerify(s.ctx, { site: 'shop', fixDir: fix, haunting: s.id }, deps)
    expect(r.code).toBe(3)
    expect(r.record?.reasons[0]?.code).toBe('target-still-present')
  })

  test('attempt counter increments and earlier attempts are kept in the record', async () => {
    const s = await setup()
    const bad = makeFix(s.root, 'bad', (h) => h.replace('class="spark"', 'class="spark" aria-hidden="true"'))
    const good = makeFix(s.root, 'good', (h) => h.replace('class="spark"', 'class="spark" aria-label="Sparkle"'))
    expect((await runVerify(s.ctx, { site: 'shop', fixDir: bad, haunting: s.id }, deps)).record?.attempt).toBe(1)
    const second = await runVerify(s.ctx, { site: 'shop', fixDir: good, haunting: s.id }, deps)
    expect(second.record?.attempt).toBe(2)
    expect(second.record?.previousAttempts.map((a) => a.decision)).toEqual(['reject'])
    expect(readdirSync(path.join(s.root, '.night-shift', 'fixes', PID))).toHaveLength(1)
  })

  test('errors exit 1: unknown haunting id lists known ids, same dir, missing dir, site without serve', async () => {
    const s = await setup()
    const fix = makeFix(s.root, 'good', (h) => h)
    const r1 = await runVerify(s.ctx, { site: 'shop', fixDir: fix, haunting: 'nope' }, deps)
    expect(r1.code).toBe(1)
    expect(s.err.join('\n')).toContain(s.id)
    expect((await runVerify(s.ctx, { site: 'shop', fixDir: 'site', haunting: s.id }, deps)).code).toBe(1)
    expect((await runVerify(s.ctx, { site: 'shop', fixDir: 'missing', haunting: s.id }, deps)).code).toBe(1)
    expect((await runVerify(s.ctx, { site: 'zzz', fixDir: fix, haunting: s.id }, deps)).code).toBe(1)
    expect((await runVerify(s.ctx, { site: 'shop', fixDir: '../escape', haunting: s.id }, deps)).code).toBe(1)
  })

  test('the base is the fixed directory once it exists', async () => {
    const s = await setup()
    const fix = makeFix(s.root, 'good', (h) => h.replace('class="spark"', 'class="spark" aria-label="Sparkle"'))
    await runVerify(s.ctx, { site: 'shop', fixDir: fix, haunting: s.id, apply: true }, deps)
    const fix2 = path.join('work', 'again')
    mkdirSync(path.join(s.root, fix2), { recursive: true })
    writeFileSync(path.join(s.root, fix2, 'index.html'), readFileSync(path.join(s.root, 'fixed', 'index.html'), 'utf8'))
    writeFileSync(path.join(s.root, fix2, 'style.css'), 'p{color:#222}')
    const r = await runVerify(s.ctx, { site: 'shop', fixDir: fix2, haunting: s.id }, deps)
    expect(r.record?.changedFiles).toEqual(['style.css'])
  })

  test('CLI wiring: verify exit code 3 and usage errors exit 1', async () => {
    const s = await setup()
    const fix = makeFix(s.root, 'bad', (h) => h.replace('class="spark"', 'class="spark" aria-hidden="true"'))
    expect(await runCli(['verify', 'shop', fix, '--haunting', s.id], s.ctx, deps)).toBe(3)
    expect(await runCli(['verify', 'shop'], s.ctx, deps)).toBe(1)
    expect(await runCli(['workdir', 'shop'], s.ctx, deps)).toBe(1)
  })
})

describe('workdir', () => {
  test('creates a copy of the base, refuses an existing path, honours --attempt', async () => {
    const s = await setup()
    const first = runWorkdir(s.ctx, { site: 'shop', haunting: s.id, patrolId: PID })
    expect(first.code).toBe(0)
    expect(s.out.at(-1)).toBe(`demo/work/${PID}/${s.id}`)
    expect(readFileSync(path.join(first.dir!, 'index.html'), 'utf8')).toContain('class="spark"')
    const again = runWorkdir(s.ctx, { site: 'shop', haunting: s.id, patrolId: PID })
    expect(again.code).toBe(1)
    expect(s.err.join()).toContain('--attempt')
    const second = runWorkdir(s.ctx, { site: 'shop', haunting: s.id, patrolId: PID, attempt: 2 })
    expect(second.code).toBe(0)
    expect(s.out.at(-1)).toBe(`demo/work/${PID}/${s.id}-2`)
    expect(runWorkdir(s.ctx, { site: 'shop', haunting: s.id, patrolId: PID, attempt: 2 }).code).toBe(1)
    expect(runWorkdir(s.ctx, { site: 'shop', haunting: 'nope', patrolId: PID }).code).toBe(1)
    expect(runWorkdir(s.ctx, { site: 'shop', haunting: s.id, patrolId: '../x' }).code).toBe(1)
  })

  test('copies from the fixed directory once it exists', async () => {
    const s = await setup()
    const fix = makeFix(s.root, 'good', (h) => h.replace('class="spark"', 'class="spark" aria-label="Sparkle"'))
    await runVerify(s.ctx, { site: 'shop', fixDir: fix, haunting: s.id, apply: true }, deps)
    const w = runWorkdir(s.ctx, { site: 'shop', haunting: s.id, patrolId: PID })
    expect(readFileSync(path.join(w.dir!, 'index.html'), 'utf8')).toContain('aria-label')
  })
})

describe('report reads fix records', () => {
  test('kept and rejected records appear, scoreAfter comes from the re-audited fixed directory', async () => {
    const s = await setup()
    const bad = makeFix(s.root, 'bad', (h) => h.replace('class="spark"', 'class="spark" aria-hidden="true"'))
    await runVerify(s.ctx, { site: 'shop', fixDir: bad, haunting: s.id, recordedAttempt: true }, deps)
    let r = await runReport(s.ctx, { patrolId: PID }, deps)
    expect(r.report?.sites[0]?.fixes.map((f) => f.decision)).toEqual(['rejected'])
    expect(readFileSync(path.join(s.root, 'REPORT.md'), 'utf8')).toContain('Recorded attempt, not an agent run.')
    expect(readFileSync(path.join(s.root, 'REPORT.md'), 'utf8')).toContain('TheVeiled')
    expect(r.report?.sites[0]?.scoreAfter).toBe(10)
    const good = makeFix(s.root, 'good', (h) => h.replace('class="spark"', 'class="spark" aria-label="Sparkle"'))
    await runVerify(s.ctx, { site: 'shop', fixDir: good, haunting: s.id, apply: true }, deps)
    r = await runReport(s.ctx, { patrolId: PID }, deps)
    const site = r.report!.sites[0]!
    expect(site.fixes).toHaveLength(1)
    expect(site.fixes[0]).toMatchObject({ decision: 'kept', attempts: 2 })
    expect(site.scoreBefore).toBe(10)
    expect(site.scoreAfter).toBe(0)
    expect(site.scoreChange).toBe(-10)
    expect(site.notAttempted).toEqual([])
  })
})
