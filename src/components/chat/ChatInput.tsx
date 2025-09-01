import { cn } from '@/lib/utils'
import { useEffect, useRef, useContext } from 'react'
import { IconSend } from './icons'
import { ThemeContext } from '@/components/theme/ThemeProvider'

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
  const theme = useContext(ThemeContext);

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
 // Add strong focus ring and high-contrast support for accessibility
 const isHighContrast = theme?.isHighContrast;
 const inputClasses = cn(
   'flex-1 resize-none p-2 placeholder-gray-400 min-h-[40px] max-h-[200px]',
   theme?.isDark
     ? 'text-white bg-gray-800 placeholder-gray-300'
     : 'text-gray-900 bg-white placeholder-gray-500',
   isHighContrast
     ? 'focus:outline-none focus-visible:outline-4 focus-visible:outline-yellow-400 focus-visible:ring-2 focus-visible:ring-yellow-400'
     : 'focus:outline-none focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500',
   // If not high contrast, use faint ring on normal focus-visible
   'transition-shadow focus:shadow-outline',
   // Hypothetical additional class for browser/system-based high contrast user styles
   isHighContrast && 'border-2 border-black'
 )

 const buttonClasses = cn(
   'flex h-10 w-10 items-center justify-center rounded-lg',
   isHighContrast
     ? 'bg-black text-yellow-400 border-2 border-yellow-400 hover:bg-yellow-400 hover:text-black'
     : theme?.isDark
       ? 'bg-blue-700 text-white hover:bg-blue-800'
       : 'bg-blue-600 text-white hover:bg-blue-700',
   'transition-colors',
   'disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none',
   isHighContrast &&
     'focus-visible:outline-4 focus-visible:outline-yellow-400 focus-visible:ring-2 focus-visible:ring-yellow-400'
 )

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'relative flex items-end space-x-3 rounded-lg border p-3 shadow-sm',
        theme?.isDark
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
