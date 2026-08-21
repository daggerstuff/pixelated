import { z } from 'zod';
import {
  domainResourceSchema,
  identifierSchema,
  codeableConceptSchema,
  periodSchema,
  referenceSchema,
  contactPointSchema,
  addressSchema,
  backboneElementSchema,
} from './base';

/**
 * FHIR R4 PractitionerRole resource schema.
 * Roles/positions that a practitioner may perform at an organization.
 * @see http://hl7.org/fhir/R4/practitionerrole.html
 */
export const practitionerRoleSchema = domainResourceSchema.extend({
  resourceType: z.literal('PractitionerRole'),
  identifier: z.array(identifierSchema).optional(),
  active: z.boolean().optional(),
  period: periodSchema.optional(),
  practitioner: referenceSchema.optional(),
  organization: referenceSchema.optional(),
  code: z.array(codeableConceptSchema).optional(),
  specialty: z.array(codeableConceptSchema).optional(),
  location: z.array(referenceSchema).optional(),
  healthcareService: z.array(referenceSchema).optional(),
  telecom: z.array(contactPointSchema).optional(),
  availableTime: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        daysOfWeek: z
          .array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))
          .optional(),
        allDay: z.boolean().optional(),
        availableStartTime: z.string().optional(),
        availableEndTime: z.string().optional(),
      }),
    )
    .optional(),
  notAvailable: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        description: z.string(),
        during: periodSchema.optional(),
      }),
    )
    .optional(),
  availabilityExceptions: z.string().optional(),
  endpoint: z.array(referenceSchema).optional(),
});

export type PractitionerRole = z.infer<typeof practitionerRoleSchema>;
