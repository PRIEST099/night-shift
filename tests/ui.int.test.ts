import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { loadReport } from '../ui/src/load-report.js'
import { ReportView } from '../ui/src/render.js'
import { integrationGate, serverPath } from './helpers/int.js'

const gate = integrationGate()

describe.skipIf(gate.skip)('dashboard page audited by THE UNSEEN (audit_html)', () => {
  test('the rendered Morning report page has no Wraith', async () => {
    const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Morning report</title></head><body>${renderToStaticMarkup(
      createElement(ReportView, { report: loadReport() })
    )}</body></html>`
    const env: Record<string, string> = { ...getDefaultEnvironment() }
    for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') env[k] = v
    env['UNSEEN_CHROMIUM_CHANNEL'] = process.env.UNSEEN_CHROMIUM_CHANNEL ?? 'chromium'
    const client = new Client({ name: 'night-shift-test', version: '0.1.0' })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [serverPath], env, stderr: 'pipe' }))
    try {
      const result = await client.callTool({ name: 'audit_html', arguments: { html: page } }, undefined, { timeout: 150_000 })
      expect(result.isError).not.toBe(true)
      const structured = result.structuredContent as { score: number; hauntings: { severity: string; type: string; htmlSnippet: string }[]; truncated: boolean }
      const wraiths = structured.hauntings.filter((h) => h.severity === 'Wraith')
      expect(wraiths, JSON.stringify(wraiths, null, 2)).toEqual([])
      expect(structured.truncated).toBe(false)
      console.log(`audit_html on the Morning report page: score ${structured.score}, hauntings ${structured.hauntings.length}`)
    } finally {
      await client.close()
    }
  })
})
