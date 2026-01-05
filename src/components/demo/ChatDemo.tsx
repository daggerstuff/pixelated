import React from 'react'
import type { AIMessage } from '../../lib/ai'
import type { CrisisDetectionResult } from '../../lib/ai/crisis/types'
import { useState, useCallback, useEffect, useRef } from 'react'
import { authClient } from '@/lib/auth-client'
import { useStore } from 'nanostores'
import {
  ChatContainer,
  useChatCompletion,
  useCrisisDetection,
  useSentimentAnalysis,
} from '../ai'

interface ChatDemoProps {
  className?: string
  onCrisisAlert?: (crisis: CrisisDetectionResult) => void
  maxMessages?: number
}

/**
 * Production-ready chat interface with AI analysis capabilities
 * Features: Authentication, rate limiting, crisis management, error boundaries
 */
export function ChatDemo({
  className = '',
  onCrisisAlert,
  maxMessages = 50,
}: ChatDemoProps) {
  const { data: session } = authClient.useSession()
  const isAuthenticated = !!session?.user
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [messageCount, setMessageCount] = useState(0)
  const [rateLimitExceeded, setRateLimitExceeded] = useState(false)
  const [crisisAlertShown, setCrisisAlertShown] = useState(false)
  const lastMessageTime = useRef<number>(0)

  // Rate limiting: max 1 message per 2 seconds
  const RATE_LIMIT_MS = 2000
  const MAX_MESSAGES_PER_HOUR = 30

  // Initial system message
  const initialMessages: AIMessage[] = [
    {
      role: 'system',
      content:
        'You are a professional mental health training assistant. Provide supportive, evidence-based responses while maintaining appropriate boundaries.',
      name: '',
    },
  ]

  // Chat completion hook with enhanced error handling
  const { messages, isLoading, error, sendMessage, retryLastMessage } =
    useChatCompletion({
      initialMessages,
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 1024,
      onError: (error) => {
        console.error('Chat error:', error)
        // Log to monitoring service in production
      },
    })

  // Sentiment analysis hook
  const {
    analyzeText: analyzeSentiment,
    result: sentimentResult,
    isLoading: sentimentLoading,
  } = useSentimentAnalysis()

  // Crisis detection with proper alert handling
  const {
    detectCrisis,
    result: crisisResult,
    isLoading: crisisLoading,
  } = useCrisisDetection({
    sensitivityLevel: 'medium',
    onCrisisDetected: useCallback(
      (result: CrisisDetectionResult) => {
        if (result.isCrisis && result.riskLevel === 'critical') {
          setCrisisAlertShown(true)
          onCrisisAlert?.(result)
          // In production: trigger emergency protocols
        }
      },
      [onCrisisAlert],
    ),
  })

  // Rate limiting check
  const checkRateLimit = useCallback(() => {
    const now = Date.now()
    if (now - lastMessageTime.current < RATE_LIMIT_MS) {
      setRateLimitExceeded(true)
      setTimeout(() => setRateLimitExceeded(false), RATE_LIMIT_MS)
      return false
    }
    if (messageCount >= MAX_MESSAGES_PER_HOUR) {
      return false
    }
    return true
  }, [messageCount])

  // Enhanced message handler with validation and rate limiting
  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!isAuthenticated) {
        throw new Error('Authentication required')
      }

      if (!checkRateLimit()) {
        return
      }

      // Input validation
      if (!message.trim() || message.length > 2000) {
        throw new Error('Invalid message length')
      }

      try {
        lastMessageTime.current = Date.now()
        setMessageCount((prev) => prev + 1)

        // Send message to AI
        await sendMessage(message)

        // Run analysis in parallel
        await Promise.allSettled([
          analyzeSentiment(message),
          detectCrisis(message),
        ])
      } catch (error: unknown) {
        console.error('Message handling error:', error)
        throw error
      }
    },
    [
      isAuthenticated,
      checkRateLimit,
      sendMessage,
      analyzeSentiment,
      detectCrisis,
    ],
  )

  // Reset rate limiting hourly
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageCount(0)
    }, 3600000) // 1 hour
    return () => clearInterval(interval)
  }, [])

  // Authentication guard
  if (!isAuthenticated) {
    return (
      <div
        className={`flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 ${className}`}
      >
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Authentication Required
          </h3>
          <p className="text-gray-600">
            Please sign in to access the chat interface.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col h-full bg-white rounded-lg shadow-sm border ${className}`}
    >
      {/* Crisis Alert Banner */}
      {crisisAlertShown && crisisResult?.isCrisis && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Crisis Detected
                </h3>
                <p className="text-sm text-red-700">
                  Risk Level: {crisisResult.riskLevel} | Confidence:{' '}
                  {(crisisResult.confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>
            <button
              onClick={() => setCrisisAlertShown(false)}
              className="text-red-400 hover:text-red-600"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Rate Limit Warning */}
      {rateLimitExceeded && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <p className="text-sm text-yellow-700">
            Please wait before sending another message.
          </p>
        </div>
      )}

      {/* Chat Interface */}
      <div className="flex-1 min-h-0">
        <ChatContainer
          messages={messages
            .filter((m) => m.role !== 'system' && m.content !== undefined)
            .slice(-maxMessages) // Limit message history
            .map((m) => ({
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content || '',
              name: m.name || '',
            }))}
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          error={error?.toString()}
          inputPlaceholder={
            rateLimitExceeded ? 'Please wait...' : 'Type a message...'
          }
          onRetry={retryLastMessage}
          disabled={rateLimitExceeded || messageCount >= MAX_MESSAGES_PER_HOUR}
        />
      </div>

      {/* Analysis Panel */}
      <div className="border-t border-gray-200 bg-gray-50">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setShowAnalysis(!showAnalysis)}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg
                className={`mr-2 h-4 w-4 transform transition-transform ${showAnalysis ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              {showAnalysis ? 'Hide Analysis' : 'Show Analysis'}
            </button>
            <div className="text-xs text-gray-500">
              Messages: {messageCount}/{MAX_MESSAGES_PER_HOUR}
            </div>
          </div>

          {showAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sentiment Analysis */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Sentiment Analysis
                  </h3>
                  {sentimentLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  )}
                </div>
                {sentimentResult ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Sentiment:</span>
                      <span className="text-sm font-medium">
                        {String(sentimentResult.sentiment)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Confidence:</span>
                      <span className="text-sm font-medium">
                        {(sentimentResult.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    {sentimentResult.emotions && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          Emotions:
                        </p>
                        <div className="space-y-1">
                          {Object.entries(sentimentResult.emotions)
                            .sort(([, a], [, b]) => Number(b) - Number(a))
                            .slice(0, 3)
                            .map(([emotion, score]) => (
                              <div
                                key={emotion}
                                className="flex justify-between text-xs"
                              >
                                <span className="text-gray-600 capitalize">
                                  {emotion}:
                                </span>
                                <span className="font-medium">
                                  {Math.floor(Number(score) * 100)}%
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No analysis available</p>
                )}
              </div>

              {/* Crisis Detection */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Crisis Detection
                  </h3>
                  {crisisLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                  )}
                </div>
                {crisisResult ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">
                        Crisis Detected:
                      </span>
                      <span
                        className={`text-sm font-medium ${crisisResult.isCrisis ? 'text-red-600' : 'text-green-600'}`}
                      >
                        {crisisResult.isCrisis ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Confidence:</span>
                      <span className="text-sm font-medium">
                        {(crisisResult.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    {crisisResult.category && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Type:</span>
                        <span className="text-sm font-medium">
                          {crisisResult.category}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Risk Level:</span>
                      <span
                        className={`text-sm font-medium ${
                          crisisResult.riskLevel === 'critical'
                            ? 'text-red-600'
                            : crisisResult.riskLevel === 'high'
                              ? 'text-orange-600'
                              : crisisResult.riskLevel === 'medium'
                                ? 'text-yellow-600'
                                : 'text-green-600'
                        }`}
                      >
                        {crisisResult.riskLevel}
                      </span>
                    </div>
                    {crisisResult.suggestedActions &&
                      crisisResult.suggestedActions.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-900 mb-1">
                            Suggested Actions:
                          </p>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {crisisResult.suggestedActions
                              .slice(0, 2)
                              .map((action: string) => (
                                <li key={action} className="flex items-start">
                                  <span className="mr-1">•</span>
                                  <span>{action}</span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No analysis available</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Error Boundary Component
export class ChatDemoErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: {
    children: React.ReactNode
    fallback?: React.ReactNode
  }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ChatDemo Error:', error, errorInfo)
    // Log to monitoring service in production
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg border border-red-200">
            <div className="text-center">
              <h3 className="text-lg font-medium text-red-900 mb-2">
                Something went wrong
              </h3>
              <p className="text-red-700 mb-4">
                The chat interface encountered an error.
              </p>
              <button
                onClick={() =>
                  this.setState({ hasError: false, error: undefined })
                }
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Try Again
              </button>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}
