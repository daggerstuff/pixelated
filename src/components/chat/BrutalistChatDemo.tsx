import React, { useState } from 'react'
import type { FC } from 'react'

import { ChatShell } from './ChatShell'
import { createPersonaMessage, getPersonaContext } from './PersonaService'
import type { PersonaServiceConfig } from './PersonaService'

export interface ChatMessage {
  id: string
  role: 'user' | 'bot' | 'system'
  content: string
  timestamp: Date
  personaContext?: {
    scenario: string
    tone: string
    traits: string[]
  }
  metadata?: {
    biasDetected?: boolean
    confidenceScore?: number
    suggestions?: string[]
  }
}

const BrutalistChatDemo: FC = () => {
  // Use PersonaService for persona context
  const personaConfig: PersonaServiceConfig = { mode: 'deterministic' } // Future: set based on UI or API
  getPersonaContext(personaConfig)
  const [messages, setMessages] = useState<ChatMessage[]>([
    createPersonaMessage({
      baseId: '1',
      role: 'system',
      content:
        'THERAPY TRAINING SESSION INITIALIZED. You are the therapist. Client persona: Sarah, 28, presenting with anxiety and relationship concerns.',
      timestamp: new Date(),
      config: personaConfig,
    }),
    createPersonaMessage({
      baseId: '2',
      role: 'bot',
      content:
        "I don't know why I'm here. My boyfriend says I need therapy but I think he's the problem.",
      timestamp: new Date(),
      config: personaConfig,
    }),
  ])

  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [sessionActive, setSessionActive] = useState(true)

  // Scroll management will be handled by ChatShell render prop

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !sessionActive) {
      return
    }

    const userMessage = createPersonaMessage({
      content: inputValue,
      role: 'user',
      config: personaConfig,
      metadata: {
        biasDetected: Math.random() > 0.8, // Bias detection for therapist responses
        confidenceScore: Math.floor(Math.random() * 30) + 70,
        suggestions: [
          'Consider exploring both perspectives',
          'Validate client emotions',
          'Avoid taking sides',
        ],
      },
    })

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)

    // Simulate persona-based response (to be enhanced with a real PersonaService later)
    setTimeout(() => {
      const responses = [
        "That sounds really difficult. Can you tell me more about what's been happening in your relationship?",
        "I hear that you're feeling frustrated. What would you like to see change?",
        'It sounds like there might be different perspectives here. How do you think your boyfriend sees the situation?',
        "He just doesn't listen to me anymore. Every time I try to talk about something important, he gets defensive.",
        "I feel like I'm walking on eggshells around him. I can't say anything without it turning into an argument.",
        "Maybe you're right... but it's hard to see past all the hurt and frustration right now.",
      ]

      const botMessage = createPersonaMessage({
        content: responses[Math.floor(Math.random() * responses.length)]!,
        role: 'bot',
        config: personaConfig,
        metadata: {
          confidenceScore: Math.floor(Math.random() * 20) + 80, // Client confidence in sharing
        },
      })

      setMessages((prev) => [...prev, botMessage])
      setIsTyping(false)
    }, 1500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSendMessage()
    }
  }

  const endSession = () => {
    setSessionActive(false)
    const systemMessage = createPersonaMessage({
      content: 'SESSION ENDED. Performance analysis available in dashboard.',
      role: 'system',
      config: personaConfig,
    })
    setMessages((prev) => [...prev, systemMessage])
  }

  return (
    <div className='mx-auto max-w-5xl'>
      {/* Simplified Session Header */}
      <div className='bg-slate-800/50 border-slate-700/50 mb-6 rounded-lg border p-4 backdrop-blur'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-6'>
            <div className='flex items-center gap-2'>
              <div className='bg-green-400 h-2 w-2 animate-pulse rounded-full'></div>
              <span className='text-slate-200 text-sm font-medium'>
                Training Session
              </span>
            </div>
            <div className='bg-blue-500/20 text-blue-300 border-blue-500/30 rounded border px-2 py-1 text-xs'>
              Bias Detection: Active
            </div>
          </div>
          <button
            onClick={endSession}
            className='border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white rounded border px-3 py-1.5 text-xs transition-colors'
            disabled={!sessionActive}
          >
            End Session
          </button>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className='bg-white border-slate-200 overflow-hidden rounded-xl border shadow-xl'>
        {/* Chat Header */}
        <div className='from-slate-50 to-slate-100 border-slate-200 border-b bg-gradient-to-r p-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h3 className='text-slate-800 font-semibold'>Client: Sarah M.</h3>
              <p className='text-slate-600 text-sm'>
                Anxiety, Relationship Issues
              </p>
            </div>
            <div className='flex gap-2'>
              <span className='bg-amber-100 text-amber-700 border-amber-200 rounded-full border px-2 py-1 text-xs'>
                Moderate Difficulty
              </span>
              <span className='bg-blue-100 text-blue-700 border-blue-200 rounded-full border px-2 py-1 text-xs'>
                Low Bias Risk
              </span>
            </div>
          </div>
        </div>

        {/* Messages Area - Made Much Larger */}
        <ChatShell autoScrollDeps={[messages]}>
          {({ messagesEndRef, containerRef }) => (
            <div
              ref={containerRef}
              className='bg-slate-50/30 h-96 space-y-4 overflow-y-auto p-6'
            >
              {messages.map((message) => (
                <div key={message.id} className='space-y-2'>
                  <div
                    className={`max-w-[85%] ${
                      message.role === 'user'
                        ? 'ml-auto'
                        : message.role === 'system'
                          ? 'mx-auto'
                          : 'mr-auto'
                    }`}
                  >
                    {message.role === 'system' ? (
                      <div className='bg-amber-50 border-amber-200 rounded-lg border p-3 text-center'>
                        <div className='text-amber-800 text-sm font-medium'>
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className='text-slate-500 mb-1 text-xs font-medium'>
                          {message.role === 'user' ? 'THERAPIST' : 'CLIENT'}
                        </div>
                        <div
                          className={`rounded-2xl px-4 py-3 ${
                            message.role === 'user'
                              ? 'bg-blue-500 text-white'
                              : 'bg-white border-slate-200 text-slate-800 border shadow-sm'
                          }`}
                        >
                          {message.content}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Bias Detection Alert - Refined */}
                  {message.metadata?.biasDetected &&
                    message.role === 'user' && (
                      <div className='ml-auto max-w-[85%]'>
                        <div className='bg-amber-50 border-amber-200 rounded-lg border p-3 text-sm'>
                          <div className='text-amber-800 mb-2 flex items-center gap-2'>
                            <span>⚠️</span>
                            <span className='font-medium'>
                              Potential Bias Detected
                            </span>
                          </div>
                          <div className='text-amber-700'>
                            <strong>Suggestions:</strong>
                            <ul className='mt-1 list-inside list-disc space-y-1'>
                              {message.metadata.suggestions?.map(
                                (suggestion) => (
                                  <li key={suggestion} className='text-xs'>
                                    {suggestion}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Confidence Indicators - Subtle */}
                  {message.metadata?.confidenceScore && (
                    <div
                      className={`text-slate-500 flex items-center gap-2 text-xs ${
                        message.role === 'user'
                          ? 'justify-end'
                          : 'justify-start'
                      }`}
                    >
                      <span>
                        {message.role === 'user'
                          ? 'Therapeutic Confidence:'
                          : 'Client Openness:'}
                      </span>
                      <div className='bg-slate-200 h-1.5 w-16 overflow-hidden rounded-full'>
                        <div
                          className={`h-full rounded-full ${
                            message.role === 'user'
                              ? 'bg-blue-400'
                              : 'bg-green-400'
                          }`}
                          style={{
                            width: `${message.metadata.confidenceScore}%`,
                          }}
                        ></div>
                      </div>
                      <span className='font-medium'>
                        {message.metadata.confidenceScore}%
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className='mr-auto max-w-[85%]'>
                  <div className='text-slate-500 mb-1 text-xs font-medium'>
                    CLIENT
                  </div>
                  <div className='bg-white border-slate-200 rounded-2xl border px-4 py-3 shadow-sm'>
                    <div className='text-slate-600 flex items-center gap-2'>
                      <span>Typing</span>
                      <div className='flex gap-1'>
                        <div className='bg-slate-400 h-1.5 w-1.5 animate-pulse rounded-full'></div>
                        <div
                          className='bg-slate-400 h-1.5 w-1.5 animate-pulse rounded-full'
                          style={{ animationDelay: '0.2s' }}
                        ></div>
                        <div
                          className='bg-slate-400 h-1.5 w-1.5 animate-pulse rounded-full'
                          style={{ animationDelay: '0.4s' }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </ChatShell>

        {/* Chat Input - Streamlined */}
        <div className='border-slate-200 bg-white border-t p-4'>
          <div className='flex gap-3'>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                sessionActive
                  ? 'Type your therapeutic response...'
                  : 'Session ended'
              }
              className='border-slate-300 text-slate-800 placeholder-slate-500 focus:ring-blue-500 focus:border-transparent flex-1 resize-none rounded-lg border px-3 py-2 focus:outline-none focus:ring-2'
              rows={2}
              disabled={!sessionActive}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || !sessionActive}
              className='bg-blue-500 text-white hover:bg-blue-600 rounded-lg px-6 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50'
            >
              Send
            </button>
          </div>

          {sessionActive && (
            <div className='text-slate-500 mt-3 flex items-center justify-between text-xs'>
              <div className='flex items-center gap-4'>
                <span>Press Enter to send • Shift+Enter for new line</span>
              </div>
              <div className='flex items-center gap-2'>
                <span>Real-time Analysis:</span>
                <div className='flex items-center gap-1'>
                  <div className='bg-green-400 h-1.5 w-1.5 animate-pulse rounded-full'></div>
                  <span className='text-green-600 font-medium'>Active</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compact Session Stats */}
      <div className='mt-6 grid grid-cols-2 gap-3 md:grid-cols-4'>
        <div className='bg-slate-50 border-slate-200 rounded-lg border p-3 text-center'>
          <div className='text-slate-800 text-lg font-semibold'>
            {messages.filter((m) => m.role === 'user').length}
          </div>
          <div className='text-slate-600 text-xs'>Responses</div>
        </div>
        <div className='bg-slate-50 border-slate-200 rounded-lg border p-3 text-center'>
          <div className='text-slate-800 text-lg font-semibold'>
            {messages.filter((m) => m.metadata?.biasDetected).length}
          </div>
          <div className='text-slate-600 text-xs'>Bias Alerts</div>
        </div>
        <div className='bg-slate-50 border-slate-200 rounded-lg border p-3 text-center'>
          <div className='text-slate-800 text-lg font-semibold'>
            {(() => {
              const messagesWithConfidence = messages.filter(
                (m) => m.metadata?.confidenceScore,
              )
              const totalConfidence = messagesWithConfidence.reduce(
                (acc, m) => acc + (m.metadata?.confidenceScore || 0),
                0,
              )
              return messagesWithConfidence.length > 0
                ? Math.round(totalConfidence / messagesWithConfidence.length)
                : 0
            })()}
            %
          </div>
          <div className='text-slate-600 text-xs'>Avg Confidence</div>
        </div>
        <div className='bg-slate-50 border-slate-200 rounded-lg border p-3 text-center'>
          <div className='text-slate-800 text-lg font-semibold'>
            {Math.floor(
              (Date.now() - (messages[0]?.timestamp?.getTime() ?? Date.now())) /
                60000,
            )}
          </div>
          <div className='text-slate-600 text-xs'>Minutes</div>
        </div>
      </div>
    </div>
  )
}

export default BrutalistChatDemo
