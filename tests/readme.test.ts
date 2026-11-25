import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { root } from './helpers/manifest.js'

const readme = readFileSync(path.join(root, 'README.md'), 'utf8')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
const section = (title: string): string => {
  const m = new RegExp(`^## ${title}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(readme)
  return m?.[1] ?? ''
}

describe('README', () => {
  test('has the required sections', () => {
    for (const h of ['Architecture', 'Setup', 'macOS and Linux', 'Windows', 'Demo', 'Sample morning report', 'Nightly schedule', 'Future work'])
      expect(readme, h).toMatch(new RegExp(`^#{2,3} ${h}`, 'm'))
  })

  test('has the Mermaid diagram from design.md', () => {
    const block = /```mermaid\n([\s\S]*?)```/.exec(readme)?.[1] ?? ''
    expect(block).toContain('flowchart LR')
    const design = readFileSync(path.join(root, '.kiro', 'specs', 'night-shift', 'design.md'), 'utf8')
    expect(block.trim()).toBe((/```mermaid\n([\s\S]*?)```/.exec(design)?.[1] ?? '').trim())
  })

  test('every npm run script it mentions exists', () => {
    const mentioned = [...readme.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]!)
    expect(mentioned.length).toBeGreaterThan(0)
    for (const s of mentioned) expect(pkg.scripts[s], s).toBeTruthy()
  })

  test('documents the server variable, unseen-mcp and the Crew install commands', () => {
    expect(readme).toContain('UNSEEN_MCP_SERVER_JS')
    expect(readme).toContain('../the-unseen/packages/mcp/dist/server.js')
    expect(readme).toContain('unseen-mcp')
    expect(readme).toContain('kirocrew app install')
    expect(readme).toContain('kirocrew app enable night-shift')
    expect(readme).toContain('UNSEEN_CHROMIUM_CHANNEL')
  })

  test('states --open-prs is future work', () => {
    expect(section('Future work')).toContain('--open-prs')
    expect(readme).toMatch(/--open-prs[^\n]*future work/i)
  })

  test('labels demo/bad-fix as a recorded attempt, not an agent run, and has a recording placeholder', () => {
    expect(readme).toMatch(/demo\/bad-fix\/` is a recorded attempt, not an agent run/)
    expect(readme).toMatch(/Demo recording: _placeholder/)
  })

  test('the pasted sample equals docs/sample-report/REPORT.md', () => {
    const sample = readFileSync(path.join(root, 'docs', 'sample-report', 'REPORT.md'), 'utf8').trim().replace(/\r\n/g, '\n')
    expect(readme.replace(/\r\n/g, '\n')).toContain(sample)
  })

  test('the nightly section says the default is off', () => {
    expect(section('Nightly schedule')).toMatch(/enabled: false/)
    expect(section('Nightly schedule')).toMatch(/Nothing runs overnight until you enable it/)
  })
})
