import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// SSRF protection: Centralized URL validation utility
// Removed localhost and 127.0.0.1 to prevent local service attacks
const ALLOWED_DOMAINS = [
  'huggingface.co',
  'api.wandb.ai',
  'ml.azure.com',
  'mlflow.company.com',
]

const safeFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url
  if (url.startsWith('http')) {
    const hostnameMatch = url.match(
      /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n?]+)/im,
    )
    const domain =
      hostnameMatch && hostnameMatch[1] ? hostnameMatch[1].toLowerCase() : ''
    if (!domain || !ALLOWED_DOMAINS.some((d) => domain.endsWith(d))) {
      throw new Error(
        `${url} is not allowed. Only whitelisted domains are permitted to prevent SSRF attacks.`,
      )
    }
  }
  // Create abort controller if not provided
  const controller = new AbortController()
  const signal = init?.signal || controller.signal
  const options: RequestInit = {
    ...init,
    signal,
  }
  // Set timeout
  setTimeout(() => controller.abort(), 30000) // 30s timeout
  return fetch(url, options)
}

describe('APIService Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Knowledge Balancer Service', () => {
    it('successfully connects to knowledge balancer API', async () => {
      const mockResponse = {
        categories: [
          { id: 'anxiety-disorders', currentCount: 300, targetCount: 300 },
          { id: 'mood-disorders', currentCount: 250, targetCount: 250 },
        ],
        balanceScore: 95,
        lastUpdated: new Date().toISOString(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (_header: string) =>
            _header === 'content-length' ? '500' : null,
        },
        json: () => Promise.resolve(mockResponse),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(JSON.stringify(mockResponse)),
            )
            controller.close()
          },
        }),
      })

      const response = await safeFetch('/api/knowledge-balancer/status')
      const data = await response.json()

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/knowledge-balancer/status',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      )
      expect(data.categories).toHaveLength(2)
      expect(data.balanceScore).toBe(95)
    })

    it('handles knowledge balancer API errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Service unavailable'))

      try {
        await safeFetch('/api/knowledge-balancer/status')
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Service unavailable')
      }
    })

    it('syncs category data with knowledge balancer', async () => {
      const syncData = {
        categories: [
          { id: 'anxiety-disorders', targetRatio: 30, currentRatio: 28 },
          { id: 'mood-disorders', targetRatio: 25, currentRatio: 27 },
        ],
        totalItems: 1000,
        balanceThreshold: 3,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (_header: string) => null,
        },
        json: () => Promise.resolve({ success: true, syncId: 'sync-123' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                JSON.stringify({ success: true, syncId: 'sync-123' }),
              ),
            )
            controller.close()
          },
        }),
      })

      const response = await safeFetch('/api/knowledge-balancer/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncData),
      })

      const result = await response.json()

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/knowledge-balancer/sync',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(syncData),
          signal: expect.any(AbortSignal),
        }),
      )
      expect(result.success).toBe(true)
      expect(result.syncId).toBe('sync-123')
    })
  })

  describe('Training Pipeline APIs', () => {
    describe('Hugging Face Hub Integration', () => {
      it('uploads dataset to Hugging Face Hub', async () => {
        const datasetData = {
          name: 'psychology-training-dataset',
          data: { categories: [], totalItems: 1000 },
          metadata: { version: '1.0.0', created: new Date().toISOString() },
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: {
            get: (_header: string) => null,
          },
          json: () =>
            Promise.resolve({
              id: 'dataset-123',
              url: 'https://huggingface.co/datasets/psychology-training-dataset',
            }),
        })

        const response = await safeFetch(
          'https://huggingface.co/api/datasets',
          {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer hf_token',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(datasetData),
          },
        )

        const result = await response.json()

        expect(response.status).toBe(201)
        expect(result.id).toBe('dataset-123')
        expect(result.url).toContain('huggingface.co')
      })

      it('handles Hugging Face API authentication errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: {
            get: (_header: string) => null,
          },
          json: () => Promise.resolve({ error: 'Invalid token' }),
        })

        const response = await safeFetch(
          'https://huggingface.co/api/datasets',
          {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer invalid_token',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          },
        )

        expect(response.status).toBe(401)
        const error = await response.json()
        expect(error.error).toBe('Invalid token')
      })
    })

    describe('MLflow Tracking Integration', () => {
      it('creates experiment in MLflow', async () => {
        const experimentData = {
          name: 'psychology-pipeline-experiment',
          artifact_location: '/experiments/psychology',
          tags: { 'pipeline.version': '1.0.0' },
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: {
            get: (_header: string) => null,
          },
          json: () => Promise.resolve({ experiment_id: 'exp-123' }),
        })

        const response = await safeFetch(
          'http://mlflow.company.com/api/2.0/mlflow/experiments/create',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(experimentData),
          },
        )

        const result = await response.json()

        expect(result.experiment_id).toBe('exp-123')
      })

      it('logs metrics to MLflow', async () => {
        const metricsData = {
          run_id: 'run-123',
          metrics: [
            { key: 'balance_score', value: 95.5, timestamp: Date.now() },
            { key: 'quality_score', value: 88.2, timestamp: Date.now() },
          ],
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: {
            get: (_header: string) => null,
          },
          json: () => Promise.resolve({}),
        })

        const response = await safeFetch(
          'http://mlflow.company.com/api/2.0/mlflow/runs/log-batch',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metricsData),
          },
        )

        expect(response.ok).toBe(true)
      })
    })

    describe('Weights & Biases Integration', () => {
      it('initializes W&B run', async () => {
        const runData = {
          project: 'psychology-pipeline',
          name: 'category-balancing-run',
          config: {
            target_ratios: [30, 25, 20, 15, 10],
            total_items: 1000,
          },
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: {
            get: (_header: string) => null,
          },
          json: () =>
            Promise.resolve({
              run: { id: 'wandb-run-123', url: 'https://wandb.ai/run/123' },
            }),
        })

        const response = await safeFetch('https://api.wandb.ai/graphql', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer wandb_token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: 'mutation { createRun(input: $input) { run { id url } } }',
            variables: { input: runData },
          }),
        })

        const result = await response.json()
        expect(result.run.id).toBe('wandb-run-123')
      })
    })

    describe('Azure ML Integration', () => {
      it('creates Azure ML dataset', async () => {
        const datasetData = {
          name: 'psychology-training-data',
          description: 'Balanced psychology training dataset',
          datastore: 'workspaceblobstore',
          path: 'datasets/psychology/v1.0',
        }

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 201,
          headers: {
            get: (_header: string) => null,
          },
          json: () =>
            Promise.resolve({
              id: 'azureml-dataset-123',
              name: 'psychology-training-data',
              version: 1,
            }),
        })

        const response = await safeFetch(
          'https://ml.azure.com/api/workspaces/ws-123/datasets',
          {
            method: 'PUT',
            headers: {
              'Authorization': 'Bearer azure_token',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(datasetData),
          },
        )

        const result = await response.json()
        expect(result.id).toBe('azureml-dataset-123')
        expect(result.version).toBe(1)
      })
    })
  })

  describe('Export Service APIs', () => {
    it('generates export in multiple formats', async () => {
      const exportRequest = {
        formats: ['json', 'csv', 'parquet'],
        data: { categories: [], totalItems: 1000 },
        options: { compression: true, metadata: true },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        headers: {
          get: (_header: string) => null,
        },
        json: () =>
          Promise.resolve({
            jobId: 'export-job-123',
            status: 'processing',
            estimatedTime: 30,
          }),
      })

      const response = await safeFetch('/api/exports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportRequest),
      })

      const result = await response.json()
      expect(result.jobId).toBe('export-job-123')
      expect(result.status).toBe('processing')
    })

    it('checks export job status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (_header: string) => null,
        },
        json: () =>
          Promise.resolve({
            jobId: 'export-job-123',
            status: 'completed',
            downloadUrls: {
              json: '/downloads/export-123.json',
              csv: '/downloads/export-123.csv',
              parquet: '/downloads/export-123.parquet',
            },
          }),
      })

      const response = await safeFetch('/api/exports/export-job-123/status')
      const result = await response.json()

      expect(result.status).toBe('completed')
      expect(result.downloadUrls).toHaveProperty('json')
      expect(result.downloadUrls).toHaveProperty('csv')
      expect(result.downloadUrls).toHaveProperty('parquet')
    })
  })

  describe('Real-time WebSocket Connections', () => {
    it('establishes WebSocket connection for real-time updates', async () => {
      const mockWebSocket = {
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        readyState: 1, // OPEN
      }

      // Mock WebSocket constructor
      global.WebSocket = vi.fn(function() { return mockWebSocket }) as any

      const ws = new WebSocket('ws://localhost:3000/pipeline-updates')

      expect(WebSocket).toHaveBeenCalledWith(
        'ws://localhost:3000/pipeline-updates',
      )
      expect(ws.readyState).toBe(1)
    })

    it('handles WebSocket message for category updates', async () => {
      const mockWebSocket = {
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        readyState: 1,
      }

      global.WebSocket = vi.fn(function() { return mockWebSocket }) as any

      const ws = new WebSocket('ws://localhost:3000/pipeline-updates')

      // Simulate message handler registration
      const messageHandler = vi.fn()
      ws.addEventListener('message', messageHandler)

      expect((ws as any).addEventListener).toHaveBeenCalledWith(
        'message',
        messageHandler,
      )
    })
  })

  describe('Error Handling and Retry Logic', () => {
    it('retries failed API calls with exponential backoff', async () => {
      // First call fails
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: {
            get: (_header: string) => null,
          },
          json: () => Promise.resolve({ success: true }),
        })

      const retryFetch = async (
        url: string,
        options: any,
        maxRetries = 3,
      ): Promise<Response> => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            const response = await fetch(url, options)
            if (!response.ok && i < maxRetries - 1) {
              throw new Error(`Attempt ${i + 1} failed`)
            }
            return response
          } catch (error: unknown) {
            if (i === maxRetries - 1) {
              throw error
            }
            await new Promise((resolve) =>
              setTimeout(resolve, Math.pow(2, i) * 1000),
            )
          }
        }
        throw new Error('All retries failed')
      }

      const response = await retryFetch('/api/knowledge-balancer/status', {})
      const data = await response.json()
      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(data.success).toBe(true)
    })

    it('handles API rate limiting', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '60']]),
        json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
      })

      const response = await safeFetch('/api/training-pipeline/submit')

      expect(response.status).toBe(429)
      const error = await response.json()
      expect(error.error).toBe('Rate limit exceeded')
    })

    it('handles service unavailable errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: {
          get: (_header: string) => null,
        },
        json: () =>
          Promise.resolve({
            error: 'Service temporarily unavailable',
            retryAfter: 300,
          }),
      })

      const response = await safeFetch('/api/knowledge-balancer/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(503)
      const error = await response.json()
      expect(error.retryAfter).toBe(300)
    })

    it('prevents SSRF attacks with blocked URLs', async () => {
      // Test that external malicious URLs are blocked
      const maliciousUrls = [
        'http://internal.server.local/admin',
        'https://127.0.0.1:3000/api/secrets',
        'https://example.com/../../etc/passwd',
      ]

      for (const url of maliciousUrls) {
        await expect(safeFetch(url)).rejects.toThrow(
          'is not allowed. Only whitelisted domains are permitted to prevent SSRF attacks.',
        )
      }
    })

    it('allows whitelisted external URLs', async () => {
      const allowedUrls = [
        'https://huggingface.co/api/models',
        'https://api.wandb.ai/graphql',
        'https://ml.azure.com/api/datasets',
        '/api/internal-endpoint',
      ]

      for (const url of allowedUrls) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: {
            get: (_header: string) => null,
          },
          json: () => Promise.resolve({ success: true }),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(JSON.stringify({ success: true })),
              )
              controller.close()
            },
          }),
        })

        const result = await safeFetch(url)
        expect(result.ok).toBe(true)
      }
    })

    it('handles JWT token authentication', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (_header: string) => null,
        },
        json: () => Promise.resolve({ authorized: true, user: 'test-user' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                JSON.stringify({ authorized: true, user: 'test-user' }),
              ),
            )
            controller.close()
          },
        }),
      })

      const response = await safeFetch('/api/protected-endpoint', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const result = await response.json()
      expect(result.authorized).toBe(true)
    })

    it('handles API key authentication', async () => {
      const apiKey = 'api-key-123456'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (_header: string) => null,
        },
        json: () => Promise.resolve({ success: true }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(JSON.stringify({ success: true })),
            )
            controller.close()
          },
        }),
      })

      const response = await safeFetch('/api/external-service', {
        headers: { 'X-API-Key': apiKey },
      })

      expect(response.ok).toBe(true)
    })

    it('handles OAuth 2.0 token refresh', async () => {
      // Mock token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (_header: string) => null,
        },
        json: () =>
          Promise.resolve({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
          }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                JSON.stringify({
                  access_token: 'new-access-token',
                  refresh_token: 'new-refresh-token',
                  expires_in: 3600,
                }),
              ),
            )
            controller.close()
          },
        }),
      })

      const response = await safeFetch('/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=refresh_token&refresh_token=old-refresh-token',
      })

      const tokens = await response.json()
      expect(tokens.access_token).toBe('new-access-token')
      expect(tokens.expires_in).toBe(3600)
    })
  })

  describe('Authentication and Authorization', () => {
    it('handles JWT token authentication', async () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (_header: string) => null,
        },
        json: () => Promise.resolve({ authorized: true, user: 'test-user' }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                JSON.stringify({ authorized: true, user: 'test-user' }),
              ),
            )
            controller.close()
          },
        }),
      })

      const response = await safeFetch('/api/protected-endpoint', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const result = await response.json()
      expect(result.authorized).toBe(true)
    })

    it('handles API key authentication', async () => {
      const apiKey = 'api-key-123456'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (_header: string) => null,
        },
        json: () => Promise.resolve({ success: true }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(JSON.stringify({ success: true })),
            )
            controller.close()
          },
        }),
      })

      const response = await safeFetch('/api/external-service', {
        headers: { 'X-API-Key': apiKey },
      })

      expect(response.ok).toBe(true)
    })

    it('handles OAuth 2.0 token refresh', async () => {
      // Mock token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (_header: string) => null,
        },
        json: () =>
          Promise.resolve({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
          }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(
                JSON.stringify({
                  access_token: 'new-access-token',
                  refresh_token: 'new-refresh-token',
                  expires_in: 3600,
                }),
              ),
            )
            controller.close()
          },
        }),
      })

      const response = await safeFetch('/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=refresh_token&refresh_token=old-refresh-token',
      })

      const tokens = await response.json()
      expect(tokens.access_token).toBe('new-access-token')
      expect(tokens.expires_in).toBe(3600)
    })
  })
})
