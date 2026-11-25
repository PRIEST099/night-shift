import { runAudit } from './audit.js'
import type { Deps } from './audit.js'
import { runDiff } from './diff.js'
import { runReport } from './report.js'
import { runValidate } from './validate.js'
import type { Ctx } from './ctx.js'

export type PatrolOptions = { noAgents?: boolean; openPrs?: boolean; file?: string; publishUi?: boolean }

/** Exit 0 when the patrol completed (even with hauntings), 1 on a schema error or missing audit engine, 2 when the request is not supported. */
export async function runPatrol(ctx: Ctx, opts: PatrolOptions = {}, deps: Deps = {}): Promise<{ code: number }> {
  if (opts.openPrs) {
    ctx.error('--open-prs is future work and is not implemented. Night Shift applies kept fixes to a local fixed directory and never pushes or opens pull requests.')
    return { code: 2 }
  }
  if (!opts.noAgents) {
    ctx.error('Fixes are driven by the Warden through Kiro Crew. Start it with: kirocrew app enable night-shift, then ask the warden to run the patrol. For an audit and report without agents, run: night-shift patrol --no-agents')
    return { code: 2 }
  }
  const validated = runValidate(ctx, opts.file !== undefined ? { file: opts.file } : {})
  if (validated.code !== 0) return { code: 1 }
  const audited = await runAudit(ctx, opts.file !== undefined ? { file: opts.file } : {}, deps)
  if (audited.code !== 0 || audited.patrolId === undefined || audited.patrol === undefined) return { code: 1 }
  for (const site of audited.patrol.sites) {
    const d = runDiff(ctx, { site: site.name, patrolId: audited.patrolId, ...(opts.file !== undefined ? { file: opts.file } : {}) })
    if (d.code !== 0) return { code: 1 }
  }
  const reported = await runReport(ctx, { patrolId: audited.patrolId, ...(opts.file !== undefined ? { file: opts.file } : {}), ...(opts.publishUi ? { publishUi: true } : {}) }, deps)
  return { code: reported.code === 0 ? 0 : 1 }
}
