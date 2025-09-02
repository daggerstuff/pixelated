import { useState, useCallback } from 'react'
import { useChat } from './useChat'
import { useMemory } from './useMemory'

export interface ChatWithMemoryOptions {
  initialMessages?: Array<{ role: 'user' | 'assistant'; content: string }>
  memoryKey?: string
}

export function useChatWithMemory(options: ChatWithMemoryOptions = {}): void {
  const { initialMessages = [] } = options
  const [isLoading, setIsLoading] = useState(false)

  const chat = useChat({ initialMessages })
  const memory = useMemory()

  const sendMessageWithMemory = useCallback(async (message: string) => {
    setIsLoading(true)
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
    } finally {
      setIsLoading(false)
    }
  }, [chat, memory])

  return {
    ...chat,
    sendMessage: sendMessageWithMemory,
    isLoading: isLoading || chat.isLoading,
    memory
  }
}
