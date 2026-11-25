// Applies one realistic "someone shipped this today" change to demo/cursed-shop-copy/:
// a new icon-only "Buy now" button on product.html. THE UNSEEN reports exactly one new Wraith Nameless Spirit for it.
// Undo with `npm run demo:reset`.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modulePath = path.join(root, 'dist', 'pure', 'demo-regress.js')
if (!existsSync(modulePath)) {
  console.error('dist/pure/demo-regress.js is missing. Run `npm run build` first.')
  process.exit(1)
}
const { applyRegression, REGRESSION_FILE } = await import(pathToFileURL(modulePath).href)

const file = path.join(root, 'demo', 'cursed-shop-copy', REGRESSION_FILE)
let result
try {
  result = applyRegression(readFileSync(file, 'utf8'))
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
}
if (!result.changed) {
  console.log(`demo/cursed-shop-copy/${REGRESSION_FILE} already has the regression. Nothing changed.`)
  process.exit(0)
}
writeFileSync(file, result.html, 'utf8')
console.log(`Added an icon-only "Buy now" button to demo/cursed-shop-copy/${REGRESSION_FILE}.`)
console.log('The next `night-shift audit` and `night-shift diff` should report one new Wraith Nameless Spirit on /product.html.')
