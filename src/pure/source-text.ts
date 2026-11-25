/** Plain-data helpers for reading and editing source text by line. No I/O. Line numbers are 1-based. */

export const MAX_READ_CHARS = 16_000
export const MAX_FIND_MATCHES = 20
export const MAX_FIND_CHARS = 12_000
export const MAX_FIND_CONTEXT = 10
export const DEFAULT_FIND_CONTEXT = 2
const LINE_CLIP = 300

const lines = (text: string): string[] => text.split('\n').map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l))

export type ReadSlice = {
  content: string
  startLine: number
  endLine: number
  totalLines: number
  truncated: boolean
  /** Where to continue when the slice was cut short by the size cap or by endLine. Absent at the end of the file. */
  nextStartLine?: number
}

/**
 * The lines startLine..endLine (default: the whole file), cut at whole lines so that the content stays within
 * `maxChars`. The first line is always included, clipped if it alone exceeds the cap.
 */
export function sliceLines(text: string, startLine?: number, endLine?: number, maxChars = MAX_READ_CHARS): ReadSlice {
  const all = lines(text)
  // A trailing newline does not make an extra empty line.
  const total = all.length > 1 && all[all.length - 1] === '' ? all.length - 1 : all.length
  const start = startLine ?? 1
  const wanted = Math.min(endLine ?? total, total)
  if (start < 1 || (endLine !== undefined && endLine < start)) throw new RangeError('startLine must be at least 1 and endLine must not be before startLine')
  if (start > total) throw new RangeError(`startLine ${start} is past the end of the file (${total} lines)`)
  const out: string[] = []
  let used = 0
  let last = start - 1
  for (let n = start; n <= wanted; n++) {
    const line = all[n - 1]!
    const cost = line.length + 1
    if (out.length > 0 && used + cost > maxChars) break
    out.push(out.length === 0 && cost > maxChars ? line.slice(0, maxChars) : line)
    used += cost
    last = n
  }
  const truncated = last < wanted || (out.length === 1 && all[start - 1]!.length + 1 > maxChars)
  return { content: out.join('\n'), startLine: start, endLine: last, totalLines: total, truncated, ...(last < total ? { nextStartLine: last + 1 } : {}) }
}

export type FindMatch = { line: number; startLine: number; endLine: number; text: string }
export type FindResult = { matches: FindMatch[]; totalMatches: number; truncated: boolean }

const clip = (s: string, around?: number): string => {
  if (s.length <= LINE_CLIP) return s
  if (around === undefined) return `${s.slice(0, LINE_CLIP)}…`
  const from = Math.max(0, Math.min(around - LINE_CLIP / 2, s.length - LINE_CLIP))
  return `${from > 0 ? '…' : ''}${s.slice(from, from + LINE_CLIP)}${from + LINE_CLIP < s.length ? '…' : ''}`
}

/**
 * Find `query` (exact, case-sensitive; it may span lines) and return each match's first line with `context` lines
 * around it. If the exact text is absent, falls back to the query's opening tag, then to its longest line (trimmed). The result is
 * capped by match count and total characters.
 */
export function findInText(text: string, query: string, context = DEFAULT_FIND_CONTEXT): FindResult {
  const q = query.replace(/\r\n/g, '\n')
  if (q.trim() === '') throw new RangeError('query must not be empty')
  const ctx = Math.max(0, Math.min(Math.floor(context), MAX_FIND_CONTEXT))
  const all = lines(text)
  const flat = all.join('\n')
  const hits: { line: number; col: number }[] = []
  const locate = (needle: string): void => {
    let from = 0
    for (;;) {
      const at = flat.indexOf(needle, from)
      if (at < 0) break
      const before = flat.slice(0, at)
      const line = before.split('\n').length
      hits.push({ line, col: at - (before.lastIndexOf('\n') + 1) })
      from = at + Math.max(needle.length, 1)
    }
  }
  // An audit's htmlSnippet is serialized on one line, so it rarely equals the source text. Fall back to its opening
  // tag (which the source usually has verbatim), then to its longest line.
  const openingTag = /^\s*<[^<>]*>/.exec(q)?.[0].trim()
  const longest = q.split('\n').map((l) => l.trim()).sort((a, b) => b.length - a.length)[0]
  for (const needle of [q, openingTag, longest]) {
    if (needle === undefined || needle === '') continue
    locate(needle)
    if (hits.length > 0) break
  }  const matches: FindMatch[] = []
  let used = 0
  for (const h of hits.slice(0, MAX_FIND_MATCHES)) {
    const startLine = Math.max(1, h.line - ctx)
    const endLine = Math.min(all.length, h.line + ctx)
    const body: string[] = []
    for (let n = startLine; n <= endLine; n++) body.push(`${n}: ${n === h.line ? clip(all[n - 1]!, h.col) : clip(all[n - 1]!)}`)
    const t = body.join('\n')
    if (matches.length > 0 && used + t.length > MAX_FIND_CHARS) break
    used += t.length
    matches.push({ line: h.line, startLine, endLine, text: t })
  }
  return { matches, totalMatches: hits.length, truncated: matches.length < hits.length }
}

export type ReplaceResult =
  | { ok: true; text: string; line: number; endLine: number }
  | { ok: false; reason: 'empty' | 'identical' | 'missing' | 'ambiguous'; count: number; message: string }

const count = (haystack: string, needle: string): number => {
  let n = 0
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + needle.length)) n++
  return n
}

/**
 * Replace the one exact occurrence of `oldText`. Never partial: with no match, or more than one, the text is
 * returned unchanged inside a failure. Line endings in oldText and newText follow the file (CRLF stays CRLF).
 */
export function replaceUnique(text: string, oldText: string, newText: string): ReplaceResult {
  if (oldText === '') return { ok: false, reason: 'empty', count: 0, message: 'oldText must not be empty' }
  const crlf = text.includes('\r\n')
  const fit = (s: string): string => (crlf ? s.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n') : s)
  const o = fit(oldText)
  const n = fit(newText)
  if (o === n) return { ok: false, reason: 'identical', count: 0, message: 'oldText and newText are identical' }
  const c = count(text, o)
  if (c === 0) return { ok: false, reason: 'missing', count: 0, message: 'oldText was not found. Use find_in_source and a ranged read_source to copy the exact text.' }
  if (c > 1) return { ok: false, reason: 'ambiguous', count: c, message: `oldText matches ${c} times. Add more surrounding text so that it matches exactly once.` }
  const at = text.indexOf(o)
  const line = text.slice(0, at).split('\n').length
  const endLine = line + (n.split('\n').length - 1)
  return { ok: true, text: text.slice(0, at) + n + text.slice(at + o.length), line, endLine }
}
