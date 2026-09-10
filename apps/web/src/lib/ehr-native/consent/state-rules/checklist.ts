/**
 * EHR Native — Per-State Legal Checklists (G3.1 / PIX-4429)
 *
 * Generates review checklists per US jurisdiction so legal counsel can verify
 * each aspect of the state consent rule configuration against current law.
 * Each checklist item references the relevant seed data field and the legal
 * reference it must be verified against.
 *
 * @see docs/adr/ADR-007-consent-state-rules.md
 */

import { z } from 'zod'

import { StateCodeSchema, US_STATE_CODE_LIST } from './schemas'
import { getSeedForState, getAllSeeds, type StateRuleSeed } from './seed-data'

// ---------------------------------------------------------------------------
// Checklist item schema
// ---------------------------------------------------------------------------

export const ChecklistItemStatusSchema = z.enum([
  'pending',
  'verified',
  'flagged',
  'not_applicable',
])
export type ChecklistItemStatus = z.infer<typeof ChecklistItemStatusSchema>

export const StateChecklistItemSchema = z
  .object({
    itemId: z
      .string()
      .describe('Stable unique identifier for this checklist item'),
    stateCode: StateCodeSchema,
    category: z
      .string()
      .describe('Checklist category (e.g., "age_of_majority")'),
    label: z.string().describe('Human-readable label for legal review'),
    description: z.string().describe('Detailed explanation of what to verify'),
    legalReference: z
      .string()
      .describe('Statute/regulation citation to check against'),
    seedValue: z.string().describe('Current seed value being reviewed'),
    status: ChecklistItemStatusSchema.default('pending'),
  })
  .strict()

export type StateChecklistItem = z.infer<typeof StateChecklistItemSchema>

export const StateChecklistSchema = z
  .object({
    stateCode: StateCodeSchema,
    stateName: z.string(),
    items: z.array(StateChecklistItemSchema),
    generatedAt: z.string().datetime(),
  })
  .strict()

export type StateChecklist = z.infer<typeof StateChecklistSchema>

// ---------------------------------------------------------------------------
// Checklist category generators
// ---------------------------------------------------------------------------

function makeItem(
  stateCode: string,
  category: string,
  label: string,
  description: string,
  legalReference: string,
  seedValue: string,
  itemIdSuffix: string,
): StateChecklistItem {
  return {
    itemId: `${stateCode.toLowerCase()}-${itemIdSuffix}`,
    stateCode,
    category,
    label,
    description,
    legalReference,
    seedValue,
    status: 'pending',
  }
}

function buildChecklistForSeed(seed: StateRuleSeed): StateChecklistItem[] {
  const { stateCode, ruleConfig, legalReference } = seed
  const items: StateChecklistItem[] = []

  // 1. Age of majority
  items.push(
    makeItem(
      stateCode,
      'age_of_majority',
      'Verify age of majority',
      `Confirm the age of majority for ${seed.stateName} matches current statute. Minors below this age require parental consent unless a minor consent exception applies.`,
      legalReference,
      `${ruleConfig.ageOfMajority}`,
      'age-of-majority',
    ),
  )

  // 2. Mental health consent requirement
  items.push(
    makeItem(
      stateCode,
      'mental_health_consent',
      'Verify mental health consent requirement',
      `Confirm whether ${seed.stateName} requires separate/explicit consent for mental health treatment. Some states require dedicated MH consent forms (e.g., Baker Act equivalents).`,
      legalReference,
      `${ruleConfig.requiresMentalHealthConsent}`,
      'mh-consent',
    ),
  )

  // 3. SUD consent requirement
  items.push(
    makeItem(
      stateCode,
      'sud_consent',
      'Verify substance use disorder consent requirement',
      `Confirm whether ${seed.stateName} requires separate consent for SUD treatment. Federal 42 CFR Part 2 applies federally; state law may add additional requirements.`,
      legalReference,
      `${ruleConfig.requiresSUDConsent}`,
      'sud-consent',
    ),
  )

  // 4. Minor parental consent requirement
  items.push(
    makeItem(
      stateCode,
      'minor_parental_consent',
      'Verify minor parental consent requirement',
      `Confirm whether ${seed.stateName} generally requires parental consent for minors. Check minor consent exceptions below.`,
      legalReference,
      `${ruleConfig.requiresMinorParentalConsent}`,
      'minor-parental',
    ),
  )

  // 5. Minor consent categories
  const minorCats = ruleConfig.minorConsentCategories
  items.push(
    makeItem(
      stateCode,
      'minor_consent_categories',
      'Verify minor consent categories',
      `Confirm the treatment categories where minors in ${seed.stateName} may consent without parental involvement (e.g., reproductive health, MH, SUD, sexual health, prenatal care).`,
      legalReference,
      minorCats ? minorCats.join(', ') : 'none specified',
      'minor-categories',
    ),
  )

  // 6. Minimum consent level
  items.push(
    makeItem(
      stateCode,
      'minimum_consent_level',
      'Verify minimum consent level',
      `Confirm the baseline minimum consent level required for general treatment in ${seed.stateName}. This drives engine enforcement.`,
      legalReference,
      ruleConfig.minimumConsentLevel,
      'min-consent-level',
    ),
  )

  // 7. Legal reference currency
  items.push(
    makeItem(
      stateCode,
      'legal_reference_currency',
      'Verify legal reference is current',
      `Confirm the cited statute(s) for ${seed.stateName} are still in effect and have not been amended or superseded since ${seed.lastReviewed}.`,
      legalReference,
      seed.lastReviewed,
      'legal-ref-currency',
    ),
  )

  return items
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a legal review checklist for a single state/territory.
 * @param stateCode 2-letter USPS code
 * @returns StateChecklist with all review items, or undefined if no seed exists
 */
export function generateStateChecklist(
  stateCode: string,
): StateChecklist | undefined {
  const seed = getSeedForState(stateCode)
  if (!seed) {
    return undefined
  }

  return {
    stateCode: seed.stateCode,
    stateName: seed.stateName,
    items: buildChecklistForSeed(seed),
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Generate legal review checklists for all 56 US jurisdictions.
 * @returns array of StateChecklist, one per jurisdiction
 */
export function generateAllChecklists(): StateChecklist[] {
  return getAllSeeds().map((seed) => ({
    stateCode: seed.stateCode,
    stateName: seed.stateName,
    items: buildChecklistForSeed(seed),
    generatedAt: new Date().toISOString(),
  }))
}

/**
 * Get the list of state codes covered by checklist generation.
 * Same as US_STATE_CODE_LIST — all 56 jurisdictions have seeds.
 */
export function getChecklistJurisdictions(): string[] {
  return [...US_STATE_CODE_LIST]
}
