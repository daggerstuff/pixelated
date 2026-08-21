// @vitest-environment node
/**
 * G1.3 — Integration Tests
 *
 * Tests full consent → access → audit flow across EHR native components.
 * All external dependencies (DB, Redis) are mocked.
 *
 * Flows tested:
 * - record consent → check consent → access resource → verify audit log
 * - withdraw consent → verify access denied → verify audit logged
 * - consent expiry → verify access denied
 * - break-glass access → verify audit with reason
 * - RBAC role check → consent check → resource access → audit
 * - API handler → RBAC → consent → FHIR router → audit → response
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-001'),
}))

const mockCreateHIPAACompliantAuditLog = vi.fn()
const mockLogEvent = vi.fn()
const mockVerifyAuditChain = vi.fn()

vi.mock('@/lib/audit', () => ({
  createHIPAACompliantAuditLog: (...args: unknown[]) =>
    mockCreateHIPAACompliantAuditLog(...args),
  AuditEventType: {
    ACCESS: 'access',
    ACCESS_DENIED: 'access_denied',
    CREATE: 'create',
    MODIFY: 'modify',
    DELETE: 'delete',
    CONSENT: 'consent',
    SECURITY: 'security',
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
    SECURITY: 'security',
  },
  AuditSeverity: {
    INFO: 'info',
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },
}))

vi.mock('@/lib/audit/logger', () => ({
  AuditLogger: {
    getInstance: () => ({
      logEvent: (...args: unknown[]) => mockLogEvent(...args),
    }),
  },
  verifyAuditChain: (...args: unknown[]) => mockVerifyAuditChain(...args),
}))

vi.mock('@/lib/consent/ConsentExpiryService', () => ({
  getConsentExpiryService: vi.fn(() => ({
    getExpiringConsents: vi.fn().mockResolvedValue([]),
    checkExpiries: vi.fn().mockResolvedValue({
      checkedAt: new Date().toISOString(),
      totalChecked: 0,
      reminders: [],
      summary: { expiringSoon: 0, expiringCritical: 0, expired: 0 },
    }),
  })),
}))

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

import { ConsentEngine } from '../consent/consent-engine.js'
import type { ConsentResource } from '../types/consent.js'
import { processEHRRequest } from '../api/handler.js'
import {
  auditFHIRCreate,
  auditFHIRRead,
  auditBreakGlassFHIR,
} from '../audit/ehr-audit-bridge.js'
import type { EHRPermissionCheckResult } from '../auth/types.js'
import type { FHIRResponse } from '../fhir/types.js'

// --- Fixtures ---

function makeMockPool() {
  const queryMock = vi.fn()
  const pool = { query: queryMock } as unknown as { query: typeof queryMock }
  return { pool, queryMock }
}

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

const BASE_URL = 'https://example.com/api/fhir/r4'

function makeActiveConsentResource(
  consentId: string,
  patientId: string,
  treatmentType: string,
  expiresAt: string | null = null,
): ConsentResource {
  const now = new Date().toISOString()
  return {
    resourceType: 'Consent',
    id: consentId,
    status: 'active',
    scope: {
      coding: [
        { system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'treatment' },
      ],
    },
    category: [
      {
        coding: [
          { system: 'http://pixelated.example.com/fhir/consent/treatment-type', code: treatmentType },
        ],
      },
    ],
    patient: { reference: `Patient/${patientId}` },
    dateTime: now,
    performer: [{ reference: 'Practitioner/performer-001' }],
    provision: {
      type: 'permit',
      period: expiresAt ? { start: now, end: expiresAt } : { start: now },
    },
  } as ConsentResource
}

function makeWithdrawnConsentResource(
  consentId: string,
  patientId: string,
  treatmentType: string,
): ConsentResource {
  const now = new Date().toISOString()
  return {
    resourceType: 'Consent',
    id: consentId,
    status: 'inactive',
    scope: {
      coding: [
        { system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'treatment' },
      ],
    },
    category: [
      {
        coding: [
          { system: 'http://pixelated.example.com/fhir/consent/treatment-type', code: treatmentType },
        ],
      },
    ],
    patient: { reference: `Patient/${patientId}` },
    dateTime: now,
    performer: [{ reference: 'Practitioner/performer-001' }],
    provision: {
      type: 'deny',
      period: { start: now },
    },
  } as ConsentResource
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

const mockFHIRResponse: FHIRResponse = {
  status: 200,
  headers: { 'Content-Type': 'application/fhir+json' },
  body: { resourceType: 'Patient', id: 'patient-001' },
}

const mockHipaaEntry = {
  id: 'hipaa-log-001',
  timestamp: new Date().toISOString(),
  userId: 'user-001',
  action: 'read',
  eventType: 'access',
  status: 'success',
  resource: 'Patient',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateHIPAACompliantAuditLog.mockResolvedValue(mockHipaaEntry)
  mockLogEvent.mockResolvedValue('chain-event-001')
  mockCheckPermission.mockResolvedValue(grantedResult)
  mockRouteFHIRRequest.mockResolvedValue(mockFHIRResponse)
  mockLogEHRAccess.mockResolvedValue({} as never)
})

describe('G1.3 — Integration Tests', () => {
  describe('full consent → access → audit flow', () => {
    it('record consent → check consent → access resource → verify audit log', async () => {
      const { pool, queryMock } = makeMockPool()
      const engine = new ConsentEngine(pool as never, {
        defaultExpiryDays: 365,
        warningDays: 30,
        criticalDays: 7,
      })

      // Step 1: Record consent
      queryMock.mockResolvedValue({ rows: [] })
      const record = await engine.recordConsent(
        'patient-001',
        'therapy',
        'treatment',
        'Practitioner/performer-001',
      )
      expect(record.status).toBe('active')
      expect(record.patientId).toBe('patient-001')
      expect(mockCreateHIPAACompliantAuditLog).toHaveBeenCalledTimes(1)

      // Step 2: Check consent (should find active consent)
      const activeResource = makeActiveConsentResource('consent-001', 'patient-001', 'therapy')
      queryMock.mockResolvedValue({
        rows: [{ consent_id: 'consent-001', fhir_resource: activeResource, period_end: null }],
      })
      const consentResult = await engine.checkConsent('patient-001', 'therapy')
      expect(consentResult.hasConsent).toBe(true)
      expect(consentResult.status).toBe('active')

      // Step 3: Access resource via API (RBAC + consent already verified)
      const response = await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders({ 'x-patient-id': 'patient-001' }),
        BASE_URL,
      )
      expect(response.status).toBe(200)
      expect(mockRouteFHIRRequest).toHaveBeenCalledTimes(1)

      // Step 4: Verify audit log was emitted
      expect(mockLogEHRAccess).toHaveBeenCalledTimes(1)
      const auditArgs = mockLogEHRAccess.mock.calls[0][0]
      expect(auditArgs.granted).toBe(true)
      expect(auditArgs.userId).toBe('user-001')
      expect(auditArgs.resource).toBe('Patient')
    })
  })

  describe('withdraw consent → access denied → audit logged', () => {
    it('withdraw consent blocks subsequent access and logs audit', async () => {
      const { pool, queryMock } = makeMockPool()
      const engine = new ConsentEngine(pool as never, {
        defaultExpiryDays: 365,
        warningDays: 30,
        criticalDays: 7,
      })

      // Step 1: Withdraw consent
      const activeResource = makeActiveConsentResource('consent-001', 'patient-001', 'therapy')
      queryMock
        .mockResolvedValueOnce({
          rows: [{ consent_id: 'consent-001', fhir_resource: activeResource, patient_id: 'patient-001', period_end: null }],
        })
        .mockResolvedValueOnce({
          rows: [{ fhir_resource: activeResource }],
        })
        .mockResolvedValue({ rows: [] })

      const withdrawn = await engine.withdrawConsent('consent-001', 'Patient withdrew', 'Practitioner/withdrawer-001')
      expect(withdrawn).not.toBeNull()
      expect(withdrawn!.status).toBe('withdrawn')
      expect(mockCreateHIPAACompliantAuditLog).toHaveBeenCalledTimes(1)

      // Step 2: Check consent (should find withdrawn consent)
      const withdrawnResource = makeWithdrawnConsentResource('consent-001', 'patient-001', 'therapy')
      queryMock.mockResolvedValue({
        rows: [{ consent_id: 'consent-001', fhir_resource: withdrawnResource, period_end: null }],
      })
      const consentResult = await engine.checkConsent('patient-001', 'therapy')
      expect(consentResult.hasConsent).toBe(false)
      expect(consentResult.status).toBe('withdrawn')

      // Step 3: API access denied due to consent
      const consentDeniedResult: EHRPermissionCheckResult = {
        granted: false,
        permission: 'read_patient',
        role: 'physician',
        reason: 'Consent withdrawn',
        breakGlassActivated: false,
        consentVerified: false,
      }
      mockCheckPermission.mockResolvedValue(consentDeniedResult)

      const response = await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders({ 'x-patient-id': 'patient-001' }),
        BASE_URL,
      )
      expect(response.status).toBe(403)
      expect(mockRouteFHIRRequest).not.toHaveBeenCalled()

      // Step 4: Verify audit logged for denied access
      expect(mockLogEHRAccess).toHaveBeenCalledTimes(1)
      const auditArgs = mockLogEHRAccess.mock.calls[0][0]
      expect(auditArgs.granted).toBe(false)
    })
  })

  describe('consent expiry → access denied', () => {
    it('expired consent is detected and access is denied', async () => {
      const { pool, queryMock } = makeMockPool()
      const engine = new ConsentEngine(pool as never, {
        defaultExpiryDays: 365,
        warningDays: 30,
        criticalDays: 7,
      })

      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const expiredResource = makeActiveConsentResource('consent-001', 'patient-001', 'therapy', pastDate)
      queryMock.mockResolvedValue({
        rows: [{ consent_id: 'consent-001', fhir_resource: expiredResource, period_end: pastDate }],
      })

      const result = await engine.checkConsent('patient-001', 'therapy')
      expect(result.hasConsent).toBe(false)
      expect(result.status).toBe('expired')
      expect(result.reason).toContain('expired')
    })

    it('expired consent leads to denied API access', async () => {
      const expiredConsentResult: EHRPermissionCheckResult = {
        granted: false,
        permission: 'read_patient',
        role: 'physician',
        reason: 'Consent expired',
        breakGlassActivated: false,
        consentVerified: false,
      }
      mockCheckPermission.mockResolvedValue(expiredConsentResult)

      const response = await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders({ 'x-patient-id': 'patient-001' }),
        BASE_URL,
      )

      expect(response.status).toBe(403)
      expect(mockRouteFHIRRequest).not.toHaveBeenCalled()
      expect(mockLogEHRAccess).toHaveBeenCalledTimes(1)
    })
  })

  describe('break-glass access → audit with reason', () => {
    it('break-glass access is audited with reason in both audit systems', async () => {
      await auditBreakGlassFHIR({
        resourceType: 'Patient',
        resourceId: 'patient-001',
        userId: 'user-002',
        role: 'nurse',
        tenantId: 'tenant-001',
        reason: 'Emergency: patient unconscious',
      })

      // HIPAA audit log
      expect(mockCreateHIPAACompliantAuditLog).toHaveBeenCalledTimes(1)
      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.notes).toContain('Break-glass')
      expect(hipaaArgs.notes).toContain('Emergency: patient unconscious')
      expect(hipaaArgs.details.breakGlass).toBe(true)

      // Chain event
      expect(mockLogEvent).toHaveBeenCalledTimes(1)
      const chainEvent = mockLogEvent.mock.calls[0][0]
      expect(chainEvent.severity).toBe('high')
      expect(chainEvent.metadata.breakGlass).toBe(true)
    })

    it('break-glass flag passes through API handler to FHIR context', async () => {
      await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders({
          'x-break-glass': 'true',
          'x-patient-id': 'patient-001',
        }),
        BASE_URL,
      )

      expect(mockRouteFHIRRequest).toHaveBeenCalledTimes(1)
      const fhirReq = mockRouteFHIRRequest.mock.calls[0][0]
      expect(fhirReq.context.breakGlass).toBe(true)
      expect(fhirReq.context.jwtClaims['break_glass']).toBe(true)
    })
  })

  describe('RBAC role check → consent check → resource access → audit', () => {
    it('full pipeline: RBAC grants, consent verified, FHIR router called, audit logged', async () => {
      const response = await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders({ 'x-patient-id': 'patient-001' }),
        BASE_URL,
      )

      // RBAC check happened
      expect(mockCheckPermission).toHaveBeenCalledTimes(1)
      const [role, permission, patientId] = mockCheckPermission.mock.calls[0]
      expect(role).toBe('physician')
      expect(permission).toBe('read_patient')
      expect(patientId).toBe('patient-001')

      // FHIR router was called
      expect(mockRouteFHIRRequest).toHaveBeenCalledTimes(1)

      // Audit was logged
      expect(mockLogEHRAccess).toHaveBeenCalledTimes(1)
      const auditArgs = mockLogEHRAccess.mock.calls[0][0]
      expect(auditArgs.granted).toBe(true)
      expect(auditArgs.action).toBe('read')
      expect(auditArgs.resource).toBe('Patient')

      // Response is correct
      expect(response.status).toBe(200)
    })

    it('RBAC denies → no FHIR router call → audit logged with denied', async () => {
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

      expect(mockCheckPermission).toHaveBeenCalledTimes(1)
      expect(mockRouteFHIRRequest).not.toHaveBeenCalled()
      expect(mockLogEHRAccess).toHaveBeenCalledTimes(1)
      expect(mockLogEHRAccess.mock.calls[0][0].granted).toBe(false)
      expect(response.status).toBe(403)
    })
  })

  describe('API handler → RBAC → consent → FHIR router → audit → response', () => {
    it('POST /patients creates a Patient resource through the full pipeline', async () => {
      mockRouteFHIRRequest.mockResolvedValue({
        status: 201,
        headers: { 'Content-Type': 'application/fhir+json', Location: `${BASE_URL}/Patient/patient-002` },
        body: { resourceType: 'Patient', id: 'patient-002' },
      })

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
      expect(mockCheckPermission).toHaveBeenCalledTimes(1)
      expect(mockRouteFHIRRequest).toHaveBeenCalledTimes(1)
      expect(mockLogEHRAccess).toHaveBeenCalledTimes(1)
    })

    it('GET /observations returns observations through the full pipeline', async () => {
      mockRouteFHIRRequest.mockResolvedValue({
        status: 200,
        headers: { 'Content-Type': 'application/fhir+json' },
        body: {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 1,
          entry: [{ fullUrl: `${BASE_URL}/Observation/obs-1`, resource: { resourceType: 'Observation', id: 'obs-1' } }],
        },
      })

      const response = await processEHRRequest(
        'GET',
        'observations',
        null,
        null,
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      expect(response.status).toBe(200)
      const body = response.body as Record<string, unknown>
      expect(body['resourceType']).toBe('Bundle')
      expect(mockCheckPermission).toHaveBeenCalledTimes(1)
      expect(mockRouteFHIRRequest).toHaveBeenCalledTimes(1)
      expect(mockLogEHRAccess).toHaveBeenCalledTimes(1)
    })

    it('GET /consents returns consent resources through the full pipeline', async () => {
      mockRouteFHIRRequest.mockResolvedValue({
        status: 200,
        headers: { 'Content-Type': 'application/fhir+json' },
        body: {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 1,
          entry: [{ resource: { resourceType: 'Consent', id: 'consent-1', status: 'active' } }],
        },
      })

      const response = await processEHRRequest(
        'GET',
        'consents',
        null,
        null,
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      expect(response.status).toBe(200)
      expect(mockCheckPermission).toHaveBeenCalledTimes(1)
      const [, permission] = mockCheckPermission.mock.calls[0]
      expect(permission).toBe('manage_consent')
    })
  })

  describe('audit bridge integration with consent engine', () => {
    it('auditFHIRCreate emits audit for consent creation', async () => {
      await auditFHIRCreate(
        {
          userId: 'user-001',
          tenantId: 'tenant-001',
          role: 'physician',
          breakGlass: false,
        },
        'Consent',
        'consent-001',
        '1',
      )

      expect(mockCreateHIPAACompliantAuditLog).toHaveBeenCalledTimes(1)
      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.resource).toBe('FHIR/Consent')
      expect(hipaaArgs.resourceId).toBe('consent-001')
    })

    it('auditFHIRRead emits audit for patient read', async () => {
      await auditFHIRRead(
        {
          userId: 'user-001',
          tenantId: 'tenant-001',
          role: 'physician',
          breakGlass: false,
        },
        'Patient',
        'patient-001',
      )

      expect(mockCreateHIPAACompliantAuditLog).toHaveBeenCalledTimes(1)
      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.action).toBe('fhir:read')
      expect(hipaaArgs.eventType).toBe('access')
    })
  })
})
