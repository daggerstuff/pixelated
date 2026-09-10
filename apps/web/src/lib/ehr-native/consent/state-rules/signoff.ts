/**
 * EHR Native — Attorney Sign-off Tracking (G3.1 / PIX-4429)
 *
 * Schemas and state machine for tracking attorney sign-off on state consent
 * rules. Each jurisdiction requires legal review and sign-off before a rule
 * can be activated. Sign-off records capture who reviewed, when, and the
 * disposition (approved/rejected/withdrawn).
 *
 * Sign-off state machine:
 *   pending → in_review → approved
 *                       → rejected
 *   approved → withdrawn
 *
 * @see docs/adr/ADR-007-consent-state-rules.md
 */

import { z } from 'zod'

import { StateCodeSchema } from './schemas'

// ---------------------------------------------------------------------------
// Sign-off status enum
// ---------------------------------------------------------------------------

export const SignoffStatusSchema = z.enum([
  'pending',
  'in_review',
  'approved',
  'rejected',
  'withdrawn',
])
export type SignoffStatus = z.infer<typeof SignoffStatusSchema>

// ---------------------------------------------------------------------------
// Attorney sign-off record
// ---------------------------------------------------------------------------

export const AttorneySignoffSchema = z
  .object({
    signoffId: z.string().uuid(),
    stateCode: StateCodeSchema,
    attorneyId: z.string().uuid(),
    attorneyName: z.string().min(1).max(200),
    attorneyBarNumber: z.string().max(100).optional(),
    status: SignoffStatusSchema,
    signedAt: z.string().datetime().nullable(),
    expiresAt: z.string().date().nullable(),
    notes: z.string().max(2000).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()

export type AttorneySignoff = z.infer<typeof AttorneySignoffSchema>

// ---------------------------------------------------------------------------
// Create / Update inputs
// ---------------------------------------------------------------------------

export const CreateSignoffInputSchema = z
  .object({
    stateCode: StateCodeSchema,
    attorneyId: z.string().uuid(),
    attorneyName: z.string().min(1).max(200),
    attorneyBarNumber: z.string().max(100).optional(),
    expiresAt: z.string().date().optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict()

export type CreateSignoffInput = z.infer<typeof CreateSignoffInputSchema>

export const UpdateSignoffInputSchema = z
  .object({
    status: SignoffStatusSchema,
    notes: z.string().max(2000).optional(),
    expiresAt: z.string().date().nullable().optional(),
  })
  .strict()

type UpdateSignoffInput = z.infer<typeof UpdateSignoffInputSchema>

// ---------------------------------------------------------------------------
// State machine validation
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<SignoffStatus, SignoffStatus[]> = {
  pending: ['in_review'],
  in_review: ['approved', 'rejected'],
  approved: ['withdrawn'],
  rejected: [],
  withdrawn: [],
}

/**
 * Determine if a status transition is allowed.
 * @param from current status
 * @param to target status
 * @returns true if the transition is valid
 */
export function isValidSignoffTransition(
  from: SignoffStatus,
  to: SignoffStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Get the list of valid next statuses from a given status.
 */
export function getAllowedTransitions(from: SignoffStatus): SignoffStatus[] {
  return [...(ALLOWED_TRANSITIONS[from] ?? [])]
}

/**
 * Validate a sign-off transition and return the new status, or throw.
 * @throws Error if the transition is not allowed
 */
export function validateSignoffTransition(
  from: SignoffStatus,
  to: SignoffStatus,
): SignoffStatus {
  if (!isValidSignoffTransition(from, to)) {
    throw new Error(
      `Invalid sign-off transition: ${from} → ${to}. Allowed: ${getAllowedTransitions(from).join(', ') || 'none'}`,
    )
  }
  return to
}

export { ALLOWED_TRANSITIONS as SIGNOFF_ALLOWED_TRANSITIONS }
