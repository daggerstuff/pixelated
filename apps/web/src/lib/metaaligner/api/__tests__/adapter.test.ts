/* @vitest-environment node */
import { describe, it, expect } from 'vitest'

import {
  LLMAdapter,
  type OpenAIRawOutput,
  type AnthropicRawOutput,
  type GeminiRawOutput,
} from '../adapter'
import type { UnifiedContext } from '../unified-api'

describe('LLMAdapter', () => {
  const adapter = new LLMAdapter()
  const mockContext: UnifiedContext = {
    sessionId: 'session-123',
    userId: 'user-456',
  }

  it('transforms OpenAI output into unified format', () => {
    const rawOutput: OpenAIRawOutput = {
      model: 'gpt-4o',
      choices: [
        {
          message: { role: 'assistant', content: 'Take a deep breath.' },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 15,
        completion_tokens: 6,
        total_tokens: 21,
      },
    }

    const result = adapter.transform('OpenAI', rawOutput, mockContext)

    expect(result.llmOutput.content).toBe('Take a deep breath.')
    expect(result.llmOutput.metadata?.provider).toBe('OpenAI')
    expect(result.llmOutput.metadata?.model).toBe('gpt-4o')
    expect(result.llmOutput.metadata?.finishReason).toBe('stop')
    expect(result.llmOutput.metadata?.tokenUsage).toEqual({
      promptTokens: 15,
      completionTokens: 6,
      totalTokens: 21,
    })
    expect(result.context).toEqual(mockContext)
  })

  it('transforms Anthropic output into unified format', () => {
    const rawOutput: AnthropicRawOutput = {
      model: 'claude-3-7-sonnet',
      content: [
        { type: 'text', text: 'I understand ' },
        { type: 'text', text: 'how difficult this is.' },
      ],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 25,
        output_tokens: 12,
      },
    }

    const result = adapter.transform('Anthropic', rawOutput, mockContext)

    expect(result.llmOutput.content).toBe('I understand how difficult this is.')
    expect(result.llmOutput.metadata?.provider).toBe('Anthropic')
    expect(result.llmOutput.metadata?.model).toBe('claude-3-7-sonnet')
    expect(result.llmOutput.metadata?.finishReason).toBe('end_turn')
    expect(result.llmOutput.metadata?.tokenUsage).toEqual({
      promptTokens: 25,
      completionTokens: 12,
      totalTokens: 37,
    })
  })

  it('transforms Gemini output into unified format', () => {
    const rawOutput: GeminiRawOutput = {
      model: 'gemini-2.5-flash',
      candidates: [
        {
          content: {
            parts: [{ text: 'Let us explore ' }, { text: 'what feels off.' }],
          },
          finishReason: 'STOP',
        },
      ],
      usageMetadata: {
        promptTokenCount: 18,
        candidatesTokenCount: 9,
        totalTokenCount: 27,
      },
    }

    const result = adapter.transform('Gemini', rawOutput, mockContext)

    expect(result.llmOutput.content).toBe('Let us explore what feels off.')
    expect(result.llmOutput.metadata?.provider).toBe('Gemini')
    expect(result.llmOutput.metadata?.model).toBe('gemini-2.5-flash')
    expect(result.llmOutput.metadata?.finishReason).toBe('STOP')
    expect(result.llmOutput.metadata?.tokenUsage).toEqual({
      promptTokens: 18,
      completionTokens: 9,
      totalTokens: 27,
    })
  })

  it('transforms MentalLLaMA output into unified format', () => {
    const rawOutput = {
      content: 'Clinical reflection.',
      finishReason: 'stop',
      model: 'mental-llama-7b',
      tokenUsage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
      metadata: {
        customFlag: true,
      },
    }

    const result = adapter.transform('MentalLLaMA', rawOutput, mockContext)

    expect(result.llmOutput.content).toBe('Clinical reflection.')
    expect(result.llmOutput.metadata?.model).toBe('mental-llama-7b')
    expect(result.llmOutput.metadata?.tokenUsage).toEqual(rawOutput.tokenUsage)
  })

  it('throws for an unsupported provider', () => {
    expect(() =>
      adapter.transform('UnknownProvider' as any, {}, mockContext),
    ).toThrow('Unsupported LLM provider: UnknownProvider')
  })
})
