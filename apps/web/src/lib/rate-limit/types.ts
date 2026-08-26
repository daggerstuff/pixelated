import type { ApiKeyScope } from '../auth/scopes'

/**
 * API tier definitions — each tier has different rate limits and quota.
 * Rate limits are per-minute (sliding window). Quotas are daily/monthly totals.
 */
export interface ApiTier {
  name: TierName
  displayName: string
  requestsPerMinute: number
  dailyQuota: number
  monthlyQuota: number
  burstAllowance: number
  description: string
}

export type TierName = 'free' | 'developer' | 'professional' | 'enterprise'

export const API_TIERS: Record<TierName, ApiTier> = {
  free: {
    name: 'free',
    displayName: 'Free',
    requestsPerMinute: 60,
    dailyQuota: 1000,
    monthlyQuota: 10000,
    burstAllowance: 10,
    description: 'Basic access for evaluation and testing',
  },
  developer: {
    name: 'developer',
    displayName: 'Developer',
    requestsPerMinute: 200,
    dailyQuota: 5000,
    monthlyQuota: 50000,
    burstAllowance: 25,
    description: 'Standard developer access',
  },
  professional: {
    name: 'professional',
    displayName: 'Professional',
    requestsPerMinute: 1000,
    dailyQuota: 25000,
    monthlyQuota: 250000,
    burstAllowance: 50,
    description: 'Production workloads',
  },
  enterprise: {
    name: 'enterprise',
    displayName: 'Enterprise',
    requestsPerMinute: 5000,
    dailyQuota: 100000,
    monthlyQuota: 1000000,
    burstAllowance: 100,
    description: 'High-volume enterprise access',
  },
}

/**
 * Default tier for new API keys without an explicit tier.
 */
export const DEFAULT_TIER: TierName = 'developer'

/**
 * Quota period types for tracking.
 */
export type QuotaPeriod = 'daily' | 'monthly'

/**
 * Result of a rate limit check.
 */
export interface RateLimitCheckResult {
  allowed: boolean
  remaining: number
  limit: number
  resetTimeMs: number
  retryAfterSeconds: number
}

/**
 * Result of a quota check.
 */
export interface QuotaCheckResult {
  allowed: boolean
  remaining: number
  limit: number
  period: QuotaPeriod
  resetTimeMs: number
  retryAfterSeconds: number
}

/**
 * Combined rate limit + quota result.
 */
export interface RateLimitResult {
  allowed: boolean
  rateLimit: RateLimitCheckResult
  dailyQuota: QuotaCheckResult
  monthlyQuota: QuotaCheckResult
  tier: ApiTier
}

/**
 * Quota usage snapshot for a key.
 */
export interface QuotaUsage {
  apiKeyId: string
  tier: ApiTier
  rateLimit: {
    currentWindowCount: number
    limit: number
    remaining: number
    resetTimeMs: number
  }
  dailyQuota: QuotaCheckResult
  monthlyQuota: QuotaCheckResult
  alertThresholdExceeded: boolean
  lastChecked: string
}

/**
 * Alert event for quota exhaustion.
 */
export interface QuotaAlert {
  alertId: string
  apiKeyId: string
  type: 'rate_limit' | 'daily_quota' | 'monthly_quota'
  tier: TierName
  threshold: number
  currentUsage: number
  limit: number
  timestamp: string
  message: string
}

/**
 * Get tier for a given rate_limit value from the database.
 * Maps the old rate_limit (requests per minute) to the closest tier.
 */
export function inferTierFromRateLimit(rateLimit: number): TierName {
  if (rateLimit <= 60) return 'free'
  if (rateLimit <= 200) return 'developer'
  if (rateLimit <= 1000) return 'professional'
  return 'enterprise'
}
