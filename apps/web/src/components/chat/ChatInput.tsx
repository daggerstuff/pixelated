import { useEffect, useRef, SyntheticEvent } from 'react'

import { cn } from '@/lib/utils'

import { IconSend } from './icons'

export interface ChatInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (e: SyntheticEvent) => void
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

  const inputClasses = cn(
    'flex-1 resize-none p-2 min-h-[40px] max-h-[200px]',
    'focus:outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:ring-2 focus-visible:ring-ring',
    'transition-colors',
    'text-foreground bg-card placeholder:text-muted-foreground',
  )

  const buttonClasses = cn(
    'flex h-10 w-10 items-center justify-center rounded-none',
    'transition-colors',
    'disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none',
    'focus-visible:outline-2 focus-visible:outline-ring focus-visible:ring-2 focus-visible:ring-ring',
    'bg-primary text-primary-foreground hover:bg-accent',
  )

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'relative flex items-end space-x-3 rounded-none border p-3',
        'border-border bg-card',
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
            : (placeholder ?? 'Type your message...')
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
