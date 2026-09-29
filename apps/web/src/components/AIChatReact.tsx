import React, { useState, SyntheticEvent } from 'react'

import type { AIModel } from '../lib/ai/models/ai-types'

interface Message {
  id: string // Add unique ID to each message
  role: 'user' | 'assistant'
  content: string
}

export interface AIChatReactProps {
  'availableModels': AIModel[]
  'showModelSelector'?: boolean
  'client:load'?: boolean
  'client:visible'?: boolean
  'client:idle'?: boolean
  'client:only'?: boolean
}

// Helper function to generate unique IDs
const generateId = () =>
  `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

export default function AIChatReact({
  availableModels,
  showModelSelector = true,
}: AIChatReactProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(
    availableModels[0]?.id ?? '',
  )

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault()

    if (!inputValue.trim()) {
      return
    }

    const userMessage: Message = {
      id: generateId(), // Generate unique ID
      role: 'user',
      content: inputValue,
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // In a real application, this would call an API
      // For demo purposes, we'll simulate a response after a delay
      setTimeout(() => {
        const assistantMessage: Message = {
          id: generateId(), // Generate unique ID
          role: 'assistant',
          content: `I'm a demo AI assistant using ${selectedModel}. You said: "${userMessage.content}". In a real implementation, this would connect to the LLM API.`,
        }

        setMessages((prev) => [...prev, assistantMessage])
        setIsLoading(false)
      }, 1000)
    } catch (error: unknown) {
      console.error('Error sending message:', error)
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-none border border-border bg-card">
      {showModelSelector && (
        <div className="border-b border-border bg-secondary p-4">
          <label
            htmlFor="model-select"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Select AI Model
          </label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setSelectedModel(e.target.value)
            }
            className="w-full rounded-none border border-input bg-background p-2 text-foreground"
            aria-label="AI model selection"
          >
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="border-b border-border bg-secondary p-4">
        <h2 className="text-lg font-medium text-foreground">AI Chat</h2>
      </div>

      <div className="h-96 space-y-4 overflow-y-auto bg-background p-4">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>Send a message to start chatting with the AI assistant</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id} // Use unique ID as key instead of index
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-none px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div
            className="flex justify-start"
            role="status"
            aria-label="AI is typing"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="max-w-[80%] rounded-none bg-secondary px-4 py-2 text-foreground">
              <div className="flex space-x-2">
                <div className="animate-typing-dot h-2 w-2 rounded-full bg-muted-foreground"></div>
                <div
                  className="animate-typing-dot h-2 w-2 rounded-full bg-muted-foreground"
                  style={{ animationDelay: '0.2s' }}
                ></div>
                <div
                  className="animate-typing-dot h-2 w-2 rounded-full bg-muted-foreground"
                  style={{ animationDelay: '0.4s' }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex border-t border-border bg-background p-4"
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setInputValue(e.target.value)
          }
          className="flex-1 rounded-none border border-input bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Type your message..."
          disabled={isLoading}
          aria-label="Type a message to the AI assistant"
        />

        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="hover:bg-primary/90 rounded-none bg-primary px-4 py-2 text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-35"
          aria-label={isLoading ? 'Sending message...' : 'Send message'}
        >
          Send
        </button>
      </form>
    </div>
  )
}
