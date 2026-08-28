/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'

import {
  integrationProviderSchema,
  PROVIDER_DISPLAY_NAMES,
  oAuthTokenResponseSchema,
  oAuthConfigSchema,
  oAuthStateSchema,
  oAuthConnectionSchema,
  webhookEventSchema,
  webhookResultSchema,
  webhookSignatureConfigSchema,
  integrationStatusSchema,
  integrationFeatureFlagSchema,
  marketplaceProviderSchema,
  tenantProviderStatusSchema,
  marketplaceDashboardSchema,
  integrationAuditMetadataSchema,
} from '../types'

// ---------------------------------------------------------------------------
// integrationProviderSchema
// ---------------------------------------------------------------------------

describe('integrationProviderSchema', () => {
  it('accepts all four valid provider values', () => {
    for (const p of ['calendly', 'zoom', 'stripe', 'twilio'] as const) {
      expect(integrationProviderSchema.parse(p)).toBe(p)
    }
  })

  it('rejects unknown provider', () => {
    expect(() => integrationProviderSchema.parse('slack')).toThrow()
  })

  it('rejects non-string', () => {
    expect(() => integrationProviderSchema.parse(42)).toThrow()
  })

  it('rejects empty string', () => {
    expect(() => integrationProviderSchema.parse('')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// PROVIDER_DISPLAY_NAMES
// ---------------------------------------------------------------------------

describe('PROVIDER_DISPLAY_NAMES', () => {
  it('has an entry for every provider enum value', () => {
    const providers = integrationProviderSchema.options
    for (const p of providers) {
      expect(PROVIDER_DISPLAY_NAMES[p]).toBeDefined()
      expect(typeof PROVIDER_DISPLAY_NAMES[p]).toBe('string')
      expect(PROVIDER_DISPLAY_NAMES[p].length).toBeGreaterThan(0)
    }
  })

  it('returns human-readable names', () => {
    expect(PROVIDER_DISPLAY_NAMES.calendly).toBe('Calendly')
    expect(PROVIDER_DISPLAY_NAMES.zoom).toBe('Zoom')
    expect(PROVIDER_DISPLAY_NAMES.stripe).toBe('Stripe')
    expect(PROVIDER_DISPLAY_NAMES.twilio).toBe('Twilio')
  })
})

// ---------------------------------------------------------------------------
// oAuthTokenResponseSchema
// ---------------------------------------------------------------------------

describe('oAuthTokenResponseSchema', () => {
  const valid = {
    access_token: 'tok_abc',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'ref_xyz',
    scope: 'read write',
    id_token: 'idt_1',
    expires_at: '2025-12-31T00:00:00Z',
  }

  it('parses a fully-populated token response', () => {
    const result = oAuthTokenResponseSchema.parse(valid)
    expect(result.access_token).toBe('tok_abc')
    expect(result.token_type).toBe('Bearer')
    expect(result.expires_in).toBe(3600)
    expect(result.refresh_token).toBe('ref_xyz')
  })

  it('defaults token_type to Bearer when omitted', () => {
    const result = oAuthTokenResponseSchema.parse({ access_token: 'tok' })
    expect(result.token_type).toBe('Bearer')
  })

  it('accepts minimal payload with only access_token', () => {
    const result = oAuthTokenResponseSchema.parse({ access_token: 'tok' })
    expect(result.access_token).toBe('tok')
    expect(result.expires_in).toBeUndefined()
    expect(result.refresh_token).toBeUndefined()
  })

  it('rejects empty access_token', () => {
    expect(() => oAuthTokenResponseSchema.parse({ access_token: '' })).toThrow()
  })

  it('rejects missing access_token', () => {
    expect(() => oAuthTokenResponseSchema.parse({ token_type: 'Bearer' })).toThrow()
  })

  it('rejects non-positive expires_in', () => {
    expect(() =>
      oAuthTokenResponseSchema.parse({ access_token: 'tok', expires_in: 0 }),
    ).toThrow()
    expect(() =>
      oAuthTokenResponseSchema.parse({ access_token: 'tok', expires_in: -1 }),
    ).toThrow()
  })

  it('rejects non-integer expires_in', () => {
    expect(() =>
      oAuthTokenResponseSchema.parse({ access_token: 'tok', expires_in: 1.5 }),
    ).toThrow()
  })

  it('rejects invalid expires_at datetime', () => {
    expect(() =>
      oAuthTokenResponseSchema.parse({ access_token: 'tok', expires_at: 'not-a-date' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// oAuthConfigSchema
// ---------------------------------------------------------------------------

describe('oAuthConfigSchema', () => {
  const valid = {
    provider: 'calendly',
    clientId: 'client-123',
    clientSecret: 'secret-456',
    redirectUri: 'https://app.example.com/callback',
    scopes: ['read', 'write'],
    authorizeUrl: 'https://auth.calendly.com/o/authorize',
    tokenUrl: 'https://auth.calendly.com/o/token',
  }

  it('parses a valid config', () => {
    const result = oAuthConfigSchema.parse(valid)
    expect(result.provider).toBe('calendly')
    expect(result.clientId).toBe('client-123')
    expect(result.scopes).toEqual(['read', 'write'])
  })

  it('accepts optional refreshTokenUrl', () => {
    const result = oAuthConfigSchema.parse({
      ...valid,
      refreshTokenUrl: 'https://auth.calendly.com/o/refresh',
    })
    expect(result.refreshTokenUrl).toBe('https://auth.calendly.com/o/refresh')
  })

  it('rejects invalid provider', () => {
    expect(() => oAuthConfigSchema.parse({ ...valid, provider: 'slack' })).toThrow()
  })

  it('rejects empty clientId', () => {
    expect(() => oAuthConfigSchema.parse({ ...valid, clientId: '' })).toThrow()
  })

  it('rejects empty clientSecret', () => {
    expect(() => oAuthConfigSchema.parse({ ...valid, clientSecret: '' })).toThrow()
  })

  it('rejects non-URL redirectUri', () => {
    expect(() => oAuthConfigSchema.parse({ ...valid, redirectUri: 'not-a-url' })).toThrow()
  })

  it('rejects empty scopes array', () => {
    expect(() => oAuthConfigSchema.parse({ ...valid, scopes: [] })).toThrow()
  })

  it('rejects non-URL authorizeUrl', () => {
    expect(() => oAuthConfigSchema.parse({ ...valid, authorizeUrl: 'bad' })).toThrow()
  })

  it('rejects non-URL tokenUrl', () => {
    expect(() => oAuthConfigSchema.parse({ ...valid, tokenUrl: 'bad' })).toThrow()
  })

  it('rejects non-URL refreshTokenUrl', () => {
    expect(() =>
      oAuthConfigSchema.parse({ ...valid, refreshTokenUrl: 'bad' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// oAuthStateSchema
// ---------------------------------------------------------------------------

describe('oAuthStateSchema', () => {
  const valid = {
    state: 'a-very-long-state-string',
    tenantId: 'tenant-1',
    provider: 'zoom',
    createdAt: '2025-01-15T10:00:00Z',
  }

  it('parses valid state', () => {
    const result = oAuthStateSchema.parse(valid)
    expect(result.state).toBe('a-very-long-state-string')
    expect(result.provider).toBe('zoom')
  })

  it('accepts optional returnUrl', () => {
    const result = oAuthStateSchema.parse({ ...valid, returnUrl: '/dashboard' })
    expect(result.returnUrl).toBe('/dashboard')
  })

  it('rejects state shorter than 16 chars', () => {
    expect(() => oAuthStateSchema.parse({ ...valid, state: 'short' })).toThrow()
  })

  it('rejects empty tenantId', () => {
    expect(() => oAuthStateSchema.parse({ ...valid, tenantId: '' })).toThrow()
  })

  it('rejects invalid provider', () => {
    expect(() => oAuthStateSchema.parse({ ...valid, provider: 'foo' })).toThrow()
  })

  it('rejects invalid createdAt', () => {
    expect(() => oAuthStateSchema.parse({ ...valid, createdAt: 'bad' })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// oAuthConnectionSchema
// ---------------------------------------------------------------------------

describe('oAuthConnectionSchema', () => {
  const valid = {
    tenantId: 'tenant-1',
    provider: 'stripe',
    accessToken: 'acc_tok',
    connectedAt: '2025-01-15T10:00:00Z',
    connectedBy: 'user-1',
  }

  it('parses a valid connection', () => {
    const result = oAuthConnectionSchema.parse(valid)
    expect(result.accessToken).toBe('acc_tok')
    expect(result.tokenType).toBe('Bearer')
  })

  it('defaults tokenType to Bearer', () => {
    const result = oAuthConnectionSchema.parse(valid)
    expect(result.tokenType).toBe('Bearer')
  })

  it('accepts optional fields', () => {
    const result = oAuthConnectionSchema.parse({
      ...valid,
      refreshToken: 'ref',
      expiresAt: '2025-12-31T00:00:00Z',
      scope: 'read',
      lastRefreshedAt: '2025-06-15T10:00:00Z',
    })
    expect(result.refreshToken).toBe('ref')
    expect(result.scope).toBe('read')
  })

  it('rejects empty accessToken', () => {
    expect(() => oAuthConnectionSchema.parse({ ...valid, accessToken: '' })).toThrow()
  })

  it('rejects empty connectedBy', () => {
    expect(() => oAuthConnectionSchema.parse({ ...valid, connectedBy: '' })).toThrow()
  })

  it('rejects invalid connectedAt', () => {
    expect(() => oAuthConnectionSchema.parse({ ...valid, connectedAt: 'bad' })).toThrow()
  })

  it('rejects invalid expiresAt', () => {
    expect(() =>
      oAuthConnectionSchema.parse({ ...valid, expiresAt: 'not-datetime' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// webhookEventSchema
// ---------------------------------------------------------------------------

describe('webhookEventSchema', () => {
  const valid = {
    provider: 'calendly',
    eventId: 'evt_123',
    eventType: 'invitee.created',
    payload: { data: { id: 1 } },
    signature: 'sig_abc',
    receivedAt: '2025-01-15T10:00:00Z',
    rawBody: '{"data":{"id":1}}',
  }

  it('parses a valid webhook event', () => {
    const result = webhookEventSchema.parse(valid)
    expect(result.eventId).toBe('evt_123')
    expect(result.payload).toEqual({ data: { id: 1 } })
  })

  it('accepts null payload', () => {
    const result = webhookEventSchema.parse({ ...valid, payload: null })
    expect(result.payload).toBeNull()
  })

  it('accepts array payload', () => {
    const result = webhookEventSchema.parse({ ...valid, payload: [1, 2, 3] })
    expect(result.payload).toEqual([1, 2, 3])
  })

  it('rejects empty eventId', () => {
    expect(() => webhookEventSchema.parse({ ...valid, eventId: '' })).toThrow()
  })

  it('rejects empty eventType', () => {
    expect(() => webhookEventSchema.parse({ ...valid, eventType: '' })).toThrow()
  })

  it('rejects empty signature', () => {
    expect(() => webhookEventSchema.parse({ ...valid, signature: '' })).toThrow()
  })

  it('rejects invalid provider', () => {
    expect(() => webhookEventSchema.parse({ ...valid, provider: 'foo' })).toThrow()
  })

  it('rejects invalid receivedAt', () => {
    expect(() => webhookEventSchema.parse({ ...valid, receivedAt: 'bad' })).toThrow()
  })
})

// ---------------------------------------------------------------------------
// webhookResultSchema
// ---------------------------------------------------------------------------

describe('webhookResultSchema', () => {
  it('parses a successful result', () => {
    const result = webhookResultSchema.parse({
      processed: true,
      eventId: 'evt_1',
      httpStatus: 200,
    })
    expect(result.processed).toBe(true)
    expect(result.duplicate).toBe(false)
  })

  it('defaults duplicate to false', () => {
    const result = webhookResultSchema.parse({
      processed: false,
      eventId: 'evt_1',
      httpStatus: 401,
    })
    expect(result.duplicate).toBe(false)
  })

  it('accepts error and duplicate fields', () => {
    const result = webhookResultSchema.parse({
      processed: false,
      eventId: 'evt_1',
      duplicate: true,
      error: 'dup',
      httpStatus: 200,
    })
    expect(result.duplicate).toBe(true)
    expect(result.error).toBe('dup')
  })

  it('rejects httpStatus below 100', () => {
    expect(() =>
      webhookResultSchema.parse({ processed: true, eventId: 'e', httpStatus: 99 }),
    ).toThrow()
  })

  it('rejects httpStatus above 599', () => {
    expect(() =>
      webhookResultSchema.parse({ processed: true, eventId: 'e', httpStatus: 600 }),
    ).toThrow()
  })

  it('rejects non-integer httpStatus', () => {
    expect(() =>
      webhookResultSchema.parse({ processed: true, eventId: 'e', httpStatus: 200.5 }),
    ).toThrow()
  })

  it('rejects missing processed', () => {
    expect(() => webhookResultSchema.parse({ eventId: 'e', httpStatus: 200 })).toThrow()
  })

  it('rejects empty eventId', () => {
    expect(() =>
      webhookResultSchema.parse({ processed: true, eventId: '', httpStatus: 200 }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// webhookSignatureConfigSchema
// ---------------------------------------------------------------------------

describe('webhookSignatureConfigSchema', () => {
  const valid = {
    provider: 'stripe',
    headerName: 'Stripe-Signature',
    algorithm: 'sha256' as const,
    secret: 'whsec_abc',
  }

  it('parses valid config with default format hmac', () => {
    const result = webhookSignatureConfigSchema.parse(valid)
    expect(result.format).toBe('hmac')
  })

  it('accepts stripe-composite format', () => {
    const result = webhookSignatureConfigSchema.parse({
      ...valid,
      format: 'stripe-composite',
    })
    expect(result.format).toBe('stripe-composite')
  })

  it('accepts twilio format', () => {
    const result = webhookSignatureConfigSchema.parse({
      ...valid,
      format: 'twilio',
    })
    expect(result.format).toBe('twilio')
  })

  it('accepts sha1 algorithm', () => {
    const result = webhookSignatureConfigSchema.parse({
      ...valid,
      algorithm: 'sha1',
    })
    expect(result.algorithm).toBe('sha1')
  })

  it('rejects invalid algorithm', () => {
    expect(() =>
      webhookSignatureConfigSchema.parse({ ...valid, algorithm: 'md5' }),
    ).toThrow()
  })

  it('rejects invalid format', () => {
    expect(() =>
      webhookSignatureConfigSchema.parse({ ...valid, format: 'rsa' }),
    ).toThrow()
  })

  it('rejects empty secret', () => {
    expect(() => webhookSignatureConfigSchema.parse({ ...valid, secret: '' })).toThrow()
  })

  it('rejects invalid provider', () => {
    expect(() =>
      webhookSignatureConfigSchema.parse({ ...valid, provider: 'foo' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// integrationStatusSchema
// ---------------------------------------------------------------------------

describe('integrationStatusSchema', () => {
  it('accepts all valid statuses', () => {
    for (const s of ['connected', 'disconnected', 'error', 'pending'] as const) {
      expect(integrationStatusSchema.parse(s)).toBe(s)
    }
  })

  it('rejects unknown status', () => {
    expect(() => integrationStatusSchema.parse('active')).toThrow()
  })

  it('rejects non-string', () => {
    expect(() => integrationStatusSchema.parse(1)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// integrationFeatureFlagSchema
// ---------------------------------------------------------------------------

describe('integrationFeatureFlagSchema', () => {
  const valid = {
    tenantId: 'tenant-1',
    provider: 'calendly',
    enabled: true,
    updatedAt: '2025-01-15T10:00:00Z',
    updatedBy: 'user-1',
  }

  it('parses a valid feature flag', () => {
    const result = integrationFeatureFlagSchema.parse(valid)
    expect(result.enabled).toBe(true)
    expect(result.capabilities).toBeUndefined()
  })

  it('defaults enabled to false', () => {
    const result = integrationFeatureFlagSchema.parse({
      tenantId: 't',
      provider: 'zoom',
      updatedAt: '2025-01-15T10:00:00Z',
      updatedBy: 'u',
    })
    expect(result.enabled).toBe(false)
  })

  it('accepts optional capabilities', () => {
    const result = integrationFeatureFlagSchema.parse({
      ...valid,
      capabilities: ['booking', 'cancellation'],
    })
    expect(result.capabilities).toEqual(['booking', 'cancellation'])
  })

  it('rejects empty tenantId', () => {
    expect(() =>
      integrationFeatureFlagSchema.parse({ ...valid, tenantId: '' }),
    ).toThrow()
  })

  it('rejects empty updatedBy', () => {
    expect(() =>
      integrationFeatureFlagSchema.parse({ ...valid, updatedBy: '' }),
    ).toThrow()
  })

  it('rejects invalid updatedAt', () => {
    expect(() =>
      integrationFeatureFlagSchema.parse({ ...valid, updatedAt: 'bad' }),
    ).toThrow()
  })

  it('rejects invalid provider', () => {
    expect(() =>
      integrationFeatureFlagSchema.parse({ ...valid, provider: 'foo' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// marketplaceProviderSchema
// ---------------------------------------------------------------------------

describe('marketplaceProviderSchema', () => {
  const valid = {
    provider: 'calendly',
    displayName: 'Calendly',
    description: 'Scheduling',
    category: 'scheduling',
    defaultScopes: ['read', 'write'],
  }

  it('parses a valid provider', () => {
    const result = marketplaceProviderSchema.parse(valid)
    expect(result.provider).toBe('calendly')
    expect(result.category).toBe('scheduling')
  })

  it('accepts optional logoUrl and documentationUrl', () => {
    const result = marketplaceProviderSchema.parse({
      ...valid,
      logoUrl: 'https://cdn.example.com/logo.png',
      documentationUrl: 'https://docs.example.com',
    })
    expect(result.logoUrl).toBe('https://cdn.example.com/logo.png')
  })

  it('accepts optional webhookEvents', () => {
    const result = marketplaceProviderSchema.parse({
      ...valid,
      webhookEvents: ['evt.created'],
    })
    expect(result.webhookEvents).toEqual(['evt.created'])
  })

  it('rejects invalid category', () => {
    expect(() =>
      marketplaceProviderSchema.parse({ ...valid, category: 'invalid' }),
    ).toThrow()
  })

  it('accepts all valid categories', () => {
    for (const c of ['scheduling', 'video', 'payments', 'communications'] as const) {
      expect(
        marketplaceProviderSchema.parse({ ...valid, category: c }).category,
      ).toBe(c)
    }
  })

  it('rejects non-URL logoUrl', () => {
    expect(() =>
      marketplaceProviderSchema.parse({ ...valid, logoUrl: 'not-a-url' }),
    ).toThrow()
  })

  it('rejects non-URL documentationUrl', () => {
    expect(() =>
      marketplaceProviderSchema.parse({ ...valid, documentationUrl: 'bad' }),
    ).toThrow()
  })

  it('rejects invalid provider', () => {
    expect(() =>
      marketplaceProviderSchema.parse({ ...valid, provider: 'foo' }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// tenantProviderStatusSchema
// ---------------------------------------------------------------------------

describe('tenantProviderStatusSchema', () => {
  const valid = {
    tenantId: 'tenant-1',
    provider: 'zoom',
    status: 'connected',
  }

  it('parses minimal valid status', () => {
    const result = tenantProviderStatusSchema.parse(valid)
    expect(result.status).toBe('connected')
    expect(result.connectedAt).toBeUndefined()
  })

  it('accepts all optional fields', () => {
    const result = tenantProviderStatusSchema.parse({
      ...valid,
      connectedAt: '2025-01-15T10:00:00Z',
      lastWebhookReceivedAt: '2025-06-15T10:00:00Z',
      lastError: 'something went wrong',
      featureFlag: {
        tenantId: 'tenant-1',
        provider: 'zoom',
        enabled: true,
        updatedAt: '2025-01-15T10:00:00Z',
        updatedBy: 'user-1',
      },
    })
    expect(result.connectedAt).toBe('2025-01-15T10:00:00Z')
    expect(result.featureFlag?.enabled).toBe(true)
  })

  it('rejects empty tenantId', () => {
    expect(() =>
      tenantProviderStatusSchema.parse({ ...valid, tenantId: '' }),
    ).toThrow()
  })

  it('rejects invalid status', () => {
    expect(() =>
      tenantProviderStatusSchema.parse({ ...valid, status: 'active' }),
    ).toThrow()
  })

  it('rejects invalid connectedAt', () => {
    expect(() =>
      tenantProviderStatusSchema.parse({ ...valid, connectedAt: 'bad' }),
    ).toThrow()
  })

  it('rejects invalid featureFlag sub-schema', () => {
    expect(() =>
      tenantProviderStatusSchema.parse({
        ...valid,
        featureFlag: { tenantId: '', provider: 'zoom', updatedAt: 'x', updatedBy: 'u' },
      }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// marketplaceDashboardSchema
// ---------------------------------------------------------------------------

describe('marketplaceDashboardSchema', () => {
  it('parses a valid dashboard', () => {
    const result = marketplaceDashboardSchema.parse({
      tenantId: 'tenant-1',
      providers: [],
      totalConnected: 0,
      totalAvailable: 4,
    })
    expect(result.tenantId).toBe('tenant-1')
    expect(result.providers).toEqual([])
  })

  it('parses dashboard with providers', () => {
    const result = marketplaceDashboardSchema.parse({
      tenantId: 't1',
      providers: [
        {
          tenantId: 't1',
          provider: 'calendly',
          status: 'connected',
        },
      ],
      totalConnected: 1,
      totalAvailable: 4,
    })
    expect(result.providers).toHaveLength(1)
    expect(result.totalConnected).toBe(1)
  })

  it('rejects negative totalConnected', () => {
    expect(() =>
      marketplaceDashboardSchema.parse({
        tenantId: 't1',
        providers: [],
        totalConnected: -1,
        totalAvailable: 4,
      }),
    ).toThrow()
  })

  it('rejects negative totalAvailable', () => {
    expect(() =>
      marketplaceDashboardSchema.parse({
        tenantId: 't1',
        providers: [],
        totalConnected: 0,
        totalAvailable: -1,
      }),
    ).toThrow()
  })

  it('rejects empty tenantId', () => {
    expect(() =>
      marketplaceDashboardSchema.parse({
        tenantId: '',
        providers: [],
        totalConnected: 0,
        totalAvailable: 0,
      }),
    ).toThrow()
  })

  it('rejects non-integer totals', () => {
    expect(() =>
      marketplaceDashboardSchema.parse({
        tenantId: 't1',
        providers: [],
        totalConnected: 1.5,
        totalAvailable: 4,
      }),
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// integrationAuditMetadataSchema
// ---------------------------------------------------------------------------

describe('integrationAuditMetadataSchema', () => {
  const valid = {
    tenantId: 'tenant-1',
    provider: 'stripe',
    userId: 'user-1',
    action: 'webhook' as const,
    status: 'success' as const,
  }

  it('parses a valid audit metadata', () => {
    const result = integrationAuditMetadataSchema.parse(valid)
    expect(result.action).toBe('webhook')
    expect(result.status).toBe('success')
  })

  it('accepts all valid actions', () => {
    for (const a of [
      'connect',
      'disconnect',
      'webhook',
      'oauth_callback',
      'token_refresh',
    ] as const) {
      expect(
        integrationAuditMetadataSchema.parse({ ...valid, action: a }).action,
      ).toBe(a)
    }
  })

  it('accepts all valid statuses', () => {
    expect(
      integrationAuditMetadataSchema.parse({ ...valid, status: 'failure' }).status,
    ).toBe('failure')
    expect(
      integrationAuditMetadataSchema.parse({ ...valid, status: 'success' }).status,
    ).toBe('success')
  })

  it('accepts optional fields', () => {
    const result = integrationAuditMetadataSchema.parse({
      ...valid,
      eventId: 'evt_1',
      eventType: 'payment.succeeded',
      errorMessage: 'oops',
      ipAddress: '10.0.0.1',
      userAgent: 'curl/8',
    })
    expect(result.eventId).toBe('evt_1')
    expect(result.ipAddress).toBe('10.0.0.1')
  })

  it('rejects invalid action', () => {
    expect(() =>
      integrationAuditMetadataSchema.parse({ ...valid, action: 'delete' }),
    ).toThrow()
  })

  it('rejects invalid status', () => {
    expect(() =>
      integrationAuditMetadataSchema.parse({ ...valid, status: 'pending' }),
    ).toThrow()
  })

  it('rejects empty tenantId', () => {
    expect(() =>
      integrationAuditMetadataSchema.parse({ ...valid, tenantId: '' }),
    ).toThrow()
  })

  it('rejects empty userId', () => {
    expect(() =>
      integrationAuditMetadataSchema.parse({ ...valid, userId: '' }),
    ).toThrow()
  })

  it('rejects invalid provider', () => {
    expect(() =>
      integrationAuditMetadataSchema.parse({ ...valid, provider: 'foo' }),
    ).toThrow()
  })
})
