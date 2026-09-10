/**
 * @file legal-packet.ts
 * @fileoverview Legal review packet generator for G3.1 Legal Review Framework (PIX-4429).
 *   Aggregates seed data, per-state checklists, and attorney sign-off status into a
 *   single structured packet that legal counsel can review.
 *
 *   The packet is the artifact that gets handed to attorneys: it contains every
 *   jurisdiction's rule configuration, the statutory references underpinning each
 *   rule, a per-state checklist of items requiring verification, and the current
 *   sign-off state for each jurisdiction.
 */

import { randomUUID } from 'node:crypto'

import { z } from 'zod'

import { generateAllChecklists, generateStateChecklist } from './checklist'
import type { StateChecklist } from './checklist'
import { US_STATE_CODE_LIST } from './schemas'
import {
  getAllSeeds,
  getSeedForState,
  SEED_JURISDICTION_COUNT,
} from './seed-data'
import type { AttorneySignoff, SignoffStatus } from './signoff'
import { attorneySignoffRepository } from './signoff-repository'

/**
 * Schema for a single jurisdiction entry in the legal review packet.
 * Each entry bundles the seed rule, the generated checklist, and any sign-off records.
 */
export const PacketJurisdictionSchema = z
  .object({
    stateCode: z.string().length(2),
    stateName: z.string().min(1).max(100),
    ruleConfig: z.record(z.string(), z.unknown()),
    legalReference: z.string().min(1).max(500),
    sourceUrl: z.string().url().nullable(),
    lastReviewed: z.string(),
    checklist: z.record(z.string(), z.unknown()),
    signoffStatus: z.enum([
      'pending',
      'in_review',
      'approved',
      'rejected',
      'withdrawn',
      'none',
    ]),
    signoffs: z.array(z.record(z.string(), z.unknown())),
  })
  .strict()

/**
 * Schema for the top-level legal review packet.
 */
export const LegalReviewPacketSchema = z
  .object({
    packetId: z.string().uuid(),
    generatedAt: z.string().datetime(),
    jurisdictionCount: z.number().int().nonnegative(),
    jurisdictions: z.array(PacketJurisdictionSchema),
    summary: z
      .object({
        total: z.number().int().nonnegative(),
        approved: z.number().int().nonnegative(),
        inReview: z.number().int().nonnegative(),
        pending: z.number().int().nonnegative(),
        rejected: z.number().int().nonnegative(),
        withdrawn: z.number().int().nonnegative(),
        noSignoff: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()

export type PacketJurisdiction = z.infer<typeof PacketJurisdictionSchema>
export type LegalReviewPacket = z.infer<typeof LegalReviewPacketSchema>

/**
 * Aggregate sign-off records by state code into a lookup map.
 * Returns a map keyed by stateCode → array of sign-offs for that state.
 */
function aggregateSignoffsByState(): Map<string, AttorneySignoff[]> {
  const all = attorneySignoffRepository.listAll()
  const byState = new Map<string, AttorneySignoff[]>()
  for (const signoff of all) {
    const list = byState.get(signoff.stateCode)
    if (list) {
      list.push(signoff)
    } else {
      byState.set(signoff.stateCode, [signoff])
    }
  }
  return byState
}

/**
 * Derive the effective sign-off status for a jurisdiction from its sign-off records.
 * If multiple sign-offs exist for a state, the most "advanced" status wins:
 *   approved > in_review > pending > rejected > withdrawn > none
 */
function deriveSignoffStatus(
  signoffs: AttorneySignoff[],
): SignoffStatus | 'none' {
  if (signoffs.length === 0) {
    return 'none'
  }
  const priority: Record<SignoffStatus, number> = {
    approved: 5,
    in_review: 4,
    pending: 3,
    rejected: 2,
    withdrawn: 1,
  }
  let best: SignoffStatus = 'pending'
  let bestRank = -1
  for (const s of signoffs) {
    const rank = priority[s.status]
    if (rank > bestRank) {
      bestRank = rank
      best = s.status
    }
  }
  return best
}

/**
 * Build a single jurisdiction entry for the packet.
 */
function buildPacketJurisdiction(
  stateCode: string,
  checklist: StateChecklist | undefined,
  signoffs: AttorneySignoff[],
): PacketJurisdiction | undefined {
  const seed = getSeedForState(stateCode)
  if (!seed) {
    return undefined
  }
  return {
    stateCode: seed.stateCode,
    stateName: seed.stateName,
    ruleConfig: seed.ruleConfig,
    legalReference: seed.legalReference,
    sourceUrl: seed.sourceUrl ?? null,
    lastReviewed: seed.lastReviewed,
    checklist: checklist ?? {},
    signoffStatus: deriveSignoffStatus(signoffs),
    signoffs,
  }
}

/**
 * Generate a complete legal review packet covering all seeded jurisdictions.
 * The packet includes the seed rule, generated checklist, and current sign-off
 * status for each jurisdiction, plus a summary of sign-off progress.
 *
 * @returns A structured LegalReviewPacket ready for attorney review.
 */
export function generateLegalReviewPacket(): LegalReviewPacket {
  const checklists = generateAllChecklists()
  const checklistByState = new Map<string, StateChecklist>()
  for (const c of checklists) {
    checklistByState.set(c.stateCode, c)
  }
  const signoffsByState = aggregateSignoffsByState()

  const jurisdictions: PacketJurisdiction[] = []
  for (const stateCode of US_STATE_CODE_LIST) {
    const checklist = checklistByState.get(stateCode)
    const signoffs = signoffsByState.get(stateCode) ?? []
    const entry = buildPacketJurisdiction(stateCode, checklist, signoffs)
    if (entry) {
      jurisdictions.push(entry)
    }
  }

  const summary = {
    total: jurisdictions.length,
    approved: jurisdictions.filter((j) => j.signoffStatus === 'approved')
      .length,
    inReview: jurisdictions.filter((j) => j.signoffStatus === 'in_review')
      .length,
    pending: jurisdictions.filter((j) => j.signoffStatus === 'pending').length,
    rejected: jurisdictions.filter((j) => j.signoffStatus === 'rejected')
      .length,
    withdrawn: jurisdictions.filter((j) => j.signoffStatus === 'withdrawn')
      .length,
    noSignoff: jurisdictions.filter((j) => j.signoffStatus === 'none').length,
  }

  return {
    packetId: randomUUID(),
    generatedAt: new Date().toISOString(),
    jurisdictionCount: jurisdictions.length,
    jurisdictions,
    summary,
  }
}

/**
 * Generate a legal review packet for a single jurisdiction.
 * Useful when an attorney wants to review one state at a time.
 *
 * @param stateCode - Two-letter US state code.
 * @returns A single-jurisdiction packet, or undefined if the state has no seed.
 */
export function generateStatePacket(
  stateCode: string,
): LegalReviewPacket | undefined {
  const checklist = generateStateChecklist(stateCode)
  const signoffs = attorneySignoffRepository.listByState(stateCode)
  const entry = buildPacketJurisdiction(stateCode, checklist, signoffs)
  if (!entry) {
    return undefined
  }
  const summary = {
    total: 1,
    approved: entry.signoffStatus === 'approved' ? 1 : 0,
    inReview: entry.signoffStatus === 'in_review' ? 1 : 0,
    pending: entry.signoffStatus === 'pending' ? 1 : 0,
    rejected: entry.signoffStatus === 'rejected' ? 1 : 0,
    withdrawn: entry.signoffStatus === 'withdrawn' ? 1 : 0,
    noSignoff: entry.signoffStatus === 'none' ? 1 : 0,
  }
  return {
    packetId: randomUUID(),
    generatedAt: new Date().toISOString(),
    jurisdictionCount: 1,
    jurisdictions: [entry],
    summary,
  }
}

/**
 * Convenience export: the expected jurisdiction count for the packet.
 */
export const PACKET_JURISDICTION_COUNT = SEED_JURISDICTION_COUNT
