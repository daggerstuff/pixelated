import type { Message } from '@/types/chat'
import type { ChangeEvent, FormEvent } from 'react'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { ChatInput } from './ChatInput'
import { ChatMessage } from './ChatMessage'
import { IconBrain, IconChevronDown } from './icons'

export interface ChatContainerProps {
  messages: Message[]
  onSendMessage: (message: string) => void
  isLoading?: boolean
  error?: string
  className?: string
  inputPlaceholder?: string
  disabled?: boolean
  onRetry?: () => Promise<void>
}

export function ChatContainer({
  messages,
  onSendMessage,
  isLoading = false,
  error,
  className = '',
  inputPlaceholder,
  disabled = false,
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [input, setInput] = useState('')

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  // Show/hide scroll button based on scroll position
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
      setShowScrollButton(!isNearBottom)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleInputChange(e: ChangeEvent<HTMLTextAreaElement>): void {
    setInput(e.target.value)
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault()

    if (!input.trim() || isLoading || disabled) {
      return
    }

    onSendMessage(input)
    setInput('')
  }

  return (
    <div className={cn('flex h-full flex-col space-y-4', className)}>
      {/* Messages container */}
      <div
        ref={containerRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
            <div className="rounded-full bg-blue-50 p-4">
              <IconBrain className="h-8 w-8 text-blue-600" />
            </div>
            <div className="max-w-sm space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Start a Conversation
              </h3>
              <p className="text-sm text-gray-600">
                Begin your therapy session by sending a message. The AI will
                respond in a supportive and empathetic manner.
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              // Type guard for id property
              const hasId = (msg: unknown): msg is { id: string | number } =>
                typeof msg === 'object' &&
                msg !== null &&
                'id' in msg &&
                (typeof (msg as { id: unknown }).id === 'string' ||
                  typeof (msg as { id: unknown }).id === 'number')

              const key = hasId(message)
                ? message.id
                : `${message.role}-${message.name}-${message.content.slice(0, 16)}-${index}`

              return <ChatMessage key={key} message={message} />
            })}

            {isLoading && (
              <ChatMessage
                message={{
                  role: 'assistant',
                  content: '',
                  name: 'Assistant',
                }}
                isTyping={true}
              />
            )}

            {error && (
              <ChatMessage
                message={{
                  role: 'assistant',
                  content: `Error: ${error}`,
                  name: 'Assistant',
                }}
              />
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className={cn(
            'absolute bottom-20 right-4 rounded-full bg-blue-600 p-2',
            'text-white shadow-lg transition-colors hover:bg-blue-700',
          )}
          aria-label="Scroll to bottom"
        >
          <IconChevronDown className="h-5 w-5" />
        </button>
      )}

      {/* Input area */}
      <div className="sticky bottom-0 bg-gradient-to-t from-white to-transparent py-4">
        <ChatInput
          value={input}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          disabled={disabled}
          placeholder={inputPlaceholder ?? ''}
        />
      </div>
    </div>
  )
}
