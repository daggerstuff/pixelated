import { Client } from '@neondatabase/serverless'

export interface BridgeEnv {
  NEON_DATABASE_URL: string
  FORESIGHT_API_URL: string
}

export interface MastraMessage {
  id: string
  thread_id: string
  role: string
  content: string
  created_at: string
}

export interface ForesightMemory {
  id: string
  content: string
  category?: string
  score?: number
}

export interface ThreeWayMemoryContext {
  mastraThreadMessages: MastraMessage[]
  foresightMemories: ForesightMemory[]
  combinedPromptContext: string
}

/**
 * 3-Way Memory Bridge
 * Coordinates context retrieval across Cloudflare Workers, Neon PostgreSQL (mastracode), and Foresight.
 */
/**
 * Retry with exponential backoff. Same semantics as the app's shared base
 * (src/lib/shared/retry.ts): `maxRetries` total attempts, `delay * 2^i`
 * backoff. Kept self-contained — this package must not depend on app src.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 800,
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * Math.pow(2, i)),
        )
      }
    }
  }
  throw lastError
}

export class MemoryBridge {
  private readonly env: BridgeEnv

  constructor(env: BridgeEnv) {
    this.env = env
  }

  /**
   * Retrieves combined memory context from both Neon (Mastra threads) and Foresight (durable vector memories)
   */
  async getContext(
    query: string,
    threadId?: string,
  ): Promise<ThreeWayMemoryContext> {
    const mastraThreadMessages: MastraMessage[] = []
    let foresightMemories: ForesightMemory[] = []

    // 1. Fetch Mastra thread state from Neon cloud DB if threadId provided.
    // Retried so a transient Neon connection/query failure does not drop the
    // thread context (silent swallow before).
    if (threadId && this.env.NEON_DATABASE_URL) {
      try {
        const rows = await withRetry(async () => {
          const client = new Client(this.env.NEON_DATABASE_URL)
          await client.connect()
          try {
            const res = await client.query(
              'SELECT id, thread_id, role, content, created_at FROM mastra_messages WHERE thread_id = $1 ORDER BY created_at DESC LIMIT 10',
              [threadId],
            )
            return res.rows as Record<string, unknown>[]
          } finally {
            await client.end()
          }
        })
        mastraThreadMessages.push(...rows)
      } catch (err) {
        console.error('[MemoryBridge] Neon query failed after retries:', err)
      }
    }

    // 2. Query Foresight memory system for semantic durable context
    if (this.env.FORESIGHT_API_URL) {
      try {
        // Retried so a transient Foresight API blip does not drop the recall.
        const res = await withRetry(async () => {
          const response = await fetch(
            `${this.env.FORESIGHT_API_URL}/api/memories/search`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query, limit: 5 }),
            },
          )
          if (!response.ok) {
            throw new Error(`Foresight API returned ${response.status}`)
          }
          return response
        })
        const data = (await res.json()) as { memories?: ForesightMemory[] }
        foresightMemories = data.memories ?? []
      } catch (err) {
        console.error(
          '[MemoryBridge] Foresight search failed after retries:',
          err,
        )
      }
    }

    // 3. Assemble combined prompt context payload for Cloudflare Workers AI
    const threadContextStr = mastraThreadMessages
      .reverse()
      .map((m) => `[${m.role}]: ${m.content}`)
      .join('\n')

    const foresightContextStr = foresightMemories
      .map((m) => `- ${m.content} (${m.category ?? 'memory'})`)
      .join('\n')

    const combinedPromptContext = `
=== PAST CONTEXT & DECISIONS (Foresight) ===
${foresightContextStr || 'No prior stored memories.'}

=== RECENT THREAD HISTORY (Mastra / Neon) ===
${threadContextStr || 'No previous messages.'}
`.trim()

    return {
      mastraThreadMessages,
      foresightMemories,
      combinedPromptContext,
    }
  }

  /**
   * Persists a newly learned decision or lesson to both Foresight and Neon
   */
  async saveMemory(
    content: string,
    category: 'decision' | 'lesson' | 'fact' = 'lesson',
  ): Promise<boolean> {
    let success = true

    // Save durable memory to Foresight. Retried so a transient API blip
    // does not drop the write; success stays true only when the retried
    // request actually lands (non-2xx throws into the catch path).
    if (this.env.FORESIGHT_API_URL) {
      try {
        await withRetry(async () => {
          const response = await fetch(
            `${this.env.FORESIGHT_API_URL}/api/memories`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content,
                store_options: { category },
              }),
            },
          )
          if (!response.ok) {
            throw new Error(`Foresight API returned ${response.status}`)
          }
        })
      } catch (err) {
        console.error(
          '[MemoryBridge] Foresight store failed after retries:',
          err,
        )
        success = false
      }
    }

    return success
  }
}
