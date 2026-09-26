/**
 * Real-time Conversation Integration Example
 *
 * Demonstrates how to integrate Pixel model analysis into existing chat component.
 * Shows EQ metrics tracking, bias detection, and crisis intervention in action.
 */

import { AlertCircle, Zap, AlertTriangle } from 'lucide-react'
import { useState, useCallback, useEffect, SyntheticEvent } from 'react'

import { Badge } from '@/components/ui/badge/index'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/index'
import { usePixelConversationIntegration } from '@/hooks/usePixelConversationIntegration'
import type { PixelInferenceResponse } from '@/types/pixel'

interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  pixelMetrics?: PixelInferenceResponse
}

interface PixelEnhancedChatProps {
  sessionId: string
  userId: string
  onMessage?: (message: string) => void
  onCrisisDetected?: () => void
}

/**
 * Enhanced chat component with Pixel integration
 */
export function PixelEnhancedChat({
  sessionId,
  userId,
  onMessage,
  onCrisisDetected,
}: PixelEnhancedChatProps) {
  // Integration hook
  const {
    analyzeMessage,
    eqMetrics,
    crisisStatus,
    biasFlags,
    lastAnalysis,
    isAnalyzing,
    error,
    clearBiasFlags,
  } = usePixelConversationIntegration({
    sessionId,
    userId,
    pixelApiUrl:
      process.env['REACT_APP_PIXEL_API_URL'] ?? 'http://localhost:8001',
  })

  // Local state
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [showMetrics, setShowMetrics] = useState(true)

  // Crisis detection handler
  useEffect(() => {
    if (crisisStatus?.isCrisis && onCrisisDetected) {
      onCrisisDetected()
    }
  }, [crisisStatus?.isCrisis, onCrisisDetected])

  /**
   * Handle sending message with Pixel analysis
   */
  const handleSendMessage = useCallback(
    async (e: SyntheticEvent) => {
      e.preventDefault()
      if (!inputValue.trim()) return

      // Add user message to chat
      const userMessage: ConversationMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: inputValue,
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, userMessage])
      setInputValue('')

      // Analyze with Pixel
      const pixelResponse = await analyzeMessage(inputValue, 'support')

      if (pixelResponse) {
        // Add assistant response with metrics
        const assistantMessage: ConversationMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: pixelResponse.response,
          timestamp: Date.now(),
          pixelMetrics: pixelResponse,
        }

        setMessages((prev) => [...prev, assistantMessage])

        onMessage?.(inputValue)
      } else if (error) {
        // Show error message
        const errorMessage: ConversationMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: `Error: ${error}`,
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    },
    [inputValue, analyzeMessage, onMessage, error],
  )

  return (
    <div className="flex h-full gap-4">
      {/* Chat Area */}
      <div className="flex flex-1 flex-col rounded-none border border-border bg-card">
        {/* Header */}
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Therapeutic Conversation
            </h2>
            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className="text-sm text-foreground hover:text-muted-foreground"
            >
              {showMetrics ? 'Hide' : 'Show'} Metrics
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="mt-8 text-center text-muted-foreground">
              <p>Start a conversation to see Pixel analysis</p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                pixelMetrics={msg.pixelMetrics}
                showMetrics={showMetrics}
              />
            ))
          )}
          {isAnalyzing && (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-none border-b-2 border-ring"></div>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSendMessage}
          className="border-t border-border p-4"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              disabled={isAnalyzing}
              className="flex-1 rounded-none border border-input px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={isAnalyzing || !inputValue.trim()}
              className="rounded-none bg-primary px-4 py-2 text-primary-foreground hover:bg-accent disabled:opacity-35"
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Metrics Sidebar */}
      {showMetrics && (
        <div className="w-80 space-y-4 overflow-y-auto">
          {lastAnalysis?.behavioral_pattern && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="h-4 w-4 text-foreground">🧠</span>
                  <span>Behavioral Pattern</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm font-medium">
                  {lastAnalysis.behavioral_pattern}
                </p>
                {lastAnalysis.behavioral_pattern_confidence !== undefined && (
                  <p className="text-sm text-muted-foreground">
                    Confidence:{' '}
                    {(lastAnalysis.behavioral_pattern_confidence * 100).toFixed(
                      0,
                    )}
                    %
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* EQ Metrics */}
          {eqMetrics && eqMetrics.turnsAnalyzed > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-foreground" />
                  EQ Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <MetricBar
                  label="Emotional Awareness"
                  value={
                    eqMetrics.emotionalAwareness[
                      eqMetrics.emotionalAwareness.length - 1
                    ] ?? 0
                  }
                />
                <MetricBar
                  label="Empathy"
                  value={
                    eqMetrics.empathyRecognition[
                      eqMetrics.empathyRecognition.length - 1
                    ] ?? 0
                  }
                />
                <MetricBar
                  label="Regulation"
                  value={
                    eqMetrics.emotionalRegulation[
                      eqMetrics.emotionalRegulation.length - 1
                    ] ?? 0
                  }
                />
                <MetricBar
                  label="Social Cognition"
                  value={
                    eqMetrics.socialCognition[
                      eqMetrics.socialCognition.length - 1
                    ] ?? 0
                  }
                />
                <MetricBar
                  label="Interpersonal Skills"
                  value={
                    eqMetrics.interpersonalSkills[
                      eqMetrics.interpersonalSkills.length - 1
                    ] ?? 0
                  }
                />
              </CardContent>
            </Card>
          )}

          {/* Crisis Status */}
          {crisisStatus && (
            <Card
              className={
                crisisStatus.isCrisis
                  ? 'border-ring bg-secondary'
                  : 'border-input bg-card'
              }
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {crisisStatus.isCrisis ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-foreground" />
                      <span className="text-foreground">Crisis Alert</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 text-foreground" />
                      <span className="text-foreground">
                        No Crisis Detected
                      </span>
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Risk Level:</span>
                  <Badge
                    variant={
                      crisisStatus.riskLevel === 'critical'
                        ? 'destructive'
                        : crisisStatus.riskLevel === 'high'
                          ? 'secondary'
                          : 'default'
                    }
                  >
                    {crisisStatus.riskLevel.toUpperCase()}
                  </Badge>
                </div>
                {crisisStatus.signals.length > 0 && (
                  <div>
                    <p className="mb-1 text-sm font-medium">Signals:</p>
                    <div className="space-y-1">
                      {crisisStatus.signals.map((signal) => (
                        <div
                          key={`${signal.type}:${signal.severity}`}
                          className="rounded-none bg-secondary px-2 py-1 text-xs text-foreground ring-1 ring-ring"
                        >
                          {signal.type} (severity: {signal.severity.toFixed(2)})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {crisisStatus.interventionTriggered && (
                  <div className="mt-2 rounded-none bg-secondary p-2 ring-1 ring-ring">
                    <p className="text-xs font-semibold text-foreground">
                      Intervention: {crisisStatus.interventionType}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Bias Detection */}
          {biasFlags.length > 0 && (
            <Card className="border-ring bg-secondary">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-foreground" />
                    Bias Detected
                  </span>
                  <button
                    onClick={clearBiasFlags}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {biasFlags.map((flag) => (
                  <div
                    key={`${flag.detected}:${flag.severity}:${flag.suggestedCorrection ?? ''}`}
                    className="text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">
                        {flag.detected}
                      </p>
                      <Badge
                        variant={
                          flag.severity === 'high' ? 'destructive' : 'secondary'
                        }
                      >
                        {flag.severity.toUpperCase()}
                      </Badge>
                    </div>
                    {flag.suggestedCorrection && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Suggestion: {flag.suggestedCorrection}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Message bubble component
 */
function MessageBubble({
  message,
  pixelMetrics,
  showMetrics,
}: {
  message: ConversationMessage
  pixelMetrics?: PixelInferenceResponse
  showMetrics: boolean
}) {
  return (
    <div
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-sm rounded-none px-4 py-2 ${
          message.role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-foreground'
        }`}
      >
        <p className="text-sm">{message.content}</p>
        {showMetrics && pixelMetrics && (
          <div className="mt-2 space-y-1 text-xs">
            {pixelMetrics.eq_scores && (
              <div>
                <p className="font-semibold opacity-75">
                  Overall EQ: {pixelMetrics.eq_scores.overall_eq.toFixed(2)}
                </p>
              </div>
            )}
            {pixelMetrics.behavioral_pattern && (
              <div>
                <p className="font-semibold opacity-75">
                  Pattern: {pixelMetrics.behavioral_pattern}
                </p>
                {pixelMetrics.behavioral_pattern_confidence !== undefined && (
                  <p className="opacity-75">
                    Confidence:{' '}
                    {(pixelMetrics.behavioral_pattern_confidence * 100).toFixed(
                      0,
                    )}
                    %
                  </p>
                )}
              </div>
            )}
            {pixelMetrics.conversation_metadata && (
              <div>
                <p className="opacity-75">
                  Safety:{' '}
                  {pixelMetrics.conversation_metadata.safety_score.toFixed(2)},
                  Bias:{' '}
                  {pixelMetrics.conversation_metadata.bias_score.toFixed(2)}
                </p>
              </div>
            )}
            {pixelMetrics.memories && pixelMetrics.memories.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer font-semibold opacity-75 hover:opacity-100">
                  📚 Context Used ({pixelMetrics.memories.length})
                </summary>
                <ul className="mt-1 max-h-32 list-disc space-y-1 overflow-y-auto rounded-none bg-secondary p-2 pl-3">
                  {pixelMetrics.memories.map((mem, i) => (
                    <li key={i} className="text-[10px] leading-3">
                      {mem}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="pt-1 opacity-50">
              Latency: {pixelMetrics.inference_time_ms.toFixed(0)}ms
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Metric bar component
 */
function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs font-semibold text-muted-foreground">
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <div className="h-2 w-full rounded-none bg-secondary">
        <div
          className="h-2 rounded-none bg-primary transition-all"
          style={{ width: `${value * 100}%` }}
        ></div>
      </div>
    </div>
  )
}

export default PixelEnhancedChat
