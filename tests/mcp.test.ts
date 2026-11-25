import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import http from 'node:http'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import fc from 'fast-check'
import { afterEach, describe, expect, test } from 'vitest'
import { createNightShiftServer, MAX_READ_CHARS } from '../src/commands/mcp.js'
import type { Deps } from '../src/commands/audit.js'
import type { AuditPage } from '../src/io/mcp-client.js'

const dirs: string[] = []
const clients: Client[] = []
afterEach(async () => {
  for (const c of clients.splice(0)) await c.close().catch(() => undefined)
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

/** A tiny fake auditor: an empty link without aria-label is a NamelessSpirit; one with aria-hidden is a TheVeiled. */
const fake: AuditPage = async (url) => {
  const html = await fetchText(url)
  const hauntings = [...html.matchAll(/<a\b[^>]*>\s*<\/a>/g)]
    .map((m, i) => ({ id: `h${i}`, type: /aria-hidden="true"/.test(m[0]) ? 'TheVeiled' : 'NamelessSpirit', kind: '', severity: 'Wraith' as const, selector: 'a', htmlSnippet: m[0], wcag: [] as string[] }))
    .filter((h) => !/aria-label=/.test(h.htmlSnippet) || h.type === 'TheVeiled')
  return { score: hauntings.length * 10, hauntings }
}
const deps: Deps = { openAudit: async () => ({ audit: fake, close: async () => undefined }), now: () => new Date('2026-01-01T00:00:00Z') }

const PID = '20260101T000000Z'

async function setup(env: NodeJS.ProcessEnv = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'ns-mcp-'))
  dirs.push(root)
  mkdirSync(path.join(root, 'site', 'img'), { recursive: true })
  writeFileSync(path.join(root, 'site', 'index.html'), '<html><body><h1>x</h1><a href="#" class="spark"></a></body></html>')
  writeFileSync(path.join(root, 'site', 'img', 'a.svg'), '<svg/>')
  writeFileSync(path.join(root, 'site', 'bin.dat'), Buffer.from([1, 0, 2]))
  writeFileSync(path.join(root, 'secret.txt'), 'top secret')
  writeFileSync(path.join(root, 'patrol.yaml'), 'version: 1\nsites:\n  - name: shop\n    owner: me\n    serve: {dir: site}\n    source: site\n    fixedDir: fixed\n    pages: [/index.html]\n')
  const server = createNightShiftServer({ env, cwd: tmpdir(), deps })
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '0.0.0' })
  clients.push(client)
  await Promise.all([server.connect(a), client.connect(b)])
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: { home: root, ...args } })) as { isError?: boolean; content: { type: string; text: string }[] }
    return { isError: r.isError === true, body: JSON.parse(r.content[0]!.text) as Record<string, any> }
  }
  return { root, client, call }
}

type T = Awaited<ReturnType<typeof setup>>

async function audited(t: T) {
  const a = await t.call('audit', { site: 'shop', patrolId: PID })
  expect(a.isError).toBe(false)
  const d = await t.call('diff', { site: 'shop', patrolId: PID })
  return d.body.workList[0].id as string
}

describe('night-shift MCP server', () => {
  test('lists exactly the eleven tools, each with a home argument', async () => {
    const t = await setup()
    const { tools } = await t.client.listTools()
    expect(tools.map((x) => x.name).sort()).toEqual(['audit', 'diff', 'edit_fix_file', 'find_in_source', 'list_source', 'read_source', 'report', 'validate', 'verify', 'workdir', 'write_fix_file'])
    for (const tool of tools) expect(Object.keys((tool.inputSchema as { properties: object }).properties), tool.name).toContain('home')
  })

  test('validate lists the sites; a broken patrol.yaml is an error', async () => {
    const t = await setup()
    const ok = await t.call('validate')
    expect(ok).toMatchObject({ isError: false, body: { ok: true, code: 0, maxFixesPerSite: 5 } })
    expect(ok.body.sites).toEqual([{ name: 'shop', owner: 'me', pages: ['/index.html'] }])
    writeFileSync(path.join(t.root, 'patrol.yaml'), 'version: 2\n')
    const bad = await t.call('validate')
    expect(bad.isError).toBe(true)
    expect(bad.body.ok).toBe(false)
    expect(bad.body.errors).toContain('patrol.yaml')
  })

  test('home falls back to NIGHT_SHIFT_HOME; a missing home is an error', async () => {
    const t = await setup()
    const viaEnv = await setup({ NIGHT_SHIFT_HOME: t.root })
    const r = (await viaEnv.client.callTool({ name: 'validate', arguments: {} })) as { isError?: boolean; content: { text: string }[] }
    expect(r.isError).toBeFalsy()
    expect(JSON.parse(r.content[0]!.text).sites[0].name).toBe('shop')
    const none = await t.call('validate', { home: path.join(t.root, 'does-not-exist') })
    expect(none.isError).toBe(true)
    expect(none.body.error).toContain('not a directory')
  })

  test('audit writes the history file and returns the patrol id; unknown site is an error', async () => {
    const t = await setup()
    const a = await t.call('audit', { site: 'shop', patrolId: PID })
    expect(a.body).toMatchObject({ ok: true, patrolId: PID })
    expect(existsSync(path.join(t.root, '.night-shift', 'history', 'shop', `${PID}.json`))).toBe(true)
    const bad = await t.call('audit', { site: 'nope' })
    expect(bad.isError).toBe(true)
    expect(bad.body.errors).toContain('unknown site')
  })

  test('diff returns the workList; without history it is an error', async () => {
    const t = await setup()
    expect((await t.call('diff', { site: 'shop' })).isError).toBe(true)
    await t.call('audit', { site: 'shop', patrolId: PID })
    const d = await t.call('diff', { site: 'shop', patrolId: PID })
    expect(d.body).toMatchObject({ ok: true, site: 'shop', patrolId: PID, previousPatrolId: null })
    expect(d.body.workList).toHaveLength(1)
    expect(d.body.workList[0]).toMatchObject({ type: 'NamelessSpirit', severity: 'Wraith', page: '/index.html' })
  })

  test('workdir copies the base and returns a relative path; a second call for the same attempt fails', async () => {
    const t = await setup()
    const id = await audited(t)
    const w = await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })
    expect(w.body).toEqual({ ok: true, workdir: `demo/work/${PID}/${id}` })
    expect(existsSync(path.join(t.root, w.body.workdir, 'index.html'))).toBe(true)
    expect((await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).isError).toBe(true)
    expect((await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID, attempt: 2 })).body.workdir).toBe(`demo/work/${PID}/${id}-2`)
    expect((await t.call('workdir', { site: 'shop', hauntingId: 'nope', patrolId: PID })).isError).toBe(true)
  })

  test('list_source and read_source stay inside the source directory', async () => {
    const t = await setup()
    const l = await t.call('list_source', { site: 'shop' })
    expect(l.body.files).toEqual(['bin.dat', 'img/a.svg', 'index.html'])
    const r = await t.call('read_source', { site: 'shop', path: 'index.html' })
    expect(r.body.content).toContain('class="spark"')
    expect((await t.call('read_source', { site: 'shop', path: 'img\\a.svg' })).body.content).toBe('<svg/>')
    for (const bad of ['../secret.txt', '..\\secret.txt', path.join(t.root, 'secret.txt'), '/etc/passwd', 'C:\\Windows\\win.ini', 'img/../../secret.txt', 'missing.html', 'img', 'bin.dat']) {
      const x = await t.call('read_source', { site: 'shop', path: bad })
      expect(x.isError, bad).toBe(true)
      expect(JSON.stringify(x.body), bad).not.toContain('top secret')
    }
    expect((await t.call('read_source', { site: 'nope', path: 'index.html' })).isError).toBe(true)
  })

  test('read_source refuses a symlink that leaves the source directory', async () => {
    const t = await setup()
    try {
      symlinkSync(path.join(t.root, 'secret.txt'), path.join(t.root, 'site', 'link.txt'), 'file')
    } catch {
      return // no permission to create symlinks on this host
    }
    const x = await t.call('read_source', { site: 'shop', path: 'link.txt' })
    expect(x.isError).toBe(true)
    expect(JSON.stringify(x.body)).not.toContain('top secret')
  })

  test('read_source and list_source can look inside a work directory, but only one the workdir tool shape allows', async () => {
    const t = await setup()
    const id = await audited(t)
    const w = (await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).body.workdir as string
    expect((await t.call('list_source', { site: 'shop', workdir: w })).body.files).toContain('index.html')
    expect((await t.call('read_source', { site: 'shop', workdir: w, path: 'index.html' })).isError).toBe(false)
    for (const bad of ['site', '.', '..', 'demo/work', `demo/work/${PID}`, `demo/work/${PID}/${id}/..`, `demo/work/not-an-id/${id}`, path.join(t.root, w)]) {
      expect((await t.call('list_source', { site: 'shop', workdir: bad })).isError, bad).toBe(true)
    }
  })

  test('write_fix_file writes inside a created work directory, makes subdirectories, and nothing else', async () => {
    const t = await setup()
    const id = await audited(t)
    const w = (await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).body.workdir as string
    const ok = await t.call('write_fix_file', { workdir: w, path: 'index.html', content: '<a aria-label="x"></a>' })
    expect(ok.body).toEqual({ ok: true, written: 'index.html', bytes: 22 })
    expect(readFileSync(path.join(t.root, w, 'index.html'), 'utf8')).toBe('<a aria-label="x"></a>')
    expect((await t.call('write_fix_file', { workdir: w, path: 'css\\site.css', content: 'p{}' })).body.written).toBe('css/site.css')
    expect(readFileSync(path.join(t.root, 'site', 'index.html'), 'utf8')).toContain('class="spark"')
    expect(Buffer.from(readFileSync(path.join(t.root, w, 'index.html'))).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false)
  })

  test('write_fix_file rejects other directories, "..", absolute paths and a directory target', async () => {
    const t = await setup()
    const id = await audited(t)
    const w = (await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).body.workdir as string
    const attempts: [string, string][] = [
      ['site', 'index.html'],
      ['.', 'x.html'],
      ['demo/work', 'x.html'],
      [`demo/work/${PID}/never-created`, 'x.html'],
      [`demo/work/${PID}/${id}/..`, 'x.html'],
      [path.join(t.root, w), 'x.html'],
      [w, '../x.html'],
      [w, '..\\x.html'],
      [w, 'img/../../x.html'],
      [w, path.join(t.root, 'pwn.html')],
      [w, '/pwn.html'],
      [w, 'C:\\pwn.html'],
      [w, ''],
      [w, 'img'],
    ]
    for (const [workdir, p] of attempts) expect((await t.call('write_fix_file', { workdir, path: p, content: 'x' })).isError, `${workdir} | ${p}`).toBe(true)
    expect(existsSync(path.join(t.root, 'x.html'))).toBe(false)
    expect(existsSync(path.join(t.root, 'pwn.html'))).toBe(false)
    expect(existsSync(path.join(t.root, 'demo', 'work', PID, 'never-created'))).toBe(false)
  })

  test('write_fix_file refuses a symlink out of the work directory', async () => {
    const t = await setup()
    const id = await audited(t)
    const w = (await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).body.workdir as string
    try {
      symlinkSync(t.root, path.join(t.root, w, 'out'), 'junction')
    } catch {
      return
    }
    const x = await t.call('write_fix_file', { workdir: w, path: 'out/pwn.html', content: 'x' })
    expect(x.isError).toBe(true)
    expect(existsSync(path.join(t.root, 'pwn.html'))).toBe(false)
  })

  test('property: no path argument can make write_fix_file or read_source touch a file outside its tree', async () => {
    const t = await setup()
    const id = await audited(t)
    const w = (await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).body.workdir as string
    const sep = fc.constantFrom('/', '\\')
    const nasty = fc
      .array(fc.tuple(fc.constantFrom('..', '.', 'a', 'img', '', 'C:'), sep), { minLength: 1, maxLength: 5 })
      .map((parts) => parts.map(([s, p]) => s + p).join('') + 'pwn.txt')
    await fc.assert(
      fc.asyncProperty(nasty, async (p) => {
        await t.call('write_fix_file', { workdir: w, path: p, content: 'PWN' })
        const read = await t.call('read_source', { site: 'shop', path: p })
        expect(JSON.stringify(read.body)).not.toContain('top secret')
        return true
      }),
      { numRuns: 100 }
    )
    for (const where of [t.root, path.join(t.root, 'site'), path.join(t.root, 'demo'), path.dirname(t.root)]) expect(existsSync(path.join(where, 'pwn.txt')), where).toBe(false)
  })

  test('read_source returns a ranged, capped slice of a page larger than the 30,000 character reply limit', async () => {
    const t = await setup()
    const rows = Array.from({ length: 1500 }, (_, i) => `<p class="row">row ${i} "quoted" text to make the page long</p>`)
    writeFileSync(path.join(t.root, 'site', 'big.html'), `<html><body>\n${rows.join('\n')}\n<a href="#" class="late"></a>\n</body></html>\n`)
    expect(readFileSync(path.join(t.root, 'site', 'big.html'), 'utf8').length).toBeGreaterThan(60_000)
    const first = await t.call('read_source', { site: 'shop', path: 'big.html' })
    expect(first.isError).toBe(false)
    expect(first.body.truncated).toBe(true)
    expect(first.body.content.length).toBeLessThanOrEqual(MAX_READ_CHARS)
    expect(JSON.stringify(first.body).length).toBeLessThan(30_000)
    expect(first.body.nextStartLine).toBe(first.body.endLine + 1)
    const found = await t.call('find_in_source', { site: 'shop', path: 'big.html', query: '<a href="#" class="late"></a>', context: 1 })
    expect(found.body.totalMatches).toBe(1)
    const line = found.body.matches[0].line as number
    expect(found.body.matches[0].text).toContain(`${line}: <a href="#" class="late">`)
    const ranged = await t.call('read_source', { site: 'shop', path: 'big.html', startLine: line - 1, endLine: line + 1 })
    expect(ranged.body).toMatchObject({ startLine: line - 1, endLine: line + 1, truncated: false })
    expect(ranged.body.content).toContain('<a href="#" class="late"></a>')
    expect((await t.call('read_source', { site: 'shop', path: 'big.html', startLine: 99999 })).isError).toBe(true)
    expect((await t.call('read_source', { site: 'shop', path: 'big.html', startLine: 5, endLine: 2 })).isError).toBe(true)
  })

  test('find_in_source works on a work directory, is confined like read_source, and refuses an empty query', async () => {
    const t = await setup()
    const id = await audited(t)
    const w = (await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).body.workdir as string
    const r = await t.call('find_in_source', { site: 'shop', workdir: w, path: 'index.html', query: 'class="spark"' })
    expect(r.body).toMatchObject({ ok: true, totalMatches: 1 })
    expect((await t.call('find_in_source', { site: 'shop', path: 'index.html', query: ' ' })).isError).toBe(true)
    for (const bad of ['../secret.txt', path.join(t.root, 'secret.txt'), 'bin.dat', 'img']) {
      const x = await t.call('find_in_source', { site: 'shop', path: bad, query: 'top' })
      expect(x.isError, bad).toBe(true)
      expect(JSON.stringify(x.body)).not.toContain('top secret')
    }
    expect((await t.call('find_in_source', { site: 'shop', workdir: 'site', path: 'index.html', query: 'a' })).isError).toBe(true)
  })

  test('edit_fix_file replaces one exact, unique piece of text in the work directory and reports the line', async () => {
    const t = await setup()
    const id = await audited(t)
    const w = (await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).body.workdir as string
    const file = path.join(t.root, w, 'index.html')
    writeFileSync(file, '<html>\n<body>\n<h1>x</h1>\n<a href="#" class="spark"></a>\n</body>\n</html>\n')
    const ok = await t.call('edit_fix_file', { workdir: w, path: 'index.html', oldText: 'class="spark">', newText: 'class="spark" aria-label="Sparkle">' })
    expect(ok.body).toMatchObject({ ok: true, path: 'index.html', line: 4, endLine: 4 })
    expect(readFileSync(file, 'utf8')).toBe('<html>\n<body>\n<h1>x</h1>\n<a href="#" class="spark" aria-label="Sparkle"></a>\n</body>\n</html>\n')
    expect(readFileSync(path.join(t.root, 'site', 'index.html'), 'utf8')).not.toContain('aria-label')
    const v = await t.call('verify', { site: 'shop', workdir: w, hauntingId: id })
    expect(v.body.decision).toBe('keep')
  })

  test('edit_fix_file fails and changes nothing when oldText is missing, ambiguous, empty or identical', async () => {
    const t = await setup()
    const id = await audited(t)
    const w = (await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).body.workdir as string
    const file = path.join(t.root, w, 'index.html')
    const original = '<p>a</p>\n<p>a</p>\n<a href="#" class="spark"></a>\n'
    writeFileSync(file, original)
    const cases: [string, string, string][] = [
      ['missing', 'not in the file', 'x'],
      ['ambiguous', '<p>a</p>', '<p>b</p>'],
      ['empty', '', 'x'],
      ['identical', '<a ', '<a '],
    ]
    for (const [reason, oldText, newText] of cases) {
      const x = await t.call('edit_fix_file', { workdir: w, path: 'index.html', oldText, newText })
      expect(x.isError, reason).toBe(true)
      expect(x.body.reason, reason).toBe(reason)
      expect(readFileSync(file, 'utf8'), reason).toBe(original)
    }
    expect((await t.call('edit_fix_file', { workdir: w, path: 'nope.html', oldText: 'a', newText: 'b' })).isError).toBe(true)
    expect(existsSync(path.join(t.root, w, 'nope.html'))).toBe(false)
  })

  test('edit_fix_file rejects other directories, "..", absolute paths, a directory and a symlink out', async () => {
    const t = await setup()
    const id = await audited(t)
    const w = (await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).body.workdir as string
    const source = readFileSync(path.join(t.root, 'site', 'index.html'), 'utf8')
    const attempts: [string, string][] = [
      ['site', 'index.html'],
      ['.', 'index.html'],
      [`demo/work/${PID}/never-created`, 'index.html'],
      [`demo/work/${PID}/${id}/..`, 'index.html'],
      [path.join(t.root, w), 'index.html'],
      [w, '../../secret.txt'],
      [w, '..\\..\\secret.txt'],
      [w, path.join(t.root, 'secret.txt')],
      [w, '/secret.txt'],
      [w, ''],
      [w, 'img'],
    ]
    for (const [workdir, p] of attempts) {
      const x = await t.call('edit_fix_file', { workdir, path: p, oldText: 'top', newText: 'TOP' })
      expect(x.isError, `${workdir} | ${p}`).toBe(true)
    }
    try {
      symlinkSync(path.join(t.root, 'secret.txt'), path.join(t.root, w, 'link.txt'), 'file')
      expect((await t.call('edit_fix_file', { workdir: w, path: 'link.txt', oldText: 'top', newText: 'TOP' })).isError).toBe(true)
    } catch {
      // no permission to create symlinks on this host
    }
    expect(readFileSync(path.join(t.root, 'secret.txt'), 'utf8')).toBe('top secret')
    expect(readFileSync(path.join(t.root, 'site', 'index.html'), 'utf8')).toBe(source)
  })

  test('property: edit_fix_file changes the file only when oldText occurs exactly once, and then only there', async () => {
    const t = await setup()
    const id = await audited(t)
    const w = (await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).body.workdir as string
    const file = path.join(t.root, w, 'index.html')
    const piece = fc.constantFrom('<p>', '</p>', 'a', 'b', ' ', '\n', '"', 'class=', 'x')
    const text = fc.array(piece, { minLength: 0, maxLength: 30 }).map((p) => p.join(''))
    const occurrences = (h: string, n: string): number => h.split(n).length - 1
    await fc.assert(
      fc.asyncProperty(text, text, text, async (content, oldText, newText) => {
        writeFileSync(file, content)
        const r = await t.call('edit_fix_file', { workdir: w, path: 'index.html', oldText, newText })
        const after = readFileSync(file, 'utf8')
        if (oldText !== '' && oldText !== newText && occurrences(content, oldText) === 1) {
          expect(r.isError).toBe(false)
          expect(after).toBe(content.replace(oldText, () => newText))
        } else {
          expect(r.isError).toBe(true)
          expect(after).toBe(content)
        }
        expect(readFileSync(path.join(t.root, 'site', 'index.html'), 'utf8')).toContain('class="spark"')
        return true
      }),
      { numRuns: 100 }
    )
  })

  test('property: no path argument can make edit_fix_file or find_in_source touch a file outside its tree', async () => {
    const t = await setup()
    const id = await audited(t)
    const w = (await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).body.workdir as string
    const sep = fc.constantFrom('/', '\\')
    const nasty = fc
      .array(fc.tuple(fc.constantFrom('..', '.', 'a', 'img', '', 'C:'), sep), { minLength: 1, maxLength: 5 })
      .map((parts) => parts.map(([s, p]) => s + p).join('') + 'secret.txt')
    await fc.assert(
      fc.asyncProperty(nasty, async (p) => {
        await t.call('edit_fix_file', { workdir: w, path: p, oldText: 'top', newText: 'TOP' })
        const found = await t.call('find_in_source', { site: 'shop', path: p, query: 'top' })
        expect(JSON.stringify(found.body)).not.toContain('top secret')
        return true
      }),
      { numRuns: 100 }
    )
    expect(readFileSync(path.join(t.root, 'secret.txt'), 'utf8')).toBe('top secret')
  })
  test('verify keeps a good fix, applies it, and returns the decision and the record', async () => {
    const t = await setup()
    const id = await audited(t)
    const w = (await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).body.workdir as string
    await t.call('write_fix_file', { workdir: w, path: 'index.html', content: '<html><body><h1>x</h1><a href="#" class="spark" aria-label="Sparkle"></a></body></html>' })
    const v = await t.call('verify', { site: 'shop', workdir: w, hauntingId: id, apply: true })
    expect(v.isError).toBe(false)
    expect(v.body).toMatchObject({ ok: true, code: 0, decision: 'keep', record: { decision: 'keep', applied: true, changedFiles: ['index.html'], origin: 'crew', attempt: 1 } })
    expect(readFileSync(path.join(t.root, 'fixed', 'index.html'), 'utf8')).toContain('aria-label="Sparkle"')
  })

  test('verify rejects aria-hidden as a normal answer (not an error), with the reason, and applies nothing', async () => {
    const t = await setup()
    const id = await audited(t)
    const w = (await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).body.workdir as string
    await t.call('write_fix_file', { workdir: w, path: 'index.html', content: '<html><body><h1>x</h1><a href="#" class="spark" aria-hidden="true"></a></body></html>' })
    const v = await t.call('verify', { site: 'shop', workdir: w, hauntingId: id, apply: true })
    expect(v.isError).toBe(false)
    expect(v.body).toMatchObject({ ok: false, code: 3, decision: 'reject' })
    expect(v.body.record.reasons.map((r: { code: string }) => r.code)).toContain('new-haunting')
    expect(existsSync(path.join(t.root, 'fixed'))).toBe(false)
  })

  test('verify refuses a directory that is not a work directory, and an unknown haunting', async () => {
    const t = await setup()
    const id = await audited(t)
    for (const bad of ['site', '../site', path.join(t.root, 'site'), 'demo/work/x']) {
      const v = await t.call('verify', { site: 'shop', workdir: bad, hauntingId: id })
      expect(v.isError, bad).toBe(true)
    }
    const w = (await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).body.workdir as string
    const v = await t.call('verify', { site: 'shop', workdir: w, hauntingId: 'nope' })
    expect(v.isError).toBe(true)
    expect(v.body.errors).toContain('unknown haunting id')
  })

  test('report writes REPORT.md and report.json and returns each fix with its decision', async () => {
    const t = await setup()
    const id = await audited(t)
    const w = (await t.call('workdir', { site: 'shop', hauntingId: id, patrolId: PID })).body.workdir as string
    await t.call('write_fix_file', { workdir: w, path: 'index.html', content: '<html><body><h1>x</h1><a href="#" class="spark" aria-hidden="true"></a></body></html>' })
    await t.call('verify', { site: 'shop', workdir: w, hauntingId: id, apply: true })
    const r = await t.call('report', { patrolId: PID })
    expect(r.isError).toBe(false)
    expect(r.body).toMatchObject({ ok: true, patrolId: PID, reportFile: 'REPORT.md', jsonFile: 'report.json' })
    expect(r.body.sites[0].fixes).toMatchObject([{ hauntingId: id, decision: 'rejected', attempts: 1 }])
    expect(existsSync(path.join(t.root, 'REPORT.md'))).toBe(true)
    expect(JSON.parse(readFileSync(path.join(t.root, 'report.json'), 'utf8')).patrolId).toBe(PID)
    expect(existsSync(path.join(t.root, 'ui', 'src', 'last-report.json'))).toBe(false)
    expect((await t.call('report', { patrolId: PID, publishUi: true })).isError).toBe(false)
    expect(existsSync(path.join(t.root, 'ui', 'src', 'last-report.json'))).toBe(true)
  })

  test('report without any history is an error', async () => {
    const t = await setup()
    const r = await t.call('report')
    expect(r.isError).toBe(true)
    expect(r.body.error).toContain('no audit history')
  })
})
