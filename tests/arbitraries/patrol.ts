import fc from 'fast-check'
import type { Patrol, Site } from '../../src/pure/schema.js'

const word = fc.stringMatching(/^[a-z0-9]{1,6}$/)
export const kebab = fc.array(word, { minLength: 1, maxLength: 3 }).map((w) => w.join('-'))

const pagePath = fc.tuple(word, fc.constantFrom('.html', '', '/')).map(([w, ext]) => `/${w}${ext}`)
const pageUrl = fc.tuple(fc.constantFrom('http', 'https'), word, word).map(([s, h, p]) => `${s}://${h}.example/${p}`)
export const page = fc.oneof(pagePath, pageUrl)

export const relDir = fc.array(word, { minLength: 1, maxLength: 3 }).map((w) => w.join('/'))

const serveSite = fc
  .record({
    name: kebab,
    owner: fc.stringMatching(/^[a-zA-Z0-9 ]{0,12}$/),
    pages: fc.array(page, { minLength: 1, maxLength: 4 }),
    serve: fc.record({ dir: relDir }),
    source: relDir,
  })
  .chain((base) =>
    fc
      .record({ fixedDir: fc.option(relDir, { nil: undefined }), repo: fc.option(word, { nil: undefined }), workRoot: fc.option(relDir, { nil: undefined }) })
      .map((extra) => {
        const site: Site = { ...base }
        if (extra.fixedDir !== undefined) site.fixedDir = extra.fixedDir
        if (extra.repo !== undefined) site.repo = extra.repo
        if (extra.workRoot !== undefined) site.workRoot = extra.workRoot
        return site
      })
  )

const urlSite = fc
  .record({
    name: kebab,
    owner: fc.stringMatching(/^[a-zA-Z0-9 ]{0,12}$/),
    pages: fc.array(page, { minLength: 1, maxLength: 4 }),
    baseUrl: fc.tuple(fc.constantFrom('http', 'https'), word).map(([s, h]) => `${s}://${h}.example`),
  })
  .map((s): Site => s)

export const validPatrol: fc.Arbitrary<Patrol> = fc
  .record({
    maxFixesPerSite: fc.integer({ min: 0, max: 20 }),
    sites: fc.uniqueArray(fc.oneof(serveSite, urlSite), { minLength: 1, maxLength: 4, selector: (s) => s.name }),
  })
  .map((p) => ({ version: 1 as const, ...p }))

/** Raw haunting/page/history arbitraries shared by diff, decide and report tests. */
export const severity = fc.constantFrom('Wraith' as const, 'Restless' as const, 'Banished' as const)
export const hauntingType = fc.constantFrom(
  'NamelessSpirit',
  'TheVeiled',
  'HollowPortrait',
  'TheFog',
  'LostSoul',
  'CursedLoop',
  'WhisperingField',
  'ShatteredOrder'
)
