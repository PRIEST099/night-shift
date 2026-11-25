import path from 'node:path'
import { loadPatrolFile } from '../io/patrol-file.js'
import type { Ctx, CommandResult } from './ctx.js'

export type ValidateOptions = { file?: string }

export function runValidate(ctx: Ctx, opts: ValidateOptions = {}): CommandResult {
  const file = path.resolve(ctx.cwd, opts.file ?? 'patrol.yaml')
  const label = opts.file ?? 'patrol.yaml'
  const result = loadPatrolFile(file)
  if (!result.ok) {
    for (const p of result.problems) ctx.error(`${label}: ${p.path}: ${p.message}`)
    return { code: 1 }
  }
  const pages = result.value.sites.reduce((n, s) => n + s.pages.length, 0)
  ctx.log(`${label}: ok (${result.value.sites.length} sites, ${pages} pages)`)
  return { code: 0 }
}
