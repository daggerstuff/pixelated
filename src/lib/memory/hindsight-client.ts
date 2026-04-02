/**
 * @file hindsight-client.ts
 * @module lib/memory/hindsight-client
 * @description
 *   Product-facing memory client. This must target app/backend routes only,
 *   never the internal shared memory service directly.
 *   Implements the core Learning Loop: Retain, Recall, and Reflect.
 */

export interface HindsightMemory {
  id: string
  content: string
  metadata?: Record<string, unknown>
  timestamp?: string
  bank_id: string
}

export interface HindsightRecallOptions {
  limit?: number
  min_confidence?: number
  context?: Record<string, unknown>
}

export interface HindsightRetainOptions {
  metadata?: Record<string, unknown>
  context?: string
}

export interface HindsightReflectOptions {
  stream?: boolean
  context?: Record<string, unknown>
}

export interface HindsightClientConfig {
  /** Base URL for the app/backend proxy. */
  baseUrl?: string
  /** Default Bank ID to use if not specified in calls. */
  defaultBankId?: string
}

/**
 * Hindsight client for browser/frontend use through app-owned routes.
 * 
 * Implements the agentic memory pattern:
 * 1. Retain: Store facts and experiences.
 * 2. Recall: Retrieve relevant context.
 * 3. Reflect: Reason over memories to generate insights.
 */
export class HindsightClient {
  private readonly baseUrl: string
  private readonly defaultBankId: string

  constructor(config: HindsightClientConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.NEXT_PUBLIC_APP_ORIGIN || ''
    this.defaultBankId = config.defaultBankId || 'pixelated'
  }

  private async request<T>(endpoint: string, options: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Hindsight API error (${response.status}): ${errorText}`)
    }

    return response.json() as Promise<T>
  }

  /**
   * Retain: Store information in a memory bank.
   * 
   * @param content - The text to store
   * @param bankId - Target bank ID
   * @param options - Metadata and additional context
   */
  async retain(
    content: string, 
    bankId: string = this.defaultBankId,
    options: HindsightRetainOptions = {}
  ): Promise<{ memory_id: string }> {
    return this.request<{ memory_id: string }>('/api/hindsight/retain', {
      method: 'POST',
      body: JSON.stringify({
        content,
        bank_id: bankId,
        metadata: options.metadata,
        context: options.context,
      }),
    })
  }

  /**
   * Recall: Retrieve relevant memories from a bank.
   * 
   * @param query - The search query
   * @param bankId - Bank ID to search
   * @param options - Limit and confidence filters
   */
  async recall(
    query: string,
    bankId: string = this.defaultBankId,
    options: HindsightRecallOptions = {}
  ): Promise<HindsightMemory[]> {
    const response = await this.request<{ memories: HindsightMemory[] }>('/api/hindsight/recall', {
      method: 'POST',
      body: JSON.stringify({
        query,
        bank_id: bankId,
        limit: options.limit || 10,
        min_confidence: options.min_confidence,
        context: options.context,
      }),
    })
    return response.memories
  }

  /**
   * Reflect: Generate insights by reasoning over a bank's memories.
   * 
   * @param query - The question or prompt to reflect on
   * @param bankId - Bank ID to use for context
   * @param options - Reasoning options
   */
  async reflect(
    query: string,
    bankId: string = this.defaultBankId,
    options: HindsightReflectOptions = {}
  ): Promise<{ answer: string; references?: string[] }> {
    return this.request<{ answer: string; references?: string[] }>('/api/hindsight/reflect', {
      method: 'POST',
      body: JSON.stringify({
        query,
        bank_id: bankId,
        stream: options.stream || false,
        context: options.context,
      }),
    })
  }

  /**
   * Get all memories from a bank (administrative/debug use).
   */
  async getBankMemories(bankId: string = this.defaultBankId): Promise<HindsightMemory[]> {
    const response = await this.request<{ memories: HindsightMemory[] }>(`/api/hindsight/banks/${bankId}/memories`, {
      method: 'GET'
    })
    return response.memories
  }

  /**
   * Delete a specific memory.
   */
  async deleteMemory(memoryId: string, bankId: string = this.defaultBankId): Promise<void> {
    await this.request(`/api/hindsight/banks/${bankId}/memories/${memoryId}`, {
      method: 'DELETE'
    })
  }
}

/**
 * Create a Hindsight client instance.
 */
export function createHindsightClient(config?: HindsightClientConfig): HindsightClient {
  return new HindsightClient(config)
}
