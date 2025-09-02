import { useState, useCallback, ChangeEvent } from 'react'
import { useChat, UseChatReturn } from './useChat'
import { useMemory, UseMemoryReturn } from './useMemory'

export interface ChatWithMemoryOptions {
  initialMessages?: Array<{ role: 'user' | 'assistant'; content: string }>
  memoryKey?: string
  sessionId?: string
  enableMemory?: boolean
  enableAnalysis?: boolean
  maxMemoryContext?: number
}

<<<<<<< HEAD
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
=======
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
>>>>>>> 243f975 (Fix numerous TypeScript errors across the codebase)

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
<<<<<<< HEAD

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
=======
    },
    [chat, memory, options.enableMemory, sessionId],
  )
>>>>>>> 243f975 (Fix numerous TypeScript errors across the codebase)

  return {
    ...chat,
    sendMessage: sendMessageWithMemory,
    isLoading: isLoading || chat.isLoading,
<<<<<<< HEAD
    memory
=======
    memory,
>>>>>>> 243f975 (Fix numerous TypeScript errors across the codebase)
  }
}
