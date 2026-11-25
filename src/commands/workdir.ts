import { existsSync } from 'node:fs'
import path from 'node:path'
import { copyDir } from '../io/copy-dir.js'
import { isValidPatrolId } from '../pure/patrol-id.js'
import { resolveRepoDir } from './audit-site.js'
import { loadPatrol } from './audit.js'
import { defaultBase, locateHaunting, toPosix } from './context.js'
import type { Ctx } from './ctx.js'

export type WorkdirOptions = { site: string; haunting: string; patrolId: string; attempt?: number; file?: string }

export const DEFAULT_WORK_ROOT = 'demo/work'

/** Copy the base directory to `<workRoot>/<patrol-id>/<haunting-id>[-<attempt>]` and print the path. Refuses an existing path. */
export function runWorkdir(ctx: Ctx, opts: WorkdirOptions): { code: number; dir?: string } {
  const patrol = loadPatrol(ctx, opts.file)
  if (!patrol) return { code: 1 }
  if (!isValidPatrolId(opts.patrolId)) {
    ctx.error(`invalid --patrol-id "${opts.patrolId}"`)
    return { code: 1 }
  }
  if (opts.attempt !== undefined && (!Number.isInteger(opts.attempt) || opts.attempt < 1)) {
    ctx.error('--attempt must be a positive integer')
    return { code: 1 }
  }
  const located = locateHaunting(ctx, patrol, opts.site, opts.haunting, opts.patrolId)
  if (!located) return { code: 1 }
  const { site, haunting } = located
  const root = resolveRepoDir(ctx.cwd, site.workRoot ?? DEFAULT_WORK_ROOT)
  const name = opts.attempt !== undefined ? `${haunting.id}-${opts.attempt}` : haunting.id
  const dest = path.join(root, opts.patrolId, name)
  if (existsSync(dest)) {
    ctx.error(`${toPosix(path.relative(ctx.cwd, dest))} already exists. Use --attempt <n> to create a new directory with a suffix.`)
    return { code: 1 }
  }
  copyDir(defaultBase(ctx, site), dest)
  ctx.log(toPosix(path.relative(ctx.cwd, dest)))
  return { code: 0, dir: dest }
}
