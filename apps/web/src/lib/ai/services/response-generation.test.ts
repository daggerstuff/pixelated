import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AICompletion, AIMessage } from '../models/ai-types'
import { ResponseGenerationService } from './response-generation'

describe('ResponseGenerationService', () => {
  let createChatCompletion: ReturnType<typeof vi.fn>
  let service: ResponseGenerationService

  beforeEach(() => {
    createChatCompletion = vi.fn(
      async (messages: AIMessage[]): Promise<AICompletion> => ({
        id: 'test-completion',
        created: 0,
        model: 'test-model',
        choices: [
          {
            message: { role: 'assistant', content: 'A helpful response.' },
            finishReason: 'stop',
          },
        ],
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        provider: 'test',
        content: 'A helpful response.',
      }),
    )
    service = new ResponseGenerationService({
      aiService: {
        createChatCompletion,
        createStreamingChatCompletion: vi.fn(),
        getModelInfo: vi.fn(),
        dispose: vi.fn(),
      },
      model: 'test-model',
    })
  })

  it('uses the empirically tested response policy and preserves caller instructions', async () => {
    await service.generateResponseWithInstructions(
      [{ role: 'user', content: 'I feel overwhelmed.' }],
      'Keep the answer relevant to this support request.',
    )

    const sentMessages = createChatCompletion.mock.calls[0]?.[0]
    expect(sentMessages?.[0]?.role).toBe('system')
    expect(sentMessages?.[0]?.content).toContain('one brief, specific reflection')
    expect(sentMessages?.[0]?.content).toContain('Preserve safety and uncertainty context')
    expect(sentMessages?.[0]?.content).toContain(
      'Additional instructions: Keep the answer relevant to this support request.',
    )
    expect(sentMessages?.[1]).toEqual({
      role: 'user',
      content: 'I feel overwhelmed.',
    })
  })

  it('uses the base policy without additional instructions when none are provided', async () => {
    await service.generateResponseWithInstructions([
      { role: 'user', content: 'Hello' },
    ])
    const sentMessages = createChatCompletion.mock.calls[0]?.[0]
    expect(sentMessages?.[0]?.content).toContain('one brief, specific reflection')
    expect(sentMessages?.[0]?.content).not.toContain('Additional instructions:')
  })

  it('propagates errors from generateResponse', async () => {
    createChatCompletion.mockRejectedValueOnce(new Error('boom'))
    await expect(
      service.generateResponse([{ role: 'user', content: 'Hello' }]),
    ).rejects.toThrow('Failed to generate therapeutic response')
  })

  it('propagates errors from generateResponseWithInstructions', async () => {
    createChatCompletion.mockRejectedValueOnce(new Error('boom'))
    await expect(
      service.generateResponseWithInstructions([
        { role: 'user', content: 'Hello' },
      ]),
    ).rejects.toThrow('Failed to generate therapeutic response with instructions')
  })

  it('forwards dispose to the AI service', () => {
    const mockDispose = createChatCompletion.mock.calls as unknown
    void mockDispose
    const aiService = (
      (service as unknown as { aiService: { dispose: ReturnType<typeof vi.fn> } })
        .aiService
    )
    aiService.dispose.mockClear()
    service.dispose()
    expect(aiService.dispose).toHaveBeenCalledTimes(1)
  })
})