import type { Report } from '../../src/pure/report.js'
import lastReport from './last-report.json' with { type: 'json' }

/** Minimal guard: the file is produced by `night-shift report --publish-ui`, which validates it with the Zod schema. */
function looksLikeReport(value: unknown): value is Report {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return v['schemaVersion'] === 1 && typeof v['patrolId'] === 'string' && Array.isArray(v['sites'])
}

/**
 * The page's only data source: a static import of ui/src/last-report.json (no backend, see design.md).
 * If an app API route that serves a file is later confirmed, only this function changes.
 */
export function loadReport(): Report | undefined {
  return looksLikeReport(lastReport) ? lastReport : undefined
}

