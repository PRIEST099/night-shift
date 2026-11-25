import { lstatSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { normalizeRelative } from '../pure/confine.js'

export class ConfineError extends Error {}

const inside = (root: string, target: string): boolean => {
  const r = path.relative(root, target)
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r))
}

/**
 * Resolve `input` below `root`. Throws a ConfineError for `..`, an absolute path, or a path that reaches
 * outside `root` through a symlink (the deepest existing part of the path is resolved with realpath).
 * Returns the absolute path; it need not exist. With `allowRoot` false the empty path is refused.
 */
export function resolveInside(root: string, input: string, allowRoot = false): string {
  const n = normalizeRelative(input)
  if (!n.ok) throw new ConfineError(n.reason)
  if (n.segments.length === 0 && !allowRoot) throw new ConfineError('path must name a file below the directory')
  let realRoot: string
  try {
    realRoot = realpathSync(root)
  } catch {
    throw new ConfineError(`directory does not exist: ${root}`)
  }
  const target = path.join(realRoot, ...n.segments)
  let probe = target
  for (;;) {
    let exists = true
    try {
      lstatSync(probe)
    } catch {
      exists = false
    }
    if (exists) {
      let real: string
      try {
        real = realpathSync(probe)
      } catch {
        throw new ConfineError('path goes through a broken symlink')
      }
      if (!inside(realRoot, real)) throw new ConfineError('path leaves the directory through a symlink')
      break
    }
    const parent = path.dirname(probe)
    if (parent === probe) break
    probe = parent
  }
  return target
}
