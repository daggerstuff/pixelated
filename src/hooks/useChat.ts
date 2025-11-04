import type { ChatOptions } from '@/types/chat'
import type { ChangeEvent } from 'react'
import { useState } from 'react'

interface LocalMessage {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  name: string
  encrypted?: boolean
  verified?: boolean
  isError?: boolean
}

export interface UseChatReturn {
  messages: LocalMessage[]
  input: string
  handleInputChange: (e: ChangeEvent<HTMLInputElement>) => void
  handleSubmit: (e: React.FormEvent) => Promise<void>
  isLoading: boolean
  setMessages: React.Dispatch<React.SetStateAction<LocalMessage[]>>
  sendMessage: (content: string) => Promise<string | undefined>
}

/**
 * Custom React hook for chat messaging interface.
 * @param options ChatOptions for initialization and API hooks.
 */
export function useChat(options: ChatOptions): UseChatReturn {
  const {
    initialMessages = [],
    api = '/api/chat',
    body = {},
    onResponse,
    onError,
  } = options

  const [messages, setMessages] = useState<LocalMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const sendMessage = async (content: string): Promise<string | undefined> => {
    if (!content.trim()) {
      return
    }

    // Add user message
    const userMessage: LocalMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      name: 'User',
    }

    setMessages((prev: LocalMessage[]) => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Prepare the request - format for mental health API if needed
      const requestBody = api.includes('mental-health')
        ? {
            message: content,
            sessionId: 'session_' + Date.now(),
            userContext: {
              previousMessages: messages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            },
            options: {
              enableCrisisDetection: true,
              responseStyle: 'therapeutic',
            },
            ...body,
          }
        : {
            messages: messages.concat(userMessage),
            ...body,
          }

      // Call the API
      const response = await fetch(api, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (onResponse) {
        onResponse(response)
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const responseData = await response.json()

      // Handle different API response formats
      let responseContent: string
      if (api.includes('mental-health')) {
        // Mental health API returns { response: { content: "..." } }
        responseContent =
          responseData.response?.content ||
          responseData.response?.message ||
          'No response from therapeutic AI'
      } else {
        // Standard chat API format
        responseContent =
          responseData.text ||
          responseData.content ||
          responseData.message ||
          'No response content'
      }

      // Add assistant message from response
      const assistantMessage: LocalMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseContent,
        encrypted: responseData.encrypted,
        verified: responseData.verified,
        name: 'Therapeutic AI',
      }

      setMessages((prev: LocalMessage[]) => [...prev, assistantMessage])
      return assistantMessage.content
    } catch (error: unknown) {
      console.error('Error in chat:', error)

      // Add error message
      const errorMessage: LocalMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${(error as Error).message}`,
        isError: true,
        name: 'Error',
      }

      setMessages((prev: LocalMessage[]) => [...prev, errorMessage])

      if (onError) {
        onError(error as Error)
      }
      return undefined
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    await sendMessage(input)
    setInput('')
  }

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
    sendMessage,
  }
}
