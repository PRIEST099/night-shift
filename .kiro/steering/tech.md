---
inclusion: always
---

# Tech

- Node 22 or later, TypeScript strict, ES modules, `module: NodeNext`. Vitest and fast-check (at least 100 runs per property).
- `src/pure/` takes and returns plain data and is property tested. `src/io/` is the only code that touches the network, disk or processes. Commands in `src/commands/` compose them and take injected dependencies, so tests use a fake `AuditPage` instead of the real server.
- The audit engine is the THE UNSEEN MCP server, started over stdio from `UNSEEN_MCP_SERVER_JS` (default `../the-unseen/packages/mcp/dist/server.js`) and called with `audit_url { url, page: 'full' }`.
- Fingerprints are `type|kind|htmlSnippet#n`. Node ids are never part of one.
- `verify` decides with `decide()`: the target by fingerprint, every other haunting by `type|kind` count per page.
- Windows host: set `UNSEEN_CHROMIUM_CHANNEL=chromium` for any browser step. The Core CLI starts processes with argument arrays, never a shell string built from `patrol.yaml`.
- The dashboard is `ui/src/*.tsx` built by Vite into the committed `ui/dist/index.mjs`. `react`, `react-dom`, `react/jsx-runtime`, `lucide-react` and `@kirocrew/app-sdk` stay external.
- Write files without a byte order mark (a BOM breaks a `#!` line).
- Commands: `npm run build`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run build:ui`, `npm run demo:reject`.
