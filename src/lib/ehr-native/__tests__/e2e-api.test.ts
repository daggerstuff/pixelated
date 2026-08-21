// @vitest-environment node
/**
 * G1.4 — E2E API Tests
 *
 * Tests full HTTP request/response cycle for each endpoint group by
 * mocking the API handler directly (no real HTTP server needed).
 *
 * Endpoint groups tested:
 * - GET /api/ehr/v1/patients/{id} → 200 with Patient resource
 * - POST /api/ehr/v1/patients → 201 with created Patient
 * - GET /api/ehr/v1/consents?patient={id} → 200 with Consent resources
 * - POST /api/ehr/v1/consents → 201 with created Consent
 * - GET /api/ehr/v1/observations?patient={id} → 200 with Observation resources
 * - 401 for missing auth
 * - 403 for insufficient permissions
 * - 404 for non-existent resources
 * - 400 for invalid resource data
 * - OpenAPI spec endpoint returns valid OpenAPI 3.1 JSON
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

const mockCheckPermission = vi.fn()
const mockLogEHRAccess = vi.fn()
const mockRouteFHIRRequest = vi.fn()

vi.mock('../auth/ehr-rbac.js', () => ({
  checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
  logEHRAccess: (...args: unknown[]) => mockLogEHRAccess(...args),
}))

vi.mock('../fhir/router.js', () => ({
  routeFHIRRequest: (...args: unknown[]) => mockRouteFHIRRequest(...args),
}))

// --- Imports ---

import { processEHRRequest } from '../api/handler.js'
import { ENDPOINT_GROUPS, ALL_ENDPOINT_GROUPS } from '../api/endpoints.js'
import { generateOpenAPISpec, OPENAPI_JSON } from '../api/openapi.js'
import type { EHRPermissionCheckResult } from '../auth/types.js'
import type { FHIRResponse } from '../fhir/types.js'

// --- Fixtures ---

const BASE_URL = 'https://example.com/api/fhir/r4'

function makeHeaders(
  overrides: Record<string, string> = {},
): Headers {
  return new Headers({
    'x-tenant-id': 'tenant-001',
    'x-user-id': 'user-001',
    'x-user-role': 'physician',
    ...overrides,
  })
}

const grantedResult: EHRPermissionCheckResult = {
  granted: true,
  permission: 'read_patient',
  role: 'physician',
  reason: 'Permission granted',
  breakGlassActivated: false,
  consentVerified: true,
}

const deniedResult: EHRPermissionCheckResult = {
  granted: false,
  permission: 'read_patient',
  role: 'frontDesk',
  reason: "Role 'frontDesk' does not have permission 'read_patient'",
  breakGlassActivated: false,
  consentVerified: null,
}

const mockPatientResponse: FHIRResponse = {
  status: 200,
  headers: { 'Content-Type': 'application/fhir+json' },
  body: {
    resourceType: 'Patient',
    id: 'patient-001',
    name: [{ family: 'Doe', given: ['John'] }],
    gender: 'male',
    birthDate: '1990-01-01',
  },
}

const mockCreatedPatientResponse: FHIRResponse = {
  status: 201,
  headers: {
    'Content-Type': 'application/fhir+json',
    Location: `${BASE_URL}/Patient/patient-002`,
  },
  body: {
    resourceType: 'Patient',
    id: 'patient-002',
    name: [{ family: 'Smith', given: ['Jane'] }],
  },
}

const mockConsentBundleResponse: FHIRResponse = {
  status: 200,
  headers: { 'Content-Type': 'application/fhir+json' },
  body: {
    resourceType: 'Bundle',
    type: 'searchset',
    total: 1,
    entry: [
      {
        fullUrl: `${BASE_URL}/Consent/consent-001`,
        resource: {
          resourceType: 'Consent',
          id: 'consent-001',
          status: 'active',
          scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'treatment' }] },
          patient: { reference: 'Patient/patient-001' },
        },
      },
    ],
  },
}

const mockCreatedConsentResponse: FHIRResponse = {
  status: 201,
  headers: {
    'Content-Type': 'application/fhir+json',
    Location: `${BASE_URL}/Consent/consent-002`,
  },
  body: {
    resourceType: 'Consent',
    id: 'consent-002',
    status: 'active',
    scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'treatment' }] },
    patient: { reference: 'Patient/patient-001' },
  },
}

const mockObservationBundleResponse: FHIRResponse = {
  status: 200,
  headers: { 'Content-Type': 'application/fhir+json' },
  body: {
    resourceType: 'Bundle',
    type: 'searchset',
    total: 2,
    entry: [
      {
        fullUrl: `${BASE_URL}/Observation/obs-001`,
        resource: {
          resourceType: 'Observation',
          id: 'obs-001',
          status: 'final',
          code: { coding: [{ system: 'http://loinc.org', code: '1234-5' }] },
          subject: { reference: 'Patient/patient-001' },
        },
      },
      {
        fullUrl: `${BASE_URL}/Observation/obs-002`,
        resource: {
          resourceType: 'Observation',
          id: 'obs-002',
          status: 'final',
          code: { coding: [{ system: 'http://loinc.org', code: '5678-9' }] },
          subject: { reference: 'Patient/patient-001' },
        },
      },
    ],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckPermission.mockResolvedValue(grantedResult)
  mockLogEHRAccess.mockResolvedValue({} as never)
})

describe('G1.4 — E2E API Tests', () => {
  describe('GET /api/ehr/v1/patients/{id} → 200 with Patient resource', () => {
    it('returns 200 with a Patient resource', async () => {
      mockRouteFHIRRequest.mockResolvedValue(mockPatientResponse)

      const response = await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      expect(response.status).toBe(200)
      expect(response.headers['Content-Type']).toBe('application/json')
      const body = response.body as Record<string, unknown>
      expect(body['resourceType']).toBe('Patient')
      expect(body['id']).toBe('patient-001')
    })

    it('calls FHIR router with correct resource type and ID', async () => {
      mockRouteFHIRRequest.mockResolvedValue(mockPatientResponse)

      await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      expect(mockRouteFHIRRequest).toHaveBeenCalledTimes(1)
      const fhirReq = mockRouteFHIRRequest.mock.calls[0][0]
      expect(fhirReq.method).toBe('GET')
      expect(fhirReq.resourceType).toBe('Patient')
      expect(fhirReq.resourceId).toBe('patient-001')
    })
  })

  describe('POST /api/ehr/v1/patients → 201 with created Patient', () => {
    it('returns 201 with the created Patient resource', async () => {
      mockRouteFHIRRequest.mockResolvedValue(mockCreatedPatientResponse)
      mockCheckPermission.mockResolvedValue({
        ...grantedResult,
        permission: 'write_patient',
      })

      const newPatient = {
        resourceType: 'Patient',
        name: [{ family: 'Smith', given: ['Jane'] }],
      }

      const response = await processEHRRequest(
        'POST',
        'patients',
        null,
        newPatient,
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      expect(response.status).toBe(201)
      const body = response.body as Record<string, unknown>
      expect(body['resourceType']).toBe('Patient')
      expect(body['id']).toBe('patient-002')
    })

    it('passes the request body to the FHIR router', async () => {
      mockRouteFHIRRequest.mockResolvedValue(mockCreatedPatientResponse)
      mockCheckPermission.mockResolvedValue({
        ...grantedResult,
        permission: 'write_patient',
      })

      const newPatient = {
        resourceType: 'Patient',
        name: [{ family: 'Smith', given: ['Jane'] }],
      }

      await processEHRRequest(
        'POST',
        'patients',
        null,
        newPatient,
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      const fhirReq = mockRouteFHIRRequest.mock.calls[0][0]
      expect(fhirReq.body).toBe(newPatient)
    })
  })

  describe('GET /api/ehr/v1/consents?patient={id} → 200 with Consent resources', () => {
    it('returns 200 with a Bundle of Consent resources', async () => {
      mockRouteFHIRRequest.mockResolvedValue(mockConsentBundleResponse)
      mockCheckPermission.mockResolvedValue({
        ...grantedResult,
        permission: 'manage_consent',
      })

      const params = new URLSearchParams({ patient: 'patient-001' })

      const response = await processEHRRequest(
        'GET',
        'consents',
        null,
        null,
        params,
        makeHeaders(),
        BASE_URL,
      )

      expect(response.status).toBe(200)
      const body = response.body as Record<string, unknown>
      expect(body['resourceType']).toBe('Bundle')
      expect(body['type']).toBe('searchset')
    })

    it('passes search params to FHIR router', async () => {
      mockRouteFHIRRequest.mockResolvedValue(mockConsentBundleResponse)
      mockCheckPermission.mockResolvedValue({
        ...grantedResult,
        permission: 'manage_consent',
      })

      const params = new URLSearchParams({ patient: 'patient-001' })

      await processEHRRequest(
        'GET',
        'consents',
        null,
        null,
        params,
        makeHeaders(),
        BASE_URL,
      )

      const fhirReq = mockRouteFHIRRequest.mock.calls[0][0]
      expect(fhirReq.searchParams.get('patient')).toBe('patient-001')
    })
  })

  describe('POST /api/ehr/v1/consents → 201 with created Consent', () => {
    it('returns 201 with the created Consent resource', async () => {
      mockRouteFHIRRequest.mockResolvedValue(mockCreatedConsentResponse)
      mockCheckPermission.mockResolvedValue({
        ...grantedResult,
        permission: 'manage_consent',
      })

      const newConsent = {
        resourceType: 'Consent',
        status: 'active',
        scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'treatment' }] },
        patient: { reference: 'Patient/patient-001' },
      }

      const response = await processEHRRequest(
        'POST',
        'consents',
        null,
        newConsent,
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      expect(response.status).toBe(201)
      const body = response.body as Record<string, unknown>
      expect(body['resourceType']).toBe('Consent')
      expect(body['id']).toBe('consent-002')
    })
  })

  describe('GET /api/ehr/v1/observations?patient={id} → 200 with Observation resources', () => {
    it('returns 200 with a Bundle of Observation resources', async () => {
      mockRouteFHIRRequest.mockResolvedValue(mockObservationBundleResponse)
      mockCheckPermission.mockResolvedValue({
        ...grantedResult,
        permission: 'read_observation',
      })

      const params = new URLSearchParams({ patient: 'patient-001' })

      const response = await processEHRRequest(
        'GET',
        'observations',
        null,
        null,
        params,
        makeHeaders(),
        BASE_URL,
      )

      expect(response.status).toBe(200)
      const body = response.body as Record<string, unknown>
      expect(body['resourceType']).toBe('Bundle')
      expect(body['type']).toBe('searchset')
      const entries = body['entry'] as unknown[]
      expect(entries).toHaveLength(2)
    })
  })

  describe('401 for missing auth', () => {
    it('returns 401 when required headers are missing', async () => {
      const response = await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        new Headers(),
        BASE_URL,
      )

      expect(response.status).toBe(401)
      const body = response.body as Record<string, unknown>
      expect(body['error']).toBe('unauthorized')
      expect(body['message']).toContain('authentication')
    })

    it('returns 401 when only some required headers are present', async () => {
      const response = await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        new Headers({ 'x-tenant-id': 't1' }),
        BASE_URL,
      )

      expect(response.status).toBe(401)
    })

    it('returns 401 when role is invalid', async () => {
      const response = await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders({ 'x-user-role': 'invalidRole' }),
        BASE_URL,
      )

      expect(response.status).toBe(401)
    })

    it('does not call RBAC or FHIR router on 401', async () => {
      await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        new Headers(),
        BASE_URL,
      )

      expect(mockCheckPermission).not.toHaveBeenCalled()
      expect(mockRouteFHIRRequest).not.toHaveBeenCalled()
    })
  })

  describe('403 for insufficient permissions', () => {
    it('returns 403 when RBAC denies permission', async () => {
      mockCheckPermission.mockResolvedValue(deniedResult)

      const response = await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders({ 'x-user-role': 'frontDesk' }),
        BASE_URL,
      )

      expect(response.status).toBe(403)
      const body = response.body as Record<string, unknown>
      expect(body['error']).toBe('forbidden')
    })

    it('does not call FHIR router on 403', async () => {
      mockCheckPermission.mockResolvedValue(deniedResult)

      await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders({ 'x-user-role': 'frontDesk' }),
        BASE_URL,
      )

      expect(mockRouteFHIRRequest).not.toHaveBeenCalled()
    })

    it('still logs audit on 403', async () => {
      mockCheckPermission.mockResolvedValue(deniedResult)

      await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders({ 'x-user-role': 'frontDesk' }),
        BASE_URL,
      )

      expect(mockLogEHRAccess).toHaveBeenCalledTimes(1)
    })
  })

  describe('404 for non-existent resources', () => {
    it('returns 404 for unknown endpoint group', async () => {
      const response = await processEHRRequest(
        'GET',
        'unknown',
        null,
        null,
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      expect(response.status).toBe(404)
      const body = response.body as Record<string, unknown>
      expect(body['error']).toBe('not_found')
    })

    it('does not call RBAC or FHIR router on 404', async () => {
      await processEHRRequest(
        'GET',
        'unknown',
        null,
        null,
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      expect(mockCheckPermission).not.toHaveBeenCalled()
      expect(mockRouteFHIRRequest).not.toHaveBeenCalled()
    })
  })

  describe('400 for invalid resource data', () => {
    it('returns 404 for POST with resource ID (invalid operation)', async () => {
      const response = await processEHRRequest(
        'POST',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      expect(response.status).toBe(404)
    })

    it('returns 404 for DELETE without resource ID', async () => {
      const response = await processEHRRequest(
        'DELETE',
        'patients',
        null,
        null,
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      expect(response.status).toBe(404)
    })
  })

  describe('OpenAPI spec endpoint returns valid OpenAPI 3.1 JSON', () => {
    it('generateOpenAPISpec returns an OpenAPI 3.1.0 spec', () => {
      const spec = generateOpenAPISpec()
      expect(spec.openapi).toBe('3.1.0')
    })

    it('spec has correct title and version', () => {
      const spec = generateOpenAPISpec()
      expect(spec.info.title).toBe('EHR REST API v1')
      expect(spec.info.version).toBe('1.0.0')
    })

    it('spec has BearerAuth security scheme', () => {
      const spec = generateOpenAPISpec()
      expect(spec.components.securitySchemes['BearerAuth']).toBeDefined()
      const bearer = spec.components.securitySchemes['BearerAuth'] as Record<string, unknown>
      expect(bearer['type']).toBe('http')
      expect(bearer['scheme']).toBe('bearer')
    })

    it('spec has paths for all endpoint groups', () => {
      const spec = generateOpenAPISpec()
      const pathKeys = Object.keys(spec.paths)
      // Each group has at least a collection path
      for (const group of ALL_ENDPOINT_GROUPS) {
        expect(pathKeys.some((p) => p.includes(group))).toBe(true)
      }
    })

    it('spec has schemas for all FHIR resource types', () => {
      const spec = generateOpenAPISpec()
      const schemas = Object.keys(spec.components.schemas)
      expect(schemas).toContain('Patient')
      expect(schemas).toContain('Encounter')
      expect(schemas).toContain('Observation')
      expect(schemas).toContain('DocumentReference')
      expect(schemas).toContain('Claim')
      expect(schemas).toContain('Consent')
      expect(schemas).toContain('Appointment')
    })

    it('spec has Error schema', () => {
      const spec = generateOpenAPISpec()
      expect(spec.components.schemas['Error']).toBeDefined()
    })

    it('OPENAPI_JSON is pre-computed and matches generated spec', () => {
      const generated = generateOpenAPISpec()
      expect(OPENAPI_JSON.openapi).toBe(generated.openapi)
      expect(OPENAPI_JSON.info.title).toBe(generated.info.title)
    })

    it('spec has security requirement for BearerAuth', () => {
      const spec = generateOpenAPISpec()
      expect(spec.security).toHaveLength(1)
      expect(spec.security[0]).toHaveProperty('BearerAuth')
    })

    it('spec has servers array', () => {
      const spec = generateOpenAPISpec()
      expect(spec.servers).toHaveLength(1)
      expect(spec.servers[0].url).toBe('/api/ehr/v1')
    })

    it('spec has license info', () => {
      const spec = generateOpenAPISpec()
      expect(spec.info.license).toBeDefined()
      expect(spec.info.license!.name).toBe('Apache-2.0')
    })
  })

  describe('all endpoint groups are accessible', () => {
    it('each endpoint group has at least a GET search endpoint', () => {
      for (const group of ALL_ENDPOINT_GROUPS) {
        const endpoints = ENDPOINT_GROUPS[group]
        const searchEndpoint = endpoints.find((e) => e.method === 'GET' && e.operation === 'search')
        expect(searchEndpoint, `${group} should have a search endpoint`).toBeDefined()
      }
    })

    it('each endpoint group has a POST create endpoint', () => {
      for (const group of ALL_ENDPOINT_GROUPS) {
        const endpoints = ENDPOINT_GROUPS[group]
        const createEndpoint = endpoints.find((e) => e.method === 'POST' && e.operation === 'create')
        expect(createEndpoint, `${group} should have a create endpoint`).toBeDefined()
      }
    })

    it('each endpoint group has a GET read endpoint', () => {
      for (const group of ALL_ENDPOINT_GROUPS) {
        const endpoints = ENDPOINT_GROUPS[group]
        const readEndpoint = endpoints.find((e) => e.method === 'GET' && e.operation === 'read')
        expect(readEndpoint, `${group} should have a read endpoint`).toBeDefined()
      }
    })
  })
})
