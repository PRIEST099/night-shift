import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { appSchema, readJson, root } from './helpers/manifest.js'

const app = appSchema.parse(readJson('app.json'))

function frontMatter(text: string): Record<string, string> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)
  if (!m) throw new Error('no front matter')
  const out: Record<string, string> = {}
  for (const line of m[1]!.split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

const skills = new Map(
  app.skills.map((dir) => {
    const text = readFileSync(path.join(root, dir, 'SKILL.md'), 'utf8')
    return [path.basename(dir), { dir, text, fm: frontMatter(text) }] as const
  })
)

describe('skills', () => {
  test('three skills, front matter name equals the folder, description present', () => {
    expect([...skills.keys()].sort()).toEqual(['draft-fix', 'patrol', 'verify-fix'])
    for (const [folder, s] of skills) {
      expect(s.fm['name'], folder).toBe(folder)
      expect(s.fm['description']?.length, folder).toBeGreaterThan(20)
      expect(existsSync(path.join(root, s.dir, 'SKILL.md'))).toBe(true)
      expect(s.text.startsWith('---')).toBe(true)
    }
  })

  test('skills tell agents to run night-shift and not to re-implement audit logic', () => {
    for (const [folder, s] of skills) expect(s.text, folder).toMatch(/night-shift/)
    expect(skills.get('patrol')!.text).toMatch(/do not re-implement/i)
  })

  test('patrol skill gives the handoff sequence, the specialist reason and the 2-attempt limit', () => {
    const t = skills.get('patrol')!.text
    expect(t).toMatch(/specialist/)
    expect(t).toMatch(/2 attempts/)
    expect(t).toMatch(/one at a time/)
    expect(t).toMatch(/night-shift report/)
  })

  test('draft-fix skill has the Veiled warning and the forbidden list', () => {
    const t = skills.get('draft-fix')!.text
    expect(t).toMatch(/Veiled/)
    expect(t).toMatch(/aria-hidden/)
    expect(t).toMatch(/overlay/i)
    expect(t).toMatch(/script/i)
  })

  test('verify-fix skill explains the exit codes and the reason codes', () => {
    const t = skills.get('verify-fix')!.text
    for (const code of ['`0`', '`3`', '`1`', 'target-still-present', 'new-haunting', 'unsafe-change']) expect(t).toContain(code)
  })
})

