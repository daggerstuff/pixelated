import { z } from 'zod';
import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirReferenceSchema,
  fhirPeriodSchema,
  fhirBackboneElementSchema,
} from './base';

/**
 * FHIR R4 Condition resource schema.
 * A clinical condition, problem, diagnosis, or other event, situation, or clinical concept
 * that has risen to a level of concern.
 * @see http://hl7.org/fhir/R4/condition.html
 */
export const conditionSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('Condition'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  clinicalStatus: fhirCodeableConceptSchema.optional(),
  verificationStatus: fhirCodeableConceptSchema.optional(),
  category: z.array(fhirCodeableConceptSchema).optional(),
  severity: fhirCodeableConceptSchema.optional(),
  code: fhirCodeableConceptSchema.optional(),
  bodySite: z.array(fhirCodeableConceptSchema).optional(),
  subject: fhirReferenceSchema,
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
  abatementDateTime: z.string().optional(),
  abatementAge: z
    .object({
      ...fhirBackboneElementSchema.shape,
      value: z.number().optional(),
      comparator: z.enum(['<', '<=', '>=', '>']).optional(),
      unit: z.string().optional(),
      system: z.string().optional(),
      code: z.string().optional(),
    })
    .optional(),
  abatementPeriod: fhirPeriodSchema.optional(),
  abatementRange: z
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
  abatementString: z.string().optional(),
  recordedDate: z.string().optional(),
  recorder: fhirReferenceSchema.optional(),
  asserter: fhirReferenceSchema.optional(),
  stage: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        summary: fhirCodeableConceptSchema.optional(),
        assessment: z.array(fhirReferenceSchema).optional(),
        type: fhirCodeableConceptSchema.optional(),
      }),
    )
    .optional(),
  evidence: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        code: z.array(fhirCodeableConceptSchema).optional(),
        detail: z.array(fhirReferenceSchema).optional(),
      }),
    )
    .optional(),
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
});

export type Condition = z.infer<typeof conditionSchema>;
