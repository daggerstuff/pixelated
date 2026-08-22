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
 * FHIR R4 ServiceRequest resource schema.
 * A record of a request for a service such as diagnostic investigations, surgical procedures.
 * @see http://hl7.org/fhir/R4/servicerequest.html
 */
export const serviceRequestSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('ServiceRequest'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  instantiatesCanonical: z.array(z.string()).optional(),
  instantiatesUri: z.array(z.string()).optional(),
  basedOn: z.array(fhirReferenceSchema).optional(),
  replaces: z.array(fhirReferenceSchema).optional(),
  requisition: fhirIdentifierSchema.optional(),
  status: z.enum([
    'draft',
    'active',
    'on-hold',
    'revoked',
    'completed',
    'entered-in-error',
    'unknown',
  ]),
  intent: z.enum(['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option']),
  category: z.array(fhirCodeableConceptSchema).optional(),
  priority: z.enum(['routine', 'urgent', 'asap', 'stat']).optional(),
  doNotPerform: z.boolean().optional(),
  code: fhirCodeableConceptSchema.optional(),
  orderDetail: z.array(fhirCodeableConceptSchema).optional(),
  quantityQuantity: fhirQuantitySchema.optional(),
  quantityRatio: z
    .object({
      ...fhirBackboneElementSchema.shape,
      numerator: fhirQuantitySchema.optional(),
      denominator: fhirQuantitySchema.optional(),
    })
    .optional(),
  quantityRange: z
    .object({
      ...fhirBackboneElementSchema.shape,
      low: fhirQuantitySchema.optional(),
      high: fhirQuantitySchema.optional(),
    })
    .optional(),
  subject: fhirReferenceSchema,
  encounter: fhirReferenceSchema.optional(),
  occurrenceDateTime: z.string().optional(),
  occurrencePeriod: fhirPeriodSchema.optional(),
  occurrenceTiming: z
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
  authoredOn: z.string().optional(),
  requester: fhirReferenceSchema.optional(),
  performerType: fhirCodeableConceptSchema.optional(),
  performer: z.array(fhirReferenceSchema).optional(),
  locationCode: z.array(fhirCodeableConceptSchema).optional(),
  locationReference: z.array(fhirReferenceSchema).optional(),
  reasonCode: z.array(fhirCodeableConceptSchema).optional(),
  reasonReference: z.array(fhirReferenceSchema).optional(),
  insurance: z.array(fhirReferenceSchema).optional(),
  supportingInfo: z.array(fhirReferenceSchema).optional(),
  specimen: z.array(fhirReferenceSchema).optional(),
  bodySite: z.array(fhirCodeableConceptSchema).optional(),
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
  patientInstruction: z.string().optional(),
  relevantHistory: z.array(fhirReferenceSchema).optional(),
});

export type ServiceRequest = z.infer<typeof serviceRequestSchema>;
