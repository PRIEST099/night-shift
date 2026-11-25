import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { appSchema, readJson, root } from './helpers/manifest.js'

const agentSchema = z
  .object({
    name: z.string().regex(/^[a-z]+$/),
    description: z.string().min(10),
    model: z.literal('auto'),
    prompt: z.string().min(200),
    tools: z.array(z.string()).min(1),
  })
  .passthrough()

const app = appSchema.parse(readJson('app.json'))
const agents = new Map(
  app.agents.map((file) => {
    const a = agentSchema.parse(readJson(file))
    return [a.name, { ...a, file }] as const
  })
)

describe('agents', () => {
  test('four agents with the documented shape; file name equals agent name', () => {
    expect([...agents.keys()].sort()).toEqual(['exorcist', 'scribe', 'seer', 'warden'])
    for (const [name, a] of agents) expect(path.basename(a.file, '.json')).toBe(name)
  })

  test('no agent has a shell, file or kirocrew-core tool: every tool is an MCP tool, or the Warden sub-agent tool', () => {
    for (const [name, a] of agents) {
      for (const t of a.tools) {
        if (name === 'warden' && t === 'subagent') continue
        expect(t, `${name}: ${t}`).toMatch(/^@night-shift:(shift|unseen)\/[a-z_]+$/)
      }
    }
  })

  test('the Warden is the lead: sub-agent tool, specialists by name, 2 attempts, validate and report, no source tools', () => {
    const w = agents.get('warden')!
    expect(w.tools).toContain('subagent')
    expect(w.tools).not.toContain('@kirocrew-core')
    expect(w.prompt).toMatch(/sub-agent/)
    expect(w.prompt).toMatch(/2 attempts/)
    expect(w.prompt).toMatch(/`validate`/)
    expect(w.prompt).toMatch(/`report`/)
    expect(w.prompt).toMatch(/one after another|sequential/i)
    for (const n of ['seer', 'scribe', 'exorcist']) expect(w.prompt).toContain(`\`${n}\``)
    expect(w.prompt).toMatch(/never edit source/i)
    expect(w.prompt).toMatch(/at most 2 fixes/)
    for (const t of w.tools) expect(t).not.toMatch(/write_fix_file|edit_fix_file|find_in_source|read_source|workdir|verify|audit/)
  })

  test('the Seer, Scribe and Exorcist keep THE UNSEEN tools, named as Crew mounts the app server', () => {
    for (const n of ['seer', 'scribe', 'exorcist']) expect(agents.get(n)!.tools.some((t) => t.startsWith('@night-shift:unseen/')), n).toBe(true)
  })

  test('the Exorcist can only verify and explain, and never edits source', () => {
    const e = agents.get('exorcist')!
    expect(e.tools.filter((t) => t.startsWith('@night-shift:shift/'))).toEqual(['@night-shift:shift/verify'])
    expect(e.prompt).toMatch(/never edit source/i)
    expect(e.prompt).toMatch(/`verify`/)
    expect(e.prompt).toMatch(/`code`/)
  })

  test('the Seer can only audit and diff, and returns the workList', () => {
    const s = agents.get('seer')!
    expect(s.tools.filter((t) => t.startsWith('@night-shift:shift/'))).toEqual(['@night-shift:shift/audit', '@night-shift:shift/diff'])
    expect(s.prompt).toMatch(/`audit`/)
    expect(s.prompt).toMatch(/`diff`/)
    expect(s.prompt).toMatch(/workList/)
  })

  test('the Scribe drafts in a work directory, and its prompt forbids overlays, scripts and aria-hidden', () => {
    const s = agents.get('scribe')!
    expect(s.tools.filter((t) => t.startsWith('@night-shift:shift/')).sort()).toEqual(['diff', 'edit_fix_file', 'find_in_source', 'list_source', 'read_source', 'workdir', 'write_fix_file'].map((t) => `@night-shift:shift/${t}`).sort())
    expect(s.prompt).toMatch(/`workdir`/)
    expect(s.prompt).toMatch(/overlay/i)
    expect(s.prompt).toMatch(/script/i)
    expect(s.prompt).toMatch(/aria-hidden/)
    expect(s.prompt).toMatch(/Veiled/)
    expect(s.prompt).toMatch(/outside your work directory/)
  })

  test('only the Scribe has write_fix_file, edit_fix_file and find_in_source', () => {
    for (const tool of ['write_fix_file', 'edit_fix_file', 'find_in_source']) for (const [name, a] of agents) expect(a.tools.includes('@night-shift:shift/' + tool), ` `).toBe(name === 'scribe')
  })

  test('every specialist prompt reads REPO from the Warden message and passes it as home', () => {
    for (const n of ['seer', 'scribe', 'exorcist']) {
      expect(agents.get(n)!.prompt, n).toMatch(/REPO: <directory>/)
      expect(agents.get(n)!.prompt, n).toMatch(/`home`/)
    }
  })

  test('no agent prompt tells anyone to push or open a pull request', () => {
    for (const a of agents.values()) {
      expect(a.prompt).not.toMatch(/gh pr create/)
      expect(a.prompt.replace(/Never push to a remote[^.]*\./, '')).not.toMatch(/git push/)
    }
  })

  test('agent files are valid UTF-8 JSON without a BOM', () => {
    for (const a of agents.values()) expect(readFileSync(path.join(root, a.file))[0]).not.toBe(0xef)
  })
})
