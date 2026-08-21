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
 * FHIR R4 Condition resource schema.
 * A clinical condition, problem, diagnosis, or other event, situation, or clinical concept
 * that has risen to a level of concern.
 * @see http://hl7.org/fhir/R4/condition.html
 */
export const conditionSchema = domainResourceSchema.extend({
  resourceType: z.literal('Condition'),
  identifier: z.array(identifierSchema).optional(),
  clinicalStatus: codeableConceptSchema.optional(),
  verificationStatus: codeableConceptSchema.optional(),
  category: z.array(codeableConceptSchema).optional(),
  severity: codeableConceptSchema.optional(),
  code: codeableConceptSchema.optional(),
  bodySite: z.array(codeableConceptSchema).optional(),
  subject: referenceSchema,
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
  abatementDateTime: z.string().optional(),
  abatementAge: z
    .object({
      ...backboneElementSchema.shape,
      value: z.number().optional(),
      comparator: z.enum(['<', '<=', '>=', '>']).optional(),
      unit: z.string().optional(),
      system: z.string().optional(),
      code: z.string().optional(),
    })
    .optional(),
  abatementPeriod: periodSchema.optional(),
  abatementRange: z
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
  abatementString: z.string().optional(),
  recordedDate: z.string().optional(),
  recorder: referenceSchema.optional(),
  asserter: referenceSchema.optional(),
  stage: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        summary: codeableConceptSchema.optional(),
        assessment: z.array(referenceSchema).optional(),
        type: codeableConceptSchema.optional(),
      }),
    )
    .optional(),
  evidence: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        code: z.array(codeableConceptSchema).optional(),
        detail: z.array(referenceSchema).optional(),
      }),
    )
    .optional(),
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
});

export type Condition = z.infer<typeof conditionSchema>;
