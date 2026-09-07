/**
 * Tests for HIPAA report generator.
 * Mocks queryAuditEvents to test event classification logic.
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

import { generateHIPAAAuditReport } from '../hipaa-report'
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
    timestamp: new Date().toISOString(),
    userId: 'user-1',
    type: AuditEventType.ACCESS,
    action: 'patient_view',
    severity: AuditSeverity.INFO,
    status: 'success',
    ...overrides,
  }
}

describe('generateHIPAAAuditReport', () => {
  it('classifies PHI access events correctly', async () => {
    const events: AuditEvent[] = [
      makeEvent({ action: 'patient_view', type: AuditEventType.ACCESS }),
      makeEvent({ action: 'read_patient', type: AuditEventType.ACCESS }),
      makeEvent({ action: 'encounter_view', type: AuditEventType.ACCESS }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)

    const report = await generateHIPAAAuditReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.phiAccessEvents).toHaveLength(3)
    expect(report.summary.totalPhiAccess).toBe(3)
  })

  it('classifies PHI modification events correctly', async () => {
    const events: AuditEvent[] = [
      makeEvent({ action: 'patient_create', type: AuditEventType.CREATE }),
      makeEvent({ action: 'patient_update', type: AuditEventType.UPDATE }),
      makeEvent({ action: 'record_delete', type: AuditEventType.DELETE }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)

    const report = await generateHIPAAAuditReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.phiModificationEvents).toHaveLength(3)
    expect(report.summary.totalPhiModifications).toBe(3)
  })

  it('classifies break-glass events by action', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        action: 'break_glass',
        type: AuditEventType.SECURITY,
        severity: AuditSeverity.HIGH,
      }),
      makeEvent({
        action: 'break_glass_activate',
        type: AuditEventType.SECURITY,
        severity: AuditSeverity.HIGH,
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)

    const report = await generateHIPAAAuditReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.breakGlassEvents).toHaveLength(2)
    expect(report.summary.totalBreakGlass).toBe(2)
  })

  it('classifies break-glass events by metadata.breakGlass', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        action: 'patient_view',
        type: AuditEventType.ACCESS,
        metadata: { breakGlass: true, breakGlassReason: 'Emergency' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)

    const report = await generateHIPAAAuditReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.breakGlassEvents).toHaveLength(1)
    expect(report.breakGlassEvents[0].reason).toBe('Emergency')
  })

  it('counts unique users and patients', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        id: '1',
        userId: 'user-1',
        metadata: { patientId: 'patient-A' },
      }),
      makeEvent({
        id: '2',
        userId: 'user-2',
        metadata: { patientId: 'patient-B' },
      }),
      makeEvent({
        id: '3',
        userId: 'user-1',
        metadata: { patientId: 'patient-A' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)

    const report = await generateHIPAAAuditReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.summary.uniqueUsers).toBe(2)
    expect(report.summary.uniquePatients).toBe(2)
  })

  it('counts failed access attempts', async () => {
    const events: AuditEvent[] = [
      makeEvent({ id: '1', action: 'patient_view', status: 'success' }),
      makeEvent({ id: '2', action: 'patient_view', status: 'failure' }),
      makeEvent({ id: '3', action: 'patient_view', status: 'failure' }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)

    const report = await generateHIPAAAuditReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.summary.failedAccess).toBe(2)
  })

  it('sets chain verification result', async () => {
    mockQueryAuditEvents.mockResolvedValue([])
    const brokenChain: ChainVerificationResult = {
      valid: false,
      totalEvents: 0,
      brokenAtId: 'evt-99',
      reason: 'Hash mismatch',
    }

    const report = await generateHIPAAAuditReport(
      period,
      'tenant-001',
      brokenChain,
    )
    expect(report.chainVerification.valid).toBe(false)
    expect(report.chainVerification.brokenAtId).toBe('evt-99')
    expect(report.summary.chainValid).toBe(false)
  })

  it('updates totalEvents in chain verification', async () => {
    const events = [makeEvent(), makeEvent(), makeEvent()]
    mockQueryAuditEvents.mockResolvedValue(events)

    const report = await generateHIPAAAuditReport(period, 'tenant-001', {
      ...validChain,
      totalEvents: 0,
    })
    expect(report.chainVerification.totalEvents).toBe(3)
  })

  it('returns empty report when no events found', async () => {
    mockQueryAuditEvents.mockResolvedValue([])

    const report = await generateHIPAAAuditReport(
      period,
      'tenant-001',
      validChain,
    )
    expect(report.phiAccessEvents).toHaveLength(0)
    expect(report.phiModificationEvents).toHaveLength(0)
    expect(report.breakGlassEvents).toHaveLength(0)
    expect(report.summary.totalPhiAccess).toBe(0)
    expect(report.summary.uniqueUsers).toBe(0)
  })

  it('detects PHI access via metadata.patientId', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        action: 'some_custom_action',
        type: AuditEventType.ACCESS,
        metadata: { patientId: 'patient-99' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)

    const report = await generateHIPAAAuditReport(
      period,
      'tenant-001',
      validChain,
    )
    // The custom action doesn't match PHI_ACCESS_ACTIONS, but metadata.patientId + type ACCESS should trigger
    expect(report.phiAccessEvents).toHaveLength(1)
    expect(report.phiAccessEvents[0].patientId).toBe('patient-99')
  })
})
