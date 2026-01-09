/**
 * Real-time Conversation Integration Example
 *
 * Demonstrates how to integrate Pixel model analysis into existing chat component.
 * Shows EQ metrics tracking, bias detection, and crisis intervention in action.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { usePixelConversationIntegration } from '@/hooks/usePixelConversationIntegration'
import type { PixelInferenceResponse } from '@/types/pixel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Zap, AlertTriangle } from 'lucide-react'

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
        pixelApiUrl: process.env.REACT_APP_PIXEL_API_URL || 'http://localhost:8001',
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
        async (e: React.FormEvent) => {
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
        [inputValue, analyzeMessage, onMessage, error]
    )

    return (
        <div className="flex gap-4 h-full">
            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200">
                {/* Header */}
                <div className="border-b border-gray-200 p-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Therapeutic Conversation
                        </h2>
                        <button
                            onClick={() => setShowMetrics(!showMetrics)}
                            className="text-sm text-blue-600 hover:text-blue-700"
                        >
                            {showMetrics ? 'Hide' : 'Show'} Metrics
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="text-center text-gray-400 mt-8">
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
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <form
                    onSubmit={handleSendMessage}
                    className="border-t border-gray-200 p-4"
                >
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Type your message..."
                            disabled={isAnalyzing}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            disabled={isAnalyzing || !inputValue.trim()}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                        >
                            Send
                        </button>
                    </div>
                </form>
            </div>

            {/* Metrics Sidebar */}
            {showMetrics && (
                <div className="w-80 space-y-4 overflow-y-auto">
                    {/* EQ Metrics */}
                    {eqMetrics && eqMetrics.turnsAnalyzed > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-yellow-600" />
                                    EQ Metrics
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <MetricBar
                                    label="Emotional Awareness"
                                    value={
                                        eqMetrics.emotionalAwareness[
                                        eqMetrics.emotionalAwareness.length - 1
                                        ] || 0
                                    }
                                />
                                <MetricBar
                                    label="Empathy"
                                    value={
                                        eqMetrics.empathyRecognition[
                                        eqMetrics.empathyRecognition.length - 1
                                        ] || 0
                                    }
                                />
                                <MetricBar
                                    label="Regulation"
                                    value={
                                        eqMetrics.emotionalRegulation[
                                        eqMetrics.emotionalRegulation.length - 1
                                        ] || 0
                                    }
                                />
                                <MetricBar
                                    label="Social Cognition"
                                    value={
                                        eqMetrics.socialCognition[eqMetrics.socialCognition.length - 1] || 0
                                    }
                                />
                                <MetricBar
                                    label="Interpersonal Skills"
                                    value={
                                        eqMetrics.interpersonalSkills[
                                        eqMetrics.interpersonalSkills.length - 1
                                        ] || 0
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
                                    ? 'border-red-300 bg-red-50'
                                    : 'border-green-300 bg-green-50'
                            }
                        >
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    {crisisStatus.isCrisis ? (
                                        <>
                                            <AlertCircle className="h-4 w-4 text-red-600" />
                                            <span className="text-red-900">Crisis Alert</span>
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="h-4 w-4 text-green-600" />
                                            <span className="text-green-900">No Crisis Detected</span>
                                        </>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex justify-between items-center">
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
                                        <p className="text-sm font-medium mb-1">Signals:</p>
                                        <div className="space-y-1">
                                            {crisisStatus.signals.map((signal, idx) => (
                                                <div
                                                    key={idx}
                                                    className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded"
                                                >
                                                    {signal.type} (severity: {signal.severity.toFixed(2)})
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {crisisStatus.interventionTriggered && (
                                    <div className="mt-2 p-2 bg-red-200 rounded">
                                        <p className="text-xs font-semibold text-red-900">
                                            Intervention: {crisisStatus.interventionType}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Bias Detection */}
                    {biasFlags.length > 0 && (
                        <Card className="border-orange-300 bg-orange-50">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 justify-between">
                                    <span className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                                        Bias Detected
                                    </span>
                                    <button
                                        onClick={clearBiasFlags}
                                        className="text-xs text-orange-600 hover:text-orange-700"
                                    >
                                        Clear
                                    </button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {biasFlags.map((flag, idx) => (
                                    <div key={idx} className="text-sm">
                                        <div className="flex items-center justify-between">
                                            <p className="font-medium text-orange-900">
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
                                            <p className="text-xs text-orange-800 mt-1">
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
                className={`max-w-sm px-4 py-2 rounded-lg ${message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
            >
                <p className="text-sm">{message.content}</p>
                {showMetrics && pixelMetrics && (
                    <div className="mt-2 text-xs space-y-1">
                        {pixelMetrics.eq_scores && (
                            <div>
                                <p className="font-semibold opacity-75">
                                    Overall EQ: {pixelMetrics.eq_scores.overall_eq.toFixed(2)}
                                </p>
                            </div>
                        )}
                        {pixelMetrics.conversation_metadata && (
                            <div>
                                <p className="opacity-75">
                                    Safety: {pixelMetrics.conversation_metadata.safety_score.toFixed(2)}, Bias:{' '}
                                    {pixelMetrics.conversation_metadata.bias_score.toFixed(2)}
                                </p>
                            </div>
                        )}
                        <p className="opacity-50">
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
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <span className="text-xs font-semibold text-gray-600">
                    {(value * 100).toFixed(0)}%
                </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${value * 100}%` }}
                ></div>
            </div>
        </div>
    )
}

export default PixelEnhancedChat
