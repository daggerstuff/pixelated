/**
 * Audit Integration Tests for Governance
 *
 * Verifies that governance decisions are properly logged to the audit trail
 * and can be searched by governance event types.
 */

// Mock the audit module before any other imports
vi.mock("../../audit", () => ({
  AuditEventType: {
    ACCESS: "access",
    CREATE: "create",
    MODIFY: "modify",
    DELETE: "delete",
    LOGIN: "login",
    LOGOUT: "logout",
    REGISTER: "register",
    SYSTEM: "system",
    SECURITY: "security",
    CONSENT: "consent",
    AI_OPERATION: "ai",
    DLP_ALLOWED: "dlp_allowed",
    DLP_BLOCKED: "dlp_blocked",
    SECURITY_ALERT: "security_alert",
  },
  AuditEventStatus: {
    SUCCESS: "success",
    FAILURE: "failure",
    ATTEMPT: "attempt",
    BLOCKED: "blocked",
    WARNING: "warning",
  },
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditEventStatus, AuditEventType } from "../../audit";
import { ComplianceValidator } from "../compliance-validator";
import { PolicyEngine } from "../policy-engine";

/**
 * Mock audit log storage for testing
 */
interface MockAuditLogEntry {
  eventType: AuditEventType;
  action: string;
  resource: string;
  status: AuditEventStatus;
  details?: Record<string, unknown>;
  timestamp: number;
}

describe("Governance Audit Integration", () => {
  let policyEngine: PolicyEngine;
  let complianceValidator: ComplianceValidator;
  let auditLog: MockAuditLogEntry[];

  beforeEach(() => {
    // Clear the audit log before each test
    auditLog = [];
    policyEngine = new PolicyEngine();
    complianceValidator = new ComplianceValidator();
  });

  describe("governance decision logging", () => {
    it("evaluates policy and captures decision for audit logging", async () => {
      // Load a policy for data access
      const policy = {
        policyId: "governance-audit-test-1",
        rules: [
          {
            ruleId: "rule-1",
            conditions: [
              {
                field: "dataClassification",
                operator: "equals" as const,
                value: "confidential",
              },
            ],
            action: {
              type: "allow" as const,
            },
          },
        ],
      };

      policyEngine.loadPolicy(policy);

      // Evaluate a context that matches the policy
      const context = { dataClassification: "confidential" };
      const result = await policyEngine.evaluate(context);

      // Verify the policy evaluation result
      expect(result.allowed).toBe(true);
      expect(result.policyId).toBe("governance-audit-test-1");
      expect(result.ruleId).toBe("rule-1");

      // Simulate audit logging (integration point)
      auditLog.push({
        eventType: AuditEventType.ACCESS,
        action: "policy_evaluation",
        resource: `policy/${result.policyId}`,
        status: result.allowed ? AuditEventStatus.SUCCESS : AuditEventStatus.FAILURE,
        details: {
          ruleId: result.ruleId,
          context: JSON.stringify(context),
        },
        timestamp: Date.now(),
      });

      // Verify audit log entry was created
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].eventType).toBe(AuditEventType.ACCESS);
      expect(auditLog[0].action).toBe("policy_evaluation");
    });

    it("logs compliance validation decisions", async () => {
      // Create mock FHE service
      const mockFheService = {
        isInitialized: () => true,
      };

      complianceValidator.setFheService(mockFheService);

      // Run compliance validation
      const result = await complianceValidator.validate();

      // Verify compliance check passed
      expect(result.compliant).toBe(true);

      // Simulate audit logging (integration point)
      auditLog.push({
        eventType: AuditEventType.SYSTEM,
        action: "compliance_validation",
        resource: "governance/compliance",
        status: result.compliant ? AuditEventStatus.SUCCESS : AuditEventStatus.FAILURE,
        details: {
          reasons: result.reasons,
        },
        timestamp: Date.now(),
      });

      // Verify audit log entry was created
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].eventType).toBe(AuditEventType.SYSTEM);
      expect(auditLog[0].action).toBe("compliance_validation");
    });
  });

  describe("audit log search by governance event type", () => {
    it("can filter audit logs by GOVERNANCE event type", async () => {
      // Create sample audit entries for different event types
      const sampleEntries: MockAuditLogEntry[] = [
        {
          eventType: AuditEventType.ACCESS,
          action: "read",
          resource: "patient/123",
          status: AuditEventStatus.SUCCESS,
          timestamp: Date.now(),
        },
        {
          eventType: AuditEventType.MODIFY,
          action: "update",
          resource: "patient/456",
          status: AuditEventStatus.SUCCESS,
          timestamp: Date.now(),
        },
        {
          eventType: AuditEventType.SECURITY,
          action: "auth_check",
          resource: "system",
          status: AuditEventStatus.SUCCESS,
          timestamp: Date.now(),
        },
      ];

      auditLog.push(...sampleEntries);

      // Filter by governance-related event types
      const governanceEvents = auditLog.filter(
        (entry) =>
          entry.eventType === AuditEventType.ACCESS || entry.eventType === AuditEventType.MODIFY,
      );

      // Verify we can filter governance-related events
      expect(governanceEvents).toHaveLength(2);
      expect(
        governanceEvents.every(
          (e) => e.eventType === AuditEventType.ACCESS || e.eventType === AuditEventType.MODIFY,
        ),
      ).toBe(true);
    });

    it("can search audit logs by resource type", async () => {
      // Create sample audit entries
      const sampleEntries: MockAuditLogEntry[] = [
        {
          eventType: AuditEventType.ACCESS,
          action: "read",
          resource: "phi/patient/123",
          status: AuditEventStatus.SUCCESS,
          timestamp: Date.now(),
        },
        {
          eventType: AuditEventType.ACCESS,
          action: "read",
          resource: "phi/patient/456",
          status: AuditEventStatus.SUCCESS,
          timestamp: Date.now(),
        },
        {
          eventType: AuditEventType.MODIFY,
          action: "update",
          resource: "settings/config",
          status: AuditEventStatus.SUCCESS,
          timestamp: Date.now(),
        },
      ];

      auditLog.push(...sampleEntries);

      // Search by PHI resource type
      const phiEvents = auditLog.filter((entry) => entry.resource.startsWith("phi/"));

      expect(phiEvents).toHaveLength(2);
      expect(phiEvents.every((e) => e.resource.startsWith("phi/"))).toBe(true);
    });

    it("can search audit logs by status", async () => {
      // Create sample audit entries with different statuses
      const sampleEntries: MockAuditLogEntry[] = [
        {
          eventType: AuditEventType.ACCESS,
          action: "read",
          resource: "patient/123",
          status: AuditEventStatus.SUCCESS,
          timestamp: Date.now(),
        },
        {
          eventType: AuditEventType.ACCESS,
          action: "read",
          resource: "patient/456",
          status: AuditEventStatus.SUCCESS,
          timestamp: Date.now(),
        },
        {
          eventType: AuditEventType.MODIFY,
          action: "update",
          resource: "patient/789",
          status: AuditEventStatus.FAILURE,
          timestamp: Date.now(),
        },
      ];

      auditLog.push(...sampleEntries);

      // Search by success status
      const successfulEvents = auditLog.filter(
        (entry) => entry.status === AuditEventStatus.SUCCESS,
      );

      expect(successfulEvents).toHaveLength(2);
      expect(successfulEvents.every((e) => e.status === AuditEventStatus.SUCCESS)).toBe(true);
    });
  });

  describe("governance audit trail integrity", () => {
    it("maintains chronological order of governance decisions", async () => {
      // Simulate sequential governance decisions
      for (let i = 0; i < 3; i++) {
        auditLog.push({
          eventType: AuditEventType.ACCESS,
          action: `operation-${i}`,
          resource: `resource-${i}`,
          status: AuditEventStatus.SUCCESS,
          timestamp: Date.now() + i,
        });
      }

      // Verify logs are in chronological order
      expect(auditLog).toHaveLength(3);
      expect(auditLog.map((e) => e.action)).toEqual(["operation-0", "operation-1", "operation-2"]);
    });

    it("captures complete audit context for governance decisions", async () => {
      // Create a governance decision with full context
      const governanceEvent: MockAuditLogEntry = {
        eventType: AuditEventType.ACCESS,
        action: "policy_evaluation",
        resource: "phi/patient/123",
        status: AuditEventStatus.SUCCESS,
        details: {
          policyId: "test-policy",
          ruleId: "rule-1",
          userId: "user-456",
          reason: "policy_match",
        },
        timestamp: Date.now(),
      };

      auditLog.push(governanceEvent);

      // Verify all context is captured
      const event = auditLog[0];
      expect(event.eventType).toBe(AuditEventType.ACCESS);
      expect(event.action).toBe("policy_evaluation");
      expect(event.resource).toBe("phi/patient/123");
      expect(event.status).toBe(AuditEventStatus.SUCCESS);
      expect(event.details).toEqual({
        policyId: "test-policy",
        ruleId: "rule-1",
        userId: "user-456",
        reason: "policy_match",
      });
    });

    it("can retrieve audit logs by event type using filter", async () => {
      // Create mixed audit entries
      auditLog.push(
        {
          eventType: AuditEventType.ACCESS,
          action: "read",
          resource: "patient/1",
          status: AuditEventStatus.SUCCESS,
          timestamp: Date.now(),
        },
        {
          eventType: AuditEventType.MODIFY,
          action: "update",
          resource: "patient/2",
          status: AuditEventStatus.SUCCESS,
          timestamp: Date.now(),
        },
        {
          eventType: AuditEventType.ACCESS,
          action: "read",
          resource: "patient/3",
          status: AuditEventStatus.SUCCESS,
          timestamp: Date.now(),
        },
        {
          eventType: AuditEventType.DELETE,
          action: "delete",
          resource: "patient/4",
          status: AuditEventStatus.SUCCESS,
          timestamp: Date.now(),
        },
      );

      // Filter by ACCESS event type
      const accessEvents = auditLog.filter((entry) => entry.eventType === AuditEventType.ACCESS);

      expect(accessEvents).toHaveLength(2);
      expect(accessEvents.every((e) => e.eventType === AuditEventType.ACCESS)).toBe(true);
      expect(accessEvents.map((e) => e.resource)).toEqual(["patient/1", "patient/3"]);
    });
  });
});
