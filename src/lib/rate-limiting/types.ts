/**
 * Type definitions for the distributed rate limiting system
 */

export interface RateLimitConfig {
  /** Global configuration for rate limiting */
  global: {
    /** Enable rate limiting globally */
    enabled: boolean
    /** Default window size in milliseconds */
    defaultWindowMs: number
    /** Enable attack pattern detection */
    enableAttackDetection: boolean
    /** Enable analytics collection */
    enableAnalytics: boolean
  }
  /** Redis configuration */
  redis?: {
    /** Key prefix for rate limiting data */
    keyPrefix?: string
    /** Analytics data retention in days */
    analyticsRetentionDays?: number
    /** Security event retention in days */
    securityEventRetentionDays?: number
  }
}

export interface RateLimitRule {
  /** Unique name for the rule */
  name: string
  /** Maximum number of requests allowed */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
  /** Rule priority (higher number = higher priority) */
  priority?: number
  /** Enable attack pattern detection for this rule */
  enableAttackDetection?: boolean
  /** Rule description */
  description?: string
  /** Rule tags for categorization */
  tags?: string[]
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Maximum requests allowed */
  limit: number
  /** Remaining requests in current window */
  remaining: number
  /** Time when the current window resets */
  resetTime: Date
  /** Seconds to wait before retrying (null if allowed) */
  retryAfter: number | null
}

export interface AttackPattern {
  /** Whether the pattern is suspicious */
  isSuspicious: boolean
  /** Type of attack pattern detected */
  type: 'regular_intervals' | 'rapid_fire' | 'normal'
  /** Confidence level (0-1) */
  confidence: number
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

export interface RateLimitContext {
  /** User identifier (IP, user ID, session ID, etc.) */
  identifier: string
  /** Request method */
  method?: string
  /** Request path */
  path?: string
  /** User agent */
  userAgent?: string
  /** User role (if authenticated) */
  userRole?: string
  /** Additional context */
  metadata?: Record<string, unknown>
}

export interface RateLimitRuleSet {
  /** Rule set name */
  name: string
  /** Rules in priority order (highest first) */
  rules: RateLimitRule[]
  /** Default rule to apply if no specific rules match */
  defaultRule?: RateLimitRule
  /** Rule set description */
  description?: string
}

export interface RateLimitAnalytics {
  /** Date of analytics data */
  date: string
  /** Total requests */
  totalRequests: number
  /** Blocked requests */
  blockedRequests: number
  /** Unique identifiers */
  uniqueIdentifiers: number
  /** Top blocked identifiers */
  topBlocked: Array<{
    identifier: string
    count: number
    rule: string
  }>
  /** Attack patterns detected */
  attackPatterns: Array<{
    type: string
    count: number
    confidence: number
  }>
}

export interface SecurityEvent {
  /** Event type */
  type: string
  /** Event timestamp */
  timestamp: number
  /** Event details */
  details: Record<string, unknown>
}

export interface RateLimitBypassRule {
  /** Bypass rule name */
  name: string
  /** Conditions that must be met for bypass */
  conditions: {
    /** User roles that can bypass */
    roles?: string[]
    /** IP addresses that can bypass */
    ips?: string[]
    /** Paths that can bypass */
    paths?: string[]
    /** Custom condition function */
    custom?: (context: RateLimitContext) => boolean | Promise<boolean>
  }
  /** Bypass description */
  description?: string
}

export interface DDoSProtectionConfig {
  /** Enable DDoS protection */
  enabled: boolean
  /** Threshold for considering traffic as DDoS (requests per second) */
  threshold: number
  /** Time window for DDoS detection in milliseconds */
  windowMs: number
  /** Block duration in milliseconds */
  blockDurationMs: number
  /** Enable automatic IP blocking */
  enableAutoBlock: boolean
  /** Enable alerting */
  enableAlerting: boolean
}

export interface RateLimitMiddlewareConfig {
  /** Rule sets to apply */
  ruleSets: RateLimitRuleSet[]
  /** Bypass rules */
  bypassRules?: RateLimitBypassRule[]
  /** DDoS protection configuration */
  ddosProtection?: DDoSProtectionConfig
  /** Global rate limit configuration */
  globalConfig?: Partial<RateLimitConfig['global']>
  /** Redis configuration */
  redisConfig?: RateLimitConfig['redis']
}

export interface RateLimitHeaders {
  /** Remaining requests */
  'X-RateLimit-Remaining': string
  /** Total limit */
  'X-RateLimit-Limit': string
  /** Reset time */
  'X-RateLimit-Reset': string
  /** Retry after seconds (if blocked) */
  'X-RateLimit-RetryAfter'?: string
  /** Rate limit rule name */
  'X-RateLimit-Rule'?: string
}

// Better-Auth integration types
export interface BetterAuthRateLimitConfig {
  /** Enable rate limiting for Better-Auth endpoints */
  enabled: boolean
  /** Specific rules for auth endpoints */
  authRules?: {
    login?: RateLimitRule
    register?: RateLimitRule
    passwordReset?: RateLimitRule
    emailVerification?: RateLimitRule
  }
  /** Bypass for authenticated users */
  bypassAuthenticated?: boolean
  /** Bypass for specific user roles */
  bypassRoles?: string[]
}

// WebSocket rate limiting types
export interface WebSocketRateLimitConfig {
  /** Enable WebSocket rate limiting */
  enabled: boolean
  /** Maximum messages per connection */
  maxMessagesPerConnection: number
  /** Maximum connections per IP */
  maxConnectionsPerIp: number
  /** Connection timeout in milliseconds */
  connectionTimeoutMs: number
}

// Real-time monitoring types
export interface RateLimitAlert {
  /** Alert type */
  type:
    | 'attack_detected'
    | 'ddos_detected'
    | 'rate_limit_exceeded'
    | 'system_error'
  /** Alert severity */
  severity: 'low' | 'medium' | 'high' | 'critical'
  /** Alert message */
  message: string
  /** Alert timestamp */
  timestamp: number
  /** Alert details */
  details: Record<string, unknown>
}

export interface RateLimitMonitor {
  /** Monitor name */
  name: string
  /** Check interval in milliseconds */
  checkIntervalMs: number
  /** Alert thresholds */
  thresholds: {
    /** Requests per second threshold */
    rps?: number
    /** Blocked requests percentage threshold */
    blockedPercentage?: number
    /** Error rate threshold */
    errorRate?: number
  }
  /** Alert handlers */
  handlers: Array<(alert: RateLimitAlert) => void | Promise<void>>
}
