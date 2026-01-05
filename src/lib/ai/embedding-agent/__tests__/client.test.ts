/**
 * Tests for the Embedding Agent Client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  EmbeddingAgentClient,
  EmbeddingAgentError,
  createEmbeddingAgentClient,
} from '../client'
import type { EmbeddingResponse, BatchEmbeddingResponse } from '../types'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('EmbeddingAgentClient', () => {
  let client: EmbeddingAgentClient

  beforeEach(() => {
    client = new EmbeddingAgentClient({
      baseUrl: 'http://localhost:8001',
      timeout: 5000,
    })
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('embedText', () => {
    it('should return embedding response for valid text', async () => {
      const mockResponse: EmbeddingResponse = {
        embedding: Array(384).fill(0.1),
        embeddingId: 'emb_123',
        modelUsed: 'all-MiniLM-L6-v2',
        dimension: 384,
        textHash: 'abc123',
        cached: false,
        processingTimeMs: 50,
        createdAt: new Date().toISOString(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embedding: mockResponse.embedding,
          embedding_id: mockResponse.embeddingId,
          model_used: mockResponse.modelUsed,
          dimension: mockResponse.dimension,
          text_hash: mockResponse.textHash,
          cached: mockResponse.cached,
          processing_time_ms: mockResponse.processingTimeMs,
          created_at: mockResponse.createdAt,
        }),
      })

      const result = await client.embedText({ text: 'Hello world' })

      expect(result.embedding).toHaveLength(384)
      expect(result.embeddingId).toBe('emb_123')
      expect(result.modelUsed).toBe('all-MiniLM-L6-v2')
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8001/api/v1/embeddings/embed',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'Hello world' }),
        }),
      )
    })

    it('should transform request to snake_case', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embedding: [],
          embedding_id: 'test',
          model_used: 'test',
          dimension: 384,
          text_hash: 'test',
          cached: false,
          processing_time_ms: 0,
          created_at: new Date().toISOString(),
        }),
      })

      await client.embedText({
        text: 'test',
        knowledgeType: 'dsm5',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            text: 'test',
            knowledge_type: 'dsm5',
          }),
        }),
      )
    })

    it('should throw EmbeddingAgentError on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: 'Invalid request', message: 'Text is required' }),
      })

      await expect(client.embedText({ text: '' })).rejects.toThrow(EmbeddingAgentError)
    })
  })

  describe('embedBatch', () => {
    it('should return batch embedding response', async () => {
      const mockResponse: BatchEmbeddingResponse = {
        embeddings: [
          { index: 0, embedding: Array(384).fill(0.1), embeddingId: 'emb_1', textHash: 'hash1', cached: false },
          { index: 1, embedding: Array(384).fill(0.2), embeddingId: 'emb_2', textHash: 'hash2', cached: true },
        ],
        totalCount: 2,
        cachedCount: 1,
        generatedCount: 1,
        modelUsed: 'all-MiniLM-L6-v2',
        dimension: 384,
        processingTimeMs: 100,
        createdAt: new Date().toISOString(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embeddings: mockResponse.embeddings.map((e) => ({
            index: e.index,
            embedding: e.embedding,
            embedding_id: e.embeddingId,
            text_hash: e.textHash,
            cached: e.cached,
          })),
          total_count: mockResponse.totalCount,
          cached_count: mockResponse.cachedCount,
          generated_count: mockResponse.generatedCount,
          model_used: mockResponse.modelUsed,
          dimension: mockResponse.dimension,
          processing_time_ms: mockResponse.processingTimeMs,
          created_at: mockResponse.createdAt,
        }),
      })

      const result = await client.embedBatch({ texts: ['Hello', 'World'] })

      expect(result.embeddings).toHaveLength(2)
      expect(result.totalCount).toBe(2)
      expect(result.cachedCount).toBe(1)
    })
  })

  describe('searchSimilar', () => {
    it('should return search results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          matches: [
            {
              item_id: 'item_1',
              content: 'Test content',
              similarity_score: 0.95,
              knowledge_type: 'clinical',
              source: 'test_source',
              metadata: {},
            },
          ],
          query_embedding_id: 'query_emb_1',
          total_searched: 100,
          processing_time_ms: 25,
          model_used: 'all-MiniLM-L6-v2',
        }),
      })

      const result = await client.searchSimilar({
        query: 'depression treatment',
        topK: 10,
      })

      expect(result.matches).toHaveLength(1)
      expect(result.matches[0].similarityScore).toBe(0.95)
    })
  })

  describe('healthCheck', () => {
    it('should return health status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'healthy',
          version: '1.0.0',
          model_loaded: true,
          cache_available: true,
          timestamp: new Date().toISOString(),
        }),
      })

      const result = await client.healthCheck()

      expect(result.status).toBe('healthy')
      expect(result.modelLoaded).toBe(true)
    })
  })

  describe('getStatus', () => {
    it('should return detailed status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'healthy',
          model_loaded: true,
          model_name: 'all-MiniLM-L6-v2',
          embedding_dimension: 384,
          cache_size: 100,
          knowledge_items_count: 500,
          gpu_available: false,
          uptime_seconds: 3600,
          requests_processed: 1000,
          average_response_time_ms: 50,
        }),
      })

      const result = await client.getStatus()

      expect(result.modelLoaded).toBe(true)
      expect(result.embeddingDimension).toBe(384)
      expect(result.cacheSize).toBe(100)
    })
  })

  describe('error handling', () => {
    it('should throw on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(client.embedText({ text: 'test' })).rejects.toThrow(
        EmbeddingAgentError,
      )
    })

    it('should handle timeout', async () => {
      // Create client with very short timeout
      const timeoutClient = new EmbeddingAgentClient({
        baseUrl: 'http://localhost:8001',
        timeout: 1,
      })

      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => setTimeout(resolve, 1000)),
      )

      // This should timeout (AbortError converted to EmbeddingAgentError)
      await expect(timeoutClient.embedText({ text: 'test' })).rejects.toThrow()
    })
  })
})

describe('createEmbeddingAgentClient', () => {
  it('should create client with default URL', () => {
    const client = createEmbeddingAgentClient()
    expect(client).toBeInstanceOf(EmbeddingAgentClient)
  })

  it('should create client with custom URL', () => {
    const client = createEmbeddingAgentClient('http://custom:9000')
    expect(client).toBeInstanceOf(EmbeddingAgentClient)
  })
})

