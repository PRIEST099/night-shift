// Type shim: @kirocrew/app-sdk is provided by the Crew host through its import map and is not installable from npm on this host.
// The export names below are an assumption, recorded in tasks.md Notes. Only ui/src/index.tsx uses them.
declare module '@kirocrew/app-sdk' {
  import type { ComponentType } from 'react'
  export type PageDefinition = { route: string; component: ComponentType }
  export function defineApp(app: { pages: PageDefinition[] }): unknown
}
