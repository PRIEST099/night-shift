/** A short, filesystem-safe name for a page entry from patrol.yaml. `/index.html` becomes `index-html`, `/` becomes `root`. */
export function slugify(page: string): string {
  let s = page
  const url = /^https?:\/\//i.exec(s)
  if (url) s = s.slice(url[0].length)
  s = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (s.length > 40) s = s.slice(0, 40).replace(/-+$/g, '')
  return s === '' ? 'root' : s
}
