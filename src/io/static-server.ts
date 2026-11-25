import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

export type StaticServer = { url: string; port: number; close: () => Promise<void> }

/** Resolve a request path inside root. Returns undefined when it escapes the root or contains a NUL byte. */
export function resolveInside(root: string, requestPath: string): string | undefined {
  let decoded: string
  try {
    decoded = decodeURIComponent(requestPath.split('?')[0]!.split('#')[0]!)
  } catch {
    return undefined
  }
  if (decoded.includes('\0')) return undefined
  const rootAbs = path.resolve(root)
  const target = path.resolve(rootAbs, `.${path.sep}${decoded.replace(/^[\\/]+/, '')}`)
  const rel = path.relative(rootAbs, target)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return undefined
  return target
}

/** Serve a directory on 127.0.0.1 and a free port. Never reads outside the directory. */
export async function startStaticServer(root: string): Promise<StaticServer> {
  const rootAbs = path.resolve(root)
  const server: Server = createServer((req, res) => {
    void handle(rootAbs, req.url ?? '/', req.method ?? 'GET').then(
      (r) => {
        res.writeHead(r.status, { 'content-type': r.type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
        res.end(req.method === 'HEAD' ? undefined : r.body)
      },
      () => {
        res.writeHead(500, { 'content-type': 'text/plain' })
        res.end('error')
      }
    )
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const addr = server.address()
  if (addr === null || typeof addr === 'string') throw new Error('static server has no port')
  return {
    url: `http://127.0.0.1:${addr.port}`,
    port: addr.port,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
      }),
  }
}

async function handle(root: string, url: string, method: string): Promise<{ status: number; type: string; body: Buffer | string }> {
  if (method !== 'GET' && method !== 'HEAD') return { status: 405, type: 'text/plain', body: 'method not allowed' }
  let target = resolveInside(root, url)
  if (target === undefined) return { status: 403, type: 'text/plain', body: 'forbidden' }
  try {
    let s = await stat(target)
    if (s.isDirectory()) {
      target = path.join(target, 'index.html')
      s = await stat(target)
    }
    if (!s.isFile()) return { status: 404, type: 'text/plain', body: 'not found' }
    const body = await readFile(target)
    return { status: 200, type: TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream', body }
  } catch {
    return { status: 404, type: 'text/plain', body: 'not found' }
  }
}
