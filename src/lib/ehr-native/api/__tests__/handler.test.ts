// @vitest-environment node
/**
 * Tests for EHR REST API v1 handler — RBAC enforcement, FHIR delegation, audit logging.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the RBAC module
vi.mock('../../auth/ehr-rbac.js', () => ({
  checkPermission: vi.fn(),
  logEHRAccess: vi.fn(),
}))

// Mock the FHIR router
vi.mock('../../fhir/router.js', () => ({
  routeFHIRRequest: vi.fn(),
}))

import { checkPermission, logEHRAccess } from '../../auth/ehr-rbac.js'
import { routeFHIRRequest } from '../../fhir/router.js'
import type { EHRPermissionCheckResult } from '../../auth/types.js'
import type { FHIRResponse } from '../../fhir/types.js'
import {
  extractAPIRequestContext,
  toFHIRRequestContext,
  buildFHIRRequest,
  resolveEndpoint,
  processEHRRequest,
} from '../handler.js'
import { ENDPOINT_GROUPS } from '../endpoints.js'

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
  consentVerified: null,
}

const deniedResult: EHRPermissionCheckResult = {
  granted: false,
  permission: 'read_patient',
  role: 'frontDesk',
  reason: "Role 'frontDesk' does not have permission 'read_patient'",
  breakGlassActivated: false,
  consentVerified: null,
}

const mockFHIRResponse: FHIRResponse = {
  status: 200,
  headers: { 'Content-Type': 'application/fhir+json' },
  body: { resourceType: 'Patient', id: 'patient-001' },
}

const mockCreateResponse: FHIRResponse = {
  status: 201,
  headers: { 'Content-Type': 'application/fhir+json', Location: 'https://example.com/api/fhir/r4/Patient/patient-001' },
  body: { resourceType: 'Patient', id: 'patient-001' },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(checkPermission).mockResolvedValue(grantedResult)
  vi.mocked(routeFHIRRequest).mockResolvedValue(mockFHIRResponse)
  vi.mocked(logEHRAccess).mockResolvedValue({} as never)
})

describe('extractAPIRequestContext', () => {
  it('returns null when required headers are missing', () => {
    expect(extractAPIRequestContext(new Headers())).toBeNull()
    expect(
      extractAPIRequestContext(new Headers({ 'x-tenant-id': 't1' })),
    ).toBeNull()
    expect(
      extractAPIRequestContext(
        new Headers({ 'x-tenant-id': 't1', 'x-user-id': 'u1' }),
      ),
    ).toBeNull()
  })

  it('returns null when role is invalid', () => {
    const ctx = extractAPIRequestContext(
      makeHeaders({ 'x-user-role': 'invalidRole' }),
    )
    expect(ctx).toBeNull()
  })

  it('extracts all fields from valid headers', () => {
    const ctx = extractAPIRequestContext(
      makeHeaders({
        'x-break-glass': 'true',
        'x-patient-id': 'patient-123',
        'x-forwarded-for': '10.0.0.1',
        'user-agent': 'test-agent',
        'x-session-id': 'sess-001',
      }),
    )
    expect(ctx).toEqual({
      userId: 'user-001',
      role: 'physician',
      tenantId: 'tenant-001',
      patientId: 'patient-123',
      breakGlass: true,
      ipAddress: '10.0.0.1',
      userAgent: 'test-agent',
      sessionId: 'sess-001',
    })
  })

  it('defaults breakGlass to false when header absent', () => {
    const ctx = extractAPIRequestContext(makeHeaders())
    expect(ctx?.breakGlass).toBe(false)
  })
})

describe('toFHIRRequestContext', () => {
  it('maps APIRequestContext to FHIRRequestContext', () => {
    const ctx = extractAPIRequestContext(makeHeaders({ 'x-patient-id': 'p1' }))!
    const fhirCtx = toFHIRRequestContext(ctx)
    expect(fhirCtx.tenantId).toBe('tenant-001')
    expect(fhirCtx.userId).toBe('user-001')
    expect(fhirCtx.role).toBe('physician')
    expect(fhirCtx.breakGlass).toBe(false)
    expect(fhirCtx.jwtClaims['sub']).toBe('user-001')
    expect(fhirCtx.jwtClaims['role']).toBe('physician')
    expect(fhirCtx.jwtClaims['patientId']).toBe('p1')
  })

  it('passes break-glass flag through', () => {
    const ctx = extractAPIRequestContext(
      makeHeaders({ 'x-break-glass': 'true' }),
    )!
    const fhirCtx = toFHIRRequestContext(ctx)
    expect(fhirCtx.breakGlass).toBe(true)
    expect(fhirCtx.jwtClaims['break_glass']).toBe(true)
  })

  it('passes client context (ipAddress, userAgent, sessionId) through', () => {
    const ctx = extractAPIRequestContext(
      makeHeaders({
        'x-forwarded-for': '10.0.0.42',
        'user-agent': 'TestAgent/2.0',
        'x-session-id': 'sess-bgp-001',
      }),
    )!
    const fhirCtx = toFHIRRequestContext(ctx)
    expect(fhirCtx.ipAddress).toBe('10.0.0.42')
    expect(fhirCtx.userAgent).toBe('TestAgent/2.0')
    expect(fhirCtx.sessionId).toBe('sess-bgp-001')
  })
})

describe('buildFHIRRequest', () => {
  it('builds a FHIRRequest with correct fields', () => {
    const ctx = extractAPIRequestContext(makeHeaders())!
    const fhirCtx = toFHIRRequestContext(ctx)
    const searchParams = new URLSearchParams()
    const req = buildFHIRRequest(
      'GET',
      'Patient',
      'patient-001',
      null,
      fhirCtx,
      searchParams,
    )
    expect(req.method).toBe('GET')
    expect(req.resourceType).toBe('Patient')
    expect(req.resourceId).toBe('patient-001')
    expect(req.isHistory).toBe(false)
    expect(req.isMetadata).toBe(false)
    expect(req.body).toBeNull()
    expect(req.ifMatch).toBeNull()
    expect(req.context).toBe(fhirCtx)
  })
})

describe('resolveEndpoint', () => {
  it('returns null for unknown group', () => {
    expect(resolveEndpoint('unknown', 'GET', false)).toBeNull()
  })

  it('resolves search endpoint (GET without resource ID)', () => {
    const ep = resolveEndpoint('patients', 'GET', false)
    expect(ep).not.toBeNull()
    expect(ep?.operation).toBe('search')
    expect(ep?.resourceType).toBe('Patient')
  })

  it('resolves read endpoint (GET with resource ID)', () => {
    const ep = resolveEndpoint('patients', 'GET', true)
    expect(ep).not.toBeNull()
    expect(ep?.operation).toBe('read')
    expect(ep?.resourceType).toBe('Patient')
  })

  it('resolves create endpoint (POST without resource ID)', () => {
    const ep = resolveEndpoint('patients', 'POST', false)
    expect(ep).not.toBeNull()
    expect(ep?.operation).toBe('create')
  })

  it('resolves update endpoint (PUT with resource ID)', () => {
    const ep = resolveEndpoint('patients', 'PUT', true)
    expect(ep).not.toBeNull()
    expect(ep?.operation).toBe('update')
  })

  it('resolves delete endpoint (DELETE with resource ID)', () => {
    const ep = resolveEndpoint('patients', 'DELETE', true)
    expect(ep).not.toBeNull()
    expect(ep?.operation).toBe('delete')
  })

  it('returns null for POST with resource ID (not a valid operation)', () => {
    expect(resolveEndpoint('patients', 'POST', true)).toBeNull()
  })

  it('returns null for DELETE without resource ID', () => {
    expect(resolveEndpoint('patients', 'DELETE', false)).toBeNull()
  })
})

describe('processEHRRequest — permission denied', () => {
  it('returns 403 when permission is denied', async () => {
    vi.mocked(checkPermission).mockResolvedValue(deniedResult)

    const response = await processEHRRequest(
      'GET',
      'patients',
      null,
      null,
      new URLSearchParams(),
      makeHeaders({ 'x-user-role': 'frontDesk' }),
      BASE_URL,
    )

    expect(response.status).toBe(403)
    expect(response.headers['Content-Type']).toBe('application/json')
    expect(response.body).toEqual({
      error: 'forbidden',
      message: deniedResult.reason,
    })
  })

  it('logs audit event on denied request', async () => {
    vi.mocked(checkPermission).mockResolvedValue(deniedResult)

    await processEHRRequest(
      'GET',
      'patients',
      null,
      null,
      new URLSearchParams(),
      makeHeaders({ 'x-user-role': 'frontDesk' }),
      BASE_URL,
    )

    expect(logEHRAccess).toHaveBeenCalledOnce()
    const logArgs = vi.mocked(logEHRAccess).mock.calls[0][0]
    expect(logArgs.granted).toBe(false)
    expect(logArgs.permission).toBe('read_patient')
    expect(logArgs.role).toBe('frontDesk')
  })

  it('does not delegate to FHIR router when denied', async () => {
    vi.mocked(checkPermission).mockResolvedValue(deniedResult)

    await processEHRRequest(
      'GET',
      'patients',
      null,
      null,
      new URLSearchParams(),
      makeHeaders({ 'x-user-role': 'frontDesk' }),
      BASE_URL,
    )

    expect(routeFHIRRequest).not.toHaveBeenCalled()
  })
})

describe('processEHRRequest — permission granted', () => {
  it('delegates to FHIR router and returns 200 for read', async () => {
    const response = await processEHRRequest(
      'GET',
      'patients',
      'patient-001',
      null,
      new URLSearchParams(),
      makeHeaders(),
      BASE_URL,
    )

    expect(checkPermission).toHaveBeenCalledOnce()
    expect(routeFHIRRequest).toHaveBeenCalledOnce()
    expect(response.status).toBe(200)
    expect(response.headers['Content-Type']).toBe('application/json')
  })

  it('returns 201 for create', async () => {
    vi.mocked(routeFHIRRequest).mockResolvedValue(mockCreateResponse)

    const response = await processEHRRequest(
      'POST',
      'patients',
      null,
      { resourceType: 'Patient', name: [{ family: 'Doe' }] },
      new URLSearchParams(),
      makeHeaders(),
      BASE_URL,
    )

    expect(response.status).toBe(201)
  })

  it('logs audit event on granted request', async () => {
    await processEHRRequest(
      'GET',
      'patients',
      'patient-001',
      null,
      new URLSearchParams(),
      makeHeaders(),
      BASE_URL,
    )

    expect(logEHRAccess).toHaveBeenCalledOnce()
    const logArgs = vi.mocked(logEHRAccess).mock.calls[0][0]
    expect(logArgs.granted).toBe(true)
    expect(logArgs.action).toBe('read')
    expect(logArgs.resource).toBe('Patient')
  })

  it('passes break-glass flag through to FHIR context', async () => {
    await processEHRRequest(
      'GET',
      'patients',
      'patient-001',
      null,
      new URLSearchParams(),
      makeHeaders({ 'x-break-glass': 'true' }),
      BASE_URL,
    )

    expect(routeFHIRRequest).toHaveBeenCalledOnce()
    const fhirReq = vi.mocked(routeFHIRRequest).mock.calls[0][0]
    expect(fhirReq.context.breakGlass).toBe(true)
  })
})

describe('processEHRRequest — missing context', () => {
  it('returns 401 when required headers are missing', async () => {
    const response = await processEHRRequest(
      'GET',
      'patients',
      null,
      null,
      new URLSearchParams(),
      new Headers(),
      BASE_URL,
    )

    expect(response.status).toBe(401)
    expect(response.body).toEqual({
      error: 'unauthorized',
      message: 'Missing or invalid authentication headers',
    })
    expect(checkPermission).not.toHaveBeenCalled()
    expect(routeFHIRRequest).not.toHaveBeenCalled()
  })
})

describe('processEHRRequest — invalid endpoint group', () => {
  it('returns 404 for unknown group', async () => {
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
    expect(response.body).toEqual({
      error: 'not_found',
      message: 'No endpoint found for GET /unknown',
    })
    expect(checkPermission).not.toHaveBeenCalled()
  })
})

describe('endpoint group → FHIR resource type mapping', () => {
  it('patients group maps to Patient', () => {
    const ep = resolveEndpoint('patients', 'GET', false)
    expect(ep?.resourceType).toBe('Patient')
  })

  it('encounters group maps to Encounter', () => {
    const ep = resolveEndpoint('encounters', 'GET', false)
    expect(ep?.resourceType).toBe('Encounter')
  })

  it('appointments group maps to Appointment', () => {
    const ep = resolveEndpoint('appointments', 'GET', false)
    expect(ep?.resourceType).toBe('Appointment')
  })

  it('notes group maps to DocumentReference', () => {
    const ep = resolveEndpoint('notes', 'GET', false)
    expect(ep?.resourceType).toBe('DocumentReference')
  })

  it('claims group maps to Claim', () => {
    const ep = resolveEndpoint('claims', 'GET', false)
    expect(ep?.resourceType).toBe('Claim')
  })

  it('consents group maps to Consent', () => {
    const ep = resolveEndpoint('consents', 'GET', false)
    expect(ep?.resourceType).toBe('Consent')
  })

  it('observations group maps to Observation', () => {
    const ep = resolveEndpoint('observations', 'GET', false)
    expect(ep?.resourceType).toBe('Observation')
  })
})

describe('audit logging on every request', () => {
  it('logs audit on granted request', async () => {
    await processEHRRequest(
      'GET',
      'patients',
      'p1',
      null,
      new URLSearchParams(),
      makeHeaders(),
      BASE_URL,
    )
    expect(logEHRAccess).toHaveBeenCalledOnce()
  })

  it('logs audit on denied request', async () => {
    vi.mocked(checkPermission).mockResolvedValue(deniedResult)
    await processEHRRequest(
      'GET',
      'patients',
      'p1',
      null,
      new URLSearchParams(),
      makeHeaders({ 'x-user-role': 'frontDesk' }),
      BASE_URL,
    )
    expect(logEHRAccess).toHaveBeenCalledOnce()
  })

  it('does NOT log audit on 401 (missing context)', async () => {
    await processEHRRequest(
      'GET',
      'patients',
      null,
      null,
      new URLSearchParams(),
      new Headers(),
      BASE_URL,
    )
    expect(logEHRAccess).not.toHaveBeenCalled()
  })

  it('does NOT log audit on 404 (invalid endpoint)', async () => {
    await processEHRRequest(
      'GET',
      'unknown',
      null,
      null,
      new URLSearchParams(),
      makeHeaders(),
      BASE_URL,
    )
    expect(logEHRAccess).not.toHaveBeenCalled()
  })
})

describe('ENDPOINT_GROUPS completeness', () => {
  it('has all 7 endpoint groups', () => {
    const groups = Object.keys(ENDPOINT_GROUPS)
    expect(groups).toHaveLength(7)
    expect(groups).toContain('patients')
    expect(groups).toContain('encounters')
    expect(groups).toContain('appointments')
    expect(groups).toContain('notes')
    expect(groups).toContain('claims')
    expect(groups).toContain('consents')
    expect(groups).toContain('observations')
  })

  it('notes group has no DELETE operation', () => {
    const notesEndpoints = ENDPOINT_GROUPS.notes
    expect(notesEndpoints.find((e) => e.method === 'DELETE')).toBeUndefined()
  })

  it('claims group has no DELETE operation', () => {
    const claimsEndpoints = ENDPOINT_GROUPS.claims
    expect(claimsEndpoints.find((e) => e.method === 'DELETE')).toBeUndefined()
  })

  it('consents group has no DELETE operation', () => {
    const consentsEndpoints = ENDPOINT_GROUPS.consents
    expect(consentsEndpoints.find((e) => e.method === 'DELETE')).toBeUndefined()
  })

  it('observations group has no DELETE operation', () => {
    const observationsEndpoints = ENDPOINT_GROUPS.observations
    expect(observationsEndpoints.find((e) => e.method === 'DELETE')).toBeUndefined()
  })
})
