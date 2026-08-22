import { z } from 'zod'
import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirReferenceSchema,
  fhirPeriodSchema,
  fhirAttachmentSchema,
  fhirBackboneElementSchema,
} from './base'

/**
 * FHIR R4 DocumentReference resource schema.
 * A reference to a document of any kind for regulatory or clinical purposes.
 * @see http://hl7.org/fhir/R4/documentreference.html
 */
export const documentReferenceSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('DocumentReference'),
  masterIdentifier: fhirIdentifierSchema.optional(),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: z.enum(['current', 'superseded', 'entered-in-error']),
  docStatus: z
    .enum(['preliminary', 'final', 'amended', 'entered-in-error'])
    .optional(),
  type: fhirCodeableConceptSchema.optional(),
  category: z.array(fhirCodeableConceptSchema).optional(),
  subject: fhirReferenceSchema.optional(),
  date: z.string().optional(),
  author: z.array(fhirReferenceSchema).optional(),
  authenticator: fhirReferenceSchema.optional(),
  custodian: fhirReferenceSchema.optional(),
  relatesTo: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        code: z.enum(['replaces', 'transforms', 'signs', 'appends']),
        target: fhirReferenceSchema,
      }),
    )
    .optional(),
  description: z.string().optional(),
  securityLabel: z.array(fhirCodeableConceptSchema).optional(),
  content: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        attachment: fhirAttachmentSchema,
        format: z
          .object({
            ...fhirBackboneElementSchema.shape,
            system: z.string().optional(),
            code: z.string().optional(),
            display: z.string().optional(),
          })
          .optional(),
      }),
    )
    .min(1),
  context: z
    .object({
      ...fhirBackboneElementSchema.shape,
      encounter: z.array(fhirReferenceSchema).optional(),
      event: z.array(fhirCodeableConceptSchema).optional(),
      period: fhirPeriodSchema.optional(),
      facilityType: fhirCodeableConceptSchema.optional(),
      practiceSetting: fhirCodeableConceptSchema.optional(),
      sourcePatientInfo: fhirReferenceSchema.optional(),
      related: z
        .array(
          z.object({
            ...fhirBackboneElementSchema.shape,
            identifier: fhirIdentifierSchema.optional(),
            ref: fhirReferenceSchema.optional(),
          }),
        )
        .optional(),
    })
    .optional(),
})

export type DocumentReference = z.infer<typeof documentReferenceSchema>
