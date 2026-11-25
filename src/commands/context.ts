import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { listPatrolIds, readCurrentHistory } from '../io/history.js'
import type { Patrol, Site } from '../pure/schema.js'
import type { HauntingRecord, HistoryFile } from '../pure/types.js'
import { resolveRepoDir } from './audit-site.js'
import type { Ctx } from './ctx.js'

export type SiteContext = {
  site: Site
  patrolId: string
  history: HistoryFile
  haunting: HauntingRecord & { page: string }
}

const isDir = (p: string): boolean => existsSync(p) && statSync(p).isDirectory()

/** Newest patrol id for a site, or the one given. */
export function pickPatrolId(ctx: Ctx, site: string, given?: string): string | undefined {
  return given ?? listPatrolIds(ctx.cwd, site).at(-1)
}

/** Find the site, its history and the haunting. On failure, prints the reason and returns undefined. */
export function locateHaunting(ctx: Ctx, patrol: Patrol, siteName: string, hauntingId: string, patrolId?: string): SiteContext | undefined {
  const site = patrol.sites.find((s) => s.name === siteName)
  if (!site) {
    ctx.error(`unknown site "${siteName}". Known sites: ${patrol.sites.map((s) => s.name).join(', ')}`)
    return undefined
  }
  const id = pickPatrolId(ctx, siteName, patrolId)
  const history = id === undefined ? undefined : readCurrentHistory(ctx.cwd, siteName, id, ctx.error)
  if (!history) {
    ctx.error(`no audit history for site "${siteName}"${patrolId ? ` and patrol ${patrolId}` : ''}. Run \`night-shift audit --site ${siteName}\` first.`)
    return undefined
  }
  for (const p of history.pages) {
    const h = p.hauntings.find((x) => x.id === hauntingId)
    if (h) return { site, patrolId: history.patrolId, history, haunting: { ...h, page: p.page } }
  }
  const known = history.pages.flatMap((p) => p.hauntings.map((h) => h.id))
  ctx.error(`unknown haunting id "${hauntingId}" in patrol ${history.patrolId}. Known ids (${known.length}):${known.slice(0, 40).map((k) => `\n  ${k}`).join('')}${known.length > 40 ? '\n  ...' : ''}`)
  return undefined
}

/** The base directory a fix starts from: the fixed directory if it exists, else the source directory. */
export function defaultBase(ctx: Ctx, site: Site): string {
  if (site.fixedDir !== undefined) {
    const fixed = resolveRepoDir(ctx.cwd, site.fixedDir)
    if (isDir(fixed)) return fixed
  }
  if (site.source === undefined) throw new Error(`site "${site.name}" has no source directory`)
  return resolveRepoDir(ctx.cwd, site.source)
}

export const toPosix = (p: string): string => p.split(path.sep).join('/')
