import { z } from 'zod'

// Production configuration schema
export const ProductionConfigSchema = z.object({
  // Router configuration
  router: z.object({
    defaultTargetAnalyzer: z.string().default('general_mental_health'),
    defaultConfidence: z.number().min(0).max(1).default(0.1),
    maxRetries: z.number().min(1).max(10).default(3),
    llmTimeoutMs: z.number().min(1000).max(300000).default(45000),
    enableFallbackClassification: z.boolean().default(true),
    enableCircuitBreaker: z.boolean().default(true),
    circuitBreakerFailureThreshold: z.number().min(1).max(20).default(5),
    circuitBreakerResetTimeoutMs: z
      .number()
      .min(1000)
      .max(300000)
      .default(60000),
  }),

  // Model provider configuration
  modelProvider: z.object({
    maxConcurrentRequests: z.number().min(1).max(100).default(10),
    rateLimitRpm: z.number().min(1).max(10000).default(100),
    healthCheckIntervalMs: z.number().min(5000).max(300000).default(30000),
    connectionTimeoutMs: z.number().min(1000).max(60000).default(30000),
    enableMetrics: z.boolean().default(true),
  }),

  // Crisis notification configuration
  crisisNotification: z.object({
    enabled: z.boolean().default(true),
    escalationTimeoutMs: z.number().min(1000).max(300000).default(30000),
    maxRetries: z.number().min(1).max(5).default(3),
    enableAuditTrail: z.boolean().default(true),
  }),

  // Security configuration
  security: z.object({
    enableInputValidation: z.boolean().default(true),
    maxInputLength: z.number().min(100).max(50000).default(10000),
    enableRateLimiting: z.boolean().default(true),
    enableAuditLogging: z.boolean().default(true),
    sanitizeInputs: z.boolean().default(true),
  }),

  // Performance configuration
  performance: z.object({
    enableCaching: z.boolean().default(true),
    cacheTimeoutMs: z.number().min(1000).max(3600000).default(300000), // 5 minutes
    enableConnectionPooling: z.boolean().default(true),
    maxCacheSize: z.number().min(10).max(10000).default(1000),
    enableCompression: z.boolean().default(true),
  }),

  // Monitoring configuration
  monitoring: z.object({
    enableMetrics: z.boolean().default(true),
    enableHealthChecks: z.boolean().default(true),
    enablePerformanceTracking: z.boolean().default(true),
    metricsCollectionIntervalMs: z
      .number()
      .min(1000)
      .max(300000)
      .default(60000),
    enableDetailedLogging: z.boolean().default(false), // Only enable in staging
  }),
})

export type ProductionConfig = z.infer<typeof ProductionConfigSchema>

// Default production configuration
export const DEFAULT_PRODUCTION_CONFIG: ProductionConfig = {
  router: {
    defaultTargetAnalyzer: 'general_mental_health',
    defaultConfidence: 0.1,
    maxRetries: 3,
    llmTimeoutMs: 45000,
    enableFallbackClassification: true,
    enableCircuitBreaker: true,
    circuitBreakerFailureThreshold: 5,
    circuitBreakerResetTimeoutMs: 60000,
  },
  modelProvider: {
    maxConcurrentRequests: 10,
    rateLimitRpm: 100,
    healthCheckIntervalMs: 30000,
    connectionTimeoutMs: 30000,
    enableMetrics: true,
  },
  crisisNotification: {
    enabled: true,
    escalationTimeoutMs: 30000,
    maxRetries: 3,
    enableAuditTrail: true,
  },
  security: {
    enableInputValidation: true,
    maxInputLength: 10000,
    enableRateLimiting: true,
    enableAuditLogging: true,
    sanitizeInputs: true,
  },
  performance: {
    enableCaching: true,
    cacheTimeoutMs: 300000,
    enableConnectionPooling: true,
    maxCacheSize: 1000,
    enableCompression: true,
  },
  monitoring: {
    enableMetrics: true,
    enableHealthChecks: true,
    enablePerformanceTracking: true,
    metricsCollectionIntervalMs: 60000,
    enableDetailedLogging:
      typeof process !== 'undefined' && process.env.NODE_ENV !== 'production',
  },
}
