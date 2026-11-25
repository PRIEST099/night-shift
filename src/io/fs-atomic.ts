import { mkdirSync, renameSync, writeFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

/** Write to a temp file in the same directory, then rename over the target, so readers never see a partial file. */
export function writeFileAtomic(file: string, data: string): void {
  mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  try {
    writeFileSync(tmp, data, 'utf8')
    renameSync(tmp, file)
  } catch (error) {
    rmSync(tmp, { force: true })
    throw error
  }
}

export function writeJsonAtomic(file: string, value: unknown): void {
  writeFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`)
}
