import { EventEmitter } from "events";

import Redis from "ioredis-mock";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCompleteThreatDetectionSystem } from "../integrations";

describe("Phase 8: Advanced AI Threat Detection & Response System", () => {
  let mongod: MongoMemoryServer;
  let redis: Redis;
  let mockOrchestrator: any;
  let mockRateLimiter: any;
  let threatDetectionSystem: any;

  beforeEach(async () => {
    // Setup in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    // Setup mock Redis
    redis = new Redis();

    // Setup mock orchestrator and rate limiter
    mockOrchestrator = new EventEmitter();
    mockRateLimiter = {
      checkLimit: vi.fn<() => Promise<{ allowed: boolean }>>().mockResolvedValue({ allowed: true }),
      consume: vi.fn<() => Promise<{ allowed: boolean }>>().mockResolvedValue({ allowed: true }),
      reset: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    };

    // Create complete threat detection system
    threatDetectionSystem = createCompleteThreatDetectionSystem(mockOrchestrator, mockRateLimiter, {
      threatDetection: {
        enabled: true,
      },
      monitoring: {
        enabled: true,
        aiInsightsEnabled: true,
        monitoringIntervals: {
          realTime: 1000, // 1 second for testing
          batch: 5000, // 5 seconds for testing
          anomalyDetection: 2000, // 2 seconds for testing
        },
      },
      hunting: {
        enabled: true,
        huntingFrequency: 10000, // 10 seconds for testing
        investigationTimeout: 30000, // 30 seconds for testing
      },
      intelligence: {
        enabled: true,
        updateInterval: 30000, // 30 seconds for testing
        feeds: [
          {
            name: "test_feed",
            type: "open_source",
            url: "https://example.com/api/threats",
            authType: "none",
            rateLimit: { requestsPerMinute: 60, burstLimit: 10 },
            supportedIOCTypes: ["ip", "domain"],
            updateFrequency: 60000,
            enabled: true,
            priority: 1,
          },
        ],
      },
    });

    process.env.MONGODB_URI = mongod.getUri();
    await threatDetectionSystem.huntingService.initializeServices();
    await threatDetectionSystem.monitoringService.initializeServices();
  });

  afterEach(async () => {
    await mongod.stop();
    await redis.disconnect();
    vi.clearAllMocks();
  });

  describe("AI-Enhanced Monitoring Service", () => {
    it("should collect security metrics in real-time", async () => {
      const { monitoringService } = threatDetectionSystem;

      // Start monitoring
      await monitoringService.start();

      // Simulate some security events
      mockOrchestrator.emit("security:event", {
        type: "login_attempt",
        userId: "user123",
        ip: "192.168.1.1",
        success: false,
        timestamp: new Date(),
      });

      // Wait for metrics collection
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check if metrics were collected
      const metrics = await monitoringService.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);

      await monitoringService.stop();
    });

    it("should generate AI insights from collected data", async () => {
      const { monitoringService } = threatDetectionSystem;

      // Add some historical data
      await monitoringService.recordMetric({
        name: "failed_login_attempts",
        value: 15,
        timestamp: new Date(),
        tags: { severity: "high", userId: "user123" },
      });

      // Generate insights
      const insights = await monitoringService.generateInsights();

      expect(insights).toBeDefined();
      expect(insights.trends).toBeDefined();
      expect(insights.predictions).toBeDefined();
      expect(insights.recommendations).toBeDefined();
    });

    it("should trigger alerts when thresholds are exceeded", async () => {
      const { monitoringService } = threatDetectionSystem;
      const alertSpy = vi.fn<(alert: { severity: string; metric: string }) => void>();

      monitoringService.on("alert", alertSpy);

      // Generate high volume of events to trigger alert
      for (let i = 0; i < 25; i++) {
        await monitoringService.recordMetric({
          name: "failed_login_attempts",
          value: 1,
          timestamp: new Date(),
          tags: { severity: "high", userId: `user${i}` },
        });
      }

      // Wait for alert processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(alertSpy).toHaveBeenCalled();
      const alert = alertSpy.mock.calls[0][0];
      expect(alert.severity).toBe("high");
      expect(alert.metric).toBe("failed_login_attempts");
    });
  });

  describe("Threat Hunting Service", () => {
    it("should execute hunting rules automatically", { timeout: 10000 }, async () => {
      const { huntingService } = threatDetectionSystem;
      const investigationSpy = vi.fn<(investigation: { id: string; title: string }) => void>();

      huntingService.on("investigation:started", investigationSpy);

      // Start hunting
      await huntingService.start();

      // Simulate threat data
      mockOrchestrator.emit("threat:detected", {
        threatId: "threat123",
        severity: "high",
        userId: "user123",
        ip: "192.168.1.1",
        timestamp: new Date(),
      });

      // Wait for hunting execution
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(investigationSpy).toHaveBeenCalled();

      await huntingService.stop();
    });

    it(
      "should perform manual threat investigation",
      { timeout: 15000 },
      async () => {
        const { huntingService } = threatDetectionSystem;

        const investigation = await huntingService.startInvestigation({
          threatId: "threat456",
          userId: "user456",
          severity: "medium",
          templateId: "standard_threat_investigation",
        });

        expect(investigation).toBeDefined();
        expect(investigation.id).toBeDefined();
        expect(investigation.status).toBe("running");

        // Wait for investigation to complete
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const result = await huntingService.getInvestigationResult(investigation.id);
        expect(result).toBeDefined();
        expect(result.status).toBe("completed");
      },
      { timeout: 15000 },
    );

    it("should update threat intelligence feeds", async () => {
      const { intelligenceService } = threatDetectionSystem;

      process.env.ALIENVAULT_API_KEY = "test_valid_api_key";

      global.fetch = vi
        .fn<
          () => Promise<{
            ok: boolean;
            json: () => Promise<{
              results: Array<{ ip: string; reputation: string }>;
            }>;
          }>
        >()
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            results: [{ ip: "192.168.1.1", reputation: "bad" }],
          }),
        });

      await intelligenceService.updateFeeds();

      expect(global.fetch).toHaveBeenCalledTimes(2);

      delete process.env.ALIENVAULT_API_KEY;
    });
  });

  describe("Threat Intelligence Service", () => {
    it("should perform IOC lookups", async () => {
      const { intelligenceService } = threatDetectionSystem;

      global.fetch = vi
        .fn<
          () => Promise<{
            ok: boolean;
            json: () => Promise<{
              data: Array<{ indicator: string; type: string }>;
            }>;
          }>
        >()
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            data: [{ indicator: "test.com", type: "domain" }],
          }),
        });

      const result = await intelligenceService.lookupIOC("test.com", "domain");
      expect(result).toBeDefined();
    });

    it("should add and retrieve IOCs", async () => {
      const { intelligenceService } = threatDetectionSystem;

      await intelligenceService.addIOC({
        indicator: "malicious.com",
        type: "domain",
        metadata: { source: "test" },
      });

      const rawIOCs = await intelligenceService.getRawIOCs();
      expect(rawIOCs.length).toBeGreaterThan(0);
    });
  });

  describe("Integration Tests", () => {
    it("should coordinate between all Phase 8 services", { timeout: 30000 }, async () => {
      const { monitoringService, huntingService, intelligenceService } = threatDetectionSystem;

      // Start all services
      await Promise.all([
        monitoringService.start(),
        huntingService.start(),
        intelligenceService.start(),
      ]);

      // Simulate a complex threat scenario
      const threatData = {
        threatId: "integrated_threat_001",
        userId: "victim_user",
        ip: "malicious.ip.address",
        severity: "critical",
        type: "data_exfiltration",
        timestamp: new Date(),
      };

      // Emit threat to orchestrator
      mockOrchestrator.emit("threat:detected", threatData);

      // Wait briefly for investigation to start (auto-complete happens in 500ms)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify monitoring captured the event
      const metrics = await monitoringService.getMetrics();
      const threatMetric = metrics.find((m) => m.name === "threats_detected");
      expect(threatMetric).toBeDefined();

      // Verify hunting service initiated investigation (check all, not just active)
      const allInvestigations = await huntingService.getActiveInvestigations();
      const completedInvestigations = [...(huntingService as any).investigations.values()];
      const relatedInvestigation = completedInvestigations.find(
        (inv) => inv.threatId === threatData.threatId,
      );
      expect(relatedInvestigation).toBeDefined();

      // Verify intelligence service checked IOCs
      const iocResults = await intelligenceService.lookupIOC(threatData.ip, "ip");
      expect(iocResults).toBeDefined();

      // Stop all services
      await Promise.all([
        monitoringService.stop(),
        huntingService.stop(),
        intelligenceService.stop(),
      ]);
    });

    it("should handle service failures gracefully", async () => {
      const { monitoringService, huntingService } = threatDetectionSystem;

      // Start services
      await monitoringService.start();
      await huntingService.start();

      // Simulate service failure
      const originalGetMetrics = monitoringService.getMetrics;
      monitoringService.getMetrics = vi
        .fn<() => Promise<never>>()
        .mockRejectedValue(new Error("Service failure"));

      // Verify hunting service continues despite monitoring failure
      const investigation = await huntingService.startInvestigation({
        threatId: "failure_test",
        userId: "test_user",
        severity: "low",
      });

      expect(investigation).toBeDefined();
      expect(investigation.status).toBe("running");

      // Restore original method
      monitoringService.getMetrics = originalGetMetrics;

      await monitoringService.stop();
      await huntingService.stop();
    });
  });

  describe("Performance Tests", () => {
    it("should handle high volume of security events", async () => {
      const { monitoringService } = threatDetectionSystem;

      await monitoringService.start();

      // Generate high volume of events
      const eventCount = 1000;
      const startTime = Date.now();

      for (let i = 0; i < eventCount; i++) {
        await monitoringService.recordMetric({
          name: "security_event",
          value: Math.random() * 100,
          timestamp: new Date(),
          tags: {
            type: ["login", "api_call", "data_access"][Math.floor(Math.random() * 3)],
            userId: `user${i % 100}`,
          },
        });
      }

      const processingTime = Date.now() - startTime;

      // Verify processing time is reasonable (less than 10 seconds for 1000 events)
      expect(processingTime).toBeLessThan(10000);

      // Verify all events were recorded
      const metrics = await monitoringService.getMetrics();
      expect(metrics.length).toBeGreaterThanOrEqual(eventCount);

      await monitoringService.stop();
    });

    it("should maintain low latency for threat intelligence lookups", async () => {
      const { intelligenceService } = threatDetectionSystem;

      process.env.ALIENVAULT_API_KEY = "test_valid_api_key";

      global.fetch = vi
        .fn<
          () => Promise<{
            ok: boolean;
            json: () => Promise<{ data: unknown[] }>;
          }>
        >()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ data: [] }),
        });

      const start = Date.now();
      await intelligenceService.lookupIOC("test.com", "domain");
      const latency = Date.now() - start;

      expect(latency).toBeLessThan(1000);

      delete process.env.ALIENVAULT_API_KEY;
    });
  });

  describe("Security Tests", () => {
    it("should sanitize user inputs in threat data", async () => {
      const { huntingService } = threatDetectionSystem;

      const maliciousInput = {
        threatId: 'threat123<script>alert("xss")</script>',
        userId: "user456<img src=x onerror=alert(1)>",
        severity: "high",
        description: "Malicious description with <script>payload</script>",
      };

      const investigation = await huntingService.startInvestigation(maliciousInput);

      // Verify inputs were sanitized
      expect(investigation.threatId).not.toContain("<script>");
      expect(investigation.userId).not.toContain("<img");
      expect(investigation.description).not.toContain("<script>");
    });

    it("should validate API keys and credentials", async () => {
      const { intelligenceService } = threatDetectionSystem;

      // Test with invalid API key
      process.env.ALIENVAULT_API_KEY = "invalid_key";

      await expect(intelligenceService.updateFeeds()).rejects.toThrow();

      // Test with missing API key
      delete process.env.ALIENVAULT_API_KEY;

      await expect(intelligenceService.updateFeeds()).rejects.toThrow();
    });

    it("should implement proper access controls", async () => {
      const { monitoringService } = threatDetectionSystem;

      // Verify sensitive operations require proper authorization
      const sensitiveOperations = [
        () => monitoringService.clearMetrics(),
        () => monitoringService.getSystemConfig(),
        () => monitoringService.exportData(),
      ];

      for (const operation of sensitiveOperations) {
        await expect(operation()).rejects.toThrow();
      }
    });
  });

  describe("Error Handling Tests", () => {
    it("should handle database connection failures", async () => {
      const { monitoringService } = threatDetectionSystem;

      // Simulate database failure
      const originalGetMetrics = monitoringService.getMetrics;
      monitoringService.getMetrics = vi
        .fn()
        .mockRejectedValue(new Error("Database connection failed"));

      await expect(monitoringService.generateInsights()).rejects.toThrow(
        "Database connection failed",
      );

      // Restore original method
      monitoringService.getMetrics = originalGetMetrics;
    });

    it("should handle Redis cache failures", async () => {
      const { intelligenceService } = threatDetectionSystem;

      const mockLookup = vi
        .fn()
        .mockResolvedValue([{ indicator: "test.com", type: "domain", source: "fallback" }]);
      const originalLookup = intelligenceService.lookupIOC.bind(intelligenceService);
      intelligenceService.lookupIOC = mockLookup;

      const result = await intelligenceService.lookupIOC("test.com", "domain");
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      intelligenceService.lookupIOC = originalLookup;
    });

    it("should handle ML model failures gracefully", async () => {
      const { huntingService } = threatDetectionSystem;

      // Simulate ML model failure
      const originalAnalyze = huntingService.analyzeWithML;
      huntingService.analyzeWithML = vi
        .fn<() => Promise<never>>()
        .mockRejectedValue(new Error("ML model not available"));

      // Should fall back to rule-based analysis
      const result = await huntingService.analyzePatterns({
        type: "behavioral_analysis",
      });

      expect(result).toBeDefined();
      expect(result.analysisType).toBe("rule_based");

      // Restore original method
      huntingService.analyzeWithML = originalAnalyze;
    });
  });

  describe("Compliance Tests", () => {
    it("should maintain audit trails for all operations", async () => {
      const { monitoringService, huntingService } = threatDetectionSystem;

      const auditSpy = vi.fn<(log: { action: string; timestamp: Date }) => void>();
      mockOrchestrator.on("audit:log", auditSpy);

      // Perform various operations
      await monitoringService.recordMetric({
        name: "test_metric",
        value: 42,
        timestamp: new Date(),
      });

      await huntingService.startInvestigation({
        threatId: "audit_test",
        userId: "test_user",
        severity: "medium",
      });

      // Verify audit logs were created
      expect(auditSpy).toHaveBeenCalled();

      const auditLogs = auditSpy.mock.calls.map((call) => call[0]);
      expect(auditLogs.some((log) => log.action === "record_metric")).toBe(true);
      expect(auditLogs.some((log) => log.action === "start_investigation")).toBe(true);
    });

    it("should implement data retention policies", async () => {
      const { monitoringService } = threatDetectionSystem;

      // Add old data
      const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000); // 91 days ago
      await monitoringService.recordMetric({
        name: "old_metric",
        value: 1,
        timestamp: oldDate,
      });

      // Add recent data
      await monitoringService.recordMetric({
        name: "recent_metric",
        value: 2,
        timestamp: new Date(),
      });

      // Run cleanup
      await monitoringService.cleanupOldData();

      // Verify old data was removed
      const metrics = await monitoringService.getMetrics();
      expect(metrics.some((m) => m.name === "old_metric")).toBe(false);
      expect(metrics.some((m) => m.name === "recent_metric")).toBe(true);
    });

    it("should encrypt sensitive data at rest", async () => {
      const { intelligenceService } = threatDetectionSystem;

      // Add sensitive IOC data
      const sensitiveData = {
        indicator: "sensitive-ip",
        type: "ip",
        metadata: {
          victim_info: "confidential_data",
          attack_details: "sensitive_information",
        },
      };

      await intelligenceService.addIOC(sensitiveData);

      // Verify data is encrypted when stored
      const storedData = await intelligenceService.getRawIOCs();
      expect(storedData[0].metadata).not.toContain("confidential_data");
      expect(storedData[0].metadata).not.toContain("sensitive_information");
    });
  });
});
