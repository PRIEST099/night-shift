import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { appSchema, readJson } from './helpers/manifest.js'

// Pins the narrow pre-approvals of docs/crew-integration-notes.md. Crew 0.13.1 reads
// toolsSettings.shell.allowedCommands as Rust-regex patterns matched against the whole command,
// toolsSettings.{read,write}.allowedPaths as globs, and allowedTools as MCP auto-approvals.

const settingsSchema = z
  .object({
    allowedTools: z.array(z.string()),
    tools: z.array(z.string()),
    toolsSettings: z
      .object({
        shell: z.object({ denyByDefault: z.literal(true), allowedCommands: z.array(z.string()).min(1) }).strict(),
        read: z.object({ allowedPaths: z.array(z.string()).min(1) }).strict(),
        write: z.object({ fallbackAction: z.literal('deny'), allowedPaths: z.array(z.string()).min(1) }).strict().optional(),
      })
      .strict(),
  })
  .passthrough()

const app = appSchema.parse(readJson('app.json'))
const agents = new Map(
  app.agents.map((file) => {
    const raw = readJson(file) as { name: string }
    return [raw.name, settingsSchema.parse(raw)] as const
  })
)
const get = (name: string) => agents.get(name)!

const EXPECTED_SHELL: Record<string, string[]> = {
  warden: ['night-shift validate( .*)?', 'night-shift workdir .*', 'night-shift report( .*)?', "npm run build:ui --prefix '[^']+'"],
  seer: ['night-shift audit( .*)?', 'night-shift diff( .*)?'],
  scribe: ['night-shift workdir .*'],
  exorcist: ['night-shift verify .*'],
}
const EXPECTED_ALLOWED_TOOLS: Record<string, string[]> = {
  warden: ['@kirocrew-core/spawn_run', '@kirocrew-core/spawn_status', '@kirocrew-core/wait'],
  seer: ['@night-shift:unseen/explain_haunting'],
  scribe: ['@night-shift:unseen/explain_haunting', '@night-shift:unseen/suggest_fix'],
  exorcist: ['@night-shift:unseen/explain_haunting'],
}

/** The literal program and subcommand every pattern must start with (the regex is anchored at both ends). */
const fixedPrefix = (pattern: string): string => /^[a-z:-]+ [a-z:-]+/.exec(pattern)?.[0] ?? ''

describe('Crew pre-approvals', () => {
  test('each agent pre-approves exactly its documented shell commands', () => {
    for (const [name, commands] of Object.entries(EXPECTED_SHELL)) expect(get(name).toolsSettings.shell.allowedCommands, name).toEqual(commands)
  })

  test('no wildcard shell: every pattern starts with a fixed program and subcommand, and no agent auto-approves the shell tool itself', () => {
    const allowedPrefixes = new Set(['night-shift validate', 'night-shift workdir', 'night-shift report', 'night-shift audit', 'night-shift diff', 'night-shift verify', 'npm run'])
    for (const [name, a] of agents) {
      for (const pattern of a.toolsSettings.shell.allowedCommands) {
        expect(allowedPrefixes.has(fixedPrefix(pattern)), `${name}: ${pattern}`).toBe(true)
        expect(pattern, `${name}: ${pattern}`).not.toMatch(/^\.\*|^\(|\|/)
      }
      for (const t of a.allowedTools) {
        expect(['shell', 'execute_bash', 'execute_pwsh', 'read', 'write', 'fs_read', 'fs_write', '*'], `${name}: ${t}`).not.toContain(t)
        expect(t, `${name}: ${t}`).not.toMatch(/^@builtin|\*/)
      }
    }
  })

  test('the build:ui grant cannot carry extra npm flags: the quoted directory is the last thing allowed', () => {
    const re = new RegExp(`^(?:${EXPECTED_SHELL.warden![3]})$`)
    expect(re.test("npm run build:ui --prefix 'D:\\kiroween 2026\\night-shift'")).toBe(true)
    expect(re.test("npm run build:ui --prefix 'D:\\x' --script-shell=calc")).toBe(false)
    expect(re.test('npm run build:ui')).toBe(false)
  })

  test('the patterns match the commands the prompts tell each agent to run, and nothing of another role', () => {
    const home = "--home 'D:\\kiroween 2026\\night-shift'"
    const runs: Record<string, string[]> = {
      warden: [`night-shift validate ${home}`, `night-shift report --publish-ui ${home}`, `night-shift workdir cursed-shop w1 --patrol-id 20261125T154231Z ${home}`],
      seer: [`night-shift audit --site cursed-shop ${home}`, `night-shift diff --site cursed-shop --json ${home}`],
      scribe: [`night-shift workdir cursed-shop w1 --patrol-id 20261125T154231Z --attempt 2 ${home}`],
      exorcist: [`night-shift verify cursed-shop demo/work/p/w1 --haunting w1 --apply ${home}`],
    }
    const matches = (name: string, cmd: string) => get(name).toolsSettings.shell.allowedCommands.some((p) => new RegExp(`^(?:${p})$`).test(cmd))
    for (const [name, cmds] of Object.entries(runs)) for (const cmd of cmds) expect(matches(name, cmd), `${name}: ${cmd}`).toBe(true)
    expect(matches('seer', `night-shift verify x y --haunting z ${home}`)).toBe(false)
    expect(matches('exorcist', `night-shift audit --site x ${home}`)).toBe(false)
    expect(matches('scribe', 'git status')).toBe(false)
    expect(matches('warden', 'git push')).toBe(false)
  })

  test('MCP auto-approvals are exact tools of the app server or the spawn tools', () => {
    for (const [name, tools] of Object.entries(EXPECTED_ALLOWED_TOOLS)) expect(get(name).allowedTools, name).toEqual(tools)
    for (const n of ['seer', 'scribe', 'exorcist']) expect(get(n).tools, n).toContain('@night-shift:unseen')
  })

  test('only the Scribe may write, and only under demo/work', () => {
    for (const [name, a] of agents) expect(a.toolsSettings.write === undefined, name).toBe(name !== 'scribe')
    expect(get('scribe').toolsSettings.write).toEqual({ fallbackAction: 'deny', allowedPaths: ['**/demo/work/**'] })
  })

  test('reads are limited to the patrol file, Night Shift state and work directories', () => {
    for (const [name, a] of agents)
      for (const p of a.toolsSettings.read.allowedPaths) expect(p, `${name}: ${p}`).toMatch(/^\*\*\/(patrol\.yaml|REPORT\.md|report\.json|\.night-shift\/(\*\*|history\/\*\*|fixes\/\*\*)|demo\/work\/\*\*)$/)
  })

  test('the nightly cron names the repository and resolves to the Warden', () => {
    const cron = (app.crons ?? [])[0] as { agent: string; message: string }
    expect(cron.agent).toBe('warden')
    expect(agents.has(cron.agent)).toBe(true)
    expect(cron.message).toMatch(/ in [A-Z]:\\|\/.+ and write/)
  })
})
