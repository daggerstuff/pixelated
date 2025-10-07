import type { Message } from '@/types/chat'
import { useState, useCallback } from 'react'
import { useChat, type UseChatReturn } from './useChat'
import { useMemory, type UseMemoryReturn } from './useMemory'

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

  const sendMessage = useCallback(
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

        // This is a bit of a hack to get the form submission to work
        // without a form event.
        const fakeEvent = {
          preventDefault: () => {},
        } as unknown as React.FormEvent<HTMLFormElement>
        await chat.handleSubmit(fakeEvent)

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
    sendMessage,
    isLoading: isLoading || chat.isLoading,
    memory,
  }
}
