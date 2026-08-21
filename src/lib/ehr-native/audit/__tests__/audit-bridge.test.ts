// @vitest-environment node
/**
 * Tests for the EHR Audit Bridge — verifies that FHIR R4 write/read
 * operations emit audit events through both the HIPAA-compliant audit
 * log and the tamper-evident chain.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

const mockCreateHIPAACompliantAuditLog = vi.fn()
const mockLogEvent = vi.fn()
const mockVerifyAuditChain = vi.fn()

vi.mock('@/lib/audit', () => ({
  createHIPAACompliantAuditLog: (...args: unknown[]) =>
    mockCreateHIPAACompliantAuditLog(...args),
  AuditEventType: {
    ACCESS: 'access',
    CREATE: 'create',
    MODIFY: 'modify',
    DELETE: 'delete',
    SECURITY: 'security',
    SYSTEM: 'system',
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
    SYSTEM: 'system',
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

// --- Imports (after mocks are set up) ---

import type { FHIRRequestContext } from '../../fhir/types.js'
import {
  auditFHIRCreate,
  auditFHIRUpdate,
  auditFHIRDelete,
  auditFHIRRead,
  auditFHIRFailure,
  auditBreakGlassFHIR,
  auditFHIREvent,
  verifyEhrAuditChain,
} from '../ehr-audit-bridge.js'
import {
  buildEhrAuditContext,
  preWriteAudit,
  postWriteAudit,
  postWriteFailureAudit,
  readAudit,
} from '../middleware.js'
import type { EhrAuditContext } from '../types.js'

// --- Test fixtures ---

const baseCtx: EhrAuditContext = {
  userId: 'user-001',
  tenantId: 'tenant-001',
  role: 'physician',
  breakGlass: false,
}

const breakGlassCtx: EhrAuditContext = {
  userId: 'user-002',
  tenantId: 'tenant-001',
  role: 'nurse',
  breakGlass: true,
  breakGlassReason: 'Emergency access for patient care',
  ipAddress: '10.0.0.42',
  userAgent: 'Mozilla/5.0',
  sessionId: 'session-abc',
}

const mockFhirContext: FHIRRequestContext = {
  tenantId: 'tenant-001',
  userId: 'user-001',
  role: 'physician',
  breakGlass: false,
  jwtClaims: { sub: 'user-001', role: 'physician' },
}

const breakGlassFhirContext: FHIRRequestContext = {
  tenantId: 'tenant-001',
  userId: 'user-002',
  role: 'nurse',
  breakGlass: true,
  jwtClaims: {
    sub: 'user-002',
    role: 'nurse',
    breakGlassReason: 'Emergency access',
  },
}

const mockHipaaEntry = {
  id: 'hipaa-log-001',
  timestamp: new Date().toISOString(),
  userId: 'user-001',
  action: 'fhir:create',
  eventType: 'create',
  status: 'success',
  resource: 'FHIR/Patient',
  ipAddress: 'server-side',
  userAgent: 'server-side',
  sessionId: 'server-side',
}

// --- Tests ---

describe('EHR Audit Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateHIPAACompliantAuditLog.mockResolvedValue(mockHipaaEntry)
    mockLogEvent.mockResolvedValue('chain-event-001')
  })

  describe('auditFHIRCreate', () => {
    it('emits both HIPAA log and chain event for a create', async () => {
      const result = await auditFHIRCreate(
        baseCtx,
        'Patient',
        'patient-123',
        '1',
      )

      expect(result.success).toBe(true)
      expect(result.auditLogId).toBe('hipaa-log-001')
      expect(result.chainEventId).toBe('chain-event-001')

      expect(mockCreateHIPAACompliantAuditLog).toHaveBeenCalledTimes(1)
      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.userId).toBe('user-001')
      expect(hipaaArgs.action).toBe('fhir:create')
      expect(hipaaArgs.resource).toBe('FHIR/Patient')
      expect(hipaaArgs.resourceId).toBe('patient-123')
      expect(hipaaArgs.eventType).toBe('create')
      expect(hipaaArgs.status).toBe('success')
      expect(hipaaArgs.details.fhirVersion).toBe('4.0.1')
      expect(hipaaArgs.details.resourceType).toBe('Patient')
      expect(hipaaArgs.details.tenantId).toBe('tenant-001')
      expect(hipaaArgs.details.version).toBe('1')

      expect(mockLogEvent).toHaveBeenCalledTimes(1)
      const chainEvent = mockLogEvent.mock.calls[0][0]
      expect(chainEvent.userId).toBe('user-001')
      expect(chainEvent.type).toBe('create')
      expect(chainEvent.action).toBe('fhir:create')
      expect(chainEvent.resourceType).toBe('Patient')
      expect(chainEvent.status).toBe('success')
      expect(chainEvent.metadata.fhirVersion).toBe('4.0.1')
      expect(chainEvent.metadata.tenantId).toBe('tenant-001')
    })
  })

  describe('auditFHIRUpdate', () => {
    it('emits both HIPAA log (MODIFY) and chain event (UPDATE) for an update', async () => {
      const result = await auditFHIRUpdate(
        baseCtx,
        'Observation',
        'obs-456',
        '2',
      )

      expect(result.success).toBe(true)

      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.eventType).toBe('modify')
      expect(hipaaArgs.action).toBe('fhir:update')

      const chainEvent = mockLogEvent.mock.calls[0][0]
      expect(chainEvent.type).toBe('update')
      expect(chainEvent.action).toBe('fhir:update')
    })
  })

  describe('auditFHIRDelete', () => {
    it('emits both HIPAA log and chain event for a delete', async () => {
      const result = await auditFHIRDelete(baseCtx, 'Condition', 'cond-789')

      expect(result.success).toBe(true)

      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.eventType).toBe('delete')
      expect(hipaaArgs.action).toBe('fhir:delete')

      const chainEvent = mockLogEvent.mock.calls[0][0]
      expect(chainEvent.type).toBe('delete')
      expect(chainEvent.severity).toBe('medium')
    })
  })

  describe('auditFHIRRead', () => {
    it('emits access audit event for a read', async () => {
      const result = await auditFHIRRead(baseCtx, 'Patient', 'patient-123')

      expect(result.success).toBe(true)

      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.eventType).toBe('access')
      expect(hipaaArgs.action).toBe('fhir:read')

      const chainEvent = mockLogEvent.mock.calls[0][0]
      expect(chainEvent.type).toBe('access')
      expect(chainEvent.severity).toBe('info')
    })
  })

  describe('auditFHIRFailure', () => {
    it('emits failure audit with error message', async () => {
      const result = await auditFHIRFailure(
        baseCtx,
        'Patient',
        'patient-123',
        'create',
        'Validation failed: missing required field',
      )

      expect(result.success).toBe(true)

      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.status).toBe('failure')
      expect(hipaaArgs.details.action).toBe('create')

      const chainEvent = mockLogEvent.mock.calls[0][0]
      expect(chainEvent.status).toBe('failure')
      expect(chainEvent.errorMessage).toBe(
        'Validation failed: missing required field',
      )
    })
  })

  describe('auditBreakGlassFHIR', () => {
    it('emits break-glass audit with reason and high severity', async () => {
      const result = await auditBreakGlassFHIR({
        resourceType: 'Patient',
        resourceId: 'patient-999',
        userId: 'user-002',
        role: 'nurse',
        tenantId: 'tenant-001',
        reason: 'Emergency access for patient care',
        ipAddress: '10.0.0.42',
        userAgent: 'Mozilla/5.0',
        sessionId: 'session-abc',
      })

      expect(result.success).toBe(true)

      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.userId).toBe('user-002')
      expect(hipaaArgs.eventType).toBe('access')
      expect(hipaaArgs.status).toBe('warning')
      expect(hipaaArgs.notes).toBe(
        'Break-glass: Emergency access for patient care',
      )
      expect(hipaaArgs.details.breakGlass).toBe(true)
      expect(hipaaArgs.details.breakGlassReason).toBe(
        'Emergency access for patient care',
      )
      expect(hipaaArgs.details.ipAddress).toBe('10.0.0.42')
      expect(hipaaArgs.details.userAgent).toBe('Mozilla/5.0')
      expect(hipaaArgs.details.sessionId).toBe('session-abc')

      const chainEvent = mockLogEvent.mock.calls[0][0]
      expect(chainEvent.severity).toBe('high')
      expect(chainEvent.metadata.breakGlass).toBe(true)
      expect(chainEvent.metadata.breakGlassReason).toBe(
        'Emergency access for patient care',
      )
      expect(chainEvent.ipAddress).toBe('10.0.0.42')
    })
  })

  describe('auditFHIREvent with break-glass context', () => {
    it('includes break-glass fields in both audit systems', async () => {
      await auditFHIREvent(
        breakGlassCtx,
        'Observation',
        'obs-bgp-001',
        'read',
        'success' as never,
      )

      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.details.breakGlass).toBe(true)
      expect(hipaaArgs.details.breakGlassReason).toBe(
        'Emergency access for patient care',
      )

      const chainEvent = mockLogEvent.mock.calls[0][0]
      expect(chainEvent.metadata.breakGlass).toBe(true)
      expect(chainEvent.metadata.breakGlassReason).toBe(
        'Emergency access for patient care',
      )
    })
  })

  describe('auditFHIREvent error handling', () => {
    it('returns failure result when createHIPAACompliantAuditLog throws', async () => {
      mockCreateHIPAACompliantAuditLog.mockRejectedValue(
        new Error('DB connection failed'),
      )

      const result = await auditFHIRCreate(baseCtx, 'Patient', 'patient-err')

      expect(result.success).toBe(false)
      expect(result.error).toBe('DB connection failed')
    })

    it('returns failure result when AuditLogger.logEvent throws', async () => {
      mockLogEvent.mockRejectedValue(new Error('MongoDB unavailable'))

      const result = await auditFHIRCreate(baseCtx, 'Patient', 'patient-err2')

      expect(result.success).toBe(false)
      expect(result.error).toBe('MongoDB unavailable')
    })
  })

  describe('verifyEhrAuditChain', () => {
    it('delegates to verifyAuditChain', () => {
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
      ]
      mockVerifyAuditChain.mockReturnValue({ valid: true })

      const result = verifyEhrAuditChain(mockEvents as never)

      expect(mockVerifyAuditChain).toHaveBeenCalledTimes(1)
      expect(mockVerifyAuditChain.mock.calls[0][0]).toBe(mockEvents)
      expect(result.valid).toBe(true)
    })

    it('returns broken chain result when verifyAuditChain detects tampering', () => {
      mockVerifyAuditChain.mockReturnValue({
        valid: false,
        brokenAtIndex: 2,
        brokenAtId: 'evt-3',
        reason: 'Hash mismatch at index 2',
      })

      const result = verifyEhrAuditChain([] as never)

      expect(result.valid).toBe(false)
      expect(result.brokenAtIndex).toBe(2)
      expect(result.reason).toBe('Hash mismatch at index 2')
    })
  })
})

describe('EHR Audit Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateHIPAACompliantAuditLog.mockResolvedValue(mockHipaaEntry)
    mockLogEvent.mockResolvedValue('chain-event-mw-001')
  })

  describe('buildEhrAuditContext', () => {
    it('extracts context from FHIRRequestContext', () => {
      const ctx = buildEhrAuditContext(mockFhirContext)
      expect(ctx.userId).toBe('user-001')
      expect(ctx.tenantId).toBe('tenant-001')
      expect(ctx.role).toBe('physician')
      expect(ctx.breakGlass).toBe(false)
    })

    it('extracts breakGlassReason from jwtClaims', () => {
      const ctx = buildEhrAuditContext(breakGlassFhirContext)
      expect(ctx.breakGlass).toBe(true)
      expect(ctx.breakGlassReason).toBe('Emergency access')
    })

    it('passes through ipAddress, userAgent, sessionId when provided', () => {
      const ctx = buildEhrAuditContext(
        mockFhirContext,
        '192.168.1.1',
        'TestAgent/1.0',
        'sess-xyz',
      )
      expect(ctx.ipAddress).toBe('192.168.1.1')
      expect(ctx.userAgent).toBe('TestAgent/1.0')
      expect(ctx.sessionId).toBe('sess-xyz')
    })
  })

  describe('preWriteAudit', () => {
    it('logs access attempt with ATTEMPT status', async () => {
      const result = await preWriteAudit(
        baseCtx,
        'Patient',
        'patient-001',
        'create',
      )

      expect(result.success).toBe(true)

      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.status).toBe('attempt')
    })
  })

  describe('postWriteAudit', () => {
    it('dispatches to auditFHIRCreate for create action', async () => {
      const result = await postWriteAudit(
        baseCtx,
        'Patient',
        'patient-001',
        'create',
        '1',
      )

      expect(result.success).toBe(true)
      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.eventType).toBe('create')
    })

    it('dispatches to auditFHIRUpdate for update action', async () => {
      const result = await postWriteAudit(
        baseCtx,
        'Patient',
        'patient-001',
        'update',
        '2',
      )

      expect(result.success).toBe(true)
      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.eventType).toBe('modify')
    })

    it('dispatches to auditFHIRDelete for delete action', async () => {
      const result = await postWriteAudit(
        baseCtx,
        'Patient',
        'patient-001',
        'delete',
      )

      expect(result.success).toBe(true)
      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.eventType).toBe('delete')
    })

    it('dispatches to auditFHIRRead for unknown action (fallback)', async () => {
      const result = await postWriteAudit(
        baseCtx,
        'Patient',
        'patient-001',
        'read',
      )

      expect(result.success).toBe(true)
      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.eventType).toBe('access')
    })
  })

  describe('postWriteFailureAudit', () => {
    it('logs failure with error message', async () => {
      const result = await postWriteFailureAudit(
        baseCtx,
        'Patient',
        'patient-001',
        'update',
        'Version mismatch',
      )

      expect(result.success).toBe(true)
      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.status).toBe('failure')
      const chainEvent = mockLogEvent.mock.calls[0][0]
      expect(chainEvent.errorMessage).toBe('Version mismatch')
    })
  })

  describe('readAudit', () => {
    it('logs read access event', async () => {
      const result = await readAudit(baseCtx, 'Observation', 'obs-001')

      expect(result.success).toBe(true)
      const hipaaArgs = mockCreateHIPAACompliantAuditLog.mock.calls[0][0]
      expect(hipaaArgs.eventType).toBe('access')
      expect(hipaaArgs.action).toBe('fhir:read')
    })
  })
})
