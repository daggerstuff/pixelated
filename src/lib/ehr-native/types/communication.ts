/**
 * FHIR R4 Communication & Document Reference Schemas
 *
 * Implements Zod schemas for:
 * - DocumentReference
 * - Communication
 * - CommunicationRequest
 *
 * @see http://hl7.org/fhir/R4/
 */

import { z } from 'zod'

import {
  fhirBaseSchema,
  fhirCodeSchema,
  fhirCodeableConceptSchema,
  fhirDateTimeSchema,
  fhirIdentifierSchema,
  fhirPeriodSchema,
  fhirReferenceSchema,
  fhirStringSchema,
  fhirUriSchema,
  fhirUrlSchema,
  fhirInstantSchema,
  fhirBooleanSchema,
} from './base.js'

// ---------------------------------------------------------------------------
// DocumentReference
// ---------------------------------------------------------------------------

export const documentReferenceStatusSchema = z.enum([
  'current',
  'superseded',
  'entered-in-error',
])

export const documentReferenceDocStatusSchema = z.enum([
  'preliminary',
  'final',
  'amended',
  'entered-in-error',
])

export const documentReferenceModeSchema = z.enum(['source', 'target'])

export const documentReferenceAttesterModeSchema = z.enum([
  'personal',
  'professional',
  'legal',
  'official',
])

export const documentReferenceFormatCodesSchema = fhirCodeSchema

export const documentReferenceContentSchema = z.object({
  attachment: z.object({
    contentType: fhirCodeSchema.optional(),
    language: fhirCodeSchema.optional(),
    data: fhirStringSchema.optional(),
    url: fhirUrlSchema.optional(),
    size: fhirStringSchema.optional(),
    hash: fhirStringSchema.optional(),
    title: fhirStringSchema.optional(),
    creation: fhirDateTimeSchema.optional(),
  }),
  format: z
    .object({
      system: fhirUriSchema.optional(),
      version: fhirStringSchema.optional(),
      code: fhirCodeSchema.optional(),
      display: fhirStringSchema.optional(),
    })
    .optional(),
})

export const documentReferenceAttesterSchema = z.object({
  mode: documentReferenceAttesterModeSchema,
  time: fhirDateTimeSchema.optional(),
  party: fhirReferenceSchema.optional(),
})

export const documentReferenceRelatesToSchema = z.object({
  code: z.enum(['replaces', 'transforms', 'signs', 'appends']),
  target: fhirReferenceSchema,
})

export const documentReferenceContextSchema = z.object({
  encounter: fhirReferenceSchema.optional(),
  event: fhirCodeableConceptSchema.array().optional(),
  period: fhirPeriodSchema.optional(),
  facilityType: fhirCodeableConceptSchema.optional(),
  practiceSetting: fhirCodeableConceptSchema.optional(),
  sourcePatientInfo: fhirReferenceSchema.optional(),
  related: z
    .object({
      identifier: fhirIdentifierSchema.optional(),
      ref: fhirReferenceSchema.optional(),
    })
    .array()
    .optional(),
})

export const documentReferenceSchema = fhirBaseSchema.extend({
  resourceType: z.literal('DocumentReference'),
  masterIdentifier: fhirIdentifierSchema.optional(),
  identifier: fhirIdentifierSchema.array().optional(),
  status: documentReferenceStatusSchema,
  docStatus: documentReferenceDocStatusSchema.optional(),
  type: fhirCodeableConceptSchema.optional(),
  category: fhirCodeableConceptSchema.array().optional(),
  subject: fhirReferenceSchema.optional(),
  date: fhirInstantSchema.optional(),
  author: fhirReferenceSchema.array().optional(),
  authenticator: fhirReferenceSchema.optional(),
  custodian: fhirReferenceSchema.optional(),
  relatesTo: documentReferenceRelatesToSchema.array().optional(),
  description: fhirStringSchema.optional(),
  securityLabel: fhirCodeableConceptSchema.array().optional(),
  content: documentReferenceContentSchema.array(),
  context: documentReferenceContextSchema.optional(),
})

export type DocumentReference = z.infer<typeof documentReferenceSchema>

// ---------------------------------------------------------------------------
// Communication
// ---------------------------------------------------------------------------

export const communicationStatusSchema = z.enum([
  'preparation',
  'in-progress',
  'not-done',
  'on-hold',
  'stopped',
  'completed',
  'entered-in-error',
  'unknown',
])

export const communicationStatusReasonSchema = z.enum([
  'on-hold',
  'stopped',
  'not-done',
])

export const communicationPrioritySchema = z.enum([
  'routine',
  'urgent',
  'asap',
  'stat',
])

export const communicationPayloadSchema = z
  .object({
    contentString: fhirStringSchema.optional(),
    contentAttachment: z
      .object({
        contentType: fhirCodeSchema.optional(),
        language: fhirCodeSchema.optional(),
        data: fhirStringSchema.optional(),
        url: fhirUrlSchema.optional(),
        size: fhirStringSchema.optional(),
        hash: fhirStringSchema.optional(),
        title: fhirStringSchema.optional(),
        creation: fhirDateTimeSchema.optional(),
      })
      .optional(),
    contentReference: fhirReferenceSchema.optional(),
  })
  .refine(
    (payload) =>
      payload.contentString !== undefined ||
      payload.contentAttachment !== undefined ||
      payload.contentReference !== undefined,
    {
      message:
        'At least one content field must be present in Communication.payload',
    },
  )

export const communicationSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Communication'),
  identifier: fhirIdentifierSchema.array().optional(),
  instantiatesCanonical: fhirUrlSchema.array().optional(),
  instantiatesUri: fhirUriSchema.array().optional(),
  basedOn: fhirReferenceSchema.array().optional(),
  partOf: fhirReferenceSchema.array().optional(),
  inResponseTo: fhirReferenceSchema.array().optional(),
  status: communicationStatusSchema,
  statusReason: fhirCodeableConceptSchema.optional(),
  category: fhirCodeableConceptSchema.array().optional(),
  priority: communicationPrioritySchema.optional(),
  medium: fhirCodeableConceptSchema.array().optional(),
  subject: fhirReferenceSchema.optional(),
  topic: fhirCodeableConceptSchema.array().optional(),
  about: fhirReferenceSchema.array().optional(),
  encounter: fhirReferenceSchema.optional(),
  sent: fhirDateTimeSchema.optional(),
  received: fhirDateTimeSchema.optional(),
  recipient: fhirReferenceSchema.array().optional(),
  sender: fhirReferenceSchema.optional(),
  reasonCode: fhirCodeableConceptSchema.array().optional(),
  reasonReference: fhirReferenceSchema.array().optional(),
  payload: communicationPayloadSchema.array().optional(),
  note: z
    .object({
      authorString: fhirStringSchema.optional(),
      authorReference: fhirReferenceSchema.optional(),
      time: fhirDateTimeSchema.optional(),
      text: fhirStringSchema,
    })
    .array()
    .optional(),
})

export type Communication = z.infer<typeof communicationSchema>

// ---------------------------------------------------------------------------
// CommunicationRequest
// ---------------------------------------------------------------------------

export const communicationRequestStatusSchema = z.enum([
  'draft',
  'active',
  'on-hold',
  'cancelled',
  'completed',
  'entered-in-error',
  'unknown',
])

export const communicationRequestPayloadSchema = z
  .object({
    contentString: fhirStringSchema.optional(),
    contentAttachment: z
      .object({
        contentType: fhirCodeSchema.optional(),
        language: fhirCodeSchema.optional(),
        data: fhirStringSchema.optional(),
        url: fhirUrlSchema.optional(),
        size: fhirStringSchema.optional(),
        hash: fhirStringSchema.optional(),
        title: fhirStringSchema.optional(),
        creation: fhirDateTimeSchema.optional(),
      })
      .optional(),
    contentReference: fhirReferenceSchema.optional(),
  })
  .refine(
    (payload) =>
      payload.contentString !== undefined ||
      payload.contentAttachment !== undefined ||
      payload.contentReference !== undefined,
    {
      message:
        'At least one content field must be present in CommunicationRequest.payload',
    },
  )

export const communicationRequestSchema = fhirBaseSchema.extend({
  resourceType: z.literal('CommunicationRequest'),
  identifier: fhirIdentifierSchema.array().optional(),
  basedOn: fhirReferenceSchema.array().optional(),
  replaces: fhirReferenceSchema.array().optional(),
  groupIdentifier: fhirIdentifierSchema.optional(),
  status: communicationRequestStatusSchema,
  statusReason: fhirCodeableConceptSchema.optional(),
  category: fhirCodeableConceptSchema.array().optional(),
  priority: communicationPrioritySchema.optional(),
  doNotPerform: fhirBooleanSchema.optional(),
  medium: fhirCodeableConceptSchema.array().optional(),
  subject: fhirReferenceSchema.optional(),
  about: fhirReferenceSchema.array().optional(),
  encounter: fhirReferenceSchema.optional(),
  payload: communicationRequestPayloadSchema.array().optional(),
  occurrenceDateTime: fhirDateTimeSchema.optional(),
  occurrencePeriod: fhirPeriodSchema.optional(),
  authoredOn: fhirDateTimeSchema.optional(),
  requester: fhirReferenceSchema.optional(),
  recipient: fhirReferenceSchema.array().optional(),
  sender: fhirReferenceSchema.optional(),
  reasonCode: fhirCodeableConceptSchema.array().optional(),
  reasonReference: fhirReferenceSchema.array().optional(),
  note: z
    .object({
      authorString: fhirStringSchema.optional(),
      authorReference: fhirReferenceSchema.optional(),
      time: fhirDateTimeSchema.optional(),
      text: fhirStringSchema,
    })
    .array()
    .optional(),
})

export type CommunicationRequest = z.infer<typeof communicationRequestSchema>
