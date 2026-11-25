import { existsSync } from 'node:fs'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js'
import { z } from 'zod'

export const MCP_ENV_VAR = 'UNSEEN_MCP_SERVER_JS'
export const MCP_DEFAULT_PATH = '../the-unseen/packages/mcp/dist/server.js'

export type RawHaunting = {
  id: string
  type: string
  kind: string
  severity: 'Wraith' | 'Restless' | 'Banished'
  selector: string
  htmlSnippet: string
  wcag: string[]
}

export type AuditResult = { score: number; hauntings: RawHaunting[] } | { error: string }

/** The audit engine boundary. Tests inject a fake. */
export type AuditPage = (url: string) => Promise<AuditResult>

export class McpServerMissingError extends Error {
  constructor(public readonly serverPath: string) {
    super(
      `THE UNSEEN MCP server not found at ${serverPath}. Set ${MCP_ENV_VAR} to the path of packages/mcp/dist/server.js (default: ${MCP_DEFAULT_PATH}), and build the-unseen first.`
    )
    this.name = 'McpServerMissingError'
  }
}

export function resolveServerPath(env: NodeJS.ProcessEnv, cwd: string): string {
  const configured = env[MCP_ENV_VAR]
  return path.resolve(cwd, configured && configured.length > 0 ? configured : MCP_DEFAULT_PATH)
}

const classifiedHaunting = z
  .object({
    id: z.string(),
    type: z.string(),
    kind: z.string().optional(),
    severity: z.enum(['Wraith', 'Restless', 'Banished']),
    htmlSnippet: z.string(),
    wcag: z.array(z.object({ id: z.string() }).passthrough()).default([]),
  })
  .passthrough()

const toolHaunting = z.object({ id: z.string(), selector: z.string().optional() }).passthrough()

const auditSchema = z
  .object({
    score: z.number(),
    hauntings: z.array(toolHaunting).default([]),
    classified: z.object({ hauntings: z.array(classifiedHaunting) }).passthrough(),
  })
  .passthrough()

/** Parse the `audit_url` structured result (page: 'full'). Extra fields are tolerated. */
export function parseAuditResult(structured: unknown): AuditResult {
  const parsed = auditSchema.safeParse(structured)
  if (!parsed.success) return { error: `unexpected audit result: ${parsed.error.issues[0]?.message ?? 'invalid'} at ${parsed.error.issues[0]?.path.join('.') ?? ''}` }
  const selectors = new Map(parsed.data.hauntings.map((h) => [h.id, h.selector ?? '']))
  return {
    score: parsed.data.score,
    hauntings: parsed.data.classified.hauntings.map((h) => ({
      id: h.id,
      type: h.type,
      kind: h.kind ?? '',
      severity: h.severity,
      selector: selectors.get(h.id) ?? '',
      htmlSnippet: h.htmlSnippet,
      wcag: h.wcag.map((w) => w.id),
    })),
  }
}

export type McpAudit = { audit: AuditPage; close: () => Promise<void> }

/** Start THE UNSEEN MCP server over stdio. Throws McpServerMissingError when the file does not exist. */
export async function openMcpAudit(env: NodeJS.ProcessEnv, cwd: string): Promise<McpAudit> {
  const serverPath = resolveServerPath(env, cwd)
  if (!existsSync(serverPath)) throw new McpServerMissingError(serverPath)
  const childEnv: Record<string, string> = { ...getDefaultEnvironment() }
  for (const [k, v] of Object.entries(env)) if (typeof v === 'string') childEnv[k] = v
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath], env: childEnv, stderr: 'pipe' })
  const client = new Client({ name: 'night-shift', version: '0.1.0' })
  await client.connect(transport)
  const audit: AuditPage = async (url) => {
    try {
      const result = await client.callTool({ name: 'audit_url', arguments: { url, page: 'full' } }, undefined, { timeout: 150_000 })
      if (result.isError) {
        const text = Array.isArray(result.content) ? result.content.map((c) => (c as { text?: string }).text ?? '').join(' ') : 'audit failed'
        return { error: text || 'audit failed' }
      }
      return parseAuditResult(result.structuredContent)
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }
  return { audit, close: () => client.close() }
}
