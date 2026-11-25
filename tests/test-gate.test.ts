import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, test } from 'vitest'
import { root } from './helpers/manifest.js'

const script = path.join(root, '.kiro', 'hooks', 'scripts', 'test-gate.mjs')
const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function setup() {
  const dir = mkdtempSync(path.join(tmpdir(), 'ns-gate-'))
  dirs.push(dir)
  mkdirSync(path.join(dir, 'src'))
  writeFileSync(path.join(dir, 'src', 'a.ts'), 'export {}')
  writeFileSync(path.join(dir, 'stub.mjs'), "import { writeFileSync } from 'node:fs'\nwriteFileSync('called.txt', '1')\nif (process.env.STUB_FAIL) { console.log('x'.repeat(10000)); console.error('boom'); process.exit(1) }\n")
  const run = (fail: boolean) =>
    spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      env: { ...process.env, NIGHT_SHIFT_GATE_ROOT: dir, NIGHT_SHIFT_GATE_RUNNER: `"${process.execPath}" stub.mjs`, ...(fail ? { STUB_FAIL: '1' } : { STUB_FAIL: '' }) },
    })
  return { dir, run, called: () => existsSync(path.join(dir, 'called.txt')), reset: () => rmSync(path.join(dir, 'called.txt'), { force: true }) }
}

describe('test gate hook', () => {
  test('hook file triggers on Stop and runs the script', () => {
    const hook = JSON.parse(require('node:fs').readFileSync(path.join(root, '.kiro', 'hooks', 'test-gate.json'), 'utf8'))
    expect(hook.hooks[0].trigger).toBe('Stop')
    expect(hook.hooks[0].action.command).toContain('test-gate.mjs')
  })

  test('pass: exit 0 and the runner was called', () => {
    const s = setup()
    const r = s.run(false)
    expect(r.status).toBe(0)
    expect(s.called()).toBe(true)
  })

  test('nothing changed since the last pass: exit 0 and the runner is not called', () => {
    const s = setup()
    expect(s.run(false).status).toBe(0)
    s.reset()
    const r = s.run(true)
    expect(r.status).toBe(0)
    expect(s.called()).toBe(false)
  })

  test('fail: exit 1 with a message under 3,000 characters; the next run tries again', () => {
    const s = setup()
    const r = s.run(true)
    expect(r.status).toBe(1)
    expect(r.stderr.length).toBeGreaterThan(0)
    expect(r.stderr.length).toBeLessThan(3000)
    expect(r.stderr).toMatch(/Tests failed/)
    s.reset()
    expect(s.run(true).status).toBe(1)
    expect(s.called()).toBe(true)
  })

  test('a change after a pass runs the tests again', async () => {
    const s = setup()
    expect(s.run(false).status).toBe(0)
    s.reset()
    await new Promise((r) => setTimeout(r, 30))
    writeFileSync(path.join(s.dir, 'src', 'a.ts'), 'export const x = 1')
    expect(s.run(false).status).toBe(0)
    expect(s.called()).toBe(true)
  })
})
