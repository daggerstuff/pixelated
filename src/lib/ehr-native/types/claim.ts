import { z } from 'zod';
import {
  domainResourceSchema,
  identifierSchema,
  codeableConceptSchema,
  referenceSchema,
  periodSchema,
  backboneElementSchema,
  attachmentSchema,
} from './base';

/**
 * FHIR R4 Claim resource schema.
 * A provider-issued list of professional services and products billed to a payer.
 * @see http://hl7.org/fhir/R4/claim.html
 */
export const claimSchema = domainResourceSchema.extend({
  resourceType: z.literal('Claim'),
  identifier: z.array(identifierSchema).optional(),
  status: z.enum(['active', 'cancelled', 'draft', 'entered-in-error']),
  type: codeableConceptSchema,
  subType: codeableConceptSchema.optional(),
  use: z.enum(['claim', 'preauthorization', 'predetermination']),
  patient: referenceSchema,
  billablePeriod: periodSchema.optional(),
  created: z.string().optional(),
  enterer: referenceSchema.optional(),
  insurer: referenceSchema.optional(),
  provider: referenceSchema,
  priority: codeableConceptSchema.optional(),
  fundsReserve: codeableConceptSchema.optional(),
  related: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        claim: referenceSchema.optional(),
        relationship: codeableConceptSchema.optional(),
        reference: identifierSchema.optional(),
      }),
    )
    .optional(),
  prescription: referenceSchema.optional(),
  originalPrescription: referenceSchema.optional(),
  payee: z
    .object({
      ...backboneElementSchema.shape,
      type: codeableConceptSchema,
      party: referenceSchema.optional(),
    })
    .optional(),
  referral: referenceSchema.optional(),
  facility: referenceSchema.optional(),
  careTeam: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        sequence: z.number().int().positive(),
        provider: referenceSchema,
        responsible: z.boolean().optional(),
        role: codeableConceptSchema.optional(),
        qualification: codeableConceptSchema.optional(),
      }),
    )
    .optional(),
  supportingInfo: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        sequence: z.number().int().positive(),
        information: referenceSchema.optional(),
        timingDate: z.string().optional(),
        timingPeriod: periodSchema.optional(),
        valueBoolean: z.boolean().optional(),
        valueString: z.string().optional(),
        valueQuantity: z
          .object({
            ...backboneElementSchema.shape,
            value: z.number().optional(),
            comparator: z.enum(['<', '<=', '>=', '>']).optional(),
            unit: z.string().optional(),
            system: z.string().optional(),
            code: z.string().optional(),
          })
          .optional(),
        valueAttachment: attachmentSchema.optional(),
        reason: codeableConceptSchema.optional(),
      }),
    )
    .optional(),
  diagnosis: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        sequence: z.number().int().positive(),
        diagnosisReference: referenceSchema.optional(),
        diagnosisCodeableConcept: codeableConceptSchema.optional(),
        type: z.array(codeableConceptSchema).optional(),
        onAdmission: codeableConceptSchema.optional(),
        packageCode: codeableConceptSchema.optional(),
      }),
    )
    .optional(),
  procedure: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        sequence: z.number().int().positive(),
        procedureReference: referenceSchema.optional(),
        procedureCodeableConcept: codeableConceptSchema.optional(),
      }),
    )
    .optional(),
  insurance: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        sequence: z.number().int().positive(),
        focal: z.boolean(),
        coverage: referenceSchema,
        businessArrangement: z.string().optional(),
        preAuthRef: z.array(z.string()).optional(),
        claimResponse: referenceSchema.optional(),
      }),
    )
    .optional(),
  accident: z
    .object({
      ...backboneElementSchema.shape,
      date: z.string().optional(),
      type: codeableConceptSchema.optional(),
      locationReference: referenceSchema.optional(),
      locationAddress: z
        .object({
          ...backboneElementSchema.shape,
          use: z.enum(['home', 'work', 'temp', 'old', 'billing']).optional(),
          type: z.enum(['postal', 'physical', 'both']).optional(),
          text: z.string().optional(),
          line: z.array(z.string()).optional(),
          city: z.string().optional(),
          district: z.string().optional(),
          state: z.string().optional(),
          postalCode: z.string().optional(),
          country: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  item: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        sequence: z.number().int().positive(),
        careTeamSequence: z.array(z.number().int().positive()).optional(),
        diagnosisSequence: z.array(z.number().int().positive()).optional(),
        procedureSequence: z.array(z.number().int().positive()).optional(),
        informationSequence: z.array(z.number().int().positive()).optional(),
        revenue: codeableConceptSchema.optional(),
        category: codeableConceptSchema.optional(),
        productOrService: codeableConceptSchema,
        modifier: z.array(codeableConceptSchema).optional(),
        programCode: z.array(codeableConceptSchema).optional(),
        servicedDate: z.string().optional(),
        servicedPeriod: periodSchema.optional(),
        locationCodeableConcept: codeableConceptSchema.optional(),
        locationReference: referenceSchema.optional(),
        quantity: z
          .object({
            ...backboneElementSchema.shape,
            value: z.number().optional(),
            comparator: z.enum(['<', '<=', '>=', '>']).optional(),
            unit: z.string().optional(),
            system: z.string().optional(),
            code: z.string().optional(),
          })
          .optional(),
        unitPrice: z
          .object({
            ...backboneElementSchema.shape,
            value: z.number().optional(),
            currency: z.string().optional(),
          })
          .optional(),
        factor: z.number().optional(),
        net: z
          .object({
            ...backboneElementSchema.shape,
            value: z.number().optional(),
            currency: z.string().optional(),
          })
          .optional(),
       udi: z.array(referenceSchema).optional(),
        bodySite: codeableConceptSchema.optional(),
        subSite: z.array(codeableConceptSchema).optional(),
        encounter: z.array(referenceSchema).optional(),
        detail: z
          .array(
            z.object({
              ...backboneElementSchema.shape,
              sequence: z.number().int().positive(),
              revenue: codeableConceptSchema.optional(),
              category: codeableConceptSchema.optional(),
              productOrService: codeableConceptSchema,
              modifier: z.array(codeableConceptSchema).optional(),
              programCode: z.array(codeableConceptSchema).optional(),
              quantity: z
                .object({
                  ...backboneElementSchema.shape,
                  value: z.number().optional(),
                  unit: z.string().optional(),
                  system: z.string().optional(),
                  code: z.string().optional(),
                })
                .optional(),
              unitPrice: z
                .object({
                  ...backboneElementSchema.shape,
                  value: z.number().optional(),
                  currency: z.string().optional(),
                })
                .optional(),
              factor: z.number().optional(),
              net: z
                .object({
                  ...backboneElementSchema.shape,
                  value: z.number().optional(),
                  currency: z.string().optional(),
                })
                .optional(),
              udi: z.array(referenceSchema).optional(),
              subDetail: z
                .array(
                  z.object({
                    ...backboneElementSchema.shape,
                    sequence: z.number().int().positive(),
                    revenue: codeableConceptSchema.optional(),
                    category: codeableConceptSchema.optional(),
                    productOrService: codeableConceptSchema,
                    modifier: z.array(codeableConceptSchema).optional(),
                    programCode: z.array(codeableConceptSchema).optional(),
                    quantity: z
                      .object({
                        ...backboneElementSchema.shape,
                        value: z.number().optional(),
                        unit: z.string().optional(),
                        system: z.string().optional(),
                        code: z.string().optional(),
                      })
                      .optional(),
                    unitPrice: z
                      .object({
                        ...backboneElementSchema.shape,
                        value: z.number().optional(),
                        currency: z.string().optional(),
                      })
                      .optional(),
                    factor: z.number().optional(),
                    net: z
                      .object({
                        ...backboneElementSchema.shape,
                        value: z.number().optional(),
                        currency: z.string().optional(),
                      })
                      .optional(),
                    udi: z.array(referenceSchema).optional(),
                  }),
                )
                .optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  total: z
    .object({
      ...backboneElementSchema.shape,
      value: z.number().optional(),
      currency: z.string().optional(),
    })
    .optional(),
});

export type Claim = z.infer<typeof claimSchema>;
