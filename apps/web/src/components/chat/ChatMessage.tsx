import { memo, useCallback } from 'react'
import type { FC } from 'react'

import { cn } from '@/lib/utils'
import type { Message } from '@/types/chat'

interface ChatMessageProps {
  message: Message
  isTyping?: boolean
}

/**
 * Renders a single chat bubble with full support for:
 * - Role-based alignment (user right, assistant/system left)
 * - Typing indicator with animated dots
 * - Encryption and verification badges
 * - Memory-stored and analyzed state indicators
 * - Error detection via `isError` flag or `Error:` content prefix
 * - Tokens handle both light and dark modes
 * - Timestamp display when available
 * - Screen-reader accessible live region for new messages
 */
const ChatMessage: FC<ChatMessageProps> = memo(function ChatMessage({
  message,
  isTyping = false,
}) {
  // Derive display traits from the message
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isError =
    message.isError === true ||
    (typeof message.content === 'string' &&
      message.content.startsWith('Error:'))
  const showName = !isUser && message.name && message.name.length > 0
  const hasTimestamp =
    typeof message.timestamp === 'string' && message.timestamp.length > 0
  const hasContent =
    typeof message.content === 'string' && message.content.length > 0

  const formatTimestamp = useCallback((ts: string): string => {
    try {
      const date = new Date(ts)
      if (Number.isNaN(date.getTime())) return ''
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }, [])

  // --- Typing indicator ---
  if (isTyping) {
    return (
      <div
        className="flex justify-start"
        role="status"
        aria-label="Assistant is typing"
        aria-live="polite"
      >
        <div className="rounded-none border border-border bg-secondary px-4 py-3 text-foreground">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {message.name || 'Assistant'}
            </span>
            {message.analyzed && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-none border border-input bg-secondary px-2 py-0.5 text-[10px] text-foreground',
                )}
              >
                analyzing
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1" aria-hidden="true">
            <span
              className={cn(
                'inline-block h-2 w-2 animate-typing-dot rounded-none bg-muted-foreground',
              )}
              style={{ animationDelay: '0ms' }}
            />
            <span
              className={cn(
                'inline-block h-2 w-2 animate-typing-dot rounded-none bg-muted-foreground',
              )}
              style={{ animationDelay: '150ms' }}
            />
            <span
              className={cn(
                'inline-block h-2 w-2 animate-typing-dot rounded-none bg-muted-foreground',
              )}
              style={{ animationDelay: '300ms' }}
            />
          </div>
        </div>
      </div>
    )
  }
  // --- Empty state guard ---
  if (!hasContent && !isError) {
    return null
  }

  return (
    <div
      className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
      role="log"
      aria-atomic="true"
    >
      <div className="max-w-[85%] space-y-1">
        {/* Sender name + timestamp row */}
        {(showName || hasTimestamp) && (
          <div
            className={cn(
              'flex items-center gap-2 px-1',
              isUser ? 'justify-end' : 'justify-start',
            )}
          >
            {showName && (
              <span className={cn('text-xs font-medium text-muted-foreground')}>
                {message.name}
              </span>
            )}
            {hasTimestamp && (
              <time
                className={cn('text-[10px] text-muted-foreground opacity-70')}
                dateTime={message.timestamp}
              >
                {formatTimestamp(message.timestamp!)}
              </time>
            )}
          </div>
        )}

        {/* Main message bubble */}
        <div
          className={cn(
            'rounded-none px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words',
            isUser && 'bg-primary text-primary-foreground',
            isSystem &&
              'border border-border bg-secondary text-center text-xs italic text-muted-foreground',
            isError && 'border border-ring bg-secondary font-medium',
            !isUser &&
              !isSystem &&
              !isError &&
              'border border-border bg-card text-foreground',
          )}
          aria-label={`${message.role} message${isError ? ' with error' : ''}`}
        >
          {hasContent ? message.content : isError ? message.content : null}
        </div>

        {/* --- Footer badges row --- */}
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 px-1',
            isUser ? 'justify-end' : 'justify-start',
          )}
        >
          {message.encrypted && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-none border border-input bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-foreground',
              )}
              title="End-to-end encrypted"
            >
              <svg
                className="h-2.5 w-2.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Encrypted
            </span>
          )}

          {message.verified && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-none border border-input bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-foreground',
              )}
              title="Sender verified"
            >
              <svg
                className="h-2.5 w-2.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
              Verified
            </span>
          )}

          {message.memoryStored && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-none border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground',
              )}
              title="Stored in session memory"
            >
              <svg
                className="h-2.5 w-2.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              Memory
            </span>
          )}

          {message.analyzed && !isTyping && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-none border border-ring bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-foreground',
              )}
              title="Content has been analyzed"
            >
              <svg
                className="h-2.5 w-2.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Analyzed
            </span>
          )}
        </div>
      </div>
    </div>
  )
})

export { ChatMessage }
