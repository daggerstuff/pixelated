import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  searchEvidenceAssistant,
  getEvidenceAssistantMetadata,
  type EvidenceAssistantResponse,
} from './evidence-assistant'

describe('searchEvidenceAssistant', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed response data on success', async () => {
    const payload: EvidenceAssistantResponse = {
      query: 'ears compliance gate',
      answer: 'Use the EARS gate for internal review [1].',
      providerUsed: 'local',
      results: [],
      citations: [],
      warnings: [],
    }

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => payload,
      }),
    )

    await expect(
      searchEvidenceAssistant({ query: 'ears compliance gate' }),
    ).resolves.toEqual(payload)
  })

  it('throws a useful error message on non-200 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'backend failure' }),
      }),
    )

    await expect(
      searchEvidenceAssistant({ query: 'memory system' }),
    ).rejects.toThrow('backend failure')
  })

  it('returns normalized metadata for provider availability checks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 'Evidence Assistant API',
          version: '1.0',
          description: 'Evidence search + grounding',
          methods: ['POST', 'GET'],
          collections: ['docs', 'pages'],
          availableProviders: ['provider-a'],
          note: 'live metadata',
        }),
      }),
    )

    await expect(getEvidenceAssistantMetadata()).resolves.toEqual({
      name: 'Evidence Assistant API',
      version: '1.0',
      description: 'Evidence search + grounding',
      methods: ['POST', 'GET'],
      collections: ['docs', 'pages'],
      availableProviders: ['provider-a'],
      note: 'live metadata',
    })
  })

  it('returns resilient metadata defaults on malformed payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 22,
          methods: 'POST',
          availableProviders: 'provider-a',
        }),
      }),
    )

    await expect(getEvidenceAssistantMetadata()).resolves.toMatchObject({
      name: 'Evidence Assistant API',
      version: 'unknown',
      description: 'Internal evidence assistant endpoint.',
      methods: [],
      collections: [],
      availableProviders: [],
      note: 'Internal evidence assistant endpoint.',
    })
  })
})
