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

import { ExpiredSubscriptionError, sendNotification } from '../pushUtils'

const mockFetch = vi.fn<typeof fetch>()

const originalFetch = globalThis.fetch

describe('pushUtils', () => {
  let importKeySpy: ReturnType<typeof vi.spyOn<typeof subtle, 'importKey'>>
  let signSpy: ReturnType<typeof vi.spyOn<typeof subtle, 'sign'>>

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
  })
})
