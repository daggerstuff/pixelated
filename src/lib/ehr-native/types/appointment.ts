import { z } from 'zod';
import {
  domainResourceSchema,
  identifierSchema,
  codeableConceptSchema,
  referenceSchema,
  periodSchema,
  backboneElementSchema,
} from './base';

/**
 * FHIR R4 Appointment resource schema.
 * A booking of a healthcare event among patient(s), practitioner(s), person(s) and/or device(s).
 * @see http://hl7.org/fhir/R4/appointment.html
 */
export const appointmentSchema = domainResourceSchema.extend({
  resourceType: z.literal('Appointment'),
  identifier: z.array(identifierSchema).optional(),
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
  cancelationReason: codeableConceptSchema.optional(),
  serviceCategory: z.array(codeableConceptSchema).optional(),
  serviceType: z.array(codeableConceptSchema).optional(),
  specialty: z.array(codeableConceptSchema).optional(),
  appointmentType: codeableConceptSchema.optional(),
  reasonCode: z.array(codeableConceptSchema).optional(),
  reasonReference: z.array(referenceSchema).optional(),
  priority: z.number().int().optional(),
  description: z.string().optional(),
  supportingInformation: z.array(referenceSchema).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  minutesDuration: z.number().int().nonnegative().optional(),
  slot: z.array(referenceSchema).optional(),
  created: z.string().optional(),
  comment: z.string().optional(),
  patientInstruction: z.string().optional(),
  basedOn: z.array(referenceSchema).optional(),
  participant: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        type: z.array(codeableConceptSchema).optional(),
        actor: referenceSchema.optional(),
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
  requestedPeriod: z.array(periodSchema).optional(),
});

export type Appointment = z.infer<typeof appointmentSchema>;
