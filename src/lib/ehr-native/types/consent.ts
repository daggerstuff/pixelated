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
 * FHIR R4 Consent resource schema.
 * A healthcare consumer's choices that permit or deny recipient(s) or role(s)
 * to perform actions for purposes over the consumer's information.
 * @see http://hl7.org/fhir/R4/consent.html
 */
export const consentSchema = domainResourceSchema.extend({
  resourceType: z.literal('Consent'),
  identifier: z.array(identifierSchema).optional(),
  status: z.enum(['draft', 'active', 'inactive', 'not-done', 'entered-in-error', 'rejected']),
  scope: codeableConceptSchema,
  category: z.array(codeableConceptSchema),
  patient: referenceSchema.optional(),
  dateTime: z.string().optional(),
  performer: z.array(referenceSchema).optional(),
  organization: z.array(referenceSchema).optional(),
  sourceAttachment: z.array(
    z.object({
      ...backboneElementSchema.shape,
      contentType: z.string().optional(),
      language: z.string().optional(),
      data: z.string().optional(),
      url: z.string().optional(),
      size: z.number().int().nonnegative().optional(),
      hash: z.string().optional(),
      title: z.string().optional(),
      creation: z.string().optional(),
    }),
  ).optional(),
  sourceReference: z.array(referenceSchema).optional(),
  policy: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        authority: z.string().optional(),
        uri: z.string().optional(),
      }),
    )
    .optional(),
  policyRule: codeableConceptSchema.optional(),
  verification: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        verified: z.boolean(),
        verifiedWith: referenceSchema.optional(),
        verificationDate: z.string().optional(),
      }),
    )
    .optional(),
  provision: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        type: z.enum(['permit', 'deny']).optional(),
        period: periodSchema.optional(),
        actor: z
          .array(
            z.object({
              ...backboneElementSchema.shape,
              reference: referenceSchema.optional(),
              role: codeableConceptSchema,
            }),
          )
          .optional(),
        action: z.array(codeableConceptSchema).optional(),
        securityLabel: z.array(codeableConceptSchema).optional(),
        purpose: z.array(codeableConceptSchema).optional(),
        class: z.array(codeableConceptSchema).optional(),
        code: z.array(codeableConceptSchema).optional(),
        dataPeriod: periodSchema.optional(),
        data: z
          .array(
            z.object({
              ...backboneElementSchema.shape,
              meaning: z.enum(['instance', 'related', 'dependents', 'authoredby']),
              reference: referenceSchema,
            }),
          )
          .optional(),
        provision: z.lazy(() => z.array(consentProvisionSchema)).optional(),
      }),
    )
    .optional(),
});

const consentProvisionSchema = z.object({
  ...backboneElementSchema.shape,
  type: z.enum(['permit', 'deny']).optional(),
  period: periodSchema.optional(),
  actor: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        reference: referenceSchema.optional(),
        role: codeableConceptSchema,
      }),
    )
    .optional(),
  action: z.array(codeableConceptSchema).optional(),
  securityLabel: z.array(codeableConceptSchema).optional(),
  purpose: z.array(codeableConceptSchema).optional(),
  class: z.array(codeableConceptSchema).optional(),
  code: z.array(codeableConceptSchema).optional(),
  dataPeriod: periodSchema.optional(),
  data: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        meaning: z.enum(['instance', 'related', 'dependents', 'authoredby']),
        reference: referenceSchema,
      }),
    )
    .optional(),
});

export type Consent = z.infer<typeof consentSchema>;
export type ConsentProvision = z.infer<typeof consentProvisionSchema>;
