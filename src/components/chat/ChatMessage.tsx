import DOMPurify from 'isomorphic-dompurify'
import { Brain, ChevronDown, ChevronUp } from 'lucide-react'
import { useContext, useState } from 'react'

import { MultiAgentThoughtUI } from '@/components/ai/MultiAgentThoughtUI'
import { ThemeContext } from '@/components/theme/ThemeProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatTimestamp } from '@/lib/dates'
import { simpleMarkdownToHtml } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import type { Message, ExtendedMessage } from '@/types/chat'

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
  const theme = useContext(ThemeContext)
  const isDark = theme?.resolvedTheme === 'dark'
  const isUser = message.role === 'user'
  const isBotMessage = message.role === 'assistant'
  const isSystemMessage = message.role === 'system'
  const [showThoughts, setShowThoughts] = useState(false)

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
    !!message.mentalHealthAnalysis &&
    (('hasMentalHealthIssue' in message.mentalHealthAnalysis &&
      message.mentalHealthAnalysis.hasMentalHealthIssue) ||
      ('category' in message.mentalHealthAnalysis &&
        (message.mentalHealthAnalysis.category as string) !== 'none'))

  const analysis = message.mentalHealthAnalysis as any
  const hasActivities = message.activities && message.activities.length > 0

  return (
    <div
      className={cn(
        'flex w-full flex-col items-start gap-2',
        isUser ? 'items-end' : 'items-start',
        className,
      )}
    >
      <div
        className={cn(
          'relative mb-2 max-w-[80%] rounded-lg p-4 shadow-sm',
          isUser
            ? isDark
              ? 'bg-blue-600 text-white'
              : 'bg-blue-600 text-white'
            : isBotMessage
              ? isDark
                ? 'bg-gray-900 text-gray-100 border border-gray-700'
                : 'bg-gray-50 text-gray-900 border border-gray-200'
              : isDark
                ? 'bg-gray-800 text-gray-300 italic border border-gray-700'
                : 'bg-gray-100 text-gray-600 italic border border-gray-200',
          isTyping && 'animate-pulse',
        )}
      >
        {/* Role badge */}
        <div className='absolute -top-3 left-3'>
          <div
            className={cn(
              'rounded-[4px] px-2 py-1 text-xs',
              isUser
                ? isDark
                  ? 'bg-blue-900 text-blue-100'
                  : 'bg-blue-800 text-blue-200'
                : isBotMessage
                  ? isDark
                    ? 'bg-gray-800 text-gray-200'
                    : 'bg-gray-200 text-gray-700'
                  : isDark
                    ? 'bg-gray-700 text-gray-400'
                    : 'bg-gray-300 text-gray-600',
            )}
          >
            {isUser ? 'You' : isBotMessage ? 'AI' : 'System'}
          </div>
        </div>

        {/* Mental health badge (if applicable) */}
        {hasAnalysis && analysis && (
          <div className='absolute -top-3 right-3'>
            <Badge
              className={`${getCategoryColor(analysis.category)} text-white text-xs`}
            >
              {formatCategoryName(analysis.category)}
            </Badge>
          </div>
        )}

        <div className='mt-1'>
          {/* For system messages, display as-is */}
          {isSystemMessage ? (
            <div className='text-sm'>{message.content}</div>
          ) : (
            /* For user and bot messages, convert markdown to HTML */
            <div
              className='prose prose-sm prose-gray prose-headings:mb-2 prose-p:my-1 max-w-none'
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  simpleMarkdownToHtml(message.content),
                ),
              }}
            />
          )}
        </div>

        <div className='mt-2 flex items-center justify-between'>
          {hasActivities && (
            <button
              onClick={() => setShowThoughts(!showThoughts)}
              className='text-blue-400 hover:text-blue-300 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors'
            >
              <Brain className='h-3 w-3' />
              {showThoughts ? 'Hide reasoning' : 'Show reasoning'}
              {showThoughts ? (
                <ChevronUp className='h-3 w-3' />
              ) : (
                <ChevronDown className='h-3 w-3' />
              )}
            </button>
          )}

          {timestamp && (
            <div className='ml-auto text-[10px] opacity-60'>
              {formatTimestamp(timestamp)}
            </div>
          )}
        </div>
      </div>

      {/* Reasoning chain display */}
      {hasActivities && showThoughts && (
        <div className='animate-in fade-in slide-in-from-top-2 w-full max-w-[85%] duration-300'>
          <MultiAgentThoughtUI
            activities={message.activities!}
            className='mt-1 shadow-lg'
          />
        </div>
      )}
    </div>
  )
}
