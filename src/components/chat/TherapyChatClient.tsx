import React from 'react'
import type { ChangeEvent } from 'react'
import { useState } from 'react'

import { clientScenarios } from '@/data/scenarios'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useChat } from '@/hooks/useChat'
import { useSecurity } from '@/hooks/useSecurity'
import { useWebSocket } from '@/hooks/useWebSocket'
import type { ChatMessage as ChatMessageType } from '@/types/chat'
import type { Scenario } from '@/types/scenarios'

import AnalyticsDashboardReact from './AnalyticsDashboardReact'
import { ChatInput } from './ChatInput'
import { ChatMessage } from './ChatMessage'
import { ChatShell } from './ChatShell'
import { ScenarioSelector } from './ScenarioSelector'
import { SecurityBadge } from './SecurityBadge'

// Use the same LocalMessage interface as useChat hook
interface LocalMessage {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  name: string
  encrypted?: boolean
  verified?: boolean
  isError?: boolean
}

// Type for scenario with system message
type ExtendedScenario = Scenario & { systemMessage: string }

export function TherapyChatClient() {
  // State
  const [selectedScenario, setSelectedScenario] = useState<ExtendedScenario>(
    () => {
      const firstScenario = clientScenarios[0]
      if (!firstScenario) {
        throw new Error('No client scenarios available')
      }
      return firstScenario
    },
  )
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showScenarios, setShowScenarios] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())

  // Refs will be provided by ChatShell via render prop

  // Hooks
  const { securityLevel, encryptionEnabled, fheInitialized } = useSecurity()
  const analytics = useAnalytics()

  // WebSocket integration
  const { isConnected, sendMessage } = useWebSocket({
    url: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`,
    sessionId,
    onMessage: (message: ChatMessageType) => {
      if (message.role === 'assistant') {
        const localMessage: LocalMessage = {
          ...message,
          name: 'Assistant', // ChatMessage doesn't have name, so provide default
        }
        setMessages((prev: LocalMessage[]) => [...prev, localMessage])
      }
    },
    onError: (error: Error) => {
      console.error('WebSocket error:', error)
      void analytics.trackEvent({
        type: 'websocket_error',
        properties: {
          error: String(error),
          sessionId,
        },
      })
    },
    encrypted: encryptionEnabled,
  })

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
  } = useChat({
    initialMessages: [
      {
        role: 'system',
        content: `You are a simulated therapy client with the following characteristics: ${selectedScenario.name}. ${selectedScenario.description}. The user is a therapist in training. Respond as this client would, with appropriate challenges and resistance. Keep responses under 150 words.`,
        name: 'System',
      },
    ],

    api: '/api/ai/therapy-chat',
    body: {
      scenario: selectedScenario.name.toLowerCase().replace(' ', '-'),
      securityLevel,
      encryptionEnabled,
      sessionId,
      options: {
        enablePIIDetection: true,
        enableToxicityFiltering: securityLevel !== 'standard',
        retainEncryptedAnalytics: securityLevel === 'maximum',
        processingLocation: 'client-side',
      },
    },
  })

  // Effects - scroll handling now managed by ChatShell

  // Handlers
  const handleScenarioChange = (scenario: Scenario) => {
    // Convert the Scenario to ExtendedScenario by finding it in clientScenarios
    const extendedScenario = clientScenarios.find(
      (s) => s.id === scenario.id || s.name === scenario.name,
    )
    if (extendedScenario) {
      setSelectedScenario(extendedScenario)
      setMessages([])
      setShowScenarios(false)

      // Add system message for new scenario
      const systemMessage: LocalMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content: `You are a simulated therapy client with the following characteristics: ${extendedScenario.name}. ${extendedScenario.description}. The user is a therapist in training. Respond as this client would, with appropriate challenges and resistance. Keep responses under 150 words.`,
        name: 'System',
      }
      setMessages([systemMessage])
    }
  }

  const handleSecureSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) {
      return
    }

    // Track button click metric
    const { countMetric } = await import('@/lib/sentry/utils')
    countMetric('user.action', 1, {
      action: 'chat_submit',
      component: 'TherapyChatClient',
      scenario: selectedScenario.name,
      encryption_enabled: encryptionEnabled,
    })

    // Create user message
    const userMessage: LocalMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      encrypted: encryptionEnabled,
      name: 'User',
    }

    // Add message to local state
    setMessages((prev: LocalMessage[]) => [...prev, userMessage])

    // Send via WebSocket if connected
    if (isConnected && userMessage.id) {
      sendMessage({
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        encrypted: encryptionEnabled || false, // Ensure boolean value
      })
      countMetric('websocket.message_sent', 1, {
        encrypted: encryptionEnabled,
      })
    }

    // Track analytics
    void analytics.trackEvent({
      type: 'therapy_session',
      properties: {
        scenario: selectedScenario.name,
        messageCount: messages.length,
        securityLevel,
        websocketConnected: isConnected,
      },
    })

    // Call API
    await handleSubmit(e)
  }

  // Create a custom input change handler that adapts to textarea
  const handleTextAreaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    // Create a minimal synthetic event that matches what handleInputChange expects
    const syntheticEvent = {
      target: {
        value: e.target.value,
      },
    } as ChangeEvent<HTMLInputElement>
    handleInputChange(syntheticEvent)
  }

  return (
    <ChatShell autoScrollDeps={[messages]}>
      {({ containerRef, messagesEndRef, showScrollButton, scrollToBottom }) => (
        <div className={`${isExpanded ? 'fixed inset-0 z-50' : ''}`}>
          {/* Header */}
          <div className='from-purple-900 via-purple-800 to-purple-900 mb-4 flex items-center justify-between rounded-t-lg bg-gradient-to-r p-3'>
            <h1 className='text-xl font-bold'>
              Pixelated Empathy Therapy Chat
            </h1>
            <div className='flex items-center space-x-2'>
              <SecurityBadge
                securityLevel={securityLevel}
                encryptionEnabled={encryptionEnabled}
                fheInitialized={fheInitialized}
              />

              {isConnected && (
                <span className='bg-green-800 text-green-200 rounded px-2 py-1 text-xs'>
                  Live
                </span>
              )}
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className='bg-purple-700 hover:bg-purple-600 rounded px-2 py-1 text-sm'
              >
                {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className='bg-purple-700 hover:bg-purple-600 rounded px-2 py-1 text-sm'
              >
                {isExpanded ? 'Minimize' : 'Expand'}
              </button>
            </div>
          </div>

          {/* Scenario selector */}
          <ScenarioSelector
            scenarios={clientScenarios}
            selectedScenario={selectedScenario}
            showScenarios={showScenarios}
            setShowScenarios={setShowScenarios}
            onSelect={handleScenarioChange}
          />

          {/* FHE initialization warning */}
          {encryptionEnabled && !fheInitialized && (
            <div className='bg-yellow-800 border-yellow-700 text-yellow-400 mb-4 rounded border bg-opacity-30 p-2 text-sm'>
              Initializing FHE encryption system... This might take a moment.
            </div>
          )}

          {/* Analytics dashboard */}
          {showAnalytics && (
            <div className='mb-4'>
              <AnalyticsDashboardReact
                messages={messages}
                securityLevel={securityLevel}
                encryptionEnabled={encryptionEnabled}
                scenario={selectedScenario.name}
              />
            </div>
          )}

          {/* Chat container */}
          <div
            ref={containerRef}
            className={`overflow-y-auto ${
              isExpanded ? 'h-[calc(100vh-160px)]' : 'h-[55vh]'
            } border-purple-900 bg-black mb-2 rounded-md border bg-opacity-50 p-2 shadow-sm transition-all duration-200`}
          >
            {messages.length === 0 ? (
              <div className='text-gray-400 flex h-full flex-col items-center justify-center'>
                <p className='mb-2 text-xl font-medium'>Begin Your Session</p>
                <p className='max-w-md text-center'>
                  Start therapy training with our AI client simulation.
                  {encryptionEnabled &&
                    (securityLevel === 'maximum'
                      ? ' Messages are protected with FHE for maximum security.'
                      : ' Messages are encrypted for privacy.')}
                </p>
              </div>
            ) : (
              <>
                {messages
                  .filter((m: LocalMessage) => m.role !== 'system')
                  .map((message: LocalMessage, index: number) => {
                    // Use React.createElement to bypass JSX type inference issue
                    const { id, ...messageProps } = message
                    const messageWithEncryption = {
                      ...messageProps,
                      encrypted: encryptionEnabled,
                    }
                    const key = id || `message-${index}`

                    return React.createElement(ChatMessage, {
                      key,
                      message: messageWithEncryption,
                    })
                  })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Scroll to bottom button */}
          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              className='bg-purple-700 text-white hover:bg-purple-600 fixed bottom-20 right-4 rounded-full p-2 shadow-lg transition-colors'
              aria-label='Scroll to bottom'
            >
              ↓
            </button>
          )}

          {/* Input area */}
          <ChatInput
            value={input}
            onChange={handleTextAreaChange}
            onSubmit={handleSecureSubmit}
            isLoading={isLoading}
            disabled={!fheInitialized && encryptionEnabled}
          />
        </div>
      )}
    </ChatShell>
  )
}
