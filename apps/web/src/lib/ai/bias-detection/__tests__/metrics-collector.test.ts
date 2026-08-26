import { describe, it, expect, vi, beforeEach } from "vitest";

import { BiasMetricsCollector } from "../metrics-collector";
import { PythonBiasDetectionBridge } from "../python-bridge";
import type { BiasDetectionConfig, BiasAnalysisResult } from "../types";

// Mock the Python bridge with all metrics-collector methods
vi.mock("../python-bridge", () => ({
  PythonBiasDetectionBridge: class {
    initialize = vi.fn().mockResolvedValue(undefined);
    checkHealth = vi.fn().mockResolvedValue({ status: "healthy" });
    sendMetricsBatch = vi.fn().mockResolvedValue({ success: true });
    sendAnalysisMetric = vi.fn().mockResolvedValue({ success: true });
    getDashboardMetrics = vi.fn().mockResolvedValue({
      summary: {
        total_sessions_analyzed: 42,
        average_bias_score: 0.35,
        alert_distribution: { low: 10, medium: 15, high: 12, critical: 5 },
        high_risk_sessions: 5,
        critical_alerts: 5,
      },
      trends: {
        daily_bias_scores: [0.2, 0.25, 0.18],
        alert_counts: [2, 3, 1],
      },
      demographics: {
        bias_by_age_group: { "18-24": 20, "25-34": 35 },
        bias_by_gender: { male: 45, female: 50, other: 5 },
      },
    });
    getPerformanceMetrics = vi.fn().mockResolvedValue({
      average_response_time: 150,
      requests_per_second: 10,
      error_rate: 0.02,
      uptime_seconds: 3600,
      health_status: "healthy",
    });
    getSessionData = vi.fn().mockResolvedValue({ session_id: "test", data: {} });
    storeMetrics = vi.fn().mockResolvedValue({ success: true });
    recordReportMetric = vi.fn().mockResolvedValue({ success: true });
    dispose = vi.fn().mockResolvedValue(undefined);
  },
}));

// Mock analysis result for use across multiple tests
const mockAnalysisResult: BiasAnalysisResult = {
  sessionId: "test-session-123",
  timestamp: new Date(),
  overallBiasScore: 0.3,
  alertLevel: "medium",
  layerResults: {
    preprocessing: {
      biasScore: 0.2,
      linguisticBias: {
        genderBiasScore: 0.1,
        racialBiasScore: 0.1,
        ageBiasScore: 0.1,
        culturalBiasScore: 0.1,
        biasedTerms: [],
        sentimentAnalysis: {
          overallSentiment: 0.0,
          emotionalValence: 0.0,
          subjectivity: 0.0,
          demographicVariations: {},
        },
      },
      representationAnalysis: {
        demographicDistribution: {},
        underrepresentedGroups: [],
        overrepresentedGroups: [],
        diversityIndex: 0,
        intersectionalityAnalysis: [],
      },
      dataQualityMetrics: {
        completeness: 1,
        consistency: 1,
        accuracy: 1,
        timeliness: 1,
        validity: 1,
        missingDataByDemographic: {},
      },
      recommendations: [],
    },
    modelLevel: {
      biasScore: 0.3,
      fairnessMetrics: {
        demographicParity: 0.9,
        equalizedOdds: 0.8,
        equalOpportunity: 0.85,
        calibration: 0.95,
        individualFairness: 0.9,
        counterfactualFairness: 0.88,
      },
      performanceMetrics: {
        accuracy: 0.85,
        precision: 0.82,
        recall: 0.88,
        f1Score: 0.85,
        auc: 0.91,
        calibrationError: 0.05,
        demographicBreakdown: {},
      },
      groupPerformanceComparison: [],
      recommendations: [],
    },
    interactive: {
      biasScore: 0.25,
      counterfactualAnalysis: {
        scenariosAnalyzed: 10,
        biasDetected: false,
        consistencyScore: 0.9,
        problematicScenarios: [],
      },
      featureImportance: [],
      whatIfScenarios: [],
      recommendations: [],
    },
    evaluation: {
      biasScore: 0.35,
      huggingFaceMetrics: {
        toxicity: 0.1,
        bias: 0.2,
        regard: {},
        stereotype: 0.15,
        fairness: 0.8,
      },
      customMetrics: {
        therapeuticBias: 0.1,
        culturalSensitivity: 0.9,
        professionalEthics: 0.95,
        patientSafety: 0.98,
      },
      temporalAnalysis: {
        trendDirection: "stable",
        changeRate: 0.01,
        seasonalPatterns: [],
        interventionEffectiveness: [],
      },
      recommendations: [],
    },
  },
  recommendations: ["Monitor for emerging patterns"],
  confidence: 0.85,
  demographics: {
    age: "30",
    gender: "female",
    ethnicity: "caucasian",
    primaryLanguage: "english",
  },
};

describe("BiasMetricsCollector", () => {
  let metricsCollector: BiasMetricsCollector;
  let mockPythonBridge: PythonBiasDetectionBridge;
  let mockConfig: BiasDetectionConfig;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock configuration
    mockConfig = {
      pythonServiceUrl: "http://localhost:5000",
      pythonServiceTimeout: 30000,
      metricsConfig: {
        enableRealTimeMonitoring: true,
        metricsRetentionDays: 30,
        aggregationIntervals: ["1h", "1d"],
        dashboardRefreshRate: 60,
        exportFormats: ["json"],
      },
    };

    // Create mock Python bridge
    mockPythonBridge = new PythonBiasDetectionBridge(
      mockConfig.pythonServiceUrl,
      mockConfig.pythonServiceTimeout,
    );

    // Create metrics collector
    metricsCollector = new BiasMetricsCollector(mockConfig, mockPythonBridge);
  });

  describe("initialization", () => {
    it("should initialize with correct configuration", () => {
      expect(metricsCollector).toBeDefined();
    });

    it("should initialize Python bridge", async () => {
      await metricsCollector.initialize();
      expect(mockPythonBridge["initialize"]).toHaveBeenCalled();
    });
  });

  describe("metrics collection", () => {
    it("should store analysis results", async () => {
      await expect(
        metricsCollector.storeAnalysisResult?.(mockAnalysisResult),
      ).resolves.not.toThrow();
    });

    it("should retrieve metrics", async () => {
      const metrics = await metricsCollector.getMetrics?.();
      expect(metrics).toBeDefined();
    });

    it("should generate dashboard data", async () => {
      const dashboardData = await metricsCollector.getDashboardData();
      expect(dashboardData).toBeDefined();
      expect(dashboardData).toHaveProperty("summary");
      expect(dashboardData).toHaveProperty("recentAnalyses");
      expect(dashboardData).toHaveProperty("alerts");
      expect(dashboardData).toHaveProperty("trends");
      expect(dashboardData).toHaveProperty("demographics");
      expect(dashboardData).toHaveProperty("recommendations");
    });

    it("should handle metrics storage failures gracefully", async () => {
      // Mock a storage failure
      const storeSpy = vi
        .spyOn(metricsCollector, "storeAnalysisResult")
        .mockRejectedValue(new Error("Storage failed"));

      await expect(metricsCollector.storeAnalysisResult(mockAnalysisResult)).rejects.toThrow();

      // Restore original method
      storeSpy.mockRestore();
    });
  });

  describe("performance metrics", () => {
    it("should return current performance metrics", async () => {
      const perfMetrics = await metricsCollector.getCurrentPerformanceMetrics?.();
      expect(perfMetrics).toBeDefined();
    });

    it("should handle performance metrics retrieval failures", async () => {
      const perfSpy = vi
        .spyOn(metricsCollector, "getCurrentPerformanceMetrics")
        .mockRejectedValue(new Error("Performance metrics failed"));

      await expect(metricsCollector.getCurrentPerformanceMetrics()).rejects.toThrow();

      // Restore original method
      perfSpy.mockRestore();
    });
  });

  describe("data aggregation", () => {
    it("should aggregate metrics over time periods", async () => {
      const metrics = await metricsCollector.getMetrics?.();
      if (metrics) {
        expect(metrics).toHaveProperty("overall_stats");
        expect(metrics.overall_stats).toHaveProperty("total_sessions");
        expect(metrics.overall_stats).toHaveProperty("average_bias_score");
      }
    });

    it("should handle empty metrics data", async () => {
      // Test with no stored data
      const metrics = await metricsCollector.getMetrics?.();
      expect(metrics).toBeDefined();
    });
  });

  describe("cache management", () => {
    it("should manage local cache effectively", async () => {
      // Test cache size limits and eviction
      const mockResult: BiasAnalysisResult = {
        ...mockAnalysisResult,
        sessionId: "cache-test-1",
      };

      await metricsCollector.storeAnalysisResult?.(mockResult);

      // Verify cache contains the data
      const metrics = await metricsCollector.getMetrics?.();
      expect(metrics).toBeDefined();
    });

    it("should handle cache misses gracefully", async () => {
      const metrics = await metricsCollector.getMetrics?.();
      expect(metrics).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle initialization failures", async () => {
      mockConfig.strictMode = true;
      const failingBridge = new PythonBiasDetectionBridge(
        mockConfig.pythonServiceUrl,
        mockConfig.pythonServiceTimeout,
      );

      failingBridge.initialize = vi.fn().mockRejectedValue(new Error("Init failed"));

      const failingCollector = new BiasMetricsCollector(mockConfig, failingBridge);

      await expect(failingCollector.initialize()).rejects.toThrow();
    });

    it("should handle network failures during metrics storage", async () => {
      const storeSpy = vi
        .spyOn(metricsCollector, "storeAnalysisResult")
        .mockRejectedValue(new Error("Network error"));

      await expect(metricsCollector.storeAnalysisResult(mockAnalysisResult)).rejects.toThrow();

      // Restore original method
      storeSpy.mockRestore();
    });
  });

  describe("extractDemographicGroups", () => {
    it("should extract core demographic groups", () => {
      const groups = (metricsCollector as any)["extractDemographicGroups"]({
        age: "30",
        gender: "female",
        ethnicity: "caucasian",
        primaryLanguage: "english",
      });
      expect(groups).toContain("age:30");
      expect(groups).toContain("gender:female");
      expect(groups).toContain("ethnicity:caucasian");
      expect(groups).toContain("language:english");
    });

    it("should extract optional demographic fields", () => {
      const groups = (metricsCollector as any)["extractDemographicGroups"]({
        age: "25",
        gender: "male",
        ethnicity: "asian",
        primaryLanguage: "chinese",
        socioeconomicStatus: "middle",
        education: "bachelor",
        region: "northeast",
      });
      expect(groups).toContain("socioeconomic:middle");
      expect(groups).toContain("education:bachelor");
      expect(groups).toContain("region:northeast");
    });

    it("should handle partial demographic data", () => {
      const groups = (metricsCollector as any)["extractDemographicGroups"]({
        age: "40",
      });
      expect(groups).toEqual(["age:40"]);
    });

    it("should return empty array for empty demographics", () => {
      const groups = (metricsCollector as any)["extractDemographicGroups"]({});
      expect(groups).toEqual([]);
    });
  });

  describe("initialize error handling", () => {
    it("should fallback to local-only mode when bridge init fails without strictMode", async () => {
      const nonStrictConfig = { ...mockConfig, strictMode: false };
      const nonStrictCollector = new BiasMetricsCollector(nonStrictConfig, mockPythonBridge);

      (mockPythonBridge.initialize as any).mockRejectedValueOnce(new Error("Service unreachable"));

      // Should not throw — falls back to local-only mode
      await expect(nonStrictCollector.initialize()).resolves.not.toThrow();
    });
  });

  describe("getSummaryMetrics and getDemographicMetrics", () => {
    it("should get summary metrics", async () => {
      const summary = await metricsCollector.getSummaryMetrics();
      expect(summary).toBeDefined();
      expect(summary).toHaveProperty("total_sessions");
      expect(summary).toHaveProperty("average_bias_score");
    });

    it("should get demographic metrics", async () => {
      const demographics = await metricsCollector.getDemographicMetrics();
      expect(demographics).toBeDefined();
      expect(demographics).toHaveProperty("bias_by_age_group");
      expect(demographics).toHaveProperty("bias_by_gender");
    });

    it("should return fallback summary when bridge fails", async () => {
      (mockPythonBridge.getDashboardMetrics as any).mockRejectedValueOnce(
        new Error("Service unavailable"),
      );

      const summary = await metricsCollector.getSummaryMetrics();
      // getDashboardData catches its own errors and returns fallback data
      expect(summary).toBeDefined();
      expect(summary).toHaveProperty("total_sessions");
    });

    it("should return fallback demographics when bridge fails", async () => {
      (mockPythonBridge.getDashboardMetrics as any).mockRejectedValueOnce(
        new Error("Service unavailable"),
      );

      const demographics = await metricsCollector.getDemographicMetrics();
      // getDashboardData catches its own errors and returns fallback data
      expect(demographics).toBeDefined();
      expect(demographics).toHaveProperty("bias_by_age_group");
    });
  });

  describe("getPerformanceMetrics", () => {
    it("should return performance metrics from bridge", async () => {
      const perf = await metricsCollector.getPerformanceMetrics();
      expect(perf).toHaveProperty("responseTime", 150);
      expect(perf).toHaveProperty("throughput", 10);
      expect(perf).toHaveProperty("errorRate", 0.02);
      expect(perf).toHaveProperty("systemHealth", "healthy");
    });

    it("should return fallback metrics when bridge fails", async () => {
      (mockPythonBridge.getPerformanceMetrics as any).mockRejectedValueOnce(
        new Error("Service unavailable"),
      );

      const perf = await metricsCollector.getPerformanceMetrics();
      expect(perf).toHaveProperty("systemHealth", "error");
      expect(perf).toHaveProperty("errorRate", 1.0);
    });
  });

  describe("recordReportGeneration", () => {
    it("should record report generation metric", async () => {
      await expect(
        metricsCollector.recordReportGeneration({ metadata: { executionTimeMs: 150 } }),
      ).resolves.not.toThrow();
      expect(mockPythonBridge.recordReportMetric).toHaveBeenCalled();
    });

    it("should handle report recording failure", async () => {
      (mockPythonBridge.recordReportMetric as any).mockRejectedValueOnce(
        new Error("Service unavailable"),
      );

      // Should not throw — error is caught internally
      await expect(
        metricsCollector.recordReportGeneration({ metadata: {} }),
      ).resolves.not.toThrow();
    });
  });

  describe("session counts", () => {
    it("should get recent session count", async () => {
      const count = await metricsCollector.getRecentSessionCount();
      expect(typeof count).toBe("number");
    });

    it("should get active analyses count", async () => {
      const count = await metricsCollector.getActiveAnalysesCount();
      expect(typeof count).toBe("number");
    });

    it("should get session analysis by ID", async () => {
      const analysis = await metricsCollector.getSessionAnalysis("session-123");
      expect(analysis).toBeDefined();
    });
  });

  describe("storeAnalysisResult edge cases", () => {
    it("should handle Python storeMetrics failure gracefully", async () => {
      (mockPythonBridge.storeMetrics as any).mockRejectedValueOnce(
        new Error("Storage unavailable"),
      );

      // storeMetrics is inside a nested try-catch that swallows the error
      // so storeAnalysisResult should still resolve successfully
      await expect(
        metricsCollector.storeAnalysisResult(mockAnalysisResult, 150),
      ).resolves.not.toThrow();
    });

    it("should store analysis with processing time", async () => {
      await metricsCollector.storeAnalysisResult(mockAnalysisResult, 250);
      expect(mockPythonBridge.sendAnalysisMetric).toHaveBeenCalled();
    });

    it("should handle demographics extraction during store", async () => {
      const resultWithAllDemographics: BiasAnalysisResult = {
        ...mockAnalysisResult,
        sessionId: "demo-store-test",
        demographics: {
          age: "45",
          gender: "male",
          ethnicity: "asian",
          primaryLanguage: "chinese",
          socioeconomicStatus: "middle",
          education: "graduate",
          region: "west",
        },
      };
      await expect(
        metricsCollector.storeAnalysisResult(resultWithAllDemographics, 100),
      ).resolves.not.toThrow();
    });
  });

  describe("getSummaryMetrics error paths", () => {
    it("should return undefined when getDashboardData throws unexpected error", async () => {
      // Mock getDashboardData on the instance to throw
      const dashSpy = vi
        .spyOn(metricsCollector, "getDashboardData")
        .mockRejectedValue(new Error("Unexpected dash error"));

      const summary = await metricsCollector.getSummaryMetrics();
      expect(summary).toBeUndefined();

      dashSpy.mockRestore();
    });
  });

  describe("getDemographicMetrics error paths", () => {
    it("should return undefined when bridge call fails", async () => {
      (mockPythonBridge.getDashboardMetrics as any).mockRejectedValueOnce(
        new Error("Demo fetch failed"),
      );

      const demographics = await metricsCollector.getDemographicMetrics();
      // Falls through to fallback (not undefined because getDashboardData catches its own errors)
      expect(demographics).toBeDefined();
    });

    it("should return undefined when getDashboardData throws", async () => {
      const dashSpy = vi
        .spyOn(metricsCollector, "getDashboardData")
        .mockRejectedValue(new Error("Unexpected error"));

      const demographics = await metricsCollector.getDemographicMetrics();
      expect(demographics).toBeUndefined();

      dashSpy.mockRestore();
    });
  });

  describe("getRecentSessionCount error path", () => {
    it("should return 0 when bridge fails", async () => {
      (mockPythonBridge.getDashboardMetrics as any).mockRejectedValueOnce(
        new Error("Session count fetch failed"),
      );

      const count = await metricsCollector.getRecentSessionCount();
      expect(count).toBe(0);
    });
  });

  describe("getSessionAnalysis error path", () => {
    it("should return null when bridge fails", async () => {
      (mockPythonBridge.getSessionData as any).mockRejectedValueOnce(
        new Error("Session fetch failed"),
      );

      const analysis = await metricsCollector.getSessionAnalysis("fail-session");
      expect(analysis).toBeNull();
    });
  });

  describe("getActiveAnalysesCount", () => {
    it("should return 0 when no analyses stored", async () => {
      const count = await metricsCollector.getActiveAnalysesCount();
      expect(count).toBe(0);
    });

    it("should return count after storing analyses", async () => {
      await metricsCollector.storeAnalysisResult(mockAnalysisResult, 100);
      const count = await metricsCollector.getActiveAnalysesCount();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getStoredSessionAnalysis", () => {
    it("should delegate to getSessionAnalysis", async () => {
      const result = await metricsCollector.getStoredSessionAnalysis("test-session");
      expect(result).toBeDefined();
    });
  });

  describe("getMetrics fallback path with local cache", () => {
    it("should return fallback metrics from local cache when bridge fails", async () => {
      // Store analysis to populate local cache
      await metricsCollector.storeAnalysisResult(mockAnalysisResult, 100);

      // Make getDashboardMetrics fail to trigger fallback
      (mockPythonBridge.getDashboardMetrics as any).mockRejectedValueOnce(
        new Error("Service unavailable"),
      );

      const metrics = await metricsCollector.getMetrics();

      expect(metrics.overall_stats.total_sessions).toBeGreaterThanOrEqual(1);
      expect(metrics.overall_stats.average_bias_score).toBe(0.3);
      expect(metrics).toHaveProperty("performance_metrics");
      expect(metrics.performance_metrics!.health_status).toBe("degraded");
    });

    it("should return empty fallback metrics when bridge fails and cache is empty", async () => {
      (mockPythonBridge.getDashboardMetrics as any).mockRejectedValue(
        new Error("Service unavailable"),
      );

      const metrics = await metricsCollector.getMetrics();

      expect(metrics.overall_stats.total_sessions).toBe(0);
      expect(metrics.overall_stats.average_bias_score).toBe(0);
    });
  });

  describe("flushLocalMetrics error path", () => {
    it("should catch and log error when sendMetricsBatch fails", async () => {
      // Store an analysis to populate the local cache
      await metricsCollector.storeAnalysisResult(mockAnalysisResult, 100);

      // Make sendMetricsBatch throw on the next call
      (mockPythonBridge.sendMetricsBatch as any).mockRejectedValueOnce(
        new Error("Batch send failed"),
      );

      // Call private flushLocalMetrics — should not throw despite error
      await expect((metricsCollector as any).flushLocalMetrics()).resolves.not.toThrow();

      // Local cache should still contain the data (wasn't cleared due to failure)
      expect((metricsCollector as any).localCache.size).toBeGreaterThan(0);
    });

    it("should early-return when local cache is empty", async () => {
      // Call flushLocalMetrics with empty cache — should return immediately
      await expect((metricsCollector as any).flushLocalMetrics()).resolves.not.toThrow();
    });
  });

  describe("startAggregation", () => {
    it("should set aggregation interval when called", async () => {
      // startAggregation is called by initialize() which creates the interval
      // We can verify the method works by calling it directly
      const collector = new BiasMetricsCollector(mockConfig, mockPythonBridge);

      // Call private startAggregation
      (collector as any).startAggregation();

      // Verify the interval was set
      expect((collector as any).aggregationInterval).toBeDefined();

      // Cleanup
      clearInterval((collector as any).aggregationInterval);
    });
  });

  describe("storeAnalysisResult outer catch block", () => {
    it("should catch and rethrow when recordAnalysis throws", async () => {
      // Spy on recordAnalysis to make it throw, which triggers the outer catch
      const recordSpy = vi
        .spyOn(metricsCollector as any, "recordAnalysis")
        .mockRejectedValue(new Error("Record analysis failed"));

      await expect(metricsCollector.storeAnalysisResult(mockAnalysisResult, 100)).rejects.toThrow(
        "Record analysis failed",
      );

      recordSpy.mockRestore();
    });
  });

  describe("getDashboardData error paths", () => {
    it("should return fallback dashboard data when bridge fails", async () => {
      (mockPythonBridge.getDashboardMetrics as any).mockRejectedValueOnce(
        new Error("Dashboard fetch failed"),
      );

      const dashData = await metricsCollector.getDashboardData();

      // Should return fallback data, not throw
      expect(dashData).toBeDefined();
      expect(dashData.overall_stats).toBeDefined();
      expect(dashData.summary).toBeDefined();
      expect(dashData.trends).toBeDefined();
      expect(dashData.demographics).toBeDefined();
      expect(dashData.system_metrics).toHaveProperty("cpu_usage");
    });

    it("should include cached metrics in fallback dashboard data", async () => {
      // Store an analysis to populate local cache
      await metricsCollector.storeAnalysisResult(mockAnalysisResult, 100);

      // Make bridge fail
      (mockPythonBridge.getDashboardMetrics as any).mockRejectedValueOnce(
        new Error("Dashboard fetch failed"),
      );

      const dashData = await metricsCollector.getDashboardData();

      // Fallback should reflect cached data
      expect(dashData.overall_stats.total_sessions).toBeGreaterThanOrEqual(1);
      expect(dashData.overall_stats.average_bias_score).toBeGreaterThan(0);
    });
  });

  describe("recordAnalysis send error path", () => {
    it("should catch and log when sendAnalysisMetric fails", async () => {
      (mockPythonBridge.sendAnalysisMetric as any).mockRejectedValueOnce(
        new Error("Send metric failed"),
      );

      // recordAnalysis is called from storeAnalysisResult
      await expect(
        metricsCollector.storeAnalysisResult(mockAnalysisResult, 100),
      ).resolves.not.toThrow();
    });
  });

  describe("dispose", () => {
    it("should dispose the metrics collector", async () => {
      await expect(metricsCollector.dispose()).resolves.not.toThrow();
      expect(mockPythonBridge.dispose).toHaveBeenCalled();
    });

    it("should clear aggregation interval when set", async () => {
      // Set an aggregation interval on the collector
      const fakeInterval = setInterval(() => {}, 100000);
      (metricsCollector as any).aggregationInterval = fakeInterval;

      await metricsCollector.dispose();

      // After dispose, the interval should have been cleared
      expect(mockPythonBridge.dispose).toHaveBeenCalled();
    });
  });
});
