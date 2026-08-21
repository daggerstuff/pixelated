import { describe, it, expect } from 'vitest'
import {
  // Base type schemas
  humanNameSchema,
  addressSchema,
  codingSchema,
  codeableConceptSchema,
  referenceSchema,
  // Resource schemas
  patientSchema,
  practitionerSchema,
  practitionerRoleSchema,
  encounterSchema,
  appointmentSchema,
  documentReferenceSchema,
  observationSchema,
  consentSchema,
  claimSchema,
  serviceRequestSchema,
  conditionSchema,
  allergyIntoleranceSchema,
  medicationRequestSchema,
  // Discriminated union + helpers
  ehrResourceSchema,
  validateEHRResource,
  safeValidateEHRResource,
} from '../index'

// ---------------------------------------------------------------------------
// Base FHIR R4 type schemas
// ---------------------------------------------------------------------------

describe('humanNameSchema', () => {
  it('parses a valid HumanName', () => {
    const valid = { family: 'Smith', given: ['John'] }
    expect(humanNameSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse on invalid use enum', () => {
    const result = humanNameSchema.safeParse({ use: 'invalid-use' })
    expect(result.success).toBe(false)
  })
})

describe('addressSchema', () => {
  it('parses a valid Address', () => {
    const valid = { line: ['123 Main St'], city: 'Springfield' }
    expect(addressSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse on invalid use enum', () => {
    const result = addressSchema.safeParse({ use: 'invalid-use' })
    expect(result.success).toBe(false)
  })
})

describe('codingSchema', () => {
  it('parses a valid Coding', () => {
    const valid = { system: 'http://example.com', code: 'active' }
    expect(codingSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse on wrong type for userSelected', () => {
    const result = codingSchema.safeParse({ userSelected: 'yes' })
    expect(result.success).toBe(false)
  })
})

describe('codeableConceptSchema', () => {
  it('parses a valid CodeableConcept', () => {
    const valid = { text: 'Some concept', coding: [{ code: 'active' }] }
    expect(codeableConceptSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse when coding is not an array', () => {
    const result = codeableConceptSchema.safeParse({ coding: 'not-an-array' })
    expect(result.success).toBe(false)
  })
})

describe('referenceSchema', () => {
  it('parses a valid Reference', () => {
    const valid = { reference: 'Patient/123' }
    expect(referenceSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse when reference is not a string', () => {
    const result = referenceSchema.safeParse({ reference: 123 })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Resource schemas (13 total)
// ---------------------------------------------------------------------------

describe('patientSchema', () => {
  it('parses a valid Patient', () => {
    const valid = { resourceType: 'Patient' }
    expect(patientSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse when resourceType is missing', () => {
    const result = patientSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('practitionerSchema', () => {
  it('parses a valid Practitioner', () => {
    const valid = { resourceType: 'Practitioner' }
    expect(practitionerSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse when resourceType is missing', () => {
    const result = practitionerSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('practitionerRoleSchema', () => {
  it('parses a valid PractitionerRole', () => {
    const valid = { resourceType: 'PractitionerRole' }
    expect(practitionerRoleSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse when resourceType is missing', () => {
    const result = practitionerRoleSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('encounterSchema', () => {
  it('parses a valid Encounter', () => {
    const valid = {
      resourceType: 'Encounter',
      status: 'finished',
      class: { code: 'AMB' },
    }
    expect(encounterSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse when required status is missing', () => {
    const result = encounterSchema.safeParse({ resourceType: 'Encounter' })
    expect(result.success).toBe(false)
  })
})

describe('appointmentSchema', () => {
  it('parses a valid Appointment', () => {
    const valid = {
      resourceType: 'Appointment',
      status: 'booked',
      participant: [{ status: 'accepted' }],
    }
    expect(appointmentSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse when required status is missing', () => {
    const result = appointmentSchema.safeParse({ resourceType: 'Appointment' })
    expect(result.success).toBe(false)
  })
})

describe('documentReferenceSchema', () => {
  it('parses a valid DocumentReference', () => {
    const valid = {
      resourceType: 'DocumentReference',
      status: 'current',
      content: [{ attachment: {} }],
    }
    expect(documentReferenceSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse when required status is missing', () => {
    const result = documentReferenceSchema.safeParse({
      resourceType: 'DocumentReference',
    })
    expect(result.success).toBe(false)
  })
})

describe('observationSchema', () => {
  it('parses a valid Observation', () => {
    const valid = {
      resourceType: 'Observation',
      status: 'final',
      code: {},
    }
    expect(observationSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse when required status is missing', () => {
    const result = observationSchema.safeParse({ resourceType: 'Observation' })
    expect(result.success).toBe(false)
  })
})

describe('consentSchema', () => {
  it('parses a valid Consent', () => {
    const valid = {
      resourceType: 'Consent',
      status: 'active',
      scope: {},
      category: [],
    }
    expect(consentSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse when required status is missing', () => {
    const result = consentSchema.safeParse({ resourceType: 'Consent' })
    expect(result.success).toBe(false)
  })
})

describe('claimSchema', () => {
  it('parses a valid Claim', () => {
    const valid = {
      resourceType: 'Claim',
      status: 'active',
      type: {},
      use: 'claim',
      patient: {},
      provider: {},
    }
    expect(claimSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse when required patient is missing', () => {
    const result = claimSchema.safeParse({
      resourceType: 'Claim',
      status: 'active',
      type: {},
      use: 'claim',
    })
    expect(result.success).toBe(false)
  })
})

describe('serviceRequestSchema', () => {
  it('parses a valid ServiceRequest', () => {
    const valid = {
      resourceType: 'ServiceRequest',
      status: 'active',
      intent: 'order',
      subject: {},
    }
    expect(serviceRequestSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse when required subject is missing', () => {
    const result = serviceRequestSchema.safeParse({
      resourceType: 'ServiceRequest',
      status: 'active',
      intent: 'order',
    })
    expect(result.success).toBe(false)
  })
})

describe('conditionSchema', () => {
  it('parses a valid Condition', () => {
    const valid = {
      resourceType: 'Condition',
      subject: {},
    }
    expect(conditionSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse when required subject is missing', () => {
    const result = conditionSchema.safeParse({ resourceType: 'Condition' })
    expect(result.success).toBe(false)
  })
})

describe('allergyIntoleranceSchema', () => {
  it('parses a valid AllergyIntolerance', () => {
    const valid = {
      resourceType: 'AllergyIntolerance',
      patient: {},
    }
    expect(allergyIntoleranceSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse when required patient is missing', () => {
    const result = allergyIntoleranceSchema.safeParse({
      resourceType: 'AllergyIntolerance',
    })
    expect(result.success).toBe(false)
  })
})

describe('medicationRequestSchema', () => {
  it('parses a valid MedicationRequest', () => {
    const valid = {
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      subject: {},
    }
    expect(medicationRequestSchema.parse(valid)).toEqual(valid)
  })

  it('fails safeParse when required subject is missing', () => {
    const result = medicationRequestSchema.safeParse({
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Discriminated union: ehrResourceSchema
// ---------------------------------------------------------------------------

describe('ehrResourceSchema (discriminated union)', () => {
  it('parses a valid Patient resource', () => {
    const result = ehrResourceSchema.safeParse({ resourceType: 'Patient' })
    expect(result.success).toBe(true)
  })

  it('parses a valid Observation resource', () => {
    const result = ehrResourceSchema.safeParse({
      resourceType: 'Observation',
      status: 'final',
      code: {},
    })
    expect(result.success).toBe(true)
  })

  it('fails safeParse on unknown resourceType discriminator', () => {
    const result = ehrResourceSchema.safeParse({ resourceType: 'UnknownType' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// validateEHRResource / safeValidateEHRResource
// ---------------------------------------------------------------------------

describe('validateEHRResource', () => {
  it('throws on invalid input', () => {
    expect(() => validateEHRResource({ resourceType: 'Unknown' })).toThrow()
  })

  it('returns parsed resource on valid input', () => {
    const result = validateEHRResource({ resourceType: 'Patient' })
    expect(result.resourceType).toBe('Patient')
  })
})

describe('safeValidateEHRResource', () => {
  it('returns { success: false } on invalid input', () => {
    const result = safeValidateEHRResource({ resourceType: 'Unknown' })
    expect(result.success).toBe(false)
  })

  it('returns { success: true, data } on valid input', () => {
    const result = safeValidateEHRResource({ resourceType: 'Patient' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.resourceType).toBe('Patient')
    }
  })
})
