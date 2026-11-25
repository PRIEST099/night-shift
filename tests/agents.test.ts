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

  test('the Warden is the lead: kirocrew-core, spawn and wait, reason specialist, 2 attempts, no write tool', () => {
    const w = agents.get('warden')!
    expect(w.tools).toContain('@kirocrew-core')
    expect(w.tools).not.toContain('write')
    expect(w.prompt).toMatch(/spawn/)
    expect(w.prompt).toMatch(/wait/)
    expect(w.prompt).toMatch(/specialist/)
    expect(w.prompt).toMatch(/2 attempts/)
    expect(w.prompt).toMatch(/night-shift validate/)
    expect(w.prompt).toMatch(/night-shift report/)
    expect(w.prompt).toMatch(/one after another|sequential/i)
    for (const n of ['seer', 'scribe', 'exorcist']) expect(w.prompt).toContain(`\`${n}\``)
    expect(w.prompt).toMatch(/never edit source/i)
  })

  test('the Seer, Scribe and Exorcist have the unseen MCP tools, named as Crew mounts the app server', () => {
    for (const n of ['seer', 'scribe', 'exorcist']) expect(agents.get(n)!.tools, n).toContain('@night-shift:unseen')
  })

  test('the Exorcist has no write tool and never edits source', () => {
    const e = agents.get('exorcist')!
    expect(e.tools).not.toContain('write')
    expect(e.prompt).toMatch(/never edit source/i)
    expect(e.prompt).toMatch(/night-shift verify/)
    expect(e.prompt).toMatch(/exit code/i)
  })

  test('the Seer cannot write and runs audit and diff', () => {
    const s = agents.get('seer')!
    expect(s.tools).not.toContain('write')
    expect(s.prompt).toMatch(/night-shift audit/)
    expect(s.prompt).toMatch(/night-shift diff/)
    expect(s.prompt).toMatch(/workList/)
  })

  test('the Scribe may write, uses workdir, and its prompt forbids overlays, scripts and aria-hidden', () => {
    const s = agents.get('scribe')!
    expect(s.tools).toContain('write')
    expect(s.prompt).toMatch(/night-shift workdir/)
    expect(s.prompt).toMatch(/overlay/i)
    expect(s.prompt).toMatch(/script/i)
    expect(s.prompt).toMatch(/aria-hidden/)
    expect(s.prompt).toMatch(/Veiled/)
    expect(s.prompt).toMatch(/outside your work directory/)
  })

  test('only the Scribe has a write tool', () => {
    for (const [name, a] of agents) expect(a.tools.includes('write'), name).toBe(name === 'scribe')
  })

  test('no agent prompt tells anyone to push or open a pull request', () => {
    for (const a of agents.values()) {
      expect(a.prompt).not.toMatch(/gh pr create/)
      expect(a.prompt.replace(/Never run git push[^.]*\./, '')).not.toMatch(/git push/)
    }
  })

  test('agent files are valid UTF-8 JSON without a BOM', () => {
    for (const a of agents.values()) expect(readFileSync(path.join(root, a.file))[0]).not.toBe(0xef)
  })
})

