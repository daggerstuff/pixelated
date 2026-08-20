/**
 * FHIR R4 Billing Resource Schemas
 * @see http://hl7.org/fhir/R4/claim.html
 * @see http://hl7.org/fhir/R4/claimresponse.html
 * @see http://hl7.org/fhir/R4/coverage.html
 * @see http://hl7.org/fhir/R4/explanationofbenefit.html
 */

import { z } from 'zod';

import {
  fhirBaseSchema,
  fhirBooleanSchema,
  fhirCodeSchema,
  fhirCodeableConceptSchema,
  fhirDateSchema,
  fhirDateTimeSchema,
  fhirIdentifierSchema,
  fhirMoneySchema,
  fhirPeriodSchema,
  fhirPositiveIntSchema,
  fhirQuantitySchema,
  fhirReferenceSchema,
  fhirStringSchema,
  fhirUriSchema,
} from './base';

// ---------------------------------------------------------------------------
// Shared enums / sub-schemas
// ---------------------------------------------------------------------------

export const claimStatusSchema = z.enum([
  'active',
  'cancelled',
  'draft',
  'entered-in-error',
]);

export const claimUseSchema = z.enum([
  'claim',
  'preauthorization',
  'predetermination',
]);

export const claimResponseStatusSchema = z.enum([
  'active',
  'cancelled',
  'draft',
  'entered-in-error',
]);

export const coverageStatusSchema = z.enum([
  'active',
  'entered-in-error',
  'draft',
  'cancelled',
]);

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

export const claimSupportingInfoSchema = z.object({
  sequence: fhirPositiveIntSchema,
  information: fhirReferenceSchema,
  reason: fhirCodeableConceptSchema.optional(),
  category: fhirCodeableConceptSchema,
  code: fhirCodeableConceptSchema.optional(),
  timingDate: fhirDateSchema.optional(),
  timingPeriod: fhirPeriodSchema.optional(),
  valueBoolean: fhirBooleanSchema.optional(),
  valueString: fhirStringSchema.optional(),
  valueQuantity: fhirQuantitySchema.optional(),
  valueAttachment: fhirReferenceSchema.optional(),
  reasonReference: fhirReferenceSchema.optional(),
});

export const claimDiagnosisSchema = z.object({
  sequence: fhirPositiveIntSchema,
  diagnosisCodeableConcept: fhirCodeableConceptSchema.optional(),
  diagnosisReference: fhirReferenceSchema.optional(),
  type: fhirCodeableConceptSchema.array().optional(),
  onAdmission: fhirCodeableConceptSchema.optional(),
  packageCode: fhirCodeableConceptSchema.optional(),
});

export const claimProcedureSchema = z.object({
  sequence: fhirPositiveIntSchema,
  procedureCodeableConcept: fhirCodeableConceptSchema.optional(),
  procedureReference: fhirReferenceSchema.optional(),
  type: fhirCodeableConceptSchema.array().optional(),
  date: fhirDateTimeSchema.optional(),
  udi: fhirReferenceSchema.array().optional(),
});

export const claimInsuranceSchema = z.object({
  sequence: fhirPositiveIntSchema,
  focal: fhirBooleanSchema,
  coverage: fhirReferenceSchema,
  businessArrangement: fhirStringSchema.optional(),
  preAuthRef: fhirStringSchema.array().optional(),
  claimResponse: fhirReferenceSchema.optional(),
});

export const claimAccidentSchema = z.object({
  date: fhirDateSchema.optional(),
  type: fhirCodeableConceptSchema.optional(),
  locationAddress: fhirStringSchema.optional(),
  locationReference: fhirReferenceSchema.optional(),
});

export const claimItemSchema = z.object({
  sequence: fhirPositiveIntSchema,
  careTeamSequence: fhirPositiveIntSchema.array().optional(),
  diagnosisSequence: fhirPositiveIntSchema.array().optional(),
  procedureSequence: fhirPositiveIntSchema.array().optional(),
  informationSequence: fhirPositiveIntSchema.array().optional(),
  revenue: fhirCodeableConceptSchema.optional(),
  category: fhirCodeableConceptSchema.optional(),
  productOrService: fhirCodeableConceptSchema.optional(),
  modifier: fhirCodeableConceptSchema.array().optional(),
  programCode: fhirCodeableConceptSchema.array().optional(),
  servicedDate: fhirDateSchema.optional(),
  servicedPeriod: fhirPeriodSchema.optional(),
  locationCodeableConcept: fhirCodeableConceptSchema.optional(),
  locationReference: fhirReferenceSchema.optional(),
  quantity: fhirQuantitySchema.optional(),
  unitPrice: fhirMoneySchema.optional(),
  factor: z.number().optional(),
  net: fhirMoneySchema.optional(),
  udi: fhirReferenceSchema.array().optional(),
  bodySite: fhirCodeableConceptSchema.optional(),
  subSite: fhirCodeableConceptSchema.array().optional(),
  encounter: fhirReferenceSchema.array().optional(),
  detail: z
    .array(
      z.object({
        sequence: fhirPositiveIntSchema,
        revenue: fhirCodeableConceptSchema.optional(),
        category: fhirCodeableConceptSchema.optional(),
        productOrService: fhirCodeableConceptSchema.optional(),
        modifier: fhirCodeableConceptSchema.array().optional(),
        quantity: fhirQuantitySchema.optional(),
        unitPrice: fhirMoneySchema.optional(),
        factor: z.number().optional(),
        net: fhirMoneySchema.optional(),
        udi: fhirReferenceSchema.array().optional(),
        subDetail: z
          .array(
            z.object({
              sequence: fhirPositiveIntSchema,
              revenue: fhirCodeableConceptSchema.optional(),
              category: fhirCodeableConceptSchema.optional(),
              productOrService: fhirCodeableConceptSchema.optional(),
              modifier: fhirCodeableConceptSchema.array().optional(),
              quantity: fhirQuantitySchema.optional(),
              unitPrice: fhirMoneySchema.optional(),
              factor: z.number().optional(),
              net: fhirMoneySchema.optional(),
              udi: fhirReferenceSchema.array().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

export const claimCareTeamSchema = z.object({
  sequence: fhirPositiveIntSchema,
  provider: fhirReferenceSchema,
  responsible: fhirBooleanSchema.optional(),
  role: fhirCodeableConceptSchema.optional(),
  qualification: fhirCodeableConceptSchema.optional(),
});

export const claimPayeeSchema = z.object({
  type: fhirCodeableConceptSchema,
  party: fhirReferenceSchema.optional(),
});

export const claimSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Claim'),
  identifier: fhirIdentifierSchema.array().optional(),
  status: claimStatusSchema,
  type: fhirCodeableConceptSchema.optional(),
  subType: fhirCodeableConceptSchema.optional(),
  use: claimUseSchema,
  patient: fhirReferenceSchema,
  billablePeriod: fhirPeriodSchema.optional(),
  created: fhirDateTimeSchema,
  enterer: fhirReferenceSchema.optional(),
  insurer: fhirReferenceSchema.optional(),
  provider: fhirReferenceSchema,
  priority: fhirCodeableConceptSchema,
  fundsReserve: fhirCodeableConceptSchema.optional(),
  related: z
    .array(
      z.object({
        claim: fhirReferenceSchema.optional(),
        relationship: fhirCodeableConceptSchema.optional(),
        reference: fhirIdentifierSchema.optional(),
      }),
    )
    .optional(),
  prescription: fhirReferenceSchema.optional(),
  originalPrescription: fhirReferenceSchema.optional(),
  payee: claimPayeeSchema.optional(),
  referral: fhirReferenceSchema.optional(),
  facility: fhirReferenceSchema.optional(),
  careTeam: claimCareTeamSchema.array().optional(),
  supportingInfo: claimSupportingInfoSchema.array().optional(),
  diagnosis: claimDiagnosisSchema.array().optional(),
  procedure: claimProcedureSchema.array().optional(),
  insurance: z.array(claimInsuranceSchema).min(1),
  accident: claimAccidentSchema.optional(),
  item: claimItemSchema.array().optional(),
  total: fhirMoneySchema.optional(),
});

export type Claim = z.infer<typeof claimSchema>;

// ---------------------------------------------------------------------------
// ClaimResponse
// ---------------------------------------------------------------------------

export const claimResponseItemSchema = z.object({
  fhirSequence: fhirPositiveIntSchema.optional(),
  noteNumber: fhirPositiveIntSchema.array().optional(),
  adjudication: z
    .array(
      z.object({
        category: fhirCodeableConceptSchema,
        reason: fhirCodeableConceptSchema.optional(),
        amount: fhirMoneySchema.optional(),
        value: z.number().optional(),
      }),
    )
    .optional(),
  detail: z
    .array(
      z.object({
        fhirSequence: fhirPositiveIntSchema.optional(),
        noteNumber: fhirPositiveIntSchema.array().optional(),
        adjudication: z
          .array(
            z.object({
              category: fhirCodeableConceptSchema,
              reason: fhirCodeableConceptSchema.optional(),
              amount: fhirMoneySchema.optional(),
              value: z.number().optional(),
            }),
          )
          .optional(),
        subDetail: z
          .array(
            z.object({
              fhirSequence: fhirPositiveIntSchema.optional(),
              noteNumber: fhirPositiveIntSchema.array().optional(),
              adjudication: z
                .array(
                  z.object({
                    category: fhirCodeableConceptSchema,
                    reason: fhirCodeableConceptSchema.optional(),
                    amount: fhirMoneySchema.optional(),
                    value: z.number().optional(),
                  }),
                )
                .optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

export const claimResponseAddItemSchema = z.object({
  itemSequence: fhirPositiveIntSchema.array().optional(),
  detailSequence: fhirPositiveIntSchema.array().optional(),
  subdetailSequence: fhirPositiveIntSchema.array().optional(),
  provider: fhirReferenceSchema.array().optional(),
  productOrService: fhirCodeableConceptSchema,
  modifier: fhirCodeableConceptSchema.array().optional(),
  programCode: fhirCodeableConceptSchema.array().optional(),
  servicedDate: fhirDateSchema.optional(),
  servicedPeriod: fhirPeriodSchema.optional(),
  locationCodeableConcept: fhirCodeableConceptSchema.optional(),
  locationReference: fhirReferenceSchema.optional(),
  quantity: fhirQuantitySchema.optional(),
  unitPrice: fhirMoneySchema.optional(),
  factor: z.number().optional(),
  net: fhirMoneySchema.optional(),
  bodySite: fhirCodeableConceptSchema.optional(),
  subSite: fhirCodeableConceptSchema.array().optional(),
  noteNumber: fhirPositiveIntSchema.array().optional(),
  adjudication: z
    .array(
      z.object({
        category: fhirCodeableConceptSchema,
        reason: fhirCodeableConceptSchema.optional(),
        amount: fhirMoneySchema.optional(),
        value: z.number().optional(),
      }),
    )
    .optional(),
});

export const claimResponseSubDetailSchema = z.object({
  fhirSequence: fhirPositiveIntSchema.optional(),
  noteNumber: fhirPositiveIntSchema.array().optional(),
  adjudication: z
    .array(
      z.object({
        category: fhirCodeableConceptSchema,
        reason: fhirCodeableConceptSchema.optional(),
        amount: fhirMoneySchema.optional(),
        value: z.number().optional(),
      }),
    )
    .optional(),
});

export const claimResponseDetailSchema = z.object({
  fhirSequence: fhirPositiveIntSchema.optional(),
  noteNumber: fhirPositiveIntSchema.array().optional(),
  adjudication: z
    .array(
      z.object({
        category: fhirCodeableConceptSchema,
        reason: fhirCodeableConceptSchema.optional(),
        amount: fhirMoneySchema.optional(),
        value: z.number().optional(),
      }),
    )
    .optional(),
  subDetail: claimResponseSubDetailSchema.array().optional(),
});

export const claimResponseTotalSchema = z.object({
  category: fhirCodeableConceptSchema,
  amount: fhirMoneySchema,
});

export const claimResponseProcessNoteSchema = z.object({
  number: fhirPositiveIntSchema.optional(),
  type: z.enum(['display', 'print', 'print-and-display']).optional(),
  text: fhirStringSchema,
  language: fhirCodeableConceptSchema.optional(),
});

export const claimResponseInsuranceSchema = z.object({
  sequence: fhirPositiveIntSchema,
  focal: fhirBooleanSchema,
  coverage: fhirReferenceSchema,
  businessArrangement: fhirStringSchema.optional(),
  claimResponse: fhirReferenceSchema.optional(),
});

export const claimResponseErrorSchema = z.object({
  itemSequence: fhirPositiveIntSchema.optional(),
  detailSequence: fhirPositiveIntSchema.optional(),
  subDetailSequence: fhirPositiveIntSchema.optional(),
  code: fhirCodeableConceptSchema,
});

export const claimResponsePaymentSchema = z.object({
  type: fhirCodeableConceptSchema,
  adjustment: fhirMoneySchema.optional(),
  adjustmentReason: fhirCodeableConceptSchema.optional(),
  date: fhirDateSchema.optional(),
  amount: fhirMoneySchema,
  identifier: fhirIdentifierSchema.optional(),
});

export const claimResponseSchema = fhirBaseSchema.extend({
  resourceType: z.literal('ClaimResponse'),
  identifier: fhirIdentifierSchema.array().optional(),
  status: claimResponseStatusSchema,
  type: fhirCodeableConceptSchema.optional(),
  subType: fhirCodeableConceptSchema.optional(),
  use: claimUseSchema,
  patient: fhirReferenceSchema,
  created: fhirDateTimeSchema,
  insurer: fhirReferenceSchema,
  request: fhirReferenceSchema.optional(),
  outcome: z.enum(['queued', 'complete', 'error', 'partial']),
  disposition: fhirStringSchema.optional(),
  preAuthRef: fhirStringSchema.optional(),
  preAuthPeriod: fhirPeriodSchema.optional(),
  payeeType: fhirCodeableConceptSchema.optional(),
  item: claimResponseItemSchema.array().optional(),
  addItem: claimResponseAddItemSchema.array().optional(),
  adjudication: z
    .array(
      z.object({
        category: fhirCodeableConceptSchema,
        reason: fhirCodeableConceptSchema.optional(),
        amount: fhirMoneySchema.optional(),
        value: z.number().optional(),
      }),
    )
    .optional(),
  total: claimResponseTotalSchema.array().optional(),
  payment: claimResponsePaymentSchema.optional(),
  fundsReserve: fhirCodeableConceptSchema.optional(),
  formCode: fhirCodeableConceptSchema.optional(),
  form: fhirStringSchema.optional(),
  processNote: claimResponseProcessNoteSchema.array().optional(),
  communicationRequest: fhirReferenceSchema.array().optional(),
  insurance: claimResponseInsuranceSchema.array().optional(),
  error: claimResponseErrorSchema.array().optional(),
});

export type ClaimResponse = z.infer<typeof claimResponseSchema>;

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

export const coverageClassSchema = z.object({
  type: fhirCodeableConceptSchema,
  value: fhirStringSchema,
  name: fhirStringSchema.optional(),
});

export const coverageCostToBeneficiarySchema = z.object({
  type: fhirCodeableConceptSchema.optional(),
  valueMoney: fhirMoneySchema.optional(),
  valueQuantity: fhirQuantitySchema.optional(),
  exception: z
    .array(
      z.object({
        type: fhirCodeableConceptSchema,
        period: fhirPeriodSchema.optional(),
      }),
    )
    .optional(),
});

export const coverageSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Coverage'),
  identifier: fhirIdentifierSchema.array().optional(),
  status: coverageStatusSchema,
  type: fhirCodeableConceptSchema.optional(),
  policyHolder: fhirReferenceSchema.optional(),
  subscriber: fhirReferenceSchema.optional(),
  subscriberId: fhirStringSchema.optional(),
  beneficiary: fhirReferenceSchema,
  dependent: fhirStringSchema.optional(),
  relationship: fhirCodeableConceptSchema.optional(),
  period: fhirPeriodSchema.optional(),
  payor: fhirReferenceSchema.array().min(1),
  class: coverageClassSchema.array().optional(),
  order: fhirPositiveIntSchema.optional(),
  network: fhirStringSchema.optional(),
  costToBeneficiary: coverageCostToBeneficiarySchema.array().optional(),
  subrogation: fhirBooleanSchema.optional(),
  contract: fhirReferenceSchema.array().optional(),
});

export type Coverage = z.infer<typeof coverageSchema>;

// ---------------------------------------------------------------------------
// ExplanationOfBenefit
// ---------------------------------------------------------------------------

export const eobStatusSchema = z.enum([
  'active',
  'cancelled',
  'draft',
  'entered-in-error',
]);

export const eobOutcomeSchema = z.enum(['queued', 'complete', 'error', 'partial']);

export const eobRelatedSchema = z.object({
  claim: fhirReferenceSchema.optional(),
  relationship: fhirCodeableConceptSchema.optional(),
  reference: fhirIdentifierSchema.optional(),
});

export const eobInsuranceSchema = z.object({
  focal: fhirBooleanSchema,
  coverage: fhirReferenceSchema,
  preAuthRef: fhirStringSchema.array().optional(),
});

export const eobAccidentSchema = z.object({
  date: fhirDateSchema.optional(),
  type: fhirCodeableConceptSchema.optional(),
  locationAddress: fhirStringSchema.optional(),
  locationReference: fhirReferenceSchema.optional(),
});

export const eobItemSchema = z.object({
  sequence: fhirPositiveIntSchema,
  careTeamSequence: fhirPositiveIntSchema.array().optional(),
  diagnosisSequence: fhirPositiveIntSchema.array().optional(),
  procedureSequence: fhirPositiveIntSchema.array().optional(),
  informationSequence: fhirPositiveIntSchema.array().optional(),
  revenue: fhirCodeableConceptSchema.optional(),
  category: fhirCodeableConceptSchema.optional(),
  productOrService: fhirCodeableConceptSchema.optional(),
  modifier: fhirCodeableConceptSchema.array().optional(),
  programCode: fhirCodeableConceptSchema.array().optional(),
  servicedDate: fhirDateSchema.optional(),
  servicedPeriod: fhirPeriodSchema.optional(),
  locationCodeableConcept: fhirCodeableConceptSchema.optional(),
  locationReference: fhirReferenceSchema.optional(),
  quantity: fhirQuantitySchema.optional(),
  unitPrice: fhirMoneySchema.optional(),
  factor: z.number().optional(),
  net: fhirMoneySchema.optional(),
  udi: fhirReferenceSchema.array().optional(),
  bodySite: fhirCodeableConceptSchema.optional(),
  subSite: fhirCodeableConceptSchema.array().optional(),
  encounter: fhirReferenceSchema.array().optional(),
  noteNumber: fhirPositiveIntSchema.array().optional(),
  adjudication: z
    .array(
      z.object({
        category: fhirCodeableConceptSchema,
        reason: fhirCodeableConceptSchema.optional(),
        amount: fhirMoneySchema.optional(),
        value: z.number().optional(),
      }),
    )
    .optional(),
  detail: z
    .array(
      z.object({
        sequence: fhirPositiveIntSchema,
        revenue: fhirCodeableConceptSchema.optional(),
        category: fhirCodeableConceptSchema.optional(),
        productOrService: fhirCodeableConceptSchema.optional(),
        modifier: fhirCodeableConceptSchema.array().optional(),
        quantity: fhirQuantitySchema.optional(),
        unitPrice: fhirMoneySchema.optional(),
        factor: z.number().optional(),
        net: fhirMoneySchema.optional(),
        udi: fhirReferenceSchema.array().optional(),
        noteNumber: fhirPositiveIntSchema.array().optional(),
        adjudication: z
          .array(
            z.object({
              category: fhirCodeableConceptSchema,
              reason: fhirCodeableConceptSchema.optional(),
              amount: fhirMoneySchema.optional(),
              value: z.number().optional(),
            }),
          )
          .optional(),
        subDetail: z
          .array(
            z.object({
              sequence: fhirPositiveIntSchema,
              revenue: fhirCodeableConceptSchema.optional(),
              category: fhirCodeableConceptSchema.optional(),
              productOrService: fhirCodeableConceptSchema.optional(),
              modifier: fhirCodeableConceptSchema.array().optional(),
              quantity: fhirQuantitySchema.optional(),
              unitPrice: fhirMoneySchema.optional(),
              factor: z.number().optional(),
              net: fhirMoneySchema.optional(),
              udi: fhirReferenceSchema.array().optional(),
              noteNumber: fhirPositiveIntSchema.array().optional(),
              adjudication: z
                .array(
                  z.object({
                    category: fhirCodeableConceptSchema,
                    reason: fhirCodeableConceptSchema.optional(),
                    amount: fhirMoneySchema.optional(),
                    value: z.number().optional(),
                  }),
                )
                .optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

export const eobAddItemSchema = z.object({
  itemSequence: fhirPositiveIntSchema.array().optional(),
  detailSequence: fhirPositiveIntSchema.array().optional(),
  subDetailSequence: fhirPositiveIntSchema.array().optional(),
  provider: fhirReferenceSchema.array().optional(),
  productOrService: fhirCodeableConceptSchema,
  modifier: fhirCodeableConceptSchema.array().optional(),
  programCode: fhirCodeableConceptSchema.array().optional(),
  servicedDate: fhirDateSchema.optional(),
  servicedPeriod: fhirPeriodSchema.optional(),
  locationCodeableConcept: fhirCodeableConceptSchema.optional(),
  locationReference: fhirReferenceSchema.optional(),
  quantity: fhirQuantitySchema.optional(),
  unitPrice: fhirMoneySchema.optional(),
  factor: z.number().optional(),
  net: fhirMoneySchema.optional(),
  bodySite: fhirCodeableConceptSchema.optional(),
  subSite: fhirCodeableConceptSchema.array().optional(),
  noteNumber: fhirPositiveIntSchema.array().optional(),
  adjudication: z
    .array(
      z.object({
        category: fhirCodeableConceptSchema,
        reason: fhirCodeableConceptSchema.optional(),
        amount: fhirMoneySchema.optional(),
        value: z.number().optional(),
      }),
    )
    .optional(),
});

export const eobTotalSchema = z.object({
  category: fhirCodeableConceptSchema,
  amount: fhirMoneySchema,
});

export const eobPaymentSchema = z.object({
  type: fhirCodeableConceptSchema,
  adjustment: fhirMoneySchema.optional(),
  adjustmentReason: fhirCodeableConceptSchema.optional(),
  date: fhirDateSchema.optional(),
  amount: fhirMoneySchema,
  identifier: fhirIdentifierSchema.optional(),
});

export const eobProcessNoteSchema = z.object({
  number: fhirPositiveIntSchema.optional(),
  type: z.enum(['display', 'print', 'print-and-display']).optional(),
  text: fhirStringSchema,
  language: fhirCodeableConceptSchema.optional(),
});

export const eobBenefitBalanceSchema = z.object({
  category: fhirCodeableConceptSchema,
  excluded: fhirBooleanSchema.optional(),
  name: fhirStringSchema.optional(),
  description: fhirStringSchema.optional(),
  network: fhirCodeableConceptSchema.optional(),
  unit: fhirCodeableConceptSchema.optional(),
  term: fhirCodeableConceptSchema.optional(),
  financial: z
    .array(
      z.object({
        type: fhirCodeableConceptSchema,
        allowedMoney: fhirMoneySchema.optional(),
        allowedQuantity: fhirQuantitySchema.optional(),
        usedMoney: fhirMoneySchema.optional(),
        usedQuantity: fhirQuantitySchema.optional(),
      }),
    )
    .optional(),
});

export const explanationOfBenefitSchema = fhirBaseSchema.extend({
  resourceType: z.literal('ExplanationOfBenefit'),
  identifier: fhirIdentifierSchema.array().optional(),
  status: eobStatusSchema,
  type: fhirCodeableConceptSchema.optional(),
  subType: fhirCodeableConceptSchema.optional(),
  use: claimUseSchema,
  patient: fhirReferenceSchema,
  billablePeriod: fhirPeriodSchema.optional(),
  created: fhirDateTimeSchema,
  enterer: fhirReferenceSchema.optional(),
  insurer: fhirReferenceSchema,
  provider: fhirReferenceSchema,
  priority: fhirCodeableConceptSchema.optional(),
  fundsReserveRequested: fhirCodeableConceptSchema.optional(),
  fundsReserve: fhirCodeableConceptSchema.optional(),
  related: eobRelatedSchema.array().optional(),
  prescription: fhirReferenceSchema.optional(),
  originalPrescription: fhirReferenceSchema.optional(),
  payee: claimPayeeSchema.optional(),
  referral: fhirReferenceSchema.optional(),
  facility: fhirReferenceSchema.optional(),
  claim: fhirReferenceSchema.optional(),
  claimResponse: fhirReferenceSchema.optional(),
  outcome: eobOutcomeSchema,
  disposition: fhirStringSchema.optional(),
  preAuthRef: fhirStringSchema.array().optional(),
  preAuthPeriod: fhirPeriodSchema.optional(),
  careTeam: claimCareTeamSchema.array().optional(),
  supportingInfo: claimSupportingInfoSchema.array().optional(),
  diagnosis: claimDiagnosisSchema.array().optional(),
  procedure: claimProcedureSchema.array().optional(),
  precedence: fhirPositiveIntSchema.optional(),
  insurance: eobInsuranceSchema,
  accident: eobAccidentSchema.optional(),
  item: eobItemSchema.array().optional(),
  addItem: eobAddItemSchema.array().optional(),
  adjudication: z
    .array(
      z.object({
        category: fhirCodeableConceptSchema,
        reason: fhirCodeableConceptSchema.optional(),
        amount: fhirMoneySchema.optional(),
        value: z.number().optional(),
      }),
    )
    .optional(),
  total: eobTotalSchema.array().optional(),
  payment: eobPaymentSchema.optional(),
  formCode: fhirCodeableConceptSchema.optional(),
  form: fhirStringSchema.optional(),
  processNote: eobProcessNoteSchema.array().optional(),
  benefitPeriod: fhirPeriodSchema.optional(),
  benefitBalance: eobBenefitBalanceSchema.array().optional(),
});

export type ExplanationOfBenefit = z.infer<typeof explanationOfBenefitSchema>;
