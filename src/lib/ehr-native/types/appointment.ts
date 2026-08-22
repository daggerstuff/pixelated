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
 * FHIR R4 Appointment resource schema.
 * A booking of a healthcare event among patient(s), practitioner(s), person(s) and/or device(s).
 * @see http://hl7.org/fhir/R4/appointment.html
 */
export const appointmentSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('Appointment'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: z.enum([
    'proposed',
    'booked',
    'tentative',
    'cancelled',
    'needs-action',
    'fulfilled',
    'arrived',
    'waitlist',
    'entered-in-error',
    'checked-in',
    'no-show',
  ]),
  cancelationReason: fhirCodeableConceptSchema.optional(),
  serviceCategory: z.array(fhirCodeableConceptSchema).optional(),
  serviceType: z.array(fhirCodeableConceptSchema).optional(),
  specialty: z.array(fhirCodeableConceptSchema).optional(),
  appointmentType: fhirCodeableConceptSchema.optional(),
  reasonCode: z.array(fhirCodeableConceptSchema).optional(),
  reasonReference: z.array(fhirReferenceSchema).optional(),
  priority: z.number().int().optional(),
  description: z.string().optional(),
  supportingInformation: z.array(fhirReferenceSchema).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  minutesDuration: z.number().int().nonnegative().optional(),
  slot: z.array(fhirReferenceSchema).optional(),
  created: z.string().optional(),
  comment: z.string().optional(),
  patientInstruction: z.string().optional(),
  basedOn: z.array(fhirReferenceSchema).optional(),
  participant: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        type: z.array(fhirCodeableConceptSchema).optional(),
        actor: fhirReferenceSchema.optional(),
        required: z.enum(['required', 'optional', 'information-only']).optional(),
        status: z.enum([
          'accepted',
          'declined',
          'tentative',
          'needs-action',
        ]),
      }),
    )
    .min(1),
  requestedPeriod: z.array(fhirPeriodSchema).optional(),
});

export type Appointment = z.infer<typeof appointmentSchema>;
