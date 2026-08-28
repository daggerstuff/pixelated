import { z } from 'zod'

import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirReferenceSchema,
  fhirPeriodSchema,
  fhirQuantitySchema,
  fhirBackboneElementSchema,
} from './base'

/**
 * FHIR R4 CarePlan resource schema.
 * Describes the intention of how one or more practitioners plan to deliver care
 * for a particular patient, group, or community.
 * @see http://hl7.org/fhir/R4/careplan.html
 */
export const carePlanSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('CarePlan'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  instantiatesCanonical: z.array(z.string()).optional(),
  instantiatesUri: z.array(z.string()).optional(),
  basedOn: z.array(fhirReferenceSchema).optional(),
  replaces: z.array(fhirReferenceSchema).optional(),
  partOf: z.array(fhirReferenceSchema).optional(),
  status: z.enum([
    'draft',
    'active',
    'on-hold',
    'revoked',
    'completed',
    'entered-in-error',
    'unknown',
  ]),
  intent: z.enum(['proposal', 'plan', 'order', 'option']),
  category: z.array(fhirCodeableConceptSchema).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  subject: fhirReferenceSchema,
  encounter: fhirReferenceSchema.optional(),
  period: fhirPeriodSchema.optional(),
  created: z.string().optional(),
  author: fhirReferenceSchema.optional(),
  contributor: z.array(fhirReferenceSchema).optional(),
  careTeam: z.array(fhirReferenceSchema).optional(),
  addresses: z.array(fhirReferenceSchema).optional(),
  supportingInfo: z.array(fhirReferenceSchema).optional(),
  goal: z.array(fhirReferenceSchema).optional(),
  activity: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        outcomeCodeableConcept: z.array(fhirCodeableConceptSchema).optional(),
        outcomeReference: z.array(fhirReferenceSchema).optional(),
        progress: z
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
        reference: fhirReferenceSchema.optional(),
        detail: z
          .object({
            ...fhirBackboneElementSchema.shape,
            kind: z
              .enum([
                'Appointment',
                'Communication',
                'DeviceRequest',
                'MedicationRequest',
                'NutritionOrder',
                'Task',
                'ServiceRequest',
                'VisionPrescription',
              ])
              .optional(),
            instantiatesCanonical: z.array(z.string()).optional(),
            instantiatesUri: z.array(z.string()).optional(),
            code: fhirCodeableConceptSchema.optional(),
            reasonCode: z.array(fhirCodeableConceptSchema).optional(),
            reasonReference: z.array(fhirReferenceSchema).optional(),
            goal: z.array(fhirReferenceSchema).optional(),
            status: z.enum([
              'not-started',
              'scheduled',
              'in-progress',
              'on-hold',
              'completed',
              'cancelled',
              'stopped',
              'unknown',
              'planned',
            ]),
            statusReason: z.string().optional(),
            doNotPerform: z.boolean().optional(),
            scheduledString: z.string().optional(),
            scheduledPeriod: fhirPeriodSchema.optional(),
            location: fhirReferenceSchema.optional(),
            performer: z.array(fhirReferenceSchema).optional(),
            dailyAmount: fhirQuantitySchema.optional(),
            quantity: fhirQuantitySchema.optional(),
            description: z.string().optional(),
          })
          .optional(),
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
})

export type CarePlan = z.infer<typeof carePlanSchema>
