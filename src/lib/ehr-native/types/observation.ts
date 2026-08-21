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
 * FHIR R4 Observation resource schema.
 * Measurements and simple assertions made about a patient, device, or other subject.
 * @see http://hl7.org/fhir/R4/observation.html
 */
export const observationSchema = domainResourceSchema.extend({
  resourceType: z.literal('Observation'),
  identifier: z.array(identifierSchema).optional(),
  basedOn: z.array(referenceSchema).optional(),
  partOf: z.array(referenceSchema).optional(),
  status: z.enum([
    'registered',
    'preliminary',
    'final',
    'amended',
    'corrected',
    'cancelled',
    'entered-in-error',
    'unknown',
  ]),
  category: z.array(codeableConceptSchema).optional(),
  code: codeableConceptSchema,
  subject: referenceSchema.optional(),
  focus: z.array(referenceSchema).optional(),
  encounter: referenceSchema.optional(),
  effectiveDateTime: z.string().optional(),
  effectivePeriod: periodSchema.optional(),
  issued: z.string().optional(),
  performer: z.array(referenceSchema).optional(),
  valueQuantity: quantitySchema.optional(),
  valueCodeableConcept: codeableConceptSchema.optional(),
  valueString: z.string().optional(),
  valueBoolean: z.boolean().optional(),
  valueInteger: z.number().int().optional(),
  valueRange: z
    .object({
      ...backboneElementSchema.shape,
      low: quantitySchema.optional(),
      high: quantitySchema.optional(),
    })
    .optional(),
  valueRatio: z
    .object({
      ...backboneElementSchema.shape,
      numerator: quantitySchema.optional(),
      denominator: quantitySchema.optional(),
    })
    .optional(),
  valueSampledData: z
    .object({
      ...backboneElementSchema.shape,
      origin: quantitySchema,
      period: z.number(),
      factor: z.number().optional(),
      lowerLimit: z.number().optional(),
      upperLimit: z.number().optional(),
      dimensions: z.number().int().positive(),
      data: z.string().optional(),
    })
    .optional(),
  valueTime: z.string().optional(),
  valueDateTime: z.string().optional(),
  valuePeriod: periodSchema.optional(),
  dataAbsentReason: codeableConceptSchema.optional(),
  interpretation: z.array(codeableConceptSchema).optional(),
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
  bodySite: codeableConceptSchema.optional(),
  method: codeableConceptSchema.optional(),
  specimen: z.array(referenceSchema).optional(),
  device: referenceSchema.optional(),
  referenceRange: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        low: quantitySchema.optional(),
        high: quantitySchema.optional(),
        type: codeableConceptSchema.optional(),
        appliesTo: z.array(codeableConceptSchema).optional(),
        age: z
          .object({
            ...backboneElementSchema.shape,
            low: quantitySchema.optional(),
            high: quantitySchema.optional(),
          })
          .optional(),
        text: z.string().optional(),
      }),
    )
    .optional(),
  hasMember: z.array(referenceSchema).optional(),
  derivedFrom: z.array(referenceSchema).optional(),
  component: z
    .array(
      z.object({
        ...backboneElementSchema.shape,
        code: codeableConceptSchema,
        valueQuantity: quantitySchema.optional(),
        valueCodeableConcept: codeableConceptSchema.optional(),
        valueString: z.string().optional(),
        valueBoolean: z.boolean().optional(),
        valueInteger: z.number().int().optional(),
        valueRange: z
          .object({
            ...backboneElementSchema.shape,
            low: quantitySchema.optional(),
            high: quantitySchema.optional(),
          })
          .optional(),
        valueRatio: z
          .object({
            ...backboneElementSchema.shape,
            numerator: quantitySchema.optional(),
            denominator: quantitySchema.optional(),
          })
          .optional(),
        valueSampledData: z
          .object({
            ...backboneElementSchema.shape,
            origin: quantitySchema,
            period: z.number(),
            factor: z.number().optional(),
            lowerLimit: z.number().optional(),
            upperLimit: z.number().optional(),
            dimensions: z.number().int().positive(),
            data: z.string().optional(),
          })
          .optional(),
        valueTime: z.string().optional(),
        valueDateTime: z.string().optional(),
        valuePeriod: periodSchema.optional(),
        dataAbsentReason: codeableConceptSchema.optional(),
        interpretation: z.array(codeableConceptSchema).optional(),
        referenceRange: z
          .array(
            z.object({
              ...backboneElementSchema.shape,
              low: quantitySchema.optional(),
              high: quantitySchema.optional(),
              type: codeableConceptSchema.optional(),
              appliesTo: z.array(codeableConceptSchema).optional(),
              age: z
                .object({
                  ...backboneElementSchema.shape,
                  low: quantitySchema.optional(),
                  high: quantitySchema.optional(),
                })
                .optional(),
              text: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
});

export type Observation = z.infer<typeof observationSchema>;
