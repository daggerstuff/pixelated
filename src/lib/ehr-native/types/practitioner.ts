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
  backboneElementSchema,
} from './base';

/**
 * FHIR R4 Practitioner resource schema.
 * A person who is directly or indirectly involved in the provisioning of healthcare.
 * @see http://hl7.org/fhir/R4/practitioner.html
 */
export const practitionerSchema = domainResourceSchema.extend({
  resourceType: z.literal('Practitioner'),
  identifier: z.array(identifierSchema).optional(),
  active: z.boolean().optional(),
  name: z.array(humanNameSchema).optional(),
  telecom: z.array(contactPointSchema).optional(),
  address: z.array(addressSchema).optional(),
  gender: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  birthDate: z.string().optional(),
  photo: z.array(attachmentSchema).optional(),
  qualification: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        identifier: z.array(identifierSchema).optional(),
        code: codeableConceptSchema,
        period: periodSchema.optional(),
        issuer: referenceSchema.optional(),
      }),
    )
    .optional(),
  communication: z.array(codeableConceptSchema).optional(),
});

export type Practitioner = z.infer<typeof practitionerSchema>;
