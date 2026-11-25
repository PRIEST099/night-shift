import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/** Files under `dir`, relative, with `/` separators, sorted. */
export function listFiles(dir: string): string[] {
  const out: string[] = []
  const walk = (rel: string): void => {
    for (const entry of readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel === '' ? entry.name : `${rel}/${entry.name}`
      if (entry.isDirectory()) walk(r)
      else if (entry.isFile()) out.push(r)
    }
  }
  walk('')
  return out.sort()
}

export function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true })
  cpSync(src, dest, { recursive: true })
}

/** Files in `fixDir` that are new or differ in bytes from `baseDir`. Deleted files are not reported. */
export function changedFiles(baseDir: string, fixDir: string): string[] {
  return listFiles(fixDir).filter((f) => {
    const b = path.join(baseDir, f)
    if (!existsSync(b) || !statSync(b).isFile()) return true
    return !readFileSync(b).equals(readFileSync(path.join(fixDir, f)))
  })
}

export function copyFiles(fromDir: string, toDir: string, files: readonly string[]): void {
  for (const f of files) {
    const dest = path.join(toDir, f)
    mkdirSync(path.dirname(dest), { recursive: true })
    cpSync(path.join(fromDir, f), dest)
  }
}

export function isProbablyBinary(buf: Buffer): boolean {
  return buf.subarray(0, 8000).includes(0)
}
