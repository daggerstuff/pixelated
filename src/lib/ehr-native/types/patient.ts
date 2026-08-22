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
  fhirExtensionSchema,
  fhirBackboneElementSchema,
} from './base'

/**
 * FHIR R4 Patient resource schema.
 * Demographics and administrative information about a person receiving care.
 * @see http://hl7.org/fhir/R4/patient.html
 */
export const patientSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('Patient'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  active: z.boolean().optional(),
  name: z.array(fhirHumanNameSchema).optional(),
  telecom: z.array(fhirContactPointSchema).optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  birthDate: z.string().optional(),
  deceasedBoolean: z.boolean().optional(),
  deceasedDateTime: z.string().optional(),
  address: z.array(fhirAddressSchema).optional(),
  maritalStatus: fhirCodeableConceptSchema.optional(),
  multipleBirthBoolean: z.boolean().optional(),
  multipleBirthInteger: z.number().int().nonnegative().optional(),
  photo: z.array(fhirAttachmentSchema).optional(),
  contact: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        relationship: z.array(fhirCodeableConceptSchema).optional(),
        name: fhirHumanNameSchema.optional(),
        telecom: z.array(fhirContactPointSchema).optional(),
        address: fhirAddressSchema.optional(),
        gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
        organization: fhirReferenceSchema.optional(),
        period: fhirPeriodSchema.optional(),
      }),
    )
    .optional(),
  communication: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        language: fhirCodeableConceptSchema,
        preferred: z.boolean().optional(),
      }),
    )
    .optional(),
  generalPractitioner: z.array(fhirReferenceSchema).optional(),
  managingOrganization: fhirReferenceSchema.optional(),
  link: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        other: fhirReferenceSchema,
        type: z.enum(['replaced-by', 'replaces', 'refer', 'seealso']),
      }),
    )
    .optional(),
})

export type Patient = z.infer<typeof patientSchema>
