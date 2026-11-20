/**
 * Eve session client — creates a session on an Eve agent and streams
 * the NDJSON response to collect the final assistant message.
 *
 * Eve agents expose:
 *   POST /eve/v1/session          → { ok, sessionId, status }
 *   GET  /eve/v1/session/:id/stream → NDJSON stream of events
 *
 * The stream emits events with a `type` field. Key types:
 *   session.started    — session initialised
 *   turn.started       — turn begins
 *   message.received   — user message echoed back
 *   step.completed     — an LLM step finished (may have tool-calls)
 *   message.completed  — assistant message finished (has `message` field)
 *   turn.completed     — turn done
 *   session.waiting    — waiting for next user message (terminal)
 */

export interface EveSessionOptions {
  endpoint: string
  message: string
  timeoutMs: number
  authHeader?: string
}

export interface EveSessionResult {
  sessionId: string
  message: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
  }
}

interface EveEvent {
  data: Record<string, unknown>
  type: string
  meta?: Record<string, unknown>
}

export class EveSessionError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string,
  ) {
    super(message)
    this.name = 'EveSessionError'
  }
}

export async function createEveSession(
  options: EveSessionOptions,
): Promise<{ sessionId: string }> {
  const url = `${options.endpoint.replace(/\/$/, '')}/eve/v1/session`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs)

  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    }
    if (options.authHeader) {
      headers['authorization'] = options.authHeader
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: options.message }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new EveSessionError(
        `session creation failed (${res.status} ${res.statusText}): ${text}`,
        res.status,
        options.endpoint,
      )
    }

    const data = (await res.json()) as {
      ok: boolean
      sessionId: string
      status: string
    }

    if (!data.ok || !data.sessionId) {
      throw new EveSessionError(
        `session creation returned unexpected response: ${JSON.stringify(data)}`,
        res.status,
        options.endpoint,
      )
    }

    return { sessionId: data.sessionId }
  } finally {
    clearTimeout(timer)
  }
}

export async function streamEveSession(
  endpoint: string,
  sessionId: string,
  timeoutMs: number,
  onEvent?: (event: EveEvent) => void,
  authHeader?: string,
): Promise<EveSessionResult> {
  const url = `${endpoint.replace(/\/$/, '')}/eve/v1/session/${sessionId}/stream`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers: Record<string, string> = {
      accept: 'application/x-ndjson',
    }
    if (authHeader) {
      headers['authorization'] = authHeader
    }

    const res = await fetch(url, {
      headers,
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new EveSessionError(
        `stream request failed (${res.status} ${res.statusText})`,
        res.status,
        endpoint,
      )
    }

    if (!res.body) {
      throw new EveSessionError('stream response has no body', 200, endpoint)
    }

    const reader: ReadableStreamDefaultReader<Uint8Array> = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const replyParts: string[] = []
    let usage: EveSessionResult['usage']
    let turnOutcome: string | undefined

    // eve 0.91+ streams NDJSON envelopes: {"facts": [{type, data, scope}]},
    // {"progress": {type, data, scope}}, and {"$eve": "heartbeat"} keepalives.
    // Older servers emitted flat {"type", "data"} events. Handle both.
    const handleEntry = (
      type: string | undefined,
      data: Record<string, unknown>,
    ) => {
      if (type === 'content.completed') {
        if (data['kind'] === 'text' && data['phase'] === 'reply') {
          const value = data['value']
          if (typeof value === 'string') replyParts.push(value)
        }
        return
      }
      if (type === 'message.completed') {
        const msg = data['message']
        if (typeof msg === 'string') replyParts.push(msg)
        const u = data['usage'] as
          | { inputTokens?: number; outputTokens?: number }
          | undefined
        if (u) usage = u
        return
      }
      if (type === 'usage.recorded') {
        const u = data['usage'] as
          | { inputTokens?: number; outputTokens?: number }
          | undefined
        if (u) usage = { ...usage, ...u }
        return
      }
      if (
        type === 'turn.settled' ||
        type === 'turn.completed' ||
        type === 'session.waiting'
      ) {
        turnOutcome =
          typeof data['outcome'] === 'string' ? data['outcome'] : 'completed'
      }
    }

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('{')) continue

        let event: Record<string, unknown>
        try {
          event = JSON.parse(trimmed) as Record<string, unknown>
        } catch {
          continue
        }

        if (onEvent) onEvent(event as unknown as EveEvent)

        const facts = event['facts']
        if (Array.isArray(facts) && facts.length > 0) {
          for (const fact of facts) {
            if (fact && typeof fact === 'object') {
              const f = fact as Record<string, unknown>
              handleEntry(
                f['type'] as string | undefined,
                (f['data'] as Record<string, unknown>) ?? {},
              )
            }
          }
        } else {
          const progress = event['progress']
          if (progress && typeof progress === 'object') {
            const p = progress as Record<string, unknown>
            handleEntry(
              p['type'] as string | undefined,
              (p['data'] as Record<string, unknown>) ?? {},
            )
          } else {
            handleEntry(
              event['type'] as string | undefined,
              (event['data'] as Record<string, unknown>) ?? {},
            )
          }
        }

        if (turnOutcome !== undefined) {
          await reader.cancel().catch(() => {})
          return {
            sessionId,
            message: replyParts.join('').trim(),
            usage,
          }
        }
      }
    }

    // Stream ended without terminal event
    await reader.cancel().catch(() => {})
    return {
      sessionId,
      message: replyParts.join('').trim(),
      usage,
    }
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
}

/**
 * Create an Eve session and stream the response in one call.
 * Returns the final assistant message.
 */
export async function invokeViaEveSession(
  options: EveSessionOptions,
): Promise<EveSessionResult> {
  const { sessionId } = await createEveSession(options)
  return streamEveSession(
    options.endpoint,
    sessionId,
    options.timeoutMs,
    undefined,
    options.authHeader,
  )
}
