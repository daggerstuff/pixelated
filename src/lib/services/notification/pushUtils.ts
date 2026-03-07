import { subtle } from 'crypto'
import { base64ToUint8Array, uint8ArrayToBase64 } from '@/lib/utils/encoding'

export interface PushSubscription {
  endpoint: string
  keys: {
    auth: string
    p256dh: string
  }
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

export async function sendNotification(
  subscription: PushSubscription,
  payload: Record<string, unknown>,
  vapidKeys: { publicKey: string; privateKey: string },
): Promise<void> {
  const encodedPayload = new TextEncoder().encode(JSON.stringify(payload))

  // Import VAPID keys
  const privateKey = await subtle.importKey(
    'pkcs8',
    base64ToUint8Array(vapidKeys.privateKey),
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['sign'],
  )

  // Generate signature
  const header = {
    typ: 'JWT',
    alg: 'ES256',
  }

  const now = Math.floor(Date.now() / 1000)
  const claims = {
    aud: new URL(subscription.endpoint).origin,
    exp: now + 12 * 60 * 60, // 12 hours from now
    sub: 'mailto:admin@example.com', // Replace with your email
  }

  const input = `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(claims))}`
  const signature = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(input),
  )

  const jwt = `${input}.${uint8ArrayToBase64(new Uint8Array(signature))}`

  // Send the push message
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
