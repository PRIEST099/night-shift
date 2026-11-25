export type Severity = 'Wraith' | 'Restless' | 'Banished'

export const SEVERITY_RANK: Readonly<Record<Severity, number>> = { Banished: 0, Restless: 1, Wraith: 2 }
export const SEVERITIES: readonly Severity[] = ['Wraith', 'Restless', 'Banished']

export type HauntingRecord = {
  fingerprint: string
  id: string
  type: string
  /** Empty string when the haunting has no kind. */
  kind: string
  severity: Severity
  selector: string
  htmlSnippet: string
  wcag: string[]
}

export type PageRecord = {
  /** The entry from patrol.yaml (path or URL). Stable between patrols, unlike `url`, which holds a random local port. */
  page: string
  url: string
  score: number
  hauntings: HauntingRecord[]
  error?: string
}

export type HistoryFile = {
  schemaVersion: 1
  site: string
  patrolId: string
  startedAt: string
  pages: PageRecord[]
}

export type PageSet = { pages: PageRecord[] }
