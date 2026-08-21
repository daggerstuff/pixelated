// @vitest-environment node
/**
 * G1.5 — Type Safety Gate
 *
 * Validates that Zod schemas match TypeScript interfaces and that
 * FHIR resource validation catches type mismatches.
 *
 * - Zod schemas match TypeScript interfaces
 * - FHIR resource validation catches type mismatches
 * - API request/response types are consistent
 * - Consent types match FHIR Consent R4 spec
 * - Provenance types match FHIR Provenance R4 spec
 * - Uses zod's .parse() and .safeParse() to validate sample resources
 * - Schema inference types match exported interfaces
 */

import { describe, it, expect } from 'vitest'

import {
  patientSchema,
  practitionerSchema,
  encounterSchema,
  observationSchema,
  fhirBaseSchema,
} from '../types/index.js'
import {
  consentSchema,
  provenanceSchema,
  type ConsentResource,
  type ProvenanceResource,
} from '../types/consent.js'
import {
  appointmentSchema,
} from '../types/scheduling.js'
import {
  claimSchema,
} from '../types/billing.js'
import {
  documentReferenceSchema,
} from '../types/communication.js'
import {
  validateResource,
  validateResourceType,
  SCHEMA_REGISTRY,
} from '../fhir/validation.js'
import {
  SUPPORTED_RESOURCE_TYPES,
  type FHIRResourceType,
  type FHIRRequest,
  type FHIRResponse,
  type FHIRBundle,
  type OperationOutcome,
} from '../fhir/types.js'
import type {
  APIRequestContext,
  APIResponse,
  EndpointDefinition,
  EndpointGroup,
} from '../api/types.js'
import type {
  ClinicalRole,
  EHRPermission,
  EHRPermissionCheckResult,
} from '../auth/types.js'
import type {
  ConsentStatus,
  TreatmentType,
  ConsentScope,
  ConsentRecord,
  ConsentCheckResult,
  DigitalSignature,
} from '../consent/types.js'

// --- Sample valid resources ---

const validPatient = {
  resourceType: 'Patient' as const,
  id: 'patient-1',
  name: [{ family: 'Doe', given: ['John'] }],
  gender: 'male' as const,
  birthDate: '1990-01-01',
}

const validConsent = {
  resourceType: 'Consent' as const,
  id: 'consent-1',
  status: 'active' as const,
  scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'treatment' }] },
  patient: { reference: 'Patient/patient-1' },
}

const validProvenance = {
  resourceType: 'Provenance' as const,
  target: [{ reference: 'Consent/consent-1' }],
  recorded: '2025-01-15T10:00:00Z',
  agent: [{ who: { reference: 'Practitioner/prac-1' } }],
}

describe('G1.5 — Type Safety Gate', () => {
  describe('Zod schemas match TypeScript interfaces', () => {
    it('patientSchema.parse() returns a valid Patient type', () => {
      const result = patientSchema.safeParse(validPatient)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.resourceType).toBe('Patient')
        expect(result.data.id).toBe('patient-1')
      }
    })

    it('consentSchema.parse() returns a valid ConsentResource type', () => {
      const result = consentSchema.safeParse(validConsent)
      expect(result.success).toBe(true)
      if (result.success) {
        const resource: ConsentResource = result.data
        expect(resource.resourceType).toBe('Consent')
        expect(resource.status).toBe('active')
      }
    })

    it('provenanceSchema.parse() returns a valid ProvenanceResource type', () => {
      const result = provenanceSchema.safeParse(validProvenance)
      expect(result.success).toBe(true)
      if (result.success) {
        const resource: ProvenanceResource = result.data
        expect(resource.resourceType).toBe('Provenance')
        expect(resource.target).toHaveLength(1)
      }
    })

    it('fhirBaseSchema accepts a resource with resourceType and id', () => {
      const result = fhirBaseSchema.safeParse({
        resourceType: 'Foo',
        id: 'foo-1',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('FHIR resource validation catches type mismatches', () => {
    it('rejects Patient with string name instead of array', () => {
      const result = validateResource('Patient', {
        resourceType: 'Patient',
        name: 'not-an-array',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error!.issues.length).toBeGreaterThan(0)
    })

    it('rejects Patient with numeric birthDate', () => {
      const result = validateResource('Patient', {
        resourceType: 'Patient',
        birthDate: 12345,
      })
      expect(result.success).toBe(false)
    })

    it('rejects Patient with boolean gender', () => {
      const result = validateResource('Patient', {
        resourceType: 'Patient',
        gender: true,
      })
      expect(result.success).toBe(false)
    })

    it('rejects Consent with numeric status', () => {
      const result = validateResource('Consent', {
        resourceType: 'Consent',
        status: 123,
        scope: { coding: [{ code: 'treatment' }] },
        patient: { reference: 'Patient/p1' },
      })
      expect(result.success).toBe(false)
    })

    it('rejects Consent with invalid status value', () => {
      const result = validateResource('Consent', {
        resourceType: 'Consent',
        status: 'not-a-valid-status',
        scope: { coding: [{ code: 'treatment' }] },
        patient: { reference: 'Patient/p1' },
      })
      expect(result.success).toBe(false)
    })

    it('rejects Observation with missing required code field', () => {
      const result = validateResource('Observation', {
        resourceType: 'Observation',
        status: 'final',
        subject: { reference: 'Patient/p1' },
      })
      // Observation requires code field per FHIR R4
      expect(result.success).toBe(false)
    })

    it('validateResourceType catches mismatched resourceType', () => {
      const result = validateResourceType('Patient', { resourceType: 'Observation' })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Patient')
      expect(result.error).toContain('Observation')
    })
  })

  describe('API request/response types are consistent', () => {
    it('APIRequestContext has required fields', () => {
      const ctx: APIRequestContext = {
        userId: 'user-001',
        role: 'physician',
        tenantId: 'tenant-001',
        breakGlass: false,
      }
      expect(ctx.userId).toBe('user-001')
      expect(ctx.role).toBe('physician')
      expect(ctx.tenantId).toBe('tenant-001')
      expect(ctx.breakGlass).toBe(false)
    })

    it('APIRequestContext has optional fields', () => {
      const ctx: APIRequestContext = {
        userId: 'user-001',
        role: 'physician',
        tenantId: 'tenant-001',
        breakGlass: true,
        patientId: 'patient-001',
        ipAddress: '10.0.0.1',
        userAgent: 'test-agent',
        sessionId: 'sess-001',
      }
      expect(ctx.patientId).toBe('patient-001')
      expect(ctx.ipAddress).toBe('10.0.0.1')
    })

    it('APIResponse has status, headers, and body', () => {
      const resp: APIResponse = {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { resourceType: 'Patient' },
      }
      expect(resp.status).toBe(200)
      expect(resp.headers['Content-Type']).toBe('application/json')
    })

    it('EndpointDefinition has all required fields', () => {
      const ep: EndpointDefinition = {
        method: 'GET',
        path: '/patients',
        resourceType: 'Patient',
        permission: 'read_patient',
        description: 'Search patients',
        operation: 'search',
      }
      expect(ep.method).toBe('GET')
      expect(ep.resourceType).toBe('Patient')
      expect(ep.permission).toBe('read_patient')
    })

    it('EndpointGroup is one of the 7 groups', () => {
      const groups: EndpointGroup[] = [
        'patients',
        'encounters',
        'appointments',
        'notes',
        'claims',
        'consents',
        'observations',
      ]
      expect(groups).toHaveLength(7)
    })

    it('FHIRRequest has all required fields', () => {
      const req: FHIRRequest = {
        method: 'GET',
        resourceType: 'Patient',
        resourceId: 'patient-001',
        isHistory: false,
        isMetadata: false,
        searchParams: new URLSearchParams(),
        body: null,
        ifMatch: null,
        context: {
          tenantId: 'tenant-001',
          userId: 'user-001',
          role: 'physician',
          breakGlass: false,
          jwtClaims: {},
        },
      }
      expect(req.method).toBe('GET')
      expect(req.resourceType).toBe('Patient')
    })

    it('FHIRResponse has status, headers, and body', () => {
      const resp: FHIRResponse = {
        status: 200,
        headers: { 'Content-Type': 'application/fhir+json' },
        body: { resourceType: 'Patient' },
      }
      expect(resp.status).toBe(200)
    })

    it('FHIRBundle has resourceType Bundle and entries', () => {
      const bundle: FHIRBundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 0,
        entry: [],
      }
      expect(bundle.resourceType).toBe('Bundle')
      expect(bundle.type).toBe('searchset')
    })

    it('OperationOutcome has resourceType and issues', () => {
      const oo: OperationOutcome = {
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'invalid' }],
      }
      expect(oo.resourceType).toBe('OperationOutcome')
      expect(oo.issue).toHaveLength(1)
    })
  })

  describe('consent types match FHIR Consent R4 spec', () => {
    it('ConsentResource has FHIR R4 Consent fields', () => {
      const resource: ConsentResource = validConsent
      expect(resource.resourceType).toBe('Consent')
      expect(resource.status).toBe('active')
      expect(resource.scope).toBeDefined()
      expect(resource.patient).toBeDefined()
    })

    it('ConsentStatus includes active, draft, inactive, not-done, entered-in-error, unknown', () => {
      const statuses: string[] = ['active', 'draft', 'inactive', 'not-done', 'entered-in-error', 'unknown']
      for (const s of statuses) {
        const result = consentSchema.safeParse({
          ...validConsent,
          status: s,
        })
        expect(result.success, `status "${s}" should be valid`).toBe(true)
      }
    })

    it('ConsentRecord has all required fields', () => {
      const record: ConsentRecord = {
        id: 'consent-001',
        patientId: 'patient-001',
        treatmentType: 'therapy',
        scope: 'treatment',
        status: 'active',
        grantedAt: new Date().toISOString(),
        expiresAt: null,
        withdrawnAt: null,
        withdrawnReason: null,
        performerId: 'Practitioner/001',
        organizationId: null,
        provenanceId: null,
        policyRule: null,
        provisions: [],
      }
      expect(record.id).toBe('consent-001')
      expect(record.status).toBe('active')
    })

    it('ConsentCheckResult has all required fields', () => {
      const result: ConsentCheckResult = {
        hasConsent: true,
        consentId: 'consent-001',
        status: 'active',
        reason: 'Active consent found',
        treatmentType: 'therapy',
        patientId: 'patient-001',
        checkedAt: new Date().toISOString(),
      }
      expect(result.hasConsent).toBe(true)
    })

    it('TreatmentType includes all treatment types', () => {
      const types: TreatmentType[] = ['therapy', 'psychiatry', 'telehealth', 'assessment', 'general']
      expect(types).toHaveLength(5)
    })

    it('ConsentScope includes all scopes', () => {
      const scopes: ConsentScope[] = ['patient-privacy', 'treatment', 'research', 'data-sharing']
      expect(scopes).toHaveLength(4)
    })

    it('DigitalSignature has who, data, and format', () => {
      const sig: DigitalSignature = {
        who: 'Practitioner/001',
        data: 'base64sig',
        format: 'application/signature',
      }
      expect(sig.who).toBe('Practitioner/001')
    })
  })

  describe('provenance types match FHIR Provenance R4 spec', () => {
    it('ProvenanceResource has FHIR R4 Provenance fields', () => {
      const resource: ProvenanceResource = validProvenance
      expect(resource.resourceType).toBe('Provenance')
      expect(resource.target).toHaveLength(1)
      expect(resource.recorded).toBeDefined()
      expect(resource.agent).toHaveLength(1)
    })

    it('Provenance requires target array', () => {
      const result = provenanceSchema.safeParse({
        resourceType: 'Provenance',
        recorded: '2025-01-15T10:00:00Z',
        agent: [{ who: { reference: 'Practitioner/001' } }],
      })
      expect(result.success).toBe(false)
    })

    it('Provenance requires recorded field', () => {
      const result = provenanceSchema.safeParse({
        resourceType: 'Provenance',
        target: [{ reference: 'Consent/consent-1' }],
        agent: [{ who: { reference: 'Practitioner/001' } }],
      })
      expect(result.success).toBe(false)
    })

    it('Provenance requires agent array', () => {
      const result = provenanceSchema.safeParse({
        resourceType: 'Provenance',
        target: [{ reference: 'Consent/consent-1' }],
        recorded: '2025-01-15T10:00:00Z',
      })
      expect(result.success).toBe(false)
    })

    it('Provenance with signature validates', () => {
      const result = provenanceSchema.safeParse({
        resourceType: 'Provenance',
        target: [{ reference: 'Consent/consent-1' }],
        recorded: '2025-01-15T10:00:00Z',
        agent: [{ who: { reference: 'Practitioner/001' } }],
        signature: [{
          type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1' }],
          when: '2025-01-15T10:00:00Z',
          who: { reference: 'Practitioner/001' },
          data: 'base64sig',
        }],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('schema inference types match exported interfaces', () => {
    it('z.infer of consentSchema matches ConsentResource', () => {
      const parsed = consentSchema.safeParse(validConsent)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        const resource: ConsentResource = parsed.data
        // Type-level check: assignment compiles, so types match
        expect(resource.resourceType).toBe('Consent')
      }
    })

    it('z.infer of provenanceSchema matches ProvenanceResource', () => {
      const parsed = provenanceSchema.safeParse(validProvenance)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        const resource: ProvenanceResource = parsed.data
        expect(resource.resourceType).toBe('Provenance')
      }
    })

    it('SCHEMA_REGISTRY has schemas for all supported types', () => {
      for (const rt of SUPPORTED_RESOURCE_TYPES) {
        expect(SCHEMA_REGISTRY[rt]).toBeDefined()
      }
    })
  })

  describe('RBAC types are consistent', () => {
    it('ClinicalRole includes all 13 roles', () => {
      const roles: ClinicalRole[] = [
        'physician', 'nurse', 'pharmacist', 'medicalAssistant',
        'technician', 'therapist', 'socialWorker', 'careCoordinator',
        'frontDesk', 'billingSpecialist', 'complianceOfficer',
        'healthInformationManager', 'systemAdmin',
      ]
      expect(roles).toHaveLength(13)
    })

    it('EHRPermission includes all 25 permissions', () => {
      const permissions: EHRPermission[] = [
        'read_patient', 'write_patient', 'read_encounter', 'write_encounter',
        'read_observation', 'write_observation', 'read_condition', 'write_condition',
        'read_medication', 'write_medication', 'read_procedure', 'write_procedure',
        'read_clinical_note', 'write_clinical_note', 'sign_clinical_note',
        'cosign_clinical_note', 'read_schedule', 'manage_schedule',
        'read_claim', 'submit_claim', 'adjudicate_claim',
        'manage_consent', 'break_glass', 'export_phi', 'audit_access',
      ]
      expect(permissions).toHaveLength(25)
    })

    it('EHRPermissionCheckResult has all required fields', () => {
      const result: EHRPermissionCheckResult = {
        granted: true,
        permission: 'read_patient',
        role: 'physician',
        reason: 'Permission granted',
        breakGlassActivated: false,
        consentVerified: true,
      }
      expect(result.granted).toBe(true)
      expect(result.permission).toBe('read_patient')
    })
  })

  describe('safeParse vs parse behavior', () => {
    it('safeParse returns success=false for invalid input (no throw)', () => {
      const result = consentSchema.safeParse({ resourceType: 'Wrong' })
      expect(result.success).toBe(false)
    })

    it('safeParse returns success=true for valid input', () => {
      const result = consentSchema.safeParse(validConsent)
      expect(result.success).toBe(true)
    })

    it('validateResource uses safeParse internally (no throw on invalid)', () => {
      const result = validateResource('Patient', { resourceType: 'Patient', name: 123 })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})
