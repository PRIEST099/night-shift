import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { findInText, MAX_FIND_CHARS, MAX_FIND_MATCHES, MAX_READ_CHARS, replaceUnique, sliceLines } from '../src/pure/source-text.js'

const runs = { numRuns: 100 }
const lineText = fc.string({ maxLength: 60 }).map((s) => s.replace(/[\r\n]/g, ' '))
// A trailing empty line is the file's final newline, which is not a line of its own.
const doc = fc.array(lineText, { minLength: 1, maxLength: 80 }).filter((ls) => ls[ls.length - 1] !== '')

describe('sliceLines', () => {
  test('property: a slice is the requested lines, within the cap, and the next start continues exactly', () => {
    fc.assert(
      fc.property(doc, fc.integer({ min: 1, max: 80 }), fc.integer({ min: 0, max: 40 }), fc.integer({ min: 1, max: 400 }), (ls, start, span, cap) => {
        const text = ls.join('\n')
        fc.pre(start <= ls.length)
        const end = Math.min(ls.length, start + span)
        const s = sliceLines(text, start, end, cap)
        expect(s.startLine).toBe(start)
        expect(s.totalLines).toBe(ls.length)
        expect(s.endLine).toBeGreaterThanOrEqual(start)
        expect(s.endLine).toBeLessThanOrEqual(end)
        expect(s.content).toBe(ls.slice(start - 1, s.endLine).join('\n').slice(0, s.endLine === start ? cap : undefined))
        if (s.endLine > start) expect(s.content.length).toBeLessThanOrEqual(cap)
        if (s.endLine < ls.length) expect(s.nextStartLine).toBe(s.endLine + 1)
        else expect(s.nextStartLine).toBeUndefined()
      }),
      runs
    )
  })

  test('walking nextStartLine reads the whole file with no gap and no overlap, and no call exceeds the cap', () => {
    fc.assert(
      fc.property(doc, fc.integer({ min: 70, max: 300 }), (ls, cap) => {
        const text = ls.join('\n')
        const got: string[] = []
        let at: number | undefined = 1
        while (at !== undefined) {
          const s = sliceLines(text, at, undefined, cap)
          expect(s.content.length).toBeLessThanOrEqual(cap)
          got.push(s.content)
          at = s.nextStartLine
        }
        expect(got.join('\n')).toBe(text)
      }),
      runs
    )
  })

  test('the default cap is below the 30,000 character tool limit, and a bad range is an error', () => {
    expect(MAX_READ_CHARS).toBeLessThan(30_000 / 1.5)
    expect(() => sliceLines('a\nb', 3)).toThrow()
    expect(() => sliceLines('a\nb', 2, 1)).toThrow()
    expect(sliceLines('a\nb\n').totalLines).toBe(2)
  })
})

describe('findInText', () => {
  test('property: every reported line really contains the query and is within the caps', () => {
    fc.assert(
      fc.property(doc, fc.integer({ min: 0, max: 10 }), (ls, context) => {
        const needle = 'NEEDLE'
        const withNeedles = ls.map((l, i) => (i % 3 === 0 ? `${l}${needle}` : l))
        const r = findInText(withNeedles.join('\n'), needle, context)
        expect(r.totalMatches).toBe(withNeedles.filter((l) => l.includes(needle)).length)
        expect(r.matches.length).toBeLessThanOrEqual(MAX_FIND_MATCHES)
        for (const m of r.matches) {
          expect(withNeedles[m.line - 1]).toContain(needle)
          expect(m.startLine).toBe(Math.max(1, m.line - context))
          expect(m.endLine).toBe(Math.min(ls.length, m.line + context))
        }
        expect(r.matches.reduce((n, m) => n + m.text.length, 0)).toBeLessThanOrEqual(MAX_FIND_CHARS + 400)
      }),
      runs
    )
  })

  test('finds a multi-line snippet, falls back to its longest line, and refuses an empty query', () => {
    const text = '<div>\n  <button class="a b">\n    <svg/>\n  </button>\n</div>'
    expect(findInText(text, '<button class="a b">\n    <svg/>').matches[0]!.line).toBe(2)
    expect(findInText(text, '<button class="a b">\n    <svg/>\n  </button> ').matches[0]!.line).toBe(2)
    // An audit snippet is one serialized line; its opening tag is in the source.
    const snippet = '<button class="a b"><svg></svg></button>'
    expect(findInText(text, snippet).matches[0]!.line).toBe(2)
    expect(() => findInText(text, '  ')).toThrow()
    expect(findInText(text, 'absent').totalMatches).toBe(0)
  })

  test('a long single line is clipped around the match', () => {
    const line = `${'x'.repeat(5000)}TARGET${'y'.repeat(5000)}`
    const r = findInText(line, 'TARGET')
    expect(r.matches[0]!.text).toContain('TARGET')
    expect(r.matches[0]!.text.length).toBeLessThan(400)
  })
})

describe('replaceUnique', () => {
  const part = fc.string({ maxLength: 30 })

  test('property: with exactly one occurrence only that occurrence changes; line is where it was', () => {
    fc.assert(
      fc.property(part, part, part, (before, after, replacement) => {
        const oldText = '@@old@@'
        fc.pre(!before.includes('@@old') && !after.includes('old@@') && replacement !== oldText)
        fc.pre(!`${before}${oldText}${after}`.slice(1).includes(oldText) || true)
        const text = before + oldText + after
        fc.pre(text.split(oldText).length === 2)
        const r = replaceUnique(text, oldText, replacement)
        expect(r.ok).toBe(true)
        if (!r.ok) return
        expect(r.text).toBe(before + replacement + after)
        expect(r.line).toBe(before.replace(/\r\n/g, '\n').split('\n').length)
      }),
      runs
    )
  })

  test('property: zero or several occurrences fail and report the count', () => {
    fc.assert(
      fc.property(part, fc.integer({ min: 2, max: 5 }), (sep, n) => {
        const text = Array(n).fill('<b>').join(sep)
        fc.pre(text.split('<b>').length - 1 === n)
        const many = replaceUnique(text, '<b>', '<i>')
        expect(many).toMatchObject({ ok: false, reason: 'ambiguous', count: n })
        expect(replaceUnique(text, 'zzz-not-there', 'x')).toMatchObject({ ok: false, reason: 'missing' })
      }),
      runs
    )
  })

  test('empty and identical replacements fail; CRLF files keep CRLF', () => {
    expect(replaceUnique('abc', '', 'x')).toMatchObject({ ok: false, reason: 'empty' })
    expect(replaceUnique('abc', 'b', 'b')).toMatchObject({ ok: false, reason: 'identical' })
    const r = replaceUnique('a\r\nb\r\nc', 'b\nc', 'b\nd\nc')
    expect(r).toMatchObject({ ok: true, text: 'a\r\nb\r\nd\r\nc', line: 2, endLine: 4 })
  })
})
