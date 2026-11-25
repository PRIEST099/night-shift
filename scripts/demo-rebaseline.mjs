// Moves the newest history file of a site aside (into .night-shift/history-archive/<site>/), so the next patrol
// compares against the patrol before it. Use it after a patrol that saw the regression, to run the demo again.
// Usage: npm run demo:rebaseline [-- <site>]   (default: cursed-shop). Nothing is deleted.
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modulePath = path.join(root, 'dist', 'io', 'history.js')
if (!existsSync(modulePath)) {
  console.error('dist/io/history.js is missing. Run `npm run build` first.')
  process.exit(1)
}
const { archiveNewestHistory } = await import(pathToFileURL(modulePath).href)

const site = process.argv[2] ?? 'cursed-shop'
if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(site)) {
  console.error(`Not a site name: ${site}`)
  process.exit(1)
}
const moved = archiveNewestHistory(root, site)
if (!moved) {
  console.log(`No history for ${site}. Nothing moved.`)
  process.exit(0)
}
console.log(`Moved ${moved.patrolId} aside to ${path.relative(root, moved.to)}.`)
console.log('The next patrol compares against the patrol before it.')