import { readFileSync } from 'node:fs'
import path from 'node:path'
import fc from 'fast-check'
import { describe, expect, test } from 'vitest'
import { applyRegression, REGRESSION_MARKER } from '../src/pure/demo-regress.js'
import { root } from './helpers/manifest.js'

const WISHLIST = '<button class="wishlist-btn" aria-label="Add to wishlist">\n  <svg></svg>\n</button>'
const count = (s: string, needle: string): number => s.split(needle).length - 1

describe('applyRegression', () => {
  test('adds exactly one button after the wishlist button and changes nothing else', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (before, after) => {
        fc.pre(!before.includes(REGRESSION_MARKER) && !after.includes(REGRESSION_MARKER) && !before.includes('wishlist-btn') && !after.includes('wishlist-btn'))
        const html = before + WISHLIST + after
        const r = applyRegression(html)
        expect(r.changed).toBe(true)
        expect(count(r.html, REGRESSION_MARKER)).toBe(1)
        expect(r.html.startsWith(before + WISHLIST)).toBe(true)
        expect(r.html.endsWith(after)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  test('is idempotent', () => {
    fc.assert(
      fc.property(fc.string(), (before) => {
        fc.pre(!before.includes(REGRESSION_MARKER) && !before.includes('wishlist-btn'))
        const once = applyRegression(before + WISHLIST)
        const twice = applyRegression(once.html)
        expect(twice.changed).toBe(false)
        expect(twice.html).toBe(once.html)
      }),
      { numRuns: 100 },
    )
  })

  test('keeps CRLF line endings', () => {
    const r = applyRegression(WISHLIST.replaceAll('\n', '\r\n'))
    expect(r.html.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/)
  })

  test('throws when the page has no wishlist button', () => {
    expect(() => applyRegression('<html></html>')).toThrow(/wishlist/)
  })

  test('applies to the committed product.html', () => {
    const html = readFileSync(path.join(root, 'demo', 'cursed-shop-copy', 'product.html'), 'utf8')
    const r = applyRegression(html)
    // The working copy may already hold the regression (after `npm run demo:regress`); both cases leave exactly one button.
    expect(count(r.html, REGRESSION_MARKER)).toBeGreaterThanOrEqual(1)
    expect(count(r.html, '<button class="wishlist-btn buy-now-btn"')).toBe(1)
  })
})

describe('demo scripts', () => {
  test('package.json has demo:regress and demo:reset', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    expect(pkg.scripts['demo:regress']).toBe('node scripts/demo-regress.mjs')
    expect(pkg.scripts['demo:reset']).toBe('node scripts/demo-reset.mjs')
  })

  test('demo/README.md documents both', () => {
    const readme = readFileSync(path.join(root, 'demo', 'README.md'), 'utf8')
    expect(readme).toContain('npm run demo:regress')
    expect(readme).toContain('npm run demo:reset')
  })
})
