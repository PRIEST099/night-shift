import path from 'node:path'
import { loadPatrolFile } from '../io/patrol-file.js'
import { McpServerMissingError, openMcpAudit } from '../io/mcp-client.js'
import type { McpAudit } from '../io/mcp-client.js'
import { writeHistory } from '../io/history.js'
import { formatPatrolId, isValidPatrolId } from '../pure/patrol-id.js'
import type { Patrol } from '../pure/schema.js'
import type { HistoryFile } from '../pure/types.js'
import { auditSite } from './audit-site.js'
import type { Ctx } from './ctx.js'

export type Deps = {
  /** Open the audit engine. Tests inject a fake; the default starts THE UNSEEN over stdio. */
  openAudit?: (ctx: Ctx) => Promise<McpAudit>
  now?: () => Date
}

export const defaultOpenAudit = (ctx: Ctx): Promise<McpAudit> => openMcpAudit(ctx.env, ctx.cwd)

export type AuditOptions = { site?: string; patrolId?: string; file?: string }

export type AuditOutcome = { code: number; patrolId?: string; patrol?: Patrol; histories: HistoryFile[] }

/** Load patrol.yaml or print its problems. */
export function loadPatrol(ctx: Ctx, file?: string): Patrol | undefined {
  const label = file ?? 'patrol.yaml'
  const result = loadPatrolFile(path.resolve(ctx.cwd, label))
  if (!result.ok) {
    for (const p of result.problems) ctx.error(`${label}: ${p.path}: ${p.message}`)
    return undefined
  }
  return result.value
}

export async function runAudit(ctx: Ctx, opts: AuditOptions = {}, deps: Deps = {}): Promise<AuditOutcome> {
  const patrol = loadPatrol(ctx, opts.file)
  if (!patrol) return { code: 1, histories: [] }
  if (opts.patrolId !== undefined && !isValidPatrolId(opts.patrolId)) {
    ctx.error(`invalid --patrol-id "${opts.patrolId}"`)
    return { code: 1, histories: [] }
  }
  const sites = opts.site === undefined ? patrol.sites : patrol.sites.filter((s) => s.name === opts.site)
  if (sites.length === 0) {
    ctx.error(opts.site === undefined ? 'patrol.yaml has no sites' : `unknown site "${opts.site}". Known sites: ${patrol.sites.map((s) => s.name).join(', ')}`)
    return { code: 1, histories: [] }
  }
  const now = deps.now ?? (() => new Date())
  const started = now()
  const patrolId = opts.patrolId ?? formatPatrolId(started)
  let engine: McpAudit
  try {
    engine = await (deps.openAudit ?? defaultOpenAudit)(ctx)
  } catch (error) {
    if (error instanceof McpServerMissingError) ctx.error(error.message)
    else ctx.error(`could not start the audit engine: ${error instanceof Error ? error.message : String(error)}`)
    return { code: 1, histories: [] }
  }
  const histories: HistoryFile[] = []
  try {
    for (const site of sites) {
      const pages = await auditSite(engine.audit, ctx.cwd, site)
      const history: HistoryFile = { schemaVersion: 1, site: site.name, patrolId, startedAt: started.toISOString(), pages }
      writeHistory(ctx.cwd, history)
      histories.push(history)
      const count = pages.reduce((n, p) => n + p.hauntings.length, 0)
      const failed = pages.filter((p) => p.error !== undefined)
      ctx.log(`${site.name}: ${pages.length} pages audited, ${count} hauntings${failed.length ? `, ${failed.length} page error(s)` : ''} (patrol ${patrolId})`)
      for (const p of failed) ctx.error(`${site.name}: ${p.page}: ${p.error}`)
    }
  } catch (error) {
    ctx.error(`audit failed: ${error instanceof Error ? error.message : String(error)}`)
    return { code: 1, patrolId, patrol, histories }
  } finally {
    await engine.close().catch(() => undefined)
  }
  return { code: 0, patrolId, patrol, histories }
}
