import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fixRecordSchema } from '../pure/fix-record.js'
import type { FixRecord } from '../pure/fix-record.js'
import { writeJsonAtomic } from './fs-atomic.js'
import { STATE_DIR } from './history.js'

export const fixesDir = (root: string, patrolId: string): string => path.join(root, STATE_DIR, 'fixes', patrolId)
export const fixRecordPath = (root: string, patrolId: string, hauntingId: string): string => path.join(fixesDir(root, patrolId), `${hauntingId}.json`)

export function writeFixRecord(root: string, record: FixRecord): string {
  const file = fixRecordPath(root, record.patrolId, record.hauntingId)
  writeJsonAtomic(file, record)
  return file
}

export function readFixRecord(file: string, warn: (m: string) => void): FixRecord | undefined {
  try {
    return fixRecordSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
  } catch (error) {
    warn(`warning: ignoring invalid fix record ${file}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
    return undefined
  }
}

/** All valid fix records of one patrol, sorted by haunting id. */
export function readFixRecords(root: string, patrolId: string, warn: (m: string) => void): FixRecord[] {
  const dir = fixesDir(root, patrolId)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => {
      const r = readFixRecord(path.join(dir, f), warn)
      return r ? [r] : []
    })
}
