import { z } from 'zod';
import {
  domainResourceSchema,
  identifierSchema,
  codeableConceptSchema,
  referenceSchema,
  periodSchema,
  backboneElementSchema,
} from './base';

/**
 * FHIR R4 AllergyIntolerance resource schema.
 * Risk of harmful or undesirable physiological effect resulting from exposure to a substance.
 * @see http://hl7.org/fhir/R4/allergyintolerance.html
 */
export const allergyIntoleranceSchema = domainResourceSchema.extend({
  resourceType: z.literal('AllergyIntolerance'),
  identifier: z.array(identifierSchema).optional(),
  clinicalStatus: codeableConceptSchema.optional(),
  verificationStatus: codeableConceptSchema.optional(),
  type: z.enum(['allergy', 'intolerance']).optional(),
  category: z.array(z.enum(['food', 'medication', 'environment', 'biologic'])).optional(),
  criticality: z.enum(['low', 'high', 'unable-to-assess']).optional(),
  code: codeableConceptSchema.optional(),
  patient: referenceSchema,
  encounter: referenceSchema.optional(),
  onsetDateTime: z.string().optional(),
  onsetAge: z
    .object({
      ...backboneElementSchema.shape,
      value: z.number().optional(),
      comparator: z.enum(['<', '<=', '>=', '>']).optional(),
      unit: z.string().optional(),
      system: z.string().optional(),
      code: z.string().optional(),
    })
    .optional(),
  onsetPeriod: periodSchema.optional(),
  onsetRange: z
    .object({
      ...backboneElementSchema.shape,
      low: z
        .object({
          ...backboneElementSchema.shape,
          value: z.number().optional(),
          unit: z.string().optional(),
          system: z.string().optional(),
          code: z.string().optional(),
        })
        .optional(),
      high: z
        .object({
          ...backboneElementSchema.shape,
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
  recorder: referenceSchema.optional(),
  asserter: referenceSchema.optional(),
  lastOccurrence: z.string().optional(),
  note: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        authorReference: referenceSchema.optional(),
        authorString: z.string().optional(),
        time: z.string().optional(),
        text: z.string(),
      }),
    )
    .optional(),
  reaction: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        substance: codeableConceptSchema.optional(),
        manifestation: z.array(codeableConceptSchema),
        onset: z.string().optional(),
        severity: z.enum(['mild', 'moderate', 'severe']).optional(),
        exposureRoute: codeableConceptSchema.optional(),
        note: z
          .array(
            z.object({
              ...backboneElementSchema.shape,
              authorReference: referenceSchema.optional(),
              authorString: z.string().optional(),
              time: z.string().optional(),
              text: z.string(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

export type AllergyIntolerance = z.infer<typeof allergyIntoleranceSchema>;
