import path from 'node:path'

/**
 * The directory every relative path of the CLI is resolved against: the `--home` flag, else
 * `NIGHT_SHIFT_HOME` when it is set and not blank, else the working directory. A Crew session does not
 * start in the repository, and Crew grants a shell command only when it is one plain command (a
 * `cd '<dir>'; ...` chain with a quote or a backslash is never pre-approved), so an unattended agent
 * passes `--home '<dir>'` instead of changing directory.
 */
export function resolveHome(env: Readonly<Record<string, string | undefined>>, cwd: string, flag?: string): string {
  const chosen = flag?.trim() || env.NIGHT_SHIFT_HOME?.trim()
  return chosen ? path.resolve(cwd, chosen) : cwd
}

export type HomeArgs = { argv: string[]; home?: string; error?: string }

/** Take every `--home <dir>` / `--home=<dir>` out of argv, wherever it stands. The last one wins. */
export function extractHome(argv: readonly string[]): HomeArgs {
  const rest: string[] = []
  let home: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--home') {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) return { argv: rest, error: '--home needs a directory' }
      home = value
      i++
    } else if (arg.startsWith('--home=')) {
      const value = arg.slice('--home='.length)
      if (!value) return { argv: rest, error: '--home needs a directory' }
      home = value
    } else {
      rest.push(arg)
    }
  }
  return home === undefined ? { argv: rest } : { argv: rest, home }
}
