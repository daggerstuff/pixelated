import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { v4 as uuidv4 } from 'uuid'

import { cn } from '../../lib/utils'
import { useRealTimeAnalysis } from '../hooks/useRealTimeAnalysis'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import type {
  Scenario,
  ScenarioDifficulty,
  TherapeuticDomain,
  RealTimeFeedback,
  TherapeuticTechnique,
  DetectedTechnique,
} from '../types'
import { FeedbackType } from '../types'
import { checkBrowserCompatibility } from '../utils/privacy'
import EmpathyMeter from './EmpathyMeter'
import RealTimeFeedbackPanel from './RealTimeFeedbackPanel'
import RealTimePrompts from './RealTimePrompts'
import ResistanceMonitor from './ResistanceMonitor'
// Components
import ScenarioInfo from './ScenarioInfo'

interface EnhancedSimulationContainerProps {
  scenarioId: string
  className?: string
  onBackToScenarios?: () => void
}

/**
 * Enhanced container for therapeutic practice simulation
 * Integrates advanced features like real-time analysis, speech recognition,
 * and therapeutic prompts for a more immersive experience
 */
export function EnhancedSimulationContainer({
  scenarioId,
  className = '',
  onBackToScenarios,
}: EnhancedSimulationContainerProps) {
  // State
  const [userResponse, setUserResponse] = useState<string>('')
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: 'user' | 'system'; text: string }>
  >([])
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isCompatible, setIsCompatible] = useState<boolean>(true)
  const [compatibilityError, setCompatibilityError] = useState<string[]>([])
  const [empathyScore, setEmpathyScore] = useState<number>(0.5)
  const [techniqueScores, setTechniqueScores] = useState<
    Record<string, number>
  >({})
  const [autoScroll, setAutoScroll] = useState<boolean>(true)
  const [showTechniqueHighlights, setShowTechniqueHighlights] =
    useState<boolean>(true)
  const [currentPrompt, setCurrentPrompt] = useState<string>('')
  const [feedback, setFeedback] = useState<RealTimeFeedback[]>([])

  // Use currentPrompt as a key in React elements for optimization
  const conversationKey = currentPrompt.length > 0 ? 'prompted' : 'unprompted'

  // Unique session ID for the Gestalt WebSocket connection
  const sessionId = useMemo(
    () => `session-${scenarioId}-${uuidv4().slice(0, 8)}`,
    [scenarioId],
  )

  // Get scenario details and simulator functions
  // Use getScenarioById from imported function instead of from hook
  const scenario = scenarioId
    ? ({
        id: scenarioId,
        title: `Scenario ${scenarioId}`,
        domain: 'DEPRESSION' as TherapeuticDomain,
        difficulty: 'BEGINNER' as ScenarioDifficulty,
        initialPrompt: 'Welcome to the simulation. How are you feeling today?',
        description: 'Practice scenario for depression treatment',
        techniques: [],
        contextDescription: 'Initial therapy session',
        clientBackground: 'Client presenting with depressive symptoms',
        presentingIssue: 'Persistent low mood and difficulty concentrating',
        objectives: ['Build rapport', 'Identify symptoms'],
      } as Scenario)
    : null

  // Real-time analysis
  const {
    startAnalysis,
    stopAnalysis,
    emotionState,
    detectedTechniques = [],
  } = useRealTimeAnalysis()

  // Convert DetectedTechnique[] to TherapeuticTechnique[] for the component
  const mappedTechniques: TherapeuticTechnique[] = detectedTechniques.map(
    (technique: DetectedTechnique) => technique.name as TherapeuticTechnique,
  )

  // Speech recognition
  const {
    isListening,
    isSupported,
    interimTranscript,
    detectedKeywords,
    error: speechError,
    stopListening,
    resetTranscript,
    toggleListening,
  } = useSpeechRecognition({
    domain: scenario?.domain.toLowerCase() || 'general',
    onFinalResult: (result) => {
      // Update user response with the final recognized text
      if (result.text.trim()) {
        setUserResponse((prev) => `${prev} ${result.text}`.trim())

        // Update technique scores based on detected techniques
        if (Object.keys(result.detectedTechniques).length > 0) {
          setTechniqueScores((prev) => ({
            ...prev,
            ...result.detectedTechniques,
          }))

          // Calculate overall empathy score
          // This is a simplified calculation - in a real app this would be more sophisticated
          if (result.detectedTechniques['empathy']) {
            setEmpathyScore((prev) => Math.min(1, prev + 0.1))
          } else if (result.detectedTechniques['validation']) {
            setEmpathyScore((prev) => Math.min(1, prev + 0.05))
          } else if (result.detectedTechniques['reflection']) {
            setEmpathyScore((prev) => Math.min(1, prev + 0.05))
          }
        }
      }
    },
  })

  // Refs
  const formRef = useRef<HTMLFormElement>(null)
  const conversationEndRef = useRef<HTMLDivElement>(null)

  // Use stable reference for scenario to avoid dependency issues
  const scenarioRef = useRef(scenario)
  scenarioRef.current = scenario

  // Use refs to capture the latest function references to avoid dependency issues
  const startAnalysisRef = useRef(startAnalysis)
  const stopAnalysisRef = useRef(stopAnalysis)
  const stopListeningRef = useRef(stopListening)

  // Update refs when functions change
  useEffect(() => {
    startAnalysisRef.current = startAnalysis
    stopAnalysisRef.current = stopAnalysis
    stopListeningRef.current = stopListening
  })

  // Effect to start simulation when component mounts
  useEffect(() => {
    const currentScenario = scenarioRef.current
    if (currentScenario) {
      // Add initial scenario prompt to conversation history
      setConversationHistory([
        {
          role: 'system',
          text: currentScenario.initialPrompt || 'Welcome to the simulation.',
        },
      ])

      // Start real-time analysis
      void startAnalysisRef.current()
    }

    return () => {
      // Stop analysis and speech recognition when component unmounts
      stopAnalysisRef.current()
      stopListeningRef.current()
    }
  }, [scenarioId]) // Use scenarioId instead of scenario object

  // Auto-scroll to bottom of conversation when new messages are added
  useEffect(() => {
    if (autoScroll && conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversationHistory, autoScroll])

  // Check browser compatibility
  useEffect(() => {
    const { compatible, missingFeatures } = checkBrowserCompatibility()
    setIsCompatible(compatible)
    setCompatibilityError(missingFeatures)
  }, [])

  // Handle form submission
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()

      if (!userResponse.trim() || isSubmitting) {
        return
      }

      setIsSubmitting(true)

      // Add user response to conversation history
      setConversationHistory(
        (prev: Array<{ role: 'user' | 'system'; text: string }>) => [
          ...prev,
          { role: 'user', text: userResponse },
        ],
      )

      // Simulate API call for response
      setTimeout(() => {
        // In a real app, this would call an API to get a response
        // based on the scenario and user input
        const simulatedResponse = {
          text: 'Thank you for sharing that. How has this been affecting your daily life?',
          feedbackPoints: [
            {
              type: 'positive',
              text: 'Good use of open-ended question',
            },
            {
              type: 'suggestion',
              text: 'Consider reflecting back feelings to show understanding',
            },
          ],
        }

        // Add system response to conversation history
        setConversationHistory(
          (prev: Array<{ role: 'user' | 'system'; text: string }>) => [
            ...prev,
            { role: 'system', text: simulatedResponse.text },
          ],
        )

        // Generate feedback based on the response
        setFeedback([
          {
            id: `feedback-${Date.now()}`,
            type: FeedbackType.POSITIVE,
            timestamp: Date.now(),
            suggestion: 'Good use of open-ended question',
            rationale:
              'Open-ended questions encourage detailed responses and exploration of feelings',
            priority: 'medium',
          },
          {
            id: `feedback-${Date.now() + 1}`,
            type: FeedbackType.TECHNIQUE_SUGGESTION,
            timestamp: Date.now() + 1,
            suggestion:
              'Consider reflecting back feelings to show understanding',
            rationale:
              'Reflecting feelings helps the client feel understood and validates their experience',
            priority: 'medium',
          },
        ])

        // Reset user response
        setUserResponse('')
        setIsSubmitting(false)
      }, 1000)
    },
    [userResponse, isSubmitting],
  )

  // Handle prompt selection
  const handlePromptSelect = useCallback((prompt: string) => {
    setUserResponse(prompt)
    setCurrentPrompt(prompt)
  }, [])

  // If scenario not found, show error
  if (!scenario) {
    return (
      <div className='flex h-full flex-col items-center justify-center p-6'>
        <h2 className='text-gray-800 mb-2 text-xl font-semibold'>
          Scenario Not Found
        </h2>
        <p className='text-gray-600 mb-4'>
          The requested simulation scenario could not be found.
        </p>
        <button
          onClick={onBackToScenarios}
          className='bg-blue-500 text-white hover:bg-blue-600 rounded-md px-4 py-2 transition-colors'
        >
          Return to Scenario Selection
        </button>
      </div>
    )
  }

  // If browser not compatible, show warning
  if (!isCompatible) {
    return (
      <div className='flex h-full flex-col items-center justify-center p-6'>
        <h2 className='text-red-600 mb-2 text-xl font-semibold'>
          Browser Compatibility Issue
        </h2>
        <p className='text-gray-700 mb-2'>
          Your browser doesn&apos;t support some features needed for this
          simulation:
        </p>
        <ul className='mb-4 list-disc pl-5'>
          {compatibilityError.map((error) => (
            <li key={error} className='text-gray-600'>
              {error}
            </li>
          ))}
        </ul>
        <p className='text-gray-700 mb-4'>
          Please try using a modern browser like Chrome, Edge, or Firefox.
        </p>
        <button
          onClick={onBackToScenarios}
          className='bg-blue-500 text-white hover:bg-blue-600 rounded-md px-4 py-2 transition-colors'
        >
          Return to Scenario Selection
        </button>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      {/* Header with scenario information */}
      <div className='bg-white border-gray-200 flex items-center justify-between border-b px-4 py-3'>
        <ScenarioInfo scenario={scenario} />

        <div className='flex items-center space-x-3'>
          <div className='flex items-center'>
            <label htmlFor='autoScroll' className='text-gray-600 mr-2 text-sm'>
              Auto-scroll
            </label>
            <input
              type='checkbox'
              id='autoScroll'
              checked={autoScroll}
              onChange={() => setAutoScroll(!autoScroll)}
              className='text-blue-600 border-gray-300 h-4 w-4 rounded'
            />
          </div>

          <div className='flex items-center'>
            <label
              htmlFor='showTechniques'
              className='text-gray-600 mr-2 text-sm'
            >
              Show Techniques
            </label>
            <input
              type='checkbox'
              id='showTechniques'
              checked={showTechniqueHighlights}
              onChange={() =>
                setShowTechniqueHighlights(!showTechniqueHighlights)
              }
              className='text-blue-600 border-gray-300 h-4 w-4 rounded'
            />
          </div>

          <button
            onClick={onBackToScenarios}
            className='text-gray-500 hover:text-gray-700'
            aria-label='Back to scenarios'
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              className='h-5 w-5'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className='flex flex-1 overflow-hidden'>
        {/* Left panel - Conversation */}
        <div className='border-gray-200 flex h-full w-3/5 flex-col overflow-hidden border-r'>
          {/* Conversation history */}
          <div
            className='flex-1 space-y-4 overflow-y-auto p-4'
            key={conversationKey}
          >
            {conversationHistory.map((message, index: number) => (
              <div
                key={`message-${index}-${message.role}-${message.text.slice(0, 20)}`}
                className={cn(
                  'flex p-3 rounded-lg max-w-3/4',
                  message.role === 'user' ? 'bg-blue-50 ml-auto' : 'bg-gray-50',
                )}
              >
                <div className='text-sm'>{message.text}</div>
              </div>
            ))}

            {/* Display interim transcript if speech recognition is active */}
            {isListening && interimTranscript && (
              <div className='bg-blue-50 max-w-3/4 ml-auto flex rounded-lg p-3 opacity-70'>
                <div className='text-gray-700 text-sm italic'>
                  {interimTranscript}...
                </div>
              </div>
            )}

            {/* Invisible element for auto-scrolling */}
            <div ref={conversationEndRef} />
          </div>

          {/* User input form */}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className='border-gray-200 border-t p-3'
          >
            <div className='relative'>
              <textarea
                value={userResponse}
                onChange={(e) => setUserResponse(e.target.value)}
                placeholder='Type your response here...'
                className='border-gray-300 focus:ring-blue-500 focus:border-transparent h-24 w-full resize-none rounded-md border p-3 pr-12 focus:ring-2'
                disabled={isSubmitting}
              />

              {/* Speech recognition toggle button */}
              {isSupported && (
                <button
                  type='button'
                  onClick={toggleListening}
                  className={cn(
                    'absolute right-3 bottom-3 p-2 rounded-full',
                    isListening
                      ? 'bg-red-100 text-red-600 animate-pulse'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  )}
                  title={isListening ? 'Stop listening' : 'Start voice input'}
                  aria-label={
                    isListening ? 'Stop listening' : 'Start voice input'
                  }
                >
                  {isListening ? (
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='h-5 w-5'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      className='h-5 w-5'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z'
                      />
                    </svg>
                  )}
                </button>
              )}
            </div>

            {/* Therapeutic prompts */}
            <RealTimePrompts
              detectedKeywords={detectedKeywords}
              domain={scenario.domain.toLowerCase()}
              onPromptClick={handlePromptSelect}
            />

            <div className='mt-3 flex justify-between'>
              <div className='text-gray-500 text-xs'>
                {speechError ? (
                  <span className='text-red-500'>{speechError}</span>
                ) : isListening ? (
                  <span className='text-green-500'>Listening...</span>
                ) : null}
              </div>

              <button
                type='submit'
                disabled={!userResponse.trim() || isSubmitting}
                className={cn(
                  'px-4 py-2 rounded-md text-white',
                  !userResponse.trim() || isSubmitting
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600',
                )}
              >
                {isSubmitting ? 'Sending...' : 'Send Response'}
              </button>
            </div>
          </form>
        </div>

        {/* Right panel - Feedback and metrics */}
        <div className='bg-gray-50 flex h-full w-2/5 flex-col overflow-hidden'>
          {/* Live Resistance Monitor (Gestalt Engine) */}
          <div className='p-4'>
            <ResistanceMonitor sessionId={sessionId} />
          </div>

          {/* Real-time metrics */}
          <div className='border-gray-200 border-b p-4'>
            <h3 className='text-gray-700 mb-3 text-sm font-medium'>
              Real-time Performance Metrics
            </h3>

            {/* Empathy meter */}
            <div className='mb-4'>
              <div className='text-gray-600 mb-1 flex justify-between text-xs'>
                <span>Empathy Level</span>
                <span>{Math.round(empathyScore * 100)}%</span>
              </div>
              <EmpathyMeter value={empathyScore} />
            </div>

            {/* Technique detection */}
            <div>
              <h4 className='text-gray-600 mb-1 text-xs font-medium'>
                Detected Therapeutic Techniques
              </h4>
              <div className='space-y-2'>
                {Object.entries(techniqueScores).length > 0 ? (
                  Object.entries(techniqueScores).map(([technique, score]) => (
                    <div
                      key={technique}
                      className='flex items-center justify-between'
                    >
                      <span className='text-xs capitalize'>
                        {technique.replace('_', ' ')}
                      </span>
                      <div className='bg-gray-200 h-2 w-24 overflow-hidden rounded'>
                        <div
                          className='bg-blue-500 h-full'
                          style={{ width: `${score * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className='text-gray-500 text-xs italic'>
                    No techniques detected yet. Try using reflection,
                    validation, or open questions.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Real-time feedback */}
          <div className='flex-1 overflow-y-auto p-4'>
            <h3 className='text-gray-700 mb-3 text-sm font-medium'>
              Real-time Feedback
            </h3>

            <RealTimeFeedbackPanel
              feedback={feedback}
              detectedTechniques={mappedTechniques}
              emotionInsights={
                emotionState || { energy: 0.5, valence: 0.5, dominance: 0.5 }
              }
            />
          </div>

          {/* Controls */}
          <div className='border-gray-200 border-t p-4'>
            <div className='flex justify-between'>
              <button
                onClick={() => {
                  // Reset conversation
                  setConversationHistory([
                    {
                      role: 'system',
                      text:
                        scenario.initialPrompt || 'Welcome to the simulation.',
                    },
                  ])
                  setUserResponse('')
                  setEmpathyScore(0.5)
                  setTechniqueScores({})
                  resetTranscript()
                }}
                className='bg-gray-200 text-gray-700 hover:bg-gray-300 rounded px-3 py-1.5 text-sm transition-colors'
              >
                Reset Simulation
              </button>

              <button
                onClick={() => {
                  stopAnalysis()
                  stopListening()
                  onBackToScenarios?.()
                }}
                className='bg-blue-500 text-white hover:bg-blue-600 rounded px-3 py-1.5 text-sm transition-colors'
              >
                End Simulation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Example PHI audit logging - uncomment and customize as needed
// logger.info('Accessing PHI data', {
//   userId: 'user-id-here',
//   action: 'read',
//   dataType: 'patient-record',
//   recordId: 'record-id-here'
// });
