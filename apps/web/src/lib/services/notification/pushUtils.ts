import { subtle } from 'crypto'

import { base64ToUint8Array, uint8ArrayToBase64 } from '../../utils/encoding'

export interface PushSubscription {
  endpoint: string
  keys: {
    auth: string
    p256dh: string
  }
}

export interface VapidJwtOptions {
  /** Subscriber email. Defaults to `mailto:admin@example.com`. */
  sub?: string
  /** TTL in seconds. Defaults to 12 hours (43200). */
  ttlSeconds?: number
}

export class ExpiredSubscriptionError extends Error {
  constructor(message = 'Push subscription has expired') {
    super(message)
    this.name = 'ExpiredSubscriptionError'
  }
}

export async function generateVAPIDKeys(): Promise<{
  publicKey: string
  privateKey: string
}> {
  const keyPair = await subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify'],
  )

  const publicKey = await subtle.exportKey('raw', keyPair.publicKey)
  const privateKey = await subtle.exportKey('pkcs8', keyPair.privateKey)

  return {
    publicKey: uint8ArrayToBase64(new Uint8Array(publicKey)),
    privateKey: uint8ArrayToBase64(new Uint8Array(privateKey)),
  }
}

export async function buildVapidJwt(
  endpoint: string,
  vapidKeys: { privateKey: string },
  options: VapidJwtOptions = {},
): Promise<string> {
  const { sub = 'mailto:admin@example.com', ttlSeconds = 12 * 60 * 60 } =
    options

  // Import VAPID private key
  const privateKeyData = base64ToUint8Array(vapidKeys.privateKey)
    .buffer as ArrayBuffer
  const privateKey = await subtle.importKey(
    'pkcs8',
    privateKeyData,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['sign'],
  )

  // Build JWT
  const header = {
    typ: 'JWT',
    alg: 'ES256',
  }

  const now = Math.floor(Date.now() / 1000)
  const claims = {
    aud: new URL(endpoint).origin,
    exp: now + ttlSeconds,
    sub,
  }

  const input = `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(claims))}`
  const signature = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(input),
  )

  return `${input}.${uint8ArrayToBase64(new Uint8Array(signature))}`
}

export async function sendNotification(
  subscription: PushSubscription,
  payload: Record<string, unknown>,
  vapidKeys: { publicKey: string; privateKey: string },
): Promise<void> {
  const encodedPayload = new TextEncoder().encode(JSON.stringify(payload))

  // Build VAPID JWT and send the push message
  const jwt = await buildVapidJwt(subscription.endpoint, vapidKeys)

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Authorization': `vapid t=${jwt}, k=${vapidKeys.publicKey}`,
      'TTL': '43200', // 12 hours in seconds
    },
    body: encodedPayload,
  })

  if (response.status === 404 || response.status === 410) {
    throw new ExpiredSubscriptionError()
  }

  if (!response.ok) {
    throw new Error(
      `Failed to send push notification: ${response.status} ${response.statusText}`,
    )
  }
}
