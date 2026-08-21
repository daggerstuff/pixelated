/**
 * FHIR R4 Consent & Provenance Resource Types
 *
 * Zod schemas for Consent and Provenance resources per HL7 FHIR R4:
 * - Consent: http://hl7.org/fhir/R4/consent.html
 * - Provenance: http://hl7.org/fhir/R4/provenance.html
 */
import { z } from 'zod'

import {
  fhirBaseSchema,
  fhirBooleanSchema,
  fhirCodeSchema,
  fhirCodeableConceptSchema,
  fhirCodingSchema,
  fhirDateSchema,
  fhirDateTimeSchema,
  fhirIdentifierSchema,
  fhirInstantSchema,
  fhirPeriodSchema,
  fhirReferenceSchema,
  fhirStringSchema,
  fhirUriSchema,
} from './base.js'

// ===========================================================================
// Consent (http://hl7.org/fhir/R4/consent.html)
// ===========================================================================

export const consentStatusSchema = z.enum([
  'draft',
  'active',
  'inactive',
  'not-done',
  'entered-in-error',
  'unknown',
])

export const consentPolicySchema = z.object({
  authority: fhirStringSchema.optional(),
  uri: fhirUriSchema.optional(),
})

export const consentVerificationSchema = z.object({
  verified: fhirBooleanSchema,
  verifiedWith: fhirReferenceSchema.optional(),
  verificationDate: fhirDateSchema.optional(),
})

export interface ConsentProvision {
  type?: 'permit' | 'deny'
  period?: { start?: string; end?: string }
  actor?: Array<{
    role: { coding?: Array<{ system?: string; code?: string; display?: string; userSelected?: boolean }>; text?: string }
    reference: { reference?: string; type?: string; display?: string; identifier?: Record<string, unknown> }
  }>
  action?: Array<{ coding?: Array<{ system?: string; code?: string; display?: string; userSelected?: boolean }>; text?: string }>
  class?: Array<{ system?: string; version?: string; code?: string; display?: string; userSelected?: boolean }>
  code?: Array<{ coding?: Array<{ system?: string; code?: string; display?: string; userSelected?: boolean }>; text?: string }>
  dataPeriod?: { start?: string; end?: string }
  provision?: ConsentProvision[]
}

export const consentProvisionSchema: z.ZodType<ConsentProvision> = z.lazy(() =>
  z.object({
    type: z.enum(['permit', 'deny']).optional(),
    period: fhirPeriodSchema.optional(),
    actor: z
      .array(
        z.object({
          role: fhirCodeableConceptSchema,
          reference: fhirReferenceSchema,
        }),
      )
      .optional(),
    action: z.array(fhirCodeableConceptSchema).optional(),
    class: z.array(fhirCodingSchema).optional(),
    code: z.array(fhirCodeableConceptSchema).optional(),
    dataPeriod: fhirPeriodSchema.optional(),
    provision: z.array(consentProvisionSchema).optional(),
  }),
)

/** FHIR Attachment (used by Consent.sourceAttachment) */
const fhirAttachmentSchema = z.object({
  contentType: fhirCodeSchema.optional(),
  language: fhirCodeSchema.optional(),
  data: z.string().optional(),
  url: fhirUriSchema.optional(),
  size: z.number().int().nonnegative().optional(),
  hash: z.string().optional(),
  title: fhirStringSchema.optional(),
  creation: fhirDateTimeSchema.optional(),
})

export const consentSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Consent'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: consentStatusSchema,
  scope: fhirCodeableConceptSchema,
  category: z.array(fhirCodeableConceptSchema).optional(),
  patient: fhirReferenceSchema,
  dateTime: fhirDateTimeSchema.optional(),
  performer: z.array(fhirReferenceSchema).optional(),
  organization: z.array(fhirReferenceSchema).optional(),
  sourceAttachment: fhirAttachmentSchema.optional(),
  sourceReference: fhirReferenceSchema.optional(),
  policy: z.array(consentPolicySchema).optional(),
  policyRule: fhirCodeableConceptSchema.optional(),
  verification: z.array(consentVerificationSchema).optional(),
  provision: consentProvisionSchema.optional(),
})

export type ConsentResource = z.infer<typeof consentSchema>

// ===========================================================================
// Provenance (http://hl7.org/fhir/R4/provenance.html)
// ===========================================================================

export const provenanceAgentSchema = z.object({
  type: fhirCodeableConceptSchema.optional(),
  who: fhirReferenceSchema,
  onBehalfOf: fhirReferenceSchema.optional(),
  relatedAgentType: fhirCodeableConceptSchema.optional(),
})

export const provenanceSignatureSchema = z.object({
  type: z.array(fhirCodingSchema),
  when: fhirInstantSchema,
  who: fhirReferenceSchema,
  onBehalfOf: fhirReferenceSchema.optional(),
  targetFormat: fhirCodeSchema.optional(),
  sigFormat: fhirCodeSchema.optional(),
  data: z.string().optional(),
})

export const provenanceSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Provenance'),
  target: z.array(fhirReferenceSchema),
  occurredPeriod: fhirPeriodSchema.optional(),
  occurredDateTime: fhirDateTimeSchema.optional(),
  recorded: fhirInstantSchema,
  policy: z.array(fhirUriSchema).optional(),
  location: fhirReferenceSchema.optional(),
  agent: z.array(provenanceAgentSchema),
  signature: z.array(provenanceSignatureSchema).optional(),
})

export type ProvenanceResource = z.infer<typeof provenanceSchema>
