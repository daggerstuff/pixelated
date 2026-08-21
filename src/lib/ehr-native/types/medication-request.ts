import { z } from 'zod';
import {
  domainResourceSchema,
  identifierSchema,
  codeableConceptSchema,
  referenceSchema,
  periodSchema,
  quantitySchema,
  backboneElementSchema,
} from './base';

/**
 * FHIR R4 MedicationRequest resource schema.
 * An order or request for supply of a medication and instructions for administration.
 * @see http://hl7.org/fhir/R4/medicationrequest.html
 */
export const medicationRequestSchema = domainResourceSchema.extend({
  resourceType: z.literal('MedicationRequest'),
  identifier: z.array(identifierSchema).optional(),
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
  statusReason: codeableConceptSchema.optional(),
  intent: z.enum(['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option']),
  category: z.array(codeableConceptSchema).optional(),
  priority: z.enum(['routine', 'urgent', 'asap', 'stat']).optional(),
  doNotPerform: z.boolean().optional(),
  reportedBoolean: z.boolean().optional(),
  reportedReference: referenceSchema.optional(),
  medicationCodeableConcept: codeableConceptSchema.optional(),
  medicationReference: referenceSchema.optional(),
  subject: referenceSchema,
  encounter: referenceSchema.optional(),
  supportingInformation: z.array(referenceSchema).optional(),
  authoredOn: z.string().optional(),
  requester: referenceSchema.optional(),
  performer: referenceSchema.optional(),
  performerType: codeableConceptSchema.optional(),
  recorder: referenceSchema.optional(),
  reasonCode: z.array(codeableConceptSchema).optional(),
  reasonReference: z.array(referenceSchema).optional(),
  instantiatesCanonical: z.array(z.string()).optional(),
  instantiatesUri: z.array(z.string()).optional(),
  basedOn: z.array(referenceSchema).optional(),
  groupIdentifier: identifierSchema.optional(),
  courseOfTherapyType: codeableConceptSchema.optional(),
  insurance: z.array(referenceSchema).optional(),
  note: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        authorReference: referenceSchema.optional(),
        authorString: z.string().optional(),
        time: z.string().optional(),
        text: z.string(),
      }),
    )
    .optional(),
  dosageInstruction: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        sequence: z.number().int().nonnegative().optional(),
        text: z.string().optional(),
        additionalInstruction: z.array(codeableConceptSchema).optional(),
        patientInstruction: z.string().optional(),
        timing: z
          .object({
            ...backboneElementSchema.shape,
            event: z.array(z.string()).optional(),
            repeat: z
              .object({
                ...backboneElementSchema.shape,
                boundsPeriod: periodSchema.optional(),
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
            code: codeableConceptSchema.optional(),
          })
          .optional(),
        asNeededBoolean: z.boolean().optional(),
        asNeededCodeableConcept: codeableConceptSchema.optional(),
        site: codeableConceptSchema.optional(),
        route: codeableConceptSchema.optional(),
        method: codeableConceptSchema.optional(),
        doseAndRate: z
          .array(
            z.object({
              ...backboneElementSchema.shape,
              type: codeableConceptSchema.optional(),
              doseQuantity: quantitySchema.optional(),
              doseRange: z
                .object({
                  ...backboneElementSchema.shape,
                  low: quantitySchema.optional(),
                  high: quantitySchema.optional(),
                })
                .optional(),
              rateQuantity: quantitySchema.optional(),
              rateRatio: z
                .object({
                  ...backboneElementSchema.shape,
                  numerator: quantitySchema.optional(),
                  denominator: quantitySchema.optional(),
                })
                .optional(),
              rateRange: z
                .object({
                  ...backboneElementSchema.shape,
                  low: quantitySchema.optional(),
                  high: quantitySchema.optional(),
                })
                .optional(),
            }),
          )
          .optional(),
        maxDosePerPeriod: z
          .object({
            ...backboneElementSchema.shape,
            numerator: quantitySchema.optional(),
            denominator: quantitySchema.optional(),
          })
          .optional(),
        maxDosePerAdministration: quantitySchema.optional(),
        maxDosePerLifetime: quantitySchema.optional(),
      }),
    )
    .optional(),
  dispenseRequest: z
    .object({
      ...backboneElementSchema.shape,
      initialFill: z
        .object({
          ...backboneElementSchema.shape,
          quantity: quantitySchema.optional(),
          duration: periodSchema.optional(),
        })
        .optional(),
      dispenseInterval: periodSchema.optional(),
      validityPeriod: periodSchema.optional(),
      numberOfRepeatsAllowed: z.number().int().nonnegative().optional(),
      quantity: quantitySchema.optional(),
      expectedSupplyDuration: periodSchema.optional(),
      performer: referenceSchema.optional(),
    })
    .optional(),
  substitution: z
    .object({
      ...backboneElementSchema.shape,
      allowedBoolean: z.boolean().optional(),
      allowedCodeableConcept: codeableConceptSchema.optional(),
      reason: codeableConceptSchema.optional(),
    })
    .optional(),
  priorPrescription: referenceSchema.optional(),
  detectedIssue: z.array(referenceSchema).optional(),
  eventHistory: z.array(referenceSchema).optional(),
});

export type MedicationRequest = z.infer<typeof medicationRequestSchema>;
