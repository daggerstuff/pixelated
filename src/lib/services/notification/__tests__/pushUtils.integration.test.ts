/* @vitest-environment node */
import { http } from 'msw'
import { setupServer } from 'msw/node'

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
} from 'vitest'

import {
  ExpiredSubscriptionError,
  generateVAPIDKeys,
  sendNotification,
} from '../pushUtils'

const endpoint = 'https://push.example.com/push/123'

const subscription = {
  endpoint,
  keys: {
    auth: 'auth-token',
    p256dh: 'p256dh-key',
  },
}

const payload = { title: 'Hello', body: 'World' }

let vapidKeys: Awaited<ReturnType<typeof generateVAPIDKeys>>

let lastRequest: Request | null = null

const server = setupServer(
  http.post(`${endpoint}`, async ({ request }) => {
    lastRequest = request
    return new Response(null, { status: 201, statusText: 'Created' })
  }),
)

describe('sendNotification integration (MSW)', () => {
  beforeAll(async () => {
    vapidKeys = await generateVAPIDKeys()
    server.listen({ onUnhandledRequest: 'error' })
  })

  beforeEach(() => {
    lastRequest = null
  })

  afterEach(() => {
    server.resetHandlers()
    lastRequest = null
  })

  afterAll(() => {
    server.close()
  })

  it('should POST to the push service endpoint and return on 201', async () => {
    await expect(
      sendNotification(subscription, payload, vapidKeys),
    ).resolves.toBeUndefined()

    expect(lastRequest).toBeTruthy()
    expect(lastRequest!.url).toBe(endpoint)
    expect(lastRequest!.method).toBe('POST')
  })

  it('should send the encoded payload in the request body', async () => {
    await sendNotification(subscription, payload, vapidKeys)

    expect(lastRequest).toBeTruthy()
    const body = await lastRequest!.arrayBuffer()
    const decoded = new TextDecoder().decode(body)

    expect(decoded).toBe(JSON.stringify(payload))
  })

  it('should include required push headers', async () => {
    await sendNotification(subscription, payload, vapidKeys)

    expect(lastRequest).toBeTruthy()
    expect(lastRequest!.headers.get('Content-Type')).toBe('application/octet-stream')
    expect(lastRequest!.headers.get('Content-Encoding')).toBe('aes128gcm')
    expect(lastRequest!.headers.get('TTL')).toBe('43200')
  })

  it('should include a valid VAPID Authorization header', async () => {
    await sendNotification(subscription, payload, vapidKeys)

    const authHeader = lastRequest!.headers.get('Authorization')
    expect(authHeader).toMatch(/^vapid t=.+?, k=.+$/)

    const jwtMatch = authHeader!.match(/vapid t=([^,]+), k=([^,]+)/)
    expect(jwtMatch).toBeTruthy()
    const jwt = jwtMatch![1]
    const publicKey = jwtMatch![2]

    expect(publicKey).toBe(vapidKeys.publicKey)

    const [, claims64] = jwt.split('.')
    const claims = JSON.parse(atob(claims64!))
    expect(claims.aud).toBe(new URL(endpoint).origin)
    expect(claims.sub).toBe('mailto:admin@example.com')
  })

  it('should throw ExpiredSubscriptionError when the push service returns 404', async () => {
    server.use(
      http.post(endpoint, () => {
        return new Response(null, { status: 404, statusText: 'Not Found' })
      }),
    )

    await expect(
      sendNotification(subscription, payload, vapidKeys),
    ).rejects.toThrow(ExpiredSubscriptionError)
  })

  it('should throw ExpiredSubscriptionError when the push service returns 410', async () => {
    server.use(
      http.post(endpoint, () => {
        return new Response(null, { status: 410, statusText: 'Gone' })
      }),
    )

    await expect(
      sendNotification(subscription, payload, vapidKeys),
    ).rejects.toThrow(ExpiredSubscriptionError)
  })

  it('should throw a generic error for other non-ok responses', async () => {
    server.use(
      http.post(endpoint, () => {
        return new Response(null, {
          status: 500,
          statusText: 'Internal Server Error',
        })
      }),
    )

    await expect(
      sendNotification(subscription, payload, vapidKeys),
    ).rejects.toThrow('Failed to send push notification: 500 Internal Server Error')
  })

  it('should propagate errors when the push service is unreachable', async () => {
    server.use(
      http.post(endpoint, () => {
        return Response.error()
      }),
    )

    await expect(
      sendNotification(subscription, payload, vapidKeys),
    ).rejects.toThrow()
  })
})
