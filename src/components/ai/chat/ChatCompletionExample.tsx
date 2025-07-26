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
      handleSendMessage()
    }
  }

  const messageStats = getMessageStats()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Enhanced Chat Completion Demo</h2>
        
        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={streamingMode}
              onChange={(e) => setStreamingMode(e.target.checked)}
            />
            Streaming Mode
          </label>
          
          <button
            onClick={resetChat}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Reset Chat
          </button>
          
          <button
            onClick={retryLastMessage}
            disabled={!error}
            className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
          >
            Retry Last
          </button>
          
          <button
            onClick={stopGeneration}
            disabled={!isLoading}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Stop
          </button>
          
          <button
            onClick={() => {
              const exported = exportConversation()
              navigator.clipboard.writeText(exported)
              alert('Conversation copied to clipboard!')
            }}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Export
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-blue-50 rounded-lg">
          <div>
            <div className="text-sm text-gray-600">Messages</div>
            <div className="font-semibold">{conversationStats.messageCount}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Avg Response Time</div>
            <div className="font-semibold">{Math.round(conversationStats.avgResponseTime)}ms</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Total Tokens</div>
            <div className="font-semibold">{tokenUsage.totalTokens}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Est. Cost</div>
            <div className="font-semibold">${tokenUsage.estimatedCost.toFixed(4)}</div>
          </div>
        </div>

        {/* Progress */}
        {isLoading && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-sm text-gray-600">
                {isStreaming ? 'Streaming...' : 'Loading...'}
                {isTyping && ' (AI is typing)'}
              </div>
              <div className="text-sm text-blue-600">{progress.toFixed(1)}%</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-700 font-medium">Error:</div>
            <div className="text-red-600">{error}</div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="mb-6 space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No messages yet. Start a conversation!
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}-${message.content.slice(0, 20)}`}
              className={`p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-100 ml-8'
                  : 'bg-gray-100 mr-8'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium text-sm mb-1">
                    {message.role === 'user' ? 'You' : 'AI'}
                  </div>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
                
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => {
                      const newContent = prompt('Edit message:', message.content)
                      if (newContent !== null) {
                        editMessage(index, newContent)
                      }
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteMessage(index)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                  {message.role === 'user' && (
                    <button
                      onClick={() => resendMessage(index)}
                      className="text-xs text-green-600 hover:text-green-800"
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
      <div className="space-y-4">
        <div className="flex gap-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message here... (Enter to send, Shift+Enter for new line)"
            className="flex-1 p-3 border rounded-lg resize-none"
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>

        {/* Message Stats */}
        {messages.length > 0 && (
          <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded-lg">
            <div className="font-medium mb-1">Message Statistics:</div>
            <div>Longest: {messageStats.longestMessage} chars</div>
            <div>Shortest: {messageStats.shortestMessage} chars</div>
            <div>Average: {Math.round(messageStats.averageLength)} chars</div>
          </div>
        )}
      </div>
    </div>
  )
}
