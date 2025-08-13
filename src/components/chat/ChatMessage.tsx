import type { Message } from '@/types/chat'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { markdownToHtml } from '@/lib/markdown'
import { formatTimestamp } from '@/lib/dates'

// Define the MentalHealthAnalysis interface with the properties we need
interface MentalHealthAnalysis {
  category: string;
  hasMentalHealthIssue: boolean;
  [key: string]: unknown;
}

interface ExtendedMessage extends Message {
  mentalHealthAnalysis?: MentalHealthAnalysis
}

export interface ChatMessageProps {
  message: ExtendedMessage
  timestamp?: string
  className?: string
  isTyping?: boolean
}

export function ChatMessage({
  message,
  timestamp,
  className,
  isTyping = false,
}: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isBotMessage = message.role === 'assistant'
  const isSystemMessage = message.role === 'system'

  // Format category name
  const formatCategoryName = (category: string): string => {
    return category
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Get color for category badge
  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      depression: 'bg-blue-500',
      anxiety: 'bg-yellow-500',
      ptsd: 'bg-red-500',
      bipolar_disorder: 'bg-purple-500',
      ocd: 'bg-green-500',
      eating_disorder: 'bg-pink-500',
      social_anxiety: 'bg-indigo-500',
      panic_disorder: 'bg-orange-500',
      suicidality: 'bg-red-700',
      none: 'bg-gray-500',
    }
    return colors[category] || 'bg-gray-500'
  }

  const hasAnalysis =
    message.mentalHealthAnalysis &&
    message.mentalHealthAnalysis.hasMentalHealthIssue

  return (
    <div
      className={cn(
        'flex w-full items-start',
        isUser ? 'justify-end' : 'justify-start',
        className,
      )}
    >
      <div
        className={cn(
          'relative mb-6 max-w-[80%] rounded-lg p-4 shadow-sm',
          isUser
            ? 'bg-blue-600 text-white'
            : isBotMessage
              ? 'bg-gray-50 text-gray-900 border border-gray-200'
              : 'bg-gray-100 text-gray-600 italic border border-gray-200',
          isTyping && 'animate-pulse',
        )}
      >
        {/* Role badge */}
        <div className="absolute -top-3 left-3">
          <div
            className={cn(
              'rounded-full px-2 py-1 text-xs',
              isUser
                ? 'bg-blue-800 text-blue-200'
                : isBotMessage
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-gray-300 text-gray-600',
            )}
          >
            {isUser ? 'You' : isBotMessage ? 'AI' : 'System'}
          </div>
        </div>

        {/* Mental health badge (if applicable) */}
        {hasAnalysis && (
          <div className="absolute -top-3 right-3">
            <Badge
              className={`${getCategoryColor(message.mentalHealthAnalysis!.category)} text-white text-xs`}
            >
              {formatCategoryName(message.mentalHealthAnalysis!.category)}
            </Badge>
          </div>
        )}

        <div className="mt-1">
          {/* For system messages, display as-is */}
          {isSystemMessage ? (
            <div className="text-sm">{message.content}</div>
          ) : (
            /* For user and bot messages, convert markdown to HTML */
            <div
              className="prose prose-sm prose-gray prose-headings:mb-2 prose-p:my-1 max-w-none"
              dangerouslySetInnerHTML={{
                __html: markdownToHtml(message.content),
              }}
            />
          )}
        </div>

        {timestamp && (
          <div className="mt-2 text-right text-xs opacity-60">
            {formatTimestamp(timestamp)}
          </div>
        )}
      </div>
    </div>
  )
}
