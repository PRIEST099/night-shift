export type Ctx = {
  cwd: string
  env: NodeJS.ProcessEnv
  log: (message: string) => void
  error: (message: string) => void
}

export type CommandResult = { code: number }
