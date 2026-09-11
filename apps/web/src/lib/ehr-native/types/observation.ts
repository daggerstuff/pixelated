import { z } from 'zod'

import {
  fhirDomainResourceSchema,
  fhirIdentifierSchema,
  fhirCodeableConceptSchema,
  fhirReferenceSchema,
  fhirPeriodSchema,
  fhirQuantitySchema,
  fhirBackboneElementSchema,
  fhirRangeSchema,
  fhirRatioSchema,
  fhirTimeSchema,
  fhirDateTimeSchema,
} from './base'

/**
 * FHIR R4 Observation resource schema.
 * Measurements and simple assertions made about a patient, device, or other subject.
 * @see http://hl7.org/fhir/R4/observation.html
 */
export const observationSchema = fhirDomainResourceSchema.extend({
  resourceType: z.literal('Observation'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  basedOn: z.array(fhirReferenceSchema).optional(),
  partOf: z.array(fhirReferenceSchema).optional(),
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
  category: z.array(fhirCodeableConceptSchema).optional(),
  code: fhirCodeableConceptSchema,
  subject: fhirReferenceSchema.optional(),
  focus: z.array(fhirReferenceSchema).optional(),
  encounter: fhirReferenceSchema.optional(),
  effectiveDateTime: z.string().optional(),
  effectivePeriod: fhirPeriodSchema.optional(),
  issued: z.string().optional(),
  performer: z.array(fhirReferenceSchema).optional(),
  valueQuantity: fhirQuantitySchema.optional(),
  valueCodeableConcept: fhirCodeableConceptSchema.optional(),
  valueString: z.string().optional(),
  valueBoolean: z.boolean().optional(),
  valueInteger: z.number().int().optional(),
  valueRange: z
    .object({
      ...fhirBackboneElementSchema.shape,
      low: fhirQuantitySchema.optional(),
      high: fhirQuantitySchema.optional(),
    })
    .optional(),
  valueRatio: z
    .object({
      ...fhirBackboneElementSchema.shape,
      numerator: fhirQuantitySchema.optional(),
      denominator: fhirQuantitySchema.optional(),
    })
    .optional(),
  valueSampledData: z
    .object({
      ...fhirBackboneElementSchema.shape,
      origin: fhirQuantitySchema,
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
  valuePeriod: fhirPeriodSchema.optional(),
  dataAbsentReason: fhirCodeableConceptSchema.optional(),
  interpretation: z.array(fhirCodeableConceptSchema).optional(),
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
  bodySite: fhirCodeableConceptSchema.optional(),
  method: fhirCodeableConceptSchema.optional(),
  specimen: z.array(fhirReferenceSchema).optional(),
  device: fhirReferenceSchema.optional(),
  referenceRange: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        low: fhirQuantitySchema.optional(),
        high: fhirQuantitySchema.optional(),
        type: fhirCodeableConceptSchema.optional(),
        appliesTo: z.array(fhirCodeableConceptSchema).optional(),
        age: z
          .object({
            ...fhirBackboneElementSchema.shape,
            low: fhirQuantitySchema.optional(),
            high: fhirQuantitySchema.optional(),
          })
          .optional(),
        text: z.string().optional(),
      }),
    )
    .optional(),
  hasMember: z.array(fhirReferenceSchema).optional(),
  derivedFrom: z.array(fhirReferenceSchema).optional(),
  component: z
    .array(
      z.object({
        ...fhirBackboneElementSchema.shape,
        code: fhirCodeableConceptSchema,
        valueQuantity: fhirQuantitySchema.optional(),
        valueCodeableConcept: fhirCodeableConceptSchema.optional(),
        valueString: z.string().optional(),
        valueBoolean: z.boolean().optional(),
        valueInteger: z.number().int().optional(),
        valueRange: z
          .object({
            ...fhirBackboneElementSchema.shape,
            low: fhirQuantitySchema.optional(),
            high: fhirQuantitySchema.optional(),
          })
          .optional(),
        valueRatio: z
          .object({
            ...fhirBackboneElementSchema.shape,
            numerator: fhirQuantitySchema.optional(),
            denominator: fhirQuantitySchema.optional(),
          })
          .optional(),
        valueSampledData: z
          .object({
            ...fhirBackboneElementSchema.shape,
            origin: fhirQuantitySchema,
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
        valuePeriod: fhirPeriodSchema.optional(),
        dataAbsentReason: fhirCodeableConceptSchema.optional(),
        interpretation: z.array(fhirCodeableConceptSchema).optional(),
        referenceRange: z
          .array(
            z.object({
              ...fhirBackboneElementSchema.shape,
              low: fhirQuantitySchema.optional(),
              high: fhirQuantitySchema.optional(),
              type: fhirCodeableConceptSchema.optional(),
              appliesTo: z.array(fhirCodeableConceptSchema).optional(),
              age: z
                .object({
                  ...fhirBackboneElementSchema.shape,
                  low: fhirQuantitySchema.optional(),
                  high: fhirQuantitySchema.optional(),
                })
                .optional(),
              text: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
}).refine(
  (data) => {
    const valueKeys = [
      'valueQuantity',
      'valueCodeableConcept',
      'valueString',
      'valueBoolean',
      'valueInteger',
      'valueRange',
      'valueRatio',
      'valueSampledData',
      'valueTime',
      'valueDateTime',
      'valuePeriod',
    ]
    const presentCount = valueKeys.filter((k) => data[k] !== undefined).length
    return presentCount <= 1
  },
  { message: 'Observation may have at most one value[x] field' },
)

export const observationValueSchema = z.union([
  z.object({ valueQuantity: fhirQuantitySchema }),
  z.object({ valueCodeableConcept: fhirCodeableConceptSchema }),
  z.object({ valueString: z.string() }),
  z.object({ valueBoolean: z.boolean() }),
  z.object({ valueInteger: z.number().int() }),
  z.object({ valueRange: fhirRangeSchema }),
  z.object({ valueRatio: fhirRatioSchema }),
  z.object({ valueTime: fhirTimeSchema }),
  z.object({ valueDateTime: fhirDateTimeSchema }),
  z.object({ valuePeriod: fhirPeriodSchema }),
])

export type Observation = z.infer<typeof observationSchema>
