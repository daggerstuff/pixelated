/**
 * HIPAA++ Compliance Configuration
 *
 * Security constants and configuration for HIPAA++ compliant FHE operations
 */

export const HIPAA_SECURITY_CONFIG = {
  // Key Management
  KEY_ROTATION_PERIOD_DAYS: 7,
  MAX_KEY_AGE_MS: 7 * 24 * 60 * 60 * 1000,
  KEY_DERIVATION_ITERATIONS: 100000,
  SECURE_RANDOM_BYTES: 32,

  // Distributed Locking
  LOCK_TIMEOUT_MS: 30 * 1000,
  LOCK_RETRY_ATTEMPTS: 3,
  LOCK_RETRY_DELAY_MS: 1000,

  // Audit & Compliance
  AUDIT_RETENTION_DAYS: 2555, // 7 years for HIPAA
  SECURITY_CHECK_INTERVAL_MS: 60 * 1000, // 1 minute
  METRICS_EMISSION_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  AUDIT_CLEANUP_INTERVAL_MS: 24 * 60 * 60 * 1000, // Daily

  // Monitoring Thresholds
  MAX_RECENT_FAILURES: 5,
  FAILURE_WINDOW_MS: 5 * 60 * 1000, // 5 minutes

  // AWS Configuration
  AWS_RETRY_ATTEMPTS: 3,
  AWS_RETRY_MAX_DELAY_MS: 30000,

  // Risk Levels
  RISK_LEVELS: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  } as const,

  // Key Status
  KEY_STATUS: {
    ACTIVE: 'active',
    DEPRECATED: 'deprecated',
    COMPROMISED: 'compromised',
    DESTROYED: 'destroyed',
  } as const,

  // Migration Settings
  KEY_MIGRATION_GRACE_PERIOD_MS: 24 * 60 * 60 * 1000, // 24 hours

  // CloudWatch Metrics
  CLOUDWATCH_NAMESPACE: 'HIPAA/FHE/KeyRotation',

  // Environment Variables Required
  REQUIRED_ENV_VARS: [
    'HIPAA_MASTER_SECRET',
    'KEY_ROTATION_LAMBDA_ARN',
    'AWS_REGION',
  ] as const,
} as const

/**
 * Validate HIPAA++ environment configuration
 */
export function validateHIPAAEnvironment(): {
  valid: boolean
  missing: string[]
} {
  const missing: string[] = []

  for (const envVar of HIPAA_SECURITY_CONFIG.REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar)
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  }
}

/**
 * Get HIPAA++ compliant storage prefix
 */
export function getHIPAAStoragePrefix(): string {
  const environment = process.env['NODE_ENV'] || 'development'
  const region = process.env['AWS_REGION'] || 'us-east-1'
  return `hipaa-fhe-${environment}-${region}-`
}

/**
 * Security event severity mapping
 */
export const SECURITY_EVENT_SEVERITY = {
  service_initialized: 'low',
  key_rotation_started: 'medium',
  key_rotation_completed: 'low',
  key_rotation_failed: 'critical',
  key_deprecated: 'medium',
  key_destroyed: 'medium',
  key_compromise_reported: 'critical',
  emergency_rotation_triggered: 'critical',
  suspicious_activity_detected: 'critical',
  key_age_violation: 'high',
  lock_acquisition_failed: 'high',
  aws_clients_init_failed: 'critical',
  missing_lambda_arn: 'critical',
  key_storage_failed: 'critical',
  service_disposal_started: 'medium',
  service_disposed: 'low',
} as const

export type SecurityEventType = keyof typeof SECURITY_EVENT_SEVERITY
export type RiskLevel =
  (typeof HIPAA_SECURITY_CONFIG.RISK_LEVELS)[keyof typeof HIPAA_SECURITY_CONFIG.RISK_LEVELS]
export type KeyStatus =
  (typeof HIPAA_SECURITY_CONFIG.KEY_STATUS)[keyof typeof HIPAA_SECURITY_CONFIG.KEY_STATUS]
