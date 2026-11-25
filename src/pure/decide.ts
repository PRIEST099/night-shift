import { typeKindKey } from './fingerprint.js'
import type { Reason } from './fix-record.js'
import type { HauntingRecord, PageRecord } from './types.js'

export type Target = { page: string; fingerprint: string }
export type Decision = { decision: 'keep' | 'reject'; reasons: Reason[] }

function countKeys(hauntings: readonly HauntingRecord[]): Map<string, HauntingRecord[]> {
  const m = new Map<string, HauntingRecord[]>()
  for (const h of hauntings) {
    const k = typeKindKey(h)
    const list = m.get(k)
    if (list) list.push(h)
    else m.set(k, [h])
  }
  return m
}

/**
 * Keep or reject a fix, as a pure function of two audits.
 * The target is matched by fingerprint. Every other haunting is matched by `type|kind` count per page, because editing the target element
 * changes its snippet and so its fingerprint; a fingerprint comparison would call every other haunting on that element new.
 */
export function decide(before: readonly PageRecord[], after: readonly PageRecord[], target: Target): Decision {
  const reasons: Reason[] = []
  const targetPage = after.find((p) => p.page === target.page)
  if (targetPage === undefined) {
    reasons.push({ code: 'target-still-present', page: target.page, message: `target-still-present: page ${target.page} was not audited after the fix` })
  } else if (targetPage.error !== undefined) {
    reasons.push({ code: 'target-still-present', page: target.page, message: `target-still-present: page ${target.page} failed to audit after the fix (${targetPage.error})` })
  } else {
    const still = targetPage.hauntings.find((h) => h.fingerprint === target.fingerprint)
    if (still) {
      reasons.push({
        code: 'target-still-present',
        page: target.page,
        type: still.type,
        kind: still.kind,
        snippet: still.htmlSnippet,
        message: `target-still-present: ${still.type} is still on ${target.page}: ${still.htmlSnippet}`,
      })
    }
  }
  for (const a of after) {
    if (a.error !== undefined) continue
    const b = before.find((p) => p.page === a.page)
    if (b === undefined || b.error !== undefined) continue
    const was = countKeys(b.hauntings)
    const known = new Set(b.hauntings.map((h) => h.fingerprint))
    for (const [key, list] of [...countKeys(a.hauntings)].sort(([x], [y]) => x.localeCompare(y))) {
      const prior = was.get(key)?.length ?? 0
      if (list.length <= prior) continue
      const example = list.find((h) => !known.has(h.fingerprint)) ?? list[list.length - 1]!
      reasons.push({
        code: 'new-haunting',
        page: a.page,
        type: example.type,
        kind: example.kind,
        snippet: example.htmlSnippet,
        message: `new-haunting: ${example.type}${example.kind ? `/${example.kind}` : ''} on ${a.page}, ${prior} before and ${list.length} after: ${example.htmlSnippet}`,
      })
    }
  }
  return { decision: reasons.length === 0 ? 'keep' : 'reject', reasons }
}
