import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useChatCompletion } from '../useChatCompletion'

const mockFetch = vi.fn()
global.fetch = mockFetch

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response
}

function errorResponse(status: number, error?: string): Response {
  return {
    ok: false,
    status,
    json: async () => (error ? { error } : {}),
  } as unknown as Response
}

function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  let index = 0
  const body = {
    getReader() {
      return {
        read: async (): Promise<
          { done: false; value: Uint8Array } | { done: true; value?: undefined }
        > =>
          index < chunks.length
            ? { done: false, value: encoder.encode(chunks[index++]) }
            : { done: true },
      }
    },
  }
  return {
    ok: true,
    status: 200,
    body,
  } as unknown as Response
}

function nonStreamingReply(content: string): {
  choices: Array<{ message: { content: string } }>
} {
  return { choices: [{ message: { content } }] }
}

describe('useChatCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // The global setup replaces window.localStorage with vi.fn() stubs that
    // do not store values; restore an in-memory implementation (same
    // pattern as saved-views-service.test.ts).
    const store = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
        clear: () => {
          store.clear()
        },
        length: 0,
        key: (index: number) => Array.from(store.keys())[index] ?? null,
      },
      writable: true,
      configurable: true,
    })
  })

  describe('initial state', () => {
    it('starts empty with no loading state', () => {
      const { result } = renderHook(() => useChatCompletion())

      expect(result.current.messages).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isStreaming).toBe(false)
      expect(result.current.isTyping).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.progress).toBe(0)
    })

    it('uses provided initial messages', () => {
      const initial = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there' },
      ]
      const { result } = renderHook(() => useChatCompletion({ initialMessages: initial }))

      expect(result.current.messages).toEqual(initial)
      expect(result.current.conversationStats.messageCount).toBe(2)
      expect(result.current.conversationStats.userMessages).toBe(1)
      expect(result.current.conversationStats.assistantMessages).toBe(1)
    })

    it('loads persisted messages from localStorage when persistKey is set', () => {
      const saved = [{ role: 'user' as const, content: 'saved' }]
      localStorage.setItem('chat-key', JSON.stringify(saved))

      const { result } = renderHook(() =>
        useChatCompletion({ persistKey: 'chat-key' }),
      )

      expect(result.current.messages).toEqual(saved)
    })
  })

  describe('sendMessage (non-streaming)', () => {
    it('sends request and appends user and assistant messages', async () => {
      mockFetch.mockResolvedValue(jsonResponse(nonStreamingReply('Hello back')))
      const onComplete = vi.fn()
      const { result } = renderHook(() =>
        useChatCompletion({ streamingEnabled: false, onComplete }),
      )

      await act(async () => {
        await result.current.sendMessage('Hi')
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0] as unknown as [
        string,
        { body: string },
      ]
      expect(url).toBe('/api/ai/completion')
      const payload = JSON.parse(init.body) as {
        model: string
        messages: Array<{ role: string; content: string }>
        temperature: number
        maxTokens: number
        stream: boolean
      }
      expect(payload.model).toBe('gpt-4o')
      expect(payload.temperature).toBeCloseTo(0.7)
      expect(payload.maxTokens).toBe(1024)
      expect(payload.stream).toBe(false)
      expect(payload.messages).toEqual([
        { role: 'user', content: 'Hi', name: '' },
      ])

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2)
      })
      expect(result.current.messages[0]).toMatchObject({ role: 'user', content: 'Hi' })
      expect(result.current.messages[1]).toMatchObject({
        role: 'assistant',
        content: 'Hello back',
      })
      expect(result.current.progress).toBe(100)
      expect(result.current.isLoading).toBe(false)
      expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('does not send when message is blank', async () => {
      const { result } = renderHook(() =>
        useChatCompletion({ streamingEnabled: false }),
      )

      await act(async () => {
        await result.current.sendMessage('   ')
      })

      expect(mockFetch).not.toHaveBeenCalled()
      expect(result.current.messages).toEqual([])
    })

    it('limits message history in the request payload', async () => {
      mockFetch.mockResolvedValue(jsonResponse(nonStreamingReply('ok')))
      const initial = [
        { role: 'user' as const, content: 'one' },
        { role: 'assistant' as const, content: 'two' },
        { role: 'user' as const, content: 'three' },
      ]
      const { result } = renderHook(() =>
        useChatCompletion({ streamingEnabled: false, initialMessages: initial, messageHistory: 2 }),
      )

      await act(async () => {
        await result.current.sendMessage('four')
      })

      const [, init] = mockFetch.mock.calls[0] as unknown as [string, { body: string }]
      const payload = JSON.parse(init.body) as {
        messages: Array<{ content: string }>
      }
      expect(payload.messages.map((m) => m.content)).toEqual(['three', 'four'])
    })

    it('sets error state and calls onError for non-retryable failures', async () => {
      mockFetch.mockResolvedValue(errorResponse(400, 'Bad request'))
      const onError = vi.fn()
      const { result } = renderHook(() =>
        useChatCompletion({ streamingEnabled: false, onError }),
      )

      await act(async () => {
        await expect(result.current.sendMessage('Hi')).rejects.toThrow('Bad request')
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result.current.error).toBe('Bad request')
      expect(onError).toHaveBeenCalledTimes(1)
      expect(result.current.isLoading).toBe(false)
    })

    it('retries on retryable 5xx failures with backoff', async () => {
      // No error body, so the thrown message includes the status code and
      // isRetryableError recognizes it as a 5xx failure.
      mockFetch
        .mockResolvedValueOnce(errorResponse(500))
        .mockResolvedValue(jsonResponse(nonStreamingReply('recovered')))
      const { result } = renderHook(() =>
        useChatCompletion({ streamingEnabled: false }),
      )

      await act(async () => {
        await result.current.sendMessage('Hi')
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.current.error).toBeNull()
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2)
      })
      expect(result.current.messages[1]).toMatchObject({ content: 'recovered' })
    })

    it('gives up after maxRetries and surfaces the error', async () => {
      mockFetch.mockResolvedValue(errorResponse(500))
      const { result } = renderHook(() =>
        useChatCompletion({ streamingEnabled: false, maxRetries: 2 }),
      )

      await act(async () => {
        await expect(result.current.sendMessage('Hi')).rejects.toThrow()
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.current.error).toBe('Failed to get AI response: 500')
    })
  })

  describe('sendMessage (streaming)', () => {
    it('accumulates streamed chunks into the assistant message', async () => {
      mockFetch.mockResolvedValue(
        streamResponse([
          'data: {"content":"He"}\n',
          'data: {"content":"llo"}\n\n',
          'data: [DONE]\n',
        ]),
      )
      const onProgress = vi.fn()
      const onTypingStart = vi.fn()
      const onTypingStop = vi.fn()
      const { result } = renderHook(() =>
        useChatCompletion({ onProgress, onTypingStart, onTypingStop }),
      )

      await act(async () => {
        await result.current.sendMessage('Hi')
      })

      expect(onTypingStart).toHaveBeenCalledTimes(1)
      expect(onTypingStop).toHaveBeenCalledTimes(1)
      expect(onProgress).toHaveBeenNthCalledWith(1, 'He', 'He')
      expect(onProgress).toHaveBeenNthCalledWith(2, 'llo', 'Hello')

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2)
      })
      expect(result.current.messages[1]).toMatchObject({
        role: 'assistant',
        content: 'Hello',
      })
      expect(result.current.progress).toBe(100)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isStreaming).toBe(false)
    })
  })

  describe('sendStreamingMessage', () => {
    it('yields each chunk and completes the conversation', async () => {
      mockFetch.mockResolvedValue(
        streamResponse([
          'data: {"content":"A"}\n',
          'data: {"content":"B"}\n',
          'data: [DONE]\n',
        ]),
      )
      const onComplete = vi.fn()
      const { result } = renderHook(() =>
        useChatCompletion({ onComplete }),
      )

      const chunks: string[] = []
      await act(async () => {
        const generator = result.current.sendStreamingMessage('Hi')
        for await (const chunk of generator) {
          chunks.push(chunk)
        }
      })

      expect(chunks).toEqual(['A', 'B'])
      expect(onComplete).toHaveBeenCalledWith('AB')
      expect(result.current.messages).toHaveLength(2)
      expect(result.current.messages[1]).toMatchObject({ content: 'AB' })
      expect(result.current.isStreaming).toBe(false)
    })

    it('does not start for blank input', async () => {
      const { result } = renderHook(() => useChatCompletion())

      const chunks: string[] = []
      await act(async () => {
        for await (const chunk of result.current.sendStreamingMessage('  ')) {
          chunks.push(chunk)
        }
      })

      expect(chunks).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
      expect(result.current.messages).toEqual([])
    })
  })

  describe('message management', () => {
    it('edits a message by index', () => {
      const initial = [
        { role: 'user' as const, content: 'original' },
        { role: 'assistant' as const, content: 'reply' },
      ]
      const { result } = renderHook(() =>
        useChatCompletion({ initialMessages: initial }),
      )

      act(() => {
        result.current.editMessage(0, 'edited')
      })

      expect(result.current.messages[0]).toMatchObject({ content: 'edited' })
      expect(result.current.messages).toHaveLength(2)
    })

    it('ignores edits at out-of-range indices', () => {
      const initial = [{ role: 'user' as const, content: 'only' }]
      const { result } = renderHook(() =>
        useChatCompletion({ initialMessages: initial }),
      )

      act(() => {
        result.current.editMessage(99, 'nope')
      })

      expect(result.current.messages).toEqual(initial)
    })

    it('deletes a message by index', () => {
      const initial = [
        { role: 'user' as const, content: 'one' },
        { role: 'assistant' as const, content: 'two' },
        { role: 'user' as const, content: 'three' },
      ]
      const { result } = renderHook(() =>
        useChatCompletion({ initialMessages: initial }),
      )

      act(() => {
        result.current.deleteMessage(1)
      })

      expect(result.current.messages.map((m) => m.content)).toEqual(['one', 'three'])
    })

    it('resends a user message and drops everything after it', async () => {
      mockFetch.mockResolvedValue(jsonResponse(nonStreamingReply('new reply')))
      const initial = [
        { role: 'user' as const, content: 'keep' },
        { role: 'assistant' as const, content: 'stale' },
        { role: 'user' as const, content: 'resend me' },
        { role: 'assistant' as const, content: 'old answer' },
      ]
      const { result } = renderHook(() =>
        useChatCompletion({ streamingEnabled: false, initialMessages: initial }),
      )

      await act(async () => {
        await result.current.resendMessage(2)
      })

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(4)
      })
      expect(result.current.messages.map((m) => m.content)).toEqual([
        'keep',
        'stale',
        'resend me',
        'new reply',
      ])
    })

    it('stops generation and notifies typing callbacks', () => {
      const onTypingStop = vi.fn()
      const { result } = renderHook(() =>
        useChatCompletion({ onTypingStop }),
      )

      act(() => {
        result.current.stopGeneration()
      })

      expect(onTypingStop).toHaveBeenCalledTimes(1)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isStreaming).toBe(false)
    })
  })

  describe('persistence', () => {
    it('auto-saves messages to localStorage', async () => {
      mockFetch.mockResolvedValue(jsonResponse(nonStreamingReply('ok')))
      const { result } = renderHook(() =>
        useChatCompletion({
          streamingEnabled: false,
          autoSave: true,
          persistKey: 'auto-chat',
        }),
      )

      await act(async () => {
        await result.current.sendMessage('persist me')
      })

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2)
      })
      const saved = JSON.parse(
        localStorage.getItem('auto-chat') ?? '[]',
      ) as Array<{ content: string }>
      expect(saved.map((m) => m.content)).toEqual(['persist me', 'ok'])
    })

    it('resets the chat and clears persisted storage', () => {
      const saved = [{ role: 'user' as const, content: 'old' }]
      localStorage.setItem('reset-key', JSON.stringify(saved))
      const { result } = renderHook(() =>
        useChatCompletion({ persistKey: 'reset-key' }),
      )

      expect(result.current.messages).toEqual(saved)

      act(() => {
        result.current.resetChat()
      })

      expect(result.current.messages).toEqual([])
      expect(localStorage.getItem('reset-key')).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('saves the current conversation to localStorage', async () => {
      mockFetch.mockResolvedValue(jsonResponse(nonStreamingReply('ok')))
      const { result } = renderHook(() =>
        useChatCompletion({
          streamingEnabled: false,
          persistKey: 'manual-key',
        }),
      )

      await act(async () => {
        await result.current.sendMessage('save me')
      })
      await act(async () => {
        result.current.saveConversation()
      })

      const saved = JSON.parse(
        localStorage.getItem('manual-key') ?? '[]',
      ) as Array<{ content: string }>
      expect(saved.map((m) => m.content)).toEqual(['save me', 'ok'])
    })

    it('loads a saved conversation from localStorage', () => {
      const saved = [
        { role: 'user' as const, content: 'restored' },
        { role: 'assistant' as const, content: 'hi' },
      ]

      const { result } = renderHook(() =>
        useChatCompletion({ persistKey: 'load-key' }),
      )
      expect(result.current.messages).toEqual([])

      localStorage.setItem('load-key', JSON.stringify(saved))
      act(() => {
        result.current.loadConversation()
      })
      expect(result.current.messages).toEqual(saved)
    })
  })

  describe('export / import', () => {
    it('exports messages with stats and token usage', () => {
      const initial = [
        { role: 'user' as const, content: 'Hi' },
        { role: 'assistant' as const, content: 'Hello' },
      ]
      const { result } = renderHook(() =>
        useChatCompletion({ initialMessages: initial }),
      )

      const exported = JSON.parse(result.current.exportConversation()) as {
        messages: Array<{ content: string }>
        stats: { messageCount: number }
        tokenUsage: { totalTokens: number }
        exportDate: string
      }

      expect(exported.messages.map((m) => m.content)).toEqual(['Hi', 'Hello'])
      expect(exported.stats.messageCount).toBe(2)
      expect(exported.tokenUsage.totalTokens).toBeGreaterThan(0)
      expect(new Date(exported.exportDate).toISOString()).toBe(
        exported.exportDate,
      )
    })

    it('imports a previously exported conversation', () => {
      const { result } = renderHook(() => useChatCompletion())

      const data = JSON.stringify({
        messages: [
          { role: 'user', content: 'imported' },
          { role: 'assistant', content: 'yes' },
        ],
      })

      act(() => {
        result.current.importConversation(data)
      })

      expect(result.current.messages.map((m) => m.content)).toEqual([
        'imported',
        'yes',
      ])
    })

    it('ignores invalid import data without throwing', () => {
      const { result } = renderHook(() => useChatCompletion())

      act(() => {
        result.current.importConversation('not valid json')
      })

      expect(result.current.messages).toEqual([])
    })
  })

  describe('stats', () => {
    it('computes token usage from message content', () => {
      const initial = [{ role: 'user' as const, content: 'aaaa' }]
      const { result } = renderHook(() =>
        useChatCompletion({ initialMessages: initial }),
      )

      const { totalTokens, promptTokens, completionTokens, estimatedCost } =
        result.current.tokenUsage
      expect(totalTokens).toBe(promptTokens + completionTokens)
      expect(totalTokens).toBeGreaterThan(0)
      expect(estimatedCost).toBeGreaterThan(0)
    })

    it('computes message length stats', () => {
      const initial = [
        { role: 'user' as const, content: 'Hi' },
        { role: 'assistant' as const, content: 'Hello world' },
      ]
      const { result } = renderHook(() =>
        useChatCompletion({ initialMessages: initial }),
      )

      expect(result.current.getMessageStats()).toEqual({
        longestMessage: 11,
        shortestMessage: 2,
        averageLength: 6.5,
        sentimentDistribution: {},
      })
    })

    it('returns zeroed stats for an empty conversation', () => {
      const { result } = renderHook(() => useChatCompletion())

      expect(result.current.getMessageStats()).toEqual({
        longestMessage: 0,
        shortestMessage: 0,
        averageLength: 0,
        sentimentDistribution: {},
      })
    })
  })
})
