/**
 * FHIR R4 Clinical Resource Types
 *
 * Schemas for clinical resources per HL7 FHIR R4 specification:
 * Patient, Practitioner, PractitionerRole, Organization, Encounter,
 * Observation (with polymorphic value[x]), Condition, AllergyIntolerance,
 * Medication, MedicationRequest, Immunization, Procedure, DiagnosticReport.
 */
import { z } from 'zod'
import {
  fhirBaseSchema,
  fhirCodeableConceptSchema,
  fhirCodingSchema,
  fhirCodeSchema,
  fhirContactPointSchema,
  fhirDateSchema,
  fhirDateTimeSchema,
  fhirHumanNameSchema,
  fhirIdentifierSchema,
  fhirAddressSchema,
  fhirBooleanSchema,
  fhirIntegerSchema,
  fhirPeriodSchema,
  fhirQuantitySchema,
  fhirRangeSchema,
  fhirRatioSchema,
  fhirReferenceSchema,
  fhirStringSchema,
  fhirTimeSchema,
  fhirUriSchema,
  fhirInstantSchema,
  fhirPositiveIntSchema,
} from './base'

// ===========================================================================
// Patient (http://hl7.org/fhir/R4/patient.html)
// ===========================================================================

export const fhirAdministrativeGenderSchema = z.enum([
  'male',
  'female',
  'other',
  'unknown',
])

export const patientSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Patient'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  active: fhirBooleanSchema.optional(),
  name: z.array(fhirHumanNameSchema).optional(),
  telecom: z.array(fhirContactPointSchema).optional(),
  gender: fhirAdministrativeGenderSchema.optional(),
  birthDate: fhirDateSchema.optional(),
  deceasedBoolean: fhirBooleanSchema.optional(),
  deceasedDateTime: fhirDateTimeSchema.optional(),
  address: z.array(fhirAddressSchema).optional(),
  maritalStatus: fhirCodeableConceptSchema.optional(),
  multipleBirthBoolean: fhirBooleanSchema.optional(),
  multipleBirthInteger: fhirIntegerSchema.optional(),
  photo: z
    .array(
      z.object({
        contentType: fhirCodeSchema.optional(),
        language: fhirCodeSchema.optional(),
        data: z.string().optional(),
        url: fhirUriSchema.optional(),
      }),
    )
    .optional(),
  contact: z
    .array(
      z.object({
        relationship: z.array(fhirCodeableConceptSchema).optional(),
        name: fhirHumanNameSchema.optional(),
        telecom: z.array(fhirContactPointSchema).optional(),
        address: fhirAddressSchema.optional(),
        gender: fhirAdministrativeGenderSchema.optional(),
        organization: fhirReferenceSchema.optional(),
        period: fhirPeriodSchema.optional(),
      }),
    )
    .optional(),
  communication: z
    .array(
      z.object({
        language: fhirCodeableConceptSchema,
        preferred: fhirBooleanSchema.optional(),
      }),
    )
    .optional(),
  generalPractitioner: z.array(fhirReferenceSchema).optional(),
  managingOrganization: fhirReferenceSchema.optional(),
  link: z
    .array(
      z.object({
        other: fhirReferenceSchema,
        type: z.enum(['replaced-by', 'replaces', 'refer', 'seealso']),
      }),
    )
    .optional(),
})

export type Patient = z.infer<typeof patientSchema>

// ===========================================================================
// Practitioner (http://hl7.org/fhir/R4/practitioner.html)
// ===========================================================================

export const practitionerSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Practitioner'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  active: fhirBooleanSchema.optional(),
  name: z.array(fhirHumanNameSchema).optional(),
  telecom: z.array(fhirContactPointSchema).optional(),
  address: z.array(fhirAddressSchema).optional(),
  gender: fhirAdministrativeGenderSchema.optional(),
  birthDate: fhirDateSchema.optional(),
  photo: z
    .array(
      z.object({
        contentType: fhirCodeSchema.optional(),
        language: fhirCodeSchema.optional(),
        data: z.string().optional(),
        url: fhirUriSchema.optional(),
      }),
    )
    .optional(),
  qualification: z
    .array(
      z.object({
        identifier: z.array(fhirIdentifierSchema).optional(),
        code: fhirCodeableConceptSchema,
        period: fhirPeriodSchema.optional(),
        issuer: fhirReferenceSchema.optional(),
      }),
    )
    .optional(),
  communication: z.array(fhirCodeableConceptSchema).optional(),
})

export type Practitioner = z.infer<typeof practitionerSchema>

// ===========================================================================
// PractitionerRole (http://hl7.org/fhir/R4/practitionerrole.html)
// ===========================================================================

export const practitionerRoleSchema = fhirBaseSchema.extend({
  resourceType: z.literal('PractitionerRole'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  active: fhirBooleanSchema.optional(),
  period: fhirPeriodSchema.optional(),
  practitioner: fhirReferenceSchema.optional(),
  organization: fhirReferenceSchema.optional(),
  code: z.array(fhirCodeableConceptSchema).optional(),
  specialty: z.array(fhirCodeableConceptSchema).optional(),
  location: z.array(fhirReferenceSchema).optional(),
  healthcareService: z.array(fhirReferenceSchema).optional(),
  telecom: z.array(fhirContactPointSchema).optional(),
  availableTime: z
    .array(
      z.object({
        daysOfWeek: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional(),
        allDay: fhirBooleanSchema.optional(),
        availableStartTime: fhirTimeSchema.optional(),
        availableEndTime: fhirTimeSchema.optional(),
      }),
    )
    .optional(),
  notAvailable: z
    .array(
      z.object({
        description: fhirStringSchema,
        during: fhirPeriodSchema.optional(),
      }),
    )
    .optional(),
  availabilityExceptions: fhirStringSchema.optional(),
  endpoint: z.array(fhirReferenceSchema).optional(),
})

export type PractitionerRole = z.infer<typeof practitionerRoleSchema>

// ===========================================================================
// Organization (http://hl7.org/fhir/R4/organization.html)
// ===========================================================================

export const organizationSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Organization'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  active: fhirBooleanSchema.optional(),
  type: z.array(fhirCodeableConceptSchema).optional(),
  name: fhirStringSchema.optional(),
  alias: z.array(fhirStringSchema).optional(),
  telecom: z.array(fhirContactPointSchema).optional(),
  address: z.array(fhirAddressSchema).optional(),
  partOf: fhirReferenceSchema.optional(),
  contact: z
    .array(
      z.object({
        purpose: fhirCodeableConceptSchema.optional(),
        name: fhirHumanNameSchema.optional(),
        telecom: z.array(fhirContactPointSchema).optional(),
        address: fhirAddressSchema.optional(),
      }),
    )
    .optional(),
  endpoint: z.array(fhirReferenceSchema).optional(),
})

export type Organization = z.infer<typeof organizationSchema>

// ===========================================================================
// Encounter (http://hl7.org/fhir/R4/encounter.html)
// ===========================================================================

export const encounterStatusSchema = z.enum([
  'planned',
  'arrived',
  'triaged',
  'in-progress',
  'onleave',
  'finished',
  'cancelled',
  'entered-in-error',
  'unknown',
])

export const encounterClassSchema = z.enum([
  'ambulatory',
  'emergency',
  'field',
  'home',
  'inpatient',
  'virtual',
])

export const encounterSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Encounter'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: encounterStatusSchema,
  statusHistory: z
    .array(
      z.object({
        status: encounterStatusSchema,
        period: fhirPeriodSchema,
      }),
    )
    .optional(),
  class: fhirCodingSchema,
  classHistory: z
    .array(
      z.object({
        class: fhirCodingSchema,
        period: fhirPeriodSchema,
      }),
    )
    .optional(),
  type: z.array(fhirCodeableConceptSchema).optional(),
  serviceType: fhirCodeableConceptSchema.optional(),
  priority: fhirCodeableConceptSchema.optional(),
  subject: fhirReferenceSchema.optional(),
  episodeOfCare: z.array(fhirReferenceSchema).optional(),
  basedOn: z.array(fhirReferenceSchema).optional(),
  participant: z
    .array(
      z.object({
        type: z.array(fhirCodeableConceptSchema).optional(),
        period: fhirPeriodSchema.optional(),
        individual: fhirReferenceSchema.optional(),
      }),
    )
    .optional(),
  appointment: z.array(fhirReferenceSchema).optional(),
  reasonCode: z.array(fhirCodeableConceptSchema).optional(),
  reasonReference: z.array(fhirReferenceSchema).optional(),
  diagnosis: z
    .array(
      z.object({
        condition: fhirReferenceSchema,
        use: fhirCodeableConceptSchema.optional(),
        rank: z.number().int().positive().optional(),
      }),
    )
    .optional(),
  account: z.array(fhirReferenceSchema).optional(),
  hospitalization: z
    .object({
      preAdmissionIdentifier: fhirIdentifierSchema.optional(),
      origin: fhirReferenceSchema.optional(),
      admitSource: fhirCodeableConceptSchema.optional(),
      reAdmission: fhirCodeableConceptSchema.optional(),
      dietPreference: z.array(fhirCodeableConceptSchema).optional(),
      specialCourtesy: z.array(fhirCodeableConceptSchema).optional(),
      specialArrangement: z.array(fhirCodeableConceptSchema).optional(),
      destination: fhirReferenceSchema.optional(),
      dischargeDisposition: fhirCodeableConceptSchema.optional(),
    })
    .optional(),
  location: z
    .array(
      z.object({
        location: fhirReferenceSchema,
        status: z.enum(['planned', 'active', 'reserved', 'completed']).optional(),
        physicalType: fhirCodeableConceptSchema.optional(),
        period: fhirPeriodSchema.optional(),
      }),
    )
    .optional(),
  serviceProvider: fhirReferenceSchema.optional(),
  partOf: fhirReferenceSchema.optional(),
})

export type Encounter = z.infer<typeof encounterSchema>

// ===========================================================================
// Observation (http://hl7.org/fhir/R4/observation.html)
// ===========================================================================

export const observationStatusSchema = z.enum([
  'registered',
  'preliminary',
  'final',
  'amended',
  'corrected',
  'cancelled',
  'entered-in-error',
  'unknown',
])

/**
 * Observation.value[x] polymorphic union.
 * Per FHIR R4: exactly one of the value* fields MUST be present
 * (when Observation has a value). Each variant is an object with
 * a single value* key, making this a discriminated union on key presence.
 */
export const observationValueSchema = z.union([
  z.object({ valueQuantity: fhirQuantitySchema }),
  z.object({ valueCodeableConcept: fhirCodeableConceptSchema }),
  z.object({ valueString: fhirStringSchema }),
  z.object({ valueBoolean: fhirBooleanSchema }),
  z.object({ valueInteger: fhirIntegerSchema }),
  z.object({ valueRange: fhirRangeSchema }),
  z.object({ valueRatio: fhirRatioSchema }),
  z.object({ valueTime: fhirTimeSchema }),
  z.object({ valueDateTime: fhirDateTimeSchema }),
  z.object({ valuePeriod: fhirPeriodSchema }),
])

export type ObservationValue = z.infer<typeof observationValueSchema>

export const observationSchema = fhirBaseSchema
  .extend({
    resourceType: z.literal('Observation'),
    identifier: z.array(fhirIdentifierSchema).optional(),
    basedOn: z.array(fhirReferenceSchema).optional(),
    partOf: z.array(fhirReferenceSchema).optional(),
    status: observationStatusSchema,
    category: z.array(fhirCodeableConceptSchema).optional(),
    code: fhirCodeableConceptSchema,
    subject: fhirReferenceSchema.optional(),
    encounter: fhirReferenceSchema.optional(),
    effectiveDateTime: fhirDateTimeSchema.optional(),
    effectivePeriod: fhirPeriodSchema.optional(),
    effectiveTiming: z
      .object({
        event: z.array(fhirDateTimeSchema).optional(),
      })
      .optional(),
    effectiveInstant: fhirInstantSchema.optional(),
    issued: fhirInstantSchema.optional(),
    performer: z.array(fhirReferenceSchema).optional(),
    /** value[x] — polymorphic, exactly one value* field */
    valueQuantity: fhirQuantitySchema.optional(),
    valueCodeableConcept: fhirCodeableConceptSchema.optional(),
    valueString: fhirStringSchema.optional(),
    valueBoolean: fhirBooleanSchema.optional(),
    valueInteger: fhirIntegerSchema.optional(),
    valueRange: fhirRangeSchema.optional(),
    valueRatio: fhirRatioSchema.optional(),
    valueTime: fhirTimeSchema.optional(),
    valueDateTime: fhirDateTimeSchema.optional(),
    valuePeriod: fhirPeriodSchema.optional(),
    dataAbsentReason: fhirCodeableConceptSchema.optional(),
    interpretation: z.array(fhirCodeableConceptSchema).optional(),
    note: z
      .array(
        z.object({
          authorString: fhirStringSchema.optional(),
          authorReference: fhirReferenceSchema.optional(),
          time: fhirDateTimeSchema.optional(),
          text: fhirStringSchema,
        }),
      )
      .optional(),
    bodySite: fhirCodeableConceptSchema.optional(),
    method: fhirCodeableConceptSchema.optional(),
    specimen: fhirReferenceSchema.optional(),
    device: fhirReferenceSchema.optional(),
    referenceRange: z
      .array(
        z.object({
          low: fhirQuantitySchema.optional(),
          high: fhirQuantitySchema.optional(),
          type: fhirCodeableConceptSchema.optional(),
          appliesTo: z.array(fhirCodeableConceptSchema).optional(),
          age: fhirRangeSchema.optional(),
          text: fhirStringSchema.optional(),
        }),
      )
      .optional(),
    hasMember: z.array(fhirReferenceSchema).optional(),
    derivedFrom: z.array(fhirReferenceSchema).optional(),
    component: z
      .array(
        z.object({
          code: fhirCodeableConceptSchema,
          valueQuantity: fhirQuantitySchema.optional(),
          valueCodeableConcept: fhirCodeableConceptSchema.optional(),
          valueString: fhirStringSchema.optional(),
          valueBoolean: fhirBooleanSchema.optional(),
          valueInteger: fhirIntegerSchema.optional(),
          valueRange: fhirRangeSchema.optional(),
          valueRatio: fhirRatioSchema.optional(),
          valueTime: fhirTimeSchema.optional(),
          valueDateTime: fhirDateTimeSchema.optional(),
          valuePeriod: fhirPeriodSchema.optional(),
          dataAbsentReason: fhirCodeableConceptSchema.optional(),
          interpretation: z.array(fhirCodeableConceptSchema).optional(),
          referenceRange: z
            .array(
              z.object({
                low: fhirQuantitySchema.optional(),
                high: fhirQuantitySchema.optional(),
                type: fhirCodeableConceptSchema.optional(),
                appliesTo: z.array(fhirCodeableConceptSchema).optional(),
                age: fhirRangeSchema.optional(),
                text: fhirStringSchema.optional(),
              }),
            )
            .optional(),
        }),
      )
      .optional(),
  })
  .refine(
    (data) => {
      const valueKeys = [
        'valueQuantity',
        'valueCodeableConcept',
        'valueString',
        'valueBoolean',
        'valueInteger',
        'valueRange',
        'valueRatio',
        'valueTime',
        'valueDateTime',
        'valuePeriod',
      ]
      const count = valueKeys.filter((k) => data[k as keyof typeof data] !== undefined).length
      return count <= 1
    },
    { message: 'At most one value[x] field must be present on Observation' },
  )

export type Observation = z.infer<typeof observationSchema>

// ===========================================================================
// Condition (http://hl7.org/fhir/R4/condition.html)
// ===========================================================================

export const conditionClinicalStatusSchema = z.enum([
  'active',
  'recurrence',
  'relapse',
  'inactive',
  'remission',
  'resolved',
])

export const conditionVerificationStatusSchema = z.enum([
  'unconfirmed',
  'provisional',
  'differential',
  'confirmed',
  'refuted',
  'entered-in-error',
])

export const conditionSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Condition'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  clinicalStatus: fhirCodeableConceptSchema.optional(),
  verificationStatus: fhirCodeableConceptSchema.optional(),
  category: z.array(fhirCodeableConceptSchema).optional(),
  severity: fhirCodeableConceptSchema.optional(),
  code: fhirCodeableConceptSchema.optional(),
  bodySite: z.array(fhirCodeableConceptSchema).optional(),
  subject: fhirReferenceSchema,
  encounter: fhirReferenceSchema.optional(),
  onsetDateTime: fhirDateTimeSchema.optional(),
  onsetAge: z
    .object({
      value: z.number().optional(),
      comparator: z.enum(['<', '<=', '>=', '>']).optional(),
      unit: fhirStringSchema.optional(),
      system: fhirUriSchema.optional(),
      code: fhirCodeSchema.optional(),
    })
    .optional(),
  onsetPeriod: fhirPeriodSchema.optional(),
  onsetRange: fhirRangeSchema.optional(),
  onsetString: fhirStringSchema.optional(),
  abatementDateTime: fhirDateTimeSchema.optional(),
  abatementAge: z
    .object({
      value: z.number().optional(),
      comparator: z.enum(['<', '<=', '>=', '>']).optional(),
      unit: fhirStringSchema.optional(),
      system: fhirUriSchema.optional(),
      code: fhirCodeSchema.optional(),
    })
    .optional(),
  abatementPeriod: fhirPeriodSchema.optional(),
  abatementRange: fhirRangeSchema.optional(),
  abatementString: fhirStringSchema.optional(),
  recordedDate: fhirDateTimeSchema.optional(),
  recorder: fhirReferenceSchema.optional(),
  asserter: fhirReferenceSchema.optional(),
  stage: z
    .array(
      z.object({
        summary: fhirCodeableConceptSchema.optional(),
        assessment: z.array(fhirCodeableConceptSchema).optional(),
        type: fhirCodeableConceptSchema.optional(),
      }),
    )
    .optional(),
  evidence: z
    .array(
      z.object({
        code: z.array(fhirCodeableConceptSchema).optional(),
        detail: z.array(fhirReferenceSchema).optional(),
      }),
    )
    .optional(),
  note: z
    .array(
      z.object({
        authorString: fhirStringSchema.optional(),
        authorReference: fhirReferenceSchema.optional(),
        time: fhirDateTimeSchema.optional(),
        text: fhirStringSchema,
      }),
    )
    .optional(),
})

export type Condition = z.infer<typeof conditionSchema>

// ===========================================================================
// AllergyIntolerance (http://hl7.org/fhir/R4/allergyintolerance.html)
// ===========================================================================

export const allergyIntoleranceTypeSchema = z.enum([
  'allergy',
  'intolerance',
])

export const allergyIntoleranceCategorySchema = z.enum([
  'food',
  'medication',
  'environment',
  'biologic',
])

export const allergyIntoleranceCriticalitySchema = z.enum([
  'low',
  'high',
  'unable-to-assess',
])

export const allergyIntoleranceSchema = fhirBaseSchema.extend({
  resourceType: z.literal('AllergyIntolerance'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  clinicalStatus: fhirCodeableConceptSchema.optional(),
  verificationStatus: fhirCodeableConceptSchema.optional(),
  type: allergyIntoleranceTypeSchema.optional(),
  category: z.array(allergyIntoleranceCategorySchema).optional(),
  criticality: allergyIntoleranceCriticalitySchema.optional(),
  code: fhirCodeableConceptSchema.optional(),
  patient: fhirReferenceSchema,
  encounter: fhirReferenceSchema.optional(),
  onsetDateTime: fhirDateTimeSchema.optional(),
  onsetAge: z
    .object({
      value: z.number().optional(),
      comparator: z.enum(['<', '<=', '>=', '>']).optional(),
      unit: fhirStringSchema.optional(),
      system: fhirUriSchema.optional(),
      code: fhirCodeSchema.optional(),
    })
    .optional(),
  onsetPeriod: fhirPeriodSchema.optional(),
  onsetRange: fhirRangeSchema.optional(),
  onsetString: fhirStringSchema.optional(),
  recordedDate: fhirDateTimeSchema.optional(),
  recorder: fhirReferenceSchema.optional(),
  asserter: fhirReferenceSchema.optional(),
  lastOccurrence: fhirDateTimeSchema.optional(),
  note: z
    .array(
      z.object({
        authorString: fhirStringSchema.optional(),
        authorReference: fhirReferenceSchema.optional(),
        time: fhirDateTimeSchema.optional(),
        text: fhirStringSchema,
      }),
    )
    .optional(),
  reaction: z
    .array(
      z.object({
        substance: fhirCodeableConceptSchema.optional(),
        manifestation: z.array(fhirCodeableConceptSchema).optional(),
        onset: fhirDateTimeSchema.optional(),
        severity: z.enum(['mild', 'moderate', 'severe']).optional(),
        exposureRoute: fhirCodeableConceptSchema.optional(),
        note: z
          .array(
            z.object({
              authorString: fhirStringSchema.optional(),
              authorReference: fhirReferenceSchema.optional(),
              time: fhirDateTimeSchema.optional(),
              text: fhirStringSchema,
            }),
          )
          .optional(),
      }),
    )
    .optional(),
})

export type AllergyIntolerance = z.infer<typeof allergyIntoleranceSchema>

// ===========================================================================
// Medication (http://hl7.org/fhir/R4/medication.html)
// ===========================================================================

export const medicationStatusSchema = z.enum([
  'active',
  'inactive',
  'entered-in-error',
])

export const medicationSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Medication'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  code: fhirCodeableConceptSchema.optional(),
  status: medicationStatusSchema.optional(),
  manufacturer: fhirReferenceSchema.optional(),
  form: fhirCodeableConceptSchema.optional(),
  amount: z
    .object({
      numerator: fhirQuantitySchema.optional(),
      denominator: fhirQuantitySchema.optional(),
    })
    .optional(),
  ingredient: z
    .array(
      z.object({
        itemCodeableConcept: fhirCodeableConceptSchema.optional(),
        itemReference: fhirReferenceSchema.optional(),
        isActive: fhirBooleanSchema.optional(),
        strengthRatio: fhirRatioSchema.optional(),
        strengthQuantity: fhirQuantitySchema.optional(),
      }),
    )
    .optional(),
  batch: z
    .object({
      lotNumber: fhirStringSchema.optional(),
      expirationDate: fhirDateTimeSchema.optional(),
    })
    .optional(),
})

export type Medication = z.infer<typeof medicationSchema>

// ===========================================================================
// MedicationRequest (http://hl7.org/fhir/R4/medicationrequest.html)
// ===========================================================================

export const medicationRequestStatusSchema = z.enum([
  'active',
  'on-hold',
  'cancelled',
  'completed',
  'entered-in-error',
  'stopped',
  'draft',
  'unknown',
])

export const medicationRequestIntentSchema = z.enum([
  'proposal',
  'plan',
  'order',
  'original-order',
  'reflex-order',
  'filler-order',
  'instance-order',
  'option',
])

export const medicationRequestSchema = fhirBaseSchema.extend({
  resourceType: z.literal('MedicationRequest'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: medicationRequestStatusSchema,
  statusReason: fhirCodeableConceptSchema.optional(),
  intent: medicationRequestIntentSchema,
  category: z.array(fhirCodeableConceptSchema).optional(),
  priority: z.enum(['routine', 'urgent', 'asap', 'stat']).optional(),
  doNotPerform: fhirBooleanSchema.optional(),
  reportedBoolean: fhirBooleanSchema.optional(),
  reportedReference: fhirReferenceSchema.optional(),
  medicationCodeableConcept: fhirCodeableConceptSchema.optional(),
  medicationReference: fhirReferenceSchema.optional(),
  subject: fhirReferenceSchema,
  encounter: fhirReferenceSchema.optional(),
  supportingInformation: z.array(fhirReferenceSchema).optional(),
  authoredOn: fhirDateTimeSchema.optional(),
  requester: fhirReferenceSchema.optional(),
  performer: fhirReferenceSchema.optional(),
  performerType: fhirCodeableConceptSchema.optional(),
  recorder: fhirReferenceSchema.optional(),
  reasonCode: z.array(fhirCodeableConceptSchema).optional(),
  reasonReference: z.array(fhirReferenceSchema).optional(),
  instantiatesCanonical: z.array(fhirUriSchema).optional(),
  instantiatesUri: z.array(fhirUriSchema).optional(),
  basedOn: z.array(fhirReferenceSchema).optional(),
  groupIdentifier: fhirIdentifierSchema.optional(),
  courseOfTherapyType: fhirCodeableConceptSchema.optional(),
  insurance: z.array(fhirReferenceSchema).optional(),
  note: z
    .array(
      z.object({
        authorString: fhirStringSchema.optional(),
        authorReference: fhirReferenceSchema.optional(),
        time: fhirDateTimeSchema.optional(),
        text: fhirStringSchema,
      }),
    )
    .optional(),
  dosageInstruction: z
    .array(
      z.object({
        sequence: fhirIntegerSchema.optional(),
        text: fhirStringSchema.optional(),
        additionalInstruction: z.array(fhirCodeableConceptSchema).optional(),
        patientInstruction: fhirStringSchema.optional(),
        timing: z
          .object({
            event: z.array(fhirDateTimeSchema).optional(),
            repeat: z
              .object({
                boundsPeriod: fhirPeriodSchema.optional(),
                boundsRange: fhirRangeSchema.optional(),
                count: fhirPositiveIntSchema.optional(),
                countMax: z.number().int().positive().optional(),
                duration: z.number().optional(),
                durationMax: z.number().optional(),
                durationUnit: z.enum(['s', 'min', 'h', 'd', 'wk', 'mo', 'a']).optional(),
                frequency: z.number().int().positive().optional(),
                frequencyMax: z.number().int().positive().optional(),
                period: z.number().optional(),
                periodMax: z.number().optional(),
                periodUnit: z.enum(['s', 'min', 'h', 'd', 'wk', 'mo', 'a']).optional(),
                dayOfWeek: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional(),
                timeOfDay: z.array(fhirTimeSchema).optional(),
                when: z.array(fhirCodeSchema).optional(),
                offset: fhirIntegerSchema.optional(),
              })
              .optional(),
            code: fhirCodeableConceptSchema.optional(),
          })
          .optional(),
        asNeededBoolean: fhirBooleanSchema.optional(),
        asNeededCodeableConcept: fhirCodeableConceptSchema.optional(),
        site: fhirCodeableConceptSchema.optional(),
        route: fhirCodeableConceptSchema.optional(),
        method: fhirCodeableConceptSchema.optional(),
        doseAndRate: z
          .array(
            z.object({
              type: fhirCodeableConceptSchema.optional(),
              doseQuantity: fhirQuantitySchema.optional(),
              rateQuantity: fhirQuantitySchema.optional(),
              rateRatio: fhirRatioSchema.optional(),
            }),
          )
          .optional(),
        maxDosePerPeriod: fhirRatioSchema.optional(),
        maxDosePerAdministration: fhirQuantitySchema.optional(),
        maxDosePerLifetime: fhirQuantitySchema.optional(),
      }),
    )
    .optional(),
  dispenseRequest: z
    .object({
      initialFill: z
        .object({
          quantity: fhirQuantitySchema.optional(),
          duration: z
            .object({
              value: z.number().optional(),
              unit: fhirStringSchema.optional(),
              system: fhirUriSchema.optional(),
              code: fhirCodeSchema.optional(),
            })
            .optional(),
        })
        .optional(),
      dispenseInterval: z
        .object({
          value: z.number().optional(),
          unit: fhirStringSchema.optional(),
          system: fhirUriSchema.optional(),
          code: fhirCodeSchema.optional(),
        })
        .optional(),
      validityPeriod: fhirPeriodSchema.optional(),
      numberOfRepeatsAllowed: z.number().int().nonnegative().optional(),
      quantity: fhirQuantitySchema.optional(),
      expectedSupplyDuration: z
        .object({
          value: z.number().optional(),
          unit: fhirStringSchema.optional(),
          system: fhirUriSchema.optional(),
          code: fhirCodeSchema.optional(),
        })
        .optional(),
      performer: fhirReferenceSchema.optional(),
    })
    .optional(),
  substitution: z
    .object({
      allowedBoolean: fhirBooleanSchema.optional(),
      allowedCodeableConcept: fhirCodeableConceptSchema.optional(),
      reason: fhirCodeableConceptSchema.optional(),
    })
    .optional(),
  priorPrescription: fhirReferenceSchema.optional(),
  detectedIssue: z.array(fhirReferenceSchema).optional(),
  eventHistory: z.array(fhirReferenceSchema).optional(),
})

export type MedicationRequest = z.infer<typeof medicationRequestSchema>

// ===========================================================================
// Immunization (http://hl7.org/fhir/R4/immunization.html)
// ===========================================================================

export const immunizationStatusSchema = z.enum([
  'completed',
  'entered-in-error',
  'not-done',
])

export const immunizationSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Immunization'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  status: immunizationStatusSchema,
  statusReason: fhirCodeableConceptSchema.optional(),
  vaccineCode: fhirCodeableConceptSchema,
  patient: fhirReferenceSchema,
  encounter: fhirReferenceSchema.optional(),
  occurrenceDateTime: fhirDateTimeSchema.optional(),
  occurrenceString: fhirStringSchema.optional(),
  recorded: fhirDateTimeSchema.optional(),
  primarySource: fhirBooleanSchema.optional(),
  reportOrigin: fhirCodeableConceptSchema.optional(),
  location: fhirReferenceSchema.optional(),
  manufacturer: fhirReferenceSchema.optional(),
  lotNumber: fhirStringSchema.optional(),
  expirationDate: fhirDateSchema.optional(),
  site: fhirCodeableConceptSchema.optional(),
  route: fhirCodeableConceptSchema.optional(),
  doseQuantity: fhirQuantitySchema.optional(),
  performer: z
    .array(
      z.object({
        function: fhirCodeableConceptSchema.optional(),
        actor: fhirReferenceSchema,
      }),
    )
    .optional(),
  note: z
    .array(
      z.object({
        authorString: fhirStringSchema.optional(),
        authorReference: fhirReferenceSchema.optional(),
        time: fhirDateTimeSchema.optional(),
        text: fhirStringSchema,
      }),
    )
    .optional(),
  education: z
    .array(
      z.object({
        documentType: fhirStringSchema.optional(),
        reference: fhirUriSchema.optional(),
        publicationDate: fhirDateTimeSchema.optional(),
        presentationDate: fhirDateTimeSchema.optional(),
      }),
    )
    .optional(),
  programEligibility: z.array(fhirCodeableConceptSchema).optional(),
  fundingSource: fhirCodeableConceptSchema.optional(),
  reaction: z
    .array(
      z.object({
        date: fhirDateTimeSchema.optional(),
        detail: fhirReferenceSchema.optional(),
        reported: fhirBooleanSchema.optional(),
      }),
    )
    .optional(),
  protocolApplied: z
    .array(
      z.object({
        series: fhirStringSchema.optional(),
        authority: fhirReferenceSchema.optional(),
        targetDisease: z.array(fhirCodeableConceptSchema).optional(),
        doseNumberPositiveInt: z.number().int().positive().optional(),
        doseNumberString: fhirStringSchema.optional(),
        seriesDosesPositiveInt: z.number().int().positive().optional(),
        seriesDosesString: fhirStringSchema.optional(),
      }),
    )
    .optional(),
})

export type Immunization = z.infer<typeof immunizationSchema>

// ===========================================================================
// Procedure (http://hl7.org/fhir/R4/procedure.html)
// ===========================================================================

export const procedureStatusSchema = z.enum([
  'preparation',
  'in-progress',
  'not-done',
  'on-hold',
  'stopped',
  'completed',
  'entered-in-error',
  'unknown',
])

export const procedureSchema = fhirBaseSchema.extend({
  resourceType: z.literal('Procedure'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  instantiatesCanonical: z.array(fhirUriSchema).optional(),
  instantiatesUri: z.array(fhirUriSchema).optional(),
  basedOn: z.array(fhirReferenceSchema).optional(),
  partOf: z.array(fhirReferenceSchema).optional(),
  status: procedureStatusSchema,
  statusReason: fhirCodeableConceptSchema.optional(),
  category: fhirCodeableConceptSchema.optional(),
  code: fhirCodeableConceptSchema.optional(),
  subject: fhirReferenceSchema,
  encounter: fhirReferenceSchema.optional(),
  recorder: fhirReferenceSchema.optional(),
  asserter: fhirReferenceSchema.optional(),
  performer: z
    .array(
      z.object({
        function: fhirCodeableConceptSchema.optional(),
        actor: fhirReferenceSchema,
        onBehalfOf: fhirReferenceSchema.optional(),
      }),
    )
    .optional(),
  location: fhirReferenceSchema.optional(),
  reasonCode: z.array(fhirCodeableConceptSchema).optional(),
  reasonReference: z.array(fhirReferenceSchema).optional(),
  bodySite: z.array(fhirCodeableConceptSchema).optional(),
  outcome: fhirCodeableConceptSchema.optional(),
  report: z.array(fhirReferenceSchema).optional(),
  complication: z.array(fhirCodeableConceptSchema).optional(),
  complicationDetail: z.array(fhirReferenceSchema).optional(),
  followUp: z.array(fhirCodeableConceptSchema).optional(),
  note: z
    .array(
      z.object({
        authorString: fhirStringSchema.optional(),
        authorReference: fhirReferenceSchema.optional(),
        time: fhirDateTimeSchema.optional(),
        text: fhirStringSchema,
      }),
    )
    .optional(),
  focalDevice: z
    .array(
      z.object({
        action: fhirCodeableConceptSchema.optional(),
        manipulated: fhirReferenceSchema,
      }),
    )
    .optional(),
  usedReference: z.array(fhirReferenceSchema).optional(),
  usedCode: z.array(fhirCodeableConceptSchema).optional(),
})

export type Procedure = z.infer<typeof procedureSchema>

// ===========================================================================
// DiagnosticReport (http://hl7.org/fhir/R4/diagnosticreport.html)
// ===========================================================================

export const diagnosticReportStatusSchema = z.enum([
  'registered',
  'partial',
  'preliminary',
  'final',
  'amended',
  'corrected',
  'appended',
  'cancelled',
  'entered-in-error',
  'unknown',
])

export const diagnosticReportSchema = fhirBaseSchema.extend({
  resourceType: z.literal('DiagnosticReport'),
  identifier: z.array(fhirIdentifierSchema).optional(),
  basedOn: z.array(fhirReferenceSchema).optional(),
  status: diagnosticReportStatusSchema,
  category: z.array(fhirCodeableConceptSchema).optional(),
  code: fhirCodeableConceptSchema,
  subject: fhirReferenceSchema.optional(),
  encounter: fhirReferenceSchema.optional(),
  effectiveDateTime: fhirDateTimeSchema.optional(),
  effectivePeriod: fhirPeriodSchema.optional(),
  issued: fhirInstantSchema.optional(),
  performer: z
    .array(
      z.object({
        actor: fhirReferenceSchema,
        role: fhirCodeableConceptSchema.optional(),
      }),
    )
    .optional(),
  resultsInterpreter: z.array(fhirReferenceSchema).optional(),
  specimen: z.array(fhirReferenceSchema).optional(),
  result: z.array(fhirReferenceSchema).optional(),
  imagingStudy: z.array(fhirReferenceSchema).optional(),
  media: z
    .array(
      z.object({
        comment: fhirStringSchema.optional(),
        link: fhirReferenceSchema,
      }),
    )
    .optional(),
  conclusion: fhirStringSchema.optional(),
  conclusionCode: z.array(fhirCodeableConceptSchema).optional(),
  presentedForm: z
    .array(
      z.object({
        contentType: fhirCodeSchema.optional(),
        language: fhirCodeSchema.optional(),
        data: z.string().optional(),
        url: fhirUriSchema.optional(),
        title: fhirStringSchema.optional(),
        creation: fhirDateTimeSchema.optional(),
      }),
    )
    .optional(),
})

export type DiagnosticReport = z.infer<typeof diagnosticReportSchema>
