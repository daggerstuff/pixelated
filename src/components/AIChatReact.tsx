import React, { useState } from 'react'

import type { AIModel } from '../lib/ai/models/types'

interface Message {
  id: string // Add unique ID to each message
  role: 'user' | 'assistant'
  content: string
}

export interface AIChatReactProps {
  availableModels: AIModel[]
  showModelSelector?: boolean
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
    availableModels[0]?.id || '',
  )

  const handleSubmit = async (e: React.FormEvent) => {
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
          content: `I'm a demo AI assistant using ${selectedModel}. You said: "${userMessage.content}". In a real implementation, this would connect to the TogetherAI API.`,
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
    <div className='border-gray-200 dark:border-gray-700 mx-auto max-w-2xl overflow-hidden rounded-lg border shadow-lg'>
      {showModelSelector && (
        <div className='bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 border-b p-4'>
          <label
            htmlFor='model-select'
            className='text-gray-700 dark:text-gray-300 mb-1 block text-sm font-medium'
          >
            Select AI Model
          </label>
          <select
            id='model-select'
            value={selectedModel}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setSelectedModel(e.target.value)
            }
            className='border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-full rounded-md border p-2'
            aria-label='AI model selection'
          >
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className='bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 border-b p-4'>
        <h2 className='text-gray-900 dark:text-white text-lg font-medium'>
          AI Chat
        </h2>
      </div>

      <div className='bg-white dark:bg-gray-900 h-96 space-y-4 overflow-y-auto p-4'>
        {messages.length === 0 ? (
          <div className='text-gray-500 dark:text-gray-400 py-8 text-center'>
            <p>Send a message to start chatting with the AI assistant</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id} // Use unique ID as key instead of index
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className='flex justify-start'>
            <div className='bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 max-w-[80%] rounded-lg rounded-bl-none px-4 py-2'>
              <div className='flex space-x-2'>
                <div className='bg-gray-500 h-2 w-2 animate-bounce rounded-full'></div>
                <div
                  className='bg-gray-500 h-2 w-2 animate-bounce rounded-full'
                  style={{ animationDelay: '0.2s' }}
                ></div>
                <div
                  className='bg-gray-500 h-2 w-2 animate-bounce rounded-full'
                  style={{ animationDelay: '0.4s' }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className='border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex border-t p-4'
      >
        <input
          type='text'
          value={inputValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setInputValue(e.target.value)
          }
          className='border-gray-300 dark:border-gray-600 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white flex-1 rounded-l-lg border px-4 py-2 focus:outline-none focus:ring-2'
          placeholder='Type your message...'
          disabled={isLoading}
        />

        <button
          type='submit'
          disabled={isLoading || !inputValue.trim()}
          className='bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500 disabled:bg-blue-300 dark:disabled:bg-blue-800 rounded-r-lg px-4 py-2 focus:outline-none focus:ring-2'
        >
          Send
        </button>
      </form>
    </div>
  )
}
