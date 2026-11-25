import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { writeJsonAtomic } from './fs-atomic.js'
import type { HistoryFile } from '../pure/types.js'

const hauntingSchema = z.object({
  fingerprint: z.string(),
  id: z.string(),
  type: z.string(),
  kind: z.string(),
  severity: z.enum(['Wraith', 'Restless', 'Banished']),
  selector: z.string(),
  htmlSnippet: z.string(),
  wcag: z.array(z.string()),
})

export const historySchema = z.object({
  schemaVersion: z.literal(1),
  site: z.string(),
  patrolId: z.string(),
  startedAt: z.string(),
  pages: z.array(
    z.object({
      page: z.string(),
      url: z.string(),
      score: z.number(),
      hauntings: z.array(hauntingSchema),
      error: z.string().optional(),
    })
  ),
})

export const STATE_DIR = '.night-shift'

export function historyDir(root: string, site: string): string {
  return path.join(root, STATE_DIR, 'history', site)
}

export function historyPath(root: string, site: string, patrolId: string): string {
  return path.join(historyDir(root, site), `${patrolId}.json`)
}

export function writeHistory(root: string, history: HistoryFile): string {
  const file = historyPath(root, history.site, history.patrolId)
  writeJsonAtomic(file, history)
  return file
}

/** Read one history file. A file that does not parse is ignored with a warning and returns undefined. */
export function readHistory(file: string, warn: (message: string) => void): HistoryFile | undefined {
  if (!existsSync(file)) return undefined
  try {
    return historySchema.parse(JSON.parse(readFileSync(file, 'utf8'))) as HistoryFile
  } catch (error) {
    warn(`warning: ignoring corrupt history file ${file}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
    return undefined
  }
}

/** Timestamp patrol ids (YYYYMMDDTHHmmssZ) that have a history file for the site, oldest first. Named ids such as demo-reject are only reachable by asking for them, so they never become the latest or the previous patrol. */
export function listPatrolIds(root: string, site: string): string[] {
  const dir = historyDir(root, site)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .filter((id) => /^\d{8}T\d{6}Z$/.test(id))
    .sort()
}

/** The latest valid history strictly earlier than `patrolId`. Corrupt files are skipped with a warning. */
export function readPreviousHistory(root: string, site: string, patrolId: string, warn: (m: string) => void): HistoryFile | undefined {
  const earlier = listPatrolIds(root, site).filter((id) => id < patrolId)
  for (let i = earlier.length - 1; i >= 0; i--) {
    const h = readHistory(historyPath(root, site, earlier[i]!), warn)
    if (h) return h
  }
  return undefined
}

/** The newest valid history for the site, or the one named by `patrolId`. */
export function readCurrentHistory(root: string, site: string, patrolId: string | undefined, warn: (m: string) => void): HistoryFile | undefined {
  if (patrolId !== undefined) return readHistory(historyPath(root, site, patrolId), warn)
  const ids = listPatrolIds(root, site)
  for (let i = ids.length - 1; i >= 0; i--) {
    const h = readHistory(historyPath(root, site, ids[i]!), warn)
    if (h) return h
  }
  return undefined
}


export const ARCHIVE_DIR = 'history-archive'

/**
 * Move the newest timestamp history file of the site into `.night-shift/history-archive/<site>/`, so that the next
 * patrol compares against the patrol before it. Nothing is deleted; an existing archive file is never overwritten.
 * Returns the moved patrol id, or undefined when the site has no history.
 */
export function archiveNewestHistory(root: string, site: string): { patrolId: string; to: string } | undefined {
  const ids = listPatrolIds(root, site)
  const patrolId = ids[ids.length - 1]
  if (patrolId === undefined) return undefined
  const dest = path.join(root, STATE_DIR, ARCHIVE_DIR, site)
  mkdirSync(dest, { recursive: true })
  let to = path.join(dest, `${patrolId}.json`)
  for (let n = 1; existsSync(to); n++) to = path.join(dest, `${patrolId}.${n}.json`)
  renameSync(historyPath(root, site, patrolId), to)
  return { patrolId, to }
}