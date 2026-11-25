#!/usr/bin/env node
// Stop hook. Runs `npm test` and exits 1 (short message on stderr) when tests fail, which blocks the end of the agent's turn.
// Exits 0 without running tests when nothing under src/, ui/src/, agents/, skills/ or app.json changed since the last pass.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const WATCHED = ['src', 'ui/src', 'agents', 'skills', 'app.json']
export const MAX_MESSAGE = 2800
const STAMP = path.join('.night-shift', 'test-gate.json')

/** Newest modification time (ms) among the watched files. 0 if none exist. */
export function newestChange(root) {
  let newest = 0
  const visit = (p) => {
    if (!existsSync(p)) return
    const s = statSync(p)
    if (s.isDirectory()) {
      for (const e of readdirSync(p)) visit(path.join(p, e))
    } else newest = Math.max(newest, s.mtimeMs)
  }
  for (const w of WATCHED) visit(path.join(root, w))
  return newest
}

export function failureMessage(output) {
  const tail = output.trim().split(/\r?\n/).slice(-40).join('\n')
  const body = tail.length > MAX_MESSAGE ? `...${tail.slice(-MAX_MESSAGE)}` : tail
  return `Tests failed. Fix them before finishing.\n${body}`
}

/** Returns { code, message? }. `runner` is a shell command string. */
export function runGate(root, runner) {
  const newest = newestChange(root)
  const stampFile = path.join(root, STAMP)
  if (existsSync(stampFile)) {
    try {
      const last = JSON.parse(readFileSync(stampFile, 'utf8'))
      if (typeof last.passedAt === 'number' && newest <= last.passedAt) return { code: 0 }
    } catch {
      // A corrupt stamp means "run the tests".
    }
  }
  const r = spawnSync(runner, { cwd: root, shell: true, encoding: 'utf8', timeout: 280_000, maxBuffer: 20 * 1024 * 1024 })
  if (r.status === 0) {
    mkdirSync(path.dirname(stampFile), { recursive: true })
    writeFileSync(stampFile, JSON.stringify({ passedAt: Math.max(newest, Date.now()) }))
    return { code: 0 }
  }
  return { code: 1, message: failureMessage(`${r.stdout ?? ''}\n${r.stderr ?? ''}\n${r.error ? String(r.error) : ''}`) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.env.NIGHT_SHIFT_GATE_ROOT ?? process.cwd()
  const runner = process.env.NIGHT_SHIFT_GATE_RUNNER ?? 'npm test'
  const result = runGate(root, runner)
  if (result.message) console.error(result.message)
  process.exit(result.code)
}
