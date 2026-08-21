// @vitest-environment node
/**
 * G1.6 — FHIR R4 Conformance Gate
 *
 * Acceptance criteria (from GitHub issue #5554):
 * 1. CapabilityStatement accessible at `/fhir/r4/metadata`
 * 2. All required FHIR R4 resources supported (Patient, Encounter, Appointment,
 *    DocumentReference, Claim, Consent, Observation)
 * 3. Inferno/Touchstone-style structural validation passes with no critical failures
 * 4. Search parameters work for all resources
 * 5. Versioning and history endpoints functional
 *
 * This gate test validates the full conformance surface end-to-end via the router,
 * the CapabilityStatement generator, and the history endpoint — not just unit
 * properties of individual functions.
 */

import { describe, it, expect, vi } from 'vitest'

// --- Mocks (history/search hit DB) ---

vi.mock('../repositories/index.js', () => ({
  searchDedicatedResources: vi.fn().mockResolvedValue({ resources: [], total: 0 }),
  searchGenericResources: vi.fn().mockResolvedValue({ resources: [], total: 0 }),
  getDedicatedResourceHistory: vi.fn().mockResolvedValue([
    {
      resource: { id: 'pat-001', resourceType: 'Patient', version: 1 },
      timestamp: '2026-01-01T00:00:00Z',
      action: 'create',
    },
    {
      resource: { id: 'pat-001', resourceType: 'Patient', version: 2 },
      timestamp: '2026-01-02T00:00:00Z',
      action: 'update',
    },
  ]),
  getGenericResourceHistory: vi.fn().mockResolvedValue([
    {
      resource: { id: 'cond-001', resourceType: 'Condition', version: 1 },
      timestamp: '2026-01-01T00:00:00Z',
      action: 'create',
    },
  ]),
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
  getDedicatedResourceHistory: vi.fn().mockResolvedValue([
    {
      resource: { id: 'pat-001', resourceType: 'Patient', version: 1 },
      timestamp: '2026-01-01T00:00:00Z',
      action: 'create',
    },
    {
      resource: { id: 'pat-001', resourceType: 'Patient', version: 2 },
      timestamp: '2026-01-02T00:00:00Z',
      action: 'update',
    },
  ]),
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
  AuditEventType: { ACCESS: 'access', CREATE: 'create', UPDATE: 'update', DELETE: 'delete' },
  AuditSeverity: { INFO: 'info', LOW: 'low', MEDIUM: 'medium', HIGH: 'high' },
}))

vi.mock('@/lib/audit/logger', () => ({
  AuditLogger: { getInstance: () => ({ logEvent: vi.fn().mockResolvedValue('chain-001') }) },
  verifyAuditChain: vi.fn(),
}))

vi.mock('../audit/middleware.js', () => ({
  buildEhrAuditContext: vi.fn().mockReturnValue({
    userId: 'user-001',
    tenantId: 'tenant-001',
    role: 'physician',
    breakGlass: false,
  }),
  preWriteAudit: vi.fn(),
  postWriteAudit: vi.fn(),
  postWriteFailureAudit: vi.fn(),
  readAudit: vi.fn(),
}))

vi.mock('../audit/ehr-audit-bridge.js', () => ({
  auditFHIREvent: vi.fn(),
  auditFHIRRead: vi.fn(),
  auditBreakGlassFHIR: vi.fn(),
  verifyEhrAuditChain: vi.fn(),
}))

// --- Imports ---

import { routeFHIRRequest } from '../router.js'
import { generateCapabilityStatement, capabilityStatementResponse } from '../capability-statement.js'
import { SUPPORTED_RESOURCE_TYPES } from '../types.js'
import type { FHIRRequest, FHIRResourceType } from '../types.js'

const BASE_URL = 'https://example.com/fhir/r4'

function metadataRequest(): FHIRRequest {
  return {
    method: 'GET',
    resourceType: null,
    resourceId: null,
    isHistory: false,
    isMetadata: true,
    searchParams: new URLSearchParams(),
    body: null,
    ifMatch: null,
    context: {
      tenantId: 'tenant-001',
      userId: 'user-001',
      role: 'physician',
      breakGlass: false,
      jwtClaims: { sub: 'user-001', role: 'physician' },
    },
  }
}

function historyRequest(
  resourceType: FHIRResourceType,
  resourceId: string,
): FHIRRequest {
  return {
    method: 'GET',
    resourceType,
    resourceId,
    isHistory: true,
    isMetadata: false,
    searchParams: new URLSearchParams(),
    body: null,
    ifMatch: null,
    context: {
      tenantId: 'tenant-001',
      userId: 'user-001',
      role: 'physician',
      breakGlass: false,
      jwtClaims: { sub: 'user-001', role: 'physician' },
    },
  }
}

// ---------------------------------------------------------------
// Acceptance 1: CapabilityStatement accessible at /fhir/r4/metadata
// ---------------------------------------------------------------

describe('G1.6 — Acceptance 1: CapabilityStatement via router metadata endpoint', () => {
  it('router returns CapabilityStatement for metadata request', async () => {
    const response = await routeFHIRRequest(metadataRequest(), BASE_URL)
    expect(response.status).toBe(200)
    expect(response.headers['Content-Type']).toBe('application/fhir+json')
  })

  it('router returns a body with resourceType CapabilityStatement', async () => {
    const response = await routeFHIRRequest(metadataRequest(), BASE_URL)
    const body = response.body as Record<string, unknown>
    expect(body['resourceType']).toBe('CapabilityStatement')
  })

  it('capabilityStatementResponse returns no-store cache header', () => {
    const response = capabilityStatementResponse(BASE_URL)
    expect(response.headers['Cache-Control']).toBe('no-store')
  })
})

// ---------------------------------------------------------------------
// Acceptance 2: All required FHIR R4 resources supported
// ---------------------------------------------------------------------

const REQUIRED_RESOURCES: FHIRResourceType[] = [
  'Patient',
  'Encounter',
  'Appointment',
  'DocumentReference',
  'Claim',
  'Consent',
  'Observation',
]

describe('G1.6 — Acceptance 2: Required FHIR R4 resources supported', () => {
  const cs = generateCapabilityStatement(BASE_URL) as Record<string, unknown>
  const rest = cs['rest'] as Array<Record<string, unknown>>
  const resources = rest[0]['resource'] as Array<Record<string, unknown>>
  const resourceTypes = resources.map((r) => r['type'] as string)

  for (const required of REQUIRED_RESOURCES) {
    it(`CapabilityStatement includes ${required}`, () => {
      expect(resourceTypes).toContain(required)
    })
  }

  it('all 7 required resources are present (bulk check)', () => {
    for (const required of REQUIRED_RESOURCES) {
      expect(resourceTypes).toContain(required)
    }
  })

  it('all required resources are in SUPPORTED_RESOURCE_TYPES', () => {
    for (const required of REQUIRED_RESOURCES) {
      expect(SUPPORTED_RESOURCE_TYPES).toContain(required)
    }
  })
})

// ---------------------------------------------------------------------
// Acceptance 3: Inferno/Touchstone-style structural validation
// ---------------------------------------------------------------------

describe('G1.6 — Acceptance 3: Inferno-style structural validation', () => {
  const cs = generateCapabilityStatement(BASE_URL) as Record<string, unknown>

  // Top-level required fields
  it('resourceType is CapabilityStatement', () => {
    expect(cs['resourceType']).toBe('CapabilityStatement')
  })

  it('status is active', () => {
    expect(cs['status']).toBe('active')
  })

  it('date is a valid ISO date (YYYY-MM-DD)', () => {
    expect(cs['date']).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('kind is instance', () => {
    expect(cs['kind']).toBe('instance')
  })

  it('fhirVersion is 4.0.1', () => {
    expect(cs['fhirVersion']).toBe('4.0.1')
  })

  it('format includes json', () => {
    const format = cs['format'] as string[]
    expect(format).toContain('json')
  })

  it('implementation has description and url', () => {
    const impl = cs['implementation'] as Record<string, unknown>
    expect(impl['description']).toBeDefined()
    expect(impl['url']).toBe(BASE_URL)
  })

  // Rest array structure
  it('rest is a non-empty array', () => {
    const rest = cs['rest'] as unknown[]
    expect(Array.isArray(rest)).toBe(true)
    expect(rest.length).toBeGreaterThan(0)
  })

  it('rest[0] mode is server', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    expect(rest[0]['mode']).toBe('server')
  })

  it('rest[0] security has cors and service', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    const security = rest[0]['security'] as Record<string, unknown>
    expect(security).toBeDefined()
    expect(security['cors']).toBeDefined()
    expect(Array.isArray(security['service'])).toBe(true)
  })

  // Resource entries validation
  it('rest[0].resource is a non-empty array', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    const resources = rest[0]['resource'] as unknown[]
    expect(Array.isArray(resources)).toBe(true)
    expect(resources.length).toBeGreaterThan(0)
  })

  it('each resource entry has type, interaction, searchParam, and versioning', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    const resources = rest[0]['resource'] as Array<Record<string, unknown>>
    for (const res of resources) {
      expect(res['type']).toBeDefined()
      expect(Array.isArray(res['interaction'])).toBe(true)
      expect(Array.isArray(res['searchParam'])).toBe(true)
      expect(res['versioning']).toBeDefined()
    }
  })

  it('each interaction has a code from the FHIR R4 interaction set', () => {
    const validCodes = new Set([
      'read',
      'search-type',
      'create',
      'update',
      'delete',
      'history-instance',
    ])
    const rest = cs['rest'] as Array<Record<string, unknown>>
    const resources = rest[0]['resource'] as Array<Record<string, unknown>>
    for (const res of resources) {
      const interactions = res['interaction'] as Array<Record<string, string>>
      for (const i of interactions) {
        expect(validCodes.has(i['code'])).toBe(true)
      }
    }
  })

  it('each searchParam has name and type', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    const resources = rest[0]['resource'] as Array<Record<string, unknown>>
    for (const res of resources) {
      const params = res['searchParam'] as Array<Record<string, string>>
      for (const p of params) {
        expect(p['name']).toBeDefined()
        expect(p['type']).toBeDefined()
      }
    }
  })

  // Operations
  it('rest[0] has metadata operation', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    const ops = rest[0]['operation'] as Array<Record<string, string>>
    const metadataOp = ops.find((op) => op['name'] === 'metadata')
    expect(metadataOp).toBeDefined()
    expect(metadataOp!['definition']).toContain('/metadata')
  })

  // No unsupported features claimed
  it('conditionalCreate is false', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    const resources = rest[0]['resource'] as Array<Record<string, unknown>>
    for (const res of resources) {
      expect(res['conditionalCreate']).toBe(false)
    }
  })

  it('conditionalDelete is not-supported', () => {
    const rest = cs['rest'] as Array<Record<string, unknown>>
    const resources = rest[0]['resource'] as Array<Record<string, unknown>>
    for (const res of resources) {
      expect(res['conditionalDelete']).toBe('not-supported')
    }
  })
})

// ---------------------------------------------------------------------
// Acceptance 4: Search parameters for all required resources
// ---------------------------------------------------------------------

const EXPECTED_SEARCH_PARAMS: Partial<
  Record<FHIRResourceType, string[]>
> = {
  Patient: ['name', 'family', 'given', 'identifier', 'birthdate', 'gender', 'active'],
  Encounter: ['patient', 'practitioner', 'status', 'class', 'date'],
  Appointment: ['patient', 'practitioner', 'status', 'date'],
  DocumentReference: ['patient', 'type', 'status'],
  Claim: ['patient', 'status', 'use'],
  Consent: ['patient', 'status', 'scope'],
  Observation: ['patient', 'encounter', 'code', 'status', 'date'],
}

const COMMON_PARAM_NAMES = ['_id', '_count', '_offset', '_format']

describe('G1.6 — Acceptance 4: Search parameters for all required resources', () => {
  const cs = generateCapabilityStatement(BASE_URL) as Record<string, unknown>
  const rest = cs['rest'] as Array<Record<string, unknown>>
  const resources = rest[0]['resource'] as Array<Record<string, unknown>>
  const resourceMap = new Map(
    resources.map((r) => [r['type'] as string, r]),
  )

  for (const [resourceType, expectedParams] of Object.entries(EXPECTED_SEARCH_PARAMS)) {
    describe(`${resourceType} search parameters`, () => {
      const resource = resourceMap.get(resourceType)
      const searchParams = (resource?.['searchParam'] ?? []) as Array<
        Record<string, string>
      >
      const paramNames = searchParams.map((p) => p['name'])

      it(`${resourceType} has common search params`, () => {
        for (const common of COMMON_PARAM_NAMES) {
          expect(paramNames).toContain(common)
        }
      })

      it(`${resourceType} has resource-specific search params`, () => {
        for (const expected of expectedParams!) {
          expect(paramNames).toContain(expected)
        }
      })

      it(`${resourceType} search params have valid FHIR types`, () => {
        const validTypes = new Set([
          'string',
          'token',
          'date',
          'reference',
          'number',
        ])
        for (const p of searchParams) {
          expect(validTypes.has(p['type'])).toBe(true)
        }
      })
    })
  }
})

// ---------------------------------------------------------------------
// Acceptance 5: Versioning and history endpoints functional
// ---------------------------------------------------------------------

describe('G1.6 — Acceptance 5: Versioning and history endpoints', () => {
  const cs = generateCapabilityStatement(BASE_URL) as Record<string, unknown>
  const rest = cs['rest'] as Array<Record<string, unknown>>
  const resources = rest[0]['resource'] as Array<Record<string, unknown>>

  // CapabilityStatement declares versioning support
  it('each resource declares versioned versioning', () => {
    for (const res of resources) {
      expect(res['versioning']).toBe('versioned')
    }
  })

  it('each resource declares readHistory true', () => {
    for (const res of resources) {
      expect(res['readHistory']).toBe(true)
    }
  })

  it('each resource declares updateCreate true', () => {
    for (const res of resources) {
      expect(res['updateCreate']).toBe(true)
    }
  })

  it('history-instance interaction is declared for each resource', () => {
    for (const res of resources) {
      const interactions = res['interaction'] as Array<
        Record<string, string>
      >
      const codes = interactions.map((i) => i['code'])
      expect(codes).toContain('history-instance')
    }
  })

  // Router routes history requests correctly
  it('router routes history request to getResourceHistory', async () => {
    const response = await routeFHIRRequest(
      historyRequest('Patient', 'pat-001'),
      BASE_URL,
    )
    // The mocked getDedicatedResourceHistory returns 2 versions
    expect(response.status).toBe(200)
    const body = response.body as Record<string, unknown>
    expect(body['resourceType']).toBe('Bundle')
    expect(body['type']).toBe('history')
  })

  it('router rejects non-GET history requests', async () => {
    const request: FHIRRequest = {
      ...historyRequest('Patient', 'pat-001'),
      method: 'POST',
    }
    const response = await routeFHIRRequest(request, BASE_URL)
    expect(response.status).toBe(400)
  })

  it('router rejects history without resource ID', async () => {
    const request: FHIRRequest = {
      ...historyRequest('Patient', 'pat-001'),
      resourceId: null,
    }
    const response = await routeFHIRRequest(request, BASE_URL)
    expect(response.status).toBe(400)
  })

  // History response contains entries
  it('history response contains entries array', async () => {
    const response = await routeFHIRRequest(
      historyRequest('Patient', 'pat-001'),
      BASE_URL,
    )
    const body = response.body as Record<string, unknown>
    const entries = body['entry'] as unknown[]
    expect(Array.isArray(entries)).toBe(true)
    expect(entries.length).toBeGreaterThan(0)
  })

  it('history response has total field', async () => {
    const response = await routeFHIRRequest(
      historyRequest('Patient', 'pat-001'),
      BASE_URL,
    )
    const body = response.body as Record<string, unknown>
    expect(body['total']).toBeDefined()
  })
})
