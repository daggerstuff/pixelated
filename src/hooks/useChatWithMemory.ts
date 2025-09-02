import { useState, useCallback, ChangeEvent } from 'react'
import { useChat, UseChatReturn } from './useChat'
import { useMemory, UseMemoryReturn } from './useMemory'

import type { Message } from '@/types/chat'

export interface ChatWithMemoryOptions {
  initialMessages?: Message[]
  memoryKey?: string
  sessionId?: string
  enableMemory?: boolean
  enableAnalysis?: boolean
  maxMemoryContext?: number
}

export type UseChatWithMemoryReturn = UseChatReturn & {
  memory: UseMemoryReturn
  sendMessage: (message: string) => Promise<string | undefined>
}

export function useChatWithMemory(
  options: ChatWithMemoryOptions = {},
): UseChatWithMemoryReturn {
  const { initialMessages = [], sessionId } = options
  const [isLoading, setIsLoading] = useState(false)

  const chat = useChat({ initialMessages })
  const memory = useMemory({
    userId: sessionId,
    category: 'conversation',
    autoLoad: true,
  })

  const sendMessageWithMemory = useCallback(
    async (message: string) => {
      setIsLoading(true)
      try {
        if (options.enableMemory) {
          await memory.addMemory(
            `user: ${message}`,
            {
              role: 'user',
              sessionId,
            },
          )
        }

        const response = await chat.handleSubmit({
          preventDefault: () => {},
        } as unknown as React.FormEvent)

        const lastMessage = chat.messages[chat.messages.length - 1]
        const responseContent = lastMessage?.content

        if (options.enableMemory && responseContent) {
          await memory.addMemory(
            `assistant: ${responseContent}`,
            {
              role: 'assistant',
              sessionId,
            },
          )
        }

        return responseContent
      } finally {
        setIsLoading(false)
      }
    },
    [chat, memory, options.enableMemory, sessionId],
  )

  return {
    ...chat,
    sendMessage: sendMessageWithMemory,
    isLoading: isLoading || chat.isLoading,
    memory,
  }
}
