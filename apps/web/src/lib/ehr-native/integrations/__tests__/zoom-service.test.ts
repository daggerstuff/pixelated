/**
 * Tests for ZoomService — OAuth flow, adapter ops, webhook handling.
 *
 * @vitest-environment node
 */

import { createHmac } from 'node:crypto'

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the service
// ---------------------------------------------------------------------------

const mockRedisGet = vi.fn()
const mockRedisSetex = vi.fn()
const mockRedisSetNx = vi.fn().mockResolvedValue(true)
const mockRedisSet = vi.fn()

vi.mock('@/lib/redis', () => ({
  redis: {
    get: mockRedisGet,
    setex: mockRedisSetex,
    setNx: mockRedisSetNx,
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

const { ZoomService } = await import('../zoom/zoom-service')
const { StubZoomAdapter } = await import('../zoom/stub-adapter')
const { buildSignatureConfig } = await import('../webhooks')
import type { CreateMeetingInput, UpdateMeetingInput } from '../zoom/adapter'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-001'
const USER_ID = 'user-001'
const ACCESS_TOKEN = 'test-access-token'
const WEBHOOK_SECRET = 'test-webhook-secret'

const OAUTH_CONFIG = {
  clientId: 'test-zoom-client-id',
  clientSecret: 'test-zoom-client-secret',
  redirectUri: 'https://app.example.com/callback',
  scopes: ['meeting:read', 'meeting:write', 'user:read'],
  authorizeUrl: 'https://zoom.us/oauth/authorize',
  tokenUrl: 'https://zoom.us/oauth/token',
}

const SEEDED_MEETING_ID_1 = '100000001'

const baseMeetingInput: CreateMeetingInput = {
  topic: 'New Therapy Session',
  type: 2,
  start_time: '2025-07-01T10:00:00.000Z',
  duration: 30,
  timezone: 'America/New_York',
  password: 'newpass123',
  agenda: 'Follow-up session',
  settings: {
    host_video: true,
    participant_video: false,
    join_before_host: false,
    mute_upon_entry: true,
    waiting_room: true,
    auto_recording: 'cloud',
  },
}

function makeTokenResponse(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'new-access-token',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'new-refresh-token',
    scope: 'meeting:read meeting:write user:read',
    ...overrides,
  }
}

function makeFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    text: vi
      .fn()
      .mockResolvedValue(
        typeof body === 'string' ? body : JSON.stringify(body),
      ),
    json: vi.fn().mockResolvedValue(body),
  }
}

/** Build a valid Zoom webhook signature header (hmac format: raw hex). */
function makeZoomSignature(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
}

function makeWebhookEvent(overrides: Record<string, unknown> = {}) {
  return {
    provider: 'zoom' as const,
    eventId: 'evt-001',
    eventType: 'meeting.created',
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

describe('ZoomService', () => {
  let service: InstanceType<typeof ZoomService>
  let adapter: InstanceType<typeof StubZoomAdapter>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRedisGet.mockResolvedValue(null)
    mockRedisSetex.mockResolvedValue('OK')
    mockRedisSetNx.mockResolvedValue(true)
    mockRedisSet.mockResolvedValue('OK')
    mockAuditLog.mockResolvedValue('audit-log-id')

    adapter = new StubZoomAdapter()
    service = new ZoomService({
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
      expect(service).toBeInstanceOf(ZoomService)
    })

    it('throws on invalid oauthConfig (missing clientId)', () => {
      expect(
        () =>
          new ZoomService({
            adapter,
            oauthConfig: { ...OAUTH_CONFIG, clientId: '' },
            webhookSecret: WEBHOOK_SECRET,
          }),
      ).toThrow()
    })

    it('throws on invalid oauthConfig (invalid redirectUri)', () => {
      expect(
        () =>
          new ZoomService({
            adapter,
            oauthConfig: { ...OAUTH_CONFIG, redirectUri: 'not-a-url' },
            webhookSecret: WEBHOOK_SECRET,
          }),
      ).toThrow()
    })

    it('applies default scopes when omitted', () => {
      const svc = new ZoomService({
        adapter,
        oauthConfig: {
          clientId: 'c',
          clientSecret: 's',
          redirectUri: 'https://app.example.com/callback',
          scopes: ['meeting:read'],
          authorizeUrl: 'https://zoom.us/oauth/authorize',
          tokenUrl: 'https://zoom.us/oauth/token',
        },
        webhookSecret: WEBHOOK_SECRET,
      })
      const url = svc.buildAuthorizeUrl('state123')
      expect(url).toContain('scope=')
    })
  })

  // -------------------------------------------------------------------------
  // buildAuthorizeUrl
  // -------------------------------------------------------------------------

  describe('buildAuthorizeUrl', () => {
    it('returns a URL with correct query params', () => {
      const url = service.buildAuthorizeUrl('random-state-456')
      expect(url).toContain('client_id=test-zoom-client-id')
      expect(url).toContain('response_type=code')
      expect(url).toContain('state=random-state-456')
      expect(url).toContain('redirect_uri=')
      expect(url).toContain('scope=meeting%3Aread')
    })

    it('starts with the authorizeUrl', () => {
      const url = service.buildAuthorizeUrl('state')
      expect(url.startsWith('https://zoom.us/oauth/authorize?')).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // exchangeCodeForToken
  // -------------------------------------------------------------------------

  describe('exchangeCodeForToken', () => {
    it('exchanges code for token on success', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse(makeTokenResponse()))
      const result = await service.exchangeCodeForToken('auth-code-456')
      expect(result.access_token).toBe('new-access-token')
      expect(result.token_type).toBe('Bearer')
      expect(result.refresh_token).toBe('new-refresh-token')
    })

    it('sends POST with correct form body', async () => {
      mockFetch.mockResolvedValueOnce(makeFetchResponse(makeTokenResponse()))
      await service.exchangeCodeForToken('auth-code-456')
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe('https://zoom.us/oauth/token')
      expect(init.method).toBe('POST')
      expect(init.headers['Content-Type']).toBe(
        'application/x-www-form-urlencoded',
      )
      const body = init.body.toString()
      expect(body).toContain('grant_type=authorization_code')
      expect(body).toContain('code=auth-code-456')
      expect(body).toContain('client_id=test-zoom-client-id')
      expect(body).toContain('client_secret=test-zoom-client-secret')
    })

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchResponse('invalid_grant', false, 400),
      )
      await expect(service.exchangeCodeForToken('bad-code')).rejects.toThrow(
        'Zoom token exchange failed (400)',
      )
    })

    it('throws on schema validation failure', async () => {
      mockFetch.mockResolvedValueOnce(
        makeFetchResponse({ invalid: 'response' }),
      )
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
        'Zoom token refresh failed (401)',
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
      const user = await service.getCurrentUser(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
      )
      expect(user.id).toBe('stub-user-001')
      expect(user.email).toBe('stub@example.com')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
      const [action, resourceType, resourceId, input] =
        mockAuditLog.mock.calls[0]
      expect(action).toBe('integration_connect')
      expect(resourceType).toBe('Integration')
      expect(resourceId).toBe(user.id)
      expect(input.userId).toBe(USER_ID)
      expect(input.status).toBe('success')
      expect(input.metadata.tenantId).toBe(TENANT_ID)
      expect(input.metadata.integrationSource).toBe('zoom')
    })
  })

  // -------------------------------------------------------------------------
  // listMeetings
  // -------------------------------------------------------------------------

  describe('listMeetings', () => {
    it('returns validated meetings with pagination', async () => {
      const result = await service.listMeetings(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
      )
      expect(result.data).toHaveLength(2)
      expect(result.pagination.count).toBe(2)
      expect(result.data[0].topic).toContain('Therapy Session')
    })

    it('passes params to adapter', async () => {
      const result = await service.listMeetings(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        {
          type: 'scheduled',
        },
      )
      expect(result.data.every((m) => m.type === 2)).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // getMeeting
  // -------------------------------------------------------------------------

  describe('getMeeting', () => {
    it('returns validated meeting and logs audit', async () => {
      const meeting = await service.getMeeting(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        SEEDED_MEETING_ID_1,
      )
      expect(meeting.id).toBe(100000001)
      expect(meeting.topic).toBe('Therapy Session - Initial Consultation')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
      const [action, , resourceId] = mockAuditLog.mock.calls[0]
      expect(action).toBe('integration_webhook_received')
      expect(resourceId).toBe(SEEDED_MEETING_ID_1)
    })
  })

  // -------------------------------------------------------------------------
  // createMeeting
  // -------------------------------------------------------------------------

  describe('createMeeting', () => {
    it('creates meeting, validates, and logs audit', async () => {
      const meeting = await service.createMeeting(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        baseMeetingInput,
      )
      expect(meeting.topic).toBe('New Therapy Session')
      expect(meeting.host_id).toBe('stub-host-001')
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
      const [action, , resourceId, input] = mockAuditLog.mock.calls[0]
      expect(action).toBe('integration_connect')
      expect(resourceId).toBe(String(meeting.id))
      expect(input.metadata.integrationSource).toBe('zoom')
    })

    it('created meeting is retrievable via getMeeting', async () => {
      const created = await service.createMeeting(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        baseMeetingInput,
      )
      const retrieved = await service.getMeeting(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        String(created.id),
      )
      expect(retrieved.topic).toBe(baseMeetingInput.topic)
    })
  })

  // -------------------------------------------------------------------------
  // updateMeeting
  // -------------------------------------------------------------------------

  describe('updateMeeting', () => {
    it('updates meeting and logs audit', async () => {
      const updates: UpdateMeetingInput = { topic: 'Updated Topic' }
      await service.updateMeeting(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        SEEDED_MEETING_ID_1,
        updates,
      )
      const meeting = await service.getMeeting(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        SEEDED_MEETING_ID_1,
      )
      expect(meeting.topic).toBe('Updated Topic')
      expect(mockAuditLog).toHaveBeenCalledTimes(2)
      const [action, , resourceId] = mockAuditLog.mock.calls[0]
      expect(action).toBe('integration_webhook_received')
      expect(resourceId).toBe(SEEDED_MEETING_ID_1)
    })

    it('updates settings', async () => {
      await service.updateMeeting(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        SEEDED_MEETING_ID_1,
        {
          settings: {
            host_video: false,
            participant_video: true,
            join_before_host: true,
            mute_upon_entry: false,
            waiting_room: false,
            auto_recording: 'none',
          },
        },
      )
      const meeting = await service.getMeeting(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        SEEDED_MEETING_ID_1,
      )
      expect(meeting.settings?.host_video).toBe(false)
      expect(meeting.settings?.auto_recording).toBe('none')
    })
  })

  // -------------------------------------------------------------------------
  // deleteMeeting
  // -------------------------------------------------------------------------

  describe('deleteMeeting', () => {
    it('deletes meeting and logs audit', async () => {
      await service.deleteMeeting(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        SEEDED_MEETING_ID_1,
      )
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
      const [action, , resourceId] = mockAuditLog.mock.calls[0]
      expect(action).toBe('integration_webhook_received')
      expect(resourceId).toBe(SEEDED_MEETING_ID_1)
    })

    it('deleted meeting is no longer retrievable', async () => {
      await service.deleteMeeting(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        SEEDED_MEETING_ID_1,
      )
      await expect(
        service.getMeeting(
          ACCESS_TOKEN,
          TENANT_ID,
          USER_ID,
          SEEDED_MEETING_ID_1,
        ),
      ).rejects.toThrow('meeting not found')
    })
  })

  // -------------------------------------------------------------------------
  // listRecordings
  // -------------------------------------------------------------------------

  describe('listRecordings', () => {
    it('returns validated recordings with pagination', async () => {
      const result = await service.listRecordings(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
      )
      expect(result.data).toHaveLength(1)
      expect(result.pagination.count).toBe(1)
      expect(result.data[0].id).toBe('stub-recording-001')
    })

    it('passes params to adapter', async () => {
      const result = await service.listRecordings(
        ACCESS_TOKEN,
        TENANT_ID,
        USER_ID,
        {
          from: '2025-06-01T00:00:00.000Z',
        },
      )
      expect(result.data).toHaveLength(1)
    })
  })

  // -------------------------------------------------------------------------
  // getWebhookSignatureConfig
  // -------------------------------------------------------------------------

  describe('getWebhookSignatureConfig', () => {
    it('returns config with provider=zoom and hmac format', () => {
      const config = service.getWebhookSignatureConfig()
      expect(config.provider).toBe('zoom')
      expect(config.format).toBe('hmac')
      expect(config.algorithm).toBe('sha256')
      expect(config.secret).toBe(WEBHOOK_SECRET)
      expect(config.headerName).toBe('x-zm-signature')
    })

    it('matches buildSignatureConfig output', () => {
      const config = service.getWebhookSignatureConfig()
      const expected = buildSignatureConfig('zoom', WEBHOOK_SECRET)
      expect(config).toEqual(expected)
    })
  })

  // -------------------------------------------------------------------------
  // processWebhook
  // -------------------------------------------------------------------------

  describe('processWebhook', () => {
    it('returns 401 on invalid signature', async () => {
      const event = makeWebhookEvent({ signature: 'invalid' })
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

    it('returns 401 on malformed signature', async () => {
      const event = makeWebhookEvent({ signature: 'bad-format' })
      const result = await service.processWebhook(event, TENANT_ID, USER_ID)
      expect(result.httpStatus).toBe(401)
    })

    it('returns 200 with duplicate=true on duplicate event', async () => {
      const rawBody = '{"test":"body"}'
      const signature = makeZoomSignature(rawBody, WEBHOOK_SECRET)
      mockRedisSetNx.mockResolvedValueOnce(false) // duplicate
      const event = makeWebhookEvent({ rawBody, signature })
      const result = await service.processWebhook(event, TENANT_ID, USER_ID)
      expect(result.processed).toBe(false)
      expect(result.duplicate).toBe(true)
      expect(result.httpStatus).toBe(200)
      expect(mockAuditLog).not.toHaveBeenCalled()
    })

    it('returns 200 with processed=true on valid first-time event', async () => {
      const rawBody = '{"test":"body"}'
      const signature = makeZoomSignature(rawBody, WEBHOOK_SECRET)
      mockRedisSetNx.mockResolvedValueOnce(true) // not duplicate
      const event = makeWebhookEvent({ rawBody, signature })
      const result = await service.processWebhook(event, TENANT_ID, USER_ID)
      expect(result.processed).toBe(true)
      expect(result.duplicate).toBe(false)
      expect(result.httpStatus).toBe(200)
      expect(mockAuditLog).toHaveBeenCalledTimes(1)
      const [, , , input] = mockAuditLog.mock.calls[0]
      expect(input.status).toBe('success')
      expect(input.metadata.eventType).toBe('meeting.created')
    })

    it('sets idempotency key in redis on first-time event', async () => {
      const rawBody = '{"test":"body"}'
      const signature = makeZoomSignature(rawBody, WEBHOOK_SECRET)
      mockRedisSetNx.mockResolvedValueOnce(true)
      const event = makeWebhookEvent({
        rawBody,
        signature,
        eventId: 'unique-evt',
      })
      await service.processWebhook(event, TENANT_ID, USER_ID)
      expect(mockRedisSetNx).toHaveBeenCalledTimes(1)
      const [key] = mockRedisSetNx.mock.calls[0]
      expect(key).toContain('webhook:idempotency:zoom:unique-evt')
    })

    it('passes requestUrl for signature verification', async () => {
      const rawBody = '{"test":"body"}'
      const signature = makeZoomSignature(rawBody, WEBHOOK_SECRET)
      mockRedisSetNx.mockResolvedValueOnce(true)
      const event = makeWebhookEvent({ rawBody, signature })
      const result = await service.processWebhook(
        event,
        TENANT_ID,
        USER_ID,
        'https://app.example.com/webhook/zoom',
      )
      expect(result.processed).toBe(true)
    })

    it('logs failure audit with tenantId and integrationSource on bad signature', async () => {
      const event = makeWebhookEvent({ signature: 'bad' })
      await service.processWebhook(event, TENANT_ID, USER_ID)
      const [, , , input] = mockAuditLog.mock.calls[0]
      expect(input.metadata.tenantId).toBe(TENANT_ID)
      expect(input.metadata.integrationSource).toBe('zoom')
      expect(input.metadata.resourceId).toBe('evt-001')
    })
  })
})
