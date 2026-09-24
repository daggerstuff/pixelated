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
    <div className="mx-auto max-w-5xl">
      {/* Simplified Session Header */}
      <div className="mb-6 rounded-none border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-none bg-primary"></div>
              <span className="text-sm font-medium text-foreground">
                Training Session
              </span>
            </div>
            <div className="rounded-none border border-input bg-secondary px-2 py-1 text-xs text-foreground">
              Bias Detection: Active
            </div>
          </div>
          <button
            onClick={endSession}
            className="rounded-none border-input px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
            disabled={!sessionActive}
          >
            End Session
          </button>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="overflow-hidden rounded-none border border-border bg-card">
        {/* Chat Header */}
        <div className="border-b border-border bg-secondary p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">
                Client: Sarah M.
              </h3>
              <p className="text-sm text-foreground">
                Anxiety, Relationship Issues
              </p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-none border border-input bg-secondary px-2 py-1 text-xs text-foreground">
                Moderate Difficulty
              </span>
              <span className="rounded-none border border-input bg-secondary px-2 py-1 text-xs text-foreground">
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
              className="h-96 space-y-4 overflow-y-auto bg-secondary p-6"
            >
              {messages.map((message) => (
                <div key={message.id} className="space-y-2">
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
                      <div className="rounded-none border border-ring bg-secondary p-3 text-center">
                        <div className="text-sm font-medium text-foreground">
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-1 text-xs font-medium text-muted-foreground">
                          {message.role === 'user' ? 'THERAPIST' : 'CLIENT'}
                        </div>
                        <div
                          className={`rounded-none px-4 py-3 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'border border-border bg-secondary text-foreground'
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
                      <div className="ml-auto max-w-[85%]">
                        <div className="rounded-none border border-ring bg-secondary p-3 text-sm">
                          <div className="mb-2 flex items-center gap-2 text-foreground">
                            <span>⚠️</span>
                            <span className="font-medium">
                              Potential Bias Detected
                            </span>
                          </div>
                          <div className="text-foreground">
                            <strong>Suggestions:</strong>
                            <ul className="mt-1 list-inside list-disc space-y-1">
                              {message.metadata.suggestions?.map(
                                (suggestion) => (
                                  <li key={suggestion} className="text-xs">
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
                      className={`flex items-center gap-2 text-xs text-muted-foreground ${
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
                      <div className="h-1.5 w-16 overflow-hidden rounded-none bg-secondary">
                        <div
                          className={`h-full rounded-none ${
                            message.role === 'user'
                              ? 'bg-primary'
                              : 'bg-foreground'
                          }`}
                          style={{
                            width: `${message.metadata.confidenceScore}%`,
                          }}
                        ></div>
                      </div>
                      <span className="font-medium">
                        {message.metadata.confidenceScore}%
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="mr-auto max-w-[85%]">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    CLIENT
                  </div>
                  <div className="rounded-none border border-border bg-secondary px-4 py-3">
                    <div className="flex items-center gap-2 text-foreground">
                      <span>Typing</span>
                      <div className="flex gap-1">
                        <div className="h-1.5 w-1.5 animate-pulse rounded-none bg-muted-foreground"></div>
                        <div
                          className="h-1.5 w-1.5 animate-pulse rounded-none bg-muted-foreground"
                          style={{ animationDelay: '0.2s' }}
                        ></div>
                        <div
                          className="h-1.5 w-1.5 animate-pulse rounded-none bg-muted-foreground"
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
        <div className="border-t border-border bg-card p-4">
          <div className="flex gap-3">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                sessionActive
                  ? 'Type your therapeutic response...'
                  : 'Session ended'
              }
              className="flex-1 resize-none rounded-none border border-input px-3 py-2 text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
              rows={2}
              disabled={!sessionActive}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || !sessionActive}
              className="rounded-none bg-primary px-6 py-2 font-medium text-primary-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35"
            >
              Send
            </button>
          </div>

          {sessionActive && (
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>Press Enter to send • Shift+Enter for new line</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Real-time Analysis:</span>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-none bg-primary"></div>
                  <span className="font-medium text-foreground">Active</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compact Session Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-none border border-border bg-secondary p-3 text-center">
          <div className="text-lg font-semibold text-foreground">
            {messages.filter((m) => m.role === 'user').length}
          </div>
          <div className="text-xs text-foreground">Responses</div>
        </div>
        <div className="rounded-none border border-border bg-secondary p-3 text-center">
          <div className="text-lg font-semibold text-foreground">
            {messages.filter((m) => m.metadata?.biasDetected).length}
          </div>
          <div className="text-xs text-foreground">Bias Alerts</div>
        </div>
        <div className="rounded-none border border-border bg-secondary p-3 text-center">
          <div className="text-lg font-semibold text-foreground">
            {(() => {
              const messagesWithConfidence = messages.filter(
                (m) => m.metadata?.confidenceScore,
              )
              const totalConfidence = messagesWithConfidence.reduce(
                (acc, m) => acc + (m.metadata?.confidenceScore ?? 0),
                0,
              )
              return messagesWithConfidence.length > 0
                ? Math.round(totalConfidence / messagesWithConfidence.length)
                : 0
            })()}
            %
          </div>
          <div className="text-xs text-foreground">Avg Confidence</div>
        </div>
        <div className="rounded-none border border-border bg-secondary p-3 text-center">
          <div className="text-lg font-semibold text-foreground">{0}</div>
          <div className="text-xs text-foreground">Minutes</div>
        </div>
      </div>
    </div>
  )
}

export default BrutalistChatDemo
