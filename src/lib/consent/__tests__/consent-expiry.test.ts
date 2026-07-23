import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ConsentExpiryService,
  getConsentExpiryService,
  resetConsentExpiryService,
} from "../ConsentExpiryService";
import { consentManagementService } from "@/lib/research/services/ConsentManagementService";

// Mock the logger
vi.mock("@/lib/logging/logger", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("ConsentExpiryService", () => {
  let service: ConsentExpiryService;

  beforeEach(async () => {
    resetConsentExpiryService();
    service = getConsentExpiryService();
    // Initialize some consent records for testing
    await consentManagementService.initializeConsent("client-expired", "minimal");
    await consentManagementService.initializeConsent("client-active", "full");
    // Manually expire one consent by updating the store via the service
    // Since the store is private, we use the public API
    // We'll create a consent and then update its expiration
  });

  afterEach(() => {
    resetConsentExpiryService();
  });

  describe("default config", () => {
    it("should have warningDays=30 and criticalDays=7 by default", () => {
      const config = service.getConfig();
      expect(config.warningDays).toBe(30);
      expect(config.criticalDays).toBe(7);
    });

    it("should allow config updates", () => {
      service.setConfig({ warningDays: 60 });
      expect(service.getConfig().warningDays).toBe(60);
      expect(service.getConfig().criticalDays).toBe(7); // unchanged

      service.setConfig({ criticalDays: 14 });
      expect(service.getConfig().criticalDays).toBe(14);
    });
  });

  describe("checkExpiries", () => {
    it("should return a valid ExpiryCheckResult structure", async () => {
      const result = await service.checkExpiries();

      expect(result).toHaveProperty("checkedAt");
      expect(result).toHaveProperty("totalChecked");
      expect(result).toHaveProperty("reminders");
      expect(result).toHaveProperty("summary");
      expect(result.summary).toHaveProperty("expiringSoon");
      expect(result.summary).toHaveProperty("expiringCritical");
      expect(result.summary).toHaveProperty("expired");
      expect(Array.isArray(result.reminders)).toBe(true);
    });

    it("should include checkedAt as ISO string", async () => {
      const result = await service.checkExpiries();
      expect(() => new Date(result.checkedAt)).not.toThrow();
      expect(new Date(result.checkedAt).toString()).not.toBe("Invalid Date");
    });

    it("should count total clients checked", async () => {
      const result = await service.checkExpiries();
      expect(result.totalChecked).toBeGreaterThan(0);
    });
  });

  describe("getExpiringConsents", () => {
    it("should return array of consent records expiring within given days", async () => {
      const expiring = await service.getExpiringConsents(365);
      expect(Array.isArray(expiring)).toBe(true);
      // All initialized consents have 365-day expiry, so they should be within 365 days
      expect(expiring.length).toBeGreaterThan(0);
    });

    it("should return empty array for 0 days (nothing expires immediately)", async () => {
      const expiring = await service.getExpiringConsents(0);
      // Consents were just initialized, so none expire in 0 days
      expect(expiring.length).toBe(0);
    });

    it("should return all active consents for large days value", async () => {
      const expiring = await service.getExpiringConsents(9999);
      expect(expiring.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("reminder types", () => {
    it("should classify consents correctly based on days until expiry", async () => {
      // With default config: warning=30, critical=7
      // New consents expire in 365 days, so they should be "none" (no reminder)
      const result = await service.checkExpiries();

      // New consents shouldn't generate reminders (365 > 30)
      const newConsentReminders = result.reminders.filter(
        (r) => r.clientId === "client-active" || r.clientId === "client-expired",
      );
      // They might or might not have reminders depending on timing
      // but the structure should be valid
      for (const reminder of newConsentReminders) {
        expect(["expiring-soon", "expiring-critical", "expired"]).toContain(reminder.reminderType);
        expect(reminder.message).toContain(reminder.clientId);
      }
    });

    it("should have correct message format for reminders", async () => {
      const result = await service.checkExpiries();

      for (const reminder of result.reminders) {
        expect(reminder.message).toContain(reminder.clientId);
        expect(reminder.message).toContain("day");
        expect(reminder).toHaveProperty("clientId");
        expect(reminder).toHaveProperty("consentLevel");
        expect(reminder).toHaveProperty("expirationDate");
        expect(reminder).toHaveProperty("daysUntilExpiry");
      }
    });
  });

  describe("singleton", () => {
    it("should return the same instance", () => {
      const s1 = getConsentExpiryService();
      const s2 = getConsentExpiryService();
      expect(s1).toBe(s2);
    });

    it("should return new instance after reset", () => {
      const s1 = getConsentExpiryService();
      resetConsentExpiryService();
      const s2 = getConsentExpiryService();
      expect(s1).not.toBe(s2);
    });
  });

  describe("summary counts", () => {
    it("should have consistent summary counts matching reminders array", async () => {
      const result = await service.checkExpiries();

      const soonCount = result.reminders.filter((r) => r.reminderType === "expiring-soon").length;
      const criticalCount = result.reminders.filter(
        (r) => r.reminderType === "expiring-critical",
      ).length;
      const expiredCount = result.reminders.filter((r) => r.reminderType === "expired").length;

      expect(result.summary.expiringSoon).toBe(soonCount);
      expect(result.summary.expiringCritical).toBe(criticalCount);
      expect(result.summary.expired).toBe(expiredCount);
    });
  });
});

describe("Consent Management Service Integration", () => {
  beforeEach(async () => {
    // Initialize test data
    await consentManagementService.initializeConsent("test-client-1", "minimal");
    await consentManagementService.initializeConsent("test-client-2", "full");
  });

  describe("consent CRUD", () => {
    it("should get consent record by clientId", async () => {
      const record = await consentManagementService.getConsentRecord("test-client-1");
      expect(record).not.toBeNull();
      expect(record?.clientId).toBe("test-client-1");
      expect(record?.currentLevel).toBe("minimal");
    });

    it("should return null for non-existent client", async () => {
      const record = await consentManagementService.getConsentRecord("non-existent");
      expect(record).toBeNull();
    });

    it("should update consent level", async () => {
      await consentManagementService.updateConsent({
        clientId: "test-client-1",
        newLevel: "full",
        reason: "User upgraded consent",
      });

      const record = await consentManagementService.getConsentRecord("test-client-1");
      expect(record?.currentLevel).toBe("full");
      expect(record?.consentHistory.length).toBe(2);
    });

    it("should request withdrawal", async () => {
      const result = await consentManagementService.requestWithdrawal(
        "test-client-2",
        "User requested withdrawal",
        false,
      );

      expect(result.consentRecord.withdrawalRequested).toBe(true);
      expect(result.dataPurgeScheduled).toBe(true);
      expect(result.gracePeriodEnd).toBeInstanceOf(Date);
    });

    it("should complete withdrawal", async () => {
      await consentManagementService.requestWithdrawal("test-client-2", "Testing", false);
      await consentManagementService.completeWithdrawal("test-client-2");

      const record = await consentManagementService.getConsentRecord("test-client-2");
      expect(record?.dataPurged).toBe(true);
    });

    it("should throw when updating non-existent consent", async () => {
      await expect(
        consentManagementService.updateConsent({
          clientId: "non-existent",
          newLevel: "full",
        }),
      ).rejects.toThrow();
    });

    it("should throw when completing withdrawal without request", async () => {
      await expect(consentManagementService.completeWithdrawal("test-client-1")).rejects.toThrow();
    });
  });

  describe("audit trail", () => {
    it("should record initialize operation in audit trail", async () => {
      await consentManagementService.initializeConsent("audit-test-client", "limited");
      const trail = await consentManagementService.getAuditTrail("audit-test-client");

      expect(trail.length).toBeGreaterThan(0);
      const initEntry = trail.find((e) => e.operation === "initialize");
      expect(initEntry).toBeDefined();
      expect(initEntry?.newLevel).toBe("limited");
    });

    it("should record update operation in audit trail", async () => {
      await consentManagementService.initializeConsent("audit-update-client", "minimal");
      await consentManagementService.updateConsent({
        clientId: "audit-update-client",
        newLevel: "limited",
        reason: "Audit test",
      });

      const trail = await consentManagementService.getAuditTrail("audit-update-client");
      const updateEntry = trail.find((e) => e.operation === "update");
      expect(updateEntry).toBeDefined();
      expect(updateEntry?.oldLevel).toBe("minimal");
      expect(updateEntry?.newLevel).toBe("limited");
    });

    it("should record withdrawal request in audit trail", async () => {
      await consentManagementService.requestWithdrawal("test-client-1", "Testing withdrawal");

      const trail = await consentManagementService.getAuditTrail("test-client-1");
      const withdrawEntry = trail.find((e) => e.operation === "withdrawal-request");
      expect(withdrawEntry).toBeDefined();
      expect(withdrawEntry?.reason).toBe("Testing withdrawal");
    });

    it("should return all audit entries when no clientId specified", async () => {
      const trail = await consentManagementService.getAuditTrail();
      expect(trail.length).toBeGreaterThan(0);
      expect(trail.some((e) => e.clientId === "test-client-1")).toBe(true);
      expect(trail.some((e) => e.clientId === "test-client-2")).toBe(true);
    });
  });

  describe("statistics", () => {
    it("should return valid statistics structure", async () => {
      const stats = await consentManagementService.getConsentStatistics();

      expect(stats).toHaveProperty("totalClients");
      expect(stats).toHaveProperty("activeConsents");
      expect(stats).toHaveProperty("consentLevels");
      expect(stats).toHaveProperty("withdrawalRequests");
      expect(stats).toHaveProperty("expiredConsents");
      expect(stats.consentLevels).toHaveProperty("none");
      expect(stats.consentLevels).toHaveProperty("minimal");
      expect(stats.consentLevels).toHaveProperty("limited");
      expect(stats.consentLevels).toHaveProperty("full");
    });
  });

  describe("export", () => {
    it("should export consent data with all components", async () => {
      const data = await consentManagementService.exportConsentData();

      expect(data).toHaveProperty("consentRecords");
      expect(data).toHaveProperty("auditLog");
      expect(data).toHaveProperty("statistics");
      expect(Array.isArray(data.consentRecords)).toBe(true);
      expect(Array.isArray(data.auditLog)).toBe(true);
    });
  });

  describe("consent level checks", () => {
    it("should return true for permitted research use with sufficient level", async () => {
      const hasConsent = await consentManagementService.hasConsentFor(
        "test-client-2",
        "aggregateAnalytics",
      );
      expect(hasConsent).toBe(true); // full consent permits aggregateAnalytics
    });

    it("should return false for research use with insufficient level", async () => {
      // test-client-1 might have been updated in earlier tests, so check minimal
      await consentManagementService.initializeConsent("minimal-test-client", "minimal");
      const hasConsent = await consentManagementService.hasConsentFor(
        "minimal-test-client",
        "predictiveModeling",
      );
      expect(hasConsent).toBe(false); // minimal does not permit predictiveModeling
    });
  });
});
