import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import type { Report, ReportFix, ReportSite } from '../../src/pure/report.js'

const STYLE = `
.ns-report { font-family: system-ui, sans-serif; color: #1a1a1a; background: #ffffff; max-width: 60rem; margin: 0 auto; padding: 1.5rem; line-height: 1.5; }
.ns-report h1 { font-size: 1.75rem; margin: 0 0 0.25rem; }
.ns-report h2 { font-size: 1.35rem; margin: 2rem 0 0.5rem; }
.ns-report h3 { font-size: 1.1rem; margin: 1.25rem 0 0.5rem; }
.ns-report table { border-collapse: collapse; margin: 0.5rem 0 1rem; }
.ns-report caption { text-align: left; font-weight: 600; padding-bottom: 0.25rem; }
.ns-report th, .ns-report td { border: 1px solid #595959; padding: 0.35rem 0.75rem; text-align: left; }
.ns-report th { background: #ececec; }
.ns-report li { margin: 0.35rem 0; }
.ns-report .ns-outcome { display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 600; }
.ns-report .ns-note { color: #404040; }
.ns-report code { background: #f0f0f0; padding: 0 0.25rem; border-radius: 3px; }
.ns-report a:focus-visible, .ns-report summary:focus-visible { outline: 3px solid #0b3d91; outline-offset: 2px; }
`

function changeText(change: number): string {
  if (change < 0) return `${change.toFixed(1)} (better)`
  if (change > 0) return `+${change.toFixed(1)} (worse)`
  return '0.0 (no change)'
}

function Outcome({ kept }: { kept: boolean }) {
  return (
    <span className="ns-outcome">
      {kept ? <CheckCircle2 aria-hidden="true" size={18} /> : <XCircle aria-hidden="true" size={18} />}
      {kept ? 'Kept' : 'Rejected'}
    </span>
  )
}

function FixItem({ fix }: { fix: ReportFix }) {
  return (
    <li>
      <Outcome kept={fix.decision === 'kept'} /> <code>{fix.hauntingId}</code>
      {` ${fix.type} (${fix.severity}) on ${fix.page}, ${fix.attempts} attempt${fix.attempts === 1 ? '' : 's'}.`}
      {fix.origin === 'recorded-attempt' ? ' Recorded attempt, not an agent run.' : ''}
      {fix.changedFiles.length > 0 ? ` Changed: ${fix.changedFiles.join(', ')}.` : ''}
      {(fix.reasons.length > 0 || (fix.decision === 'rejected' && fix.earlierAttempts.length > 0)) && (
        <ul>
          {fix.decision === 'rejected' &&
            fix.earlierAttempts.flatMap((a) =>
              a.reasons.map((r, i) => (
                <li key={`${a.attempt}-${i}`}>{`Attempt ${a.attempt} ${a.decision}: ${r}`}</li>
              ))
            )}
          {fix.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </li>
  )
}

function ReplacedRejections({ fix }: { fix: ReportFix }) {
  const earlier = fix.earlierAttempts.filter((a) => a.decision === 'rejected')
  return (
    <>
      {earlier.map((a) => (
        <li key={`${fix.hauntingId}-${a.attempt}`}>
          <Outcome kept={false} /> <code>{fix.hauntingId}</code>
          {` attempt ${a.attempt} was rejected, then a later attempt was kept.`}
          {fix.origin === 'recorded-attempt' ? ' Recorded attempt, not an agent run.' : ''}
          <ul>
            {a.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </li>
      ))}
    </>
  )
}

function SiteSection({ site, index }: { site: ReportSite; index: number }) {
  const headingId = `ns-site-${index}`
  const kept = site.fixes.filter((f) => f.decision === 'kept')
  const rejected = site.fixes.filter((f) => f.decision === 'rejected')
  const replaced = kept.flatMap((f) => f.earlierAttempts.filter((a) => a.decision === 'rejected'))
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>{site.name}</h2>
      <p>Owner: {site.owner || 'unassigned'}</p>
      <table>
        <caption>{`Haunting Score for ${site.name} (lower is better)`}</caption>
        <thead>
          <tr>
            <th scope="col">Score before</th>
            <th scope="col">Score after</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{site.scoreBefore.toFixed(1)}</td>
            <td>{site.scoreAfter.toFixed(1)}</td>
            <td>{changeText(site.scoreChange)}</td>
          </tr>
        </tbody>
      </table>
      <p>{`New hauntings: ${site.newCount}. Worsened: ${site.worsenedCount}. Resolved: ${site.resolvedCount}.`}</p>

      <h3>Kept fixes</h3>
      {kept.length > 0 ? <ul>{kept.map((f) => <FixItem key={f.hauntingId} fix={f} />)}</ul> : <p>None.</p>}

      <h3>Rejected fixes</h3>
      {rejected.length > 0 || replaced.length > 0 ? (
        <ul>
          {rejected.map((f) => <FixItem key={f.hauntingId} fix={f} />)}
          {kept.map((f) => <ReplacedRejections key={f.hauntingId} fix={f} />)}
        </ul>
      ) : (
        <p>None.</p>
      )}

      <h3>Not attempted</h3>
      {site.notAttempted.length > 0 ? (
        <ul>
          {site.notAttempted.slice(0, 10).map((n) => (
            <li key={n.hauntingId}>
              <MinusCircle aria-hidden="true" size={16} /> <code>{n.hauntingId}</code>
              {` ${n.type} (${n.severity}) on ${n.page}. ${n.why}.`}
            </li>
          ))}
          {site.notAttempted.length > 10 && <li>{`...and ${site.notAttempted.length - 10} more, listed in report.json.`}</li>}
        </ul>
      ) : (
        <p>None.</p>
      )}

      {site.errors.length > 0 && (
        <>
          <h3>Errors</h3>
          <ul>
            {site.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** Pure view of a report.json object. Reasons are text nodes, so React escapes them. Never throws on a valid report. */
export function ReportView({ report }: { report: Report | undefined }) {
  return (
    <main className="ns-report" lang="en">
      <style>{STYLE}</style>
      <h1>Morning report</h1>
      {report === undefined ? (
        <p>
          No report yet. Run <code>night-shift patrol --no-agents</code> or ask the warden to run a patrol, then run{' '}
          <code>night-shift report --publish-ui</code> and <code>npm run build:ui</code>.
        </p>
      ) : (
        <>
          <p className="ns-note">{`Patrol ${report.patrolId}, generated ${report.generatedAt}. Lower scores are better.`}</p>
          {report.sites.length === 0 ? <p>No sites were patrolled.</p> : report.sites.map((s, i) => <SiteSection key={s.name} site={s} index={i} />)}
        </>
      )}
    </main>
  )
}
