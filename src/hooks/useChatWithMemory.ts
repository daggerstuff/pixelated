import { useState, useCallback } from 'react'
import { useChat } from './useChat'
import { useMemory } from './useMemory'

import type { Message } from '@/types/chat'

export interface ChatWithMemoryOptions {
  initialMessages?: Message[]
  memoryKey?: string
}

export function useChatWithMemory(options: ChatWithMemoryOptions = {}) {
  const { initialMessages = [] } = options
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const chat = useChat({ initialMessages, onError: (e) => setError(e.message) })
  const memory = useMemory()

  const sendMessageWithMemory = useCallback(async (message: string) => {
    setIsLoading(true)
    setError(null)
    try {
      // Store message in memory
      await memory.addMemory({
        content: message,
        type: 'user_message',
        metadata: { timestamp: new Date().toISOString() }
      })

      // Send message through chat
      const response = await chat.sendMessage(message)

      // Store response in memory
      if (response) {
        await memory.addMemory({
          content: response,
          type: 'assistant_response',
          metadata: { timestamp: new Date().toISOString() }
        })
      }

      return response
    } finally {
      setIsLoading(false)
    }
  }, [chat, memory])

      return response
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    finally {
      setIsLoading(false)
    }
  }, [chat, memory])

  const clearMessages = useCallback(() => {
    chat.setMessages([])
  }, [chat])

  const regenerateResponse = useCallback(async () => {
    const lastUserMessage = chat.messages.filter((m) => m.role === 'user').pop()
    if (lastUserMessage) {
      const lastMessage = chat.messages[chat.messages.length - 1]
      if (lastMessage && lastMessage.role === 'assistant') {
        chat.setMessages(chat.messages.slice(0, -1))
      }
      await sendMessageWithMemory(lastUserMessage.content)
    }
  }, [chat.messages, chat.setMessages, sendMessageWithMemory])

  return {
    ...chat,
    sendMessage: sendMessageWithMemory,
    isLoading: isLoading || chat.isLoading,
    error,
    clearMessages,
    regenerateResponse,
    memory,
    getConversationSummary: () => Promise.resolve(''),
    memoryStats: {},
  }
}
