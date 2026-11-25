#!/usr/bin/env node
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import type { Ctx } from './commands/ctx.js'
import type { Deps } from './commands/audit.js'
import { runAudit } from './commands/audit.js'
import { runDiff } from './commands/diff.js'
import { runMcp } from './commands/mcp.js'
import { runPatrol } from './commands/patrol.js'
import { runReport } from './commands/report.js'
import { runValidate } from './commands/validate.js'
import { runVerify } from './commands/verify.js'
import { runWorkdir } from './commands/workdir.js'
import { extractHome, resolveHome } from './pure/home.js'

const USAGE = `night-shift <command> [options]

Commands:
  validate [--file patrol.yaml]
  audit [--site <name>] [--patrol-id <id>]
  diff --site <name> [--patrol-id <id>] [--json]
  verify <site> <fixDir> --haunting <id> [--base <dir>] [--apply] [--patrol-id <id>] [--attempt <n>]
  workdir <site> <haunting-id> --patrol-id <id> [--attempt <n>]
  report [--patrol-id <id>] [--publish-ui]
  patrol --no-agents [--publish-ui]
  mcp    (stdio MCP server: validate, audit, diff, workdir, verify, report, list_source, read_source, write_fix_file)

Every command also takes --home <dir>: the repository directory. Without it, NIGHT_SHIFT_HOME, then the working directory.

Exit codes: 0 ok, 1 error, 2 not supported (patrol without --no-agents, --open-prs), 3 fix rejected (verify).`

export type Flags = { str: Record<string, string | undefined>; bool: Record<string, boolean>; positionals: string[] }

/** Strict flag parsing: an unknown flag throws, which the CLI reports as exit 1. */
export function parseFlags(args: string[], strings: readonly string[], booleans: readonly string[] = [], allowPositionals = false): Flags {
  const options: Record<string, { type: 'string' | 'boolean' }> = {}
  for (const k of strings) options[k] = { type: 'string' }
  for (const k of booleans) options[k] = { type: 'boolean' }
  const parsed = parseArgs({ args, options, allowPositionals, strict: true })
  const values = parsed.values as Record<string, string | boolean | undefined>
  const str: Record<string, string | undefined> = {}
  const bool: Record<string, boolean> = {}
  for (const k of strings) str[k] = typeof values[k] === 'string' ? (values[k] as string) : undefined
  for (const k of booleans) bool[k] = values[k] === true
  return { str, bool, positionals: parsed.positionals }
}

const opt = <K extends string>(key: K, value: string | undefined): { [P in K]?: string } => (value === undefined ? {} : ({ [key]: value } as { [P in K]?: string }))

/** Run the CLI and return the exit code. Never calls process.exit. */
export async function runCli(rawArgv: string[], baseCtx: Ctx, deps: Deps = {}): Promise<number> {
  const home = extractHome(rawArgv)
  if (home.error !== undefined) {
    baseCtx.error(home.error)
    return 1
  }
  const ctx: Ctx = home.home === undefined ? baseCtx : { ...baseCtx, cwd: resolveHome({}, baseCtx.cwd, home.home) }
  const [command, ...rest] = home.argv
  try {
    switch (command) {
      case 'validate': {
        const f = parseFlags(rest, ['file'])
        return runValidate(ctx, opt('file', f.str.file)).code
      }
      case 'audit': {
        const f = parseFlags(rest, ['site', 'patrol-id', 'file'])
        return (await runAudit(ctx, { ...opt('site', f.str.site), ...opt('patrolId', f.str['patrol-id']), ...opt('file', f.str.file) }, deps)).code
      }
      case 'diff': {
        const f = parseFlags(rest, ['site', 'patrol-id', 'file'], ['json'])
        if (f.str.site === undefined) {
          ctx.error('diff needs --site <name>')
          return 1
        }
        return runDiff(ctx, { site: f.str.site, ...opt('patrolId', f.str['patrol-id']), ...opt('file', f.str.file), ...(f.bool.json ? { json: true } : {}) }).code
      }
      case 'report': {
        const f = parseFlags(rest, ['patrol-id', 'file'], ['publish-ui'])
        return (await runReport(ctx, { ...opt('patrolId', f.str['patrol-id']), ...opt('file', f.str.file), ...(f.bool['publish-ui'] ? { publishUi: true } : {}) }, deps)).code
      }
      case 'patrol': {
        const f = parseFlags(rest, ['file'], ['no-agents', 'open-prs', 'publish-ui'])
        return (
          await runPatrol(
            ctx,
            { ...opt('file', f.str.file), ...(f.bool['no-agents'] ? { noAgents: true } : {}), ...(f.bool['open-prs'] ? { openPrs: true } : {}), ...(f.bool['publish-ui'] ? { publishUi: true } : {}) },
            deps
          )
        ).code
      }
      case 'mcp': {
        parseFlags(rest, [])
        return await runMcp(ctx, deps)
      }
      case undefined:
      case '--help':
      case '-h':
      case 'help':
        ctx.log(USAGE)
        return command === undefined ? 1 : 0
      case 'verify': {
        const f = parseFlags(rest, ['haunting', 'base', 'patrol-id', 'file'], ['apply', 'recorded-attempt'], true)
        const [site, fixDir, ...extra] = f.positionals
        if (site === undefined || fixDir === undefined || extra.length > 0 || f.str.haunting === undefined) {
          ctx.error('usage: night-shift verify <site> <fixDir> --haunting <id> [--base <dir>] [--apply]')
          return 1
        }
        return (
          await runVerify(
            ctx,
            { site, fixDir, haunting: f.str.haunting, ...opt('base', f.str.base), ...opt('patrolId', f.str['patrol-id']), ...opt('file', f.str.file), ...(f.bool.apply ? { apply: true } : {}), ...(f.bool['recorded-attempt'] ? { recordedAttempt: true } : {}) },
            deps
          )
        ).code
      }
      case 'workdir': {
        const f = parseFlags(rest, ['patrol-id', 'attempt', 'file'], [], true)
        const [site, haunting, ...extra] = f.positionals
        if (site === undefined || haunting === undefined || extra.length > 0 || f.str['patrol-id'] === undefined) {
          ctx.error('usage: night-shift workdir <site> <haunting-id> --patrol-id <id> [--attempt <n>]')
          return 1
        }
        const attempt = f.str.attempt === undefined ? undefined : Number(f.str.attempt)
        return runWorkdir(ctx, { site, haunting, patrolId: f.str['patrol-id'], ...(attempt !== undefined ? { attempt } : {}), ...opt('file', f.str.file) }).code
      }
      default:
        ctx.error(`unknown command "${command}"\n${USAGE}`)
        return 1
    }
  } catch (error) {
    ctx.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}



function isMain(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isMain()) {
  const ctx: Ctx = {
    cwd: resolveHome(process.env, process.cwd()),
    env: process.env,
    log: (m) => console.log(m),
    error: (m) => console.error(m),
  }
  runCli(process.argv.slice(2), ctx).then(
    (code) => {
      process.exitCode = code
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    }
  )
}


