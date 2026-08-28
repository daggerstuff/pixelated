/**
 * Unit tests for LLMAdapter — transforms raw LLM provider outputs into
 * UnifiedProcessingRequest for the MetaAligner pipeline.
 */

import { describe, it, expect, beforeEach } from 'vitest'

import type { LLMResponse as MentalLLaMAResponse } from '../../ai/mental-llama/types/mentalLLaMATypes'
import {
  LLMAdapter,
  type LLMProvider,
  type OpenAIRawOutput,
  type AnthropicRawOutput,
  type GeminiRawOutput,
} from './adapter'
import type { UnifiedContext } from './unified-api'

// --- Shared test fixtures --------------------------------------------------

const mockContext: UnifiedContext = {
  userQuery: 'I feel anxious all the time',
  conversationHistory: ['Hello', 'How are you?'],
}

const adapter = new LLMAdapter()

// Valid MentalLLaMA raw output fixture
const mentalLLaMARaw: MentalLLaMAResponse = {
  content: 'I understand this is difficult for you.',
  finishReason: 'stop',
  tokenUsage: {
    promptTokens: 12,
    completionTokens: 8,
    totalTokens: 20,
  },
  model: 'mental-llama-v1',
  metadata: { source: 'local' },
}

// Valid OpenAI raw output fixture
const openAIRaw: OpenAIRawOutput = {
  id: 'chatcmpl-abc123',
  choices: [
    {
      message: { role: 'assistant', content: 'You are not alone in this.' },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 15,
    completion_tokens: 10,
    total_tokens: 25,
  },
  model: 'gpt-4',
}

// Valid Anthropic raw output fixture
const anthropicRaw: AnthropicRawOutput = {
  id: 'msg_abc123',
  content: [
    { type: 'text', text: 'I hear you. ' },
    { type: 'text', text: 'That sounds really hard.' },
  ],
  usage: { input_tokens: 20, output_tokens: 15 },
  stop_reason: 'end_turn',
  model: 'claude-3-opus',
}

// Valid Gemini raw output fixture
const geminiRaw: GeminiRawOutput = {
  candidates: [
    {
      content: {
        parts: [
          { text: 'It takes courage to share this.' },
          { text: ' You deserve support.' },
        ],
        role: 'model',
      },
      finishReason: 'STOP',
    },
  ],
  usageMetadata: {
    promptTokenCount: 18,
    candidatesTokenCount: 12,
    totalTokenCount: 30,
  },
  model: 'gemini-1.5-pro',
}

// --- Tests -----------------------------------------------------------------

describe('LLMAdapter', () => {
  describe('transform — dispatch', () => {
    it('should dispatch to MentalLLaMA transformer', () => {
      const result = adapter.transform(
        'MentalLLaMA',
        mentalLLaMARaw,
        mockContext,
      )
      expect(result.llmOutput.content).toBe(
        'I understand this is difficult for you.',
      )
    })

    it('should dispatch to OpenAI transformer', () => {
      const result = adapter.transform('OpenAI', openAIRaw, mockContext)
      expect(result.llmOutput.content).toBe('You are not alone in this.')
    })

    it('should dispatch to Anthropic transformer', () => {
      const result = adapter.transform('Anthropic', anthropicRaw, mockContext)
      expect(result.llmOutput.content).toBe(
        'I hear you. That sounds really hard.',
      )
    })

    it('should dispatch to Gemini transformer', () => {
      const result = adapter.transform('Gemini', geminiRaw, mockContext)
      expect(result.llmOutput.content).toBe(
        'It takes courage to share this. You deserve support.',
      )
    })

    it('should throw for unsupported provider', () => {
      // Bypass type system to test runtime guard
      const badProvider = 'Unknown' as unknown as LLMProvider
      expect(() => adapter.transform(badProvider, {}, mockContext)).toThrow(
        /Unsupported LLM provider/,
      )
    })

    it('should always pass context through unchanged', () => {
      const result = adapter.transform('OpenAI', openAIRaw, mockContext)
      expect(result.context).toBe(mockContext)
      expect(result.context.userQuery).toBe('I feel anxious all the time')
      expect(result.context.conversationHistory).toEqual([
        'Hello',
        'How are you?',
      ])
    })
  })

  // -------------------------------------------------------------------------

  describe('transformMentalLLaMA', () => {
    it('should map content correctly', () => {
      const result = adapter.transform(
        'MentalLLaMA',
        mentalLLaMARaw,
        mockContext,
      )
      expect(result.llmOutput.content).toBe(
        'I understand this is difficult for you.',
      )
    })

    it('should spread metadata and include finishReason, tokenUsage, model', () => {
      const result = adapter.transform(
        'MentalLLaMA',
        mentalLLaMARaw,
        mockContext,
      )
      const meta = result.llmOutput.metadata ?? {}

      expect(meta.source).toBe('local')
      expect(meta.finishReason).toBe('stop')
      expect(meta.tokenUsage).toEqual({
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20,
      })
      expect(meta.model).toBe('mental-llama-v1')
    })

    it('should set provider in metadata for consistency', () => {
      const result = adapter.transform(
        'MentalLLaMA',
        mentalLLaMARaw,
        mockContext,
      )
      expect(result.llmOutput.metadata?.provider).toBe('MentalLLaMA')
    })

    it('should handle minimal response with only content', () => {
      const minimal: MentalLLaMAResponse = { content: 'Hello' }
      const result = adapter.transform('MentalLLaMA', minimal, mockContext)

      expect(result.llmOutput.content).toBe('Hello')
      expect(result.llmOutput.metadata?.finishReason).toBeUndefined()
      expect(result.llmOutput.metadata?.tokenUsage).toBeUndefined()
      expect(result.llmOutput.metadata?.model).toBeUndefined()
    })

    it('should preserve original metadata keys alongside adapter keys', () => {
      const raw: MentalLLaMAResponse = {
        content: 'test',
        metadata: { custom: 'value', count: 42 },
        finishReason: 'stop',
      }
      const result = adapter.transform('MentalLLaMA', raw, mockContext)
      const meta = result.llmOutput.metadata ?? {}

      expect(meta.custom).toBe('value')
      expect(meta.count).toBe(42)
      expect(meta.finishReason).toBe('stop')
    })
  })

  // -------------------------------------------------------------------------

  describe('transformOpenAI', () => {
    it('should extract content from choices[0].message.content', () => {
      const result = adapter.transform('OpenAI', openAIRaw, mockContext)
      expect(result.llmOutput.content).toBe('You are not alone in this.')
    })

    it('should set provider to OpenAI in metadata', () => {
      const result = adapter.transform('OpenAI', openAIRaw, mockContext)
      expect(result.llmOutput.metadata?.provider).toBe('OpenAI')
    })

    it('should map token usage fields', () => {
      const result = adapter.transform('OpenAI', openAIRaw, mockContext)
      expect(result.llmOutput.metadata?.tokenUsage).toEqual({
        promptTokens: 15,
        completionTokens: 10,
        totalTokens: 25,
      })
    })

    it('should map finishReason from choices[0].finish_reason', () => {
      const result = adapter.transform('OpenAI', openAIRaw, mockContext)
      expect(result.llmOutput.metadata?.finishReason).toBe('stop')
    })

    it('should map model', () => {
      const result = adapter.transform('OpenAI', openAIRaw, mockContext)
      expect(result.llmOutput.metadata?.model).toBe('gpt-4')
    })

    it('should handle empty choices array', () => {
      const raw: OpenAIRawOutput = { choices: [] }
      const result = adapter.transform('OpenAI', raw, mockContext)
      expect(result.llmOutput.content).toBe('')
      expect(result.llmOutput.metadata?.finishReason).toBeUndefined()
    })

    it('should handle missing choices', () => {
      const raw: OpenAIRawOutput = {}
      const result = adapter.transform('OpenAI', raw, mockContext)
      expect(result.llmOutput.content).toBe('')
    })

    it('should handle missing message.content', () => {
      const raw: OpenAIRawOutput = {
        choices: [{ message: { role: 'assistant' } }],
      }
      const result = adapter.transform('OpenAI', raw, mockContext)
      expect(result.llmOutput.content).toBe('')
    })

    it('should handle missing usage (tokenUsage undefined)', () => {
      const raw: OpenAIRawOutput = {
        choices: [{ message: { content: 'text' }, finish_reason: 'stop' }],
      }
      const result = adapter.transform('OpenAI', raw, mockContext)
      expect(result.llmOutput.metadata?.tokenUsage).toBeUndefined()
    })

    it('should default missing usage fields to 0', () => {
      const raw: OpenAIRawOutput = {
        choices: [{ message: { content: 'text' } }],
        usage: { prompt_tokens: 5 },
      }
      const result = adapter.transform('OpenAI', raw, mockContext)
      expect(result.llmOutput.metadata?.tokenUsage).toEqual({
        promptTokens: 5,
        completionTokens: 0,
        totalTokens: 0,
      })
    })

    it('should handle multiple choices by using first', () => {
      const raw: OpenAIRawOutput = {
        choices: [
          { message: { content: 'first' }, finish_reason: 'stop' },
          { message: { content: 'second' }, finish_reason: 'length' },
        ],
      }
      const result = adapter.transform('OpenAI', raw, mockContext)
      expect(result.llmOutput.content).toBe('first')
      expect(result.llmOutput.metadata?.finishReason).toBe('stop')
    })
  })

  // -------------------------------------------------------------------------

  describe('transformAnthropic', () => {
    it('should join multiple content blocks text', () => {
      const result = adapter.transform('Anthropic', anthropicRaw, mockContext)
      expect(result.llmOutput.content).toBe(
        'I hear you. That sounds really hard.',
      )
    })

    it('should set provider to Anthropic in metadata', () => {
      const result = adapter.transform('Anthropic', anthropicRaw, mockContext)
      expect(result.llmOutput.metadata?.provider).toBe('Anthropic')
    })

    it('should map stop_reason to finishReason', () => {
      const result = adapter.transform('Anthropic', anthropicRaw, mockContext)
      expect(result.llmOutput.metadata?.finishReason).toBe('end_turn')
    })

    it('should compute totalTokens from input + output', () => {
      const result = adapter.transform('Anthropic', anthropicRaw, mockContext)
      expect(result.llmOutput.metadata?.tokenUsage).toEqual({
        promptTokens: 20,
        completionTokens: 15,
        totalTokens: 35,
      })
    })

    it('should map model', () => {
      const result = adapter.transform('Anthropic', anthropicRaw, mockContext)
      expect(result.llmOutput.metadata?.model).toBe('claude-3-opus')
    })

    it('should handle missing content array', () => {
      const raw: AnthropicRawOutput = { stop_reason: 'end_turn' }
      const result = adapter.transform('Anthropic', raw, mockContext)
      expect(result.llmOutput.content).toBe('')
    })

    it('should handle empty content array', () => {
      const raw: AnthropicRawOutput = { content: [] }
      const result = adapter.transform('Anthropic', raw, mockContext)
      expect(result.llmOutput.content).toBe('')
    })

    it('should handle content block with missing text', () => {
      const raw: AnthropicRawOutput = {
        content: [{ type: 'text' }, { type: 'tool_use' }],
      }
      const result = adapter.transform('Anthropic', raw, mockContext)
      expect(result.llmOutput.content).toBe('')
    })

    it('should handle missing usage (tokenUsage undefined)', () => {
      const raw: AnthropicRawOutput = {
        content: [{ type: 'text', text: 'hello' }],
      }
      const result = adapter.transform('Anthropic', raw, mockContext)
      expect(result.llmOutput.metadata?.tokenUsage).toBeUndefined()
    })

    it('should default missing usage fields to 0', () => {
      const raw: AnthropicRawOutput = {
        content: [{ text: 'hi' }],
        usage: { input_tokens: 10 },
      }
      const result = adapter.transform('Anthropic', raw, mockContext)
      expect(result.llmOutput.metadata?.tokenUsage).toEqual({
        promptTokens: 10,
        completionTokens: 0,
        totalTokens: 10,
      })
    })

    it('should handle single content block', () => {
      const raw: AnthropicRawOutput = {
        content: [{ type: 'text', text: 'Single block' }],
      }
      const result = adapter.transform('Anthropic', raw, mockContext)
      expect(result.llmOutput.content).toBe('Single block')
    })
  })

  // -------------------------------------------------------------------------

  describe('transformGemini', () => {
    it('should join multiple parts text from candidates[0]', () => {
      const result = adapter.transform('Gemini', geminiRaw, mockContext)
      expect(result.llmOutput.content).toBe(
        'It takes courage to share this. You deserve support.',
      )
    })

    it('should set provider to Gemini in metadata', () => {
      const result = adapter.transform('Gemini', geminiRaw, mockContext)
      expect(result.llmOutput.metadata?.provider).toBe('Gemini')
    })

    it('should map finishReason from candidates[0].finishReason', () => {
      const result = adapter.transform('Gemini', geminiRaw, mockContext)
      expect(result.llmOutput.metadata?.finishReason).toBe('STOP')
    })

    it('should map usageMetadata tokens', () => {
      const result = adapter.transform('Gemini', geminiRaw, mockContext)
      expect(result.llmOutput.metadata?.tokenUsage).toEqual({
        promptTokens: 18,
        completionTokens: 12,
        totalTokens: 30,
      })
    })

    it('should map model', () => {
      const result = adapter.transform('Gemini', geminiRaw, mockContext)
      expect(result.llmOutput.metadata?.model).toBe('gemini-1.5-pro')
    })

    it('should handle missing candidates', () => {
      const raw: GeminiRawOutput = {}
      const result = adapter.transform('Gemini', raw, mockContext)
      expect(result.llmOutput.content).toBe('')
      expect(result.llmOutput.metadata?.finishReason).toBeUndefined()
    })

    it('should handle empty candidates array', () => {
      const raw: GeminiRawOutput = { candidates: [] }
      const result = adapter.transform('Gemini', raw, mockContext)
      expect(result.llmOutput.content).toBe('')
    })

    it('should handle missing parts in content', () => {
      const raw: GeminiRawOutput = {
        candidates: [{ content: { role: 'model' }, finishReason: 'STOP' }],
      }
      const result = adapter.transform('Gemini', raw, mockContext)
      expect(result.llmOutput.content).toBe('')
      expect(result.llmOutput.metadata?.finishReason).toBe('STOP')
    })

    it('should handle part with missing text', () => {
      const raw: GeminiRawOutput = {
        candidates: [{ content: { parts: [{}, { text: 'only this' }] } }],
      }
      const result = adapter.transform('Gemini', raw, mockContext)
      expect(result.llmOutput.content).toBe('only this')
    })

    it('should handle missing usageMetadata (tokenUsage undefined)', () => {
      const raw: GeminiRawOutput = {
        candidates: [{ content: { parts: [{ text: 'hello' }] } }],
      }
      const result = adapter.transform('Gemini', raw, mockContext)
      expect(result.llmOutput.metadata?.tokenUsage).toBeUndefined()
    })

    it('should default missing usageMetadata fields to 0', () => {
      const raw: GeminiRawOutput = {
        candidates: [{ content: { parts: [{ text: 'hi' }] } }],
        usageMetadata: { promptTokenCount: 8 },
      }
      const result = adapter.transform('Gemini', raw, mockContext)
      expect(result.llmOutput.metadata?.tokenUsage).toEqual({
        promptTokens: 8,
        completionTokens: 0,
        totalTokens: 0,
      })
    })

    it('should handle multiple candidates by using first', () => {
      const raw: GeminiRawOutput = {
        candidates: [
          { content: { parts: [{ text: 'first' }] }, finishReason: 'STOP' },
          {
            content: { parts: [{ text: 'second' }] },
            finishReason: 'MAX_TOKENS',
          },
        ],
      }
      const result = adapter.transform('Gemini', raw, mockContext)
      expect(result.llmOutput.content).toBe('first')
      expect(result.llmOutput.metadata?.finishReason).toBe('STOP')
    })
  })

  // -------------------------------------------------------------------------

  describe('cross-provider consistency', () => {
    it('should return UnifiedProcessingRequest shape for all providers', () => {
      const providers: Array<[LLMProvider, unknown]> = [
        ['MentalLLaMA', mentalLLaMARaw],
        ['OpenAI', openAIRaw],
        ['Anthropic', anthropicRaw],
        ['Gemini', geminiRaw],
      ]

      for (const [provider, raw] of providers) {
        const result = adapter.transform(provider, raw, mockContext)

        expect(result).toHaveProperty('llmOutput')
        expect(result).toHaveProperty('context')
        expect(result.context).toBe(mockContext)
        expect(typeof result.llmOutput.content).toBe('string')
        expect(result.llmOutput.metadata).toBeTypeOf('object')
      }
    })

    it('should include provider in metadata for all providers', () => {
      const cases: Array<[LLMProvider, unknown, string]> = [
        ['MentalLLaMA', mentalLLaMARaw, 'MentalLLaMA'],
        ['OpenAI', openAIRaw, 'OpenAI'],
        ['Anthropic', anthropicRaw, 'Anthropic'],
        ['Gemini', geminiRaw, 'Gemini'],
      ]

      for (const [provider, raw, expected] of cases) {
        const result = adapter.transform(provider, raw, mockContext)
        expect(result.llmOutput.metadata?.provider).toBe(expected)
      }
    })
  })
})
