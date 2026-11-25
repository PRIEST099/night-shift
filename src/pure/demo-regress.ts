/**
 * The demo regression: one small, realistic "someone shipped this today" change to the Cursed Shop copy.
 *
 * It adds an icon-only "Buy now" (express checkout) button next to the wishlist button on product.html.
 * The button is focusable and has no accessible name. Its class mentions `buy`, a core task word, so THE UNSEEN
 * reports exactly one new Wraith Nameless Spirit. The obvious `aria-hidden="true"` fix hides a focusable control
 * and creates a Veiled haunting (rejected). `aria-label="Buy now"` gives it a name (kept).
 */

export const REGRESSION_FILE = 'product.html'
export const REGRESSION_MARKER = 'buy-now-btn'

const ANCHOR = /<button class="wishlist-btn" aria-label="Add to wishlist">[\s\S]*?<\/button>/

const NEW_BUTTON_LINES = [
  '<!-- Shipped today: express checkout (icon only) -->',
  '<button class="wishlist-btn buy-now-btn" onclick="location.href=\'checkout.html\'">',
  '  <svg viewBox="0 0 24 24" role="none" focusable="false">',
  '    <path d="M7 2v11h3v9l7-12h-4l4-8z"/>',
  '  </svg>',
  '</button>',
]

export type RegressionResult = { html: string; changed: boolean }

/** Adds the button after the wishlist button. Applying it twice changes nothing. Throws if the page has no wishlist button. */
export function applyRegression(html: string): RegressionResult {
  if (html.includes(REGRESSION_MARKER)) return { html, changed: false }
  const match = ANCHOR.exec(html)
  if (!match) throw new Error(`${REGRESSION_FILE} has no wishlist button to place the new button after. Run \`npm run demo:reset\` first.`)
  const eol = html.includes('\r\n') ? '\r\n' : '\n'
  const indent = ' '.repeat(12)
  const end = match.index + match[0].length
  const inserted = NEW_BUTTON_LINES.map((l) => `${eol}${indent}${l}`).join('')
  return { html: html.slice(0, end) + inserted + html.slice(end), changed: true }
}
