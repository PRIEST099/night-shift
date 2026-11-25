import path from 'node:path'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { runCli } from '../src/cli.js'
import type { Ctx } from '../src/commands/ctx.js'
import { extractHome, resolveHome } from '../src/pure/home.js'

const RUNS = { numRuns: 100 }
const word = fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/)
const dir = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 _-]{0,11}$/)

describe('resolveHome', () => {
  test('--home wins over NIGHT_SHIFT_HOME, which wins over the cwd; blank values are ignored', () => {
    const cwd = path.resolve('/work')
    expect(resolveHome({}, cwd)).toBe(cwd)
    expect(resolveHome({ NIGHT_SHIFT_HOME: '  ' }, cwd)).toBe(cwd)
    expect(resolveHome({ NIGHT_SHIFT_HOME: 'repo' }, cwd)).toBe(path.resolve(cwd, 'repo'))
    expect(resolveHome({ NIGHT_SHIFT_HOME: 'repo' }, cwd, 'other')).toBe(path.resolve(cwd, 'other'))
    expect(resolveHome({ NIGHT_SHIFT_HOME: 'repo' }, cwd, ' ')).toBe(path.resolve(cwd, 'repo'))
  })
})

describe('extractHome', () => {
  test('removes --home <dir> wherever it stands and keeps every other argument in order', () => {
    fc.assert(
      fc.property(fc.array(word, { maxLength: 6 }), fc.nat(6), dir, fc.boolean(), (args, at, home, joined) => {
        const i = Math.min(at, args.length)
        const flag = joined ? [`--home=${home}`] : ['--home', home]
        const r = extractHome([...args.slice(0, i), ...flag, ...args.slice(i)])
        expect(r.error).toBeUndefined()
        expect(r.home).toBe(home)
        expect(r.argv).toEqual(args)
      }),
      RUNS
    )
  })

  test('without the flag argv is unchanged', () => {
    fc.assert(
      fc.property(fc.array(word, { maxLength: 8 }), (args) => {
        expect(extractHome(args)).toEqual({ argv: args })
      }),
      RUNS
    )
  })

  test('a --home without a value is an error', () => {
    expect(extractHome(['validate', '--home']).error).toMatch(/--home/)
    expect(extractHome(['validate', '--home', '--file', 'x']).error).toMatch(/--home/)
    expect(extractHome(['validate', '--home=']).error).toMatch(/--home/)
  })
})

describe('runCli --home', () => {
  test('resolves the patrol file against --home, not the working directory', async () => {
    const errors: string[] = []
    const logs: string[] = []
    const ctx: Ctx = { cwd: path.resolve('/nowhere-night-shift'), env: {}, log: (m) => logs.push(m), error: (m) => errors.push(m) }
    const repo = path.resolve(import.meta.dirname, '..')
    expect(await runCli(['validate', '--home', repo], ctx)).toBe(0)
    expect(logs.join('\n')).toMatch(/ok/)
    expect(await runCli(['validate', '--home'], ctx)).toBe(1)
    expect(errors.at(-1)).toMatch(/--home/)
  })
})
