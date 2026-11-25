import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import fc from 'fast-check'
import { afterEach, describe, expect, test } from 'vitest'
import { archiveNewestHistory, historyDir, listPatrolIds } from '../src/io/history.js'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
const idArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2040-01-01') }).map((d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''))

describe('archiveNewestHistory', () => {
  test('property: moves exactly the newest timestamp file aside, keeps the others, deletes nothing', () => {
    fc.assert(
      fc.property(fc.uniqueArray(idArb, { minLength: 1, maxLength: 6 }), (ids) => {
        const root = mkdtempSync(path.join(tmpdir(), 'ns-hist-'))
        dirs.push(root)
        mkdirSync(historyDir(root, 's'), { recursive: true })
        for (const id of [...ids, 'demo-reject']) writeFileSync(path.join(historyDir(root, 's'), `${id}.json`), '{}')
        const newest = [...ids].sort().at(-1)!
        const moved = archiveNewestHistory(root, 's')
        expect(moved?.patrolId).toBe(newest)
        expect(listPatrolIds(root, 's')).toEqual([...ids].filter((i) => i !== newest).sort())
        expect(existsSync(path.join(historyDir(root, 's'), 'demo-reject.json'))).toBe(true)
        expect(moved!.to).toBe(path.join(root, '.night-shift', 'history-archive', 's', `${newest}.json`))
        expect(existsSync(moved!.to)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  test('never overwrites an earlier archive file, and does nothing without history', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'ns-hist-'))
    dirs.push(root)
    expect(archiveNewestHistory(root, 's')).toBeUndefined()
    mkdirSync(historyDir(root, 's'), { recursive: true })
    for (let i = 0; i < 2; i++) {
      writeFileSync(path.join(historyDir(root, 's'), '20260102T000000Z.json'), `{"n":${i}}`)
      archiveNewestHistory(root, 's')
    }
    expect(readdirSync(path.join(root, '.night-shift', 'history-archive', 's')).sort()).toEqual(['20260102T000000Z.1.json', '20260102T000000Z.json'])
  })
})