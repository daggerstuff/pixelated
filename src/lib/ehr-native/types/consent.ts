import { z } from 'zod'
import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirReferenceSchema,
  fhirPeriodSchema,
  fhirBackboneElementSchema,
} from './base'

/**
 * FHIR R4 Consent resource schema.
 * A healthcare consumer's choices that permit or deny recipient(s) or role(s)
 * to perform actions for purposes over the consumer's information.
 * @see http://hl7.org/fhir/R4/consent.html
 */
export const consentSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('Consent'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: z.enum([
    'draft',
    'active',
    'inactive',
    'not-done',
    'entered-in-error',
    'rejected',
  ]),
  scope: fhirCodeableConceptSchema,
  category: z.array(fhirCodeableConceptSchema),
  patient: fhirReferenceSchema.optional(),
  dateTime: z.string().optional(),
  performer: z.array(fhirReferenceSchema).optional(),
  organization: z.array(fhirReferenceSchema).optional(),
  sourceAttachment: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        contentType: z.string().optional(),
        language: z.string().optional(),
        data: z.string().optional(),
        url: z.string().optional(),
        size: z.number().int().nonnegative().optional(),
        hash: z.string().optional(),
        title: z.string().optional(),
        creation: z.string().optional(),
      }),
    )
    .optional(),
  sourceReference: z.array(fhirReferenceSchema).optional(),
  policy: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        authority: z.string().optional(),
        uri: z.string().optional(),
      }),
    )
    .optional(),
  policyRule: fhirCodeableConceptSchema.optional(),
  verification: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        verified: z.boolean(),
        verifiedWith: fhirReferenceSchema.optional(),
        verificationDate: z.string().optional(),
      }),
    )
    .optional(),
  provision: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        type: z.enum(['permit', 'deny']).optional(),
        period: fhirPeriodSchema.optional(),
        actor: z
          .array(
            z.object({
              ...fhirBackboneElementSchema.shape,
              reference: fhirReferenceSchema.optional(),
              role: fhirCodeableConceptSchema,
            }),
          )
          .optional(),
        action: z.array(fhirCodeableConceptSchema).optional(),
        securityLabel: z.array(fhirCodeableConceptSchema).optional(),
        purpose: z.array(fhirCodeableConceptSchema).optional(),
        class: z.array(fhirCodeableConceptSchema).optional(),
        code: z.array(fhirCodeableConceptSchema).optional(),
        dataPeriod: fhirPeriodSchema.optional(),
        data: z
          .array(
            z.object({
              ...fhirBackboneElementSchema.shape,
              meaning: z.enum([
                'instance',
                'related',
                'dependents',
                'authoredby',
              ]),
              reference: fhirReferenceSchema,
            }),
          )
          .optional(),
        provision: z.lazy(() => z.array(consentProvisionSchema)).optional(),
      }),
    )
    .optional(),
})

const consentProvisionSchema = z.object({
  ...fhirBackboneElementSchema.shape,
  type: z.enum(['permit', 'deny']).optional(),
  period: fhirPeriodSchema.optional(),
  actor: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        reference: fhirReferenceSchema.optional(),
        role: fhirCodeableConceptSchema,
      }),
    )
    .optional(),
  action: z.array(fhirCodeableConceptSchema).optional(),
  securityLabel: z.array(fhirCodeableConceptSchema).optional(),
  purpose: z.array(fhirCodeableConceptSchema).optional(),
  class: z.array(fhirCodeableConceptSchema).optional(),
  code: z.array(fhirCodeableConceptSchema).optional(),
  dataPeriod: fhirPeriodSchema.optional(),
  data: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        meaning: z.enum(['instance', 'related', 'dependents', 'authoredby']),
        reference: fhirReferenceSchema,
      }),
    )
    .optional(),
})

export type Consent = z.infer<typeof consentSchema>
export type ConsentProvision = z.infer<typeof consentProvisionSchema>
