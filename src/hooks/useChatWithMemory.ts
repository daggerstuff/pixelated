import { useState, useCallback } from 'react'
import { useChat } from './useChat'
import { useMemory } from './useMemory'
import type { Message } from '@/types/message'

export interface ChatWithMemoryOptions {
  initialMessages?: Message[]
  memoryKey?: string
  sessionId?: string
  enableMemory?: boolean
  enableAnalysis?: boolean
  maxMemoryContext?: number
}

// Compose the return types from useChat and useMemory into a single interface
type UseChatReturn = ReturnType<typeof useChat>
type UseMemoryReturn = ReturnType<typeof useMemory>

export interface UseChatWithMemoryReturn extends UseChatReturn {
  // override sendMessage to include memory persistence
  sendMessage: (message: string) => Promise<string | undefined>
  // indicate loading when either subsystem is loading
  isLoading: boolean
  // expose the memory API for advanced usage
  memory: UseMemoryReturn
}

export function useChatWithMemory(options: ChatWithMemoryOptions = {}): UseChatWithMemoryReturn {
  const { initialMessages = [] } = options
  const [isLoading, setIsLoading] = useState(false)

  const chat = useChat({ initialMessages })
  const memory = useMemory({
    userId: sessionId,
    category: 'conversation',
    autoLoad: true,
  })

  const sendMessageWithMemory = useCallback(async (message: string) => {
    setIsLoading(true)
    try {
      // Build user message object
      const userMessage: Message = {
        role: 'user',
        content: message,
        name: 'User',
      }

      // Persist to memory
      await memory.addMemory(`${message}`, { timestamp: new Date().toISOString(), role: 'user' as any })

      // Optimistically add user message to local state
      chat.setMessages((prev) => [...prev, userMessage as any])

      // Call the chat API directly (mirrors useChat handleSubmit behavior)
      const requestBody = {
        messages: chat.messages.concat(userMessage as any),
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const responseData = await response.json()
      const assistantContent = responseData.text || responseData.content || responseData.message || 'No response content'

      const assistantMessage: Message = {
        role: 'assistant',
        content: assistantContent,
        name: 'Assistant',
      }

      // Add assistant message to memory and local state
      await memory.addMemory(`${assistantContent}`, { timestamp: new Date().toISOString(), role: 'assistant' as any })
      chat.setMessages((prev) => [...prev, assistantMessage as any])

      return assistantContent
    } catch (err) {
      console.error('Error in sendMessageWithMemory:', err)
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${(err as Error).message}`,
        name: 'Error',
      }
      chat.setMessages((prev) => [...prev, errorMessage as any])
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [chat, memory])

  return {
    ...chat,
    sendMessage: sendMessageWithMemory,
    isLoading: isLoading || chat.isLoading,
    memory,
  }
}
