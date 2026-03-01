import React, { useState } from 'react'

import { useChatCompletion } from './useChatCompletion'

/**
 * Example component demonstrating the enhanced useChatCompletion hook
 */
export default function ChatCompletionExample() {
  const [inputMessage, setInputMessage] = useState('')
  const [streamingMode, setStreamingMode] = useState(true)

  const {
    messages,
    isLoading,
    isStreaming,
    isTyping,
    error,
    progress,
    tokenUsage,
    conversationStats,
    sendMessage,
    sendStreamingMessage,
    editMessage,
    deleteMessage,
    resendMessage,
    resetChat,
    retryLastMessage,
    stopGeneration,
    exportConversation,
    getMessageStats,
  } = useChatCompletion({
    streamingEnabled: streamingMode,
    autoSave: true,
    persistKey: 'chat-completion-demo',
    onProgress: (chunk, accumulated) => {
      console.log('Progress:', chunk, accumulated.length)
    },
    onComplete: (response) => {
      console.log('Completed:', response)
    },
    onError: (error) => {
      console.error('Chat error:', error)
    },
  })

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) {
      return
    }

    if (streamingMode) {
      const generator = sendStreamingMessage(inputMessage)
      for await (const chunk of generator) {
        console.log('Streaming chunk:', chunk)
      }
    } else {
      await sendMessage(inputMessage)
    }

    setInputMessage('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSendMessage()
    }
  }

  const messageStats = getMessageStats()

  return (
    <div className='mx-auto max-w-4xl p-6'>
      <div className='mb-6'>
        <h2 className='mb-4 text-2xl font-bold'>
          Enhanced Chat Completion Demo
        </h2>

        {/* Controls */}
        <div className='bg-gray-50 mb-4 flex flex-wrap gap-4 rounded-lg p-4'>
          <label className='flex items-center gap-2'>
            <input
              type='checkbox'
              checked={streamingMode}
              onChange={(e) => setStreamingMode(e.target.checked)}
            />
            Streaming Mode
          </label>

          <button
            onClick={resetChat}
            className='bg-red-500 text-white hover:bg-red-600 rounded px-3 py-1'
          >
            Reset Chat
          </button>

          <button
            onClick={retryLastMessage}
            disabled={!error}
            className='bg-yellow-500 text-white hover:bg-yellow-600 rounded px-3 py-1 disabled:opacity-50'
          >
            Retry Last
          </button>

          <button
            onClick={stopGeneration}
            disabled={!isLoading}
            className='bg-gray-500 text-white hover:bg-gray-600 rounded px-3 py-1 disabled:opacity-50'
          >
            Stop
          </button>

          <button
            onClick={() => {
              const exported = exportConversation()
              void navigator.clipboard.writeText(exported)
              alert('Conversation copied to clipboard!')
            }}
            className='bg-blue-500 text-white hover:bg-blue-600 rounded px-3 py-1'
          >
            Export
          </button>
        </div>

        {/* Stats */}
        <div className='bg-blue-50 mb-4 grid grid-cols-2 gap-4 rounded-lg p-4 md:grid-cols-4'>
          <div>
            <div className='text-gray-600 text-sm'>Messages</div>
            <div className='font-semibold'>
              {conversationStats.messageCount}
            </div>
          </div>
          <div>
            <div className='text-gray-600 text-sm'>Avg Response Time</div>
            <div className='font-semibold'>
              {Math.round(conversationStats.avgResponseTime)}ms
            </div>
          </div>
          <div>
            <div className='text-gray-600 text-sm'>Total Tokens</div>
            <div className='font-semibold'>{tokenUsage.totalTokens}</div>
          </div>
          <div>
            <div className='text-gray-600 text-sm'>Est. Cost</div>
            <div className='font-semibold'>
              ${tokenUsage.estimatedCost.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Progress */}
        {isLoading && (
          <div className='mb-4'>
            <div className='mb-2 flex items-center gap-2'>
              <div className='text-gray-600 text-sm'>
                {isStreaming ? 'Streaming...' : 'Loading...'}
                {isTyping && ' (AI is typing)'}
              </div>
              <div className='text-blue-600 text-sm'>
                {progress.toFixed(1)}%
              </div>
            </div>
            <div className='bg-gray-200 h-2 w-full rounded-full'>
              <div
                className='bg-blue-600 h-2 rounded-full transition-all duration-300'
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className='bg-red-50 border-red-200 mb-4 rounded-lg border p-4'>
            <div className='text-red-700 font-medium'>Error:</div>
            <div className='text-red-600'>{error}</div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className='mb-6 max-h-96 space-y-4 overflow-y-auto rounded-lg border p-4'>
        {messages.length === 0 ? (
          <div className='text-gray-500 py-8 text-center'>
            No messages yet. Start a conversation!
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}-${message.content.slice(0, 20)}`}
              className={`rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-100 ml-8'
                  : 'bg-gray-100 mr-8'
              }`}
            >
              <div className='flex items-start justify-between'>
                <div>
                  <div className='mb-1 text-sm font-medium'>
                    {message.role === 'user' ? 'You' : 'AI'}
                  </div>
                  <div className='whitespace-pre-wrap'>{message.content}</div>
                </div>

                <div className='ml-2 flex gap-1'>
                  <button
                    onClick={() => {
                      const newContent = prompt(
                        'Edit message:',
                        message.content,
                      )
                      if (newContent !== null) {
                        editMessage(index, newContent)
                      }
                    }}
                    className='text-blue-600 hover:text-blue-800 text-xs'
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteMessage(index)}
                    className='text-red-600 hover:text-red-800 text-xs'
                  >
                    Delete
                  </button>
                  {message.role === 'user' && (
                    <button
                      onClick={() => resendMessage(index)}
                      className='text-green-600 hover:text-green-800 text-xs'
                    >
                      Resend
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className='space-y-4'>
        <div className='flex gap-2'>
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder='Type your message here... (Enter to send, Shift+Enter for new line)'
            className='flex-1 resize-none rounded-lg border p-3'
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className='bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-6 py-3 disabled:cursor-not-allowed disabled:opacity-50'
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>

        {/* Message Stats */}
        {messages.length > 0 && (
          <div className='text-gray-600 bg-gray-50 rounded-lg p-3 text-sm'>
            <div className='mb-1 font-medium'>Message Statistics:</div>
            <div>Longest: {messageStats.longestMessage} chars</div>
            <div>Shortest: {messageStats.shortestMessage} chars</div>
            <div>Average: {Math.round(messageStats.averageLength)} chars</div>
          </div>
        )}
      </div>
    </div>
  )
}
