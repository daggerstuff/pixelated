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
 * FHIR R4 Encounter resource schema.
 * An interaction between a patient and healthcare provider(s).
 * @see http://hl7.org/fhir/R4/encounter.html
 */
export const encounterSchema = domainResourceSchema.extend({
  resourceType: z.literal('Encounter'),
  identifier: z.array(identifierSchema).optional(),
  status: z.enum([
    'planned',
    'arrived',
    'triaged',
    'in-progress',
    'onleave',
    'finished',
    'cancelled',
    'entered-in-error',
    'unknown',
  ]),
  statusHistory: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        status: z.enum([
          'planned',
          'arrived',
          'triaged',
          'in-progress',
          'onleave',
          'finished',
          'cancelled',
          'entered-in-error',
          'unknown',
        ]),
        period: periodSchema,
      }),
    )
    .optional(),
  class: z.object({
    ...backboneElementSchema.shape,
    system: z.string().optional(),
    code: z.string(),
    display: z.string().optional(),
  }),
  classHistory: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        class: z.object({
          ...backboneElementSchema.shape,
          system: z.string().optional(),
          code: z.string(),
          display: z.string().optional(),
        }),
        period: periodSchema,
      }),
    )
    .optional(),
  type: z.array(codeableConceptSchema).optional(),
  serviceType: codeableConceptSchema.optional(),
  priority: codeableConceptSchema.optional(),
  subject: referenceSchema.optional(),
  episodeOfCare: z.array(referenceSchema).optional(),
  basedOn: z.array(referenceSchema).optional(),
  participant: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        type: z.array(codeableConceptSchema).optional(),
        period: periodSchema.optional(),
        individual: referenceSchema.optional(),
      }),
    )
    .optional(),
  appointment: z.array(referenceSchema).optional(),
  period: periodSchema.optional(),
  length: z
    .object({
      ...backboneElementSchema.shape,
      value: z.number().optional(),
      comparator: z.enum(['<', '<=', '>=', '>']).optional(),
      unit: z.string().optional(),
      system: z.string().optional(),
      code: z.string().optional(),
    })
    .optional(),
  reasonCode: z.array(codeableConceptSchema).optional(),
  reasonReference: z.array(referenceSchema).optional(),
  diagnosis: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        condition: referenceSchema,
        use: codeableConceptSchema.optional(),
        rank: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  account: z.array(referenceSchema).optional(),
  hospitalization: z
    .object({
      ...backboneElementSchema.shape,
      preAdmissionIdentifier: identifierSchema.optional(),
      origin: referenceSchema.optional(),
      admitSource: codeableConceptSchema.optional(),
      reAdmission: codeableConceptSchema.optional(),
      dietPreference: z.array(codeableConceptSchema).optional(),
      specialCourtesy: z.array(codeableConceptSchema).optional(),
      specialArrangement: z.array(codeableConceptSchema).optional(),
      destination: referenceSchema.optional(),
      dischargeDisposition: codeableConceptSchema.optional(),
    })
    .optional(),
  location: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        location: referenceSchema,
        status: z.enum(['planned', 'active', 'reserved', 'completed']).optional(),
        physicalType: codeableConceptSchema.optional(),
        period: periodSchema.optional(),
      }),
    )
    .optional(),
  serviceProvider: referenceSchema.optional(),
  partOf: referenceSchema.optional(),
});

export type Encounter = z.infer<typeof encounterSchema>;
