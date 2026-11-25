import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { resolveServerPath, MCP_ENV_VAR } from '../../src/io/mcp-client.js'
import type { Ctx } from '../../src/commands/ctx.js'

export const repoRoot = path.resolve(import.meta.dirname, '..', '..')
export const serverPath = resolveServerPath(process.env, repoRoot)
export const serverAvailable = existsSync(serverPath)

/** Integration tests skip with a clear message when the sibling server is not built, and fail when the variable is set but wrong (CI). */
export function integrationGate(): { skip: boolean; reason: string } {
  if (serverAvailable) return { skip: false, reason: '' }
  const configured = process.env[MCP_ENV_VAR]
  const reason = `${MCP_ENV_VAR} does not resolve (looked for ${serverPath}). Build ../the-unseen (npm run build) or set ${MCP_ENV_VAR}.`
  if (configured) throw new Error(`${MCP_ENV_VAR} is set to ${configured} but the file does not exist`)
  console.warn(`SKIPPED integration tests: ${reason}`)
  return { skip: true, reason }
}

export function makeIntRepo(copies: string[]): { root: string; ctx: Ctx; out: string[]; err: string[]; cleanup: () => void } {
  const root = mkdtempSync(path.join(tmpdir(), 'ns-int-'))
  for (const rel of copies) cpSync(path.join(repoRoot, rel), path.join(root, rel), { recursive: true })
  const out: string[] = []
  const err: string[] = []
  const ctx: Ctx = {
    cwd: root,
    env: { ...process.env, [MCP_ENV_VAR]: serverPath, UNSEEN_CHROMIUM_CHANNEL: process.env.UNSEEN_CHROMIUM_CHANNEL ?? 'chromium' },
    log: (m) => out.push(m),
    error: (m) => err.push(m),
  }
  return { root, ctx, out, err, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}
