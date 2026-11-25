import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { validatePatrolObject } from '../pure/schema.js'
import type { ParseResult } from '../pure/schema.js'

/** Parse patrol YAML text. Never throws, never touches the network. */
export function parsePatrolYaml(text: string): ParseResult {
  let data: unknown
  try {
    data = parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] ?? 'invalid YAML' : 'invalid YAML'
    return { ok: false, problems: [{ path: '(yaml)', message: `malformed YAML: ${message}` }] }
  }
  if (data === null || data === undefined) return { ok: false, problems: [{ path: '(root)', message: 'file is empty' }] }
  return validatePatrolObject(data)
}

export function loadPatrolFile(file: string): ParseResult {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { ok: false, problems: [{ path: path.basename(file), message: `cannot read file: ${reason}` }] }
  }
  return parsePatrolYaml(text)
}
