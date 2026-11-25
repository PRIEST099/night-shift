import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { MCP_DEFAULT_PATH, MCP_ENV_VAR } from '../src/io/mcp-client.js'
import { appSchema, readJson, root } from './helpers/manifest.js'

describe('app.json', () => {
  const raw = readJson('app.json') as Record<string, unknown>
  const app = appSchema.parse(raw)

  test('has the documented required and recommended fields', () => {
    expect(app.name).toBe('night-shift')
    expect(app.version).toBe('0.1.0')
    expect(app.license).toBe('MIT')
    expect(app.minKiroCrewVersion).toBe('0.13.0')
    expect(app.author).toBeTruthy()
    expect(app.tags?.length).toBeGreaterThan(0)
  })

  test('tolerates unknown fields', () => {
    expect(appSchema.safeParse({ ...raw, somethingNew: 1 }).success).toBe(true)
  })

  test('has no platform field, no exec backend, no command cron, no crew.yaml', () => {
    expect(raw).not.toHaveProperty('platform')
    expect(raw).not.toHaveProperty('backends')
    expect(raw).not.toHaveProperty('backend')
    for (const cron of app.crons ?? []) {
      expect(cron).not.toHaveProperty('command')
      expect(cron).not.toHaveProperty('every')
    }
    expect(existsSync(path.join(root, 'crew.yaml'))).toBe(false)
  })

  test('permissions.cron is true whenever crons is non-empty', () => {
    if ((app.crons ?? []).length > 0) expect(app.permissions?.cron).toBe(true)
  })

  test('app.json has no shell-style placeholder', () => {
    expect(readFileSync(path.join(root, 'app.json'), 'utf8')).not.toContain('${')
  })

  test('every referenced agent file and skill folder exists', () => {
    expect(app.agents).toHaveLength(4)
    for (const a of app.agents) expect(existsSync(path.join(root, a)), a).toBe(true)
    expect(app.skills).toHaveLength(3)
    for (const s of app.skills) expect(existsSync(path.join(root, s, 'SKILL.md')), s).toBe(true)
  })

  test('declares the unseen MCP server as the global unseen-mcp bin with a literal chromium channel', () => {
    const unseen = app.mcpServers['unseen']!
    expect(unseen.command).toBe('unseen-mcp')
    expect(unseen.args ?? []).toEqual([])
    expect(unseen.env).toEqual({ UNSEEN_CHROMIUM_CHANNEL: 'chromium' })
  })

  test('the CLI keeps its own env-or-sibling default for finding the server file', () => {
    expect(MCP_ENV_VAR).toBe('UNSEEN_MCP_SERVER_JS')
    expect(MCP_DEFAULT_PATH).toBe('../the-unseen/packages/mcp/dist/server.js')
    expect(path.resolve(root, MCP_DEFAULT_PATH)).toBe(path.resolve(root, '..', 'the-unseen', 'packages', 'mcp', 'dist', 'server.js'))
    expect(statSync(root).isDirectory()).toBe(true)
  })

  test('has the single nightly-patrol message cron, disabled by default, for an existing agent', () => {
    expect(app.crons).toEqual([
      {
        name: 'nightly-patrol',
        cron_expr: '0 2 * * *',
        message: 'Run the Night Shift patrol from patrol.yaml in D:\\kiroween 2026\\night-shift and write the morning report.',
        agent: 'warden',
        enabled: false,
      },
    ])
    const cron = app.crons![0]!
    expect(cron).not.toHaveProperty('command')
    expect(cron).not.toHaveProperty('every')
    expect(cron['enabled']).toBe(false)
    expect(existsSync(path.join(root, 'agents', `${cron['agent'] as string}.json`))).toBe(true)
    expect(app.agents).toContain(`agents/${cron['agent'] as string}.json`)
  })
})