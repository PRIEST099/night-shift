/** UTC start time as `YYYYMMDDTHHmmssZ`. */
export function formatPatrolId(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

/** Patrol ids become directory and file names, so only a safe alphabet is accepted. */
export function isValidPatrolId(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id) || /^\d{8}T\d{6}Z$/.test(id)
}
