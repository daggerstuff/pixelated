/**
 * Tests for Access Review report generator.
 * Mocks queryAuditEvents to test role assignment and permission change logic.
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

import { generateAccessReviewReport } from '../access-review-report'
import type { ReportPeriod } from '../types'

const period: ReportPeriod = {
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: '2025-01-31T23:59:59.000Z',
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
    action: 'role_assigned',
    severity: AuditSeverity.INFO,
    status: 'success',
    ...overrides,
  }
}

describe('generateAccessReviewReport', () => {
  it('builds report with correct report type', async () => {
    mockQueryAuditEvents.mockResolvedValue([])
    const report = await generateAccessReviewReport(period, 'tenant-001')
    expect(report.reportType).toBe('access_review')
    expect(report.period).toEqual(period)
    expect(report.tenantId).toBe('tenant-001')
  })

  it('builds role assignments from role_assigned events', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        id: '1',
        userId: 'user-1',
        action: 'role_assigned',
        metadata: { role: 'physician' },
      }),
      makeEvent({
        id: '2',
        userId: 'user-2',
        action: 'role_assigned',
        metadata: { role: 'nurse' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateAccessReviewReport(period, 'tenant-001')
    expect(report.roleAssignments).toHaveLength(2)
    expect(report.roleAssignments[0].userId).toBe('user-1')
    expect(report.roleAssignments[0].role).toBe('physician')
    expect(report.roleAssignments[0].active).toBe(true)
  })

  it('resolves permissions for known roles', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        userId: 'user-1',
        action: 'role_assigned',
        metadata: { role: 'physician' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateAccessReviewReport(period, 'tenant-001')
    // physician has read_patient, write_patient, etc.
    expect(report.roleAssignments[0].permissions).toContain('read_patient')
    expect(report.roleAssignments[0].permissions).toContain('export_phi')
    expect(report.roleAssignments[0].permissions.length).toBeGreaterThan(5)
  })

  it('returns empty permissions for unknown roles', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        userId: 'user-1',
        action: 'role_assigned',
        metadata: { role: 'unknown_role' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateAccessReviewReport(period, 'tenant-001')
    expect(report.roleAssignments[0].permissions).toEqual([])
  })

  it('detects role assignment via role_grant action', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        userId: 'user-1',
        action: 'role_grant',
        metadata: { role: 'nurse' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateAccessReviewReport(period, 'tenant-001')
    expect(report.roleAssignments).toHaveLength(1)
    expect(report.roleAssignments[0].role).toBe('nurse')
  })

  it('detects role assignment via user_created action', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        userId: 'user-new',
        action: 'user_created',
        metadata: { role: 'frontDesk' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateAccessReviewReport(period, 'tenant-001')
    expect(report.roleAssignments).toHaveLength(1)
    expect(report.roleAssignments[0].role).toBe('frontDesk')
  })

  it('keeps the latest role assignment per user', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        id: '1',
        userId: 'user-1',
        action: 'role_assigned',
        timestamp: '2025-01-10T00:00:00.000Z' as unknown as Date,
        metadata: { role: 'nurse' },
      }),
      makeEvent({
        id: '2',
        userId: 'user-1',
        action: 'role_assigned',
        timestamp: '2025-01-20T00:00:00.000Z' as unknown as Date,
        metadata: { role: 'physician' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateAccessReviewReport(period, 'tenant-001')
    expect(report.roleAssignments).toHaveLength(1)
    expect(report.roleAssignments[0].role).toBe('physician')
  })

  it('builds permission grant changes', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        id: 'g-1',
        userId: 'user-1',
        action: 'permission_granted',
        metadata: {
          permission: 'export_phi',
          role: 'physician',
          reason: 'Promotion',
        },
      }),
      makeEvent({
        id: 'g-2',
        userId: 'user-2',
        action: 'permission_grant',
        metadata: { permission: 'break_glass', role: 'nurse' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateAccessReviewReport(period, 'tenant-001')
    expect(report.permissionChanges).toHaveLength(2)
    expect(report.permissionChanges[0].type).toBe('grant')
    expect(report.permissionChanges[1].type).toBe('grant')
    expect(report.permissionChanges[0].permission).toBe('export_phi')
    expect(report.permissionChanges[1].permission).toBe('break_glass')
  })

  it('builds permission revocation changes', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        id: 'r-1',
        userId: 'user-1',
        action: 'permission_revoked',
        metadata: {
          permission: 'export_phi',
          role: 'physician',
          reason: 'Role change',
        },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateAccessReviewReport(period, 'tenant-001')
    expect(report.permissionChanges).toHaveLength(1)
    expect(report.permissionChanges[0].type).toBe('revocation')
    expect(report.permissionChanges[0].permission).toBe('export_phi')
    expect(report.permissionChanges[0].reason).toBe('Role change')
  })

  it('sorts permission changes by timestamp', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        id: '1',
        userId: 'user-1',
        action: 'permission_granted',
        timestamp: '2025-01-20T00:00:00.000Z' as unknown as Date,
        metadata: { permission: 'export_phi', role: 'physician' },
      }),
      makeEvent({
        id: '2',
        userId: 'user-2',
        action: 'permission_granted',
        timestamp: '2025-01-10T00:00:00.000Z' as unknown as Date,
        metadata: { permission: 'break_glass', role: 'nurse' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateAccessReviewReport(period, 'tenant-001')
    expect(report.permissionChanges[0].timestamp).toBe(
      '2025-01-10T00:00:00.000Z',
    )
    expect(report.permissionChanges[1].timestamp).toBe(
      '2025-01-20T00:00:00.000Z',
    )
  })

  it('counts grants and revocations in summary', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        userId: 'user-1',
        action: 'permission_granted',
        metadata: { permission: 'export_phi', role: 'physician' },
      }),
      makeEvent({
        userId: 'user-2',
        action: 'permission_granted',
        metadata: { permission: 'break_glass', role: 'nurse' },
      }),
      makeEvent({
        userId: 'user-1',
        action: 'permission_revoked',
        metadata: { permission: 'audit_access', role: 'complianceOfficer' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateAccessReviewReport(period, 'tenant-001')
    expect(report.summary.grants).toBe(2)
    expect(report.summary.revocations).toBe(1)
  })

  it('flags high-risk permissions in summary', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        userId: 'user-1',
        action: 'role_assigned',
        metadata: { role: 'physician' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateAccessReviewReport(period, 'tenant-001')
    // physician has export_phi, break_glass, manage_consent — 3 high-risk perms
    expect(report.summary.highRiskPermissions).toBeGreaterThanOrEqual(3)
  })

  it('counts active assignments and total users in summary', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        userId: 'user-1',
        action: 'role_assigned',
        metadata: { role: 'physician' },
      }),
      makeEvent({
        userId: 'user-2',
        action: 'role_assigned',
        metadata: { role: 'nurse' },
      }),
      makeEvent({
        userId: 'user-3',
        action: 'role_assigned',
        metadata: { role: 'nurse' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateAccessReviewReport(period, 'tenant-001')
    expect(report.summary.totalActiveAssignments).toBe(3)
    expect(report.summary.totalUsers).toBe(3)
    expect(report.summary.totalRoles).toBe(2)
  })

  it('provides baseline role assignments when no events found', async () => {
    mockQueryAuditEvents.mockResolvedValue([])
    const report = await generateAccessReviewReport(period, 'tenant-001')
    // Should have baseline assignments from CLINICAL_ROLE_DEFINITIONS
    expect(report.roleAssignments.length).toBeGreaterThan(0)
    const roles = report.roleAssignments.map((a) => a.role)
    expect(roles).toContain('physician')
    expect(roles).toContain('nurse')
  })

  it('marks assignment as inactive for revoke actions', async () => {
    const events: AuditEvent[] = [
      makeEvent({
        userId: 'user-1',
        action: 'user_role_change_revoke',
        metadata: { role: 'physician' },
      }),
    ]
    mockQueryAuditEvents.mockResolvedValue(events)
    const report = await generateAccessReviewReport(period, 'tenant-001')
    expect(report.roleAssignments).toHaveLength(1)
    expect(report.roleAssignments[0].active).toBe(false)
    expect(report.summary.totalActiveAssignments).toBe(0)
  })
})
