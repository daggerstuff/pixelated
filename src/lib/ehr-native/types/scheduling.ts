/**
 * FHIR R4 Scheduling Resource Schemas
 * @see http://hl7.org/fhir/R4/appointment.html
 * @see http://hl7.org/fhir/R4/appointmentresponse.html
 * @see http://hl7.org/fhir/R4/schedule.html
 * @see http://hl7.org/fhir/R4/slot.html
 */

import { z } from 'zod';

import {
  fhirBaseSchema,
  fhirCodeSchema,
  fhirCodeableConceptSchema,
  fhirDateTimeSchema,
  fhirIdentifierSchema,
  fhirInstantSchema,
  fhirPositiveIntSchema,
  fhirReferenceSchema,
  fhirStringSchema,
  fhirUriSchema,
  fhirUrlSchema,
  fhirBooleanSchema,
  fhirPeriodSchema,
} from './base';

// ---------------------------------------------------------------------------
// Appointment
// ---------------------------------------------------------------------------

export const appointmentStatusSchema = z.enum([
  'proposed',
  'booked',
  'arrived',
  'fulfilled',
  'cancelled',
  'noshow',
  'entered-in-error',
  'checked-in',
  'waitlist',
]);

export const appointmentParticipantStatusSchema = z.enum([
  'accepted',
  'declined',
  'tentative',
  'needs-action',
]);

export const appointmentParticipantRequiredSchema = z.enum([
  'required',
  'optional',
  'information-only',
]);

export const appointmentParticipantSchema = z.object({
  type: fhirCodeableConceptSchema.array().optional(),
  actor: fhirReferenceSchema.optional(),
  required: appointmentParticipantRequiredSchema.optional(),
  status: appointmentParticipantStatusSchema,
  period: fhirPeriodSchema.optional(),
});

export const appointmentSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Appointment'),
  identifier: fhirIdentifierSchema.array().optional(),
  status: appointmentStatusSchema,
  cancelationReason: fhirCodeableConceptSchema.optional(),
  serviceCategory: fhirCodeableConceptSchema.array().optional(),
  serviceType: fhirCodeableConceptSchema.array().optional(),
  specialty: fhirCodeableConceptSchema.array().optional(),
  appointmentType: fhirCodeableConceptSchema.optional(),
  reasonCode: fhirCodeableConceptSchema.array().optional(),
  reasonReference: fhirReferenceSchema.array().optional(),
  priority: fhirPositiveIntSchema.optional(),
  description: fhirStringSchema.optional(),
  supportingInformation: fhirReferenceSchema.array().optional(),
  start: fhirInstantSchema.optional(),
  end: fhirInstantSchema.optional(),
  minutesDuration: fhirPositiveIntSchema.optional(),
  slot: fhirReferenceSchema.array().optional(),
  created: fhirDateTimeSchema.optional(),
  comment: fhirStringSchema.optional(),
  patientInstruction: fhirStringSchema.optional(),
  basedOn: fhirReferenceSchema.array().optional(),
  participant: appointmentParticipantSchema.array().min(1),
});

export type Appointment = z.infer<typeof appointmentSchema>;
export type AppointmentParticipant = z.infer<typeof appointmentParticipantSchema>;

// ---------------------------------------------------------------------------
// AppointmentResponse
// ---------------------------------------------------------------------------

export const appointmentResponseStatusSchema = z.enum([
  'accepted',
  'declined',
  'tentative',
  'needs-action',
]);

export const appointmentResponseSchema = fhirBaseSchema.extend({
  resourceType: z.literal('AppointmentResponse'),
  identifier: fhirIdentifierSchema.array().optional(),
  appointment: fhirReferenceSchema,
  start: fhirInstantSchema.optional(),
  end: fhirInstantSchema.optional(),
  participantType: fhirCodeableConceptSchema.array().optional(),
  actor: fhirReferenceSchema.optional(),
  participantStatus: appointmentResponseStatusSchema,
  comment: fhirStringSchema.optional(),
});

export type AppointmentResponse = z.infer<typeof appointmentResponseSchema>;

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export const scheduleSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Schedule'),
  identifier: fhirIdentifierSchema.array().optional(),
  active: fhirBooleanSchema.optional(),
  serviceCategory: fhirCodeableConceptSchema.array().optional(),
  serviceType: fhirCodeableConceptSchema.array().optional(),
  specialty: fhirCodeableConceptSchema.array().optional(),
  actor: fhirReferenceSchema.array().min(1),
  planningHorizon: fhirPeriodSchema.optional(),
  comment: fhirStringSchema.optional(),
});

export type Schedule = z.infer<typeof scheduleSchema>;

// ---------------------------------------------------------------------------
// Slot
// ---------------------------------------------------------------------------

export const slotStatusSchema = z.enum([
  'busy',
  'free',
  'busy-unavailable',
  'busy-tentative',
  'entered-in-error',
]);

export const slotSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Slot'),
  identifier: fhirIdentifierSchema.array().optional(),
  schedule: fhirReferenceSchema,
  status: slotStatusSchema,
  start: fhirInstantSchema,
  end: fhirInstantSchema,
  overloaded: fhirBooleanSchema.optional(),
  comment: fhirStringSchema.optional(),
  appointmentType: fhirCodeableConceptSchema.optional(),
  serviceCategory: fhirCodeableConceptSchema.array().optional(),
  serviceType: fhirCodeableConceptSchema.array().optional(),
  specialty: fhirCodeableConceptSchema.array().optional(),
  appointmentTypeCode: fhirCodeSchema.optional(),
});

export type Slot = z.infer<typeof slotSchema>;
