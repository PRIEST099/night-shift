import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { changedFiles, copyDir, copyFiles, isProbablyBinary } from '../io/copy-dir.js'
import { fixRecordPath, writeFixRecord } from '../io/fixes.js'
import { readFixRecord } from '../io/fixes.js'
import { decide } from '../pure/decide.js'
import type { FixRecord, Reason } from '../pure/fix-record.js'
import { checkSafety } from '../pure/safety.js'
import type { FileChange } from '../pure/safety.js'
import type { PageRecord } from '../pure/types.js'
import { auditServedDir, resolveRepoDir } from './audit-site.js'
import { defaultOpenAudit, loadPatrol } from './audit.js'
import type { Deps } from './audit.js'
import { defaultBase, locateHaunting } from './context.js'
import type { Ctx } from './ctx.js'
import { McpServerMissingError } from '../io/mcp-client.js'
import type { McpAudit } from '../io/mcp-client.js'

export type VerifyOptions = {
  site: string
  fixDir: string
  haunting: string
  base?: string
  apply?: boolean
  patrolId?: string
  file?: string
  /** Mark the fix as a committed, recorded attempt instead of an agent run. */
  recordedAttempt?: boolean
}

const scores = (pages: readonly PageRecord[]): Record<string, number> => Object.fromEntries(pages.map((p) => [p.page, p.score]))

function fileChanges(baseDir: string, fixDir: string, files: readonly string[]): FileChange[] {
  return files.map((f) => {
    const fixBuf = readFileSync(path.join(fixDir, f))
    const basePath = path.join(baseDir, f)
    const baseBuf = existsSync(basePath) ? readFileSync(basePath) : undefined
    const binary = isProbablyBinary(fixBuf) || (baseBuf !== undefined && isProbablyBinary(baseBuf))
    return { path: f, base: baseBuf === undefined || binary ? undefined : baseBuf.toString('utf8'), fix: binary ? undefined : fixBuf.toString('utf8') }
  })
}

/** Exit 0 keep, 3 reject, 1 error. */
export async function runVerify(ctx: Ctx, opts: VerifyOptions, deps: Deps = {}): Promise<{ code: number; record?: FixRecord }> {
  const patrol = loadPatrol(ctx, opts.file)
  if (!patrol) return { code: 1 }
  const located = locateHaunting(ctx, patrol, opts.site, opts.haunting, opts.patrolId)
  if (!located) return { code: 1 }
  const { site, haunting, patrolId } = located
  if (!site.serve) {
    ctx.error(`site "${site.name}" has no serve.dir, so a local fix cannot be verified`)
    return { code: 1 }
  }
  let baseDir: string
  let fixDir: string
  try {
    baseDir = opts.base !== undefined ? resolveRepoDir(ctx.cwd, opts.base) : defaultBase(ctx, site)
    fixDir = resolveRepoDir(ctx.cwd, opts.fixDir)
  } catch (error) {
    ctx.error(error instanceof Error ? error.message : String(error))
    return { code: 1 }
  }
  if (path.resolve(baseDir) === path.resolve(fixDir)) {
    ctx.error('the fix directory and the base directory are the same')
    return { code: 1 }
  }
  for (const [label, dir] of [['base directory', baseDir], ['fix directory', fixDir]] as const) {
    if (!existsSync(dir)) {
      ctx.error(`${label} does not exist: ${dir}`)
      return { code: 1 }
    }
  }
  if (opts.apply && site.fixedDir === undefined) {
    ctx.error(`--apply needs fixedDir on site "${site.name}" in patrol.yaml`)
    return { code: 1 }
  }

  let engine: McpAudit
  try {
    engine = await (deps.openAudit ?? defaultOpenAudit)(ctx)
  } catch (error) {
    ctx.error(error instanceof McpServerMissingError ? error.message : `could not start the audit engine: ${error instanceof Error ? error.message : String(error)}`)
    return { code: 1 }
  }
  let before: PageRecord[]
  let after: PageRecord[]
  try {
    before = await auditServedDir(engine.audit, baseDir, site.pages)
    after = await auditServedDir(engine.audit, fixDir, site.pages)
  } catch (error) {
    ctx.error(`verify failed: ${error instanceof Error ? error.message : String(error)}`)
    return { code: 1 }
  } finally {
    await engine.close().catch(() => undefined)
  }

  const changed = changedFiles(baseDir, fixDir)
  const unsafe: Reason[] = checkSafety(fileChanges(baseDir, fixDir, changed))
  const verdict = decide(before, after, { page: haunting.page, fingerprint: haunting.fingerprint })
  const reasons = [...verdict.reasons, ...unsafe]
  const decision = reasons.length === 0 ? 'keep' : 'reject'

  const recordFile = fixRecordPath(ctx.cwd, patrolId, haunting.id)
  const previous = existsSync(recordFile) ? readFixRecord(recordFile, ctx.error) : undefined
  const record: FixRecord = {
    schemaVersion: 1,
    patrolId,
    site: site.name,
    hauntingId: haunting.id,
    fingerprint: haunting.fingerprint,
    page: haunting.page,
    type: haunting.type,
    severity: haunting.severity,
    decision,
    reasons,
    scoreBefore: scores(before),
    scoreAfter: scores(after),
    changedFiles: changed,
    attempt: previous ? previous.attempt + 1 : 1,
    origin: opts.recordedAttempt ? 'recorded-attempt' : 'crew',
    applied: false,
    verifiedAt: (deps.now ?? (() => new Date()))().toISOString(),
    previousAttempts: previous ? [...previous.previousAttempts, { attempt: previous.attempt, decision: previous.decision, reasons: previous.reasons }] : [],
  }

  if (decision === 'keep' && opts.apply && site.fixedDir !== undefined) {
    const fixedDir = resolveRepoDir(ctx.cwd, site.fixedDir)
    if (!existsSync(fixedDir) && site.source !== undefined) copyDir(resolveRepoDir(ctx.cwd, site.source), fixedDir)
    copyFiles(fixDir, fixedDir, changed)
    record.applied = true
  }
  const written = writeFixRecord(ctx.cwd, record)

  ctx.log(`${decision === 'keep' ? 'KEEP' : 'REJECT'} ${haunting.id} (attempt ${record.attempt})`)
  for (const r of reasons) ctx.log(`  ${r.message}`)
  ctx.log(`  changed files: ${changed.length ? changed.join(', ') : 'none'}${record.applied ? ' (applied to the fixed directory)' : ''}`)
  ctx.log(`  record: ${path.relative(ctx.cwd, written).split(path.sep).join('/')}`)
  return { code: decision === 'keep' ? 0 : 3, record }
}


