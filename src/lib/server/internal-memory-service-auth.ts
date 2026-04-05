import { createHash, createHmac, randomUUID } from 'node:crypto'

export interface InternalMemoryServiceClientConfig {
  baseUrl: string
  actorId: string
  actorSecret: string
  timeoutMs?: number
}

export function resolveInternalMemoryServiceConfig(): InternalMemoryServiceClientConfig {
  const baseUrl =
    process.env.MEMORY_SERVICE_BASE_URL ||
    process.env.SUBCONSCIOUS_MEMORY_BASE_URL ||
    'http://127.0.0.1:54321'
  const actorId =
    process.env.MEMORY_SERVICE_ACTOR_ID ||
    process.env.SUBCONSCIOUS_MEMORY_ACTOR_ID
  const actorSecret =
    process.env.MEMORY_SERVICE_ACTOR_SECRET ||
    process.env.SUBCONSCIOUS_MEMORY_ACTOR_SECRET

  if (!actorId) {
    throw new Error(
      'MEMORY_SERVICE_ACTOR_ID or SUBCONSCIOUS_MEMORY_ACTOR_ID is required for product memory gateway access',
    )
  }

  if (!actorSecret) {
    throw new Error(
      'MEMORY_SERVICE_ACTOR_SECRET or SUBCONSCIOUS_MEMORY_ACTOR_SECRET is required for product memory gateway access',
    )
  }

  return {
    baseUrl,
    actorId,
    actorSecret,
    timeoutMs: Number(process.env.MEMORY_SERVICE_TIMEOUT_MS || 5000),
  }
}

export class MemoryServiceRequestSigner {
  constructor(
    private readonly actorId: string,
    private readonly actorSecret: string,
  ) {}

  signedHeaders({
    method,
    target,
    userId,
    body,
  }: {
    method: string
    target: string
    userId: string
    body: string
  }): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = randomUUID().replace(/-/g, '')
    const signature = createHmac('sha256', this.actorSecret)
      .update(
        canonicalRequest({
          actorId: this.actorId,
          userId,
          method,
          target,
          body,
          timestamp,
          nonce,
        }),
      )
      .digest('hex')

    return {
      'Content-Type': 'application/json',
      'X-Memory-Actor-Id': this.actorId,
      'X-Memory-User-Id': userId,
      'X-Memory-Timestamp': timestamp,
      'X-Memory-Nonce': nonce,
      'X-Memory-Signature': signature,
    }
  }
}

function canonicalRequest({
  actorId,
  userId,
  method,
  target,
  body,
  timestamp,
  nonce,
}: {
  actorId: string
  userId: string
  method: string
  target: string
  body: string
  timestamp: string
  nonce: string
}): string {
  const bodyHash = createHash('sha256').update(body).digest('hex')
  return [
    actorId,
    userId,
    method.toUpperCase(),
    target,
    bodyHash,
    timestamp,
    nonce,
  ].join('\n')
}
