/**
 * Unit tests for BiasDetectionConfigManager
 * Tests configuration loading, validation, environment variable parsing, and error handling
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  BiasDetectionConfigManager,
  biasDetectionConfig,
  getBiasDetectionConfig,
  getConfigSummary,
  isProductionReady,
  validateConfig,
  mergeWithDefaults,
  loadConfigFromEnv,
  createConfigWithEnvOverrides,
  updateConfiguration,
  getEnvironmentConfigSummary,
} from "../config";

describe("BiasDetectionConfigManager", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let configManager: BiasDetectionConfigManager;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear relevant environment variables
    const envVarsToDelete = [
      "BIAS_WARNING_THRESHOLD",
      "BIAS_HIGH_THRESHOLD",
      "BIAS_CRITICAL_THRESHOLD",
      "PYTHON_SERVICE_HOST",
      "PYTHON_SERVICE_PORT",
      "CACHE_ENABLED",
      "ENCRYPTION_ENABLED",
      "JWT_SECRET",
      "ENCRYPTION_KEY",
      "LOG_LEVEL",
      "NODE_ENV",
    ];

    envVarsToDelete.forEach((key) => {
      delete process.env[key];
    });

    // Reset singleton instance
    (BiasDetectionConfigManager as unknown as { instance?: unknown }).instance = undefined;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Reset singleton instance
    (BiasDetectionConfigManager as unknown as { instance?: unknown }).instance = undefined;
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance when called multiple times", () => {
      const instance1 = BiasDetectionConfigManager.getInstance();
      const instance2 = BiasDetectionConfigManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should initialize with default configuration", () => {
      const config = BiasDetectionConfigManager.getInstance().getConfig();

      expect(config).toBeDefined();
      expect(config.thresholds?.warning).toBe(0.3);
      expect(config.thresholds?.high).toBe(0.6);
      expect(config.thresholds?.critical).toBe(0.8);
    });
  });

  describe("Configuration Loading", () => {
    it("should load default configuration when no environment variables are set", () => {
      const config = BiasDetectionConfigManager.getInstance().getConfig();

      expect(config.thresholds).toEqual({
        warning: 0.3,
        high: 0.6,
        critical: 0.8,
      });

      expect(config.layerWeights).toEqual({
        preprocessing: 0.25,
        modelLevel: 0.3,
        interactive: 0.2,
        evaluation: 0.25,
      });

      expect(config.pythonServiceUrl).toBeDefined();
    });

    it("should override defaults with environment variables", () => {
      process.env["BIAS_WARNING_THRESHOLD"] = "0.4";
      process.env["BIAS_HIGH_THRESHOLD"] = "0.7";
      process.env["PYTHON_SERVICE_HOST"] = "remote-host";
      process.env["PYTHON_SERVICE_PORT"] = "8080";
      process.env["CACHE_ENABLED"] = "false";

      const config = BiasDetectionConfigManager.getInstance().getConfig();

      expect(config.thresholds?.warning).toBe(0.4);
      expect(config.thresholds?.high).toBe(0.7);
      expect(config.pythonServiceUrl).toBeDefined();
    });

    it("should handle invalid environment variable values gracefully", () => {
      process.env["BIAS_WARNING_THRESHOLD"] = "invalid";
      process.env["PYTHON_SERVICE_PORT"] = "not-a-number";
      process.env["CACHE_ENABLED"] = "maybe";

      const config = BiasDetectionConfigManager.getInstance().getConfig();

      // Should fall back to defaults for invalid values
      expect(config.thresholds?.warning).toBe(0.3);
      expect(config.pythonServiceUrl).toBeDefined(); // Should use default URL
      expect(config.cacheConfig?.enabled).toBe(true); // Should default to true
    });
  });

  describe("Configuration Sections", () => {
    beforeEach(() => {
      configManager = BiasDetectionConfigManager.getInstance();
    });

    it("should return thresholds configuration", () => {
      const thresholds = configManager.getThresholds();

      expect(thresholds).toEqual({
        warning: 0.3,
        high: 0.6,
        critical: 0.8,
      });
    });

    it("should return layer weights configuration", () => {
      const weights = configManager.getLayerWeights();

      expect(weights).toEqual({
        preprocessing: 0.25,
        modelLevel: 0.3,
        interactive: 0.2,
        evaluation: 0.25,
      });
    });

    it("should return python service configuration", () => {
      const pythonConfig = configManager.getPythonServiceConfig();

      expect(pythonConfig).toEqual({
        host: "localhost",
        port: 5000,
        timeout: 30000,
        retries: 3,
        healthCheckInterval: 60000,
      });
    });

    it("should return cache configuration", () => {
      const cacheConfig = configManager.getCacheConfig();

      expect(cacheConfig).toEqual({
        enabled: true,
        ttl: 300000,
        maxSize: 1000,
        compressionEnabled: true,
      });
    });

    it("should return security configuration", () => {
      const securityConfig = configManager.getSecurityConfig();

      expect(securityConfig).toEqual({
        encryptionEnabled: true,
        auditLoggingEnabled: true,
        sessionTimeoutMs: 3600000,
        maxSessionSizeMB: 50,
        rateLimitPerMinute: 60,
        jwtSecret: undefined,
        encryptionKey: undefined,
      });
    });

    it("should return performance configuration", () => {
      const performanceConfig = configManager.getPerformanceConfig();

      expect(performanceConfig).toEqual({
        maxConcurrentAnalyses: 10,
        analysisTimeoutMs: 120000,
        batchSize: 100,
        enableMetrics: true,
        metricsInterval: 60000,
      });
    });

    it("should return ML toolkit configuration", () => {
      const mlConfig = configManager.getMLToolkitConfig();

      expect(mlConfig.aif360).toEqual({
        enabled: true,
        fallbackOnError: true,
      });

      expect(mlConfig.fairlearn).toEqual({
        enabled: true,
        fallbackOnError: true,
      });

      expect(mlConfig.huggingFace).toEqual({
        enabled: true,
        apiKey: undefined,
        model: "unitary/toxic-bert",
        fallbackOnError: true,
      });
    });

    it("should return logging configuration", () => {
      const loggingConfig = configManager.getLoggingConfig();

      expect(loggingConfig).toEqual({
        level: "info",
        enableConsole: true,
        enableFile: true,
        filePath: "./logs/bias-detection.log",
        maxFileSize: "10MB",
        maxFiles: 5,
        enableStructured: true,
      });
    });
  });

  describe("Configuration Updates", () => {
    beforeEach(() => {
      configManager = BiasDetectionConfigManager.getInstance();
    });

    it("should update configuration successfully with valid data", () => {
      const updates = {
        thresholds: {
          warning: 0.4,
          high: 0.7,
          critical: 0.9,
        },
      };

      expect(() => configManager.updateConfig(updates)).not.toThrow();

      const updatedConfig = configManager.getConfig();
      expect(updatedConfig.thresholds).toEqual(updates.thresholds);
    });

    it("should throw error when updating with invalid data", () => {
      const invalidUpdates = {
        thresholds: {
          warning: 1.5, // Invalid: > 1
          high: 0.7,
          critical: 0.9,
        },
      };

      expect(() =>
        configManager.updateConfig(invalidUpdates as unknown as Partial<Record<string, unknown>>),
      ).toThrow();
    });

    it("should preserve unchanged configuration sections", () => {
      const originalConfig = configManager.getConfig();

      configManager.updateConfig({
        environment: "staging",
      });

      const updatedConfig = configManager.getConfig();
      expect(updatedConfig.environment).toBe("staging");
      expect(updatedConfig.thresholds).toEqual(originalConfig.thresholds);
      expect(updatedConfig.layerWeights).toEqual(originalConfig.layerWeights);
    });
  });

  describe("Configuration Validation", () => {
    beforeEach(() => {
      configManager = BiasDetectionConfigManager.getInstance();
    });

    it("should return no errors for valid configuration", () => {
      const errors = configManager.validateConfiguration();
      expect(errors).toEqual([]);
    });

    it("should detect validation errors in configuration", () => {
      // Force invalid configuration
      const invalidConfig = {
        thresholds: {
          warning: 2.0, // Invalid: > 1
          high: -0.1, // Invalid: < 0
          critical: 0.8,
        },
      };

      expect(() => {
        configManager.updateConfig(invalidConfig);
      }).toThrow("Configuration validation failed");
    });
  });

  describe("Production Readiness Check", () => {
    beforeEach(() => {
      configManager = BiasDetectionConfigManager.getInstance();
    });

    it("should identify missing production requirements", () => {
      const readiness = configManager.isProductionReady();

      expect(readiness.ready).toBe(false);
      expect(readiness.errors).toContain(
        "JWT secret is missing or too short (minimum 32 characters)",
      );
      expect(readiness.errors).toContain(
        "Encryption key is missing or too short (minimum 32 characters)",
      );
    });

    it("should pass production readiness check with proper configuration", () => {
      process.env["JWT_SECRET"] = "a".repeat(32);
      process.env["ENCRYPTION_KEY"] = "b".repeat(32);
      process.env["NODE_ENV"] = "production";

      // Reset instance to pick up new env vars
      (BiasDetectionConfigManager as unknown as { instance?: unknown }).instance = undefined;
      configManager = BiasDetectionConfigManager.getInstance();

      const readiness = configManager.isProductionReady();

      expect(readiness.ready).toBe(true);
      expect(readiness.errors).toEqual([]);
    });

    it("should warn about debug logging in production", () => {
      process.env["JWT_SECRET"] = "a".repeat(32);
      process.env["ENCRYPTION_KEY"] = "b".repeat(32);
      process.env["NODE_ENV"] = "production";
      process.env["LOG_LEVEL"] = "debug";

      // Reset instance to pick up new env vars
      (BiasDetectionConfigManager as unknown as { instance?: unknown }).instance = undefined;
      configManager = BiasDetectionConfigManager.getInstance();

      const readiness = configManager.isProductionReady();

      expect(readiness.ready).toBe(false);
      expect(readiness.warnings).toContain(
        "Debug logging enabled in production - may expose sensitive data",
      );
    });
  });

  describe("Configuration Summary", () => {
    beforeEach(() => {
      configManager = BiasDetectionConfigManager.getInstance();
    });

    it("should provide configuration summary", () => {
      const summary = configManager.getConfigSummary();

      expect(summary).toHaveProperty("environment");
      expect(summary).toHaveProperty("thresholds");
      expect(summary).toHaveProperty("layerWeights");
      expect(summary).toHaveProperty("cache");
      expect(summary).toHaveProperty("security");
      expect(summary).toHaveProperty("performance");
      expect(summary).toHaveProperty("mlToolkits");
      expect(summary).toHaveProperty("features");
    });

    it("should include only summary information for ML toolkits", () => {
      const summary = configManager.getConfigSummary();

      expect(summary["mlToolkits"]).toEqual({
        aif360: { enabled: true },
        fairlearn: { enabled: true },
        tensorflow: { enabled: true },
        huggingFace: { enabled: true },
        spacy: { enabled: true },
        interpretability: { enabled: true },
      });
    });
  });

  describe("Configuration Reload", () => {
    beforeEach(() => {
      configManager = BiasDetectionConfigManager.getInstance();
    });

    it("should reload configuration from environment variables", () => {
      const originalConfig = configManager.getConfig();
      expect(originalConfig.thresholds?.warning).toBe(0.3);

      // Change environment variable
      process.env["BIAS_WARNING_THRESHOLD"] = "0.5";

      // Reload configuration
      const reloadedConfig = configManager.reloadConfiguration();

      expect(reloadedConfig.thresholds?.warning).toBe(0.5);
    });
  });

  describe("Utility Functions", () => {
    it("should provide configuration through utility functions", () => {
      const config = getBiasDetectionConfig();
      const summary = getConfigSummary();
      const validation = validateConfig();
      const readiness = isProductionReady();

      expect(config).toBeDefined();
      expect(summary).toBeDefined();
      expect(validation).toBeInstanceOf(Array);
      expect(readiness).toHaveProperty("ready");
      expect(readiness).toHaveProperty("issues");
    });
  });

  describe("Environment Variable Parsing", () => {
    it("should parse boolean environment variables correctly", () => {
      process.env["CACHE_ENABLED"] = "true";
      process.env["ENCRYPTION_ENABLED"] = "false";
      process.env["AUDIT_LOGGING_ENABLED"] = "1";
      process.env["ENABLE_METRICS"] = "0";

      // Reset instance
      (BiasDetectionConfigManager as unknown as { instance?: unknown }).instance = undefined;
      const config = BiasDetectionConfigManager.getInstance().getConfig();

      expect(config["cache"]["enabled"]).toBe(true);
      expect(config["security"]["encryptionEnabled"]).toBe(false);
      expect(config["security"]["auditLoggingEnabled"]).toBe(true);
      expect(config["performance"]["enableMetrics"]).toBe(false);
    });

    it("should parse numeric environment variables correctly", () => {
      process.env["PYTHON_SERVICE_PORT"] = "8080";
      process.env["CACHE_TTL"] = "600000";
      process.env["MAX_CONCURRENT_ANALYSES"] = "20";

      // Reset instance
      (BiasDetectionConfigManager as unknown as { instance?: unknown }).instance = undefined;
      const config = BiasDetectionConfigManager.getInstance().getConfig();

      expect(config["pythonService"]["port"]).toBe(8080);
      expect(config["cache"]["ttl"]).toBe(600000);
      expect(config["performance"]["maxConcurrentAnalyses"]).toBe(20);
    });

    it("should parse float environment variables correctly", () => {
      process.env["BIAS_WARNING_THRESHOLD"] = "0.35";
      process.env["BIAS_WEIGHT_PREPROCESSING"] = "0.3";

      // Reset instance
      (BiasDetectionConfigManager as unknown as { instance?: unknown }).instance = undefined;
      const config = BiasDetectionConfigManager.getInstance().getConfig();

      expect(config.thresholds?.warning).toBe(0.35);
      expect(config.layerWeights?.preprocessing).toBe(0.3);
    });
  });

  describe("Layer Weights Validation", () => {
    it("should accept valid layer weights that sum to 1.0", () => {
      const validWeights = {
        layerWeights: {
          preprocessing: 0.3,
          modelLevel: 0.3,
          interactive: 0.2,
          evaluation: 0.2,
        },
      };

      configManager = BiasDetectionConfigManager.getInstance();
      expect(() => configManager.updateConfig(validWeights)).not.toThrow();
    });

    it("should accept layer weights that do not sum to 1.0 (normalization can be done elsewhere)", () => {
      const weights = {
        layerWeights: {
          preprocessing: 0.4,
          modelLevel: 0.4,
          interactive: 0.4,
          evaluation: 0.4,
        },
      };

      configManager = BiasDetectionConfigManager.getInstance();
      expect(() => configManager.updateConfig(weights)).not.toThrow();
    });
  });
});

describe("Configuration Integration", () => {
  it("should work with the exported singleton instance", () => {
    const config = biasDetectionConfig.getConfig();
    expect(config).toBeDefined();
    expect(config.environment).toBe("development");
  });

  it("should maintain state across multiple calls", () => {
    const config1 = biasDetectionConfig.getConfig();
    const config2 = biasDetectionConfig.getConfig();

    expect(config1).toEqual(config2);
  });
});

describe("validateConfig Edge Cases", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should reject invalid pythonServiceUrl protocol", () => {
    expect(() => validateConfig({ pythonServiceUrl: "ftp://bad-service.com" })).toThrow(
      /must use http.*https/,
    );
  });

  it("should reject malformed pythonServiceUrl", () => {
    expect(() => validateConfig({ pythonServiceUrl: "not-a-url" })).toThrow(/must be a valid URL/);
  });

  it("should reject pythonServiceTimeout below minimum", () => {
    expect(() => validateConfig({ pythonServiceTimeout: 500 })).toThrow(
      /must be between 1000ms and 300000ms/,
    );
  });

  it("should reject pythonServiceTimeout above maximum", () => {
    expect(() => validateConfig({ pythonServiceTimeout: 500000 })).toThrow(
      /must be between 1000ms and 300000ms/,
    );
  });

  it("should reject invalid evaluation metrics", () => {
    expect(() => validateConfig({ evaluationMetrics: ["invalid_metric"] })).toThrow(
      /Invalid evaluation metrics/,
    );
  });

  it("should reject out-of-order thresholds", () => {
    expect(() =>
      validateConfig({ thresholds: { warning: 0.8, high: 0.5, critical: 0.9 } }),
    ).toThrow(/ascending order/);
  });

  it("should reject non-boolean hipaaCompliant", () => {
    expect(() => validateConfig({ hipaaCompliant: "yes" as unknown as boolean })).toThrow(
      /hipaaCompliant must be a boolean/,
    );
  });

  it("should reject non-boolean auditLogging", () => {
    expect(() => validateConfig({ auditLogging: 1 as unknown as boolean })).toThrow(
      /auditLogging must be a boolean/,
    );
  });

  it("should reject individual layer weight out of range", () => {
    expect(() =>
      validateConfig({
        layerWeights: { preprocessing: 1.5, modelLevel: 0.25, interactive: 0.25, evaluation: 0.25 },
      }),
    ).toThrow(/must be between 0.0 and 1.0/);
  });
});

describe("mergeWithDefaults", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    const envVarsToDelete = [
      "BIAS_WARNING_THRESHOLD",
      "BIAS_HIGH_THRESHOLD",
      "BIAS_CRITICAL_THRESHOLD",
      "BIAS_DETECTION_SERVICE_URL",
      "LOG_LEVEL",
    ];
    envVarsToDelete.forEach((key) => {
      delete process.env[key];
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return defaults when no user config provided", () => {
    const merged = mergeWithDefaults();
    expect(merged.thresholds?.warning).toBe(0.3);
    expect(merged.thresholds?.high).toBe(0.6);
    expect(merged.thresholds?.critical).toBe(0.8);
  });

  it("should merge user config over defaults", () => {
    const merged = mergeWithDefaults({
      environment: "staging",
      thresholds: { warning: 0.4, high: 0.7, critical: 0.9 },
    });
    expect(merged.environment).toBe("staging");
    expect(merged.thresholds?.warning).toBe(0.4);
    expect(merged.thresholds?.critical).toBe(0.9);
  });

  it("should throw when user config fails validation", () => {
    expect(() => mergeWithDefaults({ hipaaCompliant: "bad" as unknown as boolean })).toThrow(
      "Configuration validation failed",
    );
  });
});

describe("loadConfigFromEnv", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should parse evaluation metrics from env var", () => {
    process.env["BIAS_EVALUATION_METRICS"] = "demographic_parity,equalized_odds";
    const envConfig = loadConfigFromEnv();
    expect(envConfig.evaluationMetrics).toEqual(["demographic_parity", "equalized_odds"]);
  });

  it("should parse cache TTL from env var", () => {
    process.env["CACHE_TTL"] = "600000";
    const envConfig = loadConfigFromEnv();
    expect(envConfig.cacheConfig?.ttl).toBe(600000);
  });

  it("should parse boolean HIPAA and masking flags", () => {
    process.env["ENABLE_HIPAA_COMPLIANCE"] = "true";
    process.env["ENABLE_AUDIT_LOGGING"] = "false";
    process.env["ENABLE_DATA_MASKING"] = "true";
    const envConfig = loadConfigFromEnv();
    expect(envConfig.hipaaCompliant).toBe(true);
    expect(envConfig.auditLogging).toBe(false);
    expect(envConfig.dataMaskingEnabled).toBe(true);
  });

  it("should parse alert config from env vars", () => {
    process.env["BIAS_ALERT_SLACK_WEBHOOK"] = "https://hooks.slack.com/test";
    process.env["BIAS_ALERT_EMAIL_RECIPIENTS"] = "a@b.com,c@d.com";
    process.env["BIAS_ALERT_COOLDOWN_MINUTES"] = "5";
    const envConfig = loadConfigFromEnv();
    expect(envConfig.alertConfig?.slackWebhookUrl).toBe("https://hooks.slack.com/test");
    expect(envConfig.alertConfig?.enableSlackNotifications).toBe(true);
    expect(envConfig.alertConfig?.emailRecipients).toEqual(["a@b.com", "c@d.com"]);
    expect(envConfig.alertConfig?.enableEmailNotifications).toBe(true);
    expect(envConfig.alertConfig?.alertCooldownMinutes).toBe(5);
  });

  it("should parse metrics config from env vars", () => {
    process.env["BIAS_METRICS_RETENTION_DAYS"] = "60";
    process.env["BIAS_DASHBOARD_REFRESH_RATE"] = "120";
    process.env["BIAS_ENABLE_REAL_TIME_MONITORING"] = "false";
    const envConfig = loadConfigFromEnv();
    expect(envConfig.metricsConfig?.metricsRetentionDays).toBe(60);
    expect(envConfig.metricsConfig?.dashboardRefreshRate).toBe(120);
    expect(envConfig.metricsConfig?.enableRealTimeMonitoring).toBe(false);
  });

  it("should parse performance config from env vars", () => {
    process.env["MAX_CONCURRENT_ANALYSES"] = "25";
    const envConfig = loadConfigFromEnv();
    expect(envConfig.performanceConfig?.maxConcurrentAnalyses).toBe(25);
  });

  it("should parse LOG_LEVEL debug to enableDebug", () => {
    process.env["LOG_LEVEL"] = "debug";
    const envConfig = loadConfigFromEnv();
    expect(envConfig.loggingConfig?.enableDebug).toBe(true);
  });

  it("should return empty config when no env vars are set", () => {
    const envVarsToDelete = [
      "BIAS_DETECTION_SERVICE_URL",
      "BIAS_SERVICE_TIMEOUT",
      "BIAS_WARNING_THRESHOLD",
      "BIAS_HIGH_THRESHOLD",
      "BIAS_CRITICAL_THRESHOLD",
      "BIAS_WEIGHT_PREPROCESSING",
      "BIAS_WEIGHT_MODEL_LEVEL",
      "BIAS_WEIGHT_INTERACTIVE",
      "BIAS_WEIGHT_EVALUATION",
      "BIAS_EVALUATION_METRICS",
      "ENABLE_HIPAA_COMPLIANCE",
      "ENABLE_AUDIT_LOGGING",
      "ENABLE_DATA_MASKING",
      "BIAS_ALERT_SLACK_WEBHOOK",
      "BIAS_ALERT_EMAIL_RECIPIENTS",
      "BIAS_ALERT_COOLDOWN_MINUTES",
      "BIAS_METRICS_RETENTION_DAYS",
      "BIAS_DASHBOARD_REFRESH_RATE",
      "BIAS_ENABLE_REAL_TIME_MONITORING",
      "LOG_LEVEL",
      "CACHE_TTL",
      "MAX_CONCURRENT_ANALYSES",
      "PYTHON_SERVICE_PORT",
    ];
    envVarsToDelete.forEach((k) => delete process.env[k]);

    const envConfig = loadConfigFromEnv();
    // Should be mostly empty (thresholds and logging only have non-empty keys)
    expect(Object.keys(envConfig).length).toBe(0);
  });
});

describe("Standalone Utility Functions", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getEnvironmentConfigSummary", () => {
    it("should list loaded env vars", () => {
      process.env["BIAS_WARNING_THRESHOLD"] = "0.5";
      process.env["BIAS_DETECTION_SERVICE_URL"] = "http://test:5000";
      const summary = getEnvironmentConfigSummary();
      expect(summary.loaded).toContain("BIAS_WARNING_THRESHOLD");
      expect(summary.loaded).toContain("BIAS_DETECTION_SERVICE_URL");
      expect(summary.available.length).toBeGreaterThan(10);
    });

    it("should return empty loaded array when no env vars set", () => {
      // Delete all env vars that getEnvironmentConfigSummary checks
      const relevantVars = [
        "BIAS_DETECTION_SERVICE_URL",
        "BIAS_SERVICE_TIMEOUT",
        "BIAS_WARNING_THRESHOLD",
        "BIAS_HIGH_THRESHOLD",
        "BIAS_CRITICAL_THRESHOLD",
        "BIAS_WEIGHT_PREPROCESSING",
        "BIAS_WEIGHT_MODEL_LEVEL",
        "BIAS_WEIGHT_INTERACTIVE",
        "BIAS_WEIGHT_EVALUATION",
        "BIAS_EVALUATION_METRICS",
        "ENABLE_HIPAA_COMPLIANCE",
        "ENABLE_AUDIT_LOGGING",
        "ENABLE_DATA_MASKING",
        "BIAS_ALERT_SLACK_WEBHOOK",
        "BIAS_ALERT_EMAIL_RECIPIENTS",
        "BIAS_ALERT_COOLDOWN_MINUTES",
        "BIAS_METRICS_RETENTION_DAYS",
        "BIAS_DASHBOARD_REFRESH_RATE",
        "BIAS_ENABLE_REAL_TIME_MONITORING",
      ];
      relevantVars.forEach((k) => delete process.env[k]);
      const summary = getEnvironmentConfigSummary();
      expect(summary.loaded).toEqual([]);
    });
  });

  describe("getConfigSummary (standalone)", () => {
    it("should return valid summary for default config", () => {
      const summary = getConfigSummary();
      expect(summary.isValid).toBe(true);
      expect(summary.source).toBe("merged");
      expect(summary.errors).toEqual([]);
    });
  });

  describe("isProductionReady (standalone)", () => {
    it("should flag missing HTTPS and localhost in production", () => {
      // Default URL is localhost:5000
      const result = isProductionReady();
      expect(result.ready).toBe(false);
      expect(result.issues.some((i) => i.includes("HTTPS"))).toBe(true);
    });

    it("should flag missing HTTPS and alert method by default", () => {
      process.env["JWT_SECRET"] = "a".repeat(32);
      process.env["ENCRYPTION_KEY"] = "b".repeat(32);
      const result = isProductionReady();
      // Defaults have hipaaCompliant:true & auditLogging:true, so those pass.
      // But default URL is localhost (not HTTPS) and no alerts configured.
      expect(result.issues.some((i) => i.includes("HTTPS"))).toBe(true);
      expect(result.issues.some((i) => i.includes("alert"))).toBe(true);
    });
  });

  describe("createConfigWithEnvOverrides", () => {
    it("should merge user config over env over defaults", () => {
      process.env["BIAS_WARNING_THRESHOLD"] = "0.5";
      const config = createConfigWithEnvOverrides({
        environment: "production",
        thresholds: { warning: 0.6, high: 0.7, critical: 0.9 },
      });
      // User config takes precedence over env
      expect(config.thresholds?.warning).toBe(0.6);
      expect(config.environment).toBe("production");
    });

    it("should fall back to defaults when no env or user config", () => {
      const config = createConfigWithEnvOverrides({});
      expect(config.thresholds?.warning).toBe(0.3);
    });
  });

  describe("updateConfiguration (standalone)", () => {
    it("should merge updates into current config", () => {
      const current = createConfigWithEnvOverrides();
      const updated = updateConfiguration(current, { environment: "staging" });
      expect(updated.environment).toBe("staging");
      expect(updated.thresholds).toEqual(current.thresholds);
    });

    it("should throw on invalid updates", () => {
      const current = createConfigWithEnvOverrides();
      expect(() =>
        updateConfiguration(current, { hipaaCompliant: "bad" as unknown as boolean }),
      ).toThrow();
    });
  });
});
