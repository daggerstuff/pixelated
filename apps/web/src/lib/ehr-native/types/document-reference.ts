import { z } from 'zod'

import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirReferenceSchema,
  fhirPeriodSchema,
  fhirAttachmentSchema,
  fhirBackboneElementSchema,
} from './base'

/**
 * FHIR R4 DocumentReference resource schema.
 * A reference to a document of any kind for regulatory or clinical purposes.
 * @see http://hl7.org/fhir/R4/documentreference.html
 */
export const documentReferenceSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('DocumentReference'),
  masterIdentifier: fhirIdentifierSchema.optional(),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: z.enum(['current', 'superseded', 'entered-in-error']),
  docStatus: z
    .enum(['preliminary', 'final', 'amended', 'entered-in-error'])
    .optional(),
  type: fhirCodeableConceptSchema.optional(),
  category: z.array(fhirCodeableConceptSchema).optional(),
  subject: fhirReferenceSchema.optional(),
  date: z.string().optional(),
  author: z.array(fhirReferenceSchema).optional(),
  authenticator: fhirReferenceSchema.optional(),
  custodian: fhirReferenceSchema.optional(),
  relatesTo: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        code: z.enum(['replaces', 'transforms', 'signs', 'appends']),
        target: fhirReferenceSchema,
      }),
    )
    .optional(),
  description: z.string().optional(),
  securityLabel: z.array(fhirCodeableConceptSchema).optional(),
  content: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        attachment: fhirAttachmentSchema,
        format: z
          .object({
            ...fhirBackboneElementSchema.shape,
            system: z.string().optional(),
            code: z.string().optional(),
            display: z.string().optional(),
          })
          .optional(),
      }),
    )
    .min(1),
  context: z
    .object({
      ...fhirBackboneElementSchema.shape,
      encounter: z.array(fhirReferenceSchema).optional(),
      event: z.array(fhirCodeableConceptSchema).optional(),
      period: fhirPeriodSchema.optional(),
      facilityType: fhirCodeableConceptSchema.optional(),
      practiceSetting: fhirCodeableConceptSchema.optional(),
      sourcePatientInfo: fhirReferenceSchema.optional(),
      related: z
        .array(
          z.object({
            ...fhirBackboneElementSchema.shape,
            identifier: fhirIdentifierSchema.optional(),
            ref: fhirReferenceSchema.optional(),
          }),
        )
        .optional(),
    })
    .optional(),
})

export type DocumentReference = z.infer<typeof documentReferenceSchema>

/**
 * FHIR R4 Communication payload schema.
 * @see http://hl7.org/fhir/R4/communication.html
 */
export const communicationPayloadSchema = z
  .object({
    contentString: z.string().optional(),
    contentAttachment: fhirAttachmentSchema.optional(),
    contentReference: fhirReferenceSchema.optional(),
  })
  .refine(
    (data) => {
      const present = [
        data.contentString,
        data.contentAttachment,
        data.contentReference,
      ].filter((v) => v !== undefined).length
      return present === 1
    },
    {
      message: 'Communication payload must have exactly one content[x] field',
    },
  )

/**
 * FHIR R4 Communication resource schema.
 * @see http://hl7.org/fhir/R4/communication.html
 */
export const communicationSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('Communication'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: z.enum([
    'preparation',
    'in-progress',
    'not-done',
    'on-hold',
    'stopped',
    'completed',
    'entered-in-error',
    'unknown',
  ]),
  category: z.array(fhirCodeableConceptSchema).optional(),
  priority: z.enum(['routine', 'urgent', 'asap', 'stat']).optional(),
  medium: z.array(fhirCodeableConceptSchema).optional(),
  subject: fhirReferenceSchema.optional(),
  topic: z.array(fhirCodeableConceptSchema).optional(),
  sent: z.string().optional(),
  received: z.string().optional(),
  sender: fhirReferenceSchema.optional(),
  recipient: z.array(fhirReferenceSchema).optional(),
  payload: z.array(communicationPayloadSchema).optional(),
  note: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        authorReference: fhirReferenceSchema.optional(),
        authorString: z.string().optional(),
        time: z.string().optional(),
        text: z.string(),
      }),
    )
    .optional(),
})

export type Communication = z.infer<typeof communicationSchema>

/**
 * FHIR R4 CommunicationRequest payload schema.
 * Identical structure to Communication payload — aliased to avoid duplication.
 * @see http://hl7.org/fhir/R4/communicationrequest.html
 */
export const communicationRequestPayloadSchema = communicationPayloadSchema

/**
 * FHIR R4 CommunicationRequest resource schema.
 * @see http://hl7.org/fhir/R4/communicationrequest.html
 */
export const communicationRequestSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('CommunicationRequest'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: z.enum([
    'draft',
    'active',
    'on-hold',
    'cancelled',
    'completed',
    'entered-in-error',
    'unknown',
  ]),
  category: z.array(fhirCodeableConceptSchema).optional(),
  priority: z.enum(['routine', 'urgent', 'asap', 'stat']).optional(),
  subject: fhirReferenceSchema.optional(),
  about: z.array(fhirReferenceSchema).optional(),
  authoredOn: z.string().optional(),
  requester: fhirReferenceSchema.optional(),
  recipient: z.array(fhirReferenceSchema).optional(),
  sender: fhirReferenceSchema.optional(),
  payload: z.array(communicationRequestPayloadSchema).optional(),
  occurrenceDateTime: z.string().optional(),
  occurrencePeriod: fhirPeriodSchema.optional(),
})

export type CommunicationRequest = z.infer<typeof communicationRequestSchema>
