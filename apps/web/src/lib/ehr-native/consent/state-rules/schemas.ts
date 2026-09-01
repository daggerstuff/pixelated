/**
 * EHR Native — State Consent Rules Zod Schemas (F3.3)
 *
 * Zod validation schemas for versioned state consent rule configurations.
 * These schemas validate every rule config before persistence to PostgreSQL
 * and after retrieval from cache.
 *
 * @see docs/adr/ADR-007-consent-state-rules.md
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Base enums
// ---------------------------------------------------------------------------

export const ConsentLevelSchema = z.enum(['none', 'minimal', 'limited', 'full'])
export type ConsentLevel = z.infer<typeof ConsentLevelSchema>

export const RuleStatusSchema = z.enum([
  'draft',
  'review',
  'approved',
  'active',
  'superseded',
  'archived',
])
export type RuleStatus = z.infer<typeof RuleStatusSchema>

export const AuditActionSchema = z.enum([
  'create',
  'update',
  'submit_for_review',
  'approve',
  'activate',
  'supersede',
  'archive',
  'delete',
])
export type AuditAction = z.infer<typeof AuditActionSchema>

// ---------------------------------------------------------------------------
// US state codes — 50 states + DC + territories
// ---------------------------------------------------------------------------

const US_STATE_CODES = [
  // 50 states
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  // DC
  'DC',
  // Territories
  'PR', // Puerto Rico
  'GU', // Guam
  'VI', // US Virgin Islands
  'AS', // American Samoa
  'MP', // Northern Mariana Islands
] as const

export const StateCodeSchema = z
  .string()
  .length(2)
  .toUpperCase()
  .refine(
    (code) => US_STATE_CODES.includes(code as (typeof US_STATE_CODES)[number]),
    {
      message:
        'Invalid US state code. Must be one of the 50 states, DC, or US territories.',
    },
  )

export const US_STATE_CODE_LIST = [...US_STATE_CODES] as string[]

// ---------------------------------------------------------------------------
// Treatment category overrides — per-category minimum consent levels
// ---------------------------------------------------------------------------

export const TreatmentCategoryOverrideSchema = z.object({
  minimumConsentLevel: ConsentLevelSchema,
  overrideConsentLevel: ConsentLevelSchema.optional(),
})

export const TreatmentCategoryOverridesSchema = z
  .record(z.string(), TreatmentCategoryOverrideSchema)
  .describe('Map of treatment category → override rules')

// ---------------------------------------------------------------------------
// Provider type restrictions — per-provider-type minimum consent levels
// ---------------------------------------------------------------------------

export const ProviderTypeRestrictionsSchema = z
  .record(z.string(), ConsentLevelSchema)
  .describe('Map of provider type → required minimum consent level')

// ---------------------------------------------------------------------------
// Minor consent categories — categories where minors can consent without parent
// ---------------------------------------------------------------------------

export const MinorConsentCategorySchema = z.enum([
  'reproductive_health',
  'mental_health',
  'substance_use_disorder',
  'sexual_health',
  'prenatal_care',
  'emergency',
])

export const MinorConsentCategoriesSchema = z
  .array(MinorConsentCategorySchema)
  .optional()
  .describe(
    'Treatment categories where minors can consent without parental involvement',
  )

// ---------------------------------------------------------------------------
// Legal metadata — references for legal review tracking
// ---------------------------------------------------------------------------

export const LegalMetadataSchema = z
  .object({
    legalReference: z
      .string()
      .max(500)
      .optional()
      .describe('Citation of the law/regulation (e.g., "42 CFR Part 2")'),
    lastLegalReviewDate: z.string().date().optional(),
    nextReviewDueDate: z.string().date().optional(),
    reviewedBy: z.string().max(200).optional(),
  })
  .optional()
  .describe('Legal reference metadata for compliance tracking')

// ---------------------------------------------------------------------------
// Rule configuration — the main schema for the rule_config JSONB column
// ---------------------------------------------------------------------------

export const StateRuleConfigSchema = z
  .object({
    minimumConsentLevel: ConsentLevelSchema.describe(
      'Minimum consent level required for general treatment',
    ),
    overrideConsentLevel: ConsentLevelSchema.optional().describe(
      'Elevated consent level that overrides the minimum for specific operations',
    ),
    requiresMentalHealthConsent: z
      .boolean()
      .describe(
        'Whether mental health treatment requires separate/explicit consent',
      ),
    requiresSUDConsent: z
      .boolean()
      .describe(
        'Whether substance use disorder treatment requires separate/explicit consent',
      ),
    requiresMinorParentalConsent: z
      .boolean()
      .describe('Whether minors need parental consent'),
    ageOfMajority: z
      .number()
      .int()
      .min(16, 'Age of majority must be at least 16')
      .max(21, 'Age of majority cannot exceed 21')
      .describe(
        'The age at which a patient is considered an adult for consent purposes',
      ),
    minorConsentCategories: MinorConsentCategoriesSchema,
    providerTypeRestrictions: ProviderTypeRestrictionsSchema.optional(),
    treatmentCategoryOverrides: TreatmentCategoryOverridesSchema.optional(),
    legalMetadata: LegalMetadataSchema,
  })
  .strict()
  .describe('State consent rule configuration')

export type StateRuleConfig = z.infer<typeof StateRuleConfigSchema>

// ---------------------------------------------------------------------------
// Full rule record — includes DB metadata + rule_config
// ---------------------------------------------------------------------------

export const StateConsentRuleRecordSchema = z.object({
  ruleId: z.string().uuid(),
  tenantId: z.string().uuid().nullable(),
  stateCode: StateCodeSchema,
  version: z.number().int().min(1),
  status: RuleStatusSchema,
  ruleConfig: StateRuleConfigSchema,
  createdBy: z.string().uuid(),
  createdByRole: z.string(),
  reviewedBy: z.string().uuid().nullable(),
  reviewedByRole: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  approvedBy: z.string().uuid().nullable(),
  approvedByRole: z.string().nullable(),
  approvedAt: z.string().datetime().nullable(),
  activatedAt: z.string().datetime().nullable(),
  supersededBy: z.string().uuid().nullable(),
  effectiveDate: z.string().date().nullable(),
  expiryDate: z.string().date().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type StateConsentRuleRecord = z.infer<
  typeof StateConsentRuleRecordSchema
>

// ---------------------------------------------------------------------------
// Create rule input — for creating new draft rules
// ---------------------------------------------------------------------------

export const CreateStateRuleInputSchema = z.object({
  tenantId: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .describe('Tenant ID for tenant-specific rules. NULL for global rules.'),
  stateCode: StateCodeSchema,
  ruleConfig: StateRuleConfigSchema,
  effectiveDate: z.string().date().optional(),
  expiryDate: z.string().date().optional(),
  notes: z.string().max(2000).optional(),
})

export type CreateStateRuleInput = z.infer<typeof CreateStateRuleInputSchema>

// ---------------------------------------------------------------------------
// Update rule input — for updating draft rules
// ---------------------------------------------------------------------------

export const UpdateStateRuleInputSchema = z.object({
  ruleConfig: StateRuleConfigSchema.optional(),
  effectiveDate: z.string().date().nullable().optional(),
  expiryDate: z.string().date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export type UpdateStateRuleInput = z.infer<typeof UpdateStateRuleInputSchema>

// ---------------------------------------------------------------------------
// State transition input — for workflow transitions
// ---------------------------------------------------------------------------

export const SubmitForReviewInputSchema = z.object({
  ruleId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
})

export const ApproveRuleInputSchema = z.object({
  ruleId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
})

export const ActivateRuleInputSchema = z.object({
  ruleId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
})

export const ArchiveRuleInputSchema = z.object({
  ruleId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
})

// ---------------------------------------------------------------------------
// Audit record schema
// ---------------------------------------------------------------------------

export const StateRuleAuditRecordSchema = z.object({
  auditId: z.string().uuid(),
  ruleId: z.string().uuid().nullable(),
  tenantId: z.string().uuid().nullable(),
  stateCode: StateCodeSchema,
  version: z.number().int().min(1),
  action: AuditActionSchema,
  actorId: z.string().uuid(),
  actorRole: z.string(),
  oldStatus: RuleStatusSchema.nullable(),
  newStatus: RuleStatusSchema.nullable(),
  changes: z.record(z.string(), z.unknown()).nullable(),
  timestamp: z.string().datetime(),
  createdAt: z.string().datetime(),
})

export type StateRuleAuditRecord = z.infer<typeof StateRuleAuditRecordSchema>

// ---------------------------------------------------------------------------
// Query/filter schemas
// ---------------------------------------------------------------------------

export const ListRulesQuerySchema = z.object({
  stateCode: StateCodeSchema.optional(),
  status: RuleStatusSchema.optional(),
  tenantId: z.string().uuid().nullable().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
})

export type ListRulesQuery = z.infer<typeof ListRulesQuerySchema>

// ---------------------------------------------------------------------------
// Validation helper — validates rule config and returns parsed or throws
// ---------------------------------------------------------------------------

/**
 * Validate a state consent rule configuration.
 * Throws ZodError if invalid.
 */
export function validateStateRuleConfig(config: unknown): StateRuleConfig {
  return StateRuleConfigSchema.parse(config)
}

/**
 * Safely validate a state consent rule configuration.
 * Returns { success: true, data } or { success: false, error }.
 */
export function safeValidateStateRuleConfig(
  config: unknown,
):
  | { success: true; data: StateRuleConfig }
  | { success: false; error: z.ZodError } {
  return StateRuleConfigSchema.safeParse(config)
}
