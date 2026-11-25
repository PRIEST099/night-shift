// Restores demo/cursed-shop-copy/ from git and removes the generated demo/cursed-shop-fixed/.
// Keeps .night-shift/history, so the next patrol still has a baseline.
// demo/cursed-shop-fixed/ is ignored by git (night-shift verify --apply creates it), so there is nothing in git to restore it from: it is deleted.
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const copy = 'demo/cursed-shop-copy'
const fixed = path.join(root, 'demo', 'cursed-shop-fixed')

const restore = spawnSync('git', ['restore', '--source=HEAD', '--worktree', '--', copy], { cwd: root, stdio: 'inherit' })
if (restore.status !== 0) {
  console.error(`git restore of ${copy} failed (exit ${restore.status ?? 'none'}). Is this a git checkout?`)
  process.exit(1)
}
console.log(`Restored ${copy} from git.`)

// Only ever delete this one directory, and only if it resolves inside the repository's demo folder.
const demoDir = path.join(root, 'demo') + path.sep
if (!fixed.startsWith(demoDir)) {
  console.error('Refusing to delete a path outside demo/.')
  process.exit(1)
}
if (existsSync(fixed)) {
  rmSync(fixed, { recursive: true, force: true })
  console.log('Removed demo/cursed-shop-fixed (generated, not in git).')
} else {
  console.log('demo/cursed-shop-fixed did not exist.')
}
console.log('Kept .night-shift/history.')
