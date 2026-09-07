/**
 * Access Review Report Generator
 *
 * Generates an access review report from RBAC audit events,
 * covering role assignments, permission grants/revocations,
 * and high-risk permission identification.
 */

import type {
  ReportPeriod,
  AccessReviewReport,
  AccessRoleAssignment,
  PermissionChange,
  AccessReviewSummary,
} from './types';

import type { AuditEvent } from '@/lib/audit/events';
import { queryAuditEvents } from './report-generator';
import { CLINICAL_ROLE_DEFINITIONS } from '@/lib/ehr-native/auth/role-permissions';
import type { ClinicalRole, EHRPermission } from '@/lib/ehr-native/auth/types';

// ---------------------------------------------------------------------------
// High-risk permissions
// ---------------------------------------------------------------------------

/** Permissions that carry elevated risk and should be flagged in access reviews */
const HIGH_RISK_PERMISSIONS = new Set<EHRPermission>([
  'export_phi',
  'break_glass',
  'audit_access',
  'manage_consent',
  'delete_patient',
  'manage_users',
]);

// ---------------------------------------------------------------------------
// Event classification
// ---------------------------------------------------------------------------

function isRoleAssignmentEvent(event: AuditEvent): boolean {
  const action = String(event.action).toLowerCase();
  return action.includes('role_assigned') || action.includes('role_grant') ||
    action.includes('user_created') || action.includes('user_role_change');
}

function isPermissionGrantEvent(event: AuditEvent): boolean {
  const action = String(event.action).toLowerCase();
  return action.includes('permission_granted') || action.includes('permission_grant');
}

function isPermissionRevocationEvent(event: AuditEvent): boolean {
  const action = String(event.action).toLowerCase();
  return action.includes('permission_revoked') || action.includes('permission_revoke');
}

// ---------------------------------------------------------------------------
// Role assignment builder
// ---------------------------------------------------------------------------

/**
 * Build role assignments from audit events.
 * Tracks the latest role per user within the reporting period.
 */
function buildRoleAssignments(events: AuditEvent[]): AccessRoleAssignment[] {
  const userRoleMap = new Map<string, { role: string; assignedAt: string; active: boolean }>();

  for (const event of events) {
    if (!isRoleAssignmentEvent(event)) continue;
    const meta = event.metadata as Record<string, unknown> | undefined;
    const role = String(meta?.role ?? 'unknown');
    const existing = userRoleMap.get(event.userId);

    if (existing && event.timestamp < existing.assignedAt) {
      continue; // Skip older entries
    }

    const isActive = !String(event.action).toLowerCase().includes('revoke');
    userRoleMap.set(event.userId, { role, assignedAt: event.timestamp, active: isActive });
  }

  // Also include known roles from the role definitions (static baseline)
  const roleDefs = Object.keys(CLINICAL_ROLE_DEFINITIONS) as ClinicalRole[];
  const assignments: AccessRoleAssignment[] = [];

  for (const [userId, info] of userRoleMap) {
    const permissions = resolvePermissionsForRole(info.role);
    assignments.push({
      userId,
      role: info.role,
      permissions,
      assignedAt: info.assignedAt,
      active: info.active,
    });
  }

  // If no events found, provide baseline from role definitions
  if (assignments.length === 0) {
    for (const role of roleDefs) {
      const permissions = resolvePermissionsForRole(role);
      assignments.push({
        userId: `system-${role}`,
        role,
        permissions,
        assignedAt: new Date().toISOString(),
        active: true,
      });
    }
  }

  return assignments;
}

/**
 * Resolve permissions for a given role string.
 * Uses CLINICAL_ROLE_DEFINITIONS for known roles; returns empty for unknown.
 */
function resolvePermissionsForRole(roleStr: string): string[] {
  const knownRoles = Object.keys(CLINICAL_ROLE_DEFINITIONS) as ClinicalRole[];
  if ((knownRoles as string[]).includes(roleStr)) {
    const role = roleStr as ClinicalRole;
    const def = CLINICAL_ROLE_DEFINITIONS[role];
    if (def && def.permissions) {
      return [...def.permissions];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Permission changes builder
// ---------------------------------------------------------------------------

function buildPermissionChanges(events: AuditEvent[]): PermissionChange[] {
  const changes: PermissionChange[] = [];

  for (const event of events) {
    const meta = event.metadata as Record<string, unknown> | undefined;

    if (isPermissionGrantEvent(event)) {
      changes.push({
        changeId: event.id,
        timestamp: event.timestamp,
        userId: event.userId,
        type: 'grant',
        permission: String(meta?.permission ?? 'unknown'),
        role: String(meta?.role ?? 'unknown'),
        reason: meta?.reason ? String(meta.reason) : undefined,
      });
    }

    if (isPermissionRevocationEvent(event)) {
      changes.push({
        changeId: event.id,
        timestamp: event.timestamp,
        userId: event.userId,
        type: 'revocation',
        permission: String(meta?.permission ?? 'unknown'),
        role: String(meta?.role ?? 'unknown'),
        reason: meta?.reason ? String(meta.reason) : undefined,
      });
    }
  }

  changes.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return changes;
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(
  assignments: AccessRoleAssignment[],
  changes: PermissionChange[],
): AccessReviewSummary {
  const activeAssignments = assignments.filter((a) => a.active);
  const userSet = new Set(assignments.map((a) => a.userId));
  const roleSet = new Set(assignments.map((a) => a.role));
  const grants = changes.filter((c) => c.type === 'grant').length;
  const revocations = changes.filter((c) => c.type === 'revocation').length;

  let highRiskCount = 0;
  for (const assignment of activeAssignments) {
    for (const perm of assignment.permissions) {
      if (HIGH_RISK_PERMISSIONS.has(perm as EHRPermission)) {
        highRiskCount += 1;
      }
    }
  }

  return {
    totalActiveAssignments: activeAssignments.length,
    totalUsers: userSet.size,
    totalRoles: roleSet.size,
    grants,
    revocations,
    highRiskPermissions: highRiskCount,
  };
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export async function generateAccessReviewReport(
  period: ReportPeriod,
  tenantId: string,
): Promise<AccessReviewReport> {
  const events = await queryAuditEvents(period.startDate, period.endDate, tenantId);

  const roleAssignments = buildRoleAssignments(events);
  const permissionChanges = buildPermissionChanges(events);
  const summary = buildSummary(roleAssignments, permissionChanges);

  return {
    reportType: 'access_review',
    reportId: '',
    generatedAt: new Date().toISOString(),
    period,
    tenantId,
    roleAssignments,
    permissionChanges,
    summary,
  };
}
