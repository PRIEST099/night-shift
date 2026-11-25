export type Normalized = { ok: true; segments: string[] } | { ok: false; reason: string }

/**
 * Normalize a path an agent supplied so that it can only name something below a directory.
 * Accepts `/` and `\` as separators, drops `.` and empty segments, and rejects: a NUL or control
 * character, a leading separator, a drive letter or any `:`, a `..` segment, and a segment that ends
 * in a dot or a space (Windows trims those, so `.. ` would mean `..`). The empty path and `.` give
 * zero segments, the directory itself.
 */
export function normalizeRelative(input: string): Normalized {
  if (typeof input !== 'string') return { ok: false, reason: 'path must be a string' }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(input)) return { ok: false, reason: 'path contains a control character' }
  if (input.startsWith('/') || input.startsWith('\\')) return { ok: false, reason: 'path must be relative, not absolute' }
  if (/^[a-zA-Z]:/.test(input)) return { ok: false, reason: 'path must be relative, not absolute' }
  const segments: string[] = []
  for (const seg of input.split(/[\\/]+/)) {
    if (seg === '' || seg === '.') continue
    if (seg.includes(':')) return { ok: false, reason: 'path must not contain ":"' }
    if (/[. ]$/.test(seg)) return { ok: false, reason: seg === '..' ? 'path must not contain ".."' : `path segment "${seg}" ends in a dot or a space` }
    segments.push(seg)
  }
  return { ok: true, segments }
}
