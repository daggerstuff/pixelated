/**
 * EHR Native — Attorney Sign-off Repository (G3.1 / PIX-4429)
 *
 * In-memory repository for attorney sign-off records. Minimal surface for
 * the legal review gate: create, get, list (by state / by attorney), update
 * status, and withdraw. Enforces the sign-off state machine on transitions.
 *
 * This is an in-memory implementation for the legal review framework. A
 * PostgreSQL-backed repository (ehr_attorney_signoffs table) can replace this
 * once the DB migration is approved — the public API is stable.
 *
 * @see docs/adr/ADR-007-consent-state-rules.md
 */

import { randomUUID } from 'node:crypto'
import type {
  AttorneySignoff,
  CreateSignoffInput,
  SignoffStatus,
} from './signoff'
import {
  validateSignoffTransition,
  CreateSignoffInputSchema,
  UpdateSignoffInputSchema,
} from './signoff'

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class AttorneySignoffRepository {
  private readonly records = new Map<string, AttorneySignoff>()

  /**
   * Create a new sign-off record in `pending` status.
   */
  create(input: CreateSignoffInput): AttorneySignoff {
    const parsed = CreateSignoffInputSchema.parse(input)
    const now = new Date().toISOString()
    const signoff: AttorneySignoff = {
      signoffId: randomUUID(),
      stateCode: parsed.stateCode,
      attorneyId: parsed.attorneyId,
      attorneyName: parsed.attorneyName,
      attorneyBarNumber: parsed.attorneyBarNumber,
      status: 'pending',
      signedAt: null,
      expiresAt: parsed.expiresAt ?? null,
      notes: parsed.notes ?? null,
      createdAt: now,
      updatedAt: now,
    }
    this.records.set(signoff.signoffId, signoff)
    return { ...signoff }
  }

  /**
   * Get a sign-off record by ID.
   */
  getById(signoffId: string): AttorneySignoff | undefined {
    const record = this.records.get(signoffId)
    return record ? { ...record } : undefined
  }

  /**
   * List sign-off records for a state/territory.
   * @param stateCode 2-letter USPS code
   * @param status optional status filter
   */
  listByState(
    stateCode: string,
    status?: SignoffStatus,
  ): AttorneySignoff[] {
    return Array.from(this.records.values()).filter(
      (r) =>
        r.stateCode === stateCode &&
        (status === undefined || r.status === status),
    )
  }

  /**
   * List sign-off records for an attorney.
   * @param attorneyId UUID
   * @param status optional status filter
   */
  listByAttorney(
    attorneyId: string,
    status?: SignoffStatus,
  ): AttorneySignoff[] {
    return Array.from(this.records.values()).filter(
      (r) =>
        r.attorneyId === attorneyId &&
        (status === undefined || r.status === status),
    )
  }

  /**
   * List all sign-off records (optionally filtered by status).
   */
  listAll(status?: SignoffStatus): AttorneySignoff[] {
    return Array.from(this.records.values()).filter(
      (r) => status === undefined || r.status === status,
    )
  }

  /**
   * Update a sign-off's status. Validates the state machine transition.
   * @throws if the transition is invalid or the record does not exist.
   */
  updateStatus(
    signoffId: string,
    newStatus: SignoffStatus,
    notes?: string,
  ): AttorneySignoff | undefined {
    const existing = this.records.get(signoffId)
    if (!existing) {
      return undefined
    }

    validateSignoffTransition(existing.status, newStatus)

    const now = new Date().toISOString()
    const updated: AttorneySignoff = {
      ...existing,
      status: newStatus,
      signedAt:
        newStatus === 'approved' || newStatus === 'rejected'
          ? now
          : existing.signedAt,
      notes: notes ?? existing.notes,
      updatedAt: now,
    }
    this.records.set(signoffId, updated)
    return { ...updated }
  }

  /**
   * Withdraw a previously-approved sign-off.
   * @throws if the record is not in `approved` status.
   */
  withdraw(signoffId: string, notes?: string): AttorneySignoff | undefined {
    return this.updateStatus(signoffId, 'withdrawn', notes)
  }

  /**
   * Clear all records. For testing only.
   */
  clear(): void {
    this.records.clear()
  }

  /**
   * Get the total record count.
   */
  size(): number {
    return this.records.size
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const attorneySignoffRepository = new AttorneySignoffRepository()

// Re-export update input schema for consumers
export { UpdateSignoffInputSchema }
