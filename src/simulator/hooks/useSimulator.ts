import { useState, useCallback, useEffect } from 'react'
import type { SimulationFeedback, Scenario } from '../types'
import { TherapeuticTechnique, FeedbackType } from '../types'
import {
  getUserConsentPreference,
  setUserConsentPreference,
} from '../utils/privacy'
import { getScenarioById } from '../data/scenarios'
import { useAnonymizedMetrics } from './useAnonymizedMetrics'

/**
 * Custom hook for simulator functionality including real-time processing
 * and HIPAA-compliant feedback
 */
export function useSimulator() {
  const [currentScenario, setCurrentScenario] = useState<Scenario | undefined>()
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [feedback, setFeedback] = useState<SimulationFeedback | undefined>()
  const [metricsConsent, setMetricsConsentState] = useState<boolean>(
    getUserConsentPreference(),
  )
  const { updateMetrics } = useAnonymizedMetrics()

  // Initialize metrics consent from localStorage on mount
  useEffect(() => {
    setMetricsConsentState(getUserConsentPreference())
  }, [])

  // Update local storage when consent changes
  const setMetricsConsent = useCallback((consent: boolean) => {
    setMetricsConsentState(consent)
    setUserConsentPreference(consent)
  }, [])

  /**
   * Start a new simulation with the selected scenario
   */
  const startSimulation = useCallback(
    async (scenarioId: string) => {
      try {
        const scenario = await getScenarioById(scenarioId)
        if (!scenario) {
          throw new Error(`Scenario with ID ${scenarioId} not found`)
        }

        setCurrentScenario(scenario)
        setFeedback(undefined)

        // If user has consented to metrics, record this session
        if (metricsConsent) {
          updateMetrics({
            type: 'startSession',
            domain: scenario.domain,
          })
        }

        return
      } catch (error) {
        console.error('Failed to start simulation:', error)
        throw error
      }
    },
    [metricsConsent, updateMetrics],
  )

  /**
   * Process the practitioner's response and generate feedback
   * All processing happens client-side with no data storage
   */
  const sendResponse = useCallback(
    async (response: string): Promise<SimulationFeedback> => {
      if (!currentScenario) {
        throw new Error('No active scenario')
      }

      setIsProcessing(true)

      try {
        // Simulate processing delay (in a real implementation, this would be
        // replaced with actual WebRTC and client-side ML processing)
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Generate feedback based on the response
        // In a real implementation, this would use client-side ML models
        const detectedTechniques = detectTechniques(response)
        const feedbackType = generateFeedbackType(
          detectedTechniques,
          currentScenario,
        )

        const simulationFeedback: SimulationFeedback = {
          type: feedbackType,
          message: generateFeedbackMessage(
            feedbackType,
            detectedTechniques,
            currentScenario,
          ),
          detectedTechniques,
          alternativeResponses:
            feedbackType === FeedbackType.ALTERNATIVE_APPROACH
              ? generateAlternativeResponses(response, currentScenario)
              : undefined,
          techniqueSuggestions:
            feedbackType === FeedbackType.TECHNIQUE_SUGGESTION
              ? suggestTechniques(detectedTechniques, currentScenario)
              : undefined,
        }

        setFeedback(simulationFeedback)

        // If user has consented to metrics, update skill usage
        if (metricsConsent) {
          updateMetrics({
            type: 'recordTechniques',
            techniques: detectedTechniques,
          })

          updateMetrics({
            type: 'recordFeedback',
            feedbackType: feedbackType,
          })
        }

        return simulationFeedback
      } catch (error) {
        console.error('Error processing response:', error)
        throw error
      } finally {
        setIsProcessing(false)
      }
    },
    [currentScenario, metricsConsent, updateMetrics],
  )

  return {
    currentScenario,
    setCurrentScenario,
    isProcessing,
    feedback,
    startSimulation,
    sendResponse,
    metricsConsent,
    setMetricsConsent,
  }
}

/**
 * Mock implementation of technique detection
 * In a real implementation, this would use a more sophisticated model
 */
function detectTechniques(response: string): TherapeuticTechnique[] {
  const techniques: TherapeuticTechnique[] = []

  // Simple pattern matching for demonstration purposes
  if (/what .+\?|how .+\?|could you .+\?/.test(response)) {
    techniques.push(TherapeuticTechnique.OPEN_ENDED_QUESTIONS)
  }

  if (
    /I hear you saying|it sounds like|you seem to be saying|you're feeling|you feel/.test(
      response,
    )
  ) {
    techniques.push(TherapeuticTechnique.REFLECTIVE_STATEMENTS)
  }

  if (
    /that must be|I understand|that's really|I can see how|valid|makes sense/.test(
      response,
    )
  ) {
    techniques.push(TherapeuticTechnique.VALIDATION)
  }

  if (
    /breathe|notice|present moment|focus on|observe|sensations|breath/.test(
      response,
    )
  ) {
    techniques.push(TherapeuticTechnique.MINDFULNESS)
  }

  if (
    /what would happen if|is there evidence|alternative explanation|different perspective/.test(
      response,
    )
  ) {
    techniques.push(TherapeuticTechnique.COGNITIVE_RESTRUCTURING)
  }

  // Ensure at least one technique is detected
  if (techniques.length === 0) {
    techniques.push(TherapeuticTechnique.ACTIVE_LISTENING)
  }

  return techniques
}

/**
 * Determine feedback type based on detected techniques and scenario
 */
function generateFeedbackType(
  techniques: TherapeuticTechnique[],
  scenario: Scenario,
): FeedbackType {
  // Check if the user applied appropriate techniques for this scenario
  const recommendedTechniques = scenario.techniques
  const usedRecommendedTechnique = techniques.some((t) =>
    recommendedTechniques.includes(t),
  )

  // Randomly select feedback type with weighted probability
  const rand = Math.random()

  if (usedRecommendedTechnique) {
    // Higher chance of positive feedback when using recommended techniques
    if (rand < 0.7) {
      return FeedbackType.POSITIVE
    } else if (rand < 0.85) {
      return FeedbackType.DEVELOPMENTAL
    } else {
      return FeedbackType.TECHNIQUE_SUGGESTION
    }
  } else if (rand < 0.3) {
    return FeedbackType.POSITIVE
  } else if (rand < 0.6) {
    return FeedbackType.DEVELOPMENTAL
  } else if (rand < 0.8) {
    return FeedbackType.TECHNIQUE_SUGGESTION
  } else {
    return FeedbackType.ALTERNATIVE_APPROACH
  }
}

/**
 * Generate feedback message based on feedback type and techniques
 */
function generateFeedbackMessage(
  feedbackType: FeedbackType,
  techniques: TherapeuticTechnique[],
  scenario: Scenario,
): string {
  // In a real implementation, this would use more sophisticated templates
  // and possibly client-side ML for generating contextual feedback

  // Declare variables outside the switch statement
  let suggestedTechnique: TherapeuticTechnique | undefined

  switch (feedbackType) {
    case FeedbackType.POSITIVE:
      return `Great job using ${techniques[0].replace(/_/g, ' ')}! This is particularly effective for this client's ${scenario.domain} concerns. Your approach demonstrates attunement to the client's needs.`

    case FeedbackType.DEVELOPMENTAL:
      return `Your response shows good effort with ${techniques[0].replace(
        /_/g,
        ' ',
      )}. For this type of ${
        scenario.domain
      } case, consider being more specific in addressing the client's underlying needs. Try building on what you've started.`

    case FeedbackType.TECHNIQUE_SUGGESTION:
      suggestedTechnique = scenario.techniques.find(
        (t) => !techniques.includes(t),
      )
      return `You're on the right track with ${techniques[0].replace(
        /_/g,
        ' ',
      )}. For this scenario, you might also consider trying ${
        suggestedTechnique
          ? suggestedTechnique.replace(/_/g, ' ')
          : 'another approach'
      } to address the client's ${scenario.domain} concerns more effectively.`

    case FeedbackType.ALTERNATIVE_APPROACH:
      return `While your approach using ${techniques[0].replace(
        /_/g,
        ' ',
      )} has merit, this client might benefit from a different strategy. Consider exploring alternative responses that focus specifically on their ${
        scenario.domain
      } needs.`

    default:
      return `Thank you for your response. Continue practicing different techniques to develop your skills.`
  }
}

/**
 * Suggest alternative techniques based on scenario
 */
function suggestTechniques(
  currentTechniques: TherapeuticTechnique[],
  scenario: Scenario,
): TherapeuticTechnique[] {
  // Find techniques in the scenario that weren't used
  const unusedRecommendedTechniques = scenario.techniques.filter(
    (t) => !currentTechniques.includes(t),
  )

  // If all recommended techniques were used, suggest other techniques
  if (unusedRecommendedTechniques.length === 0) {
    const allTechniques = Object.values(TherapeuticTechnique)
    const otherTechniques = allTechniques.filter(
      (t) => !currentTechniques.includes(t) && !scenario.techniques.includes(t),
    )

    // Return one random technique from the unused ones
    return [otherTechniques[Math.floor(Math.random() * otherTechniques.length)]]
  }

  // Return one random technique from the unused recommended ones
  return [
    unusedRecommendedTechniques[
      Math.floor(Math.random() * unusedRecommendedTechniques.length)
    ],
  ]
}

/**
 * Generate alternative responses for feedback
 */
function generateAlternativeResponses(
  response: string,
  scenario: Scenario,
): string[] {
  // In a real implementation, this would use client-side ML models
  // to generate contextually appropriate alternative responses

  // For demo purposes, return static alternatives based on scenario domain
  switch (scenario.domain) {
    case 'depression':
      return [
        "I notice you've been feeling down for several weeks. Could you tell me more about when you first started noticing these feelings?",
        'It sounds like these feelings have been really difficult to manage. What kinds of things have you tried so far to cope with them?',
      ]

    case 'anxiety':
      return [
        'I can hear how overwhelming these anxious thoughts are for you. Would it be helpful to explore some grounding techniques we could practice together?',
        'When you notice these anxious feelings coming up, what happens in your body? Understanding these physical sensations can help us develop targeted coping strategies.',
      ]

    default:
      return [
        "I hear that this has been challenging for you. Could you share more about how it's affecting your daily life?",
        'Thank you for sharing that with me. What would be most helpful for us to focus on today regarding this concern?',
      ]
  }
}

// Example PHI audit logging - uncomment and customize as needed
// logger.info('Accessing PHI data', {
//   userId: 'user-id-here',
//   action: 'read',
//   dataType: 'patient-record',
//   recordId: 'record-id-here'
// });
