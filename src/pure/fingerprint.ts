import { createHash } from 'node:crypto'
import { slugify } from './slug.js'

export type Fingerprintable = { type: string; kind?: string | undefined; htmlSnippet: string }

/** `type|kind|htmlSnippet`, with `#n` for the n-th identical key on the page. Node ids are never part of it. Same algorithm as THE UNSEEN's baseline. */
export function fingerprints(hauntings: readonly Fingerprintable[]): string[] {
  const seen = new Map<string, number>()
  return hauntings.map((h) => {
    const key = `${h.type}|${h.kind ?? ''}|${h.htmlSnippet}`
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)
    return `${key}#${n}`
  })
}

/** `type|kind` key used by the verify count rule. */
export function typeKindKey(h: { type: string; kind?: string | undefined }): string {
  return `${h.type}|${h.kind ?? ''}`
}

/** `<page-slug>-<type>-<first 8 hex of sha256(fingerprint)>`: deterministic, safe as a directory name. */
export function hauntingId(page: string, type: string, fingerprint: string): string {
  const hash = createHash('sha256').update(fingerprint).digest('hex').slice(0, 8)
  return `${slugify(page)}-${type.replace(/[^A-Za-z0-9]/g, '')}-${hash}`
}
