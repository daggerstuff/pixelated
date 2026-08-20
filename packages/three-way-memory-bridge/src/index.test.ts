import { describe, it, expect, vi } from 'vitest'

import { MemoryBridge } from './index.js'

describe('MemoryBridge', () => {
  it('assembles combined prompt context correctly', async () => {
    const bridge = new MemoryBridge({
      NEON_DATABASE_URL: '',
      FORESIGHT_API_URL: 'http://localhost:8764',
    })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        memories: [
          { id: '1', content: 'Always prefer pnpm', category: 'preference' },
        ],
      }),
    } as any)

    const context = await bridge.getContext('package manager preferences')
    expect(context.foresightMemories).toHaveLength(1)
    expect(context.combinedPromptContext).toContain('Always prefer pnpm')
  })

  describe('Foresight retry behavior', () => {
    const okResponse = { ok: true, status: 200, json: async () => ({}) }
    const errorResponse = { ok: false, status: 503, json: async () => ({}) }

    it('retries transient Foresight failures and saves the memory', async () => {
      const bridge = new MemoryBridge({
        NEON_DATABASE_URL: '',
        FORESIGHT_API_URL: 'http://localhost:8764',
      })

      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error('network blip'))
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValue(okResponse)
      globalThis.fetch = fetchMock as any

      const success = await bridge.saveMemory('durable memory', 'fact')

      expect(success).toBe(true)
      // Initial attempt + 2 retries
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('returns false after exhausting Foresight retries', async () => {
      const bridge = new MemoryBridge({
        NEON_DATABASE_URL: '',
        FORESIGHT_API_URL: 'http://localhost:8764',
      })

      const fetchMock = vi.fn().mockResolvedValue(errorResponse)
      globalThis.fetch = fetchMock as any

      const success = await bridge.saveMemory('lost memory', 'fact')

      expect(success).toBe(false)
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('retries transient Foresight recall failures without dropping context', async () => {
      const bridge = new MemoryBridge({
        NEON_DATABASE_URL: '',
        FORESIGHT_API_URL: 'http://localhost:8764',
      })

      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error('network blip'))
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            memories: [{ id: '1', content: 'survived retry' }],
          }),
        })
      globalThis.fetch = fetchMock as any

      const context = await bridge.getContext('recall')

      expect(context.foresightMemories).toHaveLength(1)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })
})
