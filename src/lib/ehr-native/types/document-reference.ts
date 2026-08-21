import { z } from 'zod';
import {
  domainResourceSchema,
  identifierSchema,
  codeableConceptSchema,
  referenceSchema,
  periodSchema,
  attachmentSchema,
  backboneElementSchema,
} from './base';

/**
 * FHIR R4 DocumentReference resource schema.
 * A reference to a document of any kind for regulatory or clinical purposes.
 * @see http://hl7.org/fhir/R4/documentreference.html
 */
export const documentReferenceSchema = domainResourceSchema.extend({
  resourceType: z.literal('DocumentReference'),
  masterIdentifier: identifierSchema.optional(),
  identifier: z.array(identifierSchema).optional(),
  status: z.enum([
    'current',
    'superseded',
    'entered-in-error',
  ]),
  docStatus: z.enum([
    'preliminary',
    'final',
    'amended',
    'entered-in-error',
  ]).optional(),
  type: codeableConceptSchema.optional(),
  category: z.array(codeableConceptSchema).optional(),
  subject: referenceSchema.optional(),
  date: z.string().optional(),
  author: z.array(referenceSchema).optional(),
  authenticator: referenceSchema.optional(),
  custodian: referenceSchema.optional(),
  relatesTo: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        code: z.enum(['replaces', 'transforms', 'signs', 'appends']),
        target: referenceSchema,
      }),
    )
    .optional(),
  description: z.string().optional(),
  securityLabel: z.array(codeableConceptSchema).optional(),
  content: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        attachment: attachmentSchema,
        format: z
          .object({
            ...backboneElementSchema.shape,
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
      ...backboneElementSchema.shape,
      encounter: z.array(referenceSchema).optional(),
      event: z.array(codeableConceptSchema).optional(),
      period: periodSchema.optional(),
      facilityType: codeableConceptSchema.optional(),
      practiceSetting: codeableConceptSchema.optional(),
      sourcePatientInfo: referenceSchema.optional(),
      related: z
        .array(
          z.object({
            ...backboneElementSchema.shape,
            identifier: identifierSchema.optional(),
            ref: referenceSchema.optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export type DocumentReference = z.infer<typeof documentReferenceSchema>;
