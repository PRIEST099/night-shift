import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { appSchema, readJson } from './helpers/manifest.js'

// Pins the MCP-only pre-approvals of docs/crew-integration-notes.md. Crew 0.13.1 turns an exact
// `allowedTools` entry for an MCP tool into a KAS allow rule on every surface, and
// toolsSettings.subagent.{availableAgents,trustedAgents} into native sub-agents. A shell or file limit that
// only Crew's gate enforces (denyByDefault, fallbackAction deny) would make Crew refuse the sub-agent.

const agentSchema = z
  .object({
    allowedTools: z.array(z.string()),
    tools: z.array(z.string()),
    toolsSettings: z.object({ subagent: z.object({ availableAgents: z.array(z.string()), trustedAgents: z.array(z.string()) }).strict() }).strict().optional(),
  })
  .passthrough()

const app = appSchema.parse(readJson('app.json'))
const agents = new Map(
  app.agents.map((file) => {
    const raw = readJson(file) as { name: string }
    return [raw.name, agentSchema.parse(raw)] as const
  })
)
const get = (name: string) => agents.get(name)!

const EXPECTED_ALLOWED_TOOLS: Record<string, string[]> = {
  warden: ['@night-shift:shift/validate', '@night-shift:shift/report'],
  seer: ['@night-shift:shift/audit', '@night-shift:shift/diff', '@night-shift:unseen/explain_haunting'],
  scribe: ['@night-shift:shift/workdir', '@night-shift:shift/diff', '@night-shift:shift/list_source', '@night-shift:shift/read_source', '@night-shift:shift/find_in_source', '@night-shift:shift/edit_fix_file', '@night-shift:shift/write_fix_file', '@night-shift:unseen/explain_haunting', '@night-shift:unseen/suggest_fix'],
  exorcist: ['@night-shift:shift/verify', '@night-shift:unseen/explain_haunting'],
}

describe('Crew pre-approvals (MCP only)', () => {
  test('each agent pre-approves exactly its documented MCP tools', () => {
    for (const [name, tools] of Object.entries(EXPECTED_ALLOWED_TOOLS)) expect(get(name).allowedTools, name).toEqual(tools)
  })

  test('every allowed tool is an exact tool of the app servers, and is also listed in tools', () => {
    for (const [name, a] of agents) {
      for (const t of a.allowedTools) {
        expect(t, `${name}: ${t}`).toMatch(/^@night-shift:(shift|unseen)\/[a-z_]+$/)
        expect(a.tools, `${name}: ${t}`).toContain(t)
      }
    }
  })

  test('no shell, file or wildcard tool anywhere, and no shell or file settings that only the Crew gate enforces', () => {
    for (const [name, a] of agents) {
      for (const t of [...a.tools, ...a.allowedTools]) {
        expect(['shell', 'execute_bash', 'execute_pwsh', 'read', 'write', 'fs_read', 'fs_write', '*', '@kirocrew-core'], `${name}: ${t}`).not.toContain(t)
        expect(t, `${name}: ${t}`).not.toMatch(/^@builtin|\*/)
      }
      const settings = Object.keys(a.toolsSettings ?? {})
      expect(settings.every((k) => k === 'subagent'), name).toBe(true)
    }
  })

  test('the Warden runs the three specialists as native sub-agents and trusts only them', () => {
    const w = get('warden')
    expect(w.tools).toContain('subagent')
    expect(w.toolsSettings?.subagent).toEqual({ availableAgents: ['seer', 'scribe', 'exorcist'], trustedAgents: ['seer', 'scribe', 'exorcist'] })
    for (const n of ['seer', 'scribe', 'exorcist']) expect(get(n).toolsSettings, n).toBeUndefined()
  })

  test('the app declares the Night Shift MCP server as the night-shift bin with the mcp argument', () => {
    expect(app.mcpServers['shift']).toEqual({ command: 'night-shift', args: ['mcp'] })
  })

  test('the nightly cron names the repository and resolves to the Warden', () => {
    const cron = (app.crons ?? [])[0] as { agent: string; message: string }
    expect(cron.agent).toBe('warden')
    expect(agents.has(cron.agent)).toBe(true)
    expect(cron.message).toMatch(/ in [A-Z]:\\|\/.+ and write/)
  })
})
