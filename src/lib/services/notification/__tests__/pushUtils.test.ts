/* @vitest-environment node */
import { subtle } from 'crypto'

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest'

import type { MockInstance } from 'vitest'

import { buildVapidJwt, ExpiredSubscriptionError, sendNotification } from '../pushUtils'

const mockFetch = vi.fn<typeof fetch>()

const originalFetch = globalThis.fetch

describe('pushUtils', () => {
  let importKeySpy: MockInstance
  let signSpy: MockInstance

  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = mockFetch

    importKeySpy = vi.spyOn(subtle, 'importKey').mockResolvedValue({} as CryptoKey)
    signSpy = vi.spyOn(subtle, 'sign').mockResolvedValue(new ArrayBuffer(8))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  describe('buildVapidJwt', () => {
    const endpoint = 'https://push.example.com/push/123'

    const vapidKeys = {
      publicKey: 'mock-public-key',
      privateKey: 'bW9jay1wcml2YXRlLWtleQ==',
    }

    it('should build a JWT with correct typ/alg header', async () => {
      const jwt = await buildVapidJwt(endpoint, vapidKeys)
      const [header64] = jwt.split('.')
      expect(header64).toBeDefined()
      expect(JSON.parse(atob(header64!))).toEqual({ typ: 'JWT', alg: 'ES256' })
    })

    it('should include aud matching the endpoint origin', async () => {
      const jwt = await buildVapidJwt(endpoint, vapidKeys)
      const [, claims64] = jwt.split('.')
      const claims = JSON.parse(atob(claims64!))
      expect(claims.aud).toBe(new URL(endpoint).origin)
    })

    it('should include the provided sub claim', async () => {
      const jwt = await buildVapidJwt(endpoint, vapidKeys, {
        sub: 'mailto:test@example.com',
      })
      const [, claims64] = jwt.split('.')
      const claims = JSON.parse(atob(claims64!))
      expect(claims.sub).toBe('mailto:test@example.com')
    })

    it('should default sub to admin email', async () => {
      const jwt = await buildVapidJwt(endpoint, vapidKeys)
      const [, claims64] = jwt.split('.')
      const claims = JSON.parse(atob(claims64!))
      expect(claims.sub).toBe('mailto:admin@example.com')
    })

    it('should set exp ~12 hours from now by default', async () => {
      const beforeCall = Math.floor(Date.now() / 1000)
      const jwt = await buildVapidJwt(endpoint, vapidKeys)
      const afterCall = Math.floor(Date.now() / 1000)

      const [, claims64] = jwt.split('.')
      const claims = JSON.parse(atob(claims64!))
      expect(claims.exp).toBeGreaterThanOrEqual(beforeCall + 12 * 60 * 60)
      expect(claims.exp).toBeLessThanOrEqual(afterCall + 12 * 60 * 60)
    })

    it('should allow overriding the TTL', async () => {
      const beforeCall = Math.floor(Date.now() / 1000)
      const jwt = await buildVapidJwt(endpoint, vapidKeys, { ttlSeconds: 300 })
      const afterCall = Math.floor(Date.now() / 1000)

      const [, claims64] = jwt.split('.')
      const claims = JSON.parse(atob(claims64!))
      expect(claims.exp).toBeGreaterThanOrEqual(beforeCall + 300)
      expect(claims.exp).toBeLessThanOrEqual(afterCall + 300)
    })

    it('should use subtle.importKey and subtle.sign', async () => {
      await buildVapidJwt(endpoint, vapidKeys)

      expect(importKeySpy).toHaveBeenCalledOnce()
      expect(importKeySpy).toHaveBeenCalledWith(
        'pkcs8',
        expect.any(ArrayBuffer),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign'],
      )

      expect(signSpy).toHaveBeenCalledOnce()
      expect(signSpy).toHaveBeenCalledWith(
        { name: 'ECDSA', hash: 'SHA-256' },
        expect.anything(),
        expect.any(Uint8Array),
      )
    })

    it('should throw when the endpoint is an invalid URL', async () => {
      await expect(buildVapidJwt('not a valid url', vapidKeys)).rejects.toThrow()
    })

    it('should throw when the endpoint is missing a protocol', async () => {
      await expect(buildVapidJwt('push.example.com/push', vapidKeys)).rejects.toThrow()
    })

    it('should throw when the endpoint is an empty string', async () => {
      await expect(buildVapidJwt('', vapidKeys)).rejects.toThrow()
    })
  })

  describe('sendNotification', () => {
    const subscription = {
      endpoint: 'https://push.example.com/push/123',
      keys: {
        auth: 'auth-token',
        p256dh: 'p256dh-key',
      },
    }

    const payload = { title: 'Hello', body: 'World' }

    const vapidKeys = {
      publicKey: 'mock-public-key',
      privateKey: 'bW9jay1wcml2YXRlLWtleQ==', // base64 encoded 'mock-private-key'
    }

    it('should send a push notification with the correct headers and body', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 201, statusText: 'Created' }),
      )

      await sendNotification(subscription, payload, vapidKeys)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]

      expect(url).toBe(subscription.endpoint)
      expect(init?.method).toBe('POST')
      expect(init?.headers).toMatchObject({
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '43200',
        'Authorization': expect.stringContaining('vapid t=') as string,
      })

      const authHeader = (init!.headers as Record<string, string>)['Authorization']
      expect(authHeader).toContain(`k=${vapidKeys.publicKey}`)

      expect(init?.body).toBeInstanceOf(Uint8Array)

      expect(importKeySpy).toHaveBeenCalledOnce()
      expect(importKeySpy).toHaveBeenCalledWith(
        'pkcs8',
        expect.any(ArrayBuffer),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign'],
      )

      expect(signSpy).toHaveBeenCalledOnce()
      expect(signSpy).toHaveBeenCalledWith(
        { name: 'ECDSA', hash: 'SHA-256' },
        expect.anything(),
        expect.any(Uint8Array),
      )
    })

    it('should throw ExpiredSubscriptionError when the push service returns 404', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 404, statusText: 'Not Found' }),
      )

      await expect(
        sendNotification(subscription, payload, vapidKeys),
      ).rejects.toThrow(ExpiredSubscriptionError)
    })

    it('should throw ExpiredSubscriptionError when the push service returns 410', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 410, statusText: 'Gone' }),
      )

      await expect(
        sendNotification(subscription, payload, vapidKeys),
      ).rejects.toThrow(ExpiredSubscriptionError)
    })

    it('should throw a generic error for other non-ok responses', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 500, statusText: 'Internal Server Error' }),
      )

      await expect(
        sendNotification(subscription, payload, vapidKeys),
      ).rejects.toThrow('Failed to send push notification: 500 Internal Server Error')
    })

    it('should include the encoded payload in the request body', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 201, statusText: 'Created' }),
      )

      await sendNotification(subscription, payload, vapidKeys)

      const init = mockFetch.mock.calls[0][1] as RequestInit
      const body = init.body as Uint8Array
      const decoded = new TextDecoder().decode(body)

      expect(decoded).toBe(JSON.stringify(payload))
    })

    it('should include a valid VAPID JWT with correct aud, exp, and sub claims', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 201, statusText: 'Created' }),
      )

      const beforeCall = Math.floor(Date.now() / 1000)
      await sendNotification(subscription, payload, vapidKeys)
      const afterCall = Math.floor(Date.now() / 1000)

      const init = mockFetch.mock.calls[0][1] as RequestInit
      const authHeader = (init!.headers as Record<string, string>)['Authorization']
      const jwtMatch = authHeader.match(/vapid t=([^,]+),/)
      expect(jwtMatch).toBeTruthy()
      const jwt = jwtMatch![1]

      const [header64, claims64, signature64] = jwt.split('.')
      expect(header64).toBeDefined()
      expect(claims64).toBeDefined()
      expect(signature64).toBeDefined()

      const header = JSON.parse(atob(header64!))
      expect(header).toEqual({ typ: 'JWT', alg: 'ES256' })

      const claims = JSON.parse(atob(claims64!))
      expect(claims.aud).toBe(new URL(subscription.endpoint).origin)
      expect(claims.sub).toBe('mailto:admin@example.com')
      expect(claims.exp).toBeGreaterThanOrEqual(beforeCall + 12 * 60 * 60)
      expect(claims.exp).toBeLessThanOrEqual(afterCall + 12 * 60 * 60)
    })

    it('should throw when the subscription endpoint is an invalid URL', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 201, statusText: 'Created' }),
      )

      const invalidSubscription = {
        ...subscription,
        endpoint: 'not a valid url',
      }

      await expect(
        sendNotification(invalidSubscription, payload, vapidKeys),
      ).rejects.toThrow()
    })

    it('should throw when the subscription endpoint is missing a protocol', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 201, statusText: 'Created' }),
      )

      const missingProtocolSubscription = {
        ...subscription,
        endpoint: 'push.example.com/push/123',
      }

      await expect(
        sendNotification(missingProtocolSubscription, payload, vapidKeys),
      ).rejects.toThrow()
    })

    it('should throw when the subscription endpoint is an empty string', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 201, statusText: 'Created' }),
      )

      const emptyEndpointSubscription = {
        ...subscription,
        endpoint: '',
      }

      await expect(
        sendNotification(emptyEndpointSubscription, payload, vapidKeys),
      ).rejects.toThrow()
    })
  })
})
