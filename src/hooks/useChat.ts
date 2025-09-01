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

interface UseChatReturn {
  messages: LocalMessage[]
  input: string
  handleInputChange: (e: ChangeEvent<HTMLInputElement>) => void
  handleSubmit: (e: React.FormEvent) => Promise<void>
  isLoading: boolean
  setMessages: React.Dispatch<React.SetStateAction<LocalMessage[]>>
}

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

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (!input.trim()) {
      return
    }

    // Add user message
    const userMessage: LocalMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      name: 'User',
    }

    setMessages((prev: LocalMessage[]) => [...prev, userMessage])
    setIsLoading(true)
    setInput('')

    try {
      // Prepare the request
      const requestBody = {
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

      // Add assistant message from response
      const assistantMessage: LocalMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          responseData.text ||
          responseData.content ||
          responseData.message ||
          'No response content',
        encrypted: responseData.encrypted,
        verified: responseData.verified,
        name: 'Assistant',
      }

      setMessages((prev: LocalMessage[]) => [...prev, assistantMessage])
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
    } finally {
      setIsLoading(false)
    }
  }

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
  }
}
