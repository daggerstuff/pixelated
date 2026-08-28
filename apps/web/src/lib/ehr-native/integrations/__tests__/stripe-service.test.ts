/**
 * Tests for StripeService — OAuth flow, adapter ops, webhook handling.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

// ---------------------------------------------------------------------------
// Hoisted mock fixtures (available inside vi.mock factories)
// ---------------------------------------------------------------------------

const { mockAuditLog, mockAuditService } = vi.hoisted(() => {
  const mockAuditLog = vi.fn().mockResolvedValue('audit-id')
  const mockAuditService = { log: mockAuditLog }
  return { mockAuditLog, mockAuditService }
})

const { mockRedisGet, mockRedisSetex, mockRedisSet } = vi.hoisted(() => ({
  mockRedisGet: vi.fn().mockResolvedValue(null),
  mockRedisSetex: vi.fn().mockResolvedValue('OK'),
  mockRedisSet: vi.fn().mockResolvedValue('OK'),
}))

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/redis', () => ({
  redis: { get: mockRedisGet, set: mockRedisSet, setex: mockRedisSetex, del: vi.fn().mockResolvedValue(1) },
}))

vi.mock('@/lib/ehr-native/audit/ehr-audit-service', () => ({
  EHRAuditService: class MockEHRAuditService {
    static getInstance() {
      return mockAuditService
    }
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = 'whsec_test_stripe_12345'

const OAUTH_CONFIG = {
  clientId: 'ca_test_client',
  clientSecret: 'sk_test_secret',
  redirectUri: 'https://app.example.com/oauth/callback',
}

function makeStripeSignature(
  rawBody: string,
  secret: string = WEBHOOK_SECRET,
  timestamp: number = 1717200000,
): string {
  const dataToSign = `${timestamp}.${rawBody}`
  const signature = createHmac('sha256', secret).update(dataToSign, 'utf8').digest('hex')
  return `t=${timestamp},v1=${signature}`
}

function makeWebhookEvent(overrides: Partial<{
  eventId: string
  eventType: string
  rawBody: string
  signature: string
}> = {}) {
  const rawBody = overrides.rawBody ?? '{"id":"evt_001","type":"payment_intent.succeeded"}'
  return {
    provider: 'stripe' as const,
    eventId: overrides.eventId ?? 'evt_001',
    eventType: overrides.eventType ?? 'payment_intent.succeeded',
    payload: {},
    signature: overrides.signature ?? makeStripeSignature(rawBody),
    receivedAt: new Date().toISOString(),
    rawBody,
  }
}

function mockFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StripeService', () => {
  let service: InstanceType<typeof import('../stripe/stripe-service').StripeService>
  let StubStripeAdapter: typeof import('../stripe/stub-adapter').StubStripeAdapter
  let StripeService: typeof import('../stripe/stripe-service').StripeService

  beforeEach(async () => {
    vi.restoreAllMocks()
    mockAuditLog.mockClear()
    mockRedisGet.mockClear()
    mockRedisSetex.mockClear()
    mockRedisSet.mockClear()
    mockAuditLog.mockResolvedValue('audit-id')
    mockRedisGet.mockResolvedValue(null)
    mockRedisSetex.mockResolvedValue('OK')
    mockRedisSet.mockResolvedValue('OK')

    const stubMod = await import('../stripe/stub-adapter')
    StubStripeAdapter = stubMod.StubStripeAdapter
    const svcMod = await import('../stripe/stripe-service')
    StripeService = svcMod.StripeService

    const adapter = new StubStripeAdapter()
    service = new StripeService({
      adapter,
      oauthConfig: OAUTH_CONFIG,
      webhookSecret: WEBHOOK_SECRET,
    })
  })

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('instantiates with valid oauth config', () => {
      const adapter = new StubStripeAdapter()
      const svc = new StripeService({
        adapter,
        oauthConfig: OAUTH_CONFIG,
        webhookSecret: WEBHOOK_SECRET,
      })
      expect(svc).toBeDefined()
    })

    it('throws on invalid oauth config (missing clientId)', () => {
      const adapter = new StubStripeAdapter()
      expect(
        () =>
          new StripeService({
            adapter,
            oauthConfig: { ...OAUTH_CONFIG, clientId: '' },
            webhookSecret: WEBHOOK_SECRET,
          }),
      ).toThrow()
    })

    it('throws on invalid redirectUri (not a URL)', () => {
      const adapter = new StubStripeAdapter()
      expect(
        () =>
          new StripeService({
            adapter,
            oauthConfig: { ...OAUTH_CONFIG, redirectUri: 'not-a-url' },
            webhookSecret: WEBHOOK_SECRET,
          }),
      ).toThrow()
    })

    it('applies default authorize and token URLs', () => {
      const adapter = new StubStripeAdapter()
      const svc = new StripeService({
        adapter,
        oauthConfig: {
          clientId: 'c',
          clientSecret: 's',
          redirectUri: 'https://app.example.com/cb',
        },
        webhookSecret: 'secret',
      })
      const url = svc.buildAuthorizeUrl('state123')
      expect(url).toContain('connect.stripe.com')
    })
  })

  // -------------------------------------------------------------------------
  // OAuth: buildAuthorizeUrl
  // -------------------------------------------------------------------------

  describe('buildAuthorizeUrl', () => {
    it('returns a URL with all required params', () => {
      const url = service.buildAuthorizeUrl('my-state-value')
      expect(url).toContain('client_id=ca_test_client')
      expect(url).toContain('redirect_uri=')
      expect(url).toContain('response_type=code')
      expect(url).toContain('state=my-state-value')
      // scopes are joined with space, URL-encoded as %20
      expect(url).toContain('scope=')
    })

    it('includes the state parameter verbatim', () => {
      const url = service.buildAuthorizeUrl('csrf-token-abc')
      const parsed = new URL(url)
      expect(parsed.searchParams.get('state')).toBe('csrf-token-abc')
    })

    it('uses the configured authorizeUrl as base', () => {
      const url = service.buildAuthorizeUrl('s')
      expect(url.startsWith('https://connect.stripe.com/oauth/authorize')).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // OAuth: exchangeCodeForToken
  // -------------------------------------------------------------------------

  describe('exchangeCodeForToken', () => {
    it('exchanges a code for a token on success', async () => {
      const tokenResponse = {
        access_token: 'tok_access_123',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'tok_refresh_456',
        scope: 'read_only',
      }
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(tokenResponse)))

      const result = await service.exchangeCodeForToken('auth_code_abc')
      expect(result.access_token).toBe('tok_access_123')
      expect(result.token_type).toBe('Bearer')
      expect(result.expires_in).toBe(3600)
      expect(result.refresh_token).toBe('tok_refresh_456')
    })

    it('throws on non-ok response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockFetchResponse('invalid_grant', false, 400)),
      )
      await expect(service.exchangeCodeForToken('bad_code')).rejects.toThrow(
        'Stripe token exchange failed (400)',
      )
    })

    it('throws on schema validation failure (missing access_token)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockFetchResponse({ token_type: 'Bearer' })),
      )
      await expect(service.exchangeCodeForToken('code')).rejects.toThrow()
    })

    it('sends correct form-encoded body', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockFetchResponse({ access_token: 'tok', token_type: 'Bearer' }),
      )
      vi.stubGlobal('fetch', mockFetch)

      await service.exchangeCodeForToken('my_code')
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [, init] = mockFetch.mock.calls[0]
      expect(init.method).toBe('POST')
      expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
      const bodyStr = init.body.toString()
      expect(bodyStr).toContain('grant_type=authorization_code')
      expect(bodyStr).toContain('client_id=ca_test_client')
      expect(bodyStr).toContain('code=my_code')
    })
  })

  // -------------------------------------------------------------------------
  // OAuth: refreshToken
  // -------------------------------------------------------------------------

  describe('refreshToken', () => {
    it('refreshes a token on success', async () => {
      const tokenResponse = {
        access_token: 'tok_new_access',
        token_type: 'Bearer',
        expires_in: 7200,
        refresh_token: 'tok_new_refresh',
      }
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(tokenResponse)))

      const result = await service.refreshToken('old_refresh_token')
      expect(result.access_token).toBe('tok_new_access')
      expect(result.expires_in).toBe(7200)
    })

    it('throws on non-ok response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockFetchResponse('expired', false, 401)),
      )
      await expect(service.refreshToken('expired_token')).rejects.toThrow(
        'Stripe token refresh failed (401)',
      )
    })

    it('sends refresh_token grant type', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockFetchResponse({ access_token: 'tok', token_type: 'Bearer' }),
      )
      vi.stubGlobal('fetch', mockFetch)

      await service.refreshToken('rt_123')
      const [, init] = mockFetch.mock.calls[0]
      const bodyStr = init.body.toString()
      expect(bodyStr).toContain('grant_type=refresh_token')
      expect(bodyStr).toContain('refresh_token=rt_123')
    })
  })

  // -------------------------------------------------------------------------
  // Adapter operations
  // -------------------------------------------------------------------------

  describe('getCustomer', () => {
    it('returns a validated customer and logs audit', async () => {
      const result = await service.getCustomer('tok', 'tenant-1', 'user-1', 'cus_stub001')
      expect(result.id).toBe('cus_stub001')
      expect(result.email).toBe('patient1@example.com')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })

    it('throws when customer not found', async () => {
      await expect(
        service.getCustomer('tok', 'tenant-1', 'user-1', 'cus_nonexistent'),
      ).rejects.toThrow()
    })
  })

  describe('listCustomers', () => {
    it('returns validated customers and logs audit', async () => {
      const result = await service.listCustomers('tok', 'tenant-1', 'user-1')
      expect(result.data).toHaveLength(2)
      expect(result.has_more).toBe(false)
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })

    it('passes params to adapter', async () => {
      const result = await service.listCustomers('tok', 'tenant-1', 'user-1', {
        email: 'patient1@example.com',
      })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('createCustomer', () => {
    it('creates a customer and logs audit', async () => {
      const result = await service.createCustomer('tok', 'tenant-1', 'user-1', {
        email: 'new@example.com',
        name: 'New',
        tax_exempt: 'none',
      })
      expect(result.id).toMatch(/^cus_stub/)
      expect(result.email).toBe('new@example.com')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateCustomer', () => {
    it('updates a customer and logs audit', async () => {
      const result = await service.updateCustomer(
        'tok',
        'tenant-1',
        'user-1',
        'cus_stub001',
        { email: 'changed@example.com' },
      )
      expect(result.email).toBe('changed@example.com')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })
  })

  describe('getCharge', () => {
    it('returns a validated charge and logs audit', async () => {
      const result = await service.getCharge('tok', 'tenant-1', 'user-1', 'ch_stub001')
      expect(result.id).toBe('ch_stub001')
      expect(result.amount).toBe(15000)
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })
  })

  describe('listCharges', () => {
    it('returns validated charges and logs audit', async () => {
      const result = await service.listCharges('tok', 'tenant-1', 'user-1')
      expect(result.data).toHaveLength(2)
      expect(result.has_more).toBe(false)
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })

    it('filters by customer', async () => {
      const result = await service.listCharges('tok', 'tenant-1', 'user-1', {
        customer: 'cus_stub001',
      })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('createRefund', () => {
    it('creates a refund and logs audit', async () => {
      const result = await service.createRefund('tok', 'tenant-1', 'user-1', {
        charge: 'ch_stub001',
      })
      expect(result.amount_refunded).toBe(15000)
      expect(result.refunded).toBe(true)
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })
  })

  describe('getPaymentIntent', () => {
    it('returns a validated payment intent and logs audit', async () => {
      const result = await service.getPaymentIntent('tok', 'tenant-1', 'user-1', 'pi_stub001')
      expect(result.id).toBe('pi_stub001')
      expect(result.amount).toBe(15000)
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })
  })

  describe('getInvoice', () => {
    it('returns a validated invoice and logs audit', async () => {
      const result = await service.getInvoice('tok', 'tenant-1', 'user-1', 'in_stub001')
      expect(result.id).toBe('in_stub001')
      expect(result.status).toBe('paid')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })
  })

  describe('listInvoices', () => {
    it('returns validated invoices and logs audit', async () => {
      const result = await service.listInvoices('tok', 'tenant-1', 'user-1')
      expect(result.data).toHaveLength(1)
      expect(result.has_more).toBe(false)
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })
  })

  describe('createCheckoutSession', () => {
    it('creates a checkout session and logs audit', async () => {
      const result = await service.createCheckoutSession('tok', 'tenant-1', 'user-1', {
        mode: 'payment',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: 'Therapy' },
              unit_amount: 15000,
            },
            quantity: 1,
          },
        ],
      })
      expect(result.id).toMatch(/^cs_stub/)
      expect(result.mode).toBe('payment')
      expect(result.amount_total).toBe(15000)
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // Webhook handling
  // -------------------------------------------------------------------------

  describe('getWebhookSignatureConfig', () => {
    it('returns stripe-composite config with the webhook secret', () => {
      const config = service.getWebhookSignatureConfig()
      expect(config.provider).toBe('stripe')
      expect(config.headerName).toBe('Stripe-Signature')
      expect(config.format).toBe('stripe-composite')
      expect(config.algorithm).toBe('sha256')
      expect(config.secret).toBe(WEBHOOK_SECRET)
    })
  })

  describe('processWebhook', () => {
    it('processes a valid webhook and returns success', async () => {
      const event = makeWebhookEvent()
      const result = await service.processWebhook(event, 'tenant-1', 'user-1')
      expect(result.processed).toBe(true)
      expect(result.duplicate).toBe(false)
      expect(result.httpStatus).toBe(200)
      expect(result.eventId).toBe('evt_001')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })

    it('returns 401 when signature verification fails', async () => {
      const event = makeWebhookEvent({ signature: 't=123,v1=invalid' })
      const result = await service.processWebhook(event, 'tenant-1', 'user-1')
      expect(result.processed).toBe(false)
      expect(result.duplicate).toBe(false)
      expect(result.httpStatus).toBe(401)
      expect(result.error).toBe('Signature verification failed')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })

    it('returns 401 when signature header is malformed', async () => {
      const event = makeWebhookEvent({ signature: 'malformed' })
      const result = await service.processWebhook(event, 'tenant-1', 'user-1')
      expect(result.httpStatus).toBe(401)
      expect(result.processed).toBe(false)
    })

    it('returns duplicate=true when event already processed', async () => {
      mockRedisSet.mockResolvedValueOnce(null) // simulate existing key (duplicate)
      const event = makeWebhookEvent()
      const result = await service.processWebhook(event, 'tenant-1', 'user-1')
      expect(result.processed).toBe(false)
      expect(result.duplicate).toBe(true)
      expect(result.httpStatus).toBe(200)
    })

    it('logs audit on signature failure with failure status', async () => {
      const event = makeWebhookEvent({ signature: 'bad' })
      await service.processWebhook(event, 'tenant-1', 'user-1')
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'evt_001',
        expect.objectContaining({
          status: 'failure',
          errorMessage: 'Webhook signature verification failed',
        }),
      )
    })

    it('logs audit on success with event type metadata', async () => {
      const event = makeWebhookEvent({ eventType: 'invoice.paid' })
      await service.processWebhook(event, 'tenant-1', 'user-1')
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'evt_001',
        expect.objectContaining({
          status: 'success',
          metadata: expect.objectContaining({
            eventType: 'invoice.paid',
            integrationSource: 'stripe',
          }),
        }),
      )
    })

    it('uses requestUrl for signature verification when provided', async () => {
      // Stripe uses stripe-composite format which doesn't need requestUrl,
      // but passing it should not break anything
      const event = makeWebhookEvent()
      const result = await service.processWebhook(
        event,
        'tenant-1',
        'user-1',
        'https://app.example.com/webhooks/stripe',
      )
      expect(result.processed).toBe(true)
    })
  })
})
