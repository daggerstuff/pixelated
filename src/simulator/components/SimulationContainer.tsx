import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { SimulationContainerProps, TherapeuticTechnique } from '../types'
import { useSimulator } from '../context/SimulatorContext'
import { checkBrowserCompatibility } from '../utils/privacy'
import SimulationControls from './SimulationControls'

/**
 * Main container for the therapeutic simulation
 * Provides real-time interaction with simulated client scenarios
 */
export function SimulationContainer({
  scenarioId,
  className = '',
  onBackToScenarios,
}: SimulationContainerProps) {
  const [userResponse, setUserResponse] = useState<string>('')
  const [isCompatible, setIsCompatible] = useState<boolean>(true)
  const [compatibilityError, setCompatibilityError] = useState<string[]>([])
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true)
  const [showTechniqueHighlights, setShowTechniqueHighlights] =
    useState<boolean>(true)
  const [detectedTechniques, setDetectedTechniques] = useState<
    TherapeuticTechnique[]
  >([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const responseInputRef = useRef<HTMLTextAreaElement>(null)

  const { state } = useSimulator()
  const {
    currentScenario,
    isProcessing,
    realtimeFeedback,
    startSimulation,
    endSimulation,
    transcribedText,
    isConnected,
  } = {
    currentScenario: (state as {
      currentScenario?: unknown
      isProcessing?: boolean
      realtimeFeedback?: unknown[]
      startSimulation?: (id: string) => Promise<void>
      endSimulation?: () => Promise<void>
      transcribedText?: string
      isConnected?: boolean
    })?.currentScenario,
    isProcessing: (state as {
      currentScenario?: unknown
      isProcessing?: boolean
      realtimeFeedback?: unknown[]
      startSimulation?: (id: string) => Promise<void>
      endSimulation?: () => Promise<void>
      transcribedText?: string
      isConnected?: boolean
    })?.isProcessing,
    realtimeFeedback: (state as {
      currentScenario?: unknown
      isProcessing?: boolean
      realtimeFeedback?: unknown[]
      startSimulation?: (id: string) => Promise<void>
      endSimulation?: () => Promise<void>
      transcribedText?: string
      isConnected?: boolean
    })?.realtimeFeedback,
    startSimulation: (state as {
      currentScenario?: unknown
      isProcessing?: boolean
      realtimeFeedback?: unknown[]
      startSimulation?: (id: string) => Promise<void>
      endSimulation?: () => Promise<void>
      transcribedText?: string
      isConnected?: boolean
    })?.startSimulation,
    endSimulation: (state as {
      currentScenario?: unknown
      isProcessing?: boolean
      realtimeFeedback?: unknown[]
      startSimulation?: (id: string) => Promise<void>
      endSimulation?: () => Promise<void>
      transcribedText?: string
      isConnected?: boolean
    })?.endSimulation,
    transcribedText: (state as {
      currentScenario?: unknown
      isProcessing?: boolean
      realtimeFeedback?: unknown[]
      startSimulation?: (id: string) => Promise<void>
      endSimulation?: () => Promise<void>
      transcribedText?: string
      isConnected?: boolean
    })?.transcribedText,
    isConnected: (state as {
      currentScenario?: unknown
      isProcessing?: boolean
      realtimeFeedback?: unknown[]
      startSimulation?: (id: string) => Promise<void>
      endSimulation?: () => Promise<void>
      transcribedText?: string
      isConnected?: boolean
    })?.isConnected,
  }

  // Conversation history for the current session
  const [conversation, setConversation] = useState<
    Array<{
      type: 'scenario' | 'user' | 'feedback'
      content: string
      timestamp: number
      techniques?: TherapeuticTechnique[]
    }>
  >([])

  // Check browser compatibility on mount
  useEffect(() => {
    const { compatible, missingFeatures } = checkBrowserCompatibility()
    setIsCompatible(compatible)
    setCompatibilityError(missingFeatures)
  }, [])

  // Start simulation when scenarioId changes
  useEffect(() => {
    if (scenarioId) {
      // Reset conversation
      setConversation([])
      setUserResponse('')

      // Start new simulation
      startSimulation(scenarioId)
        .then(() => {
          // Focus on response input after simulation starts
          if (responseInputRef.current) {
            responseInputRef.current.focus()
          }
        })
        .catch((error) => {
          console.error('Failed to start simulation:', error)
        })
    }

    // Clean up on unmount
    return () => {
      endSimulation().catch((err) =>
        console.error('Error ending simulation:', err),
      )
    }
  }, [scenarioId, startSimulation, endSimulation])

  // Add scenario information to conversation when scenario changes
  useEffect(() => {
    if (currentScenario) {
      setConversation((prev) => {
        // Check if we already have the scenario information
        if (prev.some((item) => item.type === 'scenario')) {
          return prev
        }

        // Add scenario information
        return [
          {
            type: 'scenario',
            content: `${currentScenario?.['contextDescription'] || ''} ${currentScenario?.['clientBackground'] || ''}`,
            timestamp: Date.now(),
          },
        ]
      })
    }
  }, [currentScenario])

  // Auto-scroll to bottom of conversation when new messages arrive
  useEffect(() => {
    if (autoScrollEnabled && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [conversation, autoScrollEnabled])

  // Update user response when transcription changes
  useEffect(() => {
    if (transcribedText) {
      setUserResponse(transcribedText)
    }
  }, [transcribedText])

  // Add feedback to conversation when it arrives
  useEffect(() => {
    if (realtimeFeedback.length > 0) {
      const latestFeedback = realtimeFeedback[0]

      // Add feedback to conversation if it has content
      if (latestFeedback.content || latestFeedback.suggestion) {
        setConversation((prev) => {
          // Check if we've already added this feedback
          if (
            prev.some(
              (item) =>
                item.type === 'feedback' &&
                item.timestamp === latestFeedback.timestamp,
            )
          ) {
            return prev
          }

          return [
            ...prev,
            {
              type: 'feedback',
              content:
                latestFeedback.content ||
                latestFeedback.suggestion ||
                'No feedback available',
              timestamp: latestFeedback.timestamp,
            },
          ]
        })
      }

      // Update detected techniques if available
      if (latestFeedback.suggestedTechnique) {
        setDetectedTechniques((prev) =>
          prev.includes(latestFeedback.suggestedTechnique!)
            ? prev
            : [...prev, latestFeedback.suggestedTechnique!],
        )
      }
    }
  }, [realtimeFeedback])

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!userResponse.trim() || isProcessing || !currentScenario) {
        return
      }

      // Add user response to conversation
      setConversation((prev) => [
        ...prev,
        {
          type: 'user',
          content: userResponse,
          timestamp: Date.now(),
          techniques: detectedTechniques,
        },
      ])

      // Clear input
      setUserResponse('')
    },
    [userResponse, isProcessing, currentScenario, detectedTechniques],
  )

  // Handle text area growing as content is added
  const handleTextAreaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const { target } = e
      setUserResponse(target.value)

      // Auto-resize the textarea
      target.style.height = 'inherit'
      target.style.height = `${target.scrollHeight}px`
    },
    [],
  )

  // Main render
  return (
    <div className={`simulation-container ${className}`}>
      {!isCompatible && (
        <div className="compatibility-warning">
          <h3>Browser Compatibility Warning</h3>
          <p>
            Your browser is missing some features required for optimal
            simulation:
          </p>
          <ul>
            {compatibilityError.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          <p>
            For the best experience, please use a modern browser like Chrome,
            Edge, or Firefox.
          </p>
        </div>
      )}

      <div className="simulation-header">
        <h2>{currentScenario?.title || 'Therapeutic Simulation'}</h2>
        {onBackToScenarios && (
          <button onClick={onBackToScenarios} className="back-button">
            ← Back to Scenarios
          </button>
        )}
      </div>

      {/* Add the simulation controls */}
      <SimulationControls className="simulation-control-panel" />

      <div className="conversation-container">
        {conversation.map((item) => (
          <div
            key={`${item.type}-${item.timestamp}`}
            className={`conversation-item ${item.type}-message`}
          >
            <div className="message-header">
              <span className="message-type">
                {item.type === 'scenario'
                  ? 'Scenario'
                  : item.type === 'user'
                    ? 'Therapist'
                    : 'Client'}
              </span>
              <span className="message-time">
                {new Date(item.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="message-content">
              {item.content}
              {item.type === 'user' &&
                showTechniqueHighlights &&
                item.techniques &&
                item.techniques.length > 0 && (
                  <div className="technique-tags">
                    {item.techniques.map((technique) => (
                      <span
                        key={technique}
                        className="technique-tag"
                        title={getTechniqueDescription(technique)}
                      >
                        {technique.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="response-form">
        <div className="form-controls">
          <div className="textarea-container">
            <textarea
              ref={responseInputRef}
              value={userResponse}
              onChange={handleTextAreaChange}
              placeholder="Type your therapeutic response here..."
              rows={3}
              disabled={isProcessing || !isConnected}
            />
          </div>
          <div className="button-container">
            <button
              type="submit"
              disabled={isProcessing || !userResponse.trim() || !isConnected}
              className="send-button"
            >
              {isProcessing ? 'Processing...' : 'Send Response'}
            </button>
          </div>
        </div>
        <div className="response-options">
          <label htmlFor="techniqueHighlightsCheckbox" className="option-label">
            <input
              id="techniqueHighlightsCheckbox"
              type="checkbox"
              checked={showTechniqueHighlights}
              onChange={() =>
                setShowTechniqueHighlights(!showTechniqueHighlights)
              }
            />
            Show technique highlights
          </label>
          <label htmlFor="autoScrollCheckbox" className="option-label">
            <input
              id="autoScrollCheckbox"
              type="checkbox"
              checked={autoScrollEnabled}
              onChange={() => setAutoScrollEnabled(!autoScrollEnabled)}
            />
            Auto-scroll
          </label>
        </div>
      </form>

      <style>{/* Existing styles... */}</style>
    </div>
  )
}

// Helper function to provide descriptions of techniques
function getTechniqueDescription(technique: TherapeuticTechnique): string {
  const descriptions: Record<string, string> = {
    active_listening:
      'Giving full attention to the client and demonstrating attentive listening through verbal and non-verbal cues',
    reflective_statements:
      'Paraphrasing and reflecting back what the client has said to demonstrate understanding',
    open_ended_questions:
      "Questions that cannot be answered with a simple 'yes' or 'no', encouraging elaboration",
    validation:
      "Acknowledging and accepting the client's emotions and experiences as valid and understandable",
    motivational_interviewing:
      "Collaborative conversation style for strengthening a person's motivation and commitment to change",
    cognitive_restructuring:
      'Identifying and challenging negative or distorted thinking patterns',
    goal_setting:
      'Collaborative development of specific, measurable, achievable, relevant, and time-bound goals',
    mindfulness:
      'Guiding awareness to the present moment with acceptance and without judgment',
    behavioral_activation:
      'Encouraging engagement in rewarding activities to improve mood and build positive experiences',
    grounding_techniques:
      'Methods to help bring a person back to the present moment during distress or flashbacks',
  }

  return descriptions[technique] || technique.replace(/_/g, ' ')
}
