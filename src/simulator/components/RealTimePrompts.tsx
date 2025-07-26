import React, { useEffect, useState } from 'react'
import { getTherapeuticPrompts } from '../utils/speechRecognition'
import { cn } from '../../lib/utils'

interface RealTimePromptsProps {
  detectedKeywords: string[]
  domain?: string
  className?: string
  maxPrompts?: number
  onPromptClick?: (prompt: string) => void
}

/**
 * Component to display therapeutic prompts based on speech analysis
 * Generates relevant prompts based on detected keywords
 */
export default function RealTimePrompts({
  detectedKeywords,
  domain = 'general',
  className = '',
  maxPrompts = 3,
  onPromptClick,
}: RealTimePromptsProps) {
  const [prompts, setPrompts] = useState<string[]>([])
  const [selectedPrompt, setSelectedPrompt] = useState<number | null>(null)

  // Generate prompts when keywords change
  useEffect(() => {
    if (detectedKeywords.length > 0) {
      // Get prompts based on the keywords
      const newPrompts = getTherapeuticPrompts(detectedKeywords, domain)

      // Only update if we have new prompts
      if (newPrompts.length > 0) {
        setPrompts((prev) => {
          // Combine with existing prompts but avoid duplicates
          const combined = [...newPrompts, ...prev]
          const unique = [...new Set(combined)]

          // Limit to max number of prompts
          return unique.slice(0, maxPrompts)
        })
      }
    }
  }, [detectedKeywords, domain, maxPrompts])

  // Handle prompt selection
  const handlePromptClick = (prompt: string, index: number) => {
    setSelectedPrompt(index)
    if (onPromptClick) {
      onPromptClick(prompt)
    }
  }

  // If no prompts, show a placeholder
  if (prompts.length === 0) {
    return (
      <div
        className={cn(
          'mt-2 p-3 rounded-md bg-gray-50 text-gray-400 text-sm italic border border-gray-200',
          className,
        )}
      >
        Suggested therapeutic prompts will appear here as you speak...
      </div>
    )
  }

  return (
    <div className={cn('mt-2', className)}>
      <div className="text-sm font-medium text-gray-700 mb-2">
        Suggested Therapeutic Responses:
      </div>
      <div className="space-y-2">
        {prompts.map((prompt, index) => (
          <div
            key={prompt}
            className={cn(
              'px-3 py-2 text-sm bg-white border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer mb-2 text-left',
              selectedPrompt === index
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50',
            )}
            onClick={() => handlePromptClick(prompt, index)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handlePromptClick(prompt, index)
              }
            }}
            tabIndex={0}
            aria-pressed={selectedPrompt === index}
          >
            {prompt}
          </div>
        ))}
      </div>
    </div>
  )
}
