import { z } from 'zod'

import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirReferenceSchema,
  fhirQuantitySchema,
  fhirDateTimeSchema,
  fhirDateSchema,
  fhirBackboneElementSchema,
} from './base.js'

/** FHIR R4 Immunization resource schema. @see http://hl7.org/fhir/R4/immunization.html */
export const immunizationSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('Immunization'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: z.enum(['completed', 'entered-in-error', 'not-done', 'unknown']),
  statusReason: fhirCodeableConceptSchema.optional(),
  vaccineCode: fhirCodeableConceptSchema,
  patient: fhirReferenceSchema,
  encounter: fhirReferenceSchema.optional(),
  occurrenceDateTime: fhirDateTimeSchema.optional(),
  occurrenceString: z.string().optional(),
  recorded: fhirDateTimeSchema.optional(),
  primarySource: z.boolean().optional(),
  location: fhirReferenceSchema.optional(),
  manufacturer: fhirReferenceSchema.optional(),
  lotNumber: z.string().optional(),
  expirationDate: fhirDateSchema.optional(),
  site: fhirCodeableConceptSchema.optional(),
  route: fhirCodeableConceptSchema.optional(),
  doseQuantity: fhirQuantitySchema.optional(),
  performer: z
    .array(
      z.object({
        function: fhirCodeableConceptSchema.optional(),
        actor: fhirReferenceSchema.optional(),
      }),
    )
    .optional(),
  note: z.array(z.object({ text: z.string() })).optional(),
  education: z
    .array(
      z.object({
        documentType: z.string().optional(),
        reference: z.string().optional(),
        publicationDate: fhirDateTimeSchema.optional(),
        presentationDate: fhirDateTimeSchema.optional(),
      }),
    )
    .optional(),
  programEligibility: z.array(fhirCodeableConceptSchema).optional(),
  fundingSource: z.array(fhirCodeableConceptSchema).optional(),
  reaction: z
    .array(
      z.object({
        date: fhirDateTimeSchema.optional(),
        detail: fhirReferenceSchema.optional(),
        reported: z.boolean().optional(),
      }),
    )
    .optional(),
  protocolApplied: z
    .array(
      z.object({
        series: z.string().optional(),
        seriesDoses: fhirQuantitySchema.optional(),
        doseNumber: fhirQuantitySchema.optional(),
        targetDisease: z.array(fhirCodeableConceptSchema).optional(),
        authority: fhirReferenceSchema.optional(),
      }),
    )
    .optional(),
})

export type Immunization = z.infer<typeof immunizationSchema>
