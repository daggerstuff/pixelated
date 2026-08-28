/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock redis before importing the module under test
vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
}))

// Mock the EHR audit service and events
vi.mock('../audit/ehr-audit-service', () => {
  const mockLog = vi.fn().mockResolvedValue('audit-id-123')
  return {
    EHRAuditService: {
      getInstance: () => ({ log: mockLog }),
    },
  }
})

vi.mock('../audit/events', () => ({
  EHRAuditAction: {
    INTEGRATION_WEBHOOK_RECEIVED: 'integration_webhook_received',
  },
  EHRResourceType: {
    INTEGRATION: 'Integration',
  },
  EHRSeverity: {
    INTEGRATION: 'low',
    FAILED_ACCESS: 'medium',
  },
}))

import { redis } from '@/lib/redis'

import {
  verifyWebhookSignature,
  verifyStripeSignature,
  verifyZoomSignature,
  checkIdempotency,
  processWebhook,
  buildSignatureConfig,
  buildIdempotencyKey,
  computeHmacSha256,
  safeHexEqual,
} from '../webhooks'

import type { WebhookEvent, WebhookSignatureConfig } from '../types'

// ---------------------------------------------------------------------------
// computeHmacSha256
// ---------------------------------------------------------------------------

describe('computeHmacSha256', () => {
  it('computes a deterministic hex digest', () => {
    const sig = computeHmacSha256('hello', 'secret')
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces the same output for the same inputs', () => {
    expect(computeHmacSha256('body', 'key')).toBe(computeHmacSha256('body', 'key'))
  })

  it('produces different output for different data', () => {
    expect(computeHmacSha256('body1', 'key')).not.toBe(computeHmacSha256('body2', 'key'))
  })

  it('produces different output for different secrets', () => {
    expect(computeHmacSha256('body', 'key1')).not.toBe(computeHmacSha256('body', 'key2'))
  })

  it('handles empty data', () => {
    const sig = computeHmacSha256('', 'secret')
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it('handles unicode data', () => {
    const sig = computeHmacSha256('héllo 世界', 'secret')
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })
})

// ---------------------------------------------------------------------------
// safeHexEqual
// ---------------------------------------------------------------------------

describe('safeHexEqual', () => {
  it('returns true for identical hex strings', () => {
    const a = computeHmacSha256('data', 'secret')
    expect(safeHexEqual(a, a)).toBe(true)
  })

  it('returns false for different hex strings', () => {
    const a = computeHmacSha256('data1', 'secret')
    const b = computeHmacSha256('data2', 'secret')
    expect(safeHexEqual(a, b)).toBe(false)
  })

  it('returns false for different length inputs', () => {
    expect(safeHexEqual('aa', 'aabb')).toBe(false)
  })

  it('returns true for empty strings of same length', () => {
    expect(safeHexEqual('', '')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// buildIdempotencyKey
// ---------------------------------------------------------------------------

describe('buildIdempotencyKey', () => {
  it('builds a key with the correct prefix and format', () => {
    const key = buildIdempotencyKey('calendly', 'evt_123')
    expect(key).toBe('webhook:idempotency:calendly:evt_123')
  })

  it('includes the provider and eventId', () => {
    const key = buildIdempotencyKey('stripe', 'evt_abc')
    expect(key).toContain('stripe')
    expect(key).toContain('evt_abc')
  })
})

// ---------------------------------------------------------------------------
// buildSignatureConfig
// ---------------------------------------------------------------------------

describe('buildSignatureConfig', () => {
  it('builds calendly config with stripe-composite format', () => {
    const config = buildSignatureConfig('calendly', 'whsec_cal')
    expect(config.provider).toBe('calendly')
    expect(config.headerName).toBe('Calendly-Webhook-Signature')
    expect(config.algorithm).toBe('sha256')
    expect(config.secret).toBe('whsec_cal')
    expect(config.format).toBe('stripe-composite')
  })

  it('builds zoom config with hmac format', () => {
    const config = buildSignatureConfig('zoom', 'whsec_zoom')
    expect(config.provider).toBe('zoom')
    expect(config.headerName).toBe('x-zm-signature')
    expect(config.algorithm).toBe('sha256')
    expect(config.format).toBe('hmac')
  })

  it('builds stripe config with stripe-composite format', () => {
    const config = buildSignatureConfig('stripe', 'whsec_stripe')
    expect(config.provider).toBe('stripe')
    expect(config.headerName).toBe('Stripe-Signature')
    expect(config.algorithm).toBe('sha256')
    expect(config.format).toBe('stripe-composite')
  })

  it('builds twilio config with twilio format', () => {
    const config = buildSignatureConfig('twilio', 'whsec_twilio')
    expect(config.provider).toBe('twilio')
    expect(config.headerName).toBe('X-Twilio-Signature')
    expect(config.algorithm).toBe('sha256')
    expect(config.format).toBe('twilio')
  })
})

// ---------------------------------------------------------------------------
// verifyWebhookSignature — hmac format
// ---------------------------------------------------------------------------

describe('verifyWebhookSignature (hmac format)', () => {
  const secret = 'test-secret'
  const rawBody = '{"event":"test"}'

  it('returns true for a valid HMAC signature', () => {
    const expected = computeHmacSha256(rawBody, secret)
    const config: WebhookSignatureConfig = {
      provider: 'zoom',
      headerName: 'x-zm-signature',
      algorithm: 'sha256',
      secret,
      format: 'hmac',
    }
    expect(verifyWebhookSignature(config, rawBody, expected)).toBe(true)
  })

  it('returns false for an invalid HMAC signature', () => {
    const config: WebhookSignatureConfig = {
      provider: 'zoom',
      headerName: 'x-zm-signature',
      algorithm: 'sha256',
      secret,
      format: 'hmac',
    }
    expect(verifyWebhookSignature(config, rawBody, 'invalid-signature')).toBe(false)
  })

  it('returns false for a signature computed with a different secret', () => {
    const wrongSig = computeHmacSha256(rawBody, 'wrong-secret')
    const config: WebhookSignatureConfig = {
      provider: 'zoom',
      headerName: 'x-zm-signature',
      algorithm: 'sha256',
      secret,
      format: 'hmac',
    }
    expect(verifyWebhookSignature(config, rawBody, wrongSig)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// verifyWebhookSignature — stripe-composite format
// ---------------------------------------------------------------------------

describe('verifyWebhookSignature (stripe-composite format)', () => {
  const secret = 'whsec_stripe'
  const rawBody = '{"type":"payment_intent.succeeded"}'
  const timestamp = '1700000000'

  it('returns true for a valid composite signature', () => {
    const dataToSign = `${timestamp}.${rawBody}`
    const expected = computeHmacSha256(dataToSign, secret)
    const header = `t=${timestamp},v1=${expected}`
    const config: WebhookSignatureConfig = {
      provider: 'calendly',
      headerName: 'Calendly-Webhook-Signature',
      algorithm: 'sha256',
      secret,
      format: 'stripe-composite',
    }
    expect(verifyWebhookSignature(config, rawBody, header)).toBe(true)
  })

  it('returns false for an invalid signature value', () => {
    const header = `t=${timestamp},v1=invalid`
    const config: WebhookSignatureConfig = {
      provider: 'calendly',
      headerName: 'Calendly-Webhook-Signature',
      algorithm: 'sha256',
      secret,
      format: 'stripe-composite',
    }
    expect(verifyWebhookSignature(config, rawBody, header)).toBe(false)
  })

  it('returns false when timestamp is missing', () => {
    const header = `v1=somesig`
    const config: WebhookSignatureConfig = {
      provider: 'calendly',
      headerName: 'Calendly-Webhook-Signature',
      algorithm: 'sha256',
      secret,
      format: 'stripe-composite',
    }
    expect(verifyWebhookSignature(config, rawBody, header)).toBe(false)
  })

  it('returns false when v1 signature is missing', () => {
    const header = `t=${timestamp}`
    const config: WebhookSignatureConfig = {
      provider: 'calendly',
      headerName: 'Calendly-Webhook-Signature',
      algorithm: 'sha256',
      secret,
      format: 'stripe-composite',
    }
    expect(verifyWebhookSignature(config, rawBody, header)).toBe(false)
  })

  it('returns false for a wrong timestamp (different data to sign)', () => {
    const dataToSign = `${timestamp}.${rawBody}`
    const expected = computeHmacSha256(dataToSign, secret)
    const header = `t=9999999999,v1=${expected}`
    const config: WebhookSignatureConfig = {
      provider: 'calendly',
      headerName: 'Calendly-Webhook-Signature',
      algorithm: 'sha256',
      secret,
      format: 'stripe-composite',
    }
    expect(verifyWebhookSignature(config, rawBody, header)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// verifyWebhookSignature — twilio format
// ---------------------------------------------------------------------------

describe('verifyWebhookSignature (twilio format)', () => {
  const secret = 'twilio_secret'
  const requestUrl = 'https://example.com/webhook/twilio'
  const rawBody = 'Body=Hello&From=%2B1234567890'

  function makeTwilioSig(url: string, body: string, key: string): string {
    const params = new URLSearchParams(body)
    const sortedKeys = Array.from(params.keys()).sort()
    const postParams = sortedKeys.map((k) => `${k}${params.get(k) ?? ''}`).join('')
    const dataToSign = `${url}${postParams}`
    const expectedHex = computeHmacSha256(dataToSign, key)
    return Buffer.from(expectedHex, 'hex').toString('base64')
  }

  it('returns true for a valid base64 Twilio signature', () => {
    const sig = makeTwilioSig(requestUrl, rawBody, secret)
    const config: WebhookSignatureConfig = {
      provider: 'twilio',
      headerName: 'X-Twilio-Signature',
      algorithm: 'sha256',
      secret,
      format: 'twilio',
    }
    expect(verifyWebhookSignature(config, rawBody, sig, requestUrl)).toBe(true)
  })

  it('returns false for an invalid base64 signature', () => {
    const config: WebhookSignatureConfig = {
      provider: 'twilio',
      headerName: 'X-Twilio-Signature',
      algorithm: 'sha256',
      secret,
      format: 'twilio',
    }
    expect(verifyWebhookSignature(config, rawBody, 'not-valid-base64!!!', requestUrl)).toBe(false)
  })

  it('returns false when requestUrl is not provided', () => {
    const config: WebhookSignatureConfig = {
      provider: 'twilio',
      headerName: 'X-Twilio-Signature',
      algorithm: 'sha256',
      secret,
      format: 'twilio',
    }
    expect(verifyWebhookSignature(config, rawBody, 'sig')).toBe(false)
  })

  it('returns false for a signature computed with wrong secret', () => {
    const sig = makeTwilioSig(requestUrl, rawBody, 'wrong-secret')
    const config: WebhookSignatureConfig = {
      provider: 'twilio',
      headerName: 'X-Twilio-Signature',
      algorithm: 'sha256',
      secret,
      format: 'twilio',
    }
    expect(verifyWebhookSignature(config, rawBody, sig, requestUrl)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// verifyWebhookSignature — unknown format
// ---------------------------------------------------------------------------

describe('verifyWebhookSignature (unknown format)', () => {
  it('returns false for an unknown format', () => {
    const config = {
      provider: 'zoom',
      headerName: 'X-Foo',
      algorithm: 'sha256',
      secret: 's',
      format: 'unknown',
    } as unknown as WebhookSignatureConfig
    expect(verifyWebhookSignature(config, 'body', 'sig')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// verifyStripeSignature
// ---------------------------------------------------------------------------

describe('verifyStripeSignature', () => {
  const secret = 'whsec_stripe_123'
  const rawBody = '{"type":"charge.succeeded"}'
  const timestamp = '1700000000'

  it('returns true for a valid Stripe signature', () => {
    const dataToSign = `${timestamp}.${rawBody}`
    const expected = computeHmacSha256(dataToSign, secret)
    const header = `t=${timestamp},v1=${expected}`
    expect(verifyStripeSignature(secret, rawBody, header)).toBe(true)
  })

  it('returns false for an invalid signature', () => {
    const header = `t=${timestamp},v1=invalid`
    expect(verifyStripeSignature(secret, rawBody, header)).toBe(false)
  })

  it('returns false for a malformed header', () => {
    expect(verifyStripeSignature(secret, rawBody, 'malformed')).toBe(false)
  })

  it('returns false when timestamp is missing', () => {
    expect(verifyStripeSignature(secret, rawBody, 'v1=sig')).toBe(false)
  })

  it('returns false when v1 is missing', () => {
    expect(verifyStripeSignature(secret, rawBody, 't=123')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// verifyZoomSignature
// ---------------------------------------------------------------------------

describe('verifyZoomSignature', () => {
  const secret = 'zoom_webhook_secret'
  const rawBody = '{"event":"meeting.started"}'

  it('returns true for a valid Zoom signature', () => {
    const expected = computeHmacSha256(rawBody, secret)
    const header = `v0=${expected}`
    expect(verifyZoomSignature(secret, rawBody, header)).toBe(true)
  })

  it('returns false for an invalid signature', () => {
    const header = `v0=invalid`
    expect(verifyZoomSignature(secret, rawBody, header)).toBe(false)
  })

  it('returns false for a malformed header (no v0 prefix)', () => {
    expect(verifyZoomSignature(secret, rawBody, 'just-a-signature')).toBe(false)
  })

  it('returns false for empty header', () => {
    expect(verifyZoomSignature(secret, rawBody, '')).toBe(false)
  })

  it('returns false for wrong secret', () => {
    const expected = computeHmacSha256(rawBody, 'wrong-secret')
    const header = `v0=${expected}`
    expect(verifyZoomSignature(secret, rawBody, header)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// checkIdempotency
// ---------------------------------------------------------------------------

describe('checkIdempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(redis.setex).mockResolvedValue('OK')
  })

  it('returns false (not duplicate) when key does not exist in Redis', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)

    const isDuplicate = await checkIdempotency('calendly', 'evt_new')
    expect(isDuplicate).toBe(false)
    expect(redis.get).toHaveBeenCalledWith('webhook:idempotency:calendly:evt_new')
    expect(redis.setex).toHaveBeenCalledWith(
      'webhook:idempotency:calendly:evt_new',
      86_400,
      '1',
    )
  })

  it('returns true (duplicate) when key already exists in Redis', async () => {
    vi.mocked(redis.get).mockResolvedValue('1')

    const isDuplicate = await checkIdempotency('stripe', 'evt_dup')
    expect(isDuplicate).toBe(true)
    expect(redis.get).toHaveBeenCalledWith('webhook:idempotency:stripe:evt_dup')
    expect(redis.setex).not.toHaveBeenCalled()
  })

  it('uses the correct TTL of 86400 seconds', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)

    await checkIdempotency('zoom', 'evt_ttl')
    const callArgs = vi.mocked(redis.setex).mock.calls[0]
    const ttl = callArgs[1]
    expect(ttl).toBe(86_400)
  })
})

// ---------------------------------------------------------------------------
// processWebhook
// ---------------------------------------------------------------------------

describe('processWebhook', () => {
  const tenantId = 'tenant-1'
  const userId = 'user-1'
  const secret = 'whsec_test'
  const rawBody = '{"event":"test"}'
  const validSig = computeHmacSha256(rawBody, secret)

  const baseEvent: WebhookEvent = {
    provider: 'zoom',
    eventId: 'evt_proc_1',
    eventType: 'meeting.started',
    payload: { data: 'test' },
    signature: validSig,
    receivedAt: '2025-01-15T10:00:00Z',
    rawBody,
  }

  const hmacConfig: WebhookSignatureConfig = {
    provider: 'zoom',
    headerName: 'x-zm-signature',
    algorithm: 'sha256',
    secret,
    format: 'hmac',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(redis.get).mockResolvedValue(null)
    vi.mocked(redis.setex).mockResolvedValue('OK')
  })

  it('processes a valid, non-duplicate webhook successfully', async () => {
    const result = await processWebhook(baseEvent, hmacConfig, tenantId, userId)

    expect(result.processed).toBe(true)
    expect(result.eventId).toBe('evt_proc_1')
    expect(result.duplicate).toBe(false)
    expect(result.httpStatus).toBe(200)
    expect(result.error).toBeUndefined()
  })

  it('rejects a webhook with an invalid signature (401)', async () => {
    const event: WebhookEvent = {
      ...baseEvent,
      signature: 'invalid-signature',
    }
    const result = await processWebhook(event, hmacConfig, tenantId, userId)

    expect(result.processed).toBe(false)
    expect(result.duplicate).toBe(false)
    expect(result.httpStatus).toBe(401)
    expect(result.error).toBe('Invalid signature')
  })

  it('skips a duplicate webhook (200, duplicate=true)', async () => {
    vi.mocked(redis.get).mockResolvedValue('1')

    const result = await processWebhook(baseEvent, hmacConfig, tenantId, userId)

    expect(result.processed).toBe(false)
    expect(result.duplicate).toBe(true)
    expect(result.httpStatus).toBe(200)
  })

  it('does not check idempotency when signature is invalid', async () => {
    const event: WebhookEvent = {
      ...baseEvent,
      signature: 'bad-sig',
    }
    await processWebhook(event, hmacConfig, tenantId, userId)

    expect(redis.get).not.toHaveBeenCalled()
  })

  it('passes requestUrl to signature verification for twilio', async () => {
    const twilioSecret = 'twilio_secret'
    const url = 'https://example.com/webhook/twilio'
    const twilioBody = 'Body=hi&From=%2B1234567890'
    const params = new URLSearchParams(twilioBody)
    const sortedKeys = Array.from(params.keys()).sort()
    const postParams = sortedKeys.map((k) => `${k}${params.get(k) ?? ''}`).join('')
    const dataToSign = `${url}${postParams}`
    const expectedHex = computeHmacSha256(dataToSign, twilioSecret)
    const expectedBase64 = Buffer.from(expectedHex, 'hex').toString('base64')

    const twilioEvent: WebhookEvent = {
      provider: 'twilio',
      eventId: 'evt_tw_1',
      eventType: 'message.received',
      payload: {},
      signature: expectedBase64,
      receivedAt: '2025-01-15T10:00:00Z',
      rawBody: twilioBody,
    }
    const twilioConfig: WebhookSignatureConfig = {
      provider: 'twilio',
      headerName: 'X-Twilio-Signature',
      algorithm: 'sha256',
      secret: twilioSecret,
      format: 'twilio',
    }

    const result = await processWebhook(twilioEvent, twilioConfig, tenantId, userId, url)
    expect(result.processed).toBe(true)
  })

  it('rejects twilio webhook when requestUrl is missing', async () => {
    const twilioConfig: WebhookSignatureConfig = {
      provider: 'twilio',
      headerName: 'X-Twilio-Signature',
      algorithm: 'sha256',
      secret: 'twilio_secret',
      format: 'twilio',
    }
    const twilioEvent: WebhookEvent = {
      ...baseEvent,
      provider: 'twilio',
      signature: 'some-sig',
    }

    const result = await processWebhook(twilioEvent, twilioConfig, tenantId, userId)
    expect(result.processed).toBe(false)
    expect(result.httpStatus).toBe(401)
  })

  it('processes a valid stripe-composite webhook', async () => {
    const stripeSecret = 'whsec_stripe'
    const stripeBody = '{"type":"payment_intent.succeeded"}'
    const timestamp = '1700000000'
    const dataToSign = `${timestamp}.${stripeBody}`
    const expected = computeHmacSha256(dataToSign, stripeSecret)
    const header = `t=${timestamp},v1=${expected}`

    const stripeEvent: WebhookEvent = {
      provider: 'stripe',
      eventId: 'evt_stripe_1',
      eventType: 'payment_intent.succeeded',
      payload: {},
      signature: header,
      receivedAt: '2025-01-15T10:00:00Z',
      rawBody: stripeBody,
    }
    const stripeConfig: WebhookSignatureConfig = {
      provider: 'stripe',
      headerName: 'Stripe-Signature',
      algorithm: 'sha256',
      secret: stripeSecret,
      format: 'stripe-composite',
    }

    const result = await processWebhook(stripeEvent, stripeConfig, tenantId, userId)
    expect(result.processed).toBe(true)
    expect(result.httpStatus).toBe(200)
  })
})
