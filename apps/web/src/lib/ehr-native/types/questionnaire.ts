/**
 * FHIR R4 Questionnaire and QuestionnaireResponse Zod schemas.
 *
 * Used for standardized outcome measures (PHQ-9, GAD-7, OQ-45) in the
 * outcome-measure-trending feature (F2.4 / PIX-4409).
 *
 * @see https://hl7.org/fhir/R4/questionnaire.html
 * @see https://hl7.org/fhir/R4/questionnaireresponse.html
 */

import { z } from 'zod'

import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirReferenceSchema,
  fhirCodingSchema,
  fhirBackboneElementSchema,
  fhirStringSchema,
  fhirCodeSchema,
  fhirUriSchema,
  fhirCanonicalSchema,
  fhirDateTimeSchema,
  fhirInstantSchema,
  fhirIntegerSchema,
  fhirPositiveIntSchema,
} from './base.js'

// ---------------------------------------------------------------------------
// Questionnaire item answer option types
// ---------------------------------------------------------------------------

/** Allowed answer option value types for Questionnaire.answerOption. */
const answerOptionValueSchema = z.union([
  z.object({ valueInteger: fhirIntegerSchema }),
  z.object({ valueDecimal: z.number() }),
  z.object({ valueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ valueTime: z.string().regex(/^\d{2}:\d{2}:\d{2}/) }),
  z.object({ valueDateTime: fhirDateTimeSchema }),
  z.object({ valueString: fhirStringSchema }),
  z.object({ valueCoding: fhirCodingSchema }),
  z.object({ valueReference: fhirReferenceSchema }),
])

/** A single answer option in a Questionnaire item. */
export const questionnaireAnswerOptionSchema = fhirBackboneElementSchema.extend(
  {
    valueInteger: fhirIntegerSchema.optional(),
    valueDecimal: z.number().optional(),
    valueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    valueTime: z
      .string()
      .regex(/^\d{2}:\d{2}:\d{2}/)
      .optional(),
    valueDateTime: fhirDateTimeSchema.optional(),
    valueString: fhirStringSchema.optional(),
    valueCoding: fhirCodingSchema.optional(),
    valueReference: fhirReferenceSchema.optional(),
  },
)

/** EnableWhen condition for conditional item display. */
export const questionnaireEnableWhenSchema = fhirBackboneElementSchema.extend({
  question: fhirStringSchema,
  operator: z.enum(['exists', '=', '!=', '>', '<', '>=', '<=']),
  answerInteger: fhirIntegerSchema.optional(),
  answerDecimal: z.number().optional(),
  answerDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  answerDateTime: fhirDateTimeSchema.optional(),
  answerString: fhirStringSchema.optional(),
  answerCoding: fhirCodingSchema.optional(),
  answerReference: fhirReferenceSchema.optional(),
})

/** Answer constraint for questionnaire items. */
export const questionnaireEnableBehaviorSchema = z.enum(['all', 'any'])

/** Item type per FHIR R4 Questionnaire.item.type. */
export const questionTypeSchema = z.enum([
  'group',
  'display',
  'boolean',
  'decimal',
  'integer',
  'date',
  'dateTime',
  'time',
  'string',
  'text',
  'url',
  'choice',
  'open-choice',
  'attachment',
  'reference',
  'quantity',
])

// ---------------------------------------------------------------------------
// Questionnaire item (recursive)
// ---------------------------------------------------------------------------

/**
 * Recursive questionnaire item schema.
 * Uses Zod lazy evaluation for nested `item` arrays.
 */
export const questionnaireItemSchema: z.ZodType = z.lazy(() =>
  fhirBackboneElementSchema.extend({
    linkId: fhirStringSchema,
    definition: fhirUriSchema.optional(),
    code: z.array(fhirCodingSchema).optional(),
    prefix: fhirStringSchema.optional(),
    text: fhirStringSchema.optional(),
    type: questionTypeSchema,
    enableWhen: z.array(questionnaireEnableWhenSchema).optional(),
    enableBehavior: questionnaireEnableBehaviorSchema.optional(),
    required: z.boolean().optional(),
    repeats: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    answerOption: z.array(questionnaireAnswerOptionSchema).optional(),
    answerValueSet: fhirCanonicalSchema.optional(),
    item: z.array(questionnaireItemSchema).optional(),
  }),
)

// ---------------------------------------------------------------------------
// Questionnaire resource
// ---------------------------------------------------------------------------

export const questionnaireSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('Questionnaire'),
  url: fhirUriSchema.optional(),
  identifier: z.array(fhirIdentifierSchema).optional(),
  version: fhirStringSchema.optional(),
  name: fhirStringSchema.optional(),
  title: fhirStringSchema.optional(),
  derivedFrom: z.array(fhirCanonicalSchema).optional(),
  status: z.enum(['draft', 'active', 'retired', 'unknown']),
  experimental: z.boolean().optional(),
  subjectType: z.array(fhirCodeSchema).optional(),
  date: fhirDateTimeSchema.optional(),
  publisher: fhirStringSchema.optional(),
  contact: z
    .array(
      fhirBackboneElementSchema.extend({
        name: fhirStringSchema.optional(),
        telecom: z
          .array(
            fhirBackboneElementSchema.extend({
              system: z
                .enum(['phone', 'fax', 'email', 'pager', 'url', 'sms', 'other'])
                .optional(),
              value: fhirStringSchema.optional(),
              use: z.enum(['home', 'work', 'temp', 'old', 'mobile']).optional(),
              rank: fhirPositiveIntSchema.optional(),
              period: z.lazy(() => fhirBackboneElementSchema).optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  description: fhirStringSchema.optional(),
  useContext: z.array(fhirCodeableConceptSchema).optional(),
  jurisdiction: z.array(fhirCodeableConceptSchema).optional(),
  purpose: fhirStringSchema.optional(),
  copyright: fhirStringSchema.optional(),
  approvalDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  lastReviewDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  effectivePeriod: z
    .object({
      start: fhirDateTimeSchema.optional(),
      end: fhirDateTimeSchema.optional(),
    })
    .optional(),
  code: z.array(fhirCodingSchema).optional(),
  item: z.array(questionnaireItemSchema).optional(),
})

export type Questionnaire = z.infer<typeof questionnaireSchema>

// ---------------------------------------------------------------------------
// QuestionnaireResponse item + answer
// ---------------------------------------------------------------------------

/** A single answer in a QuestionnaireResponse. */
export const questionnaireResponseAnswerSchema =
  fhirBackboneElementSchema.extend({
    valueDecimal: z.number().optional(),
    valueInteger: fhirIntegerSchema.optional(),
    valueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    valueDateTime: fhirDateTimeSchema.optional(),
    valueTime: z
      .string()
      .regex(/^\d{2}:\d{2}:\d{2}/)
      .optional(),
    valueString: fhirStringSchema.optional(),
    valueBoolean: z.boolean().optional(),
    valueCoding: fhirCodingSchema.optional(),
    valueReference: fhirReferenceSchema.optional(),
  })

/** Recursive response item. */
export const questionnaireResponseItemSchema: z.ZodType = z.lazy(() =>
  fhirBackboneElementSchema.extend({
    linkId: fhirStringSchema,
    definition: fhirUriSchema.optional(),
    text: fhirStringSchema.optional(),
    answer: z.array(questionnaireResponseAnswerSchema).optional(),
    item: z.array(questionnaireResponseItemSchema).optional(),
  }),
)

// ---------------------------------------------------------------------------
// QuestionnaireResponse resource
// ---------------------------------------------------------------------------

export const questionnaireResponseSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('QuestionnaireResponse'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  basedOn: z.array(fhirReferenceSchema).optional(),
  partOf: z.array(fhirReferenceSchema).optional(),
  questionnaire: fhirCanonicalSchema.optional(),
  status: z.enum([
    'in-progress',
    'completed',
    'amended',
    'entered-in-error',
    'stopped',
  ]),
  subject: fhirReferenceSchema.optional(),
  encounter: fhirReferenceSchema.optional(),
  authored: fhirDateTimeSchema.optional(),
  author: fhirReferenceSchema.optional(),
  source: fhirReferenceSchema.optional(),
  item: z.array(questionnaireResponseItemSchema).optional(),
})

export type QuestionnaireResponse = z.infer<typeof questionnaireResponseSchema>

// ---------------------------------------------------------------------------
// Outcome measure specific types
// ---------------------------------------------------------------------------

/** Supported standardized outcome measure identifiers. */
export const outcomeMeasureTypeSchema = z.enum(['phq-9', 'gad-7', 'oq-45'])
export type OutcomeMeasureType = z.infer<typeof outcomeMeasureTypeSchema>

/** Severity level for an outcome measure score. */
export const severityLevelSchema = z.enum([
  'minimal',
  'mild',
  'moderate',
  'moderately-severe',
  'severe',
])
export type SeverityLevel = z.infer<typeof severityLevelSchema>

/** Cadence for measure administration. */
export const measureCadenceSchema = z.enum(['weekly', 'biweekly'])
export type MeasureCadence = z.infer<typeof measureCadenceSchema>

/**
 * Configuration for a measure assigned to a patient.
 * Stored per-patient to track which measures are active and their cadence.
 */
export const measureConfigSchema = z.object({
  patientId: fhirStringSchema,
  measureType: outcomeMeasureTypeSchema,
  cadence: measureCadenceSchema,
  active: z.boolean().default(true),
  nextDueDate: fhirDateTimeSchema.optional(),
  lastAdministeredDate: fhirDateTimeSchema.optional(),
})

export type MeasureConfig = z.infer<typeof measureConfigSchema>

/**
 * Scored outcome result with severity interpretation.
 * This is stored as the Observation interpretation code.
 */
export const outcomeScoreSchema = z.object({
  measureType: outcomeMeasureTypeSchema,
  totalScore: fhirIntegerSchema,
  maxScore: fhirIntegerSchema,
  severity: severityLevelSchema,
  administeredAt: fhirDateTimeSchema,
  alertFlag: z.boolean().default(false),
  alertReason: fhirStringSchema.optional(),
  changeFromPrevious: fhirIntegerSchema.optional(),
})

export type OutcomeScore = z.infer<typeof outcomeScoreSchema>
