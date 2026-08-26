import { z } from 'zod'

import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirReferenceSchema,
  fhirPeriodSchema,
  fhirBackboneElementSchema,
} from './base'

/**
 * FHIR R4 AllergyIntolerance resource schema.
 * Risk of harmful or undesirable physiological effect resulting from exposure to a substance.
 * @see http://hl7.org/fhir/R4/allergyintolerance.html
 */
export const allergyIntoleranceSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('AllergyIntolerance'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  clinicalStatus: fhirCodeableConceptSchema.optional(),
  verificationStatus: fhirCodeableConceptSchema.optional(),
  type: z.enum(['allergy', 'intolerance']).optional(),
  category: z
    .array(z.enum(['food', 'medication', 'environment', 'biologic']))
    .optional(),
  criticality: z.enum(['low', 'high', 'unable-to-assess']).optional(),
  code: fhirCodeableConceptSchema.optional(),
  patient: fhirReferenceSchema,
  encounter: fhirReferenceSchema.optional(),
  onsetDateTime: z.string().optional(),
  onsetAge: z
    .object({
      ...fhirBackboneElementSchema.shape,
      value: z.number().optional(),
      comparator: z.enum(['<', '<=', '>=', '>']).optional(),
      unit: z.string().optional(),
      system: z.string().optional(),
      code: z.string().optional(),
    })
    .optional(),
  onsetPeriod: fhirPeriodSchema.optional(),
  onsetRange: z
    .object({
      ...fhirBackboneElementSchema.shape,
      low: z
        .object({
          ...fhirBackboneElementSchema.shape,
          value: z.number().optional(),
          unit: z.string().optional(),
          system: z.string().optional(),
          code: z.string().optional(),
        })
        .optional(),
      high: z
        .object({
          ...fhirBackboneElementSchema.shape,
          value: z.number().optional(),
          unit: z.string().optional(),
          system: z.string().optional(),
          code: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  onsetString: z.string().optional(),
  recordedDate: z.string().optional(),
  recorder: fhirReferenceSchema.optional(),
  asserter: fhirReferenceSchema.optional(),
  lastOccurrence: z.string().optional(),
  note: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        authorReference: fhirReferenceSchema.optional(),
        authorString: z.string().optional(),
        time: z.string().optional(),
        text: z.string(),
      }),
    )
    .optional(),
  reaction: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        substance: fhirCodeableConceptSchema.optional(),
        manifestation: z.array(fhirCodeableConceptSchema),
        onset: z.string().optional(),
        severity: z.enum(['mild', 'moderate', 'severe']).optional(),
        exposureRoute: fhirCodeableConceptSchema.optional(),
        note: z
          .array(
            z.object({
              ...fhirBackboneElementSchema.shape,
              authorReference: fhirReferenceSchema.optional(),
              authorString: z.string().optional(),
              time: z.string().optional(),
              text: z.string(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
})

export type AllergyIntolerance = z.infer<typeof allergyIntoleranceSchema>
