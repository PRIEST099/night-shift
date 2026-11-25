import { z } from 'zod'

export const REASON_CODES = ['target-still-present', 'new-haunting', 'unsafe-change'] as const
export type ReasonCode = (typeof REASON_CODES)[number]

export const reasonSchema = z.object({
  code: z.enum(REASON_CODES),
  message: z.string(),
  page: z.string().optional(),
  type: z.string().optional(),
  kind: z.string().optional(),
  snippet: z.string().optional(),
})
export type Reason = z.infer<typeof reasonSchema>

export const fixRecordSchema = z.object({
  schemaVersion: z.literal(1),
  patrolId: z.string(),
  site: z.string(),
  hauntingId: z.string(),
  fingerprint: z.string(),
  page: z.string(),
  type: z.string(),
  severity: z.enum(['Wraith', 'Restless', 'Banished']),
  decision: z.enum(['keep', 'reject']),
  reasons: z.array(reasonSchema),
  scoreBefore: z.record(z.number()),
  scoreAfter: z.record(z.number()),
  changedFiles: z.array(z.string()),
  attempt: z.number().int().min(1),
  /** `recorded-attempt` marks a committed fix (demo/bad-fix) that was not produced by an agent run. */
  origin: z.enum(['crew', 'recorded-attempt']).default('crew'),
  applied: z.boolean().default(false),
  verifiedAt: z.string(),
  previousAttempts: z
    .array(z.object({ attempt: z.number().int(), decision: z.enum(['keep', 'reject']), reasons: z.array(reasonSchema) }))
    .default([]),
})
export type FixRecord = z.infer<typeof fixRecordSchema>
