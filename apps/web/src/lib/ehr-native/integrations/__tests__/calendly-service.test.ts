/**
 * Tests for CalendlyService — OAuth flow, adapter ops, webhook handling.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the service
// ---------------------------------------------------------------------------

const mockRedisGet = vi.fn()
const mockRedisSetex = vi.fn()
const mockRedisSet = vi.fn()

vi.mock('@/lib/redis', () => ({
  redis: {
    get: mockRedisGet,
    setex: mockRedisSetex,
    set: mockRedisSet,
    del: vi.fn().mockResolvedValue(1),
  },
}))

const mockAuditLog = vi.fn().mockResolvedValue('audit-log-id')

vi.mock('@/lib/ehr-native/audit/ehr-audit-service', () => ({
  EHRAuditService: class MockEHRAuditService {
    static getInstance() {
      return { log: mockAuditLog }
    }
  },
}))

// Mock global.fetch for OAuth token exchange
const mockFetch = vi.fn()
global.fetch = mockFetch

const { CalendlyService } = await import('../calendly/calendly-service')
const { StubCalendlyAdapter } = await import('../calendly/stub-adapter')
const { buildSignatureConfig } = await import('../webhooks')

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-001'
const USER_ID = 'user-001'
const ACCESS_TOKEN = 'test-access-token'
const WEBHOOK_SECRET = 'test-webhook-secret'

const OAUTH_CONFIG = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'https://app.example.com/callback',
  scopes: ['openid', 'profile', 'email'],
  authorizeUrl: 'https://auth.calendly.com/oauth/authorize',
  tokenUrl: 'https://auth.calendly.com/oauth/token',
}

const SEEDED_EVENT_URI = 'https://api.calendly.com/scheduled_events/stub-event-001'

function makeTokenResponse(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'new-access-token',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'new-refresh-token',
    scope: 'openid profile email',
    ...overrides,
  }
}

function makeFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
    json: vi.fn().mockResolvedValue(body),
  }
}

/** Build a valid Calendly webhook signature header (stripe-composite format). */
function makeCalendlySignature(rawBody: string, secret: string, timestamp = '1700000000'): string {
  const dataToSign = `${timestamp}.${rawBody}`
  const signature = createHmac('sha256', secret).update(dataToSign, 'utf8').digest('hex')
  return `t=${timestamp},v1=${signature}`
}

function makeWebhookEvent(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'calendly' as const,
    eventId: 'evt-001',
    eventType: 'invitee.created',
    payload: {},
    signature: '',
    receivedAt: new Date().toISOString(),
    rawBody: '{"test":"body"}',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CalendlyService', () => {
  let service: InstanceType<typeof CalendlyService>
  let adapter: StubCalendlyAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    mockRedisGet.mockResolvedValue(null)
    mockRedisSetex.mockResolvedValue('OK')
    mockRedisSet.mockResolvedValue('OK')
    mockAuditLog.mockResolvedValue('audit-log-id')

    adapter = new StubCalendlyAdapter()
    service = new CalendlyService({
      adapter,
      oauthConfig: OAUTH_CONFIG,
      webhookSecret: WEBHOOK_SECRET,
    })
  })

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  describe('constructor', () => {
    it('validates oauthConfig with Zod and accepts valid config', () => {
      expect(service).toBeInstanceOf(CalendlyService)
    })

    it('throws on invalid oauthConfig (missing clientId)', () => {
      expect(
        () =>
          new CalendlyService({
            adapter,
            oauthConfig: { ...OAUTH_CONFIG, clientId: '' },
            webhookSecret: WEBHOOK_SECRET,
          }),
      ).toThrow()
    })

    it('throws on invalid oauthConfig (invalid redirectUri)', () => {
      expect(
        () =>
          new CalendlyService({
            adapter,
            oauthConfig: { ...OAUTH_CONFIG, redirectUri: 'not-a-url' },
            webhookSecret: WEBHOOK_SECRET,
          }),
      ).toThrow()
    })

    it('applies default scopes when omitted', () => {
      const svc = new CalendlyService({
        adapter,
        oauthConfig: {
          clientId: 'c',
          clientSecret: 's',
          redirectUri: 'https://app.example.com/callback',
        },
        webhookSecret: WEBHOOK_SECRET,
      })
      // buildAuthorizeUrl should include default scopes
      const url = svc.buildAuthorizeUrl('state123')
      expect(url).toContain('scope=')
    })
  })

  // -------------------------------------------------------------------------
  // buildAuthorizeUrl
  // -------------------------------------------------------------------------

  describe('buildAuthorizeUrl', () => {
    it('returns a URL with correct query params', () => {
      const url = service.buildAuthorizeUrl('random-state-123')
      expect(url).toContain('client_id=test-client-id')
      expect(url).toContain('response_type=code')
      expect(url).toContain('state=random-state-123')
      expect(url).toContain('redirect_uri=')
      expect(url).toContain('scope=openid+profile+email')
    })

    it('starts with the authorizeUrl', () => {
      const url = service.buildAuthorizeUrl('state')
      expect(url.startsWith('https://auth.calendly.com/oauth/authorize?')).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // exchangeCodeForToken
  // -------------------------------------------------------------------------

  describe('exchangeCodeForToken', () => {
    it('exchanges code for token on success', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse(makeTokenResponse()))
      const result = await service.exchangeCodeForToken('auth-code-123')
      expect(result.access_token).toBe('new-access-token')
      expect(result.token_type).toBe('Bearer')
      expect(result.refresh_token).toBe('new-refresh-token')
    })

    it('sends POST with correct form body', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse(makeTokenResponse()))
      await service.exchangeCodeForToken('auth-code-123')
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe('https://auth.calendly.com/oauth/token')
      expect(init.method).toBe('POST')
      expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
      const body = init.body.toString()
      expect(body).toContain('grant_type=authorization_code')
      expect(body).toContain('code=auth-code-123')
      expect(body).toContain('client_id=test-client-id')
      expect(body).toContain('client_secret=test-client-secret')
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse('invalid_grant', false, 400))
      await expect(service.exchangeCodeForToken('bad-code')).rejects.toThrow(
        'Calendly token exchange failed (400)',
      )
    })

    it('throws on schema validation failure', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({ invalid: 'response' }))
      await expect(service.exchangeCodeForToken('code')).rejects.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // refreshToken
  // -------------------------------------------------------------------------

  describe('refreshToken', () => {
    it('refreshes token on success', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse(makeTokenResponse()))
      const result = await service.refreshToken('old-refresh-token')
      expect(result.access_token).toBe('new-access-token')
    })

    it('sends POST with refresh_token grant_type', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse(makeTokenResponse()))
      await service.refreshToken('old-refresh-token')
      const [, init] = mockFetch.mock.calls[0]
      const body = init.body.toString()
      expect(body).toContain('grant_type=refresh_token')
      expect(body).toContain('refresh_token=old-refresh-token')
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse('expired', false, 401))
      await expect(service.refreshToken('expired-token')).rejects.toThrow(
        'Calendly token refresh failed (401)',
      )
    })

    it('throws on schema validation failure', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse({ bad: true }))
      await expect(service.refreshToken('token')).rejects.toThrow()
    })
  })

  // -------------------------------------------------------------------------
  // getCurrentUser
  // -------------------------------------------------------------------------

  describe('getCurrentUser', () => {
    it('returns validated user and logs audit', async () => {
      const user = await service.getCurrentUser(ACCESS_TOKEN, TENANT_ID, USER_ID)
      expect(user.uri).toBe('https://api.calendly.com/users/stub-user-001')
      expect(user.email).toBe('stub@example.com')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
      const [action, resourceType, resourceId, input] = mockAuditLog.mock.calls[0]
      expect(action).toBe('integration_connect')
      expect(resourceType).toBe('Integration')
      expect(resourceId).toBe(user.uri)
      expect(input.userId).toBe(USER_ID)
      expect(input.status).toBe('success')
      expect(input.metadata.tenantId).toBe(TENANT_ID)
      expect(input.metadata.integrationSource).toBe('calendly')
    })
  })

  // -------------------------------------------------------------------------
  // listEventTypes
  // -------------------------------------------------------------------------

  describe('listEventTypes', () => {
    it('returns validated event types with pagination', async () => {
      const result = await service.listEventTypes(ACCESS_TOKEN, TENANT_ID, USER_ID)
      expect(result.data).toHaveLength(1)
      expect(result.pagination.count).toBe(1)
      expect(result.data[0].name).toBe('30 Minute Meeting')
    })

    it('passes params to adapter', async () => {
      const result = await service.listEventTypes(ACCESS_TOKEN, TENANT_ID, USER_ID, {
        active: true,
      })
      expect(result.data).toHaveLength(1)
    })
  })

  // -------------------------------------------------------------------------
  // getScheduledEvent
  // -------------------------------------------------------------------------

  describe('getScheduledEvent', () => {
    it('returns validated event and logs audit', async () => {
      const event = await service.getScheduledEvent(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        SEEDED_EVENT_URI,
      )
      expect(event.uri).toBe(SEEDED_EVENT_URI)
      expect(event.status).toBe('active')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
      const [action, , resourceId] = mockAuditLog.mock.calls[0]
      expect(action).toBe('integration_webhook_received')
      expect(resourceId).toBe(SEEDED_EVENT_URI)
    })
  })

  // -------------------------------------------------------------------------
  // listScheduledEvents
  // -------------------------------------------------------------------------

  describe('listScheduledEvents', () => {
    it('returns validated events with pagination', async () => {
      const result = await service.listScheduledEvents(ACCESS_TOKEN, TENANT_ID, USER_ID)
      expect(result.data.length).toBeGreaterThan(0)
      expect(result.pagination.count).toBe(result.data.length)
    })

    it('passes params to adapter', async () => {
      const result = await service.listScheduledEvents(ACCESS_TOKEN, TENANT_ID, USER_ID, {
        status: 'active',
      })
      expect(result.data.every((e) => e.status === 'active')).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // listInvitees
  // -------------------------------------------------------------------------

  describe('listInvitees', () => {
    it('returns validated invitees with pagination', async () => {
      const result = await service.listInvitees(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        SEEDED_EVENT_URI,
      )
      expect(result.data).toHaveLength(1)
      expect(result.data[0].email).toBe('patient@example.com')
      expect(result.pagination.count).toBe(1)
    })

    it('returns empty for unknown event', async () => {
      const result = await service.listInvitees(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        'https://api.calendly.com/scheduled_events/nonexistent',
      )
      expect(result.data).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // cancelScheduledEvent
  // -------------------------------------------------------------------------

  describe('cancelScheduledEvent', () => {
    it('cancels event and logs audit', async () => {
      const result = await service.cancelScheduledEvent(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        SEEDED_EVENT_URI,
        'Patient cancelled',
      )
      expect(result.canceled).toBe(true)
      expect(result.eventUri).toBe(SEEDED_EVENT_URI)
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
      const [action, , resourceId] = mockAuditLog.mock.calls[0]
      expect(action).toBe('integration_webhook_received')
      expect(resourceId).toBe(SEEDED_EVENT_URI)
    })

    it('works without cancellation reason', async () => {
      const result = await service.cancelScheduledEvent(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        SEEDED_EVENT_URI,
      )
      expect(result.canceled).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // getWebhookSignatureConfig
  // -------------------------------------------------------------------------

  describe('getWebhookSignatureConfig', () => {
    it('returns config with provider=calendly and stripe-composite format', () => {
      const config = service.getWebhookSignatureConfig()
      expect(config.provider).toBe('calendly')
      expect(config.format).toBe('stripe-composite')
      expect(config.algorithm).toBe('sha256')
      expect(config.secret).toBe(WEBHOOK_SECRET)
      expect(config.headerName).toBe('Calendly-Webhook-Signature')
    })

    it('matches buildSignatureConfig output', () => {
      const config = service.getWebhookSignatureConfig()
      const expected = buildSignatureConfig('calendly', WEBHOOK_SECRET)
      expect(config).toEqual(expected)
    })
  })

  // -------------------------------------------------------------------------
  // processWebhook
  // -------------------------------------------------------------------------

  describe('processWebhook', () => {
    it('returns 401 on invalid signature', async () => {
      const event = makeWebhookEvent({ signature: 't=123,v1=invalid' })
      const result = await service.processWebhook(event, TENANT_ID, USER_ID)
      expect(result.processed).toBe(false)
      expect(result.duplicate).toBe(false)
      expect(result.httpStatus).toBe(401)
      expect(result.error).toBe('Signature verification failed')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
      const [, , , input] = mockAuditLog.mock.calls[0]
      expect(input.status).toBe('failure')
      expect(input.errorMessage).toContain('signature verification failed')
    })

    it('returns 200 with duplicate=true on duplicate event', async () => {
      const rawBody = '{"test":"body"}'
      const signature = makeCalendlySignature(rawBody, WEBHOOK_SECRET)
      mockRedisSet.mockResolvedValueOnce(null) // duplicate
      const event = makeWebhookEvent({ rawBody, signature })
      const result = await service.processWebhook(event, TENANT_ID, USER_ID)
      expect(result.processed).toBe(false)
      expect(result.duplicate).toBe(true)
      expect(result.httpStatus).toBe(200)
      // No audit log for duplicates
      expect(mockAuditLog).not.toHaveBeenCalled()
    })

    it('returns 200 with processed=true on valid first-time event', async () => {
      const rawBody = '{"test":"body"}'
      const signature = makeCalendlySignature(rawBody, WEBHOOK_SECRET)
      mockRedisSet.mockResolvedValueOnce('OK') // not duplicate
      const event = makeWebhookEvent({ rawBody, signature })
      const result = await service.processWebhook(event, TENANT_ID, USER_ID)
      expect(result.processed).toBe(true)
      expect(result.duplicate).toBe(false)
      expect(result.httpStatus).toBe(200)
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
      const [, , , input] = mockAuditLog.mock.calls[0]
      expect(input.status).toBe('success')
      expect(input.metadata.eventType).toBe('invitee.created')
    })

    it('sets idempotency key in redis on first-time event', async () => {
      const rawBody = '{"test":"body"}'
      const signature = makeCalendlySignature(rawBody, WEBHOOK_SECRET)
      mockRedisSet.mockResolvedValueOnce('OK')
      const event = makeWebhookEvent({ rawBody, signature, eventId: 'unique-evt' })
      await service.processWebhook(event, TENANT_ID, USER_ID)
      expect(mockRedisSet).toHaveBeenCalledTimes(1)
      const [key] = mockRedisSet.mock.calls[0]
      expect(key).toContain('webhook:idempotency:calendly:unique-evt')
    })

    it('passes requestUrl for signature verification', async () => {
      const rawBody = '{"test":"body"}'
      const signature = makeCalendlySignature(rawBody, WEBHOOK_SECRET)
      mockRedisSet.mockResolvedValueOnce('OK')
      const event = makeWebhookEvent({ rawBody, signature })
      const result = await service.processWebhook(
        event,
        TENANT_ID,
        USER_ID,
        'https://app.example.com/webhook/calendly',
      )
      expect(result.processed).toBe(true)
    })

    it('logs failure audit with tenantId and integrationSource on bad signature', async () => {
      const event = makeWebhookEvent({ signature: 't=1,v1=bad' })
      await service.processWebhook(event, TENANT_ID, USER_ID)
      const [, , , input] = mockAuditLog.mock.calls[0]
      expect(input.metadata.tenantId).toBe(TENANT_ID)
      expect(input.metadata.integrationSource).toBe('calendly')
      expect(input.metadata.resourceId).toBe('evt-001')
    })
  })
})
