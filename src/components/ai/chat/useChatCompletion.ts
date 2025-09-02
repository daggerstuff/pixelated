import type { AIMessage } from '../../../lib/ai/index'
import type { AIStreamChunk } from '../../../lib/ai/models/ai-types'
import { useCallback, useState, useRef, useEffect } from 'react'

interface UseChatCompletionOptions {
  apiEndpoint?: string
  model?: string
  initialMessages?: AIMessage[]
  temperature?: number
  maxTokens?: number
  maxRetries?: number
  timeout?: number
  streamingEnabled?: boolean
  autoSave?: boolean
  persistKey?: string
  messageHistory?: number
  onError?: (error: Error) => void
  onComplete?: (response: string) => void
  onProgress?: (chunk: string, accumulated: string) => void
  onTypingStart?: () => void
  onTypingStop?: () => void
  onMessageSaved?: (messages: AIMessage[]) => void
}

interface UseChatCompletionResult {
  messages: AIMessage[]
  isLoading: boolean
  isStreaming: boolean
  isTyping: boolean
  error: string | null
  progress: number
  tokenUsage: TokenUsage
  conversationStats: ConversationStats
  sendMessage: (message: string, context?: Partial<AIMessage>) => Promise<void>
  sendStreamingMessage: (message: string, context?: Partial<AIMessage>) => AsyncGenerator<string, void, unknown>
  editMessage: (index: number, newContent: string) => void
  deleteMessage: (index: number) => void
  resendMessage: (index: number) => Promise<void>
  resetChat: () => void
  retryLastMessage: () => Promise<void>
  saveConversation: () => void
  loadConversation: () => void
  exportConversation: () => string
  importConversation: (data: string) => void
  stopGeneration: () => void
  getMessageStats: () => MessageStats
}

interface TokenUsage {
  totalTokens: number
  promptTokens: number
  completionTokens: number
  estimatedCost: number
}

interface ConversationStats {
  messageCount: number
  userMessages: number
  assistantMessages: number
  avgResponseTime: number
  totalDuration: number
  startTime: Date | null
}

interface MessageStats {
  longestMessage: number
  shortestMessage: number
  averageLength: number
  sentimentDistribution: { [key: string]: number }
}

/**
 * Checks if an error is retryable for chat completion
 */
function isRetryableError(error: unknown): boolean {
  // Network errors are retryable
  if (error instanceof TypeError && String(error).includes('network')) {
    return true
  }

  // Server errors (5xx) are retryable
  if (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status >= 500 && error.status < 600
  }

  // Rate limit errors (429) are retryable with backoff
  if (
    error instanceof Error &&
    'status' in error &&
    error.status === 429
  ) {
    return true
  }

  // Response errors with 5xx status
  if (error instanceof Error && String(error).includes('50')) {
    return true
  }

  return false
}

/**
 * Calculate token usage and estimated cost
 */
function calculateTokenUsage(messages: AIMessage[], model: string): TokenUsage {
  // Rough estimation - in production, you'd get this from the API response
  const totalText = messages.map(m => m.content).join(' ')
  const estimatedTokens = Math.ceil(totalText.length / 4) // Rough GPT tokenization

  const promptTokens = Math.ceil(estimatedTokens * 0.7)
  const completionTokens = Math.ceil(estimatedTokens * 0.3)

  // Rough cost estimation (varies by model)
  const costPerToken = model.includes('gpt-4') ? 0.00003 : 0.000002
  const estimatedCost = (promptTokens + completionTokens) * costPerToken

  return {
    totalTokens: promptTokens + completionTokens,
    promptTokens,
    completionTokens,
    estimatedCost,
  }
}

/**
 * Enhanced custom hook for handling chat completions with advanced features
 */
export function useChatCompletion({
  apiEndpoint = '/api/ai/completion',
  model = 'gpt-4o',
  initialMessages = [],
  temperature = 0.7,
  maxTokens = 1024,
  maxRetries = 3,
  timeout = 30000,
  streamingEnabled = true,
  autoSave = false,
  persistKey,
  messageHistory = 100,
  onError,
  onComplete,
  onProgress,
  onTypingStart,
  onTypingStop,
  onMessageSaved,
}: UseChatCompletionOptions = {}): UseChatCompletionResult {
  const [messages, setMessages] = useState<AIMessage[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const [conversationStats, setConversationStats] = useState<ConversationStats>({
    messageCount: initialMessages.length,
    userMessages: initialMessages.filter(m => m.role === 'user').length,
    assistantMessages: initialMessages.filter(m => m.role === 'assistant').length,
    avgResponseTime: 0,
    totalDuration: 0,
    startTime: initialMessages.length > 0 ? new Date() : null,
  })

  // Store last user message for retry functionality
  const lastUserMessageRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const responseTimesRef = useRef<number[]>([])
  const messageStartTimeRef = useRef<number | null>(null)

  // Calculate token usage
  const tokenUsage = calculateTokenUsage(messages, model)

  // Auto-save messages when they change
  useEffect(() => {
    if (autoSave && persistKey && messages.length > 0) {
      try {
        localStorage.setItem(persistKey, JSON.stringify(messages))
        if (onMessageSaved) {
          onMessageSaved(messages)
        }
      } catch (err: unknown) {
        console.warn('Failed to auto-save conversation:', err)
      }
    }
  }, [messages, autoSave, persistKey, onMessageSaved])

  // Load conversation from storage on mount
  useEffect(() => {
    if (persistKey && messages.length === 0) {
      try {
        const saved = localStorage.getItem(persistKey)
        if (saved) {
          const parsedMessages = JSON.parse(saved) as unknown as AIMessage[]
          setMessages(parsedMessages)
          setConversationStats(prev => ({
            ...prev,
            messageCount: parsedMessages.length,
            userMessages: parsedMessages.filter(m => m.role === 'user').length,
            assistantMessages: parsedMessages.filter(m => m.role === 'assistant').length,
            startTime: new Date(),
          }))
        }
      } catch (err: unknown) {
        console.warn('Failed to load conversation:', err)
      }
    }
  }, [persistKey, messages.length])

  // Reset chat to initial state
  const resetChat = useCallback(() => {
    setMessages(initialMessages)
    setIsLoading(false)
    setIsStreaming(false)
    setIsTyping(false)
    setError(null)
    setProgress(0)
    lastUserMessageRef.current = null
    responseTimesRef.current = []
    
    setConversationStats({
      messageCount: initialMessages.length,
      userMessages: initialMessages.filter(m => m.role === 'user').length,
      assistantMessages: initialMessages.filter(m => m.role === 'assistant').length,
      avgResponseTime: 0,
      totalDuration: 0,
      startTime: initialMessages.length > 0 ? new Date() : null,
    })

    // Clear persistence
    if (persistKey) {
      try {
        localStorage.removeItem(persistKey)
      } catch (err: unknown) {
        console.warn('Failed to clear saved conversation:', err)
      }
    }

    // Abort any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [initialMessages, persistKey])

  // Stop ongoing generation
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsLoading(false)
    setIsStreaming(false)
    setIsTyping(false)
    setProgress(0)

    if (onTypingStop) {
      onTypingStop()
    }
  }, [onTypingStop])

  // Core function to make API request
  const makeRequest = useCallback(
    async (requestMessages: AIMessage[]): Promise<Response> => {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController()
      
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
      }, timeout)

      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: requestMessages.slice(-messageHistory), // Limit message history
            temperature,
            maxTokens,
            stream: streamingEnabled,
          }),
          signal: abortControllerRef.current.signal,
        })

        clearTimeout(timeoutId)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(
            errorData.error ||
              `Failed to get AI response: ${response.status}`,
          )
        }

        return response
      } catch (err: unknown) {
        clearTimeout(timeoutId)
        throw err
      }
    },
    [apiEndpoint, model, temperature, maxTokens, streamingEnabled, messageHistory, timeout]
  )

  // Send a message to the AI API
  const sendMessage = useCallback(
    async (message: string, context?: Partial<AIMessage>) => {
      if (!message.trim() || isLoading) {
        return
      }

      lastUserMessageRef.current = message
      messageStartTimeRef.current = Date.now()
      setIsLoading(true)
      setIsStreaming(streamingEnabled)
      setIsTyping(true)
      setError(null)
      setProgress(0)

      if (onTypingStart) {
        onTypingStart()
      }

      // Update conversation stats
      setConversationStats(prev => ({
        ...prev,
        startTime: prev.startTime || new Date(),
        messageCount: prev.messageCount + 1,
        userMessages: prev.userMessages + 1,
      }))

      // Implement retry logic with exponential backoff
      let retries = 0
      let success = false

      while (retries < maxRetries && !success) {
        try {
          // Add user message to chat
          const userMessage: AIMessage = {
            role: 'user',
            content: message,
            name: context?.name || '',
            ...context,
          }
          
          const updatedMessages = [...messages, userMessage]
          setMessages(updatedMessages)

          const response = await makeRequest(updatedMessages)

          if (streamingEnabled) {
            // Handle streaming response
            const reader = response.body?.getReader()
            if (!reader) {
              throw new Error('Response body is null')
            }

            let assistantMessage = ''
            const decoder = new TextDecoder('utf-8')

            while (true) {
              const { done, value } = await reader.read()

              if (done) {
                break
              }

              const chunk = decoder.decode(value)
              const lines = chunk
                .split('\n')
                .filter((line) => line.trim() !== '')
                .map((line) => line.replace(/^data: /, '').trim())

              for (const line of lines) {
                if (line === '[DONE]') {
                  break
                }

                try {
                  const data = JSON.parse(line) as unknown as AIStreamChunk
                  const content = data?.content

                  if (content) {
                    assistantMessage += content

                    // Update progress
                    const estimatedProgress = Math.min(
                      (assistantMessage.length / maxTokens) * 100,
                      95
                    )
                    setProgress(estimatedProgress)

                    if (onProgress) {
                      onProgress(content, assistantMessage)
                    }

                    // Update messages with current content
                    setMessages((prev) => {
                      const newMessages = [...prev]
                      const lastMessage = newMessages[newMessages.length - 1]

                      if (lastMessage?.role === 'assistant') {
                        // Update existing assistant message
                        newMessages[newMessages.length - 1] = {
                          ...lastMessage,
                          content: assistantMessage,
                        }
                      } else {
                        // Add new assistant message
                        newMessages.push({
                          role: 'assistant',
                          content: assistantMessage,
                          name: '',
                        } as const)
                      }

                      return newMessages
                    })
                  }

                  if (data?.finishReason === 'stop' || data?.done) {
                    break
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          } else {
            // Handle non-streaming response
            const data = await response.json()
            const assistantMessage = data.choices?.[0]?.message?.content || ''
            
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: assistantMessage,
              name: '',
            }])
          }

          setProgress(100)

          // Update response time tracking
          if (messageStartTimeRef.current) {
            const responseTime = Date.now() - messageStartTimeRef.current
            responseTimesRef.current.push(responseTime)
            
            const avgResponseTime = responseTimesRef.current.reduce((a, b) => a + b, 0) / responseTimesRef.current.length
            
            setConversationStats(prev => ({
              ...prev,
              assistantMessages: prev.assistantMessages + 1,
              avgResponseTime,
              totalDuration: Date.now() - (prev.startTime?.getTime() || 0),
            }))
          }

          if (onComplete) {
            onComplete(messages[messages.length - 1]?.content || '')
          }

          success = true
        } catch (err: unknown) {
          if (retries === maxRetries - 1 || !isRetryableError(err)) {
            const errorMessage =
              err instanceof Error ? (err as Error)?.message || String(err) : 'An unknown error occurred'
            setError(errorMessage)

            if (onError && err instanceof Error) {
              onError(err)
            }
            throw err
          }

          retries++
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, 2 ** retries * 300),
          )
        } finally {
          if (success || retries === maxRetries) {
            setIsLoading(false)
            setIsStreaming(false)
            setIsTyping(false)
            
            if (onTypingStop) {
              onTypingStop()
            }
          }
        }
      }
    },
    [
      messages,
      isLoading,
      streamingEnabled,
      maxRetries,
      maxTokens,
      onTypingStart,
      onTypingStop,
      onProgress,
      onComplete,
      onError,
      makeRequest,
    ],
  )

  // Send streaming message
  const sendStreamingMessage = useCallback(
    async function* (message: string, context?: Partial<AIMessage>) {
      if (!message.trim() || isLoading) {
        return
      }

      lastUserMessageRef.current = message
      messageStartTimeRef.current = Date.now()
      setIsLoading(true)
      setIsStreaming(true)
      setIsTyping(true)
      setError(null)
      setProgress(0)

      if (onTypingStart) {
        onTypingStart()
      }

      try {
        const userMessage: AIMessage = {
          role: 'user',
          content: message,
          name: context?.name || '',
          ...context,
        }
        
        const updatedMessages = [...messages, userMessage]
        setMessages(updatedMessages)

        const response = await makeRequest(updatedMessages)
        const reader = response.body?.getReader()
        
        if (!reader) {
          throw new Error('No response body reader available')
        }

        let assistantMessage = ''
        const decoder = new TextDecoder('utf-8')

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          const chunk = decoder.decode(value)
          const lines = chunk
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line) => line.replace(/^data: /, '').trim())

          for (const line of lines) {
            if (line === '[DONE]') {
              break
            }

            try {
              const data = JSON.parse(line) as unknown as AIStreamChunk
              const content = data?.content

              if (content) {
                assistantMessage += content

                const estimatedProgress = Math.min(
                  (assistantMessage.length / maxTokens) * 100,
                  95
                )
                setProgress(estimatedProgress)

                setMessages((prev) => {
                  const newMessages = [...prev]
                  const lastMessage = newMessages[newMessages.length - 1]

                  if (lastMessage?.role === 'assistant') {
                    newMessages[newMessages.length - 1] = {
                      ...lastMessage,
                      content: assistantMessage,
                    }
                  } else {
                    newMessages.push({
                      role: 'assistant',
                      content: assistantMessage,
                      name: '',
                    } as const)
                  }

                  return newMessages
                })

                yield content
              }

              if (data?.finishReason === 'stop' || data?.done) {
                break
              }
            } catch {
              // Skip invalid JSON chunks
            }
          }
        }

        setProgress(100)

        if (onComplete) {
          onComplete(assistantMessage)
        }
      } finally {
        setIsLoading(false)
        setIsStreaming(false)
        setIsTyping(false)
        
        if (onTypingStop) {
          onTypingStop()
        }
      }
    },
    [messages, isLoading, maxTokens, onTypingStart, onTypingStop, onComplete, makeRequest]
  )

  // Edit a message
  const editMessage = useCallback((index: number, newContent: string) => {
    setMessages(prev => {
      const newMessages = [...prev]
      if (index >= 0 && index < newMessages.length) {
        const message = newMessages[index]
        if (message) {
          newMessages[index] = { ...message, content: newContent }
        }
      }
      return newMessages
    })
  }, [])

  // Delete a message
  const deleteMessage = useCallback((index: number) => {
    setMessages(prev => {
      const newMessages = [...prev]
      if (index >= 0 && index < newMessages.length) {
        newMessages.splice(index, 1)
      }
      return newMessages as typeof prev
    })
  }, [])

  // Resend a message
  const resendMessage = useCallback(async (index: number) => {
    const messageToResend = messages[index]
    if (messageToResend && messageToResend.role === 'user') {
      // Remove all messages after this one
      setMessages(prev => prev.slice(0, index))
      // Resend the message
      await sendMessage(messageToResend.content)
    }
  }, [messages, sendMessage])

  // Function to retry the last message
  const retryLastMessage = useCallback(async () => {
    if (lastUserMessageRef.current) {
      setError(null)
      await sendMessage(lastUserMessageRef.current)
    }
  }, [sendMessage])

  // Save conversation
  const saveConversation = useCallback(() => {
    if (persistKey) {
      try {
        localStorage.setItem(persistKey, JSON.stringify(messages))
        if (onMessageSaved) {
          onMessageSaved(messages)
        }
      } catch (err: unknown) {
        console.error('Failed to save conversation:', err)
      }
    }
  }, [messages, persistKey, onMessageSaved])

  // Load conversation
  const loadConversation = useCallback(() => {
    if (persistKey) {
      try {
        const saved = localStorage.getItem(persistKey)
        if (saved) {
          const parsedMessages = JSON.parse(saved) as unknown as AIMessage[]
          setMessages(parsedMessages)
        }
      } catch (err: unknown) {
        console.error('Failed to load conversation:', err)
      }
    }
  }, [persistKey])

  // Export conversation
  const exportConversation = useCallback(() => {
    return JSON.stringify({
      messages,
      stats: conversationStats,
      tokenUsage,
      exportDate: new Date().toISOString(),
    }, null, 2)
  }, [messages, conversationStats, tokenUsage])

  // Import conversation
  const importConversation = useCallback((data: string) => {
    try {
      const parsed = JSON.parse(data) as {
        messages: AIMessage[];
        stats?: ConversationStats;
      }
      if (parsed.messages && Array.isArray(parsed.messages)) {
        setMessages(parsed.messages)
        if (parsed.stats) {
          setConversationStats(parsed.stats)
        }
      }
    isTyping,
    error,
    progress,
    tokenUsage,
    conversationStats,
    sendMessage,
    sendStreamingMessage,
    editMessage,
    deleteMessage,
    resendMessage,
    resetChat,
    retryLastMessage,
    saveConversation,
    loadConversation,
    exportConversation,
    importConversation,
    stopGeneration,
    getMessageStats,
  }
}
