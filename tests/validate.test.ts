import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import fc from 'fast-check'
import { stringify } from 'yaml'
import { describe, expect, test } from 'vitest'
import { runValidate } from '../src/commands/validate.js'
import { parsePatrolYaml } from '../src/io/patrol-file.js'
import { validPatrol } from './arbitraries/patrol.js'
import type { Ctx } from '../src/commands/ctx.js'

const RUNS = { numRuns: 100 }

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

type Obj = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const violations: { name: string; expectPath: RegExp; apply: (p: Obj) => void; needs?: (p: Obj) => boolean }[] = [
  { name: 'unknown top-level key', expectPath: /^bogus$/, apply: (p) => { p.bogus = 1 } },
  { name: 'unknown site key', expectPath: /^sites\[0\]\.bogus$/, apply: (p) => { p.sites[0].bogus = 1 } },
  { name: 'duplicate site names', expectPath: /^sites\[\d+\]\.name$/, apply: (p) => { p.sites.push(clone(p.sites[0])) } },
  { name: 'empty pages', expectPath: /^sites\[0\]\.pages$/, apply: (p) => { p.sites[0].pages = [] } },
  { name: 'ftp page URL', expectPath: /^sites\[0\]\.pages\[0\]$/, apply: (p) => { p.sites[0].pages[0] = 'ftp://x.example/a' } },
  { name: 'file page URL', expectPath: /^sites\[0\]\.pages\[0\]$/, apply: (p) => { p.sites[0].pages[0] = 'file:///etc/passwd' } },
  { name: 'page path with ..', expectPath: /^sites\[0\]\.pages\[0\]$/, apply: (p) => { p.sites[0].pages[0] = '/a/../b' } },
  { name: 'absolute source', expectPath: /^sites\[0\]\.source$/, apply: (p) => { p.sites[0].source = '/etc' }, needs: (p) => !!p.sites[0].serve },
  { name: 'windows absolute source', expectPath: /^sites\[0\]\.source$/, apply: (p) => { p.sites[0].source = 'C:\\x' }, needs: (p) => !!p.sites[0].serve },
  { name: 'source escaping repo', expectPath: /^sites\[0\]\.source$/, apply: (p) => { p.sites[0].source = '../x' }, needs: (p) => !!p.sites[0].serve },
  { name: 'serve.dir escaping repo', expectPath: /^sites\[0\]\.serve\.dir$/, apply: (p) => { p.sites[0].serve.dir = 'a/../../b' }, needs: (p) => !!p.sites[0].serve },
  { name: 'absolute serve.dir', expectPath: /^sites\[0\]\.serve\.dir$/, apply: (p) => { p.sites[0].serve.dir = '/srv' }, needs: (p) => !!p.sites[0].serve },
  { name: 'absolute fixedDir', expectPath: /^sites\[0\]\.fixedDir$/, apply: (p) => { p.sites[0].fixedDir = '/fixed' } },
  { name: 'fixedDir escaping repo', expectPath: /^sites\[0\]\.fixedDir$/, apply: (p) => { p.sites[0].fixedDir = '..\\fixed' } },
  {
    name: 'serve together with baseUrl',
    expectPath: /^sites\[0\]\.baseUrl$/,
    apply: (p) => { p.sites[0].baseUrl = 'https://x.example' },
    needs: (p) => !!p.sites[0].serve,
  },
  { name: 'non-kebab name', expectPath: /^sites\[0\]\.name$/, apply: (p) => { p.sites[0].name = 'Not Kebab' } },
  { name: 'maxFixesPerSite out of range', expectPath: /^maxFixesPerSite$/, apply: (p) => { p.maxFixesPerSite = 21 } },
]

describe('P3 patrol schema', () => {
  test('P3 round trip: any valid patrol survives YAML', () => {
    fc.assert(
      fc.property(validPatrol, (patrol) => {
        const result = parsePatrolYaml(stringify(patrol))
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.value).toEqual(patrol)
      }),
      RUNS
    )
  })

  test('P3 each violation of Requirement 2.4 is rejected with a path naming the key', () => {
    fc.assert(
      fc.property(validPatrol, fc.nat(violations.length - 1), (patrol, idx) => {
        const v = violations[idx]!
        const obj = clone(patrol) as Obj
        fc.pre(!v.needs || v.needs(obj))
        v.apply(obj)
        const result = parsePatrolYaml(stringify(obj))
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.problems.some((p) => v.expectPath.test(p.path))).toBe(true)
      }),
      { numRuns: 300 }
    )
  })

  test('every violation is exercised at least once', () => {
    const sample = {
      version: 1,
      sites: [{ name: 'a', owner: 'o', pages: ['/'], serve: { dir: 'd' }, source: 's' }],
    }
    for (const v of violations) {
      const obj = clone(sample) as Obj
      v.apply(obj)
      const r = parsePatrolYaml(stringify(obj))
      expect(r.ok, v.name).toBe(false)
      if (!r.ok) expect(r.problems.some((p) => v.expectPath.test(p.path)), v.name).toBe(true)
    }
  })

  test('maxFixesPerSite defaults to 5', () => {
    const r = parsePatrolYaml('version: 1\nsites:\n  - {name: a, owner: o, pages: [/], baseUrl: "https://x.example"}\n')
    expect(r.ok && r.value.maxFixesPerSite).toBe(5)
  })

  test('serve without source is rejected', () => {
    const r = parsePatrolYaml('version: 1\nsites:\n  - {name: a, owner: o, pages: [/], serve: {dir: d}}\n')
    expect(r.ok).toBe(false)
  })
})

describe('validate command', () => {
  function setup(content: string, name = 'patrol.yaml') {
    const dir = mkdtempSync(path.join(tmpdir(), 'ns-validate-'))
    writeFileSync(path.join(dir, name), content)
    const out: string[] = []
    const err: string[] = []
    const ctx: Ctx = { cwd: dir, env: {}, log: (m) => out.push(m), error: (m) => err.push(m) }
    return { dir, out, err, ctx, done: () => rmSync(dir, { recursive: true, force: true }) }
  }

  test('malformed YAML is reported, not thrown', () => {
    const s = setup('sites: [unclosed\n  - : :')
    expect(() => runValidate(s.ctx)).not.toThrow()
    expect(runValidate(s.ctx).code).toBe(1)
    expect(s.err.join('\n')).toMatch(/malformed YAML/)
    s.done()
  })

  test('--file is honoured and ok prints the summary', () => {
    const s = setup('version: 1\nsites:\n  - {name: a, owner: o, pages: [/, /b], baseUrl: "https://x.example"}\n', 'other.yaml')
    expect(runValidate(s.ctx, { file: 'other.yaml' }).code).toBe(0)
    expect(s.out).toEqual(['other.yaml: ok (1 sites, 2 pages)'])
    expect(runValidate(s.ctx).code).toBe(1)
    expect(s.err.join('\n')).toMatch(/cannot read file/)
    s.done()
  })

  test('problems print one line each with the YAML path, exit 1', () => {
    const s = setup('version: 1\nsites:\n  - {name: a, owner: o, pages: [], baseUrl: "https://x.example", bogus: 1}\n')
    expect(runValidate(s.ctx).code).toBe(1)
    expect(s.err.some((l) => l.includes('sites[0].pages'))).toBe(true)
    expect(s.err.some((l) => l.includes('sites[0].bogus'))).toBe(true)
    s.done()
  })

  test('the starter patrol.yaml is valid', () => {
    const out: string[] = []
    const ctx: Ctx = { cwd: process.cwd(), env: {}, log: (m) => out.push(m), error: (m) => out.push(m) }
    expect(runValidate(ctx).code).toBe(0)
    expect(out[0]).toBe('patrol.yaml: ok (1 sites, 3 pages)')
  })
})

