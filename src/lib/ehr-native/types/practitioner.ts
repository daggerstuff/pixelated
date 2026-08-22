import { z } from 'zod'
import {
  fhirDomainResourceSchema,
  fhirHumanNameSchema,
  fhirContactPointSchema,
  fhirAddressSchema,
  fhirIdentifierSchema,
  fhirAttachmentSchema,
  fhirCodeableConceptSchema,
  fhirPeriodSchema,
  fhirReferenceSchema,
  fhirBackboneElementSchema,
} from './base'

/**
 * FHIR R4 Practitioner resource schema.
 * A person who is directly or indirectly involved in the provisioning of healthcare.
 * @see http://hl7.org/fhir/R4/practitioner.html
 */
export const practitionerSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('Practitioner'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  active: z.boolean().optional(),
  name: z.array(fhirHumanNameSchema).optional(),
  telecom: z.array(fhirContactPointSchema).optional(),
  address: z.array(fhirAddressSchema).optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  birthDate: z.string().optional(),
  photo: z.array(fhirAttachmentSchema).optional(),
  qualification: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        identifier: z.array(fhirIdentifierSchema).optional(),
        code: fhirCodeableConceptSchema,
        period: fhirPeriodSchema.optional(),
        issuer: fhirReferenceSchema.optional(),
      }),
    )
    .optional(),
  communication: z.array(fhirCodeableConceptSchema).optional(),
})

export type Practitioner = z.infer<typeof practitionerSchema>
