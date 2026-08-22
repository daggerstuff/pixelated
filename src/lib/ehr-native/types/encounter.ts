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
 * FHIR R4 Encounter resource schema.
 * An interaction between a patient and healthcare provider(s).
 * @see http://hl7.org/fhir/R4/encounter.html
 */
export const encounterSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('Encounter'),
  identifier: z.array(fhirIdentifierSchema).optional(),
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
        ...fhirBackboneElementSchema.shape,
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
        period: fhirPeriodSchema,
      }),
    )
    .optional(),
  class: z.object({
    ...fhirBackboneElementSchema.shape,
    system: z.string().optional(),
    code: z.string(),
    display: z.string().optional(),
  }),
  classHistory: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        class: z.object({
          ...fhirBackboneElementSchema.shape,
          system: z.string().optional(),
          code: z.string(),
          display: z.string().optional(),
        }),
        period: fhirPeriodSchema,
      }),
    )
    .optional(),
  type: z.array(fhirCodeableConceptSchema).optional(),
  serviceType: fhirCodeableConceptSchema.optional(),
  priority: fhirCodeableConceptSchema.optional(),
  subject: fhirReferenceSchema.optional(),
  episodeOfCare: z.array(fhirReferenceSchema).optional(),
  basedOn: z.array(fhirReferenceSchema).optional(),
  participant: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        type: z.array(fhirCodeableConceptSchema).optional(),
        period: fhirPeriodSchema.optional(),
        individual: fhirReferenceSchema.optional(),
      }),
    )
    .optional(),
  appointment: z.array(fhirReferenceSchema).optional(),
  period: fhirPeriodSchema.optional(),
  length: z
    .object({
      ...fhirBackboneElementSchema.shape,
      value: z.number().optional(),
      comparator: z.enum(['<', '<=', '>=', '>']).optional(),
      unit: z.string().optional(),
      system: z.string().optional(),
      code: z.string().optional(),
    })
    .optional(),
  reasonCode: z.array(fhirCodeableConceptSchema).optional(),
  reasonReference: z.array(fhirReferenceSchema).optional(),
  diagnosis: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        condition: fhirReferenceSchema,
        use: fhirCodeableConceptSchema.optional(),
        rank: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  account: z.array(fhirReferenceSchema).optional(),
  hospitalization: z
    .object({
      ...fhirBackboneElementSchema.shape,
      preAdmissionIdentifier: fhirIdentifierSchema.optional(),
      origin: fhirReferenceSchema.optional(),
      admitSource: fhirCodeableConceptSchema.optional(),
      reAdmission: fhirCodeableConceptSchema.optional(),
      dietPreference: z.array(fhirCodeableConceptSchema).optional(),
      specialCourtesy: z.array(fhirCodeableConceptSchema).optional(),
      specialArrangement: z.array(fhirCodeableConceptSchema).optional(),
      destination: fhirReferenceSchema.optional(),
      dischargeDisposition: fhirCodeableConceptSchema.optional(),
    })
    .optional(),
  location: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        location: fhirReferenceSchema,
        status: z.enum(['planned', 'active', 'reserved', 'completed']).optional(),
        physicalType: fhirCodeableConceptSchema.optional(),
        period: fhirPeriodSchema.optional(),
      }),
    )
    .optional(),
  serviceProvider: fhirReferenceSchema.optional(),
  partOf: fhirReferenceSchema.optional(),
});

export type Encounter = z.infer<typeof encounterSchema>;
