import { z } from 'zod';
import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirPeriodSchema,
  fhirReferenceSchema,
  fhirContactPointSchema,
  fhirAddressSchema,
  fhirBackboneElementSchema,
} from './base';

/**
 * FHIR R4 PractitionerRole resource schema.
 * Roles/positions that a practitioner may perform at an organization.
 * @see http://hl7.org/fhir/R4/practitionerrole.html
 */
export const practitionerRoleSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('PractitionerRole'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  active: z.boolean().optional(),
  period: fhirPeriodSchema.optional(),
  practitioner: fhirReferenceSchema.optional(),
  organization: fhirReferenceSchema.optional(),
  code: z.array(fhirCodeableConceptSchema).optional(),
  specialty: z.array(fhirCodeableConceptSchema).optional(),
  location: z.array(fhirReferenceSchema).optional(),
  healthcareService: z.array(fhirReferenceSchema).optional(),
  telecom: z.array(fhirContactPointSchema).optional(),
  availableTime: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
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
        ...fhirBackboneElementSchema.shape,
        description: z.string(),
        during: fhirPeriodSchema.optional(),
      }),
    )
    .optional(),
  availabilityExceptions: z.string().optional(),
  endpoint: z.array(fhirReferenceSchema).optional(),
});

export type PractitionerRole = z.infer<typeof practitionerRoleSchema>;
