import type { Message } from '@/types/chat'
import type { Scenario } from '@/types/scenarios'
import { clientScenarios } from '@/data/scenarios'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useEffect, useState, lazy, Suspense, useCallback } from 'react'
// Import this component dynamically for code splitting
const LazyAnalyticsDashboard = lazy(() => import('./LazyAnalyticsDashboard'))
import { ChatContainer } from './ChatContainer'
import { MentalHealthInsights } from '@/components/MentalHealthInsights'
import {
  IconChevronDown,
  IconMaximize,
  IconMinimize,
  IconMental,
} from './icons'
import { BarChart as IconChart } from 'lucide-react'
// Removed unused import: SecurityBadge
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useAIService } from '@/hooks/useAIService'
import { useMentalHealthAnalysis } from '@/hooks/useMentalHealthAnalysis'
import {
  useEmotionDetection,
  type EmotionAnalysis,
} from '@/hooks/useEmotionDetection'
import { useRiskAssessment } from '@/hooks/useRiskAssessment'
import { CognitiveModelSelector } from './CognitiveModelSelector'
import { usePatientModel } from '@/hooks/usePatientModel'
import { loadSampleModels } from '@/lib/utils/load-sample-models'
// Import SupervisorFeedback component
import { SupervisorFeedback } from '@/components/feedback/SupervisorFeedback'

// Extended Message type with mental health analysis
interface ExtendedMessage extends Message {
  mentalHealthAnalysis?: MentalHealthChatAnalysis
}

// Add the systemMessage property to Scenario for the current code
interface EnhancedScenario extends Scenario {
  systemMessage: string
}

// Define MentalHealthChatAnalysis interface if not already defined elsewhere
interface MentalHealthChatAnalysis {
  category: 'low' | 'medium' | 'high' | 'critical'
  hasMentalHealthIssue: boolean
  confidence: number
  explanation: string
  supportingEvidence: string[]
  timestamp: number
  expertGuided: boolean
  emotions: string[]
  riskFactors: string[]
}

// Define InterventionConfig interface if not already defined elsewhere
interface InterventionConfig {
  scores: unknown
  type: 'immediate' | 'preventive' | 'supportive'
  requiresExpert: boolean
  emotions: EmotionAnalysis
  riskFactors: string[]
}

// Define TherapeuticInterventions interface if not already defined elsewhere
interface TherapeuticInterventions {
  generateIntervention: (config: InterventionConfig) => Promise<string>
}

// Define useTherapeuticInterventions hook
const useTherapeuticInterventions = (): TherapeuticInterventions => {
  return {
    generateIntervention: async (_config: InterventionConfig) => {
      // Simplified implementation
      return "Consider using validation and reflection techniques to address the client's concerns."
    },
  }
}

// Loading fallback component
const LoadingAnalytics = () => (
  <div className="rounded-xl border border-green-700/30 bg-black bg-opacity-90 p-6 animate-pulse">
    <div className="h-6 w-1/3 bg-green-700/20 mb-4 rounded"></div>
    <div className="grid grid-cols-2 gap-4">
      <div className="h-40 bg-green-700/10 rounded"></div>
      <div className="h-40 bg-green-700/10 rounded"></div>
    </div>
  </div>
)

// Replace export default function with function for consistency
function ProfessionalTherapistWorkspace() {
  // State
  const [messages, setMessages] = useState<ExtendedMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showScenarios, setShowScenarios] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState<EnhancedScenario>(
    () => {
      const defaultScenario = clientScenarios[0]
      if (!defaultScenario) {
        // Fallback scenario if clientScenarios is empty
        return {
          id: 'default',
          name: 'General Therapy Session',
          description: 'A general therapy session with a client',
          tags: ['general'],
          difficulty: 'beginner' as const,
          category: 'other' as const,
          systemMessage:
            'You are a professional CBT therapist helping a client.',
        }
      }
      return {
        id: defaultScenario.id || 'default',
        name: defaultScenario.name,
        description: defaultScenario.description,
        tags: defaultScenario.tags,
        difficulty: defaultScenario.difficulty,
        category: defaultScenario.category,
        systemMessage: 'You are a professional CBT therapist helping a client.',
      }
    },
  )
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showMentalHealthPanel, setShowMentalHealthPanel] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPatientModelSelector, setShowPatientModelSelector] =
    useState(false)
  const [usePatientSimulation, setUsePatientSimulation] = useState(false)
  // Add SupervisorFeedback state
  const [showSupervisorFeedback, setShowSupervisorFeedback] = useState(false)

  const {
    isLoading: isPatientModelLoading,
    error: patientModelError,
    currentModelId,
    currentModel,
    selectModel,
    updateStyleConfig,
    generatePatientResponse,
  } = usePatientModel()

  const { getAIResponse } = useAIService()
  const { analyzeMessage } = useMentalHealthAnalysis()
  const { generateIntervention } = useTherapeuticInterventions()
  const { detectEmotions } = useEmotionDetection()
  const { assessRisk } = useRiskAssessment()
  const storeState = useStore()

  // Initialize mental health chat if not already initialized
  useEffect(() => {
    if (!storeState.mentalHealthChat && storeState.fheService) {
      storeState.initializeMentalHealthChat()
    }
  }, [storeState, storeState.fheService, storeState.mentalHealthChat])

  // Initialize sample cognitive models
  useEffect(() => {
    // Load sample models if patient simulation is enabled
    if (usePatientSimulation) {
      loadSampleModels().catch((err) => {
        console.error('Failed to load sample models:', err)
      })
    }
  }, [usePatientSimulation])

  // Handle scenario change - update to add systemMessage
  const changeScenario = (scenario: Scenario) => {
    setSelectedScenario({
      ...scenario,
      systemMessage: `You are a professional CBT therapist helping a client with ${scenario.name}. ${scenario.description}`,
    })
    setShowScenarios(false)
    // Add system message for new scenario
    setMessages([
      {
        role: 'system',
        content: `New client case selected: ${scenario.name}. ${scenario.description}`,
        name: '',
      } as ExtendedMessage,
    ])
  }

  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!input.trim() || isLoading) {
      return
    }

    const userMessage: ExtendedMessage = {
      role: 'user',
      content: input,
      name: '',
    } as ExtendedMessage

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Process the message with mental health analysis if available
      if (
        storeState.mentalHealthChat &&
        storeState.mentalHealthAnalysisEnabled
      ) {
        // Detect emotions
        const emotions = await detectEmotions(input)

        // Analyze message for mental health indicators
        const analysis = await analyzeMessage(input)

        // Assess risk factors
        const riskAssessment = await assessRisk(input, emotions)

        // Combine into mental health analysis
        const mentalHealthAnalysis: MentalHealthChatAnalysis = {
          category: riskAssessment.category,
          hasMentalHealthIssue: true,
          confidence: analysis.confidence,
          explanation: String(
            analysis.scores &&
              typeof analysis.scores === 'object' &&
              analysis.scores !== null &&
              'explanation' in analysis.scores
              ? analysis.scores['explanation']
              : 'No additional explanation available',
          ),
          supportingEvidence:
            analysis.scores &&
            typeof analysis.scores === 'object' &&
            analysis.scores !== null &&
            'supportingEvidence' in analysis.scores &&
            Array.isArray(analysis.scores['supportingEvidence'])
              ? (analysis.scores['supportingEvidence'] as string[])
              : [],
          timestamp: Date.now(),
          expertGuided: riskAssessment.requiresExpert,
          emotions: emotions.primaryEmotion
            ? [emotions.primaryEmotion, ...emotions.secondaryEmotions]
            : [],
          riskFactors: riskAssessment.factors,
        }

        // Update user message with analysis
        userMessage.mentalHealthAnalysis = mentalHealthAnalysis

        // Check if intervention is needed
        const interventionConfig: InterventionConfig = {
          scores: analysis.scores,
          type:
            riskAssessment.category === 'high'
              ? 'immediate'
              : riskAssessment.category === 'medium'
                ? 'preventive'
                : 'supportive',
          requiresExpert: riskAssessment.requiresExpert,
          emotions,
          riskFactors: riskAssessment.factors,
        }

        const intervention = await generateIntervention(interventionConfig)

        // If intervention is immediate, add a system message
        if (interventionConfig.type === 'immediate') {
          setMessages((prev) => [
            ...prev,
            {
              role: 'system',
              content: `🚨 High Risk Alert: This client may require immediate professional intervention. ${intervention}`,
              name: '',
            } as ExtendedMessage,
          ])
        }
      }

      // Check if we should use the patient simulation
      let aiResponse
      if (usePatientSimulation && currentModelId) {
        // Generate response using the cognitive model
        const patientPrompt = await handlePatientSimulationResponse(input)

        if (patientPrompt) {
          // Use the generated prompt to get response from AI
          aiResponse = await getAIResponse(patientPrompt)
        } else {
          // Fallback to normal response if patient simulation fails
          aiResponse = await getAIResponse(
            JSON.stringify([...messages, userMessage]),
          )
        }
      } else {
        // Use regular AI response
        aiResponse = await getAIResponse(
          JSON.stringify([...messages, userMessage]),
        )
      }

      // Add AI response to messages
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          content: aiResponse,
          name: '',
        } as ExtendedMessage,
      ])
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? (err as Error)?.message || String(err)
          : 'An error occurred while processing your message',
      )
      console.error('Chat error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Get the most recent message with mental health analysis
  const getLatestMentalHealthAnalysis = ():
    | MentalHealthChatAnalysis
    | undefined => {
    const messagesWithAnalysis = messages.filter((m) => m.mentalHealthAnalysis)
    if (messagesWithAnalysis.length === 0) {
      return undefined
    }
    const lastMessage = messagesWithAnalysis[messagesWithAnalysis.length - 1]
    return lastMessage?.mentalHealthAnalysis
  }

  // Toggle mental health analysis settings
  const toggleMentalHealthAnalysis = () => {
    storeState.configureMentalHealthAnalysis(
      !storeState.mentalHealthAnalysisEnabled,
      storeState.expertGuidanceEnabled,
    )
  }

  // Toggle expert guidance
  const toggleExpertGuidance = () => {
    storeState.configureMentalHealthAnalysis(
      storeState.mentalHealthAnalysisEnabled,
      !storeState.expertGuidanceEnabled,
    )
  }

  // Generate patient response using cognitive model
  const handlePatientSimulationResponse = async (therapistMessage: string) => {
    if (!usePatientSimulation || !currentModelId || !currentModel) {
      return null
    }

    try {
      // Convert messages to the format expected by generatePatientResponse
      const conversationMessages = messages.map((msg) => ({
        role: msg.role === 'bot' ? 'patient' : 'therapist',
        content: msg.content,
      }))

      // Add the new therapist message
      conversationMessages.push({
        role: 'therapist',
        content: therapistMessage,
      })

      // Extract therapeutic focus from the context if available
      const currentFocus = messages
        .filter(
          (msg) => msg.role === 'system' && msg.content.includes('focus:'),
        )
        .map((msg) => msg.content.replace('Current focus:', '').trim())
        .filter(
          (focus): focus is string =>
            typeof focus === 'string' && focus.length > 0,
        )

      // Generate response
      // Only propagate 'user' or 'bot' role for AI
      const typedConversationMessages = conversationMessages.map((msg) => ({
        role:
          msg.role === 'therapist'
            ? 'user'
            : msg.role === 'patient'
              ? 'bot'
              : msg.role, // Only allow 'user' or 'bot' roles in chat contract
        content: msg.content,
      }))

      const { prompt } = await generatePatientResponse(
        typedConversationMessages,
        currentFocus.length > 0 ? currentFocus : undefined,
        1, // Session number (could be tracked in state in a more advanced implementation)
      )

      // At this point we'd send the prompt to the LLM service
      // but for now, we'll use the regular AI service
      return prompt
    } catch (err: unknown) {
      console.error('Error generating patient response:', err)
      return null
    }
  }

  // Get therapist responses for supervisor feedback
  const getTherapistResponses = useCallback(() => {
    return messages
      .filter((msg) => msg.role === 'user')
      .map((msg) => msg.content)
  }, [messages])

  // Generate session transcript for supervisor feedback
  const getSessionTranscript = useCallback(() => {
    return messages
      .filter((msg) => msg.role !== 'system')
      .map(
        (msg) =>
          `${msg.role === 'user' ? 'Therapist' : 'Client'}: ${msg.content}`,
      )
      .join('\n')
  }, [messages])

  // Toggle supervisor feedback panel
  const toggleSupervisorFeedback = () => {
    setShowSupervisorFeedback(!showSupervisorFeedback)
  }

  return (
    <div
      className={cn(
        'flex flex-col',
        isExpanded ? 'fixed inset-0 z-10 bg-black p-4' : '',
      )}
    >
      {/* Header toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-green-300">
          Therapy Training Environment
        </h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPatientModelSelector(true)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm',
              usePatientSimulation
                ? 'bg-green-800/70 text-green-200'
                : 'bg-green-900/30 text-green-400',
            )}
          >
            {usePatientSimulation
              ? `Patient Model: ${currentModel?.name || 'Default'}`
              : 'Enable Patient Simulation'}
          </button>
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={cn(
              'rounded-lg p-1.5',
              showAnalytics
                ? 'bg-green-800/70 text-green-200'
                : 'bg-green-900/30 text-green-400',
            )}
            aria-label="Toggle analytics dashboard"
          >
            <IconChart className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowMentalHealthPanel(!showMentalHealthPanel)}
            className={cn(
              'rounded-lg p-1.5',
              showMentalHealthPanel
                ? 'bg-green-800/70 text-green-200'
                : 'bg-green-900/30 text-green-400',
            )}
            aria-label="Toggle mental health insights"
          >
            <IconMental className="h-5 w-5" />
          </button>
          <button
            onClick={toggleSupervisorFeedback}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm',
              showSupervisorFeedback
                ? 'bg-green-800/70 text-green-200'
                : 'bg-green-900/30 text-green-400',
            )}
          >
            Supervisor Feedback
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-lg bg-green-900/30 p-1.5 text-green-400"
            aria-label={isExpanded ? 'Minimize' : 'Maximize'}
          >
            {isExpanded ? (
              <IconMinimize className="h-5 w-5" />
            ) : (
              <IconMaximize className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex h-full flex-col space-y-4 lg:flex-row lg:space-y-0 lg:space-x-4">
        {/* Chat container */}
        <div className="flex-1">
          <button
            className="flex items-center gap-2 rounded-lg bg-green-900/30 px-3 py-2 text-green-300"
            aria-pressed={showScenarios}
            onClick={() => setShowScenarios(!showScenarios)}
          >
            {' '}
            <div className="relative mb-4 flex items-center justify-between">
              <span>Client Case: {selectedScenario.name}</span>
              <IconChevronDown className="h-4 w-4" />
            </div>
            {/* Settings */}
            <div className="flex items-center gap-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="mh-analysis"
                  checked={storeState.mentalHealthAnalysisEnabled}
                  onCheckedChange={toggleMentalHealthAnalysis}
                />

                <Label htmlFor="mh-analysis" className="text-sm text-green-300">
                  Cognitive Assessment
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="expert-guidance"
                  checked={storeState.expertGuidanceEnabled}
                  onCheckedChange={toggleExpertGuidance}
                />

                <Label
                  htmlFor="expert-guidance"
                  className="text-sm text-green-300"
                >
                  Clinical Guidance
                </Label>
              </div>
            </div>
          </button>

          {/* Scenarios popup */}
          {showScenarios && (
            <div className="absolute z-10 mt-1 w-64 rounded-lg border border-green-700/30 bg-black bg-opacity-95 p-2 shadow-lg">
              <h3 className="mb-2 border-b border-green-700/30 pb-1 text-sm font-semibold text-green-300">
                Select Client Case
              </h3>
              <div className="flex flex-col space-y-1">
                {clientScenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    className={cn(
                      'rounded px-3 py-2 text-left text-sm transition-colors',
                      selectedScenario.id === scenario.id
                        ? 'bg-green-700/30 text-green-300'
                        : 'text-gray-300 hover:bg-green-700/20',
                    )}
                    onClick={() => changeScenario(scenario)}
                  >
                    <div className="font-medium">{scenario.name}</div>
                    <div className="text-xs text-gray-400">
                      {scenario.description}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {scenario.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-green-900/30 px-2 py-0.5 text-xs text-green-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat interface */}
          <ChatContainer
            messages={messages}
            onSendMessage={(msg) => {
              setInput(msg)
              handleSubmit({ preventDefault: () => {} } as React.FormEvent)
            }}
            isLoading={isLoading}
            {...(error ? { error } : {})}
          />

          <div className="flex items-center space-x-2 mb-2 ml-2">
            <Switch
              id="patient-simulation-toggle"
              checked={usePatientSimulation}
              onCheckedChange={setUsePatientSimulation}
            />

            <Label htmlFor="patient-simulation-toggle">
              Use Patient Simulation
            </Label>
            {usePatientSimulation && (
              <button
                onClick={() =>
                  setShowPatientModelSelector(!showPatientModelSelector)
                }
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 border border-gray-300 bg-white hover:bg-gray-100 h-8 py-2 px-3"
              >
                {showPatientModelSelector ? 'Hide' : 'Select'} Patient Model
              </button>
            )}
          </div>

          {usePatientSimulation && showPatientModelSelector && (
            <div className="m-2">
              <CognitiveModelSelector
                selectedModelId={currentModelId}
                onSelectModel={selectModel}
                onStyleConfigChange={updateStyleConfig}
                className="mb-4"
              />

              {isPatientModelLoading && (
                <div className="text-blue-500">Loading patient models...</div>
              )}
              {patientModelError && (
                <div className="text-red-500">{patientModelError}</div>
              )}
              {currentModel && (
                <div className="text-gray-700 text-sm mb-2">
                  Using patient model: <strong>{currentModel.name}</strong> -{' '}
                  {currentModel.diagnosisInfo?.primaryDiagnosis}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar panels */}
        {showMentalHealthPanel && (
          <div className="w-full lg:w-80">
            <div className="rounded-xl border border-green-700/30 bg-black bg-opacity-90 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-green-300">
                  Cognitive Assessment
                </h3>
                <button
                  onClick={() => setShowMentalHealthPanel(false)}
                  className="rounded-lg bg-green-900/30 p-1 text-green-300 hover:bg-green-800/30"
                  aria-label="Close cognitive assessment panel"
                >
                  <IconMinimize className="h-4 w-4" />
                </button>
              </div>
              <MentalHealthInsights
                analysis={{
                  ...(getLatestMentalHealthAnalysis() || {
                    category: 'low' as const,
                    hasMentalHealthIssue: true,
                    confidence: 0,
                    explanation: 'No data available',
                    supportingEvidence: [],
                    timestamp: Date.now(),
                    expertGuided: false,
                    emotions: [],
                    riskFactors: [],
                  }),
                  riskLevel:
                    getLatestMentalHealthAnalysis()?.category === 'critical'
                      ? 'high'
                      : (getLatestMentalHealthAnalysis()?.category as
                          | 'low'
                          | 'medium'
                          | 'high'
                          | undefined) || 'low',
                  summary: 'Analysis summary not available',
                  scores: {},
                }}
              />
            </div>
          </div>
        )}

        {/* Supervisor Feedback Panel */}
        {showSupervisorFeedback && (
          <div className="w-full lg:w-96">
            <SupervisorFeedback
              sessionTranscript={getSessionTranscript()}
              patientModel={{
                id: currentModel?.id || 'default-model',
                name: currentModel?.name || selectedScenario.name,
                presentingIssues: currentModel?.presentingIssues || [
                  selectedScenario.description,
                ],

                primaryDiagnosis:
                  currentModel?.diagnosisInfo?.primaryDiagnosis ||
                  selectedScenario.name,
                responseStyle: {}, // CognitiveModel doesn't have responseStyle, using empty object
              }}
              therapistResponses={getTherapistResponses()}
            />
          </div>
        )}
      </div>

      {/* Analytics Dashboard */}
      {showAnalytics && (
        <div className="mt-4">
          <Suspense fallback={<LoadingAnalytics />}>
            <LazyAnalyticsDashboard
              messages={messages}
              securityLevel="standard"
              encryptionEnabled={false}
              scenario={selectedScenario.name}
            />
          </Suspense>
        </div>
      )}

      {/* Patient model selector */}
      {showPatientModelSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-medium">Select Patient Model</h3>
            <CognitiveModelSelector
              selectedModelId={currentModelId}
              onSelectModel={selectModel}
              onStyleConfigChange={updateStyleConfig}
              className="mb-4"
            />

            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setShowPatientModelSelector(false)}
                className="rounded-md bg-gray-200 px-4 py-2 text-gray-800"
              >
                Close
              </button>
              <button
                onClick={() => setUsePatientSimulation(!usePatientSimulation)}
                className={`rounded-md px-4 py-2 ${
                  usePatientSimulation
                    ? 'bg-red-500 text-white'
                    : 'bg-green-500 text-white'
                }`}
              >
                {usePatientSimulation ? 'Disable' : 'Enable'} Simulation
              </button>
            </div>
            {isPatientModelLoading && (
              <div className="mt-2 text-blue-500">
                Loading patient models...
              </div>
            )}
            {patientModelError && (
              <div className="mt-2 text-red-500">{patientModelError}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfessionalTherapistWorkspace
