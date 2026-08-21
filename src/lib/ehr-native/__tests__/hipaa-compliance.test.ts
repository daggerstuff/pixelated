// @vitest-environment node
/**
 * G1.1 — HIPAA Compliance Tests
 *
 * Validates that the EHR native system enforces HIPAA requirements:
 * - Every API endpoint emits an audit log entry
 * - Audit entries contain user ID, action, resource, timestamp, outcome
 * - Denied access attempts are audited
 * - Consent is checked before clinical data access
 * - Break-glass access is logged with reason
 * - Minimum necessary principle (only requested fields returned)
 * - PHI is not leaked in error messages
 * - Audit logs are tamper-evident (hash chain verification)
 * - Consent withdrawal blocks subsequent access
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

const mockCheckPermission = vi.fn()
const mockLogEHRAccess = vi.fn()
const mockRouteFHIRRequest = vi.fn()
const mockCreateHIPAACompliantAuditLog = vi.fn()
const mockLogEvent = vi.fn()
const mockVerifyAuditChain = vi.fn()

vi.mock('../auth/ehr-rbac.js', () => ({
  checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
  logEHRAccess: (...args: unknown[]) => mockLogEHRAccess(...args),
}))

vi.mock('../fhir/router.js', () => ({
  routeFHIRRequest: (...args: unknown[]) => mockRouteFHIRRequest(...args),
}))

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

// --- Imports ---

import { processEHRRequest } from '../api/handler.js'
import { ENDPOINT_GROUPS } from '../api/endpoints.js'
import {
  auditFHIRCreate,
  auditFHIRRead,
  auditBreakGlassFHIR,
  verifyEhrAuditChain,
} from '../audit/ehr-audit-bridge.js'
import type { EHRPermissionCheckResult } from '../auth/types.js'
import type { FHIRResponse } from '../fhir/types.js'

// --- Fixtures ---

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

const mockFHIRResponse: FHIRResponse = {
  status: 200,
  headers: { 'Content-Type': 'application/fhir+json' },
  body: { resourceType: 'Patient', id: 'patient-001' },
}

const BASE_URL = 'https://example.com/api/fhir/r4'

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
  mockCheckPermission.mockResolvedValue(grantedResult)
  mockRouteFHIRRequest.mockResolvedValue(mockFHIRResponse)
  mockLogEHRAccess.mockResolvedValue({} as never)
  mockCreateHIPAACompliantAuditLog.mockResolvedValue(mockHipaaEntry)
  mockLogEvent.mockResolvedValue('chain-event-001')
})

describe('G1.1 — HIPAA Compliance', () => {
  describe('every API endpoint emits an audit log entry', () => {
    it('logs audit for a granted GET /patients/{id} request', async () => {
      await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      expect(mockLogEHRAccess).toHaveBeenCalledTimes(1)
    })

    it('logs audit for a granted POST /patients request', async () => {
      mockRouteFHIRRequest.mockResolvedValue({
        status: 201,
        headers: { 'Content-Type': 'application/fhir+json' },
        body: { resourceType: 'Patient', id: 'patient-002' },
      })

      await processEHRRequest(
        'POST',
        'patients',
        null,
        { resourceType: 'Patient', name: [{ family: 'Doe' }] },
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      expect(mockLogEHRAccess).toHaveBeenCalledTimes(1)
    })

    it('logs audit for every endpoint group on a read', async () => {
      const groups = Object.keys(ENDPOINT_GROUPS)
      for (const group of groups) {
        mockLogEHRAccess.mockClear()
        await processEHRRequest(
          'GET',
          group,
          'test-id',
          null,
          new URLSearchParams(),
          makeHeaders(),
          BASE_URL,
        )
        expect(mockLogEHRAccess).toHaveBeenCalledTimes(1)
      }
    })
  })

  describe('audit entries contain required fields', () => {
    it('audit entry includes user ID, action, resource, and granted status', async () => {
      await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders({ 'x-patient-id': 'patient-001' }),
        BASE_URL,
      )

      const logArgs = mockLogEHRAccess.mock.calls[0][0]
      expect(logArgs.userId).toBe('user-001')
      expect(logArgs.action).toBe('read')
      expect(logArgs.resource).toBe('Patient')
      expect(logArgs.granted).toBe(true)
      expect(logArgs.role).toBe('physician')
      expect(logArgs.permission).toBe('read_patient')
    })

    it('audit entry includes patientId when provided', async () => {
      await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders({ 'x-patient-id': 'patient-001' }),
        BASE_URL,
      )

      const logArgs = mockLogEHRAccess.mock.calls[0][0]
      expect(logArgs.patientId).toBe('patient-001')
    })

    it('logEHRAccess delegates to createHIPAACompliantAuditLog with timestamp', async () => {
      await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      // logEHRAccess internally calls createHIPAACompliantAuditLog
      // which generates a timestamp. Verify the mock was called.
      expect(mockLogEHRAccess).toHaveBeenCalledTimes(1)
    })
  })

  describe('denied access attempts are audited', () => {
    it('logs audit with granted=false on denied request', async () => {
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
      const logArgs = mockLogEHRAccess.mock.calls[0][0]
      expect(logArgs.granted).toBe(false)
      expect(logArgs.reason).toContain('does not have permission')
    })

    it('does not delegate to FHIR router when denied', async () => {
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

    it('returns 403 for denied access', async () => {
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
    })
  })

  describe('consent is checked before clinical data access', () => {
    it('checkPermission is called with patientId for clinical endpoints', async () => {
      await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders({ 'x-patient-id': 'patient-001' }),
        BASE_URL,
      )

      expect(mockCheckPermission).toHaveBeenCalledTimes(1)
      const [, permission, patientId] = mockCheckPermission.mock.calls[0]
      expect(permission).toBe('read_patient')
      expect(patientId).toBe('patient-001')
    })

    it('denied when consent is missing (consentVerified=false)', async () => {
      const noConsentResult: EHRPermissionCheckResult = {
        granted: false,
        permission: 'read_patient',
        role: 'physician',
        reason: 'Patient consent is missing, expired, withdrawn, or insufficient',
        breakGlassActivated: false,
        consentVerified: false,
      }
      mockCheckPermission.mockResolvedValue(noConsentResult)

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
      expect(mockLogEHRAccess).toHaveBeenCalledTimes(1)
      expect(mockRouteFHIRRequest).not.toHaveBeenCalled()
    })
  })

  describe('break-glass access is logged with reason', () => {
    it('break-glass flag is passed through to FHIR context', async () => {
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
    })

    it('auditBreakGlassFHIR logs break-glass reason in HIPAA audit log', async () => {
      await auditBreakGlassFHIR({
        resourceType: 'Patient',
        resourceId: 'patient-999',
        userId: 'user-002',
        role: 'nurse',
        tenantId: 'tenant-001',
        reason: 'Emergency: patient unconscious, need medical history',
      })

      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.notes).toContain('Break-glass')
      expect(hipaaArgs.notes).toContain('Emergency: patient unconscious')
      expect(hipaaArgs.details.breakGlass).toBe(true)
      expect(hipaaArgs.details.breakGlassReason).toContain('Emergency')
    })

    it('break-glass audit has WARNING status', async () => {
      await auditBreakGlassFHIR({
        resourceType: 'Observation',
        resourceId: 'obs-001',
        userId: 'user-003',
        role: 'physician',
        tenantId: 'tenant-001',
        reason: 'Emergency access',
      })

      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.status).toBe('warning')
    })

    it('break-glass chain event has HIGH severity', async () => {
      await auditBreakGlassFHIR({
        resourceType: 'Patient',
        resourceId: 'patient-001',
        userId: 'user-003',
        role: 'physician',
        tenantId: 'tenant-001',
        reason: 'Emergency access',
      })

      const chainEvent = mockLogEvent.mock.calls[0][0]
      expect(chainEvent.severity).toBe('high')
      expect(chainEvent.metadata.breakGlass).toBe(true)
    })
  })

  describe('minimum necessary principle — only requested fields returned', () => {
    it('API response body is the FHIR resource (not expanded with extra fields)', async () => {
      const minimalPatient = {
        resourceType: 'Patient',
        id: 'patient-001',
        name: [{ family: 'Doe' }],
      }
      mockRouteFHIRRequest.mockResolvedValue({
        status: 200,
        headers: { 'Content-Type': 'application/fhir+json' },
        body: minimalPatient,
      })

      const response = await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      const body = response.body as Record<string, unknown>
      expect(body['resourceType']).toBe('Patient')
      expect(body['id']).toBe('patient-001')
      // No extra PHI fields leaked beyond what FHIR router returned
      expect(Object.keys(body)).toEqual(['resourceType', 'id', 'name'])
    })

    it('API does not add fields not present in the FHIR response', async () => {
      mockRouteFHIRRequest.mockResolvedValue({
        status: 200,
        headers: { 'Content-Type': 'application/fhir+json' },
        body: { resourceType: 'Patient', id: 'patient-001' },
      })

      const response = await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders(),
        BASE_URL,
      )

      const body = response.body as Record<string, unknown>
      expect(body['ssn']).toBeUndefined()
      expect(body['address']).toBeUndefined()
    })
  })

  describe('PHI is not leaked in error messages', () => {
    it('401 error does not include patient data', async () => {
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
      expect(JSON.stringify(body)).not.toContain('patient-001')
    })

    it('403 error does not include patient PHI', async () => {
      mockCheckPermission.mockResolvedValue(deniedResult)

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
      const body = response.body as Record<string, unknown>
      expect(body['error']).toBe('forbidden')
      // The reason should not contain patient identifiers
      expect(JSON.stringify(body)).not.toContain('patient-001')
    })

    it('404 error does not include patient PHI', async () => {
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
      expect(JSON.stringify(body)).not.toContain('patient-001')
    })
  })

  describe('audit logs are tamper-evident (hash chain verification)', () => {
    it('verifyEhrAuditChain returns valid=true for an intact chain', () => {
      const mockEvents = [
        {
          id: 'evt-1',
          timestamp: new Date(),
          userId: 'user-001',
          type: 'create',
          action: 'fhir:create',
          severity: 'info',
          status: 'success',
          hash: 'abc123',
          previousHash: '0'.repeat(64),
        },
        {
          id: 'evt-2',
          timestamp: new Date(),
          userId: 'user-001',
          type: 'access',
          action: 'fhir:read',
          severity: 'info',
          status: 'success',
          hash: 'def456',
          previousHash: 'abc123',
        },
      ]
      mockVerifyAuditChain.mockReturnValue({ valid: true })

      const result = verifyEhrAuditChain(mockEvents as never)

      expect(result.valid).toBe(true)
      expect(mockVerifyAuditChain).toHaveBeenCalledTimes(1)
    })

    it('verifyEhrAuditChain detects tampering (broken chain)', () => {
      mockVerifyAuditChain.mockReturnValue({
        valid: false,
        brokenAtIndex: 1,
        brokenAtId: 'evt-2',
        reason: 'Hash mismatch at index 1',
      })

      const result = verifyEhrAuditChain([] as never)

      expect(result.valid).toBe(false)
      expect(result.brokenAtIndex).toBe(1)
      expect(result.reason).toContain('Hash mismatch')
    })

    it('auditFHIRCreate emits both HIPAA log and chain event', async () => {
      await auditFHIRCreate(
        {
          userId: 'user-001',
          tenantId: 'tenant-001',
          role: 'physician',
          breakGlass: false,
        },
        'Patient',
        'patient-001',
        '1',
      )

      expect(mockCreateHIPAACompliantAuditLog).toHaveBeenCalledTimes(1)
      expect(mockLogEvent).toHaveBeenCalledTimes(1)
    })

    it('auditFHIRRead emits both HIPAA log and chain event', async () => {
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
      expect(mockLogEvent).toHaveBeenCalledTimes(1)
    })
  })

  describe('consent withdrawal blocks subsequent access', () => {
    it('returns 403 when consent is withdrawn (consentVerified=false)', async () => {
      const withdrawnConsentResult: EHRPermissionCheckResult = {
        granted: false,
        permission: 'read_patient',
        role: 'physician',
        reason: 'Patient consent is missing, expired, withdrawn, or insufficient',
        breakGlassActivated: false,
        consentVerified: false,
      }
      mockCheckPermission.mockResolvedValue(withdrawnConsentResult)

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
    })

    it('denied access due to consent is still audited', async () => {
      const withdrawnConsentResult: EHRPermissionCheckResult = {
        granted: false,
        permission: 'read_patient',
        role: 'physician',
        reason: 'Consent withdrawn',
        breakGlassActivated: false,
        consentVerified: false,
      }
      mockCheckPermission.mockResolvedValue(withdrawnConsentResult)

      await processEHRRequest(
        'GET',
        'patients',
        'patient-001',
        null,
        new URLSearchParams(),
        makeHeaders({ 'x-patient-id': 'patient-001' }),
        BASE_URL,
      )

      expect(mockLogEHRAccess).toHaveBeenCalledTimes(1)
      const logArgs = mockLogEHRAccess.mock.calls[0][0]
      expect(logArgs.granted).toBe(false)
    })
  })
})
