/**
 * EHR Native — State Consent Rules Cache (F3.3)
 *
 * Redis caching layer for active state consent rules.
 * Uses graceful fallback: if Redis is unavailable, falls back to
 * direct database queries.
 *
 * Cache key pattern: pixelated:state-consent-rules:<stateCode>
 * TTL: 15 minutes (rules change infrequently but need to propagate reasonably fast)
 *
 * @see docs/adr/ADR-007-consent-state-rules.md
 */

import { getFromCache, removeFromCache, setInCache } from '@/lib/redis'

import { stateConsentRulesRepository } from './repository'
import type { StateConsentRuleRecord, StateRuleConfig } from './schemas'

// ---------------------------------------------------------------------------
// Cache configuration
// ---------------------------------------------------------------------------

const CACHE_KEY_PREFIX = 'state-consent-rules'
const CACHE_TTL_SECONDS = 15 * 60 // 15 minutes

/**
 * Build a cache key for a state code + optional tenant.
 * Format: state-consent-rules:CA  (global)
 *         state-consent-rules:CA:tenant-uuid  (tenant-specific)
 */
function buildCacheKey(stateCode: string, tenantId?: string | null): string {
  const normalized = stateCode.toUpperCase()
  return tenantId
    ? `${CACHE_KEY_PREFIX}:${normalized}:${tenantId}`
    : `${CACHE_KEY_PREFIX}:${normalized}`
}

// ---------------------------------------------------------------------------
// Cache layer
// ---------------------------------------------------------------------------

export class StateConsentRulesCache {
  /**
   * Get the active rule for a state code.
   * Checks cache first, falls back to database, caches the result.
   * Returns null if no active rule exists.
   */
  async getActiveRule(
    stateCode: string,
    tenantId?: string | null,
  ): Promise<StateConsentRuleRecord | null> {
    const cacheKey = buildCacheKey(stateCode, tenantId)

    // Try cache first
    const cached = await getFromCache<StateConsentRuleRecord>(cacheKey)
    if (cached) {
      return cached
    }

    // Cache miss — fetch from database
    const rule = await stateConsentRulesRepository.getActiveRule(
      stateCode,
      tenantId,
    )

    if (rule) {
      // Cache the result
      await setInCache(cacheKey, rule, CACHE_TTL_SECONDS)
    }

    return rule
  }

  /**
   * Get just the rule config for a state (lighter weight for runtime).
   * Checks cache first, falls back to database.
   */
  async getRuleConfig(
    stateCode: string,
    tenantId?: string | null,
  ): Promise<StateRuleConfig | null> {
    const rule = await this.getActiveRule(stateCode, tenantId)
    return rule?.ruleConfig ?? null
  }

  /**
   * Invalidate the cache for a state code.
   * Should be called whenever a rule is activated, superseded, or archived.
   */
  async invalidate(stateCode: string, tenantId?: string | null): Promise<void> {
    const cacheKey = buildCacheKey(stateCode, tenantId)
    await removeFromCache(cacheKey)
  }

  /**
   * Invalidate all cached rules for a state code (both global and tenant-specific).
   * Uses a pattern-based invalidation by invalidating known tenant caches.
   * For complete invalidation, use invalidateAll().
   */
  async invalidateState(stateCode: string): Promise<void> {
    // Invalidate the global rule
    await removeFromCache(buildCacheKey(stateCode))
    // Tenant-specific caches are invalidated individually when rules change
    // This is a best-effort approach; full invalidation requires invalidateAll()
  }

  /**
   * Invalidate all cached state consent rules.
   * Use when bulk rule changes occur (e.g., batch activation).
   */
  async invalidateAll(): Promise<void> {
    // The legacy redis facade doesn't support pattern-based deletion,
    // so we invalidate all known state codes (global only).
    // Tenant-specific caches expire naturally via TTL.
    const stateCodes = [
      'AL',
      'AK',
      'AZ',
      'AR',
      'CA',
      'CO',
      'CT',
      'DE',
      'FL',
      'GA',
      'HI',
      'ID',
      'IL',
      'IN',
      'IA',
      'KS',
      'KY',
      'LA',
      'ME',
      'MD',
      'MA',
      'MI',
      'MN',
      'MS',
      'MO',
      'MT',
      'NE',
      'NV',
      'NH',
      'NJ',
      'NM',
      'NY',
      'NC',
      'ND',
      'OH',
      'OK',
      'OR',
      'PA',
      'RI',
      'SC',
      'SD',
      'TN',
      'TX',
      'UT',
      'VT',
      'VA',
      'WA',
      'WV',
      'WI',
      'WY',
      'DC',
      'PR',
      'GU',
      'VI',
      'AS',
      'MP',
    ]

    for (const code of stateCodes) {
      await removeFromCache(buildCacheKey(code))
    }
  }

  /**
   * Warm the cache by pre-loading all active rules.
   * Call this on application startup or after bulk rule changes.
   */
  async warmCache(): Promise<number> {
    const activeRules = await stateConsentRulesRepository.getAllActiveRules()

    for (const rule of activeRules) {
      const cacheKey = buildCacheKey(rule.stateCode, rule.tenantId)
      await setInCache(cacheKey, rule, CACHE_TTL_SECONDS)
    }

    return activeRules.length
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const stateConsentRulesCache = new StateConsentRulesCache()
