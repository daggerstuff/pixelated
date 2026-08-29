/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from 'vitest'

import {
  MARKETPLACE_PROVIDERS,
  INTEGRATION_PROVIDERS,
  PROVIDER_MAP,
  FeatureFlagService,
  ConnectionStatusService,
  buildMarketplaceDashboard,
  getProviderMetadata,
  getAllProviders,
  getProvidersByCategory,
  validateMarketplaceProvider,
  validateTenantProviderStatus,
  validateFeatureFlag,
  validateIntegrationStatus,
} from '../marketplace'
import type { IntegrationProvider } from '../types'

// ---------------------------------------------------------------------------
// MARKETPLACE_PROVIDERS / INTEGRATION_PROVIDERS
// ---------------------------------------------------------------------------

describe('MARKETPLACE_PROVIDERS', () => {
  it('exports exactly 4 providers', () => {
    expect(MARKETPLACE_PROVIDERS).toHaveLength(4)
  })

  it('contains calendly, zoom, stripe, twilio', () => {
    const keys = MARKETPLACE_PROVIDERS.map((p) => p.provider)
    expect(keys).toEqual(['calendly', 'zoom', 'stripe', 'twilio'])
  })

  it('INTEGRATION_PROVIDERS is the same reference', () => {
    expect(INTEGRATION_PROVIDERS).toBe(MARKETPLACE_PROVIDERS)
  })

  it('each provider has required fields', () => {
    for (const p of MARKETPLACE_PROVIDERS) {
      expect(p.provider).toBeDefined()
      expect(p.displayName).toBeTruthy()
      expect(p.description).toBeTruthy()
      expect(p.category).toBeDefined()
      expect(p.defaultScopes.length).toBeGreaterThan(0)
    }
  })

  it('calendly has scheduling category', () => {
    const calendly = MARKETPLACE_PROVIDERS.find(
      (p) => p.provider === 'calendly',
    )
    expect(calendly?.category).toBe('scheduling')
  })

  it('zoom has video category', () => {
    const zoom = MARKETPLACE_PROVIDERS.find((p) => p.provider === 'zoom')
    expect(zoom?.category).toBe('video')
  })

  it('stripe has payments category', () => {
    const stripe = MARKETPLACE_PROVIDERS.find((p) => p.provider === 'stripe')
    expect(stripe?.category).toBe('payments')
  })

  it('twilio has communications category', () => {
    const twilio = MARKETPLACE_PROVIDERS.find((p) => p.provider === 'twilio')
    expect(twilio?.category).toBe('communications')
  })

  it('each provider has webhookEvents', () => {
    for (const p of MARKETPLACE_PROVIDERS) {
      expect(p.webhookEvents).toBeDefined()
      expect(p.webhookEvents!.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// PROVIDER_MAP
// ---------------------------------------------------------------------------

describe('PROVIDER_MAP', () => {
  it('is a ReadonlyMap with 4 entries', () => {
    expect(PROVIDER_MAP).toBeInstanceOf(Map)
    expect(PROVIDER_MAP.size).toBe(4)
  })

  it('returns correct metadata for each provider', () => {
    for (const p of MARKETPLACE_PROVIDERS) {
      const meta = PROVIDER_MAP.get(p.provider)
      expect(meta).toBeDefined()
      expect(meta?.provider).toBe(p.provider)
    }
  })

  it('returns undefined for unknown provider key (type-safe lookup)', () => {
    expect(PROVIDER_MAP.get('foo' as IntegrationProvider)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// getProviderMetadata
// ---------------------------------------------------------------------------

describe('getProviderMetadata', () => {
  it('returns metadata for calendly', () => {
    const meta = getProviderMetadata('calendly')
    expect(meta?.displayName).toBe('Calendly')
  })

  it('returns metadata for zoom', () => {
    const meta = getProviderMetadata('zoom')
    expect(meta?.displayName).toBe('Zoom')
  })

  it('returns metadata for stripe', () => {
    const meta = getProviderMetadata('stripe')
    expect(meta?.displayName).toBe('Stripe')
  })

  it('returns metadata for twilio', () => {
    const meta = getProviderMetadata('twilio')
    expect(meta?.displayName).toBe('Twilio')
  })
})

// ---------------------------------------------------------------------------
// getAllProviders
// ---------------------------------------------------------------------------

describe('getAllProviders', () => {
  it('returns all 4 providers', () => {
    const all = getAllProviders()
    expect(all).toHaveLength(4)
    expect(all).toBe(MARKETPLACE_PROVIDERS)
  })
})

// ---------------------------------------------------------------------------
// getProvidersByCategory
// ---------------------------------------------------------------------------

describe('getProvidersByCategory', () => {
  it('returns only scheduling providers', () => {
    const result = getProvidersByCategory('scheduling')
    expect(result).toHaveLength(1)
    expect(result[0].provider).toBe('calendly')
  })

  it('returns only video providers', () => {
    const result = getProvidersByCategory('video')
    expect(result).toHaveLength(1)
    expect(result[0].provider).toBe('zoom')
  })

  it('returns only payments providers', () => {
    const result = getProvidersByCategory('payments')
    expect(result).toHaveLength(1)
    expect(result[0].provider).toBe('stripe')
  })

  it('returns only communications providers', () => {
    const result = getProvidersByCategory('communications')
    expect(result).toHaveLength(1)
    expect(result[0].provider).toBe('twilio')
  })
})

// ---------------------------------------------------------------------------
// FeatureFlagService
// ---------------------------------------------------------------------------

describe('FeatureFlagService', () => {
  const tenantId = 'tenant-ff-1'
  const provider: IntegrationProvider = 'calendly'

  beforeEach(() => {
    FeatureFlagService.remove(tenantId, provider)
    FeatureFlagService.remove(tenantId, 'zoom')
    FeatureFlagService.remove(tenantId, 'stripe')
    FeatureFlagService.remove(tenantId, 'twilio')
  })

  describe('isEnabled', () => {
    it('returns true by default when no flag is set (opt-out model)', () => {
      expect(FeatureFlagService.isEnabled(tenantId, provider)).toBe(true)
    })

    it('returns false after explicitly disabling', () => {
      FeatureFlagService.set(tenantId, provider, false, 'user-1')
      expect(FeatureFlagService.isEnabled(tenantId, provider)).toBe(false)
    })

    it('returns true after explicitly enabling', () => {
      FeatureFlagService.set(tenantId, provider, true, 'user-1')
      expect(FeatureFlagService.isEnabled(tenantId, provider)).toBe(true)
    })

    it('returns true again after removing a disabled flag', () => {
      FeatureFlagService.set(tenantId, provider, false, 'user-1')
      FeatureFlagService.remove(tenantId, provider)
      expect(FeatureFlagService.isEnabled(tenantId, provider)).toBe(true)
    })
  })

  describe('get', () => {
    it('returns undefined when no flag is set', () => {
      expect(FeatureFlagService.get(tenantId, provider)).toBeUndefined()
    })

    it('returns the flag object after setting', () => {
      FeatureFlagService.set(tenantId, provider, true, 'user-1')
      const flag = FeatureFlagService.get(tenantId, provider)
      expect(flag).toBeDefined()
      expect(flag?.tenantId).toBe(tenantId)
      expect(flag?.provider).toBe(provider)
      expect(flag?.enabled).toBe(true)
      expect(flag?.updatedBy).toBe('user-1')
    })
  })

  describe('set', () => {
    it('creates a flag with correct fields', () => {
      const flag = FeatureFlagService.set(tenantId, provider, true, 'user-1')
      expect(flag.tenantId).toBe(tenantId)
      expect(flag.provider).toBe(provider)
      expect(flag.enabled).toBe(true)
      expect(flag.updatedBy).toBe('user-1')
      expect(flag.updatedAt).toBeDefined()
      expect(flag.capabilities).toBeUndefined()
    })

    it('stores capabilities when provided', () => {
      const flag = FeatureFlagService.set(tenantId, provider, true, 'user-1', [
        'booking',
        'cancellation',
      ])
      expect(flag.capabilities).toEqual(['booking', 'cancellation'])
    })

    it('overwrites an existing flag', () => {
      FeatureFlagService.set(tenantId, provider, true, 'user-1')
      FeatureFlagService.set(tenantId, provider, false, 'user-2')
      const flag = FeatureFlagService.get(tenantId, provider)
      expect(flag?.enabled).toBe(false)
      expect(flag?.updatedBy).toBe('user-2')
    })

    it('updatedAt is a valid ISO datetime', () => {
      const flag = FeatureFlagService.set(tenantId, provider, true, 'user-1')
      expect(new Date(flag.updatedAt).toISOString()).toBe(flag.updatedAt)
    })
  })

  describe('remove', () => {
    it('removes an existing flag', () => {
      FeatureFlagService.set(tenantId, provider, true, 'user-1')
      FeatureFlagService.remove(tenantId, provider)
      expect(FeatureFlagService.get(tenantId, provider)).toBeUndefined()
    })

    it('does not throw when removing a non-existent flag', () => {
      expect(() => FeatureFlagService.remove(tenantId, 'zoom')).not.toThrow()
    })
  })

  describe('listForTenant', () => {
    it('returns empty array when no flags exist', () => {
      expect(FeatureFlagService.listForTenant(tenantId)).toEqual([])
    })

    it('returns all flags for a tenant', () => {
      FeatureFlagService.set(tenantId, 'calendly', true, 'u1')
      FeatureFlagService.set(tenantId, 'zoom', false, 'u1')
      FeatureFlagService.set(tenantId, 'stripe', true, 'u1')

      const flags = FeatureFlagService.listForTenant(tenantId)
      expect(flags).toHaveLength(3)
      const providers = flags.map((f) => f.provider).sort()
      expect(providers).toEqual(['calendly', 'stripe', 'zoom'])
    })

    it('does not return flags from other tenants', () => {
      FeatureFlagService.set(tenantId, 'calendly', true, 'u1')
      FeatureFlagService.set('tenant-other', 'calendly', true, 'u1')

      const flags = FeatureFlagService.listForTenant(tenantId)
      expect(flags).toHaveLength(1)
      expect(flags[0].tenantId).toBe(tenantId)
    })
  })
})

// ---------------------------------------------------------------------------
// ConnectionStatusService
// ---------------------------------------------------------------------------

describe('ConnectionStatusService', () => {
  const tenantId = 'tenant-conn-1'
  const provider: IntegrationProvider = 'zoom'

  beforeEach(() => {
    ConnectionStatusService.remove(tenantId, 'calendly')
    ConnectionStatusService.remove(tenantId, 'zoom')
    ConnectionStatusService.remove(tenantId, 'stripe')
    ConnectionStatusService.remove(tenantId, 'twilio')
    ConnectionStatusService.remove('tenant-other', 'zoom')
    FeatureFlagService.remove(tenantId, provider)
  })

  describe('get', () => {
    it('returns undefined when no connection exists', () => {
      expect(ConnectionStatusService.get(tenantId, provider)).toBeUndefined()
    })

    it('returns the connection after setting', () => {
      ConnectionStatusService.set(
        tenantId,
        provider,
        'connected',
        '2025-01-15T10:00:00Z',
      )
      const conn = ConnectionStatusService.get(tenantId, provider)
      expect(conn).toBeDefined()
      expect(conn?.status).toBe('connected')
    })
  })

  describe('set', () => {
    it('creates a new connection status', () => {
      const conn = ConnectionStatusService.set(
        tenantId,
        provider,
        'connected',
        '2025-01-15T10:00:00Z',
      )
      expect(conn.tenantId).toBe(tenantId)
      expect(conn.provider).toBe(provider)
      expect(conn.status).toBe('connected')
      expect(conn.connectedAt).toBe('2025-01-15T10:00:00Z')
    })

    it('preserves connectedAt from existing when not provided', () => {
      ConnectionStatusService.set(
        tenantId,
        provider,
        'connected',
        '2025-01-15T10:00:00Z',
      )
      const updated = ConnectionStatusService.set(tenantId, provider, 'error')
      expect(updated.connectedAt).toBe('2025-01-15T10:00:00Z')
      expect(updated.status).toBe('error')
    })

    it('preserves lastWebhookReceivedAt from existing', () => {
      ConnectionStatusService.set(
        tenantId,
        provider,
        'connected',
        '2025-01-15T10:00:00Z',
      )
      ConnectionStatusService.recordWebhook(
        tenantId,
        provider,
        '2025-06-15T10:00:00Z',
      )
      const updated = ConnectionStatusService.set(tenantId, provider, 'error')
      expect(updated.lastWebhookReceivedAt).toBe('2025-06-15T10:00:00Z')
    })

    it('attaches featureFlag from FeatureFlagService', () => {
      FeatureFlagService.set(tenantId, provider, true, 'user-1')
      const conn = ConnectionStatusService.set(tenantId, provider, 'connected')
      expect(conn.featureFlag).toBeDefined()
      expect(conn.featureFlag?.enabled).toBe(true)
    })

    it('featureFlag is undefined when no flag is set', () => {
      const conn = ConnectionStatusService.set(tenantId, provider, 'pending')
      expect(conn.featureFlag).toBeUndefined()
    })

    it('stores lastError when provided', () => {
      const conn = ConnectionStatusService.set(
        tenantId,
        provider,
        'error',
        undefined,
        'connection refused',
      )
      expect(conn.lastError).toBe('connection refused')
    })
  })

  describe('recordWebhook', () => {
    it('updates lastWebhookReceivedAt on existing connection', () => {
      ConnectionStatusService.set(tenantId, provider, 'connected')
      ConnectionStatusService.recordWebhook(
        tenantId,
        provider,
        '2025-07-01T12:00:00Z',
      )
      const conn = ConnectionStatusService.get(tenantId, provider)
      expect(conn?.lastWebhookReceivedAt).toBe('2025-07-01T12:00:00Z')
    })

    it('does nothing when no connection exists', () => {
      expect(() =>
        ConnectionStatusService.recordWebhook(
          tenantId,
          'stripe',
          '2025-07-01T12:00:00Z',
        ),
      ).not.toThrow()
      expect(ConnectionStatusService.get(tenantId, 'stripe')).toBeUndefined()
    })
  })

  describe('remove', () => {
    it('removes an existing connection', () => {
      ConnectionStatusService.set(tenantId, provider, 'connected')
      ConnectionStatusService.remove(tenantId, provider)
      expect(ConnectionStatusService.get(tenantId, provider)).toBeUndefined()
    })

    it('does not throw when removing non-existent connection', () => {
      expect(() =>
        ConnectionStatusService.remove(tenantId, 'twilio'),
      ).not.toThrow()
    })
  })

  describe('listForTenant', () => {
    it('returns empty array when no connections exist', () => {
      expect(ConnectionStatusService.listForTenant(tenantId)).toEqual([])
    })

    it('returns all connections for a tenant', () => {
      ConnectionStatusService.set(tenantId, 'calendly', 'connected')
      ConnectionStatusService.set(tenantId, 'zoom', 'disconnected')
      ConnectionStatusService.set(tenantId, 'stripe', 'error')

      const list = ConnectionStatusService.listForTenant(tenantId)
      expect(list).toHaveLength(3)
    })

    it('does not return connections from other tenants', () => {
      ConnectionStatusService.set(tenantId, 'calendly', 'connected')
      ConnectionStatusService.set('tenant-other', 'calendly', 'connected')

      const list = ConnectionStatusService.listForTenant(tenantId)
      expect(list).toHaveLength(1)
      expect(list[0].tenantId).toBe(tenantId)
    })
  })
})

// ---------------------------------------------------------------------------
// buildMarketplaceDashboard
// ---------------------------------------------------------------------------

describe('buildMarketplaceDashboard', () => {
  const tenantId = 'tenant-dash-1'

  beforeEach(() => {
    for (const p of ['calendly', 'zoom', 'stripe', 'twilio'] as const) {
      ConnectionStatusService.remove(tenantId, p)
      FeatureFlagService.remove(tenantId, p)
    }
  })

  it('returns a dashboard with the correct tenantId', () => {
    const dash = buildMarketplaceDashboard(tenantId)
    expect(dash.tenantId).toBe(tenantId)
  })

  it('returns providers array with 4 entries', () => {
    const dash = buildMarketplaceDashboard(tenantId)
    expect(dash.providers).toHaveLength(4)
  })

  it('totalAvailable equals MARKETPLACE_PROVIDERS length', () => {
    const dash = buildMarketplaceDashboard(tenantId)
    expect(dash.totalAvailable).toBe(MARKETPLACE_PROVIDERS.length)
  })

  it('totalConnected is 0 when nothing is connected', () => {
    const dash = buildMarketplaceDashboard(tenantId)
    expect(dash.totalConnected).toBe(0)
  })

  it('all providers default to disconnected status', () => {
    const dash = buildMarketplaceDashboard(tenantId)
    for (const p of dash.providers) {
      expect(p.status).toBe('disconnected')
    }
  })

  it('reflects connected status when a connection is set', () => {
    ConnectionStatusService.set(
      tenantId,
      'calendly',
      'connected',
      '2025-01-15T10:00:00Z',
    )
    const dash = buildMarketplaceDashboard(tenantId)
    expect(dash.totalConnected).toBe(1)
    const calendly = dash.providers.find((p) => p.provider === 'calendly')
    expect(calendly?.status).toBe('connected')
    expect(calendly?.connectedAt).toBe('2025-01-15T10:00:00Z')
  })

  it('reflects multiple connected providers in totalConnected', () => {
    ConnectionStatusService.set(tenantId, 'calendly', 'connected')
    ConnectionStatusService.set(tenantId, 'zoom', 'connected')
    ConnectionStatusService.set(tenantId, 'stripe', 'connected')
    const dash = buildMarketplaceDashboard(tenantId)
    expect(dash.totalConnected).toBe(3)
  })

  it('includes featureFlag in provider status when set', () => {
    FeatureFlagService.set(tenantId, 'calendly', false, 'user-1')
    const dash = buildMarketplaceDashboard(tenantId)
    const calendly = dash.providers.find((p) => p.provider === 'calendly')
    expect(calendly?.featureFlag).toBeDefined()
    expect(calendly?.featureFlag?.enabled).toBe(false)
  })

  it('includes lastWebhookReceivedAt when recorded', () => {
    ConnectionStatusService.set(tenantId, 'zoom', 'connected')
    ConnectionStatusService.recordWebhook(
      tenantId,
      'zoom',
      '2025-07-01T12:00:00Z',
    )
    const dash = buildMarketplaceDashboard(tenantId)
    const zoom = dash.providers.find((p) => p.provider === 'zoom')
    expect(zoom?.lastWebhookReceivedAt).toBe('2025-07-01T12:00:00Z')
  })

  it('includes lastError when set', () => {
    ConnectionStatusService.set(
      tenantId,
      'stripe',
      'error',
      undefined,
      'timeout',
    )
    const dash = buildMarketplaceDashboard(tenantId)
    const stripe = dash.providers.find((p) => p.provider === 'stripe')
    expect(stripe?.status).toBe('error')
    expect(stripe?.lastError).toBe('timeout')
  })

  it('spreads marketplace provider metadata into each status entry', () => {
    const dash = buildMarketplaceDashboard(tenantId)
    const calendly = dash.providers.find((p) => p.provider === 'calendly')
    expect(calendly?.displayName).toBe('Calendly')
    expect(calendly?.category).toBe('scheduling')
    expect(calendly?.defaultScopes).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

describe('validateMarketplaceProvider', () => {
  it('validates a correct provider object', () => {
    const input = {
      provider: 'calendly',
      displayName: 'Calendly',
      description: 'Scheduling',
      category: 'scheduling',
      defaultScopes: ['read'],
    }
    const result = validateMarketplaceProvider(input)
    expect(result.provider).toBe('calendly')
  })

  it('throws on invalid input', () => {
    expect(() => validateMarketplaceProvider({ bad: true })).toThrow()
  })
})

describe('validateTenantProviderStatus', () => {
  it('validates a correct status object', () => {
    const result = validateTenantProviderStatus({
      tenantId: 't1',
      provider: 'zoom',
      status: 'connected',
    })
    expect(result.status).toBe('connected')
  })

  it('throws on invalid input', () => {
    expect(() => validateTenantProviderStatus({ bad: true })).toThrow()
  })
})

describe('validateFeatureFlag', () => {
  it('validates a correct feature flag', () => {
    const result = validateFeatureFlag({
      tenantId: 't1',
      provider: 'calendly',
      enabled: true,
      updatedAt: '2025-01-15T10:00:00Z',
      updatedBy: 'u1',
    })
    expect(result.enabled).toBe(true)
  })

  it('throws on invalid input', () => {
    expect(() => validateFeatureFlag({ bad: true })).toThrow()
  })
})

describe('validateIntegrationStatus', () => {
  it('validates a correct status string', () => {
    expect(validateIntegrationStatus('connected')).toBe('connected')
  })

  it('throws on invalid status', () => {
    expect(() => validateIntegrationStatus('active')).toThrow()
  })
})
