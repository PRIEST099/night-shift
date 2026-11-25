import type { Reason } from './fix-record.js'

export const ALLOWED_EXTENSIONS = ['html', 'css', 'js', 'svg', 'json'] as const

export type FileChange = {
  /** Path relative to the site directory, with `/` separators. */
  path: string
  /** Text of the base file; undefined when the file is new. */
  base: string | undefined
  /** Text of the fixed file; undefined for a binary file, whose content cannot be checked and is treated as unchanged. */
  fix: string | undefined
}

const extOf = (p: string): string => {
  const name = p.split('/').pop() ?? p
  const i = name.lastIndexOf('.')
  return i <= 0 ? '' : name.slice(i + 1).toLowerCase()
}

export function countScripts(text: string): number {
  return (text.match(/<script\b/gi) ?? []).length
}

/** Number of CSS declaration blocks and `style` attributes that set `position: fixed` together with a `z-index`. */
export function countFixedOverlays(text: string): number {
  const blocks = text.match(/\{[^{}]*\}|style\s*=\s*"[^"]*"|style\s*=\s*'[^']*'/gi) ?? []
  return blocks.filter((b) => /position\s*:\s*fixed/i.test(b) && /z-index\s*:/i.test(b)).length
}

/** Source-fix rules: allowed extensions only, no new script element, no new fixed-position overlay. */
export function checkSafety(changes: readonly FileChange[]): Reason[] {
  const reasons: Reason[] = []
  for (const c of changes) {
    const ext = extOf(c.path)
    if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      reasons.push({
        code: 'unsafe-change',
        message: `unsafe-change: ${c.path} is not an allowed file type (allowed: ${ALLOWED_EXTENSIONS.join(', ')})`,
        snippet: c.path,
      })
      continue
    }
    if (c.fix === undefined) continue
    const base = c.base ?? ''
    if (countScripts(c.fix) > countScripts(base)) {
      reasons.push({ code: 'unsafe-change', message: `unsafe-change: ${c.path} adds a <script> element`, snippet: c.path })
    }
    if (countFixedOverlays(c.fix) > countFixedOverlays(base)) {
      reasons.push({ code: 'unsafe-change', message: `unsafe-change: ${c.path} adds a fixed-position overlay (position: fixed with z-index)`, snippet: c.path })
    }
  }
  return reasons
}
