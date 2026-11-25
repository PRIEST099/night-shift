import { readCurrentHistory, readPreviousHistory } from '../io/history.js'
import { diffPatrols, workList } from '../pure/diff.js'
import type { PatrolDiff, DiffItem } from '../pure/diff.js'
import type { HistoryFile } from '../pure/types.js'
import { loadPatrol } from './audit.js'
import type { Ctx } from './ctx.js'

export type DiffOptions = { site: string; patrolId?: string; json?: boolean; file?: string }

export type DiffOutput = {
  site: string
  patrolId: string
  previousPatrolId: string | null
  new: DiffItem[]
  worsened: DiffItem[]
  resolved: DiffItem[]
  workList: DiffItem[]
}

export function computeDiff(current: HistoryFile, previous: HistoryFile | undefined, maxFixesPerSite: number): DiffOutput {
  const d: PatrolDiff = diffPatrols(previous, current)
  return { site: current.site, patrolId: current.patrolId, previousPatrolId: previous?.patrolId ?? null, ...d, workList: workList(d, maxFixesPerSite) }
}

function line(h: DiffItem): string {
  return `  ${h.severity} ${h.type}${h.kind ? `/${h.kind}` : ''} on ${h.page} [${h.id}] ${h.htmlSnippet.slice(0, 80)}`
}

export function runDiff(ctx: Ctx, opts: DiffOptions): { code: number; output?: DiffOutput } {
  const patrol = loadPatrol(ctx, opts.file)
  if (!patrol) return { code: 1 }
  if (!patrol.sites.some((s) => s.name === opts.site)) {
    ctx.error(`unknown site "${opts.site}". Known sites: ${patrol.sites.map((s) => s.name).join(', ')}`)
    return { code: 1 }
  }
  const current = readCurrentHistory(ctx.cwd, opts.site, opts.patrolId, ctx.error)
  if (!current) {
    ctx.error(`no history for site "${opts.site}"${opts.patrolId ? ` and patrol ${opts.patrolId}` : ''}. Run \`night-shift audit --site ${opts.site}\` first.`)
    return { code: 1 }
  }
  const previous = readPreviousHistory(ctx.cwd, opts.site, current.patrolId, ctx.error)
  const output = computeDiff(current, previous, patrol.maxFixesPerSite)
  if (opts.json) ctx.log(JSON.stringify(output, null, 2))
  else {
    ctx.log(`${output.site}: patrol ${output.patrolId} vs ${output.previousPatrolId ?? 'no earlier patrol'}`)
    for (const k of ['new', 'worsened', 'resolved'] as const) {
      ctx.log(`${k}: ${output[k].length}`)
      for (const h of output[k]) ctx.log(line(h))
    }
    ctx.log(`workList: ${output.workList.length}`)
    for (const h of output.workList) ctx.log(line(h))
  }
  return { code: 0, output }
}
