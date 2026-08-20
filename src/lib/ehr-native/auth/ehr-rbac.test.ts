import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { AuditLogEntry } from '@/lib/audit'
import type { ConsentLevel } from '@/lib/research/types/research-types'

import {
  verifyPatientConsent,
  checkPermission,
  activateBreakGlass,
  checkPermissionWithBreakGlass,
  logEHRAccess,
} from './ehr-rbac'
import type { EHRPermission } from './types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the consent service
const mockGetConsentLevel = vi.fn()
vi.mock('@/lib/research/services/ConsentManagementService', () => ({
  consentManagementService: {
    getConsentLevel: (...args: unknown[]) => mockGetConsentLevel(...args) as unknown,
  },
}))

// Mock the audit system
const mockCreateAuditLog = vi.fn()
vi.mock('@/lib/audit', () => ({
  AuditEventStatus: {
    SUCCESS: 'success',
    FAILURE: 'failure',
    ATTEMPT: 'attempt',
    BLOCKED: 'blocked',
    WARNING: 'warning',
  },
  AuditEventType: {
    ACCESS: 'access',
    ACCESS_DENIED: 'access_denied',
    SECURITY: 'security',
    SYSTEM: 'system',
    GOVERNANCE_ALLOW: 'governance_allow',
    GOVERNANCE_DENY: 'governance_deny',
    CONSENT: 'consent',
  },
  createHIPAACompliantAuditLog: (...args: unknown[]) =>
    mockCreateAuditLog(...args) as unknown,
}))

// Mock the logger
vi.mock('@/lib/logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// Helper to create a mock audit log entry
function makeMockAuditLog(id: string): AuditLogEntry {
  return {
    id,
    timestamp: new Date().toISOString(),
    userId: 'test-user',
    action: 'test-action',
    eventType: 'access' as never,
    status: 'success' as never,
    resource: 'test-resource',
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockGetConsentLevel.mockReset()
  mockCreateAuditLog.mockReset()
  mockCreateAuditLog.mockResolvedValue(makeMockAuditLog('audit-123'))
})

describe('verifyPatientConsent', () => {
  it('returns null for consent-bypass permissions', async () => {
    const bypassPerms: EHRPermission[] = [
      'break_glass',
      'audit_access',
      'manage_consent',
      'manage_schedule',
      'read_schedule',
    ]
    for (const perm of bypassPerms) {
      const result = await verifyPatientConsent('patient-1', perm)
      expect(result).toBeNull()
    }
  })

  it('returns true when consent level meets minimum', async () => {
    mockGetConsentLevel.mockResolvedValue('minimal' as ConsentLevel)
    const result = await verifyPatientConsent('patient-1', 'read_patient')
    expect(result).toBe(true)
  })

  it('returns true when consent level exceeds minimum', async () => {
    mockGetConsentLevel.mockResolvedValue('full' as ConsentLevel)
    const result = await verifyPatientConsent('patient-1', 'read_patient')
    expect(result).toBe(true)
  })

  it('returns false when consent level is insufficient', async () => {
    mockGetConsentLevel.mockResolvedValue('none' as ConsentLevel)
    const result = await verifyPatientConsent('patient-1', 'read_patient')
    expect(result).toBe(false)
  })

  it('returns false when consent is null (expired/withdrawn)', async () => {
    mockGetConsentLevel.mockResolvedValue(null)
    const result = await verifyPatientConsent('patient-1', 'read_patient')
    expect(result).toBe(false)
  })

  it('requires full consent for export_phi', async () => {
    mockGetConsentLevel.mockResolvedValue('limited' as ConsentLevel)
    const result = await verifyPatientConsent('patient-1', 'export_phi')
    expect(result).toBe(false)

    mockGetConsentLevel.mockResolvedValue('full' as ConsentLevel)
    const result2 = await verifyPatientConsent('patient-1', 'export_phi')
    expect(result2).toBe(true)
  })

  it('requires limited consent for write_clinical_note', async () => {
    mockGetConsentLevel.mockResolvedValue('minimal' as ConsentLevel)
    const result = await verifyPatientConsent('patient-1', 'write_clinical_note')
    expect(result).toBe(false)

    mockGetConsentLevel.mockResolvedValue('limited' as ConsentLevel)
    const result2 = await verifyPatientConsent('patient-1', 'write_clinical_note')
    expect(result2).toBe(true)
  })
})

describe('checkPermission', () => {
  it('grants permission when role has it and consent is valid', async () => {
    mockGetConsentLevel.mockResolvedValue('full' as ConsentLevel)
    const result = await checkPermission('physician', 'read_patient', 'patient-1')
    expect(result.granted).toBe(true)
    expect(result.breakGlassActivated).toBe(false)
    expect(result.consentVerified).toBe(true)
  })

  it('denies permission when role lacks it', async () => {
    const result = await checkPermission('frontDesk', 'read_encounter', 'patient-1')
    expect(result.granted).toBe(false)
    expect(result.reason).toContain('does not have permission')
    expect(result.consentVerified).toBeNull()
  })

  it('denies permission when consent is missing', async () => {
    mockGetConsentLevel.mockResolvedValue(null)
    const result = await checkPermission('physician', 'read_patient', 'patient-1')
    expect(result.granted).toBe(false)
    expect(result.reason).toContain('consent')
    expect(result.consentVerified).toBe(false)
  })

  it('denies permission when consent is insufficient', async () => {
    mockGetConsentLevel.mockResolvedValue('none' as ConsentLevel)
    const result = await checkPermission('physician', 'read_patient', 'patient-1')
    expect(result.granted).toBe(false)
    expect(result.consentVerified).toBe(false)
  })

  it('grants permission without consent check when patientId is omitted', async () => {
    const result = await checkPermission('physician', 'read_patient')
    expect(result.granted).toBe(true)
    expect(result.consentVerified).toBeNull()
  })

  it('grants schedule permission without consent check even with patientId', async () => {
    const result = await checkPermission('frontDesk', 'manage_schedule', 'patient-1')
    expect(result.granted).toBe(true)
    expect(result.consentVerified).toBeNull()
  })

  it('grants inherited permissions (physician reading medication)', async () => {
    mockGetConsentLevel.mockResolvedValue('full' as ConsentLevel)
    const result = await checkPermission('physician', 'read_medication', 'patient-1')
    expect(result.granted).toBe(true)
  })

  it('denies break_glass for frontDesk (no break_glass permission)', async () => {
    const result = await checkPermission('frontDesk', 'break_glass', 'patient-1')
    expect(result.granted).toBe(false)
  })

  it('grants break_glass for physician', async () => {
    const result = await checkPermission('physician', 'break_glass', 'patient-1')
    expect(result.granted).toBe(true)
    expect(result.consentVerified).toBeNull()
  })
})

describe('activateBreakGlass', () => {
  it('grants break-glass for valid role with reason', async () => {
    const result = await activateBreakGlass({
      userId: 'user-1',
      role: 'physician',
      patientId: 'patient-1',
      permission: 'read_patient',
      reason: 'Emergency: patient unconscious in ER',
    })

    expect(result.granted).toBe(true)
    expect(result.auditLogId).toBe('audit-123')
    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1)
  })

  it('denies break-glass when role lacks break_glass permission', async () => {
    const result = await activateBreakGlass({
      userId: 'user-1',
      role: 'frontDesk',
      patientId: 'patient-1',
      permission: 'read_patient',
      reason: 'Emergency',
    })

    expect(result.granted).toBe(false)
    expect(result.reason).toContain('break_glass permission')
    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1)
  })

  it('denies break-glass when role lacks the requested permission', async () => {
    const result = await activateBreakGlass({
      userId: 'user-1',
      role: 'nurse',
      patientId: 'patient-1',
      permission: 'adjudicate_claim',
      reason: 'Emergency billing needed',
    })

    expect(result.granted).toBe(false)
    expect(result.reason).toContain('does not have the requested permission')
    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1)
  })

  it('denies break-glass when no reason is provided', async () => {
    const result = await activateBreakGlass({
      userId: 'user-1',
      role: 'physician',
      patientId: 'patient-1',
      permission: 'read_patient',
      reason: '',
    })

    expect(result.granted).toBe(false)
    expect(result.reason).toContain('justification')
    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1)
  })

  it('denies break-glass when reason is only whitespace', async () => {
    const result = await activateBreakGlass({
      userId: 'user-1',
      role: 'physician',
      patientId: 'patient-1',
      permission: 'read_patient',
      reason: '   ',
    })

    expect(result.granted).toBe(false)
  })

  it('passes organizationId to audit log when provided', async () => {
    await activateBreakGlass({
      userId: 'user-1',
      role: 'physician',
      patientId: 'patient-1',
      permission: 'read_patient',
      reason: 'Emergency access',
      organizationId: 'org-1',
    })

    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1)
    const callArg = mockCreateAuditLog.mock.calls[0][0] as Record<string, unknown>
    expect(callArg['organizationId']).toBe('org-1')
  })

  it('creates audit log with WARNING status for granted break-glass', async () => {
    await activateBreakGlass({
      userId: 'user-1',
      role: 'physician',
      patientId: 'patient-1',
      permission: 'read_patient',
      reason: 'Emergency',
    })

    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1)
    const callArg = mockCreateAuditLog.mock.calls[0][0] as Record<string, unknown>
    expect(callArg['status']).toBe('warning')
  })

  it('creates audit log with BLOCKED status for denied break-glass', async () => {
    await activateBreakGlass({
      userId: 'user-1',
      role: 'frontDesk',
      patientId: 'patient-1',
      permission: 'read_patient',
      reason: 'Emergency',
    })

    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1)
    const callArg = mockCreateAuditLog.mock.calls[0][0] as Record<string, unknown>
    expect(callArg['status']).toBe('blocked')
  })
})

describe('checkPermissionWithBreakGlass', () => {
  it('returns granted when base check passes', async () => {
    mockGetConsentLevel.mockResolvedValue('full' as ConsentLevel)
    const result = await checkPermissionWithBreakGlass(
      'physician',
      'read_patient',
      'patient-1',
    )

    expect(result.granted).toBe(true)
    expect(result.breakGlassActivated).toBe(false)
  })

  it('activates break-glass when consent denied and params provided', async () => {
    mockGetConsentLevel.mockResolvedValue(null) // No consent
    const result = await checkPermissionWithBreakGlass(
      'physician',
      'read_patient',
      'patient-1',
      {
        userId: 'user-1',
        reason: 'Emergency: patient unconscious',
      },
    )

    expect(result.granted).toBe(true)
    expect(result.breakGlassActivated).toBe(true)
    expect(result.consentVerified).toBe(false)
  })

  it('does not activate break-glass when role lacks break_glass permission', async () => {
    mockGetConsentLevel.mockResolvedValue(null)
    const result = await checkPermissionWithBreakGlass(
      'frontDesk',
      'read_patient',
      'patient-1',
      {
        userId: 'user-1',
        reason: 'Emergency',
      },
    )

    // frontDesk has read_patient but not break_glass
    expect(result.granted).toBe(false)
    expect(result.breakGlassActivated).toBe(false)
  })

  it('does not activate break-glass when denied for non-consent reasons', async () => {
    const result = await checkPermissionWithBreakGlass(
      'frontDesk',
      'read_encounter',
      'patient-1',
      {
        userId: 'user-1',
        reason: 'Emergency',
      },
    )

    expect(result.granted).toBe(false)
    expect(result.breakGlassActivated).toBe(false)
  })

  it('denies break-glass when role has break_glass but lacks requested permission', async () => {
    mockGetConsentLevel.mockResolvedValue(null)
    const result = await checkPermissionWithBreakGlass(
      'nurse',
      'adjudicate_claim',
      'patient-1',
      {
        userId: 'user-1',
        reason: 'Emergency billing',
      },
    )

    expect(result.granted).toBe(false)
    expect(result.breakGlassActivated).toBe(false)
  })

  it('does not activate break-glass when no breakGlassParams provided', async () => {
    mockGetConsentLevel.mockResolvedValue(null)
    const result = await checkPermissionWithBreakGlass(
      'physician',
      'read_patient',
      'patient-1',
    )

    expect(result.granted).toBe(false)
    expect(result.breakGlassActivated).toBe(false)
  })
})

describe('logEHRAccess', () => {
  it('creates audit log with ACCESS event type for granted access', async () => {
    mockCreateAuditLog.mockResolvedValue(makeMockAuditLog('log-1'))

    await logEHRAccess({
      userId: 'user-1',
      action: 'ehr_read_patient',
      resource: 'patient',
      role: 'physician',
      permission: 'read_patient',
      patientId: 'patient-1',
      granted: true,
    })

    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1)
    const callArg = mockCreateAuditLog.mock.calls[0][0] as Record<string, unknown>
    expect(callArg['eventType']).toBe('access')
    expect(callArg['status']).toBe('success')
  })

  it('creates audit log with ACCESS_DENIED event type for denied access', async () => {
    mockCreateAuditLog.mockResolvedValue(makeMockAuditLog('log-2'))

    await logEHRAccess({
      userId: 'user-1',
      action: 'ehr_read_patient',
      resource: 'patient',
      role: 'frontDesk',
      permission: 'read_encounter',
      patientId: 'patient-1',
      granted: false,
      reason: 'Role lacks permission',
    })

    expect(mockCreateAuditLog).toHaveBeenCalledTimes(1)
    const callArg = mockCreateAuditLog.mock.calls[0][0] as Record<string, unknown>
    expect(callArg['eventType']).toBe('access_denied')
    expect(callArg['status']).toBe('blocked')
  })

  it('includes reason in details when provided', async () => {
    mockCreateAuditLog.mockResolvedValue(makeMockAuditLog('log-3'))

    await logEHRAccess({
      userId: 'user-1',
      action: 'ehr_read_patient',
      resource: 'patient',
      role: 'physician',
      permission: 'read_patient',
      patientId: 'patient-1',
      granted: false,
      reason: 'Consent expired',
    })

    const callArg = mockCreateAuditLog.mock.calls[0][0] as Record<string, unknown>
    const details = callArg['details'] as Record<string, unknown>
    expect(details['reason']).toBe('Consent expired')
  })
})
