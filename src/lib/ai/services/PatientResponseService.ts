import type { PatientProfile } from '../models/patient'
import { PatientProfileService } from './PatientProfileService'
import { BeliefConsistencyService } from './BeliefConsistencyService'
// IMPORTANT: Always use public methods from EmotionSynthesizer - never access private methods directly
import {
  EmotionSynthesizer,
  type EnhancedSynthesisOptions,
  type EmotionProfile,
  type EmotionTransitionContext,
} from '../emotions/EmotionSynthesizer'
import { createBuildSafeLogger } from '../../logging/build-safe-logger' // Assuming logger is available

const logger = createBuildSafeLogger('default')

/**
 * Baseline intensity scaling factor for initializing emotional patterns
 * Used to scale down typical emotional pattern intensities to a starting baseline (30% of typical intensity)
 */
const BASELINE_INTENSITY_SCALE = 0.3 as const

/**
 * Defines the nuance of emotional expression.
 * - 'subtle': Emotions are hinted at, not overtly stated.
 * - 'overt': Emotions are clearly expressed.
 * - 'suppressed': Patient attempts to hide or downplay emotions.
 */
export type EmotionalNuance = 'subtle' | 'overt' | 'suppressed'

/**
 * Defines how non-verbal cues are expressed in text.
 * - 'none': No explicit description of non-verbal cues.
 * - 'minimal': Occasional, brief descriptions (e.g., *sighs*).
 * - 'descriptive': More detailed descriptions of actions, expressions, tone.
 */
export type NonVerbalIndicatorStyle = 'none' | 'minimal' | 'descriptive'

/**
 * Specific defensive mechanisms the patient might employ.
 * - 'none': No specific active defensive mechanism.
 * - 'denial': Refusing to accept reality or a fact.
 * - 'projection': Attributing one's own unacceptable thoughts or feelings to others.
 * - 'deflection': Avoiding a topic or question by changing the subject.
 * - 'intellectualization': Focusing on abstract thought to avoid emotions.
 * - 'minimization': Downplaying the significance of a behavior or event.
 */
export type DefensiveMechanism =
  | 'none'
  | 'denial'
  | 'projection'
  | 'deflection'
  | 'intellectualization'
  | 'minimization'

/**
 * Analysis result for therapist utterances
 */
type TherapistUtteranceAnalysis = {
  trustChange: number
  rapportChange: number
  perception: string
}

/**
 * Analysis result for patient utterances
 */
type PatientUtteranceAnalysis = {
  trustChange: number
  rapportChange: number
  updatedPerception: string
}

/**
 * Valid therapist perception values
 */
type TherapistPerception =
  | 'understanding'
  | 'challenging'
  | 'dismissive'
  | 'supportive'
  | 'confusing'
  | 'neutral'

/**
 * Valid transference state values
 */
type TransferenceState =
  | 'none'
  | 'maternal'
  | 'paternal'
  | 'positive-idealizing'
  | 'negative-critical'

/**
 * Configuration constants for alliance metric adjustments
 */
const ALLIANCE_ADJUSTMENTS = {
  // Therapist validation/empathy responses
  VALIDATION_TRUST_BOOST: 0.5,
  VALIDATION_RAPPORT_BOOST: 0.5,

  // Therapist reflective statements
  REFLECTION_RAPPORT_BOOST: 0.2,

  // Therapist gentle challenges
  GENTLE_CHALLENGE_TRUST_PENALTY: -0.1,

  // Therapist confrontation
  CONFRONTATION_TRUST_PENALTY: -0.5,
  CONFRONTATION_RAPPORT_PENALTY: -0.3,

  // Therapist dismissive language
  DISMISSIVE_TRUST_PENALTY: -1.0,
  DISMISSIVE_RAPPORT_PENALTY: -1.0,

  // Patient positive responses
  PATIENT_AGREEMENT_TRUST_BOOST: 0.7,
  PATIENT_AGREEMENT_RAPPORT_BOOST: 0.5,

  // Patient negative responses
  PATIENT_DISAGREEMENT_TRUST_PENALTY: -0.3,
  PATIENT_DISAGREEMENT_RAPPORT_PENALTY: -0.5,

  // Patient defensive responses
  PATIENT_DEFENSIVE_TRUST_PENALTY: -0.5,
  PATIENT_DEFENSIVE_RAPPORT_PENALTY: -0.7,

  // Default values
  DEFAULT_TRUST_LEVEL: 5,
  DEFAULT_RAPPORT_SCORE: 5,

  // Thresholds for transference states
  HIGH_RAPPORT_THRESHOLD: 8,
  HIGH_TRUST_THRESHOLD: 7,
  LOW_TRUST_THRESHOLD: 3,

  // Response length threshold for defensiveness detection
  SHORT_RESPONSE_THRESHOLD: 15,
} as const

/**
 * Patient response style configuration
 */
export type PatientResponseStyleConfig = {
  openness: number // Scale of 0-10, how willing to share
  coherence: number // Scale of 0-10, how logical and easy to follow
  defenseLevel: number // Scale of 0-10, general guardedness

  disclosureStyle: 'open' | 'selective' | 'guarded' // How patient filters information
  challengeResponses: 'defensive' | 'curious' | 'dismissive' | 'compliant' // How patient reacts to therapist challenges

  // New fields for enhanced emotional authenticity
  emotionalNuance: EmotionalNuance // How explicitly emotions are shown
  emotionalIntensity: number // Scale of 0-1, how strong the expressed emotion is
  primaryEmotion?: string // Optional: specify a dominant emotion for the response (e.g., "sadness", "anger")
  nonVerbalIndicatorStyle: NonVerbalIndicatorStyle // How non-verbal cues are textually represented

  // New fields for resistance and defensive mechanisms
  activeDefensiveMechanism: DefensiveMechanism // Specific defense mechanism to employ
  resistanceLevel: number // Scale of 0-10, how much patient resists therapeutic direction
}

/**
 * Response context for generating patient responses
 */
export type ResponseContext = {
  profile: PatientProfile
  styleConfig: PatientResponseStyleConfig
  therapeuticFocus?: string[] | undefined
  sessionNumber: number
}

/**
 * Service for generating patient responses, managing response context,
 * and ensuring response consistency.
 */
export class PatientResponseService {
  private profileService: PatientProfileService
  private consistencyService: BeliefConsistencyService
  private emotionSynthesizer: EmotionSynthesizer // Added dependency

  constructor(
    profileService: PatientProfileService,
    consistencyService: BeliefConsistencyService,
    emotionSynthesizer?: EmotionSynthesizer, // Optional for existing tests, or provide a default
  ) {
    this.profileService = profileService
    this.consistencyService = consistencyService
    this.emotionSynthesizer =
      emotionSynthesizer || EmotionSynthesizer.getInstance()
  }

  /**
   * Create a response context for generating patient responses.
   * @param profileId Profile ID of the patient.
   * @param styleConfig Response style configuration for the patient.
   * @param therapeuticFocus Optional array of current therapeutic focus areas.
   * @param currentSessionNumber Optional current session number; if not provided, it's derived.
   * @returns Promise<ResponseContext | null> Response context or null if profile not found.
   */
  async createResponseContext(
    profileId: string,
    styleConfig: PatientResponseStyleConfig,
    therapeuticFocus?: string[],
    currentSessionNumber?: number,
  ): Promise<ResponseContext | null> {
    const profile = await this.profileService.getProfileById(profileId)

    if (!profile) {
      console.warn(
        `Profile not found for ID: ${profileId} when creating response context.`,
      )
      return null
    }

    const logLength =
      profile.cognitiveModel.therapeuticProgress.sessionProgressLog.length
    const derivedSessionNumber = logLength > 0 ? logLength : 1

    const sessionNumber = currentSessionNumber ?? derivedSessionNumber

    const result: ResponseContext = {
      profile,
      styleConfig,
      ...(therapeuticFocus !== undefined && { therapeuticFocus }),
      sessionNumber,
    }

    return result
  }

  private _determineContextFromTherapistMessage(
    therapistMessageContent?: string,
  ): EmotionTransitionContext {
    if (!therapistMessageContent || therapistMessageContent.trim() === '') {
      return 'general_conversation' // Or perhaps 'session_start' if no prior message
    }
    const lowerMessage = therapistMessageContent.toLowerCase()

    // Simple keyword-based context detection (can be expanded)
    if (
      /\b(validate|validation|understand|empathize|makes sense|that's right|i hear you)\b/.test(
        lowerMessage,
      )
    ) {
      return 'therapist_validates'
    }
    if (
      /\b(reflect|reflection|so you're saying|it sounds like)\b/.test(
        lowerMessage,
      )
    ) {
      return 'therapist_reflects'
    }
    if (
      /\b(challenge|question|what if|have you considered|curious about|wonder if|but isn't it true)\b/.test(
        lowerMessage,
      )
    ) {
      return 'therapist_challenges'
    }
    if (
      /\b(trauma|painful|difficult experience|abuse|loss)\b/.test(
        lowerMessage,
      ) &&
      (lowerMessage.includes('you') || lowerMessage.includes('your'))
    ) {
      // If therapist refers to patient's trauma
      return 'patient_discusses_trauma'
    }
    // Add more rules for other contexts like 'therapist_empathizes', 'setback_experienced', etc.

    return 'general_conversation'
  }

  private async _updateAndRetrieveEmotionalState(
    profile: PatientProfile,
    styleConfig: PatientResponseStyleConfig, // To potentially get base emotion/intensity hints
    therapistLastMessage?: string,
  ): Promise<{
    updatedStyleConfig: PatientResponseStyleConfig
    newEmotionProfile: EmotionProfile
  }> {
    // Attempt to get "current" emotions. For now, this is a placeholder.
    // In a stateful system, this would come from a persisted current EmotionProfile.
    // Here, we'll try to derive from general patterns or start somewhat neutral.
    let currentEmotions: Record<string, number> | undefined = undefined
    // TECHDEBT(priority:medium): Replace this placeholder with actual retrieval of current emotional state if available
    // For example, from profile.cognitiveModel.therapeuticProgress.latestEmotionProfile?.emotions
    // If not available, start with a mix based on emotionalPatterns or a default neutral state.
    if (
      profile.cognitiveModel.emotionalPatterns &&
      profile.cognitiveModel.emotionalPatterns.length > 0
    ) {
      currentEmotions = {}
      profile.cognitiveModel.emotionalPatterns.forEach((p) => {
        // Initialize with a baseline intensity, scaling down from their typical pattern intensity
        currentEmotions![p.emotion.toLowerCase()] =
          p.intensity * BASELINE_INTENSITY_SCALE
      })
    }

    const context =
      this._determineContextFromTherapistMessage(therapistLastMessage)
    logger.debug(`Determined emotion transition context: ${context}`, {
      profileId: profile.id,
    })

    const synthesisOptions: EnhancedSynthesisOptions = {
      ...(currentEmotions && { currentEmotions }), // Only include if defined
      context: context,
      ...(styleConfig.primaryEmotion && {
        baseEmotion: styleConfig.primaryEmotion,
      }), // Only include if defined
      baseIntensity: styleConfig.emotionalIntensity, // Use hint from style config
      decayFactor: 0.85, // Example value
      contextInfluence: 0.15, // Example value
      randomFluctuation: 0.03, // Example value
    }

    const synthesisResult =
      await this.emotionSynthesizer.synthesizeEmotion(synthesisOptions)

    if (!synthesisResult.success) {
      logger.warn(
        'Failed to synthesize new emotional state, using current styleConfig defaults or last known state.',
        { profileId: profile.id, error: synthesisResult.message },
      )
      // Even when synthesis fails, EmotionSynthesizer provides a default profile in the result
      // Fallback to getCurrentProfile() or the public default method as safety nets
      // NOTE: Always use getDefaultEmotionProfile() - never access private methods directly
      const fallbackProfile =
        synthesisResult.profile ||
        this.emotionSynthesizer.getCurrentProfile() ||
        this.emotionSynthesizer.getDefaultEmotionProfile()
      return {
        updatedStyleConfig: styleConfig,
        newEmotionProfile: fallbackProfile,
      }
    }

    const newEmotionProfile = synthesisResult.profile
    logger.debug('New emotional state synthesized:', {
      profileId: profile.id,
      emotions: newEmotionProfile.emotions,
    })

    // Determine primary emotion and intensity from the new profile to update styleConfig
    let primaryEmotionFromSynth = 'neutral'
    let maxIntensity = 0
    if (
      newEmotionProfile.emotions &&
      Object.keys(newEmotionProfile.emotions).length > 0
    ) {
      for (const [emotion, intensity] of Object.entries(
        newEmotionProfile.emotions,
      )) {
        if (intensity > maxIntensity) {
          maxIntensity = intensity
          primaryEmotionFromSynth = emotion
        }
      }
    } else {
      // Fallback if emotions object is empty
      maxIntensity = 0.1 // Default to low intensity neutral
    }

    const updatedStyleConfig: PatientResponseStyleConfig = {
      ...styleConfig,
      primaryEmotion: primaryEmotionFromSynth,
      emotionalIntensity: maxIntensity, // Use the intensity of the new primary emotion
    }

    // TECHDEBT(priority:low): Persist newEmotionProfile to PatientProfile here if desired in future
    // e.g., profile.cognitiveModel.therapeuticProgress.latestEmotionProfile = newEmotionProfile;
    // This would require PatientProfileService to handle saving this.

    return { updatedStyleConfig, newEmotionProfile }
  }

  /**
   * Synthesize emotions based on patient response style and current context.
   * This method integrates with the EmotionSynthesizer to generate appropriate emotional profiles.
   * @param context Response context containing patient profile and style.
   * @param baseEmotion The base emotion to synthesize from.
   * @returns Promise<string> A description of the synthesized emotional state.
   */
  async synthesizeEmotionalContext(
    context: ResponseContext,
    baseEmotion: string,
  ): Promise<string> {
    const { styleConfig } = context

    try {
      const currentEmotions =
        this.emotionSynthesizer.getCurrentProfile()?.emotions
      const synthesisResult = await this.emotionSynthesizer.synthesizeEmotion({
        baseEmotion: styleConfig.primaryEmotion || baseEmotion,
        baseIntensity: styleConfig.emotionalIntensity,
        context: 'general_conversation',
        ...(currentEmotions && { currentEmotions }),
        decayFactor: 0.9,
        contextInfluence: 0.15,
        randomFluctuation: 0.03,
      })

      if (!synthesisResult.success) {
        console.warn(`Emotion synthesis failed: ${synthesisResult.message}`)
        return `Feeling ${baseEmotion} with moderate intensity.`
      }

      const { profile } = synthesisResult
      const dominantEmotions = Object.entries(profile.emotions)
        .filter(([, intensity]) => intensity > 0.3)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([emotion]) => emotion)

      // Generate contextual description based on emotional nuance setting
      switch (styleConfig.emotionalNuance) {
        case 'subtle':
          return `There's a subtle undercurrent of ${dominantEmotions[0]}, with hints of ${dominantEmotions.slice(1).join(' and ')}.`
        case 'overt':
          return `Clearly experiencing ${dominantEmotions[0]}, along with strong feelings of ${dominantEmotions.slice(1).join(' and ')}.`
        case 'suppressed':
          return `Trying to suppress feelings of ${dominantEmotions[0]}, though ${dominantEmotions.slice(1).join(' and ')} occasionally surface.`
        default:
          return `Experiencing a complex mix of ${dominantEmotions.join(', ')}.`
      }
    } catch (error: unknown) {
      console.error('Error synthesizing emotional context:', error)
      return `Feeling ${baseEmotion} with typical intensity.`
    }
  }

  /**
   * Get the current emotional profile from the emotion synthesizer.
   * IMPORTANT: This method uses proper encapsulation by calling public methods only.
   * @returns The current emotion profile or null if none exists.
   */
  getCurrentEmotionalProfile() {
    return this.emotionSynthesizer.getCurrentProfile()
  }

  /**
   * Get the default emotion profile using proper encapsulation.
   * This demonstrates the correct way to access the default profile.
   * @returns The default neutral emotion profile
   */
  getDefaultEmotionalProfile(): EmotionProfile {
    return this.emotionSynthesizer.getDefaultEmotionProfile()
  }

  /**
   * Reset emotional state - useful for starting new sessions.
   */
  resetEmotionalState() {
    this.emotionSynthesizer.reset()
  }

  /**
   * Generate a prompt string for an LLM to roleplay as the patient.
   * @param context Response context containing patient profile and style.
   * @returns string The generated prompt.
   */
  async generatePatientPrompt(context: ResponseContext): Promise<string> {
    // Made async
    const {
      profile,
      styleConfig: initialStyleConfig, // Rename to avoid confusion
      therapeuticFocus,
    } = context
    const { cognitiveModel, conversationHistory } = profile

    const therapistLastMessage = conversationHistory
      .filter((m) => m.role === 'therapist')
      .pop()?.content

    // Update emotional state and get updated styleConfig
    // Ensure initialStyleConfig is used here, and updatedStyleConfig is used later for the prompt
    const { updatedStyleConfig } = await this._updateAndRetrieveEmotionalState(
      profile,
      initialStyleConfig,
      therapistLastMessage,
    )
    // Now use 'updatedStyleConfig' for generating the prompt.

    let prompt = `You are roleplaying as ${cognitiveModel.name}, a patient with ${cognitiveModel.diagnosisInfo.primaryDiagnosis}.\n\n`

    prompt += `Your core beliefs include: ${cognitiveModel.coreBeliefs.map((b) => b.belief).join(', ')}.\n`
    prompt += `Your emotional patterns include: ${cognitiveModel.emotionalPatterns.map((e) => e.emotion).join(', ')}.\n\n`

    // Use updatedStyleConfig for the prompt details from here onwards
    prompt += `Your openness level is ${updatedStyleConfig.openness}/10. `
    prompt += `Your coherence level is ${updatedStyleConfig.coherence}/10. `
    prompt += `Your defense level is ${updatedStyleConfig.defenseLevel}/10. `
    prompt += `Your disclosure style is ${updatedStyleConfig.disclosureStyle}. `
    prompt += `You respond to challenges in a ${updatedStyleConfig.challengeResponses} way.\n`

    // Incorporate new emotional authenticity fields
    prompt += `Your emotional expression should be ${updatedStyleConfig.emotionalNuance}. `
    prompt += `The intensity of your expressed emotion should be around ${Number(updatedStyleConfig.emotionalIntensity * 10).toFixed(1)}/10. ` // Use Number().toFixed() for better float representation
    if (updatedStyleConfig.primaryEmotion) {
      prompt += `Focus on conveying ${updatedStyleConfig.primaryEmotion}. `
    }
    if (updatedStyleConfig.nonVerbalIndicatorStyle !== 'none') {
      prompt += `Include textual descriptions of non-verbal cues (e.g., *sighs*, *looks away*, *nods slowly*) in a style that is ${updatedStyleConfig.nonVerbalIndicatorStyle}. `
    }
    prompt += '\n'

    // Incorporate new resistance and defensive mechanism fields
    prompt += `Your resistance to therapeutic suggestions is ${updatedStyleConfig.resistanceLevel}/10. `
    if (updatedStyleConfig.activeDefensiveMechanism !== 'none') {
      prompt += `You are currently employing ${updatedStyleConfig.activeDefensiveMechanism} as a defensive mechanism. `
      if (updatedStyleConfig.activeDefensiveMechanism === 'deflection') {
        prompt +=
          'Try to subtly change the subject or avoid direct answers if the topic feels uncomfortable. '
      } else if (
        updatedStyleConfig.activeDefensiveMechanism === 'intellectualization'
      ) {
        prompt +=
          'Focus on abstract concepts and avoid expressing direct feelings. '
      } else if (
        updatedStyleConfig.activeDefensiveMechanism === 'minimization'
      ) {
        prompt += 'Downplay the importance of concerns raised. '
      } else if (updatedStyleConfig.activeDefensiveMechanism === 'denial') {
        prompt += 'Refuse to acknowledge uncomfortable truths or realities. '
      } else if (updatedStyleConfig.activeDefensiveMechanism === 'projection') {
        prompt +=
          'Attribute your own unacceptable feelings or thoughts to others, especially the therapist. '
      }
    }
    prompt += '\n'

    // Incorporate Therapeutic Alliance Metrics
    prompt += `Your current trust level in the therapist is ${cognitiveModel.therapeuticProgress.trustLevel}/10. `
    prompt += `Your rapport score with the therapist is ${cognitiveModel.therapeuticProgress.rapportScore}/10. `
    prompt += `You perceive the therapist as generally ${cognitiveModel.therapeuticProgress.therapistPerception}. `
    if (cognitiveModel.therapeuticProgress.transferenceState !== 'none') {
      prompt += `You are experiencing a ${cognitiveModel.therapeuticProgress.transferenceState} transference towards the therapist. This may strongly color your reactions. `
    }
    prompt +=
      "Let these factors influence your willingness to share, your emotional tone, and how you react to the therapist's interventions. "
    prompt +=
      'For example, higher trust and rapport might lead to more open and less defensive responses, while low trust or a negative therapist perception might lead to more guardedness or skepticism.\n\n'

    // Instruction for emotional transitions
    prompt +=
      "Consider your previous emotional state and the therapist's last statement when forming your response, allowing for natural emotional shifts or intensifications. "
    prompt +=
      'Maintain consistency with your established beliefs and history, but allow for emotional evolution within the conversation.\n\n'

    // Incorporate new emotional authenticity fields using updatedStyleConfig

    if (therapeuticFocus && therapeuticFocus.length > 0) {
      prompt += `The current therapeutic focus areas are: ${therapeuticFocus.join(', ')}.\n\n`
    }

    prompt += `This is session number ${context.sessionNumber}.\n\n`

    // Use a portion of conversation history for the prompt to keep it manageable.
    const historyForPrompt = conversationHistory.slice(-20)

    prompt += 'Recent conversation history:\n'
    for (const message of historyForPrompt) {
      const speaker =
        message.role === 'therapist'
          ? 'Therapist'
          : message.role === 'patient'
            ? cognitiveModel.name
            : 'System'
      prompt += `${speaker}: ${message.content}\n`
    }

    prompt += `\nRespond as ${cognitiveModel.name}:`

    return prompt
  }

  /**
   * Generates a response for the patient, attempting to maintain consistency.
   * If a direct contradiction is detected in a candidate response, it may
   * reframe the response to acknowledge the inconsistency therapeutically.
   *
   * NOTE: The actual generation of a candidate response (e.g., from an LLM)
   * is simplified here. In a real system, this would involve a call to an
   * external LLM service.
   *
   * @param context The response context.
   * @param getCandidateResponse A function that provides a candidate patient response.
   *                             This simulates fetching a response from an LLM.
   * @returns Promise<string> The final patient response, potentially modified for consistency.
   */
  async generateConsistentResponse(
    context: ResponseContext,
    getCandidateResponse: () => Promise<string> | string,
  ): Promise<string> {
    const candidateResponse = await getCandidateResponse()

    if (!context || !context.profile) {
      console.error('Invalid context provided to generateConsistentResponse.')
      return candidateResponse // Fallback or throw error
    }

    const consistencyResult =
      await this.consistencyService.checkBeliefConsistency(
        context.profile,
        candidateResponse,
      )

    if (consistencyResult.isConsistent) {
      return candidateResponse
    } else {
      if (consistencyResult.contradictionsFound.length === 0) {
        // Fallback if no specific contradictions are found but marked as inconsistent
        return candidateResponse
      }

      const firstContradiction = consistencyResult.contradictionsFound[0]

      // Add null check for firstContradiction
      if (!firstContradiction) {
        console.warn(
          'No contradiction details available, returning candidate response.',
        )
        return candidateResponse
      }

      let therapeuticResponse = `I find myself wanting to say, "${candidateResponse}". `
      therapeuticResponse += `It's interesting, because I also recall `
      if (firstContradiction.type === 'belief') {
        therapeuticResponse += `holding the belief that "${firstContradiction.conflictingText}". `
      } else {
        therapeuticResponse += `saying something like "${firstContradiction.conflictingText}" before. `
      }
      therapeuticResponse += `It feels a bit conflicting, doesn't it?`

      console.warn(
        `Consistency issue detected for profile ${context.profile.id}:
        Candidate: "${candidateResponse}"
        Conflict: "${firstContradiction.conflictingText}" (type: ${firstContradiction.type})
        Generated therapeutic response: "${therapeuticResponse}"`,
      )

      return therapeuticResponse
    }
  }

  /**
   * Analyzes therapist utterance for trust and rapport impact.
   * @param utterance The therapist's statement to analyze.
   * @returns Analysis result with trust/rapport changes and perception.
   */
  private analyzeTherapistUtterance(
    utterance: string,
  ): TherapistUtteranceAnalysis {
    const lowerUtterance = utterance.toLowerCase()
    let trustChange = 0
    let rapportChange = 0
    let perception = 'neutral'

    // Positive therapist actions (validation, empathy, understanding, support)
    if (
      /\b(validate|validation|understand|empathize|support|makes sense|that's right|i hear you)\b/.test(
        lowerUtterance,
      )
    ) {
      trustChange += ALLIANCE_ADJUSTMENTS.VALIDATION_TRUST_BOOST
      rapportChange += ALLIANCE_ADJUSTMENTS.VALIDATION_RAPPORT_BOOST
      perception = 'understanding'
      logger.info('[InterventionDetection] Detected: Validation/Support', {
        utterance,
      })
    }

    // Reflective statements (can build rapport)
    if (
      lowerUtterance.startsWith("so you're saying") ||
      lowerUtterance.startsWith('it sounds like')
    ) {
      rapportChange += ALLIANCE_ADJUSTMENTS.REFLECTION_RAPPORT_BOOST
      // Note: This might also be 'understanding' or a specific 'reflection' perception if desired.
      logger.info('[InterventionDetection] Detected: Reflection', { utterance })
    }

    // Gentle challenges or questions (can be neutral or slightly negative depending on patient state)
    if (
      /\b(what if|have you considered|curious about|wonder if)\b/.test(
        lowerUtterance,
      )
    ) {
      trustChange += ALLIANCE_ADJUSTMENTS.GENTLE_CHALLENGE_TRUST_PENALTY
      perception = 'challenging'
      logger.info(
        '[InterventionDetection] Detected: Gentle Challenge/Questioning',
        { utterance },
      )
    }

    // Stronger confrontation (more likely to decrease trust initially)
    if (
      /\b(but isn't it true|you need to|must accept|that's not realistic)\b/.test(
        lowerUtterance,
      )
    ) {
      trustChange += ALLIANCE_ADJUSTMENTS.CONFRONTATION_TRUST_PENALTY
      rapportChange += ALLIANCE_ADJUSTMENTS.CONFRONTATION_RAPPORT_PENALTY
      perception = 'challenging'
      logger.info('[InterventionDetection] Detected: Confrontation', {
        utterance,
      })
    }

    // Dismissive or invalidating therapist language
    if (
      /\b(don't worry|just relax|not a big deal|shouldn't feel that way)\b/.test(
        lowerUtterance,
      )
    ) {
      trustChange += ALLIANCE_ADJUSTMENTS.DISMISSIVE_TRUST_PENALTY
      rapportChange += ALLIANCE_ADJUSTMENTS.DISMISSIVE_RAPPORT_PENALTY
      perception = 'dismissive'
      logger.warn(
        '[InterventionDetection] Detected: Dismissive/Invalidating Language',
        { utterance },
      )
    }

    return { trustChange, rapportChange, perception }
  }

  /**
   * Analyzes patient utterance for trust and rapport impact.
   * @param utterance The patient's statement to analyze.
   * @param currentPerception Current perception of therapist.
   * @returns Analysis result with trust/rapport changes and updated perception.
   */
  private analyzePatientUtterance(
    utterance: string,
    currentPerception: string,
  ): PatientUtteranceAnalysis {
    const lowerUtterance = utterance.toLowerCase()
    let trustChange = 0
    let rapportChange = 0
    let updatedPerception = currentPerception

    // Patient expresses feeling understood, agreement, openness
    if (
      /\b(yes.{0,5}exactly|that's right|i agree|makes sense|feel understood|thank you|i appreciate)\b/.test(
        lowerUtterance,
      )
    ) {
      trustChange += ALLIANCE_ADJUSTMENTS.PATIENT_AGREEMENT_TRUST_BOOST
      rapportChange += ALLIANCE_ADJUSTMENTS.PATIENT_AGREEMENT_RAPPORT_BOOST

      // If therapist challenged and patient agrees, re-perceive as helpful challenge
      if (currentPerception === 'challenging') {
        updatedPerception = 'supportive'
      }
    }

    // Patient expresses disagreement, confusion, feeling misunderstood
    if (
      /\b(no.{0,5}but|but i|i don't think so|not really|confused|don't understand|that's not it)\b/.test(
        lowerUtterance,
      )
    ) {
      trustChange += ALLIANCE_ADJUSTMENTS.PATIENT_DISAGREEMENT_TRUST_PENALTY
      rapportChange += ALLIANCE_ADJUSTMENTS.PATIENT_DISAGREEMENT_RAPPORT_PENALTY

      // Don't overwrite if already perceived negatively
      if (currentPerception !== 'dismissive') {
        updatedPerception = 'confusing'
      }
    }

    // Patient expresses defensiveness or withdrawal
    if (
      /\b(i don't want to talk about it|leave me alone|whatever|fine)\b/.test(
        lowerUtterance,
      ) ||
      utterance.length < ALLIANCE_ADJUSTMENTS.SHORT_RESPONSE_THRESHOLD
    ) {
      trustChange += ALLIANCE_ADJUSTMENTS.PATIENT_DEFENSIVE_TRUST_PENALTY
      rapportChange += ALLIANCE_ADJUSTMENTS.PATIENT_DEFENSIVE_RAPPORT_PENALTY
    }

    return { trustChange, rapportChange, updatedPerception }
  }

  /**
   * Updates transference state based on utterances and current metrics.
   * @param therapistUtterance The therapist's statement.
   * @param patientUtterance The patient's statement.
   * @param currentState Current transference state.
   * @param trustLevel Current trust level.
   * @param rapportScore Current rapport score.
   * @param therapistPerception Current therapist perception.
   * @returns Updated transference state.
   */
  private updateTransferenceState(
    therapistUtterance: string,
    patientUtterance: string,
    currentState: string,
    trustLevel: number,
    rapportScore: number,
    therapistPerception: string,
  ): string {
    const lowerTherapist = therapistUtterance.toLowerCase()
    const lowerPatient = patientUtterance.toLowerCase()

    // Family-related transference triggers
    if (
      (lowerTherapist.includes('mother') ||
        lowerTherapist.includes('father')) &&
      lowerPatient.includes('just like my')
    ) {
      if (lowerPatient.includes('mother')) {
        return 'maternal'
      }
      if (lowerPatient.includes('father')) {
        return 'paternal'
      }
    }

    // Idealizing transference occurs based on sustained high rapport and supportive perception
    if (
      rapportScore > ALLIANCE_ADJUSTMENTS.HIGH_RAPPORT_THRESHOLD &&
      therapistPerception === 'supportive' &&
      trustLevel > ALLIANCE_ADJUSTMENTS.HIGH_TRUST_THRESHOLD
    ) {
      return 'positive-idealizing'
    }

    // Negative transference when trust is very low and therapist is perceived negatively
    if (
      trustLevel < ALLIANCE_ADJUSTMENTS.LOW_TRUST_THRESHOLD &&
      (therapistPerception === 'dismissive' ||
        therapistPerception === 'challenging')
    ) {
      return 'negative-critical'
    }

    return currentState
  }

  /**
   * Clamps a value between min and max bounds.
   * @param value The value to clamp.
   * @param min Minimum bound.
   * @param max Maximum bound.
   * @returns Clamped value.
   */
  private clampValue(value: number, min: number = 0, max: number = 10): number {
    return Math.max(min, Math.min(max, value))
  }

  /**
   * Validates if a string is a valid therapist perception value.
   * @param value The value to validate.
   * @returns True if the value is a valid TherapistPerception.
   */
  private isValidPerception(value: string): value is TherapistPerception {
    return [
      'understanding',
      'challenging',
      'dismissive',
      'supportive',
      'confusing',
      'neutral',
    ].includes(value)
  }

  /**
   * Validates if a string is a valid transference state value.
   * @param value The value to validate.
   * @returns True if the value is a valid TransferenceState.
   */
  private isValidTransferenceState(value: string): value is TransferenceState {
    return [
      'none',
      'maternal',
      'paternal',
      'positive-idealizing',
      'negative-critical',
    ].includes(value)
  }

  /**
   * Updates therapeutic alliance metrics based on therapist and patient utterances.
   * This implementation uses deterministic heuristics and configurable constants.
   * @param profile The patient's profile.
   * @param therapistUtterance The therapist's last statement.
   * @param patientUtterance The patient's last statement.
   * @returns The updated PatientProfile.
   */
  public updateTherapeuticAllianceMetrics(
    profile: PatientProfile,
    therapistUtterance: string,
    patientUtterance: string,
  ): PatientProfile {
    if (
      !profile ||
      !profile.cognitiveModel ||
      !profile.cognitiveModel.therapeuticProgress
    ) {
      console.error('Invalid profile for updateTherapeuticAllianceMetrics')
      return profile
    }

    // Create a deep copy to prevent mutation of the input profile
    const { therapeuticProgress } = profile.cognitiveModel
    const updatedTherapeuticProgress = { ...therapeuticProgress }

    // Initialize unset values to prevent NaN calculations
    if (!Number.isFinite(updatedTherapeuticProgress.trustLevel)) {
      updatedTherapeuticProgress.trustLevel =
        ALLIANCE_ADJUSTMENTS.DEFAULT_TRUST_LEVEL
    }
    if (!Number.isFinite(updatedTherapeuticProgress.rapportScore)) {
      updatedTherapeuticProgress.rapportScore =
        ALLIANCE_ADJUSTMENTS.DEFAULT_RAPPORT_SCORE
    }

    // Analyze therapist utterance for trust/rapport impact
    const therapistAnalysis = this.analyzeTherapistUtterance(therapistUtterance)

    // Update therapist perception based on analysis
    if (
      therapistAnalysis.perception !== 'neutral' &&
      this.isValidPerception(therapistAnalysis.perception)
    ) {
      updatedTherapeuticProgress.therapistPerception =
        therapistAnalysis.perception
    }

    // Analyze patient utterance for trust/rapport impact
    const patientAnalysis = this.analyzePatientUtterance(
      patientUtterance,
      updatedTherapeuticProgress.therapistPerception,
    )

    // Update therapist perception based on patient analysis
    if (
      patientAnalysis.updatedPerception !==
        updatedTherapeuticProgress.therapistPerception &&
      this.isValidPerception(patientAnalysis.updatedPerception)
    ) {
      updatedTherapeuticProgress.therapistPerception =
        patientAnalysis.updatedPerception
    }

    // Calculate total changes from both analyses
    const totalTrustChange =
      therapistAnalysis.trustChange + patientAnalysis.trustChange
    const totalRapportChange =
      therapistAnalysis.rapportChange + patientAnalysis.rapportChange

    // Apply changes and clamp values
    updatedTherapeuticProgress.trustLevel = this.clampValue(
      updatedTherapeuticProgress.trustLevel + totalTrustChange,
    )
    updatedTherapeuticProgress.rapportScore = this.clampValue(
      updatedTherapeuticProgress.rapportScore + totalRapportChange,
    )

    // Update transference state using helper method
    const newTransferenceState = this.updateTransferenceState(
      therapistUtterance,
      patientUtterance,
      updatedTherapeuticProgress.transferenceState,
      updatedTherapeuticProgress.trustLevel,
      updatedTherapeuticProgress.rapportScore,
      updatedTherapeuticProgress.therapistPerception,
    )

    if (this.isValidTransferenceState(newTransferenceState)) {
      updatedTherapeuticProgress.transferenceState = newTransferenceState
    }

    const updatedProfile: PatientProfile = {
      ...profile,
      cognitiveModel: {
        ...profile.cognitiveModel,
        therapeuticProgress: updatedTherapeuticProgress,
      },
      lastUpdatedAt: new Date().toISOString(),
    }

    return updatedProfile
  }
}

/**
 * Factory function to create PatientResponseService with dependencies.
 * This demonstrates the dependency injection pattern and provides a centralized
 * way to configure service dependencies.
 *
 * @param options Configuration options for the service
 * @returns Configured PatientResponseService instance
 */
export function createPatientResponseService(options?: {
  profileService?: PatientProfileService
  consistencyService?: BeliefConsistencyService
  emotionSynthesizer?: EmotionSynthesizer
}): PatientResponseService {
  // For the factory function, we'll require these to be provided since we can't create them without dependencies
  if (!options?.profileService) {
    throw new Error(
      'profileService is required - create one with appropriate KVStore dependency',
    )
  }

  const {
    profileService,
    consistencyService = new BeliefConsistencyService(),
    emotionSynthesizer = EmotionSynthesizer.getInstance(),
  } = options

  return new PatientResponseService(
    profileService,
    consistencyService,
    emotionSynthesizer,
  )
}

/**
 * Factory function specifically for testing that provides isolated instances.
 * This avoids singleton dependencies and allows for better test isolation.
 *
 * @param testDependencies Test-specific dependencies
 * @returns PatientResponseService instance configured for testing
 */
export function createTestPatientResponseService(testDependencies?: {
  profileService?: PatientProfileService
  consistencyService?: BeliefConsistencyService
  emotionSynthesizer?: EmotionSynthesizer
}): PatientResponseService {
  // For test function, we'll also require these to be provided since we can't create them without dependencies
  if (!testDependencies?.profileService) {
    throw new Error(
      'profileService is required for testing - provide a mock or test instance',
    )
  }

  const {
    profileService,
    consistencyService = new BeliefConsistencyService(),
    emotionSynthesizer = EmotionSynthesizer.createTestInstance(),
  } = testDependencies

  return new PatientResponseService(
    profileService,
    consistencyService,
    emotionSynthesizer,
  )
}
