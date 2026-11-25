import { z } from 'zod'

export const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** True for a relative path with no `..` segment, not absolute on posix or Windows. */
export function isSafeRelativePath(p: string): boolean {
  if (p.length === 0) return false
  if (p.startsWith('/') || p.startsWith('\\')) return false
  if (/^[a-zA-Z]:/.test(p)) return false
  return !p.split(/[\\/]+/).includes('..')
}

function pageProblem(p: string): string | undefined {
  if (p.length === 0) return 'page must not be empty'
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(p)
  if (scheme) {
    const s = (scheme[1] ?? '').toLowerCase()
    if (s !== 'http' && s !== 'https') return `page URL scheme must be http or https, got "${s}"`
    try {
      new URL(p)
    } catch {
      return 'page is not a valid URL'
    }
    return undefined
  }
  if (!p.startsWith('/')) return 'page path must start with "/" or be an absolute http(s) URL'
  if (p.split(/[\\/?#]+/).includes('..')) return 'page path must not contain ".."'
  return undefined
}

const relDir = (what: string) =>
  z.string().refine(isSafeRelativePath, { message: `${what} must be a relative path inside the repo (no "..", not absolute)` })

const pageSchema = z.string().superRefine((p, ctx) => {
  const problem = pageProblem(p)
  if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem })
})

const baseUrlSchema = z.string().refine(
  (u) => {
    try {
      const p = new URL(u).protocol
      return p === 'http:' || p === 'https:'
    } catch {
      return false
    }
  },
  { message: 'baseUrl must be an http or https URL' }
)

export const siteSchema = z
  .object({
    name: z.string().regex(KEBAB, 'name must be kebab-case'),
    owner: z.string(),
    pages: z.array(pageSchema).min(1, 'pages must not be empty'),
    serve: z.object({ dir: relDir('serve.dir') }).strict().optional(),
    baseUrl: baseUrlSchema.optional(),
    source: relDir('source').optional(),
    fixedDir: relDir('fixedDir').optional(),
    repo: z.string().optional(),
    workRoot: relDir('workRoot').optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (s.serve && s.baseUrl !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['baseUrl'], message: 'serve and baseUrl cannot be used together' })
    }
    if (!s.serve && s.baseUrl === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [], message: 'a site needs either serve.dir or baseUrl' })
    }
    if (s.serve && s.source === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['source'], message: 'source is required when the site has serve' })
    }
  })

export const patrolSchema = z
  .object({
    version: z.literal(1),
    maxFixesPerSite: z.number().int().min(0).max(20).default(5),
    sites: z.array(siteSchema),
  })
  .strict()
  .superRefine((p, ctx) => {
    const seen = new Map<string, number>()
    p.sites.forEach((s, i) => {
      const first = seen.get(s.name)
      if (first !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sites', i, 'name'],
          message: `duplicate site name "${s.name}" (first used at sites[${first}])`,
        })
      } else seen.set(s.name, i)
    })
  })

export type Site = z.infer<typeof siteSchema>
export type Patrol = z.infer<typeof patrolSchema>

export type Problem = { path: string; message: string }

export function formatPath(path: ReadonlyArray<string | number>): string {
  let out = ''
  for (const seg of path) out += typeof seg === 'number' ? `[${seg}]` : out === '' ? seg : `.${seg}`
  return out
}

export type ParseResult = { ok: true; value: Patrol } | { ok: false; problems: Problem[] }

/** Validate an already parsed object. Never throws. */
export function validatePatrolObject(input: unknown): ParseResult {
  const result = patrolSchema.safeParse(input)
  if (result.success) return { ok: true, value: result.data }
  const problems: Problem[] = []
  for (const issue of result.error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) problems.push({ path: formatPath([...issue.path, key]), message: `unknown key "${key}"` })
    } else {
      problems.push({ path: formatPath(issue.path) || '(root)', message: issue.message })
    }
  }
  return { ok: false, problems }
}
