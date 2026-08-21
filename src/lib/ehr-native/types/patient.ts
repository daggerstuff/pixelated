import { z } from 'zod';
import {
  domainResourceSchema,
  humanNameSchema,
  contactPointSchema,
  addressSchema,
  identifierSchema,
  attachmentSchema,
  codeableConceptSchema,
  periodSchema,
  referenceSchema,
  extensionSchema,
  backboneElementSchema,
} from './base';

/**
 * FHIR R4 Patient resource schema.
 * Demographics and administrative information about a person receiving care.
 * @see http://hl7.org/fhir/R4/patient.html
 */
export const patientSchema = domainResourceSchema.extend({
  resourceType: z.literal('Patient'),
  identifier: z.array(identifierSchema).optional(),
  active: z.boolean().optional(),
  name: z.array(humanNameSchema).optional(),
  telecom: z.array(contactPointSchema).optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  birthDate: z.string().optional(),
  deceasedBoolean: z.boolean().optional(),
  deceasedDateTime: z.string().optional(),
  address: z.array(addressSchema).optional(),
  maritalStatus: codeableConceptSchema.optional(),
  multipleBirthBoolean: z.boolean().optional(),
  multipleBirthInteger: z.number().int().nonnegative().optional(),
  photo: z.array(attachmentSchema).optional(),
  contact: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        relationship: z.array(codeableConceptSchema).optional(),
        name: humanNameSchema.optional(),
        telecom: z.array(contactPointSchema).optional(),
        address: addressSchema.optional(),
        gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
        organization: referenceSchema.optional(),
        period: periodSchema.optional(),
      }),
    )
    .optional(),
  communication: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        language: codeableConceptSchema,
        preferred: z.boolean().optional(),
      }),
    )
    .optional(),
  generalPractitioner: z.array(referenceSchema).optional(),
  managingOrganization: referenceSchema.optional(),
  link: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        other: referenceSchema,
        type: z.enum(['replaced-by', 'replaces', 'refer', 'seealso']),
      }),
    )
    .optional(),
});

export type Patient = z.infer<typeof patientSchema>;
