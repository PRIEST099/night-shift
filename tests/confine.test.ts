import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import fc from 'fast-check'
import { afterAll, describe, expect, test } from 'vitest'
import { ConfineError, resolveInside } from '../src/io/confine.js'
import { normalizeRelative } from '../src/pure/confine.js'

const runs = { numRuns: 200 }

const segment = fc.oneof(
  fc.constantFrom('..', '.', '', '...', '.. ', ' ..', 'a', 'b.html', 'C:', 'c:x', 'a:b', 'x\0y', 'img', 'a b', '~', '%2e%2e'),
  fc.string({ maxLength: 6 })
)
const separator = fc.constantFrom('/', '\\', '//', '\\/')
const messyPath = fc
  .tuple(fc.constantFrom('', '/', '\\', 'C:\\', 'c:/', '\\\\server\\share\\', './'), fc.array(fc.tuple(segment, separator), { maxLength: 6 }))
  .map(([prefix, parts]) => prefix + parts.map(([s, sep]) => s + sep).join(''))

describe('normalizeRelative (pure)', () => {
  test('property: an accepted path has no "..", no ":", no empty or dot segment, and is never absolute', () => {
    fc.assert(
      fc.property(fc.oneof(messyPath, fc.string({ maxLength: 40 }), fc.fullUnicodeString({ maxLength: 20 })), (input) => {
        const n = normalizeRelative(input)
        if (!n.ok) return true
        for (const s of n.segments) {
          expect(s).not.toBe('')
          expect(s).not.toBe('.')
          expect(s).not.toBe('..')
          expect(s).not.toMatch(/[:\\/\0]/)
          expect(s).not.toMatch(/[. ]$/)
        }
        const joined = path.join('/base', ...n.segments)
        expect(path.relative('/base', joined).startsWith('..')).toBe(false)
        return true
      }),
      runs
    )
  })

  test('property: any input with a ".." segment is rejected, whatever the separators', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom('a', 'b', 'img'), { maxLength: 3 }), fc.array(fc.constantFrom('a', 'b'), { maxLength: 3 }), separator, separator, (before, after, s1, s2) => {
        const input = [...before, '..', ...after].join(s1) + s2 + 'x'
        return !normalizeRelative(input).ok
      }),
      runs
    )
  })

  test('property: absolute paths are rejected (posix, UNC, drive letters)', () => {
    fc.assert(
      fc.property(fc.constantFrom('/', '\\', '\\\\', 'C:\\', 'c:/', 'D:'), fc.string({ maxLength: 20 }), (prefix, rest) => !normalizeRelative(prefix + rest).ok),
      runs
    )
  })

  test('property: a clean relative path normalizes to its own segments and is idempotent', () => {
    const clean = fc.array(fc.stringMatching(/^[a-z0-9][a-z0-9_-]{0,7}(\.[a-z]{1,4})?$/), { minLength: 1, maxLength: 5 })
    fc.assert(
      fc.property(clean, separator, (segs, sep) => {
        const n = normalizeRelative(segs.join(sep))
        expect(n).toEqual({ ok: true, segments: segs })
        if (n.ok) expect(normalizeRelative(n.segments.join('/'))).toEqual(n)
        return true
      }),
      runs
    )
  })

  test('the empty path and "." are the directory itself', () => {
    expect(normalizeRelative('')).toEqual({ ok: true, segments: [] })
    expect(normalizeRelative('.')).toEqual({ ok: true, segments: [] })
    expect(normalizeRelative('./a//b')).toEqual({ ok: true, segments: ['a', 'b'] })
  })
})

const tmp = mkdtempSync(path.join(tmpdir(), 'ns-confine-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))
const root = path.join(tmp, 'root')
const outside = path.join(tmp, 'outside')
mkdirSync(path.join(root, 'sub'), { recursive: true })
mkdirSync(outside)
writeFileSync(path.join(root, 'sub', 'a.html'), 'x')
writeFileSync(path.join(outside, 'secret.txt'), 'secret')

// A junction needs no privilege on Windows; a file symlink may be refused there.
let dirLinks = true
let fileLinks = true
try {
  symlinkSync(outside, path.join(root, 'dirlink'), 'junction')
} catch {
  dirLinks = false
}
try {
  symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'filelink.txt'), 'file')
} catch {
  fileLinks = false
}

describe('resolveInside (io)', () => {
  test('property: for any input the result is inside the root or a ConfineError is thrown', () => {
    const real = path.resolve(root)
    fc.assert(
      fc.property(fc.oneof(messyPath, fc.string({ maxLength: 30 })), (input) => {
        try {
          const p = resolveInside(root, input, true)
          const rel = path.relative(real, p)
          expect(rel.startsWith('..') || path.isAbsolute(rel)).toBe(false)
        } catch (error) {
          expect(error).toBeInstanceOf(ConfineError)
        }
        return true
      }),
      runs
    )
  })

  test('accepts files and not-yet-existing files below the root', () => {
    expect(resolveInside(root, 'sub/a.html')).toBe(path.join(path.resolve(root), 'sub', 'a.html'))
    expect(resolveInside(root, 'sub\\new\\b.css')).toBe(path.join(path.resolve(root), 'sub', 'new', 'b.css'))
  })

  test('rejects "..", absolute paths, drive letters and the empty path', () => {
    for (const bad of ['../outside/secret.txt', 'sub/../../outside', '..\\x', '/etc/passwd', 'C:\\Windows\\win.ini', path.join(outside, 'secret.txt'), '', '.']) {
      expect(() => resolveInside(root, bad), bad).toThrow(ConfineError)
    }
  })

  test.skipIf(!fileLinks)('rejects a file symlink that leaves the tree', () => {
    expect(() => resolveInside(root, 'filelink.txt')).toThrow(ConfineError)
  })

  test.skipIf(!dirLinks)('rejects a directory link that leaves the tree, for reads and for new files below it', () => {
    expect(() => resolveInside(root, 'dirlink/secret.txt')).toThrow(ConfineError)
    expect(() => resolveInside(root, 'dirlink/new.txt')).toThrow(ConfineError)
    expect(existsSync(path.join(outside, 'new.txt'))).toBe(false)
  })

  test('a missing root is a ConfineError', () => {
    expect(() => resolveInside(path.join(tmp, 'nope'), 'a')).toThrow(ConfineError)
  })
})
