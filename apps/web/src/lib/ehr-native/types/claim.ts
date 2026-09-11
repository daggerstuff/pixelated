import { z } from 'zod'

import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirReferenceSchema,
  fhirPeriodSchema,
  fhirBackboneElementSchema,
  fhirAttachmentSchema,
  fhirMoneySchema,
  fhirQuantitySchema,
} from './base'

/**
 * FHIR R4 Claim resource schema.
 * A provider-issued list of professional services and products billed to a payer.
 * @see http://hl7.org/fhir/R4/claim.html
 */
export const claimSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('Claim'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: z.enum(['active', 'cancelled', 'draft', 'entered-in-error']),
  type: fhirCodeableConceptSchema.optional(),
  subType: fhirCodeableConceptSchema.optional(),
  use: z.enum(['claim', 'preauthorization', 'predetermination']),
  patient: fhirReferenceSchema,
  billablePeriod: fhirPeriodSchema.optional(),
  created: z.string(),
  enterer: fhirReferenceSchema.optional(),
  insurer: fhirReferenceSchema.optional(),
  provider: fhirReferenceSchema,
  priority: fhirCodeableConceptSchema,
  fundsReserve: fhirCodeableConceptSchema.optional(),
  related: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        claim: fhirReferenceSchema.optional(),
        relationship: fhirCodeableConceptSchema.optional(),
        reference: fhirIdentifierSchema.optional(),
      }),
    )
    .optional(),
  prescription: fhirReferenceSchema.optional(),
  originalPrescription: fhirReferenceSchema.optional(),
  payee: z
    .object({
      ...fhirBackboneElementSchema.shape,
      type: fhirCodeableConceptSchema,
      party: fhirReferenceSchema.optional(),
    })
    .optional(),
  referral: fhirReferenceSchema.optional(),
  facility: fhirReferenceSchema.optional(),
  careTeam: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        sequence: z.number().int().positive(),
        provider: fhirReferenceSchema,
        responsible: z.boolean().optional(),
        role: fhirCodeableConceptSchema.optional(),
        qualification: fhirCodeableConceptSchema.optional(),
      }),
    )
    .optional(),
  supportingInfo: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        sequence: z.number().int().positive(),
        information: fhirReferenceSchema.optional(),
        timingDate: z.string().optional(),
        timingPeriod: fhirPeriodSchema.optional(),
        valueBoolean: z.boolean().optional(),
        valueString: z.string().optional(),
        valueQuantity: z
          .object({
            ...fhirBackboneElementSchema.shape,
            value: z.number().optional(),
            comparator: z.enum(['<', '<=', '>=', '>']).optional(),
            unit: z.string().optional(),
            system: z.string().optional(),
            code: z.string().optional(),
          })
          .optional(),
        valueAttachment: fhirAttachmentSchema.optional(),
        reason: fhirCodeableConceptSchema.optional(),
      }),
    )
    .optional(),
  diagnosis: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        sequence: z.number().int().positive(),
        diagnosisReference: fhirReferenceSchema.optional(),
        diagnosisCodeableConcept: fhirCodeableConceptSchema.optional(),
        type: z.array(fhirCodeableConceptSchema).optional(),
        onAdmission: fhirCodeableConceptSchema.optional(),
        packageCode: fhirCodeableConceptSchema.optional(),
      }),
    )
    .optional(),
  procedure: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        sequence: z.number().int().positive(),
        procedureReference: fhirReferenceSchema.optional(),
        procedureCodeableConcept: fhirCodeableConceptSchema.optional(),
      }),
    )
    .optional(),
  insurance: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        sequence: z.number().int().positive(),
        focal: z.boolean(),
        coverage: fhirReferenceSchema,
        businessArrangement: z.string().optional(),
        preAuthRef: z.array(z.string()).optional(),
        claimResponse: fhirReferenceSchema.optional(),
      }),
    )
    .min(1),
  accident: z
    .object({
      ...fhirBackboneElementSchema.shape,
      date: z.string().optional(),
      type: fhirCodeableConceptSchema.optional(),
      locationReference: fhirReferenceSchema.optional(),
      locationAddress: z
        .object({
          ...fhirBackboneElementSchema.shape,
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
        ...fhirBackboneElementSchema.shape,
        sequence: z.number().int().positive(),
        careTeamSequence: z.array(z.number().int().positive()).optional(),
        diagnosisSequence: z.array(z.number().int().positive()).optional(),
        procedureSequence: z.array(z.number().int().positive()).optional(),
        informationSequence: z.array(z.number().int().positive()).optional(),
        revenue: fhirCodeableConceptSchema.optional(),
        category: fhirCodeableConceptSchema.optional(),
        productOrService: fhirCodeableConceptSchema,
        modifier: z.array(fhirCodeableConceptSchema).optional(),
        programCode: z.array(fhirCodeableConceptSchema).optional(),
        servicedDate: z.string().optional(),
        servicedPeriod: fhirPeriodSchema.optional(),
        locationCodeableConcept: fhirCodeableConceptSchema.optional(),
        locationReference: fhirReferenceSchema.optional(),
        quantity: z
          .object({
            ...fhirBackboneElementSchema.shape,
            value: z.number().optional(),
            comparator: z.enum(['<', '<=', '>=', '>']).optional(),
            unit: z.string().optional(),
            system: z.string().optional(),
            code: z.string().optional(),
          })
          .optional(),
        unitPrice: z
          .object({
            ...fhirBackboneElementSchema.shape,
            value: z.number().optional(),
            currency: z.string().optional(),
          })
          .optional(),
        factor: z.number().optional(),
        net: z
          .object({
            ...fhirBackboneElementSchema.shape,
            value: z.number().optional(),
            currency: z.string().optional(),
          })
          .optional(),
        udi: z.array(fhirReferenceSchema).optional(),
        bodySite: fhirCodeableConceptSchema.optional(),
        subSite: z.array(fhirCodeableConceptSchema).optional(),
        encounter: z.array(fhirReferenceSchema).optional(),
        detail: z
          .array(
            z.object({
              ...fhirBackboneElementSchema.shape,
              sequence: z.number().int().positive(),
              revenue: fhirCodeableConceptSchema.optional(),
              category: fhirCodeableConceptSchema.optional(),
              productOrService: fhirCodeableConceptSchema,
              modifier: z.array(fhirCodeableConceptSchema).optional(),
              programCode: z.array(fhirCodeableConceptSchema).optional(),
              quantity: z
                .object({
                  ...fhirBackboneElementSchema.shape,
                  value: z.number().optional(),
                  unit: z.string().optional(),
                  system: z.string().optional(),
                  code: z.string().optional(),
                })
                .optional(),
              unitPrice: z
                .object({
                  ...fhirBackboneElementSchema.shape,
                  value: z.number().optional(),
                  currency: z.string().optional(),
                })
                .optional(),
              factor: z.number().optional(),
              net: z
                .object({
                  ...fhirBackboneElementSchema.shape,
                  value: z.number().optional(),
                  currency: z.string().optional(),
                })
                .optional(),
              udi: z.array(fhirReferenceSchema).optional(),
              subDetail: z
                .array(
                  z.object({
                    ...fhirBackboneElementSchema.shape,
                    sequence: z.number().int().positive(),
                    revenue: fhirCodeableConceptSchema.optional(),
                    category: fhirCodeableConceptSchema.optional(),
                    productOrService: fhirCodeableConceptSchema,
                    modifier: z.array(fhirCodeableConceptSchema).optional(),
                    programCode: z.array(fhirCodeableConceptSchema).optional(),
                    quantity: z
                      .object({
                        ...fhirBackboneElementSchema.shape,
                        value: z.number().optional(),
                        unit: z.string().optional(),
                        system: z.string().optional(),
                        code: z.string().optional(),
                      })
                      .optional(),
                    unitPrice: z
                      .object({
                        ...fhirBackboneElementSchema.shape,
                        value: z.number().optional(),
                        currency: z.string().optional(),
                      })
                      .optional(),
                    factor: z.number().optional(),
                    net: z
                      .object({
                        ...fhirBackboneElementSchema.shape,
                        value: z.number().optional(),
                        currency: z.string().optional(),
                      })
                      .optional(),
                    udi: z.array(fhirReferenceSchema).optional(),
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
      ...fhirBackboneElementSchema.shape,
      value: z.number().optional(),
      currency: z.string().optional(),
    })
    .optional(),
})

export type Claim = z.infer<typeof claimSchema>

export const claimResponseSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('ClaimResponse'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: z.enum(['active', 'cancelled', 'draft', 'entered-in-error']),
  type: fhirCodeableConceptSchema.optional(),
  subType: fhirCodeableConceptSchema.optional(),
  use: z.enum(['claim', 'preauthorization', 'predetermination']),
  patient: fhirReferenceSchema,
  created: z.string(),
  disposition: z.string().optional(),
  preAuthRef: z.string().optional(),
  payee: fhirReferenceSchema.optional(),
  insurer: fhirReferenceSchema,
  outcome: z.enum(['queued', 'complete', 'error', 'partial']),
  total: z
    .array(
      z.object({
        category: fhirCodeableConceptSchema,
        amount: fhirMoneySchema,
      }),
    )
    .optional(),
  payment: z
    .object({
      type: fhirCodeableConceptSchema,
      amount: fhirMoneySchema.optional(),
    })
    .optional(),
  processNote: z
    .array(
      z.object({
        text: z.string(),
      }),
    )
    .optional(),
})

export type ClaimResponse = z.infer<typeof claimResponseSchema>

export const coverageSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('Coverage'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: z.enum(['active', 'entered-in-error', 'draft', 'cancelled']),
  type: fhirCodeableConceptSchema.optional(),
  beneficiary: fhirReferenceSchema,
  policyHolder: fhirReferenceSchema.optional(),
  subscriber: fhirReferenceSchema.optional(),
  subscriberId: z.string().optional(),
  dependent: z.string().optional(),
  relationship: fhirCodeableConceptSchema.optional(),
  period: fhirPeriodSchema.optional(),
  payor: z.array(fhirReferenceSchema).min(1),
  order: z.number().int().positive().optional(),
  network: z.string().optional(),
})

export type Coverage = z.infer<typeof coverageSchema>

export const explanationOfBenefitSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('ExplanationOfBenefit'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: z.enum(['active', 'cancelled', 'draft', 'entered-in-error']),
  type: fhirCodeableConceptSchema.optional(),
  subType: fhirCodeableConceptSchema.optional(),
  use: z.enum(['claim', 'preauthorization', 'predetermination']),
  patient: fhirReferenceSchema,
  billablePeriod: fhirPeriodSchema.optional(),
  created: z.string(),
  disposition: z.string().optional(),
  preAuthRef: z.array(z.string()).optional(),
  insurer: fhirReferenceSchema,
  provider: fhirReferenceSchema,
  outcome: z.enum(['queued', 'complete', 'error', 'partial']),
  insurance: z.object({
    focal: z.boolean(),
    coverage: fhirReferenceSchema,
  }),
  total: z
    .array(
      z.object({
        category: fhirCodeableConceptSchema,
        amount: fhirMoneySchema,
      }),
    )
    .optional(),
  payment: z
    .object({
      type: fhirCodeableConceptSchema,
      amount: fhirMoneySchema.optional(),
    })
    .optional(),
  benefitBalance: z
    .array(
      z.object({
        category: fhirCodeableConceptSchema,
        financial: z
          .array(
            z.object({
              type: fhirCodeableConceptSchema,
              usedMoney: fhirMoneySchema.optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
})

export type ExplanationOfBenefit = z.infer<typeof explanationOfBenefitSchema>
