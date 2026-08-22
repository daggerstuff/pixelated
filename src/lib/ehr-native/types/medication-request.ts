import { z } from 'zod';
import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirReferenceSchema,
  fhirPeriodSchema,
  fhirQuantitySchema,
  fhirBackboneElementSchema,
} from './base';

/**
 * FHIR R4 MedicationRequest resource schema.
 * An order or request for supply of a medication and instructions for administration.
 * @see http://hl7.org/fhir/R4/medicationrequest.html
 */
export const medicationRequestSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('MedicationRequest'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: z.enum([
    'active',
    'on-hold',
    'cancelled',
    'completed',
    'entered-in-error',
    'stopped',
    'draft',
    'unknown',
  ]),
  statusReason: fhirCodeableConceptSchema.optional(),
  intent: z.enum(['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option']),
  category: z.array(fhirCodeableConceptSchema).optional(),
  priority: z.enum(['routine', 'urgent', 'asap', 'stat']).optional(),
  doNotPerform: z.boolean().optional(),
  reportedBoolean: z.boolean().optional(),
  reportedReference: fhirReferenceSchema.optional(),
  medicationCodeableConcept: fhirCodeableConceptSchema.optional(),
  medicationReference: fhirReferenceSchema.optional(),
  subject: fhirReferenceSchema,
  encounter: fhirReferenceSchema.optional(),
  supportingInformation: z.array(fhirReferenceSchema).optional(),
  authoredOn: z.string().optional(),
  requester: fhirReferenceSchema.optional(),
  performer: fhirReferenceSchema.optional(),
  performerType: fhirCodeableConceptSchema.optional(),
  recorder: fhirReferenceSchema.optional(),
  reasonCode: z.array(fhirCodeableConceptSchema).optional(),
  reasonReference: z.array(fhirReferenceSchema).optional(),
  instantiatesCanonical: z.array(z.string()).optional(),
  instantiatesUri: z.array(z.string()).optional(),
  basedOn: z.array(fhirReferenceSchema).optional(),
  groupIdentifier: fhirIdentifierSchema.optional(),
  courseOfTherapyType: fhirCodeableConceptSchema.optional(),
  insurance: z.array(fhirReferenceSchema).optional(),
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
  dosageInstruction: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        sequence: z.number().int().nonnegative().optional(),
        text: z.string().optional(),
        additionalInstruction: z.array(fhirCodeableConceptSchema).optional(),
        patientInstruction: z.string().optional(),
        timing: z
          .object({
            ...fhirBackboneElementSchema.shape,
            event: z.array(z.string()).optional(),
            repeat: z
              .object({
                ...fhirBackboneElementSchema.shape,
                boundsPeriod: fhirPeriodSchema.optional(),
                count: z.number().int().positive().optional(),
                countMax: z.number().int().positive().optional(),
                duration: z.number().optional(),
                durationMax: z.number().optional(),
                durationUnit: z.enum(['s', 'min', 'h', 'd', 'wk', 'mo', 'a']).optional(),
                frequency: z.number().int().nonnegative().optional(),
                frequencyMax: z.number().int().nonnegative().optional(),
                period: z.number().optional(),
                periodMax: z.number().optional(),
                periodUnit: z.enum(['s', 'min', 'h', 'd', 'wk', 'mo', 'a']).optional(),
                dayOfWeek: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional(),
                timeOfDay: z.array(z.string()).optional(),
                when: z.array(z.string()).optional(),
                offset: z.number().int().nonnegative().optional(),
              })
              .optional(),
            code: fhirCodeableConceptSchema.optional(),
          })
          .optional(),
        asNeededBoolean: z.boolean().optional(),
        asNeededCodeableConcept: fhirCodeableConceptSchema.optional(),
        site: fhirCodeableConceptSchema.optional(),
        route: fhirCodeableConceptSchema.optional(),
        method: fhirCodeableConceptSchema.optional(),
        doseAndRate: z
          .array(
            z.object({
              ...fhirBackboneElementSchema.shape,
              type: fhirCodeableConceptSchema.optional(),
              doseQuantity: fhirQuantitySchema.optional(),
              doseRange: z
                .object({
                  ...fhirBackboneElementSchema.shape,
                  low: fhirQuantitySchema.optional(),
                  high: fhirQuantitySchema.optional(),
                })
                .optional(),
              rateQuantity: fhirQuantitySchema.optional(),
              rateRatio: z
                .object({
                  ...fhirBackboneElementSchema.shape,
                  numerator: fhirQuantitySchema.optional(),
                  denominator: fhirQuantitySchema.optional(),
                })
                .optional(),
              rateRange: z
                .object({
                  ...fhirBackboneElementSchema.shape,
                  low: fhirQuantitySchema.optional(),
                  high: fhirQuantitySchema.optional(),
                })
                .optional(),
            }),
          )
          .optional(),
        maxDosePerPeriod: z
          .object({
            ...fhirBackboneElementSchema.shape,
            numerator: fhirQuantitySchema.optional(),
            denominator: fhirQuantitySchema.optional(),
          })
          .optional(),
        maxDosePerAdministration: fhirQuantitySchema.optional(),
        maxDosePerLifetime: fhirQuantitySchema.optional(),
      }),
    )
    .optional(),
  dispenseRequest: z
    .object({
      ...fhirBackboneElementSchema.shape,
      initialFill: z
        .object({
          ...fhirBackboneElementSchema.shape,
          quantity: fhirQuantitySchema.optional(),
          duration: fhirPeriodSchema.optional(),
        })
        .optional(),
      dispenseInterval: fhirPeriodSchema.optional(),
      validityPeriod: fhirPeriodSchema.optional(),
      numberOfRepeatsAllowed: z.number().int().nonnegative().optional(),
      quantity: fhirQuantitySchema.optional(),
      expectedSupplyDuration: fhirPeriodSchema.optional(),
      performer: fhirReferenceSchema.optional(),
    })
    .optional(),
  substitution: z
    .object({
      ...fhirBackboneElementSchema.shape,
      allowedBoolean: z.boolean().optional(),
      allowedCodeableConcept: fhirCodeableConceptSchema.optional(),
      reason: fhirCodeableConceptSchema.optional(),
    })
    .optional(),
  priorPrescription: fhirReferenceSchema.optional(),
  detectedIssue: z.array(fhirReferenceSchema).optional(),
  eventHistory: z.array(fhirReferenceSchema).optional(),
});

export type MedicationRequest = z.infer<typeof medicationRequestSchema>;
