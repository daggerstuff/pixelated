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
 * FHIR R4 ServiceRequest resource schema.
 * A record of a request for a service such as diagnostic investigations, surgical procedures.
 * @see http://hl7.org/fhir/R4/servicerequest.html
 */
export const serviceRequestSchema = domainResourceSchema.extend({
  resourceType: z.literal('ServiceRequest'),
  identifier: z.array(identifierSchema).optional(),
  instantiatesCanonical: z.array(z.string()).optional(),
  instantiatesUri: z.array(z.string()).optional(),
  basedOn: z.array(referenceSchema).optional(),
  replaces: z.array(referenceSchema).optional(),
  requisition: identifierSchema.optional(),
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
  category: z.array(codeableConceptSchema).optional(),
  priority: z.enum(['routine', 'urgent', 'asap', 'stat']).optional(),
  doNotPerform: z.boolean().optional(),
  code: codeableConceptSchema.optional(),
  orderDetail: z.array(codeableConceptSchema).optional(),
  quantityQuantity: quantitySchema.optional(),
  quantityRatio: z
    .object({
      ...backboneElementSchema.shape,
      numerator: quantitySchema.optional(),
      denominator: quantitySchema.optional(),
    })
    .optional(),
  quantityRange: z
    .object({
      ...backboneElementSchema.shape,
      low: quantitySchema.optional(),
      high: quantitySchema.optional(),
    })
    .optional(),
  subject: referenceSchema,
  encounter: referenceSchema.optional(),
  occurrenceDateTime: z.string().optional(),
  occurrencePeriod: periodSchema.optional(),
  occurrenceTiming: z
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
  authoredOn: z.string().optional(),
  requester: referenceSchema.optional(),
  performerType: codeableConceptSchema.optional(),
  performer: z.array(referenceSchema).optional(),
  locationCode: z.array(codeableConceptSchema).optional(),
  locationReference: z.array(referenceSchema).optional(),
  reasonCode: z.array(codeableConceptSchema).optional(),
  reasonReference: z.array(referenceSchema).optional(),
  insurance: z.array(referenceSchema).optional(),
  supportingInfo: z.array(referenceSchema).optional(),
  specimen: z.array(referenceSchema).optional(),
  bodySite: z.array(codeableConceptSchema).optional(),
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
  patientInstruction: z.string().optional(),
  relevantHistory: z.array(referenceSchema).optional(),
});

export type ServiceRequest = z.infer<typeof serviceRequestSchema>;
