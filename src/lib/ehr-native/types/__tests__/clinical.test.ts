import { describe, it, expect } from 'vitest'
import {
  patientSchema,
  practitionerSchema,
  practitionerRoleSchema,
  organizationSchema,
  encounterSchema,
  observationSchema,
  observationValueSchema,
  conditionSchema,
  allergyIntoleranceSchema,
  medicationSchema,
  medicationRequestSchema,
  immunizationSchema,
  procedureSchema,
  diagnosticReportSchema,
} from '../index.js'

// ---------------------------------------------------------------------------
// Patient
// ---------------------------------------------------------------------------

describe('patientSchema', () => {
  it('validates a minimal patient with only resourceType', () => {
    const result = patientSchema.parse({ resourceType: 'Patient' })
    expect(result.resourceType).toBe('Patient')
  })
  it('validates a complete patient resource', () => {
    const result = patientSchema.parse({
      resourceType: 'Patient',
      id: 'patient-1',
      identifier: [{ value: 'MRN-123' }],
      active: true,
      name: [{ family: 'Doe', given: ['John'] }],
      telecom: [{ system: 'phone', value: '555-1234' }],
      gender: 'male',
      birthDate: '1990-01-01',
      address: [{ city: 'Anytown', state: 'CA' }],
      maritalStatus: { text: 'Married' },
    })
    expect(result.gender).toBe('male')
  })
  it('rejects wrong resourceType', () => {
    expect(
      patientSchema.safeParse({ resourceType: 'Practitioner' }).success,
    ).toBe(false)
  })
  it('rejects missing resourceType', () => {
    expect(patientSchema.safeParse({}).success).toBe(false)
  })
  it('rejects invalid gender enum', () => {
    expect(
      patientSchema.safeParse({ resourceType: 'Patient', gender: 'invalid' })
        .success,
    ).toBe(false)
  })
  it('validates all gender enum values', () => {
    for (const gender of ['male', 'female', 'other', 'unknown']) {
      expect(
        patientSchema.safeParse({ resourceType: 'Patient', gender }).success,
      ).toBe(true)
    }
  })
  it('rejects invalid birthDate format', () => {
    expect(
      patientSchema.safeParse({ resourceType: 'Patient', birthDate: '01/01/1990' })
        .success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Practitioner
// ---------------------------------------------------------------------------

describe('practitionerSchema', () => {
  it('validates a minimal practitioner', () => {
    const result = practitionerSchema.parse({ resourceType: 'Practitioner' })
    expect(result.resourceType).toBe('Practitioner')
  })
  it('validates a complete practitioner resource', () => {
    const result = practitionerSchema.parse({
      resourceType: 'Practitioner',
      id: 'practitioner-1',
      identifier: [{ value: 'NPI-123' }],
      active: true,
      name: [{ family: 'Smith', given: ['Jane'] }],
      telecom: [{ system: 'email', value: 'jane@example.com' }],
      gender: 'female',
      birthDate: '1980-05-15',
      qualification: [{ code: { text: 'MD' } }],
    })
    expect(result.qualification?.[0]?.code?.text).toBe('MD')
  })
  it('rejects wrong resourceType', () => {
    expect(
      practitionerSchema.safeParse({ resourceType: 'Patient' }).success,
    ).toBe(false)
  })
  it('rejects missing resourceType', () => {
    expect(practitionerSchema.safeParse({}).success).toBe(false)
  })
  it('rejects invalid gender enum', () => {
    expect(
      practitionerSchema.safeParse({
        resourceType: 'Practitioner',
        gender: 'invalid',
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// PractitionerRole
// ---------------------------------------------------------------------------

describe('practitionerRoleSchema', () => {
  it('validates a minimal practitionerRole', () => {
    const result = practitionerRoleSchema.parse({
      resourceType: 'PractitionerRole',
    })
    expect(result.resourceType).toBe('PractitionerRole')
  })
  it('validates a complete practitionerRole resource', () => {
    const result = practitionerRoleSchema.parse({
      resourceType: 'PractitionerRole',
      id: 'role-1',
      active: true,
      practitioner: { reference: 'Practitioner/123' },
      organization: { reference: 'Organization/456' },
      code: [{ text: 'Doctor' }],
      specialty: [{ text: 'Cardiology' }],
      telecom: [{ system: 'phone', value: '555-1234' }],
    })
    expect(result.active).toBe(true)
  })
  it('rejects wrong resourceType', () => {
    expect(
      practitionerRoleSchema.safeParse({ resourceType: 'Patient' }).success,
    ).toBe(false)
  })
  it('rejects missing resourceType', () => {
    expect(practitionerRoleSchema.safeParse({}).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

describe('organizationSchema', () => {
  it('validates a minimal organization', () => {
    const result = organizationSchema.parse({
      resourceType: 'Organization',
    })
    expect(result.resourceType).toBe('Organization')
  })
  it('validates a complete organization resource', () => {
    const result = organizationSchema.parse({
      resourceType: 'Organization',
      id: 'org-1',
      identifier: [{ value: 'TAX-123' }],
      active: true,
      type: [{ text: 'Hospital' }],
      name: 'General Hospital',
      alias: ['GH'],
      telecom: [{ system: 'phone', value: '555-1234' }],
      address: [{ city: 'Anytown' }],
      partOf: { reference: 'Organization/parent' },
    })
    expect(result.name).toBe('General Hospital')
  })
  it('rejects wrong resourceType', () => {
    expect(
      organizationSchema.safeParse({ resourceType: 'Patient' }).success,
    ).toBe(false)
  })
  it('rejects missing resourceType', () => {
    expect(organizationSchema.safeParse({}).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Encounter
// ---------------------------------------------------------------------------

describe('encounterSchema', () => {
  it('validates a minimal encounter with status and class', () => {
    const result = encounterSchema.parse({
      resourceType: 'Encounter',
      status: 'in-progress',
      class: { code: 'AMB', system: 'http://hl7.org/fhir/v3/ActCode' },
    })
    expect(result.status).toBe('in-progress')
  })
  it('validates a complete encounter resource', () => {
    const result = encounterSchema.parse({
      resourceType: 'Encounter',
      id: 'encounter-1',
      status: 'finished',
      class: { code: 'IMP', system: 'http://hl7.org/fhir/v3/ActCode' },
      type: [{ text: 'Annual visit' }],
      subject: { reference: 'Patient/123' },
      participant: [{ individual: { reference: 'Practitioner/456' } }],
    })
    expect(result.status).toBe('finished')
  })
  it('rejects missing status', () => {
    expect(
      encounterSchema.safeParse({
        resourceType: 'Encounter',
        class: { code: 'AMB' },
      }).success,
    ).toBe(false)
  })
  it('rejects missing class', () => {
    expect(
      encounterSchema.safeParse({
        resourceType: 'Encounter',
        status: 'in-progress',
      }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      encounterSchema.safeParse({
        resourceType: 'Patient',
        status: 'in-progress',
        class: { code: 'AMB' },
      }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      encounterSchema.safeParse({
        resourceType: 'Encounter',
        status: 'invalid',
        class: { code: 'AMB' },
      }).success,
    ).toBe(false)
  })
  it('validates all status enum values', () => {
    for (const status of [
      'planned',
      'arrived',
      'triaged',
      'in-progress',
      'onleave',
      'finished',
      'cancelled',
      'entered-in-error',
      'unknown',
    ]) {
      expect(
        encounterSchema.safeParse({
          resourceType: 'Encounter',
          status,
          class: { code: 'AMB' },
        }).success,
      ).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Observation
// ---------------------------------------------------------------------------

describe('observationSchema', () => {
  it('validates a minimal observation with status and code', () => {
    const result = observationSchema.parse({
      resourceType: 'Observation',
      status: 'final',
      code: { text: 'Heart Rate' },
    })
    expect(result.status).toBe('final')
  })
  it('validates a complete observation with valueQuantity', () => {
    const result = observationSchema.parse({
      resourceType: 'Observation',
      status: 'final',
      code: { text: 'Heart Rate' },
      subject: { reference: 'Patient/123' },
      valueQuantity: { value: 72, unit: 'bpm' },
    })
    expect(result.valueQuantity?.value).toBe(72)
  })
  it('rejects missing status', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Observation',
        code: { text: 'Heart Rate' },
      }).success,
    ).toBe(false)
  })
  it('rejects missing code', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Observation',
        status: 'final',
      }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Patient',
        status: 'final',
        code: { text: 'Heart Rate' },
      }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Observation',
        status: 'invalid',
        code: { text: 'Heart Rate' },
      }).success,
    ).toBe(false)
  })
  it('validates all status enum values', () => {
    for (const status of [
      'registered',
      'preliminary',
      'final',
      'amended',
      'corrected',
      'cancelled',
      'entered-in-error',
      'unknown',
    ]) {
      expect(
        observationSchema.safeParse({
          resourceType: 'Observation',
          status,
          code: { text: 'Test' },
        }).success,
      ).toBe(true)
    }
  })
})

describe('observationSchema value[x] refine', () => {
  it('validates with a single valueString', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Observation',
        status: 'final',
        code: { text: 'Note' },
        valueString: 'Normal',
      }).success,
    ).toBe(true)
  })
  it('validates with a single valueBoolean', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Observation',
        status: 'final',
        code: { text: 'Smoker' },
        valueBoolean: true,
      }).success,
    ).toBe(true)
  })
  it('validates with a single valueInteger', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Observation',
        status: 'final',
        code: { text: 'Count' },
        valueInteger: 42,
      }).success,
    ).toBe(true)
  })
  it('validates with a single valueCodeableConcept', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Observation',
        status: 'final',
        code: { text: 'Type' },
        valueCodeableConcept: { text: 'Normal' },
      }).success,
    ).toBe(true)
  })
  it('validates with a single valueRange', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Observation',
        status: 'final',
        code: { text: 'Range' },
        valueRange: { low: { value: 1 }, high: { value: 10 } },
      }).success,
    ).toBe(true)
  })
  it('validates with a single valueRatio', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Observation',
        status: 'final',
        code: { text: 'Ratio' },
        valueRatio: { numerator: { value: 1 }, denominator: { value: 2 } },
      }).success,
    ).toBe(true)
  })
  it('validates with a single valueTime', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Observation',
        status: 'final',
        code: { text: 'Time' },
        valueTime: '10:30:00',
      }).success,
    ).toBe(true)
  })
  it('validates with a single valueDateTime', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Observation',
        status: 'final',
        code: { text: 'DateTime' },
        valueDateTime: '2024-01-15T10:30:00Z',
      }).success,
    ).toBe(true)
  })
  it('validates with a single valuePeriod', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Observation',
        status: 'final',
        code: { text: 'Period' },
        valuePeriod: { start: '2024-01-01', end: '2024-12-31' },
      }).success,
    ).toBe(true)
  })
  it('validates with no value[x] field', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Observation',
        status: 'final',
        code: { text: 'No value' },
      }).success,
    ).toBe(true)
  })
  it('rejects multiple value[x] fields set simultaneously', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Observation',
        status: 'final',
        code: { text: 'Test' },
        valueString: 'hello',
        valueBoolean: true,
      }).success,
    ).toBe(false)
  })
  it('rejects three value[x] fields set simultaneously', () => {
    expect(
      observationSchema.safeParse({
        resourceType: 'Observation',
        status: 'final',
        code: { text: 'Test' },
        valueString: 'hello',
        valueBoolean: true,
        valueInteger: 42,
      }).success,
    ).toBe(false)
  })
})

describe('observationValueSchema union', () => {
  it('validates valueQuantity variant', () => {
    expect(
      observationValueSchema.safeParse({ valueQuantity: { value: 72 } }).success,
    ).toBe(true)
  })
  it('validates valueCodeableConcept variant', () => {
    expect(
      observationValueSchema.safeParse({ valueCodeableConcept: { text: 'Normal' } })
        .success,
    ).toBe(true)
  })
  it('validates valueString variant', () => {
    expect(
      observationValueSchema.safeParse({ valueString: 'Normal' }).success,
    ).toBe(true)
  })
  it('validates valueBoolean variant', () => {
    expect(
      observationValueSchema.safeParse({ valueBoolean: true }).success,
    ).toBe(true)
  })
  it('validates valueInteger variant', () => {
    expect(
      observationValueSchema.safeParse({ valueInteger: 42 }).success,
    ).toBe(true)
  })
  it('validates valueRange variant', () => {
    expect(
      observationValueSchema.safeParse({
        valueRange: { low: { value: 1 }, high: { value: 10 } },
      }).success,
    ).toBe(true)
  })
  it('validates valueRatio variant', () => {
    expect(
      observationValueSchema.safeParse({
        valueRatio: { numerator: { value: 1 } },
      }).success,
    ).toBe(true)
  })
  it('validates valueTime variant', () => {
    expect(
      observationValueSchema.safeParse({ valueTime: '10:30:00' }).success,
    ).toBe(true)
  })
  it('validates valueDateTime variant', () => {
    expect(
      observationValueSchema.safeParse({ valueDateTime: '2024-01-15' }).success,
    ).toBe(true)
  })
  it('validates valuePeriod variant', () => {
    expect(
      observationValueSchema.safeParse({ valuePeriod: { start: '2024-01-01' } })
        .success,
    ).toBe(true)
  })
  it('rejects an empty object', () => {
    expect(observationValueSchema.safeParse({}).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Condition
// ---------------------------------------------------------------------------

describe('conditionSchema', () => {
  it('validates a minimal condition with subject', () => {
    const result = conditionSchema.parse({
      resourceType: 'Condition',
      subject: { reference: 'Patient/123' },
    })
    expect(result.subject?.reference).toBe('Patient/123')
  })
  it('validates a complete condition resource', () => {
    const result = conditionSchema.parse({
      resourceType: 'Condition',
      id: 'condition-1',
      clinicalStatus: { text: 'Active' },
      verificationStatus: { text: 'Confirmed' },
      code: { text: 'Hypertension' },
      subject: { reference: 'Patient/123' },
      onsetDateTime: '2024-01-01',
      recordedDate: '2024-01-15',
    })
    expect(result.code?.text).toBe('Hypertension')
  })
  it('rejects missing subject', () => {
    expect(
      conditionSchema.safeParse({ resourceType: 'Condition' }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      conditionSchema.safeParse({
        resourceType: 'Patient',
        subject: { reference: 'Patient/123' },
      }).success,
    ).toBe(false)
  })
  it('rejects missing resourceType', () => {
    expect(
      conditionSchema.safeParse({ subject: { reference: 'Patient/123' } }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// AllergyIntolerance
// ---------------------------------------------------------------------------

describe('allergyIntoleranceSchema', () => {
  it('validates a minimal allergyIntolerance with patient', () => {
    const result = allergyIntoleranceSchema.parse({
      resourceType: 'AllergyIntolerance',
      patient: { reference: 'Patient/123' },
    })
    expect(result.patient?.reference).toBe('Patient/123')
  })
  it('validates a complete allergyIntolerance resource', () => {
    const result = allergyIntoleranceSchema.parse({
      resourceType: 'AllergyIntolerance',
      id: 'allergy-1',
      type: 'allergy',
      category: ['food', 'medication'],
      criticality: 'high',
      code: { text: 'Peanut' },
      patient: { reference: 'Patient/123' },
      reaction: [
        {
          manifestation: [{ text: 'Hives' }],
          severity: 'severe',
        },
      ],
    })
    expect(result.criticality).toBe('high')
  })
  it('rejects missing patient', () => {
    expect(
      allergyIntoleranceSchema.safeParse({
        resourceType: 'AllergyIntolerance',
      }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      allergyIntoleranceSchema.safeParse({
        resourceType: 'Patient',
        patient: { reference: 'Patient/123' },
      }).success,
    ).toBe(false)
  })
  it('rejects invalid type enum', () => {
    expect(
      allergyIntoleranceSchema.safeParse({
        resourceType: 'AllergyIntolerance',
        patient: { reference: 'Patient/123' },
        type: 'invalid',
      }).success,
    ).toBe(false)
  })
  it('rejects invalid category enum', () => {
    expect(
      allergyIntoleranceSchema.safeParse({
        resourceType: 'AllergyIntolerance',
        patient: { reference: 'Patient/123' },
        category: ['invalid'],
      }).success,
    ).toBe(false)
  })
  it('rejects invalid criticality enum', () => {
    expect(
      allergyIntoleranceSchema.safeParse({
        resourceType: 'AllergyIntolerance',
        patient: { reference: 'Patient/123' },
        criticality: 'invalid',
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Medication
// ---------------------------------------------------------------------------

describe('medicationSchema', () => {
  it('validates a minimal medication', () => {
    const result = medicationSchema.parse({ resourceType: 'Medication' })
    expect(result.resourceType).toBe('Medication')
  })
  it('validates a complete medication resource', () => {
    const result = medicationSchema.parse({
      resourceType: 'Medication',
      id: 'med-1',
      code: { text: 'Aspirin' },
      status: 'active',
      manufacturer: { reference: 'Organization/123' },
      form: { text: 'Tablet' },
      ingredient: [
        {
          itemCodeableConcept: { text: 'Acetylsalicylic acid' },
          isActive: true,
        },
      ],
    })
    expect(result.status).toBe('active')
  })
  it('rejects wrong resourceType', () => {
    expect(
      medicationSchema.safeParse({ resourceType: 'Patient' }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      medicationSchema.safeParse({
        resourceType: 'Medication',
        status: 'invalid',
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// MedicationRequest
// ---------------------------------------------------------------------------

describe('medicationRequestSchema', () => {
  it('validates a minimal medicationRequest with status, intent, subject', () => {
    const result = medicationRequestSchema.parse({
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      subject: { reference: 'Patient/123' },
    })
    expect(result.status).toBe('active')
  })
  it('validates a complete medicationRequest resource', () => {
    const result = medicationRequestSchema.parse({
      resourceType: 'MedicationRequest',
      id: 'medreq-1',
      status: 'active',
      intent: 'order',
      priority: 'urgent',
      medicationCodeableConcept: { text: 'Aspirin 100mg' },
      subject: { reference: 'Patient/123' },
      authoredOn: '2024-01-15',
      requester: { reference: 'Practitioner/456' },
    })
    expect(result.intent).toBe('order')
  })
  it('rejects missing status', () => {
    expect(
      medicationRequestSchema.safeParse({
        resourceType: 'MedicationRequest',
        intent: 'order',
        subject: { reference: 'Patient/123' },
      }).success,
    ).toBe(false)
  })
  it('rejects missing intent', () => {
    expect(
      medicationRequestSchema.safeParse({
        resourceType: 'MedicationRequest',
        status: 'active',
        subject: { reference: 'Patient/123' },
      }).success,
    ).toBe(false)
  })
  it('rejects missing subject', () => {
    expect(
      medicationRequestSchema.safeParse({
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
      }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      medicationRequestSchema.safeParse({
        resourceType: 'Patient',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/123' },
      }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      medicationRequestSchema.safeParse({
        resourceType: 'MedicationRequest',
        status: 'invalid',
        intent: 'order',
        subject: { reference: 'Patient/123' },
      }).success,
    ).toBe(false)
  })
  it('rejects invalid intent enum', () => {
    expect(
      medicationRequestSchema.safeParse({
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'invalid',
        subject: { reference: 'Patient/123' },
      }).success,
    ).toBe(false)
  })
  it('validates all intent enum values', () => {
    for (const intent of [
      'proposal',
      'plan',
      'order',
      'original-order',
      'reflex-order',
      'filler-order',
      'instance-order',
      'option',
    ]) {
      expect(
        medicationRequestSchema.safeParse({
          resourceType: 'MedicationRequest',
          status: 'active',
          intent,
          subject: { reference: 'Patient/123' },
        }).success,
      ).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Immunization
// ---------------------------------------------------------------------------

describe('immunizationSchema', () => {
  it('validates a minimal immunization with status, vaccineCode, patient', () => {
    const result = immunizationSchema.parse({
      resourceType: 'Immunization',
      status: 'completed',
      vaccineCode: { text: 'COVID-19 Vaccine' },
      patient: { reference: 'Patient/123' },
    })
    expect(result.status).toBe('completed')
  })
  it('validates a complete immunization resource', () => {
    const result = immunizationSchema.parse({
      resourceType: 'Immunization',
      id: 'imm-1',
      status: 'completed',
      vaccineCode: { text: 'Influenza' },
      patient: { reference: 'Patient/123' },
      occurrenceDateTime: '2024-01-15',
      recorded: '2024-01-15',
      primarySource: true,
      lotNumber: 'LOT123',
      doseQuantity: { value: 0.5, unit: 'mL' },
    })
    expect(result.lotNumber).toBe('LOT123')
  })
  it('rejects missing status', () => {
    expect(
      immunizationSchema.safeParse({
        resourceType: 'Immunization',
        vaccineCode: { text: 'COVID-19' },
        patient: { reference: 'Patient/123' },
      }).success,
    ).toBe(false)
  })
  it('rejects missing vaccineCode', () => {
    expect(
      immunizationSchema.safeParse({
        resourceType: 'Immunization',
        status: 'completed',
        patient: { reference: 'Patient/123' },
      }).success,
    ).toBe(false)
  })
  it('rejects missing patient', () => {
    expect(
      immunizationSchema.safeParse({
        resourceType: 'Immunization',
        status: 'completed',
        vaccineCode: { text: 'COVID-19' },
      }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      immunizationSchema.safeParse({
        resourceType: 'Patient',
        status: 'completed',
        vaccineCode: { text: 'COVID-19' },
        patient: { reference: 'Patient/123' },
      }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      immunizationSchema.safeParse({
        resourceType: 'Immunization',
        status: 'invalid',
        vaccineCode: { text: 'COVID-19' },
        patient: { reference: 'Patient/123' },
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Procedure
// ---------------------------------------------------------------------------

describe('procedureSchema', () => {
  it('validates a minimal procedure with status and subject', () => {
    const result = procedureSchema.parse({
      resourceType: 'Procedure',
      status: 'completed',
      subject: { reference: 'Patient/123' },
    })
    expect(result.status).toBe('completed')
  })
  it('validates a complete procedure resource', () => {
    const result = procedureSchema.parse({
      resourceType: 'Procedure',
      id: 'proc-1',
      status: 'completed',
      code: { text: 'Appendectomy' },
      subject: { reference: 'Patient/123' },
      encounter: { reference: 'Encounter/456' },
      performer: [{ actor: { reference: 'Practitioner/789' } }],
    })
    expect(result.code?.text).toBe('Appendectomy')
  })
  it('rejects missing status', () => {
    expect(
      procedureSchema.safeParse({
        resourceType: 'Procedure',
        subject: { reference: 'Patient/123' },
      }).success,
    ).toBe(false)
  })
  it('rejects missing subject', () => {
    expect(
      procedureSchema.safeParse({
        resourceType: 'Procedure',
        status: 'completed',
      }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      procedureSchema.safeParse({
        resourceType: 'Patient',
        status: 'completed',
        subject: { reference: 'Patient/123' },
      }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      procedureSchema.safeParse({
        resourceType: 'Procedure',
        status: 'invalid',
        subject: { reference: 'Patient/123' },
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// DiagnosticReport
// ---------------------------------------------------------------------------

describe('diagnosticReportSchema', () => {
  it('validates a minimal diagnosticReport with status and code', () => {
    const result = diagnosticReportSchema.parse({
      resourceType: 'DiagnosticReport',
      status: 'final',
      code: { text: 'Blood Panel' },
    })
    expect(result.status).toBe('final')
  })
  it('validates a complete diagnosticReport resource', () => {
    const result = diagnosticReportSchema.parse({
      resourceType: 'DiagnosticReport',
      id: 'report-1',
      status: 'final',
      code: { text: 'Complete Blood Count' },
      subject: { reference: 'Patient/123' },
      effectiveDateTime: '2024-01-15',
      issued: '2024-01-15T10:30:00Z',
      performer: [{ actor: { reference: 'Practitioner/456' } }],
      result: [{ reference: 'Observation/789' }],
    })
    expect(result.code?.text).toBe('Complete Blood Count')
  })
  it('rejects missing status', () => {
    expect(
      diagnosticReportSchema.safeParse({
        resourceType: 'DiagnosticReport',
        code: { text: 'Blood Panel' },
      }).success,
    ).toBe(false)
  })
  it('rejects missing code', () => {
    expect(
      diagnosticReportSchema.safeParse({
        resourceType: 'DiagnosticReport',
        status: 'final',
      }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      diagnosticReportSchema.safeParse({
        resourceType: 'Patient',
        status: 'final',
        code: { text: 'Blood Panel' },
      }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      diagnosticReportSchema.safeParse({
        resourceType: 'DiagnosticReport',
        status: 'invalid',
        code: { text: 'Blood Panel' },
      }).success,
    ).toBe(false)
  })
  it('validates all status enum values', () => {
    for (const status of [
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
    ]) {
      expect(
        diagnosticReportSchema.safeParse({
          resourceType: 'DiagnosticReport',
          status,
          code: { text: 'Test' },
        }).success,
      ).toBe(true)
    }
  })
})
