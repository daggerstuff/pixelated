import { cn } from '@/lib/utils'
import { useEffect, useRef } from 'react'
import { IconSend } from './icons'
import { useTheme } from '@/components/theme/ThemeProvider'

export interface ChatInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (e: React.FormEvent) => void
  isLoading: boolean
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  disabled = false,
  placeholder,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { resolvedTheme } = useTheme()

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit(e)
    }
  }

  // Determine classes for theme
  const isDark = resolvedTheme === 'dark'
  const inputClasses = cn(
    'flex-1 resize-none p-2 min-h-[40px] max-h-[200px]',
    'focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500',
    'transition-shadow',
    isDark
      ? 'text-white bg-gray-800 placeholder-gray-300'
      : 'text-gray-900 bg-white placeholder-gray-500'
  )

  const buttonClasses = cn(
    'flex h-10 w-10 items-center justify-center rounded-lg',
    'transition-colors',
    'disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none',
    'focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500',
    isDark
      ? 'bg-blue-700 text-white hover:bg-blue-800'
      : 'bg-blue-600 text-white hover:bg-blue-700'
  )

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'relative flex items-end space-x-3 rounded-lg border p-3 shadow-sm',
        isDark
          ? 'border-gray-700 bg-black'
          : 'border-gray-200 bg-white'
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={
          isLoading
            ? 'AI is responding...'
            : placeholder || 'Type your message...'
        }
        disabled={isLoading || disabled}
        className={inputClasses}
        rows={1}
      />

      <button
        type="submit"
        disabled={isLoading || disabled || !value.trim()}
        className={buttonClasses}
      >
        <IconSend
          className={cn(
            'h-5 w-5 transition-transform',
            isLoading && 'animate-pulse',
          )}
        />
      </button>
    </form>
  )
}
