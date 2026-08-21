// @vitest-environment node
/**
 * G1.2 — FHIR R4 Conformance Tests
 *
 * Validates that all FHIR resource types conform to R4 schemas:
 * - All supported resource types validate against their zod schemas
 * - Patient, Encounter, Observation, DocumentReference, Claim, Appointment,
 *   Consent, Provenance are tested specifically
 * - Invalid resources are rejected with OperationOutcome
 * - Required fields are enforced
 * - FHIR search parameters work correctly
 * - Bundle responses have correct type and entries
 * - Resource references are valid FHIR references
 * - Narrative (text field) is properly formatted
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks for search (which hits DB) ---

vi.mock('../repositories/index.js', () => ({
  searchDedicatedResources: vi.fn().mockResolvedValue({
    resources: [],
    total: 0,
  }),
  searchGenericResources: vi.fn().mockResolvedValue({
    resources: [],
    total: 0,
  }),
}))

vi.mock('../repositories/generic.js', () => ({
  createGenericResource: vi.fn(),
  readGenericResource: vi.fn(),
  updateGenericResource: vi.fn(),
  softDeleteGenericResource: vi.fn(),
  searchGenericResources: vi.fn(),
  getGenericResourceHistory: vi.fn(),
  insertGenericResourceHistory: vi.fn(),
}))

vi.mock('../repositories/dedicated.js', () => ({
  createDedicatedResource: vi.fn(),
  readDedicatedResource: vi.fn(),
  updateDedicatedResource: vi.fn(),
  softDeleteDedicatedResource: vi.fn(),
  searchDedicatedResources: vi.fn(),
  getDedicatedResourceHistory: vi.fn(),
  insertDedicatedResourceHistory: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  createHIPAACompliantAuditLog: vi.fn().mockResolvedValue({ id: 'audit-001' }),
  AuditEventType: {
    ACCESS: 'access',
    CREATE: 'create',
    MODIFY: 'modify',
    DELETE: 'delete',
    CONSENT: 'consent',
  },
  AuditEventStatus: {
    SUCCESS: 'success',
    FAILURE: 'failure',
    ATTEMPT: 'attempt',
    BLOCKED: 'blocked',
    WARNING: 'warning',
  },
}))

vi.mock('@/lib/audit/events', () => ({
  AuditEventType: {
    ACCESS: 'access',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
  },
  AuditSeverity: {
    INFO: 'info',
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
  },
}))

vi.mock('@/lib/audit/logger', () => ({
  AuditLogger: {
    getInstance: () => ({
      logEvent: vi.fn().mockResolvedValue('chain-001'),
    }),
  },
  verifyAuditChain: vi.fn(),
}))

// --- Imports ---

import {
  SUPPORTED_RESOURCE_TYPES,
  type FHIRResourceType,
  type FHIRBundle,
  type OperationOutcome,
} from '../types.js'
import {
  validateResource,
  validateResourceType,
  isSupportedResourceType,
  SCHEMA_REGISTRY,
  RESOURCE_REGISTRY,
} from '../validation.js'
import {
  createOperationOutcome,
  badRequest,
  notFound,
  unprocessableEntity,
} from '../error.js'
import { searchResources } from '../search.js'
import { routeFHIRRequest } from '../router.js'
import type { FHIRRequestContext } from '../types.js'

// --- Fixtures ---

const baseContext: FHIRRequestContext = {
  tenantId: 'tenant-001',
  userId: 'user-001',
  role: 'physician',
  breakGlass: false,
  jwtClaims: { sub: 'user-001', role: 'physician' },
}

const BASE_URL = 'https://example.com/fhir/r4'

function makeRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  resourceType: FHIRResourceType | null,
  resourceId: string | null = null,
  body: unknown = null,
  searchParams: URLSearchParams = new URLSearchParams(),
): Parameters<typeof routeFHIRRequest>[0] {
  return {
    method,
    resourceType,
    resourceId,
    isHistory: false,
    isMetadata: false,
    searchParams,
    body,
    ifMatch: null,
    context: baseContext,
  }
}

const validResources: Record<string, Record<string, unknown>> = {
  Patient: {
    resourceType: 'Patient',
    id: 'patient-1',
    identifier: [{ system: 'http://example.com/mrn', value: 'MRN-001' }],
    name: [{ family: 'Doe', given: ['John'] }],
    gender: 'male',
    birthDate: '1990-01-01',
  },
  Practitioner: {
    resourceType: 'Practitioner',
    id: 'prac-1',
    name: [{ family: 'Smith', given: ['Jane'] }],
  },
  Encounter: {
    resourceType: 'Encounter',
    id: 'enc-1',
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
    subject: { reference: 'Patient/patient-1' },
  },
  Observation: {
    resourceType: 'Observation',
    id: 'obs-1',
    status: 'final',
    code: { coding: [{ system: 'http://loinc.org', code: '1234-5' }] },
    subject: { reference: 'Patient/patient-1' },
  },
  Condition: {
    resourceType: 'Condition',
    id: 'cond-1',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    code: { coding: [{ system: 'http://snomed.info/sct', code: '123456' }] },
    subject: { reference: 'Patient/patient-1' },
  },
  AllergyIntolerance: {
    resourceType: 'AllergyIntolerance',
    id: 'allergy-1',
    code: { coding: [{ system: 'http://snomed.info/sct', code: '7890' }] },
    patient: { reference: 'Patient/patient-1' },
  },
  MedicationRequest: {
    resourceType: 'MedicationRequest',
    id: 'medreq-1',
    status: 'active',
    intent: 'order',
    subject: { reference: 'Patient/patient-1' },
    medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '123' }] },
  },
  Medication: {
    resourceType: 'Medication',
    id: 'med-1',
    code: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '456' }] },
  },
  Immunization: {
    resourceType: 'Immunization',
    id: 'imm-1',
    status: 'completed',
    vaccineCode: { coding: [{ system: 'http://hl7.org/fhir/sid/cvx', code: '207' }] },
    patient: { reference: 'Patient/patient-1' },
  },
  Procedure: {
    resourceType: 'Procedure',
    id: 'proc-1',
    status: 'completed',
    subject: { reference: 'Patient/patient-1' },
    code: { coding: [{ system: 'http://snomed.info/sct', code: '12345' }] },
  },
  DiagnosticReport: {
    resourceType: 'DiagnosticReport',
    id: 'dr-1',
    status: 'final',
    code: { coding: [{ system: 'http://loinc.org', code: '1234-5' }] },
    subject: { reference: 'Patient/patient-1' },
  },
  Appointment: {
    resourceType: 'Appointment',
    id: 'appt-1',
    status: 'booked',
    start: '2025-01-15T10:00:00Z',
    end: '2025-01-15T10:30:00Z',
    participant: [{ status: 'accepted', actor: { reference: 'Patient/patient-1' } }],
  },
  Schedule: {
    resourceType: 'Schedule',
    id: 'sched-1',
    actor: [{ reference: 'Practitioner/prac-1' }],
  },
  Slot: {
    resourceType: 'Slot',
    id: 'slot-1',
    schedule: { reference: 'Schedule/sched-1' },
    status: 'free',
    start: '2025-01-15T10:00:00Z',
    end: '2025-01-15T10:30:00Z',
  },
  Claim: {
    resourceType: 'Claim',
    id: 'claim-1',
    status: 'active',
    use: 'claim',
    type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'institutional' }] },
    patient: { reference: 'Patient/patient-1' },
    created: '2025-01-15T10:00:00Z',
    provider: { reference: 'Practitioner/prac-1' },
    priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
    insurance: [{ sequence: 1, focal: true, coverage: { reference: 'Coverage/cov-1' } }],
  },
  ClaimResponse: {
    resourceType: 'ClaimResponse',
    id: 'claimresp-1',
    status: 'active',
    outcome: 'complete',
    use: 'claim',
    patient: { reference: 'Patient/patient-1' },
    created: '2025-01-15T10:00:00Z',
    insurer: { reference: 'Organization/org-1' },
  },
  Coverage: {
    resourceType: 'Coverage',
    id: 'cov-1',
    status: 'active',
    beneficiary: { reference: 'Patient/patient-1' },
    payor: [{ reference: 'Organization/org-1' }],
  },
  ExplanationOfBenefit: {
    resourceType: 'ExplanationOfBenefit',
    id: 'eob-1',
    status: 'active',
    use: 'claim',
    type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
    patient: { reference: 'Patient/patient-1' },
    insurer: { reference: 'Organization/org-1' },
    created: '2025-01-15T10:00:00Z',
    provider: { reference: 'Practitioner/prac-1' },
    outcome: 'complete',
    insurance: { focal: true, coverage: { reference: 'Coverage/cov-1' } },
  },
  DocumentReference: {
    resourceType: 'DocumentReference',
    id: 'doc-1',
    status: 'current',
    type: { coding: [{ system: 'http://loinc.org', code: '11506-3' }] },
    content: [{ attachment: { contentType: 'text/plain', data: 'SGVsbG8=' } }],
  },
  Communication: {
    resourceType: 'Communication',
    id: 'comm-1',
    status: 'completed',
    subject: { reference: 'Patient/patient-1' },
  },
  CommunicationRequest: {
    resourceType: 'CommunicationRequest',
    id: 'commreq-1',
    status: 'active',
    subject: { reference: 'Patient/patient-1' },
  },
  Consent: {
    resourceType: 'Consent',
    id: 'consent-1',
    status: 'active',
    scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'treatment' }] },
    patient: { reference: 'Patient/patient-1' },
  },
  ServiceRequest: {
    resourceType: 'ServiceRequest',
    id: 'sr-1',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('G1.2 — FHIR R4 Conformance', () => {
  describe('all FHIR resource types validate against R4 schemas', () => {
    it('validates all 23 supported resource types', () => {
      expect(SUPPORTED_RESOURCE_TYPES).toHaveLength(23)
    })

    it('SCHEMA_REGISTRY has a schema for every supported resource type', () => {
      for (const rt of SUPPORTED_RESOURCE_TYPES) {
        expect(SCHEMA_REGISTRY[rt]).toBeDefined()
      }
    })

    it('RESOURCE_REGISTRY has an entry for every supported resource type', () => {
      for (const rt of SUPPORTED_RESOURCE_TYPES) {
        expect(RESOURCE_REGISTRY[rt]).toBeDefined()
        expect(RESOURCE_REGISTRY[rt].resourceType).toBe(rt)
        expect(RESOURCE_REGISTRY[rt].table).toBeDefined()
        expect(RESOURCE_REGISTRY[rt].pkColumn).toBeDefined()
      }
    })

    it('each valid resource fixture passes validation', () => {
      for (const [rt, resource] of Object.entries(validResources)) {
        const result = validateResource(rt as FHIRResourceType, resource)
        expect(result.success, `${rt} should validate`).toBe(true)
      }
    })
  })

  describe('Patient resource validation', () => {
    it('validates a valid Patient', () => {
      const result = validateResource('Patient', validResources['Patient']!)
      expect(result.success).toBe(true)
      expect(result.data?.['resourceType']).toBe('Patient')
    })

    it('rejects Patient with wrong resourceType', () => {
      const result = validateResource('Patient', {
        ...validResources['Patient']!,
        resourceType: 'Practitioner',
      })
      expect(result.success).toBe(false)
    })

    it('rejects Patient with invalid gender', () => {
      const result = validateResource('Patient', {
        ...validResources['Patient']!,
        gender: 'invalid-gender',
      })
      expect(result.success).toBe(false)
    })

    it('rejects Patient with invalid birthDate format', () => {
      const result = validateResource('Patient', {
        ...validResources['Patient']!,
        birthDate: 'not-a-date',
      })
      expect(result.success).toBe(false)
    })

    it('accepts Patient with identifier array', () => {
      const result = validateResource('Patient', {
        resourceType: 'Patient',
        id: 'p1',
        identifier: [{ system: 'http://example.com/mrn', value: 'MRN-001' }],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Encounter resource validation', () => {
    it('validates a valid Encounter', () => {
      const result = validateResource('Encounter', validResources['Encounter']!)
      expect(result.success).toBe(true)
    })

    it('rejects Encounter with wrong resourceType', () => {
      const result = validateResource('Encounter', {
        ...validResources['Encounter']!,
        resourceType: 'Patient',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Observation resource validation', () => {
    it('validates a valid Observation', () => {
      const result = validateResource('Observation', validResources['Observation']!)
      expect(result.success).toBe(true)
    })

    it('rejects Observation with wrong resourceType', () => {
      const result = validateResource('Observation', {
        ...validResources['Observation']!,
        resourceType: 'Patient',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('DocumentReference resource validation', () => {
    it('validates a valid DocumentReference', () => {
      const result = validateResource('DocumentReference', validResources['DocumentReference']!)
      expect(result.success).toBe(true)
    })

    it('rejects DocumentReference with wrong resourceType', () => {
      const result = validateResource('DocumentReference', {
        ...validResources['DocumentReference']!,
        resourceType: 'Patient',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Claim resource validation', () => {
    it('validates a valid Claim', () => {
      const result = validateResource('Claim', validResources['Claim']!)
      expect(result.success).toBe(true)
    })

    it('rejects Claim with wrong resourceType', () => {
      const result = validateResource('Claim', {
        ...validResources['Claim']!,
        resourceType: 'Patient',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Appointment resource validation', () => {
    it('validates a valid Appointment', () => {
      const result = validateResource('Appointment', validResources['Appointment']!)
      expect(result.success).toBe(true)
    })

    it('rejects Appointment with wrong resourceType', () => {
      const result = validateResource('Appointment', {
        ...validResources['Appointment']!,
        resourceType: 'Patient',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Consent resource validation', () => {
    it('validates a valid Consent', () => {
      const result = validateResource('Consent', validResources['Consent']!)
      expect(result.success).toBe(true)
    })

    it('rejects Consent with missing status (required field)', () => {
      const consent = { ...validResources['Consent']! }
      const consentWithoutStatus = { ...consent }
      delete (consentWithoutStatus as Record<string, unknown>)['status']
      const result = validateResource('Consent', consentWithoutStatus)
      expect(result.success).toBe(false)
    })

    it('rejects Consent with missing scope (required field)', () => {
      const consent = { ...validResources['Consent']! }
      const consentWithoutScope = { ...consent }
      delete (consentWithoutScope as Record<string, unknown>)['scope']
      const result = validateResource('Consent', consentWithoutScope)
      expect(result.success).toBe(false)
    })

    it('rejects Consent with missing patient (required field)', () => {
      const consent = { ...validResources['Consent']! }
      const consentWithoutPatient = { ...consent }
      delete (consentWithoutPatient as Record<string, unknown>)['patient']
      const result = validateResource('Consent', consentWithoutPatient)
      expect(result.success).toBe(false)
    })

    it('rejects Consent with wrong resourceType', () => {
      const result = validateResource('Consent', {
        ...validResources['Consent']!,
        resourceType: 'Patient',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Provenance resource validation', () => {
    it('validates a valid Provenance via consentSchema import', async () => {
      const { provenanceSchema } = await import('../../types/consent.js')
      const provenance = {
        resourceType: 'Provenance',
        target: [{ reference: 'Consent/consent-1' }],
        recorded: '2025-01-15T10:00:00Z',
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
      }
      const result = provenanceSchema.safeParse(provenance)
      expect(result.success).toBe(true)
    })

    it('rejects Provenance with missing target', async () => {
      const { provenanceSchema } = await import('../../types/consent.js')
      const provenance = {
        resourceType: 'Provenance',
        recorded: '2025-01-15T10:00:00Z',
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
      }
      const result = provenanceSchema.safeParse(provenance)
      expect(result.success).toBe(false)
    })

    it('rejects Provenance with missing agent', async () => {
      const { provenanceSchema } = await import('../../types/consent.js')
      const provenance = {
        resourceType: 'Provenance',
        target: [{ reference: 'Consent/consent-1' }],
        recorded: '2025-01-15T10:00:00Z',
      }
      const result = provenanceSchema.safeParse(provenance)
      expect(result.success).toBe(false)
    })

    it('rejects Provenance with missing recorded', async () => {
      const { provenanceSchema } = await import('../../types/consent.js')
      const provenance = {
        resourceType: 'Provenance',
        target: [{ reference: 'Consent/consent-1' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
      }
      const result = provenanceSchema.safeParse(provenance)
      expect(result.success).toBe(false)
    })
  })

  describe('invalid resources are rejected with OperationOutcome', () => {
    it('createOperationOutcome produces a valid OperationOutcome', () => {
      const oo = createOperationOutcome('error', 'invalid', 'Bad resource')
      expect(oo.resourceType).toBe('OperationOutcome')
      expect(oo.issue).toHaveLength(1)
      expect(oo.issue[0].severity).toBe('error')
      expect(oo.issue[0].code).toBe('invalid')
      expect(oo.issue[0].diagnostics).toBe('Bad resource')
    })

    it('badRequest returns a 400 FHIRResponse with OperationOutcome', () => {
      const resp = badRequest('Invalid input')
      expect(resp.status).toBe(400)
      expect(resp.headers['Content-Type']).toBe('application/fhir+json')
      const body = resp.body as OperationOutcome
      expect(body.resourceType).toBe('OperationOutcome')
      expect(body.issue[0].severity).toBe('error')
    })

    it('notFound returns a 404 FHIRResponse with OperationOutcome', () => {
      const resp = notFound('Patient', 'patient-999')
      expect(resp.status).toBe(404)
      const body = resp.body as OperationOutcome
      expect(body.resourceType).toBe('OperationOutcome')
      expect(body.issue[0].code).toBe('not-found')
    })

    it('unprocessableEntity returns a 422 FHIRResponse with OperationOutcome', () => {
      const resp = unprocessableEntity('Validation failed')
      expect(resp.status).toBe(422)
      const body = resp.body as OperationOutcome
      expect(body.resourceType).toBe('OperationOutcome')
      expect(body.issue[0].code).toBe('structure')
    })

    it('validateResource returns error issues for invalid resource', () => {
      const result = validateResource('Patient', { resourceType: 'Patient', name: 'not-an-array' })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error!.issues.length).toBeGreaterThan(0)
    })
  })

  describe('required fields are enforced', () => {
    it('Patient requires resourceType to be "Patient"', () => {
      const result = validateResource('Patient', { resourceType: 'Observation' })
      expect(result.success).toBe(false)
    })

    it('Consent requires status field', () => {
      const result = validateResource('Consent', {
        resourceType: 'Consent',
        scope: { coding: [{ code: 'treatment' }] },
        patient: { reference: 'Patient/p1' },
      })
      expect(result.success).toBe(false)
    })

    it('Consent requires scope field', () => {
      const result = validateResource('Consent', {
        resourceType: 'Consent',
        status: 'active',
        patient: { reference: 'Patient/p1' },
      })
      expect(result.success).toBe(false)
    })

    it('Consent requires patient field', () => {
      const result = validateResource('Consent', {
        resourceType: 'Consent',
        status: 'active',
        scope: { coding: [{ code: 'treatment' }] },
      })
      expect(result.success).toBe(false)
    })

    it('validateResourceType rejects body without resourceType', () => {
      const result = validateResourceType('Patient', { name: 'test' })
      expect(result.valid).toBe(false)
    })

    it('validateResourceType rejects null body', () => {
      const result = validateResourceType('Patient', null)
      expect(result.valid).toBe(false)
    })

    it('validateResourceType rejects non-object body', () => {
      const result = validateResourceType('Patient', 'string')
      expect(result.valid).toBe(false)
    })
  })

  describe('FHIR search parameters work correctly', () => {
    it('searchResources returns a Bundle with type "searchset"', async () => {
      const response = await searchResources(
        'Patient',
        new URLSearchParams(),
        baseContext,
        BASE_URL,
      )

      expect(response.status).toBe(200)
      const body = response.body as FHIRBundle
      expect(body.resourceType).toBe('Bundle')
      expect(body.type).toBe('searchset')
    })

    it('searchResources includes total count in bundle', async () => {
      const response = await searchResources(
        'Patient',
        new URLSearchParams(),
        baseContext,
        BASE_URL,
      )

      const body = response.body as FHIRBundle
      expect(body.total).toBeDefined()
      expect(typeof body.total).toBe('number')
    })

    it('searchResources includes self link in bundle', async () => {
      const response = await searchResources(
        'Patient',
        new URLSearchParams(),
        baseContext,
        BASE_URL,
      )

      const body = response.body as FHIRBundle
      expect(body.link).toBeDefined()
      const selfLink = body.link!.find((l) => l.relation === 'self')
      expect(selfLink).toBeDefined()
      expect(selfLink!.url).toContain('Patient')
    })

    it('searchResources respects _count parameter', async () => {
      const params = new URLSearchParams({ _count: '5' })
      await searchResources('Patient', params, baseContext, BASE_URL)

      const body = (await searchResources('Patient', params, baseContext, BASE_URL)).body as FHIRBundle
      const selfLink = body.link!.find((l) => l.relation === 'self')!
      expect(selfLink.url).toContain('_count=5')
    })

    it('searchResources caps _count at 100', async () => {
      const params = new URLSearchParams({ _count: '500' })
      const response = await searchResources('Patient', params, baseContext, BASE_URL)
      const body = response.body as FHIRBundle
      const selfLink = body.link!.find((l) => l.relation === 'self')!
      expect(selfLink.url).toContain('_count=100')
    })
  })

  describe('bundle responses have correct type and entries', () => {
    it('search bundle has resourceType "Bundle"', async () => {
      const response = await searchResources(
        'Observation',
        new URLSearchParams(),
        baseContext,
        BASE_URL,
      )
      const body = response.body as FHIRBundle
      expect(body.resourceType).toBe('Bundle')
    })

    it('search bundle has type "searchset"', async () => {
      const response = await searchResources(
        'Observation',
        new URLSearchParams(),
        baseContext,
        BASE_URL,
      )
      const body = response.body as FHIRBundle
      expect(body.type).toBe('searchset')
    })

    it('search bundle has entry array', async () => {
      const response = await searchResources(
        'Observation',
        new URLSearchParams(),
        baseContext,
        BASE_URL,
      )
      const body = response.body as FHIRBundle
      expect(Array.isArray(body.entry)).toBe(true)
    })
  })

  describe('resource references are valid FHIR references', () => {
    it('Encounter.subject is a valid reference', () => {
      const result = validateResource('Encounter', validResources['Encounter']!)
      expect(result.success).toBe(true)
    })

    it('Observation.subject is a valid reference', () => {
      const result = validateResource('Observation', validResources['Observation']!)
      expect(result.success).toBe(true)
    })

    it('Consent.patient is a valid reference', () => {
      const result = validateResource('Consent', validResources['Consent']!)
      expect(result.success).toBe(true)
    })

    it('Appointment.participant.actor is a valid reference', () => {
      const result = validateResource('Appointment', validResources['Appointment']!)
      expect(result.success).toBe(true)
    })
  })

  describe('narrative (text field) is properly formatted', () => {
    it('Patient with text/narrative field validates', () => {
      const patientWithNarrative = {
        ...validResources['Patient']!,
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml">John Doe</div>',
        },
      }
      const result = validateResource('Patient', patientWithNarrative)
      expect(result.success).toBe(true)
    })

    it('Consent with text/narrative field validates', () => {
      const consentWithNarrative = {
        ...validResources['Consent']!,
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml">Treatment consent</div>',
        },
      }
      const result = validateResource('Consent', consentWithNarrative)
      expect(result.success).toBe(true)
    })
  })

  describe('isSupportedResourceType type guard', () => {
    it('returns true for all supported types', () => {
      for (const rt of SUPPORTED_RESOURCE_TYPES) {
        expect(isSupportedResourceType(rt)).toBe(true)
      }
    })

    it('returns false for unsupported types', () => {
      expect(isSupportedResourceType('Foo')).toBe(false)
      expect(isSupportedResourceType('')).toBe(false)
      expect(isSupportedResourceType('patient')).toBe(false)
    })
  })

  describe('router rejects unsupported resource types', () => {
    it('returns 400 for unsupported resource type', async () => {
      const req = makeRequest('GET', 'Foo' as FHIRResourceType, 'id-1')
      const response = await routeFHIRRequest(req, BASE_URL)
      expect(response.status).toBe(400)
      const body = response.body as OperationOutcome
      expect(body.resourceType).toBe('OperationOutcome')
    })

    it('returns 400 for null resource type', async () => {
      const req = makeRequest('GET', null, 'id-1')
      const response = await routeFHIRRequest(req, BASE_URL)
      expect(response.status).toBe(400)
    })
  })
})
