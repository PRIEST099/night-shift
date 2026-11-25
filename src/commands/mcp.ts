import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { ConfineError, resolveInside } from '../io/confine.js'
import { isProbablyBinary, listFiles } from '../io/copy-dir.js'
import { normalizeRelative } from '../pure/confine.js'
import { isValidPatrolId } from '../pure/patrol-id.js'
import { resolveHome } from '../pure/home.js'
import type { Patrol, Site } from '../pure/schema.js'
import { resolveRepoDir } from './audit-site.js'
import { loadPatrol, runAudit } from './audit.js'
import type { Deps } from './audit.js'
import type { Ctx } from './ctx.js'
import { runDiff } from './diff.js'
import { runReport } from './report.js'
import { runValidate } from './validate.js'
import { runVerify } from './verify.js'
import { DEFAULT_WORK_ROOT, runWorkdir } from './workdir.js'

export const MAX_READ_BYTES = 256 * 1024
export const MAX_WRITE_BYTES = 512 * 1024
export const MAX_LISTED_FILES = 500

type Json = Record<string, unknown>
type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean }

const reply = (body: Json, isError = false): ToolResult => ({ content: [{ type: 'text', text: JSON.stringify(body, null, 2) }], ...(isError ? { isError: true } : {}) })
const fail = (message: string, extra: Json = {}): ToolResult => reply({ ok: false, error: message, ...extra }, true)

const homeArg = z.string().optional().describe('The repository root (the directory that holds patrol.yaml). Falls back to NIGHT_SHIFT_HOME.')

export type ServerOptions = {
  /** Environment the commands see. Defaults to process.env, plus the Windows chromium channel. */
  env?: NodeJS.ProcessEnv
  /** Working directory used when neither `home` nor NIGHT_SHIFT_HOME is given. */
  cwd?: string
  /** Injected in tests: a fake audit engine and clock. */
  deps?: Deps
}

function defaultEnv(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...base }
  if (process.platform === 'win32' && !env.UNSEEN_CHROMIUM_CHANNEL) env.UNSEEN_CHROMIUM_CHANNEL = 'chromium'
  return env
}

type Captured = { ctx: Ctx; out: string[]; err: string[] }

function capture(env: NodeJS.ProcessEnv, cwd: string, home: string | undefined): Captured {
  const resolved = resolveHome(env, cwd, home)
  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) throw new Error(`home is not a directory: ${resolved}`)
  const out: string[] = []
  const err: string[] = []
  return { ctx: { cwd: resolved, env, log: (m) => out.push(m), error: (m) => err.push(m) }, out, err }
}

const posix = (p: string): string => p.split(path.sep).join('/')

/** The work directory `workdir` makes: `<workRoot>/<patrol-id>/<name>`. Returns its absolute path or throws. */
export function resolveWorkdir(home: string, patrol: Patrol, input: string, siteName?: string): string {
  const n = normalizeRelative(input)
  if (!n.ok) throw new ConfineError(n.reason)
  const sites = siteName === undefined ? patrol.sites : patrol.sites.filter((s) => s.name === siteName)
  const ok = sites.some((s) => {
    const rootSegs = normalizeRelativeOrThrow(s.workRoot ?? DEFAULT_WORK_ROOT)
    if (n.segments.length !== rootSegs.length + 2) return false
    if (!rootSegs.every((seg, i) => seg === n.segments[i])) return false
    return isValidPatrolId(n.segments[rootSegs.length]!)
  })
  if (!ok) throw new ConfineError(`${input} is not a work directory made by the workdir tool`)
  const abs = resolveInside(home, input)
  if (!existsSync(abs) || !statSync(abs).isDirectory()) throw new ConfineError(`work directory does not exist: ${input}. Create it with the workdir tool first.`)
  return abs
}

function normalizeRelativeOrThrow(p: string): string[] {
  const n = normalizeRelative(p)
  if (!n.ok) throw new ConfineError(n.reason)
  return n.segments
}

function siteOf(patrol: Patrol, name: string): Site {
  const site = patrol.sites.find((s) => s.name === name)
  if (!site) throw new Error(`unknown site "${name}". Known sites: ${patrol.sites.map((s) => s.name).join(', ')}`)
  return site
}

export function createNightShiftServer(options: ServerOptions = {}): McpServer {
  const env = defaultEnv(options.env ?? process.env)
  const cwd = options.cwd ?? process.cwd()
  const deps = options.deps ?? {}
  const server = new McpServer({ name: 'night-shift', version: '0.1.0' })

  /** Run a tool body; every thrown error becomes an isError reply, never a crash. */
  const guard = (body: () => Promise<ToolResult> | ToolResult) => async (): Promise<ToolResult> => {
    try {
      return await body()
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error))
    }
  }
  const text = (c: Captured): Json => ({ output: c.out.join('\n'), errors: c.err.join('\n') })
  const code = (c: number): Json => ({ ok: c === 0, code: c })

  server.registerTool(
    'validate',
    { description: 'Check patrol.yaml and list its sites.', inputSchema: { home: homeArg } },
    async (a) =>
      guard(() => {
        const c = capture(env, cwd, a.home)
        const r = runValidate(c.ctx)
        const patrol = r.code === 0 ? loadPatrol({ ...c.ctx, error: () => undefined }) : undefined
        const sites = patrol?.sites.map((s) => ({ name: s.name, owner: s.owner, pages: s.pages })) ?? []
        return reply({ ...code(r.code), ...text(c), sites, maxFixesPerSite: patrol?.maxFixesPerSite ?? null }, r.code !== 0)
      })()
  )

  server.registerTool(
    'audit',
    {
      description: 'Audit one site (or all) with THE UNSEEN and write its history file. Returns the patrol id.',
      inputSchema: { home: homeArg, site: z.string().optional(), patrolId: z.string().optional() },
    },
    async (a) =>
      guard(async () => {
        const c = capture(env, cwd, a.home)
        const r = await runAudit(c.ctx, { ...(a.site !== undefined ? { site: a.site } : {}), ...(a.patrolId !== undefined ? { patrolId: a.patrolId } : {}) }, deps)
        return reply({ ...code(r.code), patrolId: r.patrolId ?? null, ...text(c) }, r.code !== 0)
      })()
  )

  server.registerTool(
    'diff',
    {
      description: 'Diff a site against its previous patrol. Returns the new, worsened and resolved hauntings and the workList.',
      inputSchema: { home: homeArg, site: z.string(), patrolId: z.string().optional() },
    },
    async (a) =>
      guard(() => {
        const c = capture(env, cwd, a.home)
        const r = runDiff(c.ctx, { site: a.site, ...(a.patrolId !== undefined ? { patrolId: a.patrolId } : {}) })
        if (r.code !== 0 || !r.output) return fail(c.err.join('\n') || 'diff failed')
        return reply({ ok: true, ...r.output })
      })()
  )

  server.registerTool(
    'workdir',
    {
      description: 'Copy the site base (the fixed directory if it exists, else the source) to a new work directory. Returns its path, relative to home.',
      inputSchema: { home: homeArg, site: z.string(), hauntingId: z.string(), patrolId: z.string(), attempt: z.number().int().min(1).optional() },
    },
    async (a) =>
      guard(() => {
        const c = capture(env, cwd, a.home)
        const r = runWorkdir(c.ctx, { site: a.site, haunting: a.hauntingId, patrolId: a.patrolId, ...(a.attempt !== undefined ? { attempt: a.attempt } : {}) })
        if (r.code !== 0 || r.dir === undefined) return fail(c.err.join('\n') || 'workdir failed')
        return reply({ ok: true, workdir: posix(path.relative(c.ctx.cwd, r.dir)) })
      })()
  )

  server.registerTool(
    'verify',
    {
      description: 'Audit the base and a work directory, decide keep or reject, write the fix record, and with apply copy a kept fix into the fixed directory. A reject is a normal answer, not an error.',
      inputSchema: { home: homeArg, site: z.string(), workdir: z.string(), hauntingId: z.string(), apply: z.boolean().optional(), patrolId: z.string().optional() },
    },
    async (a) =>
      guard(async () => {
        const c = capture(env, cwd, a.home)
        const patrol = loadPatrol(c.ctx)
        if (!patrol) return fail(c.err.join('\n'))
        const dir = resolveWorkdir(c.ctx.cwd, patrol, a.workdir, a.site)
        const r = await runVerify(c.ctx, { site: a.site, fixDir: posix(path.relative(c.ctx.cwd, dir)), haunting: a.hauntingId, ...(a.apply ? { apply: true } : {}), ...(a.patrolId !== undefined ? { patrolId: a.patrolId } : {}) }, deps)
        const decision = r.record?.decision ?? null
        return reply({ ...code(r.code), decision, record: r.record ?? null, ...text(c) }, r.code !== 0 && r.code !== 3)
      })()
  )

  server.registerTool(
    'report',
    {
      description: 'Write REPORT.md and report.json for a patrol (the newest one by default). Returns each fix with its decision. With publishUi it also writes ui/src/last-report.json.',
      inputSchema: { home: homeArg, patrolId: z.string().optional(), publishUi: z.boolean().optional() },
    },
    async (a) =>
      guard(async () => {
        const c = capture(env, cwd, a.home)
        const r = await runReport(c.ctx, { ...(a.patrolId !== undefined ? { patrolId: a.patrolId } : {}), ...(a.publishUi ? { publishUi: true } : {}) }, deps)
        if (r.code !== 0 || !r.report) return fail(c.err.join('\n') || 'report failed')
        const sites = r.report.sites.map((s) => ({
          name: s.name,
          scoreBefore: s.scoreBefore,
          scoreAfter: s.scoreAfter,
          fixes: s.fixes.map((f) => ({ hauntingId: f.hauntingId, decision: f.decision, attempts: f.attempts, reasons: f.reasons, changedFiles: f.changedFiles, origin: f.origin })),
          notAttempted: s.notAttempted.length,
          errors: s.errors,
        }))
        return reply({ ok: true, patrolId: r.report.patrolId, reportFile: 'REPORT.md', jsonFile: 'report.json', sites, ...text(c) })
      })()
  )

  /** The directory read_source and list_source look at: the work directory when given, else the site's source. */
  const readRoot = (c: Captured, siteName: string, workdir: string | undefined): string => {
    const patrol = loadPatrol(c.ctx)
    if (!patrol) throw new Error(c.err.join('\n'))
    const site = siteOf(patrol, siteName)
    if (workdir !== undefined) return resolveWorkdir(c.ctx.cwd, patrol, workdir, siteName)
    if (site.source === undefined) throw new Error(`site "${siteName}" has no source directory`)
    const dir = resolveRepoDir(c.ctx.cwd, site.source)
    return resolveInside(c.ctx.cwd, posix(path.relative(c.ctx.cwd, dir)), true)
  }

  server.registerTool(
    'list_source',
    {
      description: "List the files of a site's source directory (or of one of its work directories, when workdir is given).",
      inputSchema: { home: homeArg, site: z.string(), workdir: z.string().optional() },
    },
    async (a) =>
      guard(() => {
        const c = capture(env, cwd, a.home)
        const root = readRoot(c, a.site, a.workdir)
        const files = listFiles(root)
        return reply({ ok: true, files: files.slice(0, MAX_LISTED_FILES), truncated: files.length > MAX_LISTED_FILES })
      })()
  )

  server.registerTool(
    'read_source',
    {
      description: "Read one text file inside a site's source directory (or inside one of its work directories, when workdir is given). Rejects `..`, absolute paths and symlinks out of the tree.",
      inputSchema: { home: homeArg, site: z.string(), path: z.string(), workdir: z.string().optional() },
    },
    async (a) =>
      guard(() => {
        const c = capture(env, cwd, a.home)
        const root = readRoot(c, a.site, a.workdir)
        const file = resolveInside(root, a.path)
        if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`not a file: ${a.path}`)
        if (statSync(file).size > MAX_READ_BYTES) throw new Error(`file is larger than ${MAX_READ_BYTES} bytes`)
        const buf = readFileSync(file)
        if (isProbablyBinary(buf)) throw new Error('file is binary')
        return reply({ ok: true, path: a.path, content: buf.toString('utf8') })
      })()
  )

  server.registerTool(
    'write_fix_file',
    {
      description: 'Write one file inside a work directory that the workdir tool created. Rejects `..`, absolute paths and symlinks out of that directory.',
      inputSchema: { home: homeArg, workdir: z.string(), path: z.string(), content: z.string() },
    },
    async (a) =>
      guard(() => {
        const c = capture(env, cwd, a.home)
        const patrol = loadPatrol(c.ctx)
        if (!patrol) throw new Error(c.err.join('\n'))
        const dir = resolveWorkdir(c.ctx.cwd, patrol, a.workdir)
        const file = resolveInside(dir, a.path)
        const bytes = Buffer.byteLength(a.content, 'utf8')
        if (bytes > MAX_WRITE_BYTES) throw new Error(`content is larger than ${MAX_WRITE_BYTES} bytes`)
        if (existsSync(file) && statSync(file).isDirectory()) throw new Error(`${a.path} is a directory`)
        mkdirSync(path.dirname(file), { recursive: true })
        // Re-check after creating directories, so a symlink made in between cannot redirect the write.
        resolveInside(dir, a.path)
        writeFileSync(file, a.content, 'utf8')
        return reply({ ok: true, written: posix(path.relative(dir, file)), bytes })
      })()
  )

  return server
}

/** Serve over stdio until the client closes the connection. */
export async function runMcp(ctx: Ctx, deps: Deps = {}): Promise<number> {
  const server = createNightShiftServer({ env: ctx.env, cwd: ctx.cwd, deps })
  const transport = new StdioServerTransport()
  const closed = new Promise<void>((resolve) => {
    transport.onclose = () => resolve()
  })
  await server.connect(transport)
  await closed
  return 0
}
