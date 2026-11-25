import { defineApp } from '@kirocrew/app-sdk'
import { loadReport } from './load-report.js'
import { ReportView } from './render.js'

function MorningReport() {
  return <ReportView report={loadReport()} />
}

// The page route and label match app.json `ui.pages`.
export default defineApp({
  pages: [{ route: '/apps/night-shift', component: MorningReport }],
})
