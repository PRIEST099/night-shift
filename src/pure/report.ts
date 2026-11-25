import { z } from 'zod'
import { diffPatrols, workList } from './diff.js'
import type { FixRecord } from './fix-record.js'
import type { HistoryFile, PageRecord } from './types.js'

const fixSchema = z.object({
  hauntingId: z.string(),
  type: z.string(),
  severity: z.enum(['Wraith', 'Restless', 'Banished']),
  page: z.string(),
  decision: z.enum(['kept', 'rejected']),
  reasons: z.array(z.string()),
  attempts: z.number().int().min(1),
  changedFiles: z.array(z.string()),
  origin: z.enum(['crew', 'recorded-attempt']),
  earlierAttempts: z.array(z.object({ attempt: z.number().int().min(1), decision: z.enum(['kept', 'rejected']), reasons: z.array(z.string()) })),
})

const notAttemptedSchema = z.object({
  hauntingId: z.string(),
  type: z.string(),
  severity: z.enum(['Wraith', 'Restless', 'Banished']),
  page: z.string(),
  why: z.string(),
})

const siteSchema = z.object({
  name: z.string(),
  owner: z.string(),
  scoreBefore: z.number(),
  scoreAfter: z.number(),
  scoreChange: z.number(),
  newCount: z.number().int().min(0),
  worsenedCount: z.number().int().min(0),
  resolvedCount: z.number().int().min(0),
  fixes: z.array(fixSchema),
  notAttempted: z.array(notAttemptedSchema),
  errors: z.array(z.string()),
})

export const reportSchema = z.object({
  schemaVersion: z.literal(1),
  patrolId: z.string(),
  generatedAt: z.string(),
  sites: z.array(siteSchema),
})

export type Report = z.infer<typeof reportSchema>
export type ReportSite = z.infer<typeof siteSchema>
export type ReportFix = z.infer<typeof fixSchema>

export type SiteInput = {
  name: string
  owner: string
  maxFixesPerSite: number
  current: HistoryFile | undefined
  previous: HistoryFile | undefined
  fixes: FixRecord[]
  /** Mean page score of the site's fixed directory, re-audited by `report`. Undefined when nothing was kept or it could not be audited. */
  rescoredAfter?: number | undefined
}

export const round1 = (n: number): number => Math.round(n * 10) / 10

/** Mean score of the pages that audited without error. Zero when there are none. */
export function meanScore(pages: readonly PageRecord[]): number {
  const ok = pages.filter((p) => p.error === undefined)
  if (ok.length === 0) return 0
  return round1(ok.reduce((n, p) => n + p.score, 0) / ok.length)
}

/** Reasons are one line each, so the Markdown list and the dashboard show them verbatim. */
export const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim()

export function buildSite(input: SiteInput): ReportSite {
  const { current, previous } = input
  const errors: string[] = []
  if (!current) errors.push('no audit history for this patrol')
  for (const p of current?.pages ?? []) if (p.error !== undefined) errors.push(oneLine(`${p.page}: ${p.error}`))
  const currentScore = current ? meanScore(current.pages) : 0
  const scoreBefore = previous ? meanScore(previous.pages) : currentScore
  const scoreAfter = input.rescoredAfter !== undefined ? round1(input.rescoredAfter) : currentScore
  const diff = current ? diffPatrols(previous, current) : { new: [], worsened: [], resolved: [] }
  const fixes: ReportFix[] = input.fixes.map((f) => ({
    hauntingId: f.hauntingId,
    type: f.type,
    severity: f.severity,
    page: f.page,
    decision: f.decision === 'keep' ? 'kept' : 'rejected',
    reasons: f.reasons.map((r) => oneLine(r.message)),
    attempts: f.attempt,
    changedFiles: f.changedFiles,
    origin: f.origin,
    earlierAttempts: f.previousAttempts.map((a) => ({ attempt: a.attempt, decision: a.decision === 'keep' ? ('kept' as const) : ('rejected' as const), reasons: a.reasons.map((r) => oneLine(r.message)) })),
  }))
  const attempted = new Set(fixes.map((f) => f.hauntingId))
  const inList = new Set(workList(diff, input.maxFixesPerSite).map((h) => h.id))
  const pending = [...diff.new, ...diff.worsened]
    .filter((h) => !attempted.has(h.id))
    .map((h) => ({
      hauntingId: h.id,
      type: h.type,
      severity: h.severity,
      page: h.page,
      why: h.severity === 'Banished' ? 'Banished severity' : inList.has(h.id) ? 'in the work list, no fix record' : `beyond maxFixesPerSite (${input.maxFixesPerSite})`,
    }))
  return {
    name: input.name,
    owner: input.owner,
    scoreBefore,
    scoreAfter,
    scoreChange: round1(scoreAfter - scoreBefore),
    newCount: diff.new.length,
    worsenedCount: diff.worsened.length,
    resolvedCount: diff.resolved.length,
    fixes,
    notAttempted: pending,
    errors,
  }
}

export function buildReport(patrolId: string, generatedAt: string, sites: readonly SiteInput[]): Report {
  return { schemaVersion: 1, patrolId, generatedAt, sites: sites.map(buildSite) }
}


