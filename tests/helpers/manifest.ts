import { readFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

export const root = path.resolve(import.meta.dirname, '..', '..')

export function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(path.join(root, rel), 'utf8'))
}

/** Unknown fields are tolerated (Requirement 1.4). */
export const appSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    version: z.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/),
    displayName: z.string().min(1),
    description: z.string().min(1),
    author: z.string().optional(),
    license: z.string().optional(),
    minKiroCrewVersion: z.string().optional(),
    tags: z.array(z.string()).optional(),
    agents: z.array(z.string()).min(1),
    skills: z.array(z.string()).min(1),
    mcpServers: z.record(z.object({ command: z.string(), args: z.array(z.string()).optional(), env: z.record(z.string()).optional() }).passthrough()),
    crons: z.array(z.record(z.unknown())).optional(),
    ui: z.object({ entry: z.string(), pages: z.array(z.record(z.unknown())) }).passthrough().optional(),
    permissions: z.object({ api: z.array(z.string()).optional(), cron: z.boolean().optional() }).passthrough().optional(),
  })
  .passthrough()
