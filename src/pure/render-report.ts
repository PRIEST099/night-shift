import type { Report, ReportFix, ReportSite } from './report.js'

const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
const signed = (n: number): string => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1))

function fixLine(f: ReportFix): string {
  const origin = f.origin === 'recorded-attempt' ? ' **Recorded attempt, not an agent run.**' : ''
  const files = f.changedFiles.length > 0 ? ` Changed: ${f.changedFiles.join(', ')}.` : ''
  const head = `- \`${f.hauntingId}\`: ${f.type} (${f.severity}) on ${f.page}, ${f.attempts} attempt${f.attempts === 1 ? '' : 's'}.${origin}${files}`
  const earlier = f.earlierAttempts.flatMap((a) =>
    a.reasons.length === 0 ? [`  - Attempt ${a.attempt} ${a.decision}.`] : a.reasons.map((r) => `  - Attempt ${a.attempt} ${a.decision}: ${r}`)
  )
  return [head, ...(f.decision === 'rejected' ? earlier : []), ...f.reasons.map((r) => `  - Reason: ${r}`)].join('\n')
}

/** Earlier attempts that were rejected and then replaced by a kept attempt, so a rejection is never hidden by a later success. */
function replacedRejections(f: ReportFix): string[] {
  const origin = f.origin === 'recorded-attempt' ? ' **Recorded attempt, not an agent run.**' : ''
  return f.earlierAttempts
    .filter((a) => a.decision === 'rejected')
    .flatMap((a) => [`- \`${f.hauntingId}\`: attempt ${a.attempt} was rejected, then a later attempt was kept.${origin}`, ...a.reasons.map((r) => `  - Reason: ${r}`)])
}

const NOT_ATTEMPTED_SHOWN = 10

function notAttemptedLines(list: ReportSite['notAttempted']): string[] {
  const lines = list.slice(0, NOT_ATTEMPTED_SHOWN).map((n) => `- \`${n.hauntingId}\`: ${n.type} (${n.severity}) on ${n.page}. ${cell(n.why)}.`)
  if (list.length > NOT_ATTEMPTED_SHOWN) lines.push(`- ...and ${list.length - NOT_ATTEMPTED_SHOWN} more, listed in report.json.`)
  return lines
}

/** Pure: the same report always gives the same Markdown. */
export function renderReport(report: Report): string {
  const lines: string[] = [`# Night Shift morning report: patrol ${report.patrolId}`, '', `Generated ${report.generatedAt}. Lower scores are better.`, '']
  if (report.sites.length === 0) lines.push('No sites were patrolled.', '')
  for (const s of report.sites) {
    lines.push(`## ${s.name} (owner: ${s.owner || 'unassigned'})`, '')
    lines.push('| Score before | Score after | Change |', '| --- | --- | --- |', `| ${s.scoreBefore.toFixed(1)} | ${s.scoreAfter.toFixed(1)} | ${signed(s.scoreChange)} |`, '')
    lines.push(`New hauntings: ${s.newCount}. Worsened: ${s.worsenedCount}. Resolved: ${s.resolvedCount}.`, '')
    const kept = s.fixes.filter((f) => f.decision === 'kept')
    const rejected = s.fixes.filter((f) => f.decision === 'rejected')
    const replaced = kept.flatMap(replacedRejections)
    lines.push('### Kept fixes', '', ...(kept.length ? kept.map(fixLine) : ['None.']), '')
    lines.push('### Rejected fixes', '', ...(rejected.length || replaced.length ? [...rejected.map(fixLine), ...replaced] : ['None.']), '')
    lines.push(
      '### Not attempted',
      '',
      ...(s.notAttempted.length ? notAttemptedLines(s.notAttempted) : ['None.']),
      ''
    )
    if (s.errors.length) lines.push('### Errors', '', ...s.errors.map((e) => `- ${e}`), '')
  }
  return `${lines.join('\n').replace(/\n+$/, '')}\n`
}


