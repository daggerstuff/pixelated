import { z } from 'zod'

import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirReferenceSchema,
  fhirPeriodSchema,
  fhirInstantSchema,
} from './base.js'

export * from './appointment.js'

/**
 * FHIR R4 AppointmentResponse resource schema.
 * @see http://hl7.org/fhir/R4/appointmentresponse.html
 */
export const appointmentResponseSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('AppointmentResponse'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  appointment: fhirReferenceSchema,
  start: fhirInstantSchema.optional(),
  end: fhirInstantSchema.optional(),
  participantType: z.array(fhirCodeableConceptSchema).optional(),
  actor: fhirReferenceSchema.optional(),
  participantStatus: z.enum([
    'accepted',
    'declined',
    'tentative',
    'needs-action',
  ]),
  comment: z.string().optional(),
})

export type AppointmentResponse = z.infer<typeof appointmentResponseSchema>

/**
 * FHIR R4 Schedule resource schema.
 * @see http://hl7.org/fhir/R4/schedule.html
 */
export const scheduleSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('Schedule'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  active: z.boolean().optional(),
  serviceCategory: z.array(fhirCodeableConceptSchema).optional(),
  serviceType: z.array(fhirCodeableConceptSchema).optional(),
  specialty: z.array(fhirCodeableConceptSchema).optional(),
  actor: z.array(fhirReferenceSchema).min(1),
  planningHorizon: fhirPeriodSchema.optional(),
  comment: z.string().optional(),
})

export type Schedule = z.infer<typeof scheduleSchema>

/**
 * FHIR R4 Slot resource schema.
 * @see http://hl7.org/fhir/R4/slot.html
 */
export const slotSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('Slot'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  serviceCategory: z.array(fhirCodeableConceptSchema).optional(),
  serviceType: z.array(fhirCodeableConceptSchema).optional(),
  specialty: z.array(fhirCodeableConceptSchema).optional(),
  appointmentType: fhirCodeableConceptSchema.optional(),
  schedule: fhirReferenceSchema,
  status: z.enum([
    'busy',
    'free',
    'busy-unavailable',
    'busy-tentative',
    'entered-in-error',
  ]),
  start: fhirInstantSchema,
  end: fhirInstantSchema,
  overbooked: z.boolean().optional(),
  comment: z.string().optional(),
})

export type Slot = z.infer<typeof slotSchema>

