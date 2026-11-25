// Reproduces the planted rejection offline: audits the demo copy, then runs a real `night-shift verify` on demo/bad-fix.
// demo/bad-fix is a recorded attempt (the obvious aria-hidden fix), not an agent run.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cli = path.join(root, 'dist', 'cli.js')
const PATROL_ID = 'demo-reject'
const SITE = 'cursed-shop'

if (!existsSync(cli)) {
  console.error('dist/cli.js is missing. Run `npm run build` first.')
  process.exit(1)
}

function run(args) {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', env: process.env })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  return r.status
}

console.log('demo/bad-fix is a recorded attempt, not an agent run: the obvious aria-hidden fix for the planted case.\n')
rmSync(path.join(root, '.night-shift', 'fixes', PATROL_ID), { recursive: true, force: true })

console.log(`$ night-shift audit --site ${SITE} --patrol-id ${PATROL_ID}`)
if (run(['audit', '--site', SITE, '--patrol-id', PATROL_ID]) !== 0) process.exit(1)

const history = JSON.parse(readFileSync(path.join(root, '.night-shift', 'history', SITE, `${PATROL_ID}.json`), 'utf8'))
const planted = history.pages.flatMap((p) => p.hauntings).find((h) => h.htmlSnippet.includes('subscribe-sparkle'))
if (!planted) {
  console.error('The planted haunting was not found in the audit. Is demo/cursed-shop-copy unchanged?')
  process.exit(1)
}

console.log(`\n$ night-shift verify ${SITE} demo/bad-fix --haunting ${planted.id} --patrol-id ${PATROL_ID} --base demo/cursed-shop-copy --recorded-attempt`)
const code = run(['verify', SITE, 'demo/bad-fix', '--haunting', planted.id, '--patrol-id', PATROL_ID, '--base', 'demo/cursed-shop-copy', '--recorded-attempt'])
if (code === 3) {
  console.log('\nRejected, as expected (exit code 3). The fix hid a focusable control with aria-hidden, which created a new Veiled haunting.')
  process.exit(0)
}
console.error(`\nExpected the fix to be rejected (exit code 3) but verify exited with ${code}.`)
process.exit(1)
