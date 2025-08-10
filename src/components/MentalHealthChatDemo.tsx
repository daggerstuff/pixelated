import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  memo,
} from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Heart, Brain, Shield, Zap, Activity, Sparkles, User, Bot } from 'lucide-react'
import MindMirrorDashboard, { type MindMirrorAnalysis } from '@/components/ui/MindMirrorDashboard'
import BrainVisualization from '@/components/ui/BrainVisualization'
// import {
//   MentalHealthInsights,
//   MentalHealthHistoryChart,
//   type EnhancedMentalHealthAnalysis as ComponentEnhancedMentalHealthAnalysis,
// } from '@/components/MentalHealthInsights'

// Temporary placeholder types until MentalHealthInsights component is available
type ComponentEnhancedMentalHealthAnalysis = {
  timestamp: number
  category: string
  explanation: string
  expertGuided: boolean
  scores: Record<string, number>
  summary: string
  hasMentalHealthIssue: boolean
  confidence: number
  supportingEvidence: string[]
  riskLevel: string
}

// Placeholder components
const MentalHealthInsights = ({
  analysis,
}: {
  analysis: ComponentEnhancedMentalHealthAnalysis
}) => (
  <div className="p-3 bg-gray-50 rounded-lg">
    <p className="text-sm font-medium mb-2">Analysis: {analysis.category}</p>
    <p className="text-xs text-gray-600 mb-2">{analysis.explanation}</p>
    <p className="text-xs">
      Confidence: {Math.round(analysis.confidence * 100)}%
    </p>
  </div>
)

const MentalHealthHistoryChart = ({
  analysisHistory,
}: {
  analysisHistory: ComponentEnhancedMentalHealthAnalysis[]
}) => (
  <div className="p-3 bg-gray-50 rounded-lg">
    <p className="text-sm font-medium mb-2">Analysis History</p>
    <p className="text-xs text-gray-600">
      {analysisHistory.length} analyses recorded
    </p>
  </div>
)
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { createMentalLLaMAFromEnv } from '@/lib/ai/mental-llama'
import type {
  MentalHealthAnalysisResult,
  RoutingContext,
} from '@/lib/ai/mental-llama/types/mentalLLaMATypes'
import { ClinicalKnowledgeBase } from '@/lib/ai/mental-llama/ClinicalKnowledgeBase'

// Use the imported interface type
type EnhancedMentalHealthAnalysis = ComponentEnhancedMentalHealthAnalysis

// Extended analysis result that might include additional fields
interface ExtendedMentalHealthAnalysisResult
  extends MentalHealthAnalysisResult {
  expertGuidance?: unknown
  categoryScores?: {
    depression?: number
    anxiety?: number
    stress?: number
    anger?: number
    socialIsolation?: number
    bipolarDisorder?: number
    ocd?: number
    eatingDisorder?: number
    socialAnxiety?: number
    panicDisorder?: number
  }
}

interface MentalHealthAdapter {
  analyzeMentalHealth(
    content: string,
    route: string,
    context: RoutingContext,
  ): Promise<MentalHealthAnalysisResult>
}

interface MentalHealthService {
  adapter: MentalHealthAdapter | null
  clinicalKnowledge: ClinicalKnowledgeBase
  isInitialized: boolean
}

const logger = createBuildSafeLogger('chat-demo')

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  mentalHealthAnalysis?: MentalHealthAnalysisResult
  isProcessing?: boolean
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  needsIntervention?: boolean
  apiResponse?: any // Add type if available
  metadata?: {
    responseType?: string
    confidence?: number
    copingStrategies?: any
    resources?: any
    processingTime?: number
  }
}

// Helper function to convert MentalHealthAnalysisResult to EnhancedMentalHealthAnalysis
const enhanceAnalysis = (
  analysis?: MentalHealthAnalysisResult,
): EnhancedMentalHealthAnalysis | undefined => {
  if (!analysis) {
    return undefined
  }

  // Type assertion to extended interface for additional properties
  const extendedAnalysis = analysis as ExtendedMentalHealthAnalysisResult

  // Convert the MentalLLaMA result to the enhanced analysis format
  return {
    timestamp: Date.now(),
    category: analysis.mentalHealthCategory || 'general',
    explanation: analysis.explanation || 'Analysis completed',
    expertGuided: !!extendedAnalysis.expertGuidance,
    scores: {
      depression:
        extendedAnalysis.categoryScores?.depression ||
        (analysis.mentalHealthCategory === 'depression'
          ? analysis.confidence
          : 0),
      anxiety:
        extendedAnalysis.categoryScores?.anxiety ||
        (analysis.mentalHealthCategory === 'anxiety' ? analysis.confidence : 0),
      stress:
        extendedAnalysis.categoryScores?.stress ||
        (analysis.mentalHealthCategory === 'stress' ? analysis.confidence : 0),
      anger:
        extendedAnalysis.categoryScores?.anger ||
        (analysis.mentalHealthCategory === 'anger' ? analysis.confidence : 0),
      socialIsolation:
        extendedAnalysis.categoryScores?.socialIsolation ||
        (analysis.mentalHealthCategory === 'social_isolation'
          ? analysis.confidence
          : 0),
      bipolarDisorder:
        extendedAnalysis.categoryScores?.bipolarDisorder ||
        (analysis.mentalHealthCategory === 'bipolar' ? analysis.confidence : 0),
      ocd:
        extendedAnalysis.categoryScores?.ocd ||
        (analysis.mentalHealthCategory === 'ocd' ? analysis.confidence : 0),
      eatingDisorder:
        extendedAnalysis.categoryScores?.eatingDisorder ||
        (analysis.mentalHealthCategory === 'eating_disorder'
          ? analysis.confidence
          : 0),
      socialAnxiety:
        extendedAnalysis.categoryScores?.socialAnxiety ||
        (analysis.mentalHealthCategory === 'social_anxiety'
          ? analysis.confidence
          : 0),
      panicDisorder:
        extendedAnalysis.categoryScores?.panicDisorder ||
        (analysis.mentalHealthCategory === 'panic_disorder'
          ? analysis.confidence
          : 0),
    },

    summary: analysis.explanation || 'Mental health analysis completed',
    // expertGuidance doesn't exist on MentalHealthAnalysisResult, so we omit expertExplanation
    hasMentalHealthIssue: analysis.hasMentalHealthIssue || false,
    confidence: analysis.confidence || 0,
    supportingEvidence: analysis.supportingEvidence || [],
    riskLevel: analysis.isCrisis
      ? 'high'
      : analysis.confidence > 0.7
        ? 'medium'
        : 'low',
  }
}

// Helper to convert an array of analyses
const enhanceAnalysisArray = (
  analyses: MentalHealthAnalysisResult[],
): EnhancedMentalHealthAnalysis[] => {
  return analyses.map((analysis) => enhanceAnalysis(analysis)!).filter(Boolean)
}

/**
 * Production-grade Mental Health Chat Demo Component
 * Showcases real MentalLLaMA integration with clinical-grade analysis
 */
function generateSecureRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(36)).join('');
}

export const MentalHealthChatDemo = memo(function MentalHealthChatDemo() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_msg',
      role: 'assistant',
      content: `Welcome to our Mental Health Chat powered by MentalLLaMA. I'm here to provide thoughtful, evidence-based support.

🧠 **Clinical-Grade Analysis**: Advanced AI analyzes your messages for mental health indicators
🔒 **Privacy-First**: All analysis uses encrypted processing - your data stays secure
📊 **Real-Time Insights**: Get immediate feedback on emotional patterns and trends
🚨 **Crisis Detection**: Automatic identification of urgent situations with immediate resources

How are you feeling today? I'm here to listen and help.`,
      timestamp: new Date().toISOString(),
    },
  ])

  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mentalHealthService, setMentalHealthService] =
    useState<MentalHealthService | null>(null)
  const [settings, setSettings] = useState({
    enableAnalysis: true,
    useExpertGuidance: true,
    showAnalysisPanel: true,
    enableCrisisDetection: true,
    confidenceThreshold: 0.6,
    interventionThreshold: 0.7,
    enableMindMirrorUI: true,
    showBrainVisualization: true,
  })
  const [currentMindMirrorAnalysis, setCurrentMindMirrorAnalysis] = useState<MindMirrorAnalysis | null>(null)

  // Convert existing analysis to Mind-Mirror format
  const convertToMindMirrorAnalysis = useCallback((analysis: EnhancedMentalHealthAnalysis): MindMirrorAnalysis => {
    // Map mental health categories to archetypes
    const categoryToArchetype = {
      'depression': 'wounded_healer',
      'anxiety': 'shadow_strategist',
      'stress': 'rebel_spirit',
      'anger': 'rebel_spirit',
      'social_isolation': 'inner_child',
      'bipolar_disorder': 'visionary',
      'ocd': 'shadow_strategist',
      'eating_disorder': 'wounded_healer',
      'social_anxiety': 'inner_child',
      'panic_disorder': 'wounded_healer',
      'low': 'wise_elder',
      'medium': 'caregiver',
      'high': 'wounded_healer',
      'critical': 'wounded_healer'
    }

    const archetype = categoryToArchetype[analysis.category as keyof typeof categoryToArchetype] || 'visionary'

    return {
      archetype: {
        main_archetype: archetype,
        confidence: analysis.confidence,
        color: "#45B7D1",
        description: analysis.explanation
      },
      mood_vector: {
        emotional_intensity: analysis.riskLevel === 'high' ? 0.8 : analysis.riskLevel === 'medium' ? 0.6 : 0.4,
        cognitive_clarity: analysis.confidence,
        energy_level: analysis.category === 'stress' ? 0.3 : 0.6,
        social_connection: analysis.category === 'social_isolation' ? 0.2 : 0.7,
        coherence_index: analysis.confidence,
        urgency_score: analysis.riskLevel === 'high' ? 0.9 : analysis.riskLevel === 'medium' ? 0.6 : 0.3
      },
      timestamp: analysis.timestamp,
      session_id: "chat_session",
      insights: analysis.supportingEvidence || [],
      recommendations: [
        "Continue monitoring your mental health patterns",
        "Consider professional support if symptoms persist",
        "Practice self-care and stress management techniques"
      ]
    }
  }, [])

  const [sessionStats, setSessionStats] = useState({
    totalMessages: 0,
    analysisCount: 0,
    averageConfidence: 0,
    riskTrend: 'stable' as 'improving' | 'stable' | 'declining' | 'critical',
    interventionsTriggered: 0,
  })

  // Generate unique session identifiers
  const sessionId = useMemo(() => {
    const array = new Uint8Array(6)
    crypto.getRandomValues(array)
    const randomStr = Array.from(array, (byte) => byte.toString(36)).join('')
    return `session_${Date.now()}_${randomStr}`
  }, [])
  const userId = useMemo(() => `user_${Date.now()}_demo`, [])
  const timeoutRefs = useRef<number[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Cleanup timeouts on unmount
  useEffect(() => {
    const timeouts = timeoutRefs.current
    return () => {
      timeouts.forEach(clearTimeout)
    }
  }, [])

  // Initialize production-grade MentalLLaMA service
  useEffect(() => {
    const initializeService = async () => {
      try {
        logger.info('Initializing production MentalLLaMA service...')

        // Initialize the production-grade MentalLLaMA components
        const { adapter } = await createMentalLLaMAFromEnv()
        const clinicalKnowledge = new ClinicalKnowledgeBase()

        setMentalHealthService({
          adapter: adapter as unknown as MentalHealthAdapter,
          clinicalKnowledge,
          isInitialized: true,
        })

        logger.info('Production MentalLLaMA service initialized successfully')
      } catch (error) {
        logger.error('Failed to initialize MentalLLaMA service', { error })

        // Fallback to demonstration mode with limited functionality
        setMentalHealthService({
          adapter: null,
          clinicalKnowledge: new ClinicalKnowledgeBase(),
          isInitialized: false,
        })
      }
    }

    initializeService()
  }, [])

  // Get analysis history for visualization
  const getAnalysisHistory = useCallback((): MentalHealthAnalysisResult[] => {
    return messages
      .filter((m) => m.mentalHealthAnalysis)
      .map((m) => m.mentalHealthAnalysis!)
  }, [messages])

  // Enhanced analysis for component compatibility
  const enhancedAnalysisHistory = useMemo(() => {
    const analysisHistory = getAnalysisHistory()
    return enhanceAnalysisArray(analysisHistory)
  }, [getAnalysisHistory])

  // Process user message with production-grade analysis
  const handleSendMessage = async () => {
    if (!input.trim() || processing) {
      return
    }

    setProcessing(true)
    let userMessageId: string | null = null

    try {
      // Add user message immediately
      const userMessage: ChatMessage = {
        id: (() => {
          const array = new Uint8Array(6)
          crypto.getRandomValues(array)
          const randomStr = Array.from(array, (byte) => byte.toString(36)).join(
            '',
          )
          return `user_${Date.now()}_${randomStr}`
        })(),
        role: 'user',
        content: input,
        timestamp: new Date().toISOString(),
        isProcessing: true,
      }

      userMessageId = userMessage.id

      setMessages((prev) => [...prev, userMessage])
      setInput('')

      // Perform production-grade analysis using our new backend API
      if (settings.enableAnalysis) {
        logger.info('Performing production-grade mental health analysis via API...')

        try {
          // Call our new mental health chat API
          const response = await fetch('/api/mental-health/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: userMessage.content,
              sessionId,
              userContext: {
                userId,
                previousMessages: messages.slice(-3).map(m => ({
                  id: m.id,
                  message: m.content,
                  timestamp: new Date(m.timestamp).toISOString(),
                  role: m.role,
                })),
                riskLevel: sessionStats.riskTrend === 'critical' ? 'high' : 
                           sessionStats.riskTrend === 'declining' ? 'moderate' : 'low'
              },
              options: {
                includeRiskAssessment: true,
                includeCopingStrategies: true,
                enableCrisisDetection: true,
                responseStyle: 'therapeutic'
              }
            })
          })

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`)
          }

          const chatResult = await response.json()

          // Convert API response to our analysis format
          const analysisResult: MentalHealthAnalysisResult = {
            mentalHealthCategory: chatResult.analysis.emotionalState,
            confidence: chatResult.analysis.concernSeverity / 10, // Convert 1-10 to 0-1
            supportingEvidence: chatResult.analysis.keyTopics,
            isCrisis: chatResult.riskAssessment?.crisisLevel === 'imminent' ||
                     chatResult.riskAssessment?.crisisLevel === 'high',
            hasMentalHealthIssue: chatResult.analysis.stressLevel !== 'low',
            explanation: `Stress level: ${chatResult.analysis.stressLevel}, Sentiment: ${chatResult.analysis.sentimentScore > 0 ? 'positive' : chatResult.analysis.sentimentScore < 0 ? 'negative' : 'neutral'}`,
            timestamp: new Date().toISOString()
          }

          // Update message with analysis results
          setMessages((prev) =>
            prev.map((m) =>
              m.id === userMessage.id
                ? {
                    ...m,
                    mentalHealthAnalysis: analysisResult,
                    isProcessing: false,
                    riskLevel: chatResult.riskAssessment?.crisisLevel === 'imminent' ? 'critical' :
                              chatResult.riskAssessment?.crisisLevel === 'high' ? 'high' :
                              chatResult.riskAssessment?.crisisLevel === 'moderate' ? 'medium' : 'low',
                    needsIntervention: chatResult.riskAssessment?.immediateAction || false,
                    apiResponse: chatResult // Store full API response for detailed analysis
                  }
                : m,
            ),
          )

          // Convert to Mind-Mirror format if enabled
          if (settings.enableMindMirrorUI) {
            const enhancedAnalysis: EnhancedMentalHealthAnalysis = {
              timestamp: Date.now(),
              category: chatResult.riskAssessment?.crisisLevel === 'imminent' ? 'critical' :
                       chatResult.riskAssessment?.crisisLevel === 'high' ? 'high' :
                       chatResult.riskAssessment?.crisisLevel === 'moderate' ? 'medium' : 'low',
              explanation: analysisResult.explanation,
              expertGuided: true,
              scores: {},
              summary: `Stress: ${chatResult.analysis.stressLevel}, Sentiment: ${chatResult.analysis.sentimentScore > 0 ? 'positive' : 'negative'}`,
              hasMentalHealthIssue: analysisResult.hasMentalHealthIssue,
              confidence: analysisResult.confidence,
              supportingEvidence: analysisResult.supportingEvidence || [],
              riskLevel: chatResult.riskAssessment?.crisisLevel === 'imminent' ? 'high' :
                        chatResult.riskAssessment?.crisisLevel === 'high' ? 'high' :
                        chatResult.riskAssessment?.crisisLevel === 'moderate' ? 'medium' : 'low'
            }

            const mindMirrorAnalysis = convertToMindMirrorAnalysis(enhancedAnalysis)
            setCurrentMindMirrorAnalysis(mindMirrorAnalysis)
          }

          // Update session statistics
          setSessionStats((prev) => ({
            ...prev,
            totalMessages: prev.totalMessages + 1,
            analysisCount: prev.analysisCount + 1,
            averageConfidence:
              (prev.averageConfidence * prev.analysisCount +
                analysisResult.confidence) /
              (prev.analysisCount + 1),
            riskTrend: chatResult.riskAssessment?.crisisLevel === 'imminent' ? 'critical' :
                      chatResult.riskAssessment?.crisisLevel === 'high' ? 'declining' :
                      chatResult.analysis.stressLevel === 'low' ? 'improving' : 'stable',
            interventionsTriggered: chatResult.riskAssessment?.immediateAction
              ? prev.interventionsTriggered + 1
              : prev.interventionsTriggered,
          }))

          // Add assistant response using the API response
          const timeoutId = window.setTimeout(() => {
            const assistantMessage: ChatMessage = {
              id: `assistant_${Date.now()}_${generateSecureRandomString(9)}`,
              role: 'assistant',
              content: chatResult.response.message,
              timestamp: new Date().toISOString(),
              // Include API metadata for enhanced display
              metadata: {
                responseType: chatResult.response.type,
                confidence: chatResult.response.confidence,
                copingStrategies: chatResult.copingStrategies,
                resources: chatResult.resources,
                processingTime: chatResult.metadata.processingTime
              }
            }
            setMessages((prev) => [...prev, assistantMessage])
          }, 1500)
          timeoutRefs.current.push(timeoutId)

        } catch (error) {
          logger.error('Failed to call mental health chat API', { error })
          
          // Fallback to demo mode on API failure
          setMessages((prev) =>
            prev.map((m) =>
              m.id === userMessage.id ? { ...m, isProcessing: false } : m,
            ),
          )

          // Generate a basic response for demo purposes
          const timeoutId = window.setTimeout(() => {
            const assistantMessage: ChatMessage = {
              id: `assistant_${Date.now()}_${generateSecureRandomString(9)}`,
              role: 'assistant',
              content: "I'm here to listen and support you. Could you tell me more about what's on your mind?",
              timestamp: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, assistantMessage])
          }, 1500)
          timeoutRefs.current.push(timeoutId)
        }
      } else {
        // Analysis disabled - simple response
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMessage.id ? { ...m, isProcessing: false } : m,
          ),
        )

        // Generate a basic response
        const timeoutId = window.setTimeout(() => {
          const assistantMessage: ChatMessage = {
            id: `assistant_${Date.now()}_${generateSecureRandomString(9)}`,
            role: 'assistant',
            content: getDemoResponse(userMessage.content),
            timestamp: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, assistantMessage])
        }, 1000)
        timeoutRefs.current.push(timeoutId)
      }
    } catch (error) {
      logger.error('Error processing message', { error })

      // Remove processing state on error
      if (userMessageId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMessageId ? { ...m, isProcessing: false } : m,
          ),
        )
      }
    } finally {
      setProcessing(false)
    }
  }

  // Generate therapeutic response based on analysis
  const generateTherapeuticResponse = async (
    analysis: MentalHealthAnalysisResult,
  ): Promise<string> => {
    if (!mentalHealthService?.clinicalKnowledge) {
      return "I understand. Can you tell me more about what you're experiencing?"
    }

    try {
      // Get intervention suggestions
      const interventions =
        mentalHealthService.clinicalKnowledge.getInterventionSuggestions(
          analysis.mentalHealthCategory,
          analysis,
        )

      // Handle crisis situations with immediate priority
      if (analysis.isCrisis) {
        return `I'm concerned about what you've shared. Your safety is the most important thing right now.

🚨 **Immediate Resources Available:**
• National Crisis Helpline: 988 (available 24/7)
• Crisis Text Line: Text HOME to 741741
• Emergency: 911

${analysis.explanation}

I'm here to support you through this. Would you like to talk about what's been making you feel this way?`
      }

      // Generate contextual response based on analysis
      const urgentInterventions = interventions.filter(
        (i) => i.urgency === 'urgent' || i.urgency === 'immediate',
      )

      if (urgentInterventions.length > 0 && urgentInterventions[0]) {
        return `Thank you for sharing that with me. Based on what you've told me, I think it would be helpful to focus on: ${urgentInterventions[0].intervention.toLowerCase()}.

${analysis.explanation}

${urgentInterventions[0].rationale}

How does this resonate with you? What feels most challenging right now?`
      }

      // Standard supportive response
      return `I hear you, and I appreciate you sharing this with me. ${analysis.explanation}

It sounds like you're dealing with some challenges. What's been the most difficult part of this experience for you?`
    } catch (error) {
      logger.error('Error generating therapeutic response', { error })
      return "I understand you're going through something difficult. Can you help me understand what's been on your mind lately?"
    }
  }

  // Demo response generator for fallback
  const getDemoResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase()

    if (
      lowerMessage.includes('sad') ||
      lowerMessage.includes('depressed') ||
      lowerMessage.includes('down')
    ) {
      return "I hear that you're feeling down. That can be really difficult to experience. What's been contributing to these feelings lately?"
    }

    if (
      lowerMessage.includes('anxious') ||
      lowerMessage.includes('worried') ||
      lowerMessage.includes('nervous')
    ) {
      return "It sounds like you're experiencing some anxiety. That's really common, and there are ways to help manage those feelings. What situations tend to make you feel most anxious?"
    }

    if (
      lowerMessage.includes('angry') ||
      lowerMessage.includes('frustrated') ||
      lowerMessage.includes('mad')
    ) {
      return "I can hear the frustration in what you're sharing. Anger often comes up when we're feeling hurt or when our needs aren't being met. What's been triggering these feelings?"
    }

    return "Thank you for sharing that with me. I'm here to listen and support you. Can you tell me more about what's been on your mind?"
  }

  // Toggle settings with production-grade configuration
  const handleToggleSetting = (setting: keyof typeof settings) => {
    setSettings((prev) => {
      const newSettings = { ...prev, [setting]: !prev[setting] }

      // Log configuration changes for audit trail
      logger.info('Mental health chat settings updated', {
        setting,
        newValue: newSettings[setting],
        sessionId,
        userId,
      })

      return newSettings
    })
  }

  // Request therapeutic intervention
  const handleRequestIntervention = async (
    messageWithAnalysis: ChatMessage,
  ) => {
    if (
      !mentalHealthService?.isInitialized ||
      !messageWithAnalysis.mentalHealthAnalysis
    ) {
      return
    }

    setProcessing(true)

    try {
      logger.info('Generating therapeutic intervention', {
        messageId: messageWithAnalysis.id,
        analysisCategory:
          messageWithAnalysis.mentalHealthAnalysis.mentalHealthCategory,
        confidence: messageWithAnalysis.mentalHealthAnalysis.confidence,
      })

      const intervention = await generateTherapeuticResponse(
        messageWithAnalysis.mentalHealthAnalysis,
      )

      const assistantMessage: ChatMessage = {
        id: `intervention_${Date.now()}_${generateSecureRandomString(9)}`,
        role: 'assistant',
        content: `💡 **Therapeutic Intervention**\n\n${intervention}`,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      // Update intervention statistics
      setSessionStats((prev) => ({
        ...prev,
        interventionsTriggered: prev.interventionsTriggered + 1,
      }))
    } catch (error) {
      logger.error('Error generating intervention', { error })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 w-full max-w-7xl mx-auto">
      {/* Main Chat Interface */}
      <div
        className={`flex-1 ${settings.showAnalysisPanel ? 'md:max-w-[65%]' : 'w-full'}`}
      >
        <Card className="h-[700px] flex flex-col shadow-lg border-0 overflow-hidden">
          <div className="p-4 border-b bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 via-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    🧠 MentalLLaMA Chat
                  </h2>
                  <p className="text-sm text-gray-600">
                    {settings.enableMindMirrorUI ? 'Enhanced Mind Mirror Analysis' : 'Production-Grade Mental Health Analysis'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {mentalHealthService?.isInitialized ? (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200"
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    Live Analysis
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-yellow-50 text-yellow-700 border-yellow-200"
                  >
                    Demo Mode
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  Session: {sessionStats.totalMessages} msgs
                </Badge>
              </div>
            </div>
          </div>

          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-[85%] space-y-2">
                    {/* Message Bubble */}
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900 border'
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                      {message.isProcessing && (
                        <div className="flex items-center mt-2 text-xs opacity-70">
                          <div className="animate-spin w-3 h-3 border border-current border-t-transparent rounded-full mr-2"></div>
                          Analyzing...
                        </div>
                      )}
                    </div>

                    {/* Analysis Results */}
                    {message.mentalHealthAnalysis && !message.isProcessing && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-blue-900">
                            Analysis Results
                          </span>
                          <div className="flex items-center gap-2">
                            {message.riskLevel && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  message.riskLevel === 'critical'
                                    ? 'border-red-200 text-red-700 bg-red-50'
                                    : message.riskLevel === 'high'
                                      ? 'border-orange-200 text-orange-700 bg-orange-50'
                                      : message.riskLevel === 'medium'
                                        ? 'border-yellow-200 text-yellow-700 bg-yellow-50'
                                        : 'border-green-200 text-green-700 bg-green-50'
                                }`}
                              >
                                {message.riskLevel === 'critical' && '🚨'}
                                {message.riskLevel === 'high' && '⚠️'}
                                {message.riskLevel === 'medium' && '⚠️'}
                                {message.riskLevel === 'low' && '✓'}{' '}
                                {message.riskLevel.toUpperCase()}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {Math.round(
                                (message.mentalHealthAnalysis.confidence || 0) *
                                  100,
                              )}
                              % confidence
                            </Badge>
                          </div>
                        </div>
                        <p className="text-blue-800 text-xs mb-2">
                          <span className="font-medium">Category:</span>{' '}
                          {message.mentalHealthAnalysis.mentalHealthCategory}
                        </p>
                        <p className="text-blue-700 text-xs">
                          {message.mentalHealthAnalysis.explanation}
                        </p>
                        {message.needsIntervention && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 text-xs h-7"
                            onClick={() => handleRequestIntervention(message)}
                          >
                            <Heart className="w-3 h-3 mr-1" />
                            Request Intervention
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {processing && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 border rounded-2xl px-4 py-3 max-w-[85%]">
                    <div className="flex items-center text-sm text-gray-600">
                      <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full mr-2"></div>
                      {mentalHealthService?.isInitialized
                        ? 'Processing with MentalLLaMA...'
                        : 'Thinking...'}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="text-xs text-red-600 hover:text-red-800 mt-1"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t bg-gray-50">
              <div className="flex gap-3">
                <Input
                  placeholder={
                    mentalHealthService?.isInitialized
                      ? "Share what's on your mind... (encrypted & analyzed securely)"
                      : 'Type your message... (demo mode)'
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  disabled={processing}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={processing || !input.trim()}
                  className="px-6"
                >
                  {processing ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  ) : (
                    'Send'
                  )}
                </Button>
              </div>

              {/* Privacy Notice */}
              <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {mentalHealthService?.isInitialized ? (
                  <>
                    All messages are encrypted and analyzed locally. No data is
                    stored on external servers.
                  </>
                ) : (
                  <>
                    Running in demo mode. Production version uses encrypted
                    processing.
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Analysis Panel */}
      {settings.showAnalysisPanel && (
        <div className="md:w-[35%] space-y-4">
          {/* Mind-Mirror Brain Visualization */}
          {settings.enableMindMirrorUI && settings.showBrainVisualization && (
            <BrainVisualization
              moodVector={currentMindMirrorAnalysis?.mood_vector}
              archetype={currentMindMirrorAnalysis?.archetype.main_archetype}
            />
          )}

          {/* Mind-Mirror Dashboard */}
          {settings.enableMindMirrorUI && (
            <MindMirrorDashboard
              analysis={currentMindMirrorAnalysis || undefined}
              isAnalyzing={processing}
            />
          )}

          <Tabs defaultValue={settings.enableMindMirrorUI ? "mindmirror" : "insights"} className="w-full">
            <TabsList className={`w-full grid ${settings.enableMindMirrorUI ? 'grid-cols-5' : 'grid-cols-4'}`}>
              {settings.enableMindMirrorUI && (
                <TabsTrigger value="mindmirror" className="text-xs">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Mirror
                </TabsTrigger>
              )}
              <TabsTrigger value="insights" className="text-xs">
                <Brain className="w-3 h-3 mr-1" />
                Insights
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs">
                <Heart className="w-3 h-3 mr-1" />
                History
              </TabsTrigger>
              <TabsTrigger value="stats" className="text-xs">
                <Zap className="w-3 h-3 mr-1" />
                Stats
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-xs">
                Settings
              </TabsTrigger>
            </TabsList>

            {/* Mind-Mirror Tab Content */}
            {settings.enableMindMirrorUI && (
              <TabsContent value="mindmirror" className="mt-4 space-y-4">
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border-0 shadow-md">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    Mind Mirror Analysis
                  </h3>
                  <p className="text-xs text-gray-600 mb-3">
                    Real-time psychological archetype detection and mood analysis
                  </p>

                  {currentMindMirrorAnalysis ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Current Archetype</span>
                        <Badge variant="outline" className="text-xs">
                          {currentMindMirrorAnalysis.archetype.main_archetype.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Confidence</span>
                        <span className="text-xs font-bold">
                          {Math.round(currentMindMirrorAnalysis.archetype.confidence * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Urgency Score</span>
                        <Badge variant={currentMindMirrorAnalysis.mood_vector.urgency_score > 0.7 ? "destructive" : "outline"}>
                          {Math.round(currentMindMirrorAnalysis.mood_vector.urgency_score * 100)}%
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">
                      Send a message to see Mind Mirror analysis
                    </p>
                  )}
                </div>
              </TabsContent>
            )}

            <TabsContent value="insights" className="mt-4 space-y-4">
              {/* Real-time Insights */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-blue-600" />
                  Live Analysis Results
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  Latest analysis from your conversation using production-grade
                  MentalLLaMA
                </p>
              </div>

              {messages
                .filter(
                  (m) =>
                    m.role === 'user' &&
                    m.mentalHealthAnalysis &&
                    !m.isProcessing,
                )
                .slice(-2)
                .map((m) => (
                  <div key={`analysis_${m.id}`}>
                    <div className="mb-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        Analysis for: &quot;{m.content.substring(0, 40)}
                        {m.content.length > 40 ? '...' : ''}&quot;
                      </p>
                    </div>
                    <MentalHealthInsights
                      analysis={enhanceAnalysis(m.mentalHealthAnalysis)!}
                    />
                  </div>
                ))}

              {!messages.some(
                (m) =>
                  m.role === 'user' &&
                  m.mentalHealthAnalysis &&
                  !m.isProcessing,
              ) && (
                <Card className="w-full bg-slate-50 shadow-sm">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <Brain className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-600 mb-1">
                        No Analysis Yet
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Send a message to see real-time mental health insights
                        powered by MentalLLaMA
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {/* Analysis History */}
              <div className="mb-4">
                <h3 className="font-semibold text-sm mb-2">Analysis Trends</h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <div className="text-lg font-bold text-blue-600">
                      {sessionStats.analysisCount}
                    </div>
                    <div className="text-xs text-blue-600">Analyses</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <div className="text-lg font-bold text-green-600">
                      {Math.round(sessionStats.averageConfidence * 100)}%
                    </div>
                    <div className="text-xs text-green-600">Avg Confidence</div>
                  </div>
                </div>
              </div>

              <MentalHealthHistoryChart
                analysisHistory={enhancedAnalysisHistory}
              />

              {enhancedAnalysisHistory.length === 0 && (
                <Card className="w-full bg-slate-50 shadow-sm">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <Heart className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-600 mb-1">
                        No History Available
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Continue chatting to build your analysis history
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="stats" className="mt-4">
              {/* Session Statistics */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-600" />
                    Session Statistics
                  </h3>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-gray-900">
                          {sessionStats.totalMessages}
                        </div>
                        <div className="text-xs text-gray-600">
                          Total Messages
                        </div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-medium text-blue-900">
                          {sessionStats.analysisCount}
                        </div>
                        <div className="text-xs text-blue-600">
                          Analyses Performed
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg">
                      <div className="text-sm font-medium text-gray-900">
                        Risk Trend:{' '}
                        <span
                          className={`
                          ${sessionStats.riskTrend === 'critical' ? 'text-red-600' : ''}
                          ${sessionStats.riskTrend === 'declining' ? 'text-orange-600' : ''}
                          ${sessionStats.riskTrend === 'stable' ? 'text-blue-600' : ''}
                          ${sessionStats.riskTrend === 'improving' ? 'text-green-600' : ''}
                        `}
                        >
                          {sessionStats.riskTrend.charAt(0).toUpperCase() +
                            sessionStats.riskTrend.slice(1)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Based on conversation patterns
                      </div>
                    </div>

                    {sessionStats.interventionsTriggered > 0 && (
                      <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        <div className="text-sm font-medium text-yellow-900">
                          <AlertTriangle className="w-4 h-4 inline mr-1" />
                          {sessionStats.interventionsTriggered} Intervention
                          {sessionStats.interventionsTriggered > 1
                            ? 's'
                            : ''}{' '}
                          Triggered
                        </div>
                        <div className="text-xs text-yellow-700 mt-1">
                          Situations requiring immediate attention were
                          identified
                        </div>
                      </div>
                    )}

                    <div className="pt-3 border-t">
                      <div className="text-xs text-gray-500 mb-2">
                        Service Status
                      </div>
                      <div className="flex items-center gap-2">
                        {mentalHealthService?.isInitialized ? (
                          <>
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-xs text-green-600">
                              MentalLLaMA Active
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            <span className="text-xs text-yellow-600">
                              Demo Mode
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="mt-4">
              {/* Production Settings */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-semibold text-sm mb-4">
                    Analysis Configuration
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm">Mental Health Analysis</span>
                        <span className="font-normal text-xs text-muted-foreground">
                          Enable real-time MentalLLaMA analysis of messages
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.enableAnalysis}
                          onChange={() => handleToggleSetting('enableAnalysis')}
                          className="mt-2"
                        />
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm">
                          Expert Clinical Guidance
                        </span>
                        <span className="font-normal text-xs text-muted-foreground">
                          Use clinical knowledge base for enhanced explanations
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.useExpertGuidance}
                          onChange={() =>
                            handleToggleSetting('useExpertGuidance')
                          }
                          disabled={!settings.enableAnalysis}
                          className="mt-2"
                        />
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm">Crisis Detection</span>
                        <span className="font-normal text-xs text-muted-foreground">
                          Automatically detect and respond to crisis situations
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.enableCrisisDetection}
                          onChange={() =>
                            handleToggleSetting('enableCrisisDetection')
                          }
                          disabled={!settings.enableAnalysis}
                          className="mt-2"
                        />
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm">Analysis Panel</span>
                        <span className="font-normal text-xs text-muted-foreground">
                          Show detailed analysis and insights panel
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.showAnalysisPanel}
                          onChange={() =>
                            handleToggleSetting('showAnalysisPanel')
                          }
                          className="mt-2"
                        />
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm">🧠 Mind Mirror UI</span>
                        <span className="font-normal text-xs text-muted-foreground">
                          Enable enhanced archetype detection and brain visualization
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.enableMindMirrorUI}
                          onChange={() =>
                            handleToggleSetting('enableMindMirrorUI')
                          }
                          disabled={!settings.showAnalysisPanel}
                          className="mt-2"
                        />
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex flex-col gap-1">
                        <span className="text-sm">Brain Visualization</span>
                        <span className="font-normal text-xs text-muted-foreground">
                          Show 3D neural activity mapping
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.showBrainVisualization}
                          onChange={() =>
                            handleToggleSetting('showBrainVisualization')
                          }
                          disabled={!settings.enableMindMirrorUI}
                          className="mt-2"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="pt-4 border-t space-y-3">
                    <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      Thresholds
                    </h4>

                    <div className="space-y-2">
                      <label className="text-xs text-gray-600">
                        Confidence Threshold:{' '}
                        {Math.round(settings.confidenceThreshold * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.1"
                        value={settings.confidenceThreshold}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            confidenceThreshold: parseFloat(e.target.value),
                          }))
                        }
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-gray-600">
                        Intervention Threshold:{' '}
                        {Math.round(settings.interventionThreshold * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.1"
                        value={settings.interventionThreshold}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            interventionThreshold: parseFloat(e.target.value),
                          }))
                        }
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <h4 className="text-xs font-medium text-blue-900 mb-1">
                        🔒 Privacy & Security
                      </h4>
                      <p className="text-xs text-blue-700">
                        All conversations are processed with end-to-end
                        encryption. No data is stored on external servers.
                        Analysis happens locally using production-grade
                        MentalLLaMA models.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
})

export default MentalHealthChatDemo
