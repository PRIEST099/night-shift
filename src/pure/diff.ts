import { SEVERITY_RANK } from './types.js'
import type { HauntingRecord, PageRecord, PageSet } from './types.js'

export type DiffItem = HauntingRecord & { page: string; pageIndex: number; domIndex: number }

export type PatrolDiff = { new: DiffItem[]; worsened: DiffItem[]; resolved: DiffItem[] }

function items(page: PageRecord, pageIndex: number): DiffItem[] {
  return page.hauntings.map((h, domIndex) => ({ ...h, page: page.page, pageIndex, domIndex }))
}

/**
 * New: fingerprint not on the previous patrol's same page. Worsened: in both, higher severity now. Resolved: in the previous, gone now.
 * A page that failed in the current patrol reports nothing as resolved. A page that failed in the previous patrol counts as absent.
 */
export function diffPatrols(prev: PageSet | undefined, curr: PageSet): PatrolDiff {
  const prevByPage = new Map<string, Map<string, HauntingRecord>>()
  const prevItems: DiffItem[] = []
  prev?.pages.forEach((p, pi) => {
    if (p.error !== undefined) return
    prevByPage.set(p.page, new Map(p.hauntings.map((h) => [h.fingerprint, h])))
    prevItems.push(...items(p, pi))
  })
  const out: PatrolDiff = { new: [], worsened: [], resolved: [] }
  const currByPage = new Map<string, Set<string>>()
  const failed = new Set<string>()
  curr.pages.forEach((p, pi) => {
    if (p.error !== undefined) {
      failed.add(p.page)
      return
    }
    currByPage.set(p.page, new Set(p.hauntings.map((h) => h.fingerprint)))
    const before = prevByPage.get(p.page)
    for (const it of items(p, pi)) {
      const old = before?.get(it.fingerprint)
      if (old === undefined) out.new.push(it)
      else if (SEVERITY_RANK[it.severity] > SEVERITY_RANK[old.severity]) out.worsened.push(it)
    }
  })
  for (const it of prevItems) {
    if (failed.has(it.page)) continue
    if (!currByPage.get(it.page)?.has(it.fingerprint)) out.resolved.push(it)
  }
  return out
}

/** New or worsened hauntings of severity Wraith or Restless, Wraith first, then page order, then DOM order, capped. */
export function workList(diff: Pick<PatrolDiff, 'new' | 'worsened'>, maxFixesPerSite: number): DiffItem[] {
  const eligible = [...diff.new, ...diff.worsened].filter((h) => h.severity !== 'Banished')
  eligible.sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.pageIndex - b.pageIndex || a.domIndex - b.domIndex
  )
  return eligible.slice(0, Math.max(0, maxFixesPerSite))
}
