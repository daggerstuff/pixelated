/**
 * Tests for TwilioService — OAuth flow, adapter ops, webhook handling.
 *
 * @vitest-environment node
 */

import { createHmac } from 'node:crypto'

import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  redis: {
    get: mockRedisGet,
    set: mockRedisSet,
    setex: mockRedisSetex,
    del: vi.fn().mockResolvedValue(1),
  },
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

const WEBHOOK_SECRET = 'whsec_test_twilio_67890'
const REQUEST_URL = 'https://app.example.com/webhooks/twilio'

const OAUTH_CONFIG = {
  clientId: 'tw_client_id',
  clientSecret: 'tw_client_secret',
  redirectUri: 'https://app.example.com/oauth/twilio/callback',
}

function makeTwilioSignature(
  requestUrl: string = REQUEST_URL,
  secret: string = WEBHOOK_SECRET,
  body: string = 'MessageSid=SM001&MessageStatus=delivered',
): string {
  const params = new URLSearchParams(body)
  const sortedKeys = Array.from(params.keys()).sort()
  const postParams = sortedKeys
    .map((k) => `${k}${params.get(k) ?? ''}`)
    .join('')
  const dataToSign = `${requestUrl}${postParams}`
  return createHmac('sha256', secret)
    .update(dataToSign, 'utf8')
    .digest('base64')
}

function makeWebhookEvent(
  overrides: Partial<{
    eventId: string
    eventType: string
    rawBody: string
    signature: string
  }> = {},
) {
  const rawBody =
    overrides.rawBody ?? 'MessageSid=SM001&MessageStatus=delivered'
  return {
    provider: 'twilio' as const,
    eventId: overrides.eventId ?? 'evt_tw_001',
    eventType: overrides.eventType ?? 'message.delivered',
    payload: {},
    signature: overrides.signature ?? makeTwilioSignature(),
    receivedAt: new Date().toISOString(),
    rawBody,
  }
}

function mockFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi
      .fn()
      .mockResolvedValue(
        typeof body === 'string' ? body : JSON.stringify(body),
      ),
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TwilioService', () => {
  let service: InstanceType<
    typeof import('../twilio/twilio-service').TwilioService
  >
  let StubTwilioAdapter: typeof import('../twilio/stub-adapter').StubTwilioAdapter
  let TwilioService: typeof import('../twilio/twilio-service').TwilioService

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

    const stubMod = await import('../twilio/stub-adapter')
    StubTwilioAdapter = stubMod.StubTwilioAdapter
    const svcMod = await import('../twilio/twilio-service')
    TwilioService = svcMod.TwilioService

    const adapter = new StubTwilioAdapter()
    service = new TwilioService({
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
      const adapter = new StubTwilioAdapter()
      const svc = new TwilioService({
        adapter,
        oauthConfig: OAUTH_CONFIG,
        webhookSecret: WEBHOOK_SECRET,
      })
      expect(svc).toBeDefined()
    })

    it('throws on invalid oauth config (missing clientSecret)', () => {
      const adapter = new StubTwilioAdapter()
      expect(
        () =>
          new TwilioService({
            adapter,
            oauthConfig: { ...OAUTH_CONFIG, clientSecret: '' },
            webhookSecret: WEBHOOK_SECRET,
          }),
      ).toThrow()
    })

    it('throws on invalid redirectUri', () => {
      const adapter = new StubTwilioAdapter()
      expect(
        () =>
          new TwilioService({
            adapter,
            oauthConfig: { ...OAUTH_CONFIG, redirectUri: 'bad' },
            webhookSecret: WEBHOOK_SECRET,
          }),
      ).toThrow()
    })

    it('applies default authorize and token URLs', () => {
      const adapter = new StubTwilioAdapter()
      const svc = new TwilioService({
        adapter,
        oauthConfig: {
          clientId: 'c',
          clientSecret: 's',
          redirectUri: 'https://app.example.com/cb',
        },
        webhookSecret: 'secret',
      })
      const url = svc.buildAuthorizeUrl('state')
      expect(url).toContain('twilio.com')
    })
  })

  // -------------------------------------------------------------------------
  // OAuth: buildAuthorizeUrl
  // -------------------------------------------------------------------------

  describe('buildAuthorizeUrl', () => {
    it('returns a URL with all required params', () => {
      const url = service.buildAuthorizeUrl('tw-state-abc')
      expect(url).toContain('client_id=tw_client_id')
      expect(url).toContain('redirect_uri=')
      expect(url).toContain('response_type=code')
      expect(url).toContain('state=tw-state-abc')
      expect(url).toContain('scope=')
    })

    it('uses the configured authorizeUrl as base', () => {
      const url = service.buildAuthorizeUrl('s')
      expect(url.startsWith('https://www.twilio.com/authorize')).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // OAuth: exchangeCodeForToken
  // -------------------------------------------------------------------------

  describe('exchangeCodeForToken', () => {
    it('exchanges a code for a token on success', async () => {
      const tokenResponse = {
        access_token: 'tw_access_tok',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'tw_refresh_tok',
      }
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockFetchResponse(tokenResponse)),
      )

      const result = await service.exchangeCodeForToken('tw_auth_code')
      expect(result.access_token).toBe('tw_access_tok')
      expect(result.refresh_token).toBe('tw_refresh_tok')
    })

    it('throws on non-ok response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockFetchResponse('invalid', false, 400)),
      )
      await expect(service.exchangeCodeForToken('bad')).rejects.toThrow(
        'Twilio token exchange failed (400)',
      )
    })

    it('throws on schema validation failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockFetchResponse({ token_type: 'Bearer' })),
      )
      await expect(service.exchangeCodeForToken('code')).rejects.toThrow()
    })

    it('sends correct form-encoded body', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(
          mockFetchResponse({ access_token: 'tok', token_type: 'Bearer' }),
        )
      vi.stubGlobal('fetch', mockFetch)

      await service.exchangeCodeForToken('my_code')
      const [, init] = mockFetch.mock.calls[0]
      expect(init.method).toBe('POST')
      expect(init.headers['Content-Type']).toBe(
        'application/x-www-form-urlencoded',
      )
      const bodyStr = init.body.toString()
      expect(bodyStr).toContain('grant_type=authorization_code')
      expect(bodyStr).toContain('client_id=tw_client_id')
      expect(bodyStr).toContain('code=my_code')
    })
  })

  // -------------------------------------------------------------------------
  // OAuth: refreshToken
  // -------------------------------------------------------------------------

  describe('refreshToken', () => {
    it('refreshes a token on success', async () => {
      const tokenResponse = {
        access_token: 'tw_new_access',
        token_type: 'Bearer',
        expires_in: 7200,
      }
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockFetchResponse(tokenResponse)),
      )

      const result = await service.refreshToken('old_rt')
      expect(result.access_token).toBe('tw_new_access')
    })

    it('throws on non-ok response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(mockFetchResponse('expired', false, 401)),
      )
      await expect(service.refreshToken('bad')).rejects.toThrow(
        'Twilio token refresh failed (401)',
      )
    })

    it('sends refresh_token grant type', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(
          mockFetchResponse({ access_token: 'tok', token_type: 'Bearer' }),
        )
      vi.stubGlobal('fetch', mockFetch)

      await service.refreshToken('rt_abc')
      const [, init] = mockFetch.mock.calls[0]
      const bodyStr = init.body.toString()
      expect(bodyStr).toContain('grant_type=refresh_token')
      expect(bodyStr).toContain('refresh_token=rt_abc')
    })
  })

  // -------------------------------------------------------------------------
  // Adapter operations
  // -------------------------------------------------------------------------

  describe('getAccount', () => {
    it('returns a validated account and logs audit', async () => {
      const result = await service.getAccount(
        'tok',
        'AC123',
        'tenant-1',
        'user-1',
      )
      expect(result.sid).toBe('AC123')
      expect(result.status).toBe('active')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })

    it('throws when adapter throws (empty token)', async () => {
      await expect(
        service.getAccount('', 'AC123', 'tenant-1', 'user-1'),
      ).rejects.toThrow()
    })
  })

  describe('listMessages', () => {
    it('returns validated messages', async () => {
      const result = await service.listMessages('tok', 'tenant-1', 'user-1')
      expect(result.data).toHaveLength(2)
      expect(result.pagination.count).toBe(2)
    })

    it('passes params to adapter', async () => {
      const result = await service.listMessages('tok', 'tenant-1', 'user-1', {
        to: '+15559876543',
      })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('getMessage', () => {
    it('returns a validated message and logs audit', async () => {
      const result = await service.getMessage(
        'tok',
        'tenant-1',
        'user-1',
        'SMstub-message-001',
      )
      expect(result.sid).toBe('SMstub-message-001')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })

    it('throws when message not found', async () => {
      await expect(
        service.getMessage('tok', 'tenant-1', 'user-1', 'SM_nonexistent'),
      ).rejects.toThrow()
    })
  })

  describe('sendMessage', () => {
    it('sends a message and logs audit', async () => {
      const result = await service.sendMessage('tok', 'tenant-1', 'user-1', {
        to: '+15559876543',
        from: '+15551234567',
        body: 'Test SMS',
      })
      expect(result.sid).toMatch(/^SMstub-message-/)
      expect(result.body).toBe('Test SMS')
      expect(result.status).toBe('queued')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })
  })

  describe('listCalls', () => {
    it('returns validated calls', async () => {
      const result = await service.listCalls('tok', 'tenant-1', 'user-1')
      expect(result.data).toHaveLength(2)
      expect(result.pagination.count).toBe(2)
    })

    it('filters by status', async () => {
      const result = await service.listCalls('tok', 'tenant-1', 'user-1', {
        status: 'completed',
      })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('getCall', () => {
    it('returns a validated call and logs audit', async () => {
      const result = await service.getCall(
        'tok',
        'tenant-1',
        'user-1',
        'CAstub-call-001',
      )
      expect(result.sid).toBe('CAstub-call-001')
      expect(result.status).toBe('completed')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })

    it('throws when call not found', async () => {
      await expect(
        service.getCall('tok', 'tenant-1', 'user-1', 'CA_nonexistent'),
      ).rejects.toThrow()
    })
  })

  describe('makeCall', () => {
    it('makes a call and logs audit', async () => {
      const result = await service.makeCall('tok', 'tenant-1', 'user-1', {
        to: '+15559876543',
        from: '+15551234567',
        url: 'https://example.com/twiml',
      })
      expect(result.sid).toMatch(/^CAstub-call-/)
      expect(result.status).toBe('queued')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })
  })

  describe('getPhoneNumber', () => {
    it('returns a validated phone number and logs audit', async () => {
      const result = await service.getPhoneNumber(
        'tok',
        'tenant-1',
        'user-1',
        'PNstub-phone-001',
      )
      expect(result.sid).toBe('PNstub-phone-001')
      expect(result.phoneNumber).toBe('+15551234567')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })

    it('throws when phone number not found', async () => {
      await expect(
        service.getPhoneNumber('tok', 'tenant-1', 'user-1', 'PN_nonexistent'),
      ).rejects.toThrow()
    })
  })

  describe('listPhoneNumbers', () => {
    it('returns validated phone numbers', async () => {
      const result = await service.listPhoneNumbers('tok', 'tenant-1', 'user-1')
      expect(result.data).toHaveLength(1)
      expect(result.pagination.count).toBe(1)
    })

    it('filters by phoneNumber', async () => {
      const result = await service.listPhoneNumbers(
        'tok',
        'tenant-1',
        'user-1',
        {
          phoneNumber: '+15551234567',
        },
      )
      expect(result.data).toHaveLength(1)
    })
  })

  // -------------------------------------------------------------------------
  // Webhook handling
  // -------------------------------------------------------------------------

  describe('getWebhookSignatureConfig', () => {
    it('returns twilio config with the webhook secret', () => {
      const config = service.getWebhookSignatureConfig()
      expect(config.provider).toBe('twilio')
      expect(config.headerName).toBe('X-Twilio-Signature')
      expect(config.format).toBe('twilio')
      expect(config.algorithm).toBe('sha256')
      expect(config.secret).toBe(WEBHOOK_SECRET)
    })
  })

  describe('processWebhook', () => {
    it('processes a valid webhook and returns success', async () => {
      const event = makeWebhookEvent()
      const result = await service.processWebhook(
        event,
        'tenant-1',
        'user-1',
        REQUEST_URL,
      )
      expect(result.processed).toBe(true)
      expect(result.duplicate).toBe(false)
      expect(result.httpStatus).toBe(200)
      expect(result.eventId).toBe('evt_tw_001')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })

    it('returns 401 when signature verification fails', async () => {
      const event = makeWebhookEvent({ signature: 'invalid-base64-signature' })
      const result = await service.processWebhook(
        event,
        'tenant-1',
        'user-1',
        REQUEST_URL,
      )
      expect(result.processed).toBe(false)
      expect(result.duplicate).toBe(false)
      expect(result.httpStatus).toBe(401)
      expect(result.error).toBe('Signature verification failed')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
    })

    it('returns 401 when requestUrl is not provided (twilio requires it)', async () => {
      const event = makeWebhookEvent()
      const result = await service.processWebhook(event, 'tenant-1', 'user-1')
      expect(result.httpStatus).toBe(401)
      expect(result.processed).toBe(false)
    })

    it('returns 401 when signature does not match the requestUrl', async () => {
      const event = makeWebhookEvent()
      const result = await service.processWebhook(
        event,
        'tenant-1',
        'user-1',
        'https://wrong-url.example.com/webhook',
      )
      expect(result.httpStatus).toBe(401)
      expect(result.processed).toBe(false)
    })

    it('returns duplicate=true when event already processed', async () => {
      mockRedisGet.mockResolvedValueOnce('1') // duplicate
      const event = makeWebhookEvent()
      const result = await service.processWebhook(
        event,
        'tenant-1',
        'user-1',
        REQUEST_URL,
      )
      expect(result.processed).toBe(false)
      expect(result.duplicate).toBe(true)
      expect(result.httpStatus).toBe(200)
    })

    it('logs audit on signature failure with failure status', async () => {
      const event = makeWebhookEvent({ signature: 'bad' })
      await service.processWebhook(event, 'tenant-1', 'user-1', REQUEST_URL)
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'evt_tw_001',
        expect.objectContaining({
          status: 'failure',
          errorMessage: 'Webhook signature verification failed',
        }),
      )
    })

    it('logs audit on success with event type metadata', async () => {
      const event = makeWebhookEvent({ eventType: 'call.completed' })
      await service.processWebhook(event, 'tenant-1', 'user-1', REQUEST_URL)
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'evt_tw_001',
        expect.objectContaining({
          status: 'success',
          metadata: expect.objectContaining({
            eventType: 'call.completed',
            integrationSource: 'twilio',
          }),
        }),
      )
    })
  })
})
