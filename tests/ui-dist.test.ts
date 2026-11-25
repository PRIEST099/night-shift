import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { root } from './helpers/manifest.js'

const HOST_MODULES = new Set([
  '@kirocrew/app-sdk',
  '@kirocrew/app-sdk/ui',
  'react',
  'react-dom',
  'react/jsx-runtime',
  'lucide-react',
  '@tanstack/react-query',
])

const built = readFileSync(path.join(root, 'ui', 'dist', 'index.mjs'), 'utf8')

describe('built dashboard entry ui/dist/index.mjs', () => {
  test('has a default export', () => {
    expect(built).toMatch(/export\s*\{[^}]*\bas\s+default\b[^}]*\}|export\s+default\b/)
  })

  test('imports only host-provided modules', () => {
    const specs = [...built.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n;]*?\bfrom\s*["']([^"']+)["']/g)].map((m) => m[1]!)
    const bare = [...built.matchAll(/(?:^|\n)\s*import\s*["']([^"']+)["']/g)].map((m) => m[1]!)
    const dynamic = [...built.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]!)
    const all = [...specs, ...bare, ...dynamic]
    expect(all.length).toBeGreaterThan(0)
    expect(all.filter((s) => !HOST_MODULES.has(s))).toEqual([])
  })

  test('does not contain defineApp', () => {
    expect(built).not.toContain('defineApp')
  })
})
