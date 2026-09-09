/**
 * Tests for SOC 2 Security & Availability report generators.
 * Mocks queryAuditEvents to test report construction logic.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { AuditEventType, AuditSeverity } from '@/lib/audit/events'
import type { AuditEvent } from '@/lib/audit/events'

// Mock queryAuditEvents from report-generator
const { mockQueryAuditEvents } = vi.hoisted(() => ({
  mockQueryAuditEvents: vi.fn(),
}))
vi.mock('../report-generator', () => ({
  queryAuditEvents: mockQueryAuditEvents,
}))

import {
  generateSOC2SecurityReport,
  generateSOC2AvailabilityReport,
} from '../soc2-report'
import type { ReportPeriod, ChainVerificationResult } from '../types'

const period: ReportPeriod = {
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: '2025-01-31T23:59:59.000Z',
}

const validChain: ChainVerificationResult = {
  valid: true,
  totalEvents: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
})

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'evt-' + Math.random().toString(36).slice(2, 8),
    timestamp: new Date().toISOString() as unknown as Date,
    userId: 'user-1',
    type: AuditEventType.ACCESS,
    action: 'patient_view',
    severity: AuditSeverity.INFO,
    status: 'success',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Security Report
// ---------------------------------------------------------------------------

describe('generateSOC2SecurityReport', () => {
  it('builds report with correct report type', async () => {
    mockQueryAuditEvents.mockResolvedValue([])
    const report = await generateSOC2SecurityReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.reportType).toBe('soc2_security')
    expect(report.period).toEqual(period)
    expect(report.tenantId).toBe('tenant-001')
  })

  it('extracts access control events and counts users', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        action: 'role_assigned',
        userId: 'user-1',
        metadata: { role: 'physician' },
      }),
      makeEvent({
        action: 'role_assigned',
        userId: 'user-2',
        metadata: { role: 'nurse' },
      }),
      makeEvent({
        action: 'role_assigned',
        userId: 'user-3',
        metadata: { role: 'therapist' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateSOC2SecurityReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.accessControls.totalUsers).toBe(3)
    expect(report.accessControls.roleAssignments).toHaveLength(3)
  })

  it('counts permission grants and revocations', async () => {
    const events: AuditEvent[] = [
      makeEvent({ action: 'permission_granted', userId: 'user-1' }),
      makeEvent({ action: 'permission_granted', userId: 'user-2' }),
      makeEvent({ action: 'permission_revoked', userId: 'user-3' }),
      makeEvent({ action: 'permission_revoked', userId: 'user-4' }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateSOC2SecurityReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.accessControls.permissionGrants).toBe(2)
    expect(report.accessControls.permissionRevocations).toBe(2)
  })

  it('counts MFA challenge events', async () => {
    const events: AuditEvent[] = [
      makeEvent({ action: 'mfa_challenge', userId: 'user-1' }),
      makeEvent({ action: 'mfa_challenge', userId: 'user-2' }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateSOC2SecurityReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.accessControls.mfaRequiredPermissions).toBe(2)
  })

  it('reports encryption as compliant', async () => {
    mockQueryAuditEvents.mockResolvedValue([])
    const report = await generateSOC2SecurityReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.encryption.dataInTransit).toBe(true)
    expect(report.encryption.dataAtRest).toBe(true)
    expect(report.encryption.auditLogHashing).toBe(true)
    expect(report.summary.encryptionCompliant).toBe(true)
  })

  it('extracts security incidents from events', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        id: 'sec-1',
        action: 'security_breach',
        severity: AuditSeverity.CRITICAL,
        metadata: {
          incidentType: 'breach',
          description: 'Data breach',
          resolved: false,
        },
      }),
      makeEvent({
        id: 'sec-2',
        action: 'security_incident',
        severity: AuditSeverity.HIGH,
        metadata: {
          incidentType: 'intrusion',
          description: 'Intrusion attempt',
          resolved: true,
        },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateSOC2SecurityReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.incidents).toHaveLength(2)
    expect(report.incidents[0].type).toBe('breach')
    expect(report.incidents[0].resolved).toBe(false)
    expect(report.incidents[1].resolved).toBe(true)
    expect(report.summary.openIncidents).toBe(1)
  })

  it('detects security incidents via CRITICAL severity', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        action: 'some_action',
        severity: AuditSeverity.CRITICAL,
        metadata: { description: 'Critical event' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateSOC2SecurityReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.incidents).toHaveLength(1)
    expect(report.summary.totalSecurityEvents).toBe(1)
  })

  it('counts failed access attempts in summary', async () => {
    const events: AuditEvent[] = [
      makeEvent({ action: 'role_assigned', status: 'success' }),
      makeEvent({ action: 'role_assigned', status: 'failure' }),
      makeEvent({ action: 'user_login', status: 'failure' }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateSOC2SecurityReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.summary.failedAccessAttempts).toBe(2)
  })

  it('sets chain verification in summary', async () => {
    mockQueryAuditEvents.mockResolvedValue([])
    const brokenChain: ChainVerificationResult = {
      valid: false,
      totalEvents: 0,
      brokenAtId: 'evt-99',
      reason: 'Hash mismatch',
    }
    const report = await generateSOC2SecurityReport(
      period,
      'tenant-001',
      brokenChain,
    )
    expect(report.summary.chainValid).toBe(false)
    expect(report.auditLogIntegrity.valid).toBe(false)
  })

  it('updates totalEvents in chain verification', async () => {
    const events = [makeEvent(), makeEvent(), makeEvent()]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateSOC2SecurityReport(period, 'tenant-001', {
      ...validChain,
      totalEvents: 0,
    })
    expect(report.auditLogIntegrity.totalEvents).toBe(3)
  })

  it('returns empty report when no events found', async () => {
    mockQueryAuditEvents.mockResolvedValue([])
    const report = await generateSOC2SecurityReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.accessControls.totalUsers).toBe(0)
    expect(report.incidents).toHaveLength(0)
    expect(report.summary.totalAccessEvents).toBe(0)
    expect(report.summary.totalSecurityEvents).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Availability Report
// ---------------------------------------------------------------------------

describe('generateSOC2AvailabilityReport', () => {
  it('builds report with correct report type', async () => {
    mockQueryAuditEvents.mockResolvedValue([])
    const report = await generateSOC2AvailabilityReport(period, 'tenant-001')
    expect(report.reportType).toBe('soc2_availability')
    expect(report.period).toEqual(period)
    expect(report.tenantId).toBe('tenant-001')
  })

  it('calculates uptime percentage from downtime events', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        id: 'dt-1',
        action: 'system_down',
        metadata: { durationMinutes: 30 },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateSOC2AvailabilityReport(period, 'tenant-001')
    // January has ~31 days = 44640 minutes. 30 min downtime = 99.93% uptime
    expect(report.uptime.totalDowntimeMinutes).toBe(30)
    expect(report.uptime.totalUptimePercentage).toBeGreaterThan(99.9)
    expect(report.uptime.totalUptimePercentage).toBeLessThan(100)
    expect(report.uptime.incidents).toHaveLength(1)
    expect(report.uptime.incidents[0].durationMinutes).toBe(30)
  })

  it('reports 100% uptime with no downtime events', async () => {
    mockQueryAuditEvents.mockResolvedValue([])
    const report = await generateSOC2AvailabilityReport(period, 'tenant-001')
    expect(report.uptime.totalUptimePercentage).toBe(100)
    expect(report.uptime.totalDowntimeMinutes).toBe(0)
    expect(report.uptime.incidents).toHaveLength(0)
  })

  it('extracts backup completion events', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        action: 'backup_completed',
        timestamp: '2025-01-15T03:00:00.000Z' as unknown as Date,
      }),
      makeEvent({
        action: 'backup_success',
        timestamp: '2025-01-16T03:00:00.000Z' as unknown as Date,
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateSOC2AvailabilityReport(period, 'tenant-001')
    expect(report.backupRestore.lastBackupAt).toBe('2025-01-16T03:00:00.000Z')
    expect(report.backupRestore.backupFrequency).toContain('Daily')
    expect(report.backupRestore.backupEncryption).toBe(true)
  })

  it('extracts restore test events', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        action: 'restore_test',
        timestamp: '2025-01-20T10:00:00.000Z' as unknown as Date,
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateSOC2AvailabilityReport(period, 'tenant-001')
    expect(report.backupRestore.lastRestoreTest).toBe(
      '2025-01-20T10:00:00.000Z',
    )
  })

  it('extracts disaster recovery test events', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        action: 'dr_test',
        timestamp: '2025-01-10T08:00:00.000Z' as unknown as Date,
      }),
      makeEvent({
        action: 'disaster_recovery_test',
        timestamp: '2025-01-12T08:00:00.000Z' as unknown as Date,
      }),
      makeEvent({
        action: 'dr_plan_version',
        timestamp: '2025-01-11T08:00:00.000Z' as unknown as Date,
        metadata: { version: '2.1.0' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateSOC2AvailabilityReport(period, 'tenant-001')
    expect(report.disasterRecovery.lastTestDate).toBe(
      '2025-01-12T08:00:00.000Z',
    )
    expect(report.disasterRecovery.drPlanVersion).toBe('2.1.0')
  })

  it('uses default RTO and RPO values', async () => {
    mockQueryAuditEvents.mockResolvedValue([])
    const report = await generateSOC2AvailabilityReport(period, 'tenant-001')
    expect(report.disasterRecovery.rtoMinutes).toBe(60)
    expect(report.disasterRecovery.rpoMinutes).toBe(15)
  })

  it('builds availability summary correctly', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        action: 'backup_completed',
        timestamp: '2025-01-15T03:00:00.000Z' as unknown as Date,
      }),
      makeEvent({
        action: 'dr_test',
        timestamp: '2025-01-10T08:00:00.000Z' as unknown as Date,
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateSOC2AvailabilityReport(period, 'tenant-001')
    expect(report.summary.backupCompliant).toBe(true)
    expect(report.summary.drCompliant).toBe(true)
    expect(report.summary.uptimePercentage).toBe(100)
  })

  it('marks backup non-compliant when no backup events found', async () => {
    mockQueryAuditEvents.mockResolvedValue([])
    const report = await generateSOC2AvailabilityReport(period, 'tenant-001')
    expect(report.summary.backupCompliant).toBe(false)
    expect(report.summary.drCompliant).toBe(false)
  })

  it('handles multiple downtime events accumulating total downtime', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        id: 'dt-1',
        action: 'system_down',
        metadata: { durationMinutes: 15 },
      }),
      makeEvent({
        id: 'dt-2',
        action: 'service_outage',
        metadata: { durationMinutes: 45 },
      }),
      makeEvent({
        id: 'dt-3',
        action: 'downtime',
        metadata: { durationMinutes: 10 },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateSOC2AvailabilityReport(period, 'tenant-001')
    expect(report.uptime.totalDowntimeMinutes).toBe(70)
    expect(report.uptime.incidents).toHaveLength(3)
  })
})
