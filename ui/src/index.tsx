import { loadReport } from './load-report.js'
import { ReportView } from './render.js'

// The Crew host mounts the default export of the entry as the page component (see app.json `ui.pages`).
// The page needs nothing from `@kirocrew/app-sdk`, so it imports nothing from it.
export default function MorningReport() {
  return <ReportView report={loadReport()} />
}
