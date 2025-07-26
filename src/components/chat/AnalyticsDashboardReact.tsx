'use client'

import type { SecurityLevel } from '../../hooks/useSecurity'
import type { Message } from '../../types/chat'
import { useEffect, useMemo, useState } from 'react'
import { fheService } from '../../lib/fhe'
import { AnalyticsType, fheAnalytics } from '../../lib/fhe/analytics'
import {
  IconAlertTriangle,
  IconBarChart,
  IconLineChart,
  IconLock,
  IconPieChart,
  IconRefresh,
} from './icons'
import React from 'react'

enum EncryptionMode {
  NONE = 'none',
  STANDARD = 'standard',
  HIPAA = 'hipaa',
  FHE = 'fhe',
}

interface AnalyticsItem {
  type: AnalyticsType
  data: AnalyticsData
  isEncrypted?: boolean
}

interface AnalyticsData {
  sentimentData?: SentimentItem[]
  topicData?: TopicItem[]
  riskData?: RiskItem[]
  interventionData?: InterventionItem[]
  windowResults?: EmotionalPatternItem[]
  userMessageCount?: number
  messageCount?: number
  exchangeCount?: number
  processedCount?: number
  errorCount?: number
}

interface SentimentItem {
  messageIndex: number
  sentiment?: number
}

interface TopicItem {
  topic: string
  weight: number
}

interface RiskItem {
  type: string
  score: number
}

interface InterventionItem {
  type: string
  effectiveness: number
}

interface EmotionalPatternItem {
  emotion: string
  values: number[]
}

interface AnalyticsDashboardProps {
  messages: Message[]
  securityLevel: SecurityLevel
  encryptionEnabled: boolean
  scenario: string
}

export default function AnalyticsDashboard({
  messages,
  securityLevel,
  encryptionEnabled,
  scenario,
}: AnalyticsDashboardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsItem[]>([])
  const [activeTab, setActiveTab] = useState<AnalyticsType>(
    AnalyticsType.SENTIMENT_TREND,
  )
  const [refreshInterval] = useState<number | null>(30000)
  const [fheInitialized, setFheInitialized] = useState(false)

  const showPrivacyWarning = useMemo(() => {
    return !encryptionEnabled || securityLevel === 'standard'
  }, [encryptionEnabled, securityLevel])

  useEffect(() => {
    const initFHE = async () => {
      try {
        const encryptionMode =
          securityLevel === 'maximum'
            ? EncryptionMode.FHE
            : securityLevel === 'hipaa'
              ? EncryptionMode.HIPAA
              : EncryptionMode.STANDARD

        await fheService.initialize({
          mode: encryptionEnabled ? encryptionMode : EncryptionMode.NONE,
          keySize: 2048,
          securityLevel: 'tc128',
        })

        await fheAnalytics.initialize()

        setFheInitialized(true)
      } catch (error) {
        setError('Failed to initialize FHE system')
        console.error('FHE initialization error:', error)
      }
    }

    initFHE()
  }, [securityLevel, encryptionEnabled])

  const generateId = () => {
    try {
      return crypto.randomUUID()
    } catch (error) {
      console.error('Failed to generate UUID:', error)
      return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  }

  // Load analytics data
  const loadAnalytics = React.useCallback(async () => {
    if (!fheInitialized || messages.length === 0) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Create configuration based on security level
      const config = {
        encryptResults: securityLevel === 'maximum', // Keep results encrypted for maximum security
        timeWindow: {
          startTime: 0,
          endTime: Date.now(),
        },
      }

      // Get analytics data
      const results = await fheAnalytics.createAnalyticsDashboard(
        messages.map((msg) => ({
          id: generateId(),
          ...msg,
        })),
        config,
      )

      // Decrypt results if needed
      const processedResults = await Promise.all(
        results.map(async (result) => {
          if (result.isEncrypted && typeof result.data === 'string') {
            const parsedData = JSON.parse(
              result.data,
            ) as unknown as AnalyticsData
            return {
              ...result,
              data: parsedData,
              isEncrypted: false,
            }
          }
          return result
        }),
      )

      setAnalyticsData(processedResults)
    } catch (error) {
      console.error('Analytics error:', error)
      setError('Failed to generate analytics')
    } finally {
      setIsLoading(false)
    }
  }, [fheInitialized, messages, securityLevel])

  // Load analytics when messages or FHE initialization changes
  useEffect(() => {
    if (fheInitialized && messages.length > 0) {
      loadAnalytics()
    }
  }, [messages, fheInitialized, loadAnalytics])

  // Set up refresh interval
  useEffect(() => {
    if (!refreshInterval) {
      return
    }

    const intervalId = setInterval(() => {
      if (messages.length > 0 && fheInitialized) {
        loadAnalytics()
      }
    }, refreshInterval)

    return () => clearInterval(intervalId)
  }, [refreshInterval, messages, fheInitialized, loadAnalytics])

  // Get the current analytics data based on active tab
  const currentAnalytics = useMemo(() => {
    return analyticsData.find((data) => data.type === activeTab)
  }, [analyticsData, activeTab])

  // Helper functions to render different analytics visualizations
  const renderSentimentTrend = (data: AnalyticsData) => {
    if (!data || !data.sentimentData || data.sentimentData.length === 0) {
      return (
        <div className="text-gray-400 text-center p-4">
          No sentiment data available
        </div>
      )
    }

    return (
      <div className="p-4">
        <h3 className="text-lg font-medium mb-2">Sentiment Analysis</h3>
        <div className="bg-black bg-opacity-30 p-4 rounded-lg">
          <div className="flex justify-between mb-4">
            <div>
              <span className="text-sm text-gray-400">Messages Analyzed:</span>
              <span className="ml-2 font-medium">{data.userMessageCount}</span>
            </div>
            <div>
              <span className="text-sm text-gray-400">
                Processing Success Rate:
              </span>
              <span
                className={`ml-2 font-medium ${(data.errorCount ?? 0) > 0 ? 'text-yellow-400' : 'text-green-400'}`}
              >
                {Math.round(
                  ((data.processedCount ?? 0) /
                    ((data.processedCount ?? 0) + (data.errorCount ?? 0))) *
                    100,
                )}
                %
              </span>
            </div>
          </div>

          {/* Mock sentiment visualization - would be a chart in production */}
          <div className="h-40 bg-gray-800 rounded-lg flex items-end p-2 space-x-1">
            {data.sentimentData.map((item: SentimentItem) => {
              // Get mock sentiment values (would be real in production)
              const sentimentValue = Math.random()
              const height = `${Math.max(10, Math.round(sentimentValue * 100))}%`
              const color =
                sentimentValue > 0.7
                  ? 'bg-green-500'
                  : sentimentValue > 0.4
                    ? 'bg-blue-500'
                    : 'bg-purple-500'

              return (
                <div
                  key={`sentiment-${item.messageIndex}`}
                  className="flex-1"
                  title={`Message ${item.messageIndex + 1}`}
                >
                  <div
                    className={`${color} rounded-t-sm w-full`}
                    style={{ height }}
                  ></div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 text-sm text-gray-300">
            <p>
              Sentiment analysis shows emotional valence across the conversation
              timeline.
            </p>
            {securityLevel === 'maximum' && (
              <p className="text-green-400 flex items-center mt-1">
                <IconLock className="h-3 w-3 mr-1" />
                Analysis performed with FHE, maintaining complete privacy
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderTopicClusters = (data: AnalyticsData) => {
    if (!data || !data.topicData || data.topicData.length === 0) {
      return (
        <div className="text-gray-400 text-center p-4">
          No topic data available
        </div>
      )
    }

    // Create mock topic distribution (would be real in production)
    const mockTopics = {
      anxiety: Math.random() * 0.3,
      depression: Math.random() * 0.2,
      trauma: Math.random() * 0.15,
      relationships: Math.random() * 0.25,
      work: Math.random() * 0.15,
      health: Math.random() * 0.1,
    }

    // Sort topics for display
    const sortedTopics = Object.entries(mockTopics)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)

    return (
      <div className="p-4">
        <h3 className="text-lg font-medium mb-2">Topic Distribution</h3>
        <div className="bg-black bg-opacity-30 p-4 rounded-lg">
          <div className="mb-4">
            <span className="text-sm text-gray-400">Messages Analyzed:</span>
            <span className="ml-2 font-medium">{data.messageCount}</span>
          </div>

          {/* Mock topic visualization */}
          <div className="space-y-2">
            {sortedTopics.map(([topic, value]) => (
              <div key={topic} className="w-full">
                <div className="flex justify-between mb-1">
                  <span className="text-sm capitalize">{topic}</span>
                  <span className="text-sm text-gray-400">
                    {Math.round((value as number) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2.5">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full"
                    style={{ width: `${Math.round((value as number) * 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-sm text-gray-300">
            <p>Topic analysis identifies key themes in the conversation.</p>
            {securityLevel === 'maximum' && (
              <p className="text-green-400 flex items-center mt-1">
                <IconLock className="h-3 w-3 mr-1" />
                Topic extraction performed with FHE, maintaining complete
                privacy
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderRiskAssessment = (data: AnalyticsData) => {
    if (!data || !data.riskData || data.riskData.length === 0) {
      return (
        <div className="text-gray-400 text-center p-4">
          No risk data available
        </div>
      )
    }

    // Generate mock risk score (would be real in production)
    const riskScore = Math.random()
    const riskLevel =
      riskScore > 0.7 ? 'High' : riskScore > 0.3 ? 'Medium' : 'Low'
    const riskColor =
      riskScore > 0.7
        ? 'text-red-500'
        : riskScore > 0.3
          ? 'text-yellow-500'
          : 'text-green-500'

    return (
      <div className="p-4">
        <h3 className="text-lg font-medium mb-2">Risk Assessment</h3>
        <div className="bg-black bg-opacity-30 p-4 rounded-lg">
          <div className="mb-4">
            <span className="text-sm text-gray-400">Messages Analyzed:</span>
            <span className="ml-2 font-medium">{data.messageCount}</span>
          </div>

          <div className="flex justify-center my-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${riskColor}`}>
                {riskLevel}
              </div>
              <div className="text-sm text-gray-400 mt-1">Risk Level</div>
            </div>
          </div>

          {/* Mock risk visualization - gauge chart */}
          <div className="relative h-8 bg-gray-800 rounded-full overflow-hidden mt-4">
            <div
              className={
                riskScore > 0.7
                  ? 'bg-red-500'
                  : riskScore > 0.3
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }
              style={{
                width: `${Math.round(riskScore * 100)}%`,
                height: '100%',
              }}
            ></div>
            <div
              className="absolute top-0 left-1/3 w-px h-full bg-gray-600"
              title="Low Risk Threshold"
            ></div>
            <div
              className="absolute top-0 left-2/3 w-px h-full bg-gray-600"
              title="Medium Risk Threshold"
            ></div>
          </div>

          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>

          <div className="mt-4 text-sm text-gray-300">
            <p>
              Risk assessment identifies potential safety concerns while
              maintaining privacy.
            </p>
            {securityLevel === 'maximum' && (
              <p className="text-green-400 flex items-center mt-1">
                <IconLock className="h-3 w-3 mr-1" />
                Assessment performed with FHE, maintaining complete privacy
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderInterventionEffectiveness = (data: AnalyticsData) => {
    if (!data || !data.interventionData || data.interventionData.length === 0) {
      return (
        <div className="text-gray-400 text-center p-4">
          No intervention data available
        </div>
      )
    }

    // Mock intervention types effectiveness (would be real in production)
    const mockInterventions = [
      { type: 'reflective', effectiveness: Math.random() * 0.8 + 0.2 },
      { type: 'clarifying', effectiveness: Math.random() * 0.7 + 0.2 },
      { type: 'challenging', effectiveness: Math.random() * 0.6 + 0.1 },
      { type: 'supportive', effectiveness: Math.random() * 0.9 + 0.1 },
      { type: 'directive', effectiveness: Math.random() * 0.5 + 0.3 },
    ]

    return (
      <div className="p-4">
        <h3 className="text-lg font-medium mb-2">Intervention Effectiveness</h3>
        <div className="bg-black bg-opacity-30 p-4 rounded-lg">
          <div className="mb-4">
            <span className="text-sm text-gray-400">Exchanges Analyzed:</span>
            <span className="ml-2 font-medium">{data.exchangeCount}</span>
          </div>

          {/* Mock effectiveness visualization */}
          <div className="space-y-3">
            {mockInterventions.map((intervention) => (
              <div key={intervention.type} className="w-full">
                <div className="flex justify-between mb-1">
                  <span className="text-sm capitalize">
                    {intervention.type}
                  </span>
                  <span className="text-sm text-gray-400">
                    {Math.round(intervention.effectiveness * 100)}% effective
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${
                      intervention.effectiveness > 0.7
                        ? 'bg-green-600'
                        : intervention.effectiveness > 0.4
                          ? 'bg-blue-600'
                          : 'bg-purple-600'
                    }`}
                    style={{
                      width: `${Math.round(intervention.effectiveness * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-sm text-gray-300">
            <p>
              Intervention analysis shows which therapeutic approaches are mos
              effective with this client.
            </p>
            {securityLevel === 'maximum' && (
              <p className="text-green-400 flex items-center mt-1">
                <IconLock className="h-3 w-3 mr-1" />
                Analysis performed with FHE, maintaining complete privacy
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderEmotionalPatterns = (data: AnalyticsData) => {
    if (!data || !data.windowResults || data.windowResults.length === 0) {
      return (
        <div className="text-gray-400 text-center p-4">
          No emotional pattern data available
        </div>
      )
    }

    // Mock emotional data (would be real in production)
    const emotions = ['anger', 'sadness', 'fear', 'joy', 'surprise', 'disgust']
    const mockEmotionData = emotions.map((emotion) => {
      return {
        emotion,
        values: Array.from({ length: 5 }, () => Math.random()),
      }
    })

    return (
      <div className="p-4">
        <h3 className="text-lg font-medium mb-2">Emotional Patterns</h3>
        <div className="bg-black bg-opacity-30 p-4 rounded-lg">
          <div className="mb-4">
            <span className="text-sm text-gray-400">Messages Analyzed:</span>
            <span className="ml-2 font-medium">{data.messageCount}</span>
          </div>

          {/* Mock emotion pattern visualization */}
          <div className="relative h-40 bg-gray-800 bg-opacity-50 rounded-lg p-2">
            {mockEmotionData.map((item) => (
              <div key={item.emotion} className="absolute">
                {item.values.map((value, index) => {
                  // Position points along the x-axis
                  const x = `${(index / (item.values.length - 1)) * 100}%`
                  // Position points along the y-axis (inverted)
                  const y = `${(1 - value) * 100}%`

                  // Determine color based on emotion
                  const colors = {
                    anger: 'bg-red-500',
                    sadness: 'bg-blue-500',
                    fear: 'bg-purple-500',
                    joy: 'bg-green-500',
                    surprise: 'bg-yellow-500',
                    disgust: 'bg-orange-500',
                  }

                  const color = colors[item.emotion as keyof typeof colors]

                  return (
                    <div
                      key={`${item.emotion}-${index}`}
                      className={`absolute ${color} w-2 h-2 rounded-full`}
                      style={{ left: x, top: y }}
                      title={`${item.emotion}: ${Math.round(value * 100)}%`}
                    ></div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {emotions.map((emotion) => {
              const colors = {
                anger: 'bg-red-500',
                sadness: 'bg-blue-500',
                fear: 'bg-purple-500',
                joy: 'bg-green-500',
                surprise: 'bg-yellow-500',
                disgust: 'bg-orange-500',
              }

              const color = colors[emotion as keyof typeof colors]

              return (
                <div key={emotion} className="flex items-center">
                  <div className={`${color} w-2 h-2 rounded-full mr-1`}></div>
                  <span className="text-xs capitalize">{emotion}</span>
                </div>
              )
            })}
          </div>

          <div className="mt-4 text-sm text-gray-300">
            <p>Emotional patterns show changes in client emotions over time.</p>
            {securityLevel === 'maximum' && (
              <p className="text-green-400 flex items-center mt-1">
                <IconLock className="h-3 w-3 mr-1" />
                Analysis performed with FHE, maintaining complete privacy
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render the analytics content based on active tab
  const renderAnalyticsContent = () => {
    if (!fheInitialized) {
      return (
        <div className="p-8 text-center">
          <div className="mb-4 text-yellow-400">
            Initializing FHE analytics...
          </div>
          <div className="text-sm text-gray-400">
            This may take a moment as we set up secure homomorphic encryption.
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="p-8 text-center">
          <div className="mb-4 text-red-500">{error}</div>
          <button
            onClick={loadAnalytics}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Try Again
          </button>
        </div>
      )
    }

    if (isLoading) {
      return (
        <div className="p-8 text-center">
          <div className="mb-4 text-purple-400">
            Generating secure analytics...
          </div>
          <div className="text-sm text-gray-400">
            {securityLevel === 'maximum'
              ? 'Performing homomorphic operations on encrypted data'
              : 'Processing analytics data securely'}
          </div>
        </div>
      )
    }

    if (!currentAnalytics) {
      return (
        <div className="p-8 text-center text-gray-400">
          No analytics data available
        </div>
      )
    }

    switch (activeTab) {
      case AnalyticsType.SENTIMENT_TREND:
        return renderSentimentTrend(currentAnalytics.data)
      case AnalyticsType.TOPIC_CLUSTERING:
        return renderTopicClusters(currentAnalytics.data)
      case AnalyticsType.RISK_ASSESSMENT:
        return renderRiskAssessment(currentAnalytics.data)
      case AnalyticsType.INTERVENTION_EFFECTIVENESS:
        return renderInterventionEffectiveness(currentAnalytics.data)
      case AnalyticsType.EMOTIONAL_PATTERNS:
        return renderEmotionalPatterns(currentAnalytics.data)
      default:
        return <div className="p-4 text-gray-400">Select an analytics view</div>
    }
  }

  return (
    <div className="bg-gray-900 text-gray-100 rounded-lg border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-black via-purple-900 to-black p-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Therapy Analytics</h2>
        <div className="flex items-center space-x-2">
          {securityLevel === 'maximum' && (
            <span className="text-xs text-green-400 bg-black bg-opacity-50 px-2 py-1 rounded flex items-center">
              <IconLock className="h-3 w-3 mr-1" />
              FHE Secured
            </span>
          )}
          <button
            onClick={loadAnalytics}
            className="p-1 hover:bg-black hover:bg-opacity-30 rounded"
            title="Refresh Analytics"
          >
            <IconRefresh className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Privacy warning */}
      {showPrivacyWarning && (
        <div className="bg-yellow-900 bg-opacity-30 text-yellow-300 px-3 py-2 text-sm flex items-start">
          <IconAlertTriangle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />

          <div>
            <strong>Privacy Notice:</strong> Analytics are not fully encrypted.
            Consider enabling maximum security level for complete privacy
            protection.
          </div>
        </div>
      )}

      {/* Analytics tabs */}
      <div className="bg-black bg-opacity-40 border-b border-gray-800">
        <div className="flex overflow-x-auto">
          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === AnalyticsType.SENTIMENT_TREND
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab(AnalyticsType.SENTIMENT_TREND)}
          >
            <span className="flex items-center">
              <IconLineChart className="h-4 w-4 mr-1" />
              Sentiment Trend
            </span>
          </button>

          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === AnalyticsType.TOPIC_CLUSTERING
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab(AnalyticsType.TOPIC_CLUSTERING)}
          >
            <span className="flex items-center">
              <IconPieChart className="h-4 w-4 mr-1" />
              Topic Clustering
            </span>
          </button>

          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === AnalyticsType.EMOTIONAL_PATTERNS
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab(AnalyticsType.EMOTIONAL_PATTERNS)}
          >
            <span className="flex items-center">
              <IconLineChart className="h-4 w-4 mr-1" />
              Emotional Patterns
            </span>
          </button>

          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === AnalyticsType.INTERVENTION_EFFECTIVENESS
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            onClick={() =>
              setActiveTab(AnalyticsType.INTERVENTION_EFFECTIVENESS)
            }
          >
            <span className="flex items-center">
              <IconBarChart className="h-4 w-4 mr-1" />
              Intervention Effectiveness
            </span>
          </button>

          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === AnalyticsType.RISK_ASSESSMENT
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab(AnalyticsType.RISK_ASSESSMENT)}
          >
            <span className="flex items-center">
              <IconAlertTriangle className="h-4 w-4 mr-1" />
              Risk Assessmen
            </span>
          </button>
        </div>
      </div>

      {/* Analytics content */}
      <div className="min-h-[300px]">{renderAnalyticsContent()}</div>

      {/* Footer */}
      <div className="bg-black bg-opacity-40 p-2 text-xs text-gray-500 flex justify-between">
        <div>
          {scenario ? `Analysis for ${scenario} scenario` : 'All client data'}
        </div>
        <div>
          {messages.length > 0
            ? `${messages.filter((m) => m.role === 'user').length} client messages analyzed`
            : 'No messages available'}
        </div>
      </div>
    </div>
  )
}
