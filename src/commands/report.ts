import { existsSync } from 'node:fs'
import path from 'node:path'
import { readFixRecords } from '../io/fixes.js'
import { writeFileAtomic, writeJsonAtomic } from '../io/fs-atomic.js'
import { listPatrolIds, readCurrentHistory, readPreviousHistory } from '../io/history.js'
import { renderReport } from '../pure/render-report.js'
import { buildReport, meanScore, reportSchema } from '../pure/report.js'
import type { Report, SiteInput } from '../pure/report.js'
import { isValidPatrolId } from '../pure/patrol-id.js'
import { auditServedDir, resolveRepoDir } from './audit-site.js'
import { defaultOpenAudit, loadPatrol } from './audit.js'
import type { Deps } from './audit.js'
import type { Ctx } from './ctx.js'
import type { McpAudit } from '../io/mcp-client.js'

export type ReportOptions = { patrolId?: string; publishUi?: boolean; file?: string }

export const UI_REPORT_PATH = 'ui/src/last-report.json'

export async function runReport(ctx: Ctx, opts: ReportOptions = {}, deps: Deps = {}): Promise<{ code: number; report?: Report }> {
  const patrol = loadPatrol(ctx, opts.file)
  if (!patrol) return { code: 1 }
  if (opts.patrolId !== undefined && !isValidPatrolId(opts.patrolId)) {
    ctx.error(`invalid --patrol-id "${opts.patrolId}"`)
    return { code: 1 }
  }
  const patrolId = opts.patrolId ?? patrol.sites.flatMap((s) => listPatrolIds(ctx.cwd, s.name)).sort().at(-1)
  if (patrolId === undefined) {
    ctx.error('no audit history found. Run `night-shift audit` or `night-shift patrol --no-agents` first.')
    return { code: 1 }
  }
  const inputs: SiteInput[] = []
  let engine: McpAudit | undefined
  try {
    for (const site of patrol.sites) {
      const current = readCurrentHistory(ctx.cwd, site.name, patrolId, ctx.error)
      const previous = current ? readPreviousHistory(ctx.cwd, site.name, current.patrolId, ctx.error) : undefined
      const fixes = readFixRecords(ctx.cwd, patrolId, ctx.error).filter((f) => f.site === site.name)
      let rescoredAfter: number | undefined
      if (fixes.some((f) => f.decision === 'keep') && site.fixedDir !== undefined) {
        const fixedDir = resolveRepoDir(ctx.cwd, site.fixedDir)
        if (existsSync(fixedDir)) {
          try {
            engine ??= await (deps.openAudit ?? defaultOpenAudit)(ctx)
            rescoredAfter = meanScore(await auditServedDir(engine.audit, fixedDir, site.pages))
          } catch (error) {
            ctx.error(`warning: could not re-audit ${site.fixedDir}: ${error instanceof Error ? error.message : String(error)}. scoreAfter uses the current score.`)
          }
        }
      }
      inputs.push({ name: site.name, owner: site.owner, maxFixesPerSite: patrol.maxFixesPerSite, current, previous, fixes, rescoredAfter })
    }
  } finally {
    await engine?.close().catch(() => undefined)
  }
  const now = (deps.now ?? (() => new Date()))()
  const report = reportSchema.parse(buildReport(patrolId, now.toISOString(), inputs))
  writeFileAtomic(path.join(ctx.cwd, 'REPORT.md'), renderReport(report))
  writeJsonAtomic(path.join(ctx.cwd, 'report.json'), report)
  ctx.log(`report: patrol ${patrolId}, ${report.sites.length} site(s). Wrote REPORT.md and report.json`)
  if (opts.publishUi) {
    writeJsonAtomic(path.join(ctx.cwd, UI_REPORT_PATH), report)
    ctx.log(`published ${UI_REPORT_PATH}. Run \`npm run build:ui\` to rebuild the dashboard page.`)
  }
  return { code: 0, report }
}
