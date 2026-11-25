import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fingerprints, hauntingId } from '../pure/fingerprint.js'
import type { AuditPage } from '../io/mcp-client.js'
import { startStaticServer } from '../io/static-server.js'
import type { Site } from '../pure/schema.js'
import type { PageRecord } from '../pure/types.js'

export function pageUrl(base: string, page: string): string {
  return /^https?:\/\//i.test(page) ? page : `${base.replace(/\/$/, '')}${page}`
}

/** Audit every page of a site against `base`. A page that fails is recorded with `error`; the rest continue. */
export async function auditPages(audit: AuditPage, base: string, pages: readonly string[]): Promise<PageRecord[]> {
  const out: PageRecord[] = []
  for (const page of pages) {
    const url = pageUrl(base, page)
    let result: Awaited<ReturnType<AuditPage>>
    try {
      result = await audit(url)
    } catch (error) {
      result = { error: error instanceof Error ? error.message : String(error) }
    }
    if ('error' in result) {
      out.push({ page, url, score: 0, hauntings: [], error: result.error })
      continue
    }
    const prints = fingerprints(result.hauntings)
    out.push({
      page,
      url,
      score: result.score,
      hauntings: result.hauntings.map((h, i) => ({
        fingerprint: prints[i]!,
        id: hauntingId(page, h.type, prints[i]!),
        type: h.type,
        kind: h.kind,
        severity: h.severity,
        selector: h.selector,
        htmlSnippet: h.htmlSnippet,
        wcag: h.wcag,
      })),
    })
  }
  return out
}

/** Resolve a repo-relative directory and refuse one that escapes the repo or is not a directory. */
export function resolveRepoDir(root: string, rel: string): string {
  const abs = path.resolve(root, rel)
  const r = path.relative(path.resolve(root), abs)
  if (r.startsWith('..') || path.isAbsolute(r)) throw new Error(`${rel} escapes the repository`)
  return abs
}

export function assertDirectory(dir: string, label: string): void {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`${label} is not a directory: ${dir}`)
}

/** Serve a directory, audit pages, always close the server. */
export async function auditServedDir(audit: AuditPage, dir: string, pages: readonly string[]): Promise<PageRecord[]> {
  assertDirectory(dir, 'directory to serve')
  const server = await startStaticServer(dir)
  try {
    return await auditPages(audit, server.url, pages)
  } finally {
    await server.close()
  }
}

/** Audit a site as configured: its `serve.dir` on a free port, or its `baseUrl`. */
export async function auditSite(audit: AuditPage, root: string, site: Site): Promise<PageRecord[]> {
  if (site.serve) return auditServedDir(audit, resolveRepoDir(root, site.serve.dir), site.pages)
  return auditPages(audit, site.baseUrl ?? '', site.pages)
}
