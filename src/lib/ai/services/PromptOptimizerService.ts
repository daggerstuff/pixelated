/**
 * PromptOptimizerService - Optimize prompts and create conversation summaries
 *
 * This service optimizes AI prompts for therapeutic contexts and provides
 * conversation summarization capabilities.
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type { EmotionAnalysis } from '../emotions/types'

const logger = createBuildSafeLogger('PromptOptimizerService')

export interface ConversationSummary {
  sessionId: string
  summary: string
  keyTopics: string[]
  emotionalJourney: {
    initial: EmotionAnalysis
    final: EmotionAnalysis
    keyTransitions: Array<{
      timestamp: string
      from: string
      to: string
      trigger?: string
    }>
  }
  interventions: Array<{
    type: string
    description: string
    effectiveness: number
    timestamp: string
  }>
  insights: string[]
  recommendations: string[]
  riskFactors: string[]
  progressMetrics: {
    overallImprovement: number
    engagementLevel: number
    stabilityScore: number
  }
  timestamp: string
}

export interface PromptOptimization {
  originalPrompt: string
  optimizedPrompt: string
  optimizationStrategy: string
  confidenceScore: number
  reasoning: string[]
  therapeuticContext: {
    sessionPhase: 'opening' | 'exploration' | 'intervention' | 'closure'
    patientState: 'receptive' | 'defensive' | 'distressed' | 'engaged'
    primaryConcern: string
  }
  timestamp: string
}

export interface ConversationContext {
  sessionId: string
  messages: Array<{
    role: 'therapist' | 'patient' | 'system'
    content: string
    timestamp: string
    emotions?: EmotionAnalysis
  }>
  interventions: Array<{
    type: string
    description: string
    timestamp: string
    outcome?: string
  }>
  sessionMetadata: {
    startTime: string
    duration: number
    sessionType: string
    goals: string[]
  }
}

/**
 * Service for optimizing prompts and creating conversation summaries
 */
export class PromptOptimizerService {
  private static instance: PromptOptimizerService
  private optimizationHistory: Map<string, PromptOptimization[]> = new Map()
  private summaryCache: Map<string, ConversationSummary> = new Map()

  private constructor() {
    logger.info('PromptOptimizerService initialized')
  }

  public static getInstance(): PromptOptimizerService {
    if (!PromptOptimizerService.instance) {
      PromptOptimizerService.instance = new PromptOptimizerService()
    }
    return PromptOptimizerService.instance
  }

  /**
   * Create a comprehensive conversation summary
   */
  async createConversationSummary(
    context: ConversationContext,
  ): Promise<ConversationSummary> {
    try {
      logger.info('Creating conversation summary', {
        sessionId: context.sessionId,
      })

      // Check cache first
      if (this.summaryCache.has(context.sessionId)) {
        const cached = this.summaryCache.get(context.sessionId)!
        logger.debug('Returning cached summary', {
          sessionId: context.sessionId,
        })
        return cached
      }

      // Extract key information from conversation
      const keyTopics = this.extractKeyTopics(context.messages)
      const emotionalJourney = this.analyzeEmotionalJourney(context.messages)
      const interventionAnalysis = this.analyzeInterventions(
        context.interventions,
      )
      const insights = this.generateInsights(context)
      const recommendations = this.generateRecommendations(
        context,
        emotionalJourney,
      )
      const riskFactors = this.identifyRiskFactors(context, emotionalJourney)
      const progressMetrics = this.calculateProgressMetrics(context)

      // Generate comprehensive summary
      const summary = this.generateNarrativeSummary(
        context,
        keyTopics,
        emotionalJourney,
        interventionAnalysis,
      )

      const conversationSummary: ConversationSummary = {
        sessionId: context.sessionId,
        summary,
        keyTopics,
        emotionalJourney,
        interventions: interventionAnalysis,
        insights,
        recommendations,
        riskFactors,
        progressMetrics,
        timestamp: new Date().toISOString(),
      }

      // Cache the summary
      this.summaryCache.set(context.sessionId, conversationSummary)

      return conversationSummary
    } catch (error: unknown) {
      logger.error('Error creating conversation summary', { error })
      throw new Error(`Failed to create conversation summary: ${error}`, { cause: error })
    }
  }

  /**
   * Optimize a prompt for therapeutic context
   */
  async optimizePrompt(
    prompt: string,
    context: {
      sessionPhase: 'opening' | 'exploration' | 'intervention' | 'closure'
      patientState: 'receptive' | 'defensive' | 'distressed' | 'engaged'
      primaryConcern: string
      recentEmotions?: EmotionAnalysis
    },
  ): Promise<PromptOptimization> {
    try {
      logger.info('Optimizing prompt', {
        sessionPhase: context.sessionPhase,
        patientState: context.patientState,
      })

      const optimizationStrategy = this.selectOptimizationStrategy(context)
      const optimizedPrompt = this.applyOptimization(
        prompt,
        optimizationStrategy,
        context,
      )
      const reasoning = this.generateOptimizationReasoning(
        prompt,
        optimizedPrompt,
        context,
      )
      const confidenceScore = this.calculateOptimizationConfidence(
        context,
        reasoning,
      )

      const optimization: PromptOptimization = {
        originalPrompt: prompt,
        optimizedPrompt,
        optimizationStrategy,
        confidenceScore,
        reasoning,
        therapeuticContext: context,
        timestamp: new Date().toISOString(),
      }

      // Store optimization history
      const sessionKey = `${context.sessionPhase}_${context.patientState}`
      if (!this.optimizationHistory.has(sessionKey)) {
        this.optimizationHistory.set(sessionKey, [])
      }
      this.optimizationHistory.get(sessionKey)!.push(optimization)

      return optimization
    } catch (error: unknown) {
      logger.error('Error optimizing prompt', { error })
      throw new Error(`Failed to optimize prompt: ${error}`, { cause: error })
    }
  }

  /**
   * Extract key topics from conversation messages
   */
  private extractKeyTopics(
    messages: ConversationContext['messages'],
  ): string[] {
    const topics = new Set<string>()

    // Common therapeutic topics
    const topicPatterns = {
      'anxiety': ['anxious', 'worried', 'nervous', 'panic', 'stress'],
      'depression': ['sad', 'depressed', 'down', 'hopeless', 'empty'],
      'relationships': [
        'relationship',
        'partner',
        'family',
        'friend',
        'conflict',
      ],
      'work': ['job', 'work', 'career', 'boss', 'colleague', 'workplace'],
      'self-esteem': [
        'confidence',
        'self-worth',
        'doubt',
        'insecure',
        'worthless',
      ],
      'trauma': ['trauma', 'abuse', 'ptsd', 'flashback', 'trigger'],
      'coping': ['coping', 'manage', 'handle', 'deal with', 'strategy'],
      'goals': ['goal', 'want', 'hope', 'plan', 'future', 'change'],
      'medication': ['medication', 'pills', 'therapy', 'treatment', 'doctor'],
      'sleep': ['sleep', 'insomnia', 'tired', 'exhausted', 'rest'],
    }

    messages.forEach((message) => {
      if (message.role === 'patient') {
        const content = message.content.toLowerCase()

        Object.entries(topicPatterns).forEach(([topic, keywords]) => {
          if (keywords.some((keyword) => content.includes(keyword))) {
            topics.add(topic)
          }
        })
      }
    })

    return Array.from(topics)
  }

  /**
   * Analyze emotional journey throughout conversation
   */
  private analyzeEmotionalJourney(
    messages: ConversationContext['messages'],
  ): ConversationSummary['emotionalJourney'] {
    const emotionalMessages = messages.filter((m) => m.emotions)

    if (emotionalMessages.length === 0) {
      // Create placeholder emotions if none available
      const neutralEmotion: EmotionAnalysis = {
        id: 'placeholder',
        sessionId: 'unknown',
        timestamp: new Date().toISOString(),
        emotions: {
          joy: 0,
          sadness: 0,
          anger: 0,
          fear: 0,
          surprise: 0,
          disgust: 0,
          trust: 0.5,
          anticipation: 0,
        },
        dimensions: { valence: 0, arousal: 0, dominance: 0 },
        confidence: 0.5,
      }

      return {
        initial: neutralEmotion,
        final: neutralEmotion,
        keyTransitions: [],
      }
    }

    const initial = emotionalMessages[0].emotions!
    const final = emotionalMessages[emotionalMessages.length - 1].emotions!

    // Identify key emotional transitions
    const keyTransitions: ConversationSummary['emotionalJourney']['keyTransitions'] =
      []

    for (let i = 1; i < emotionalMessages.length; i++) {
      const prev = emotionalMessages[i - 1].emotions!
      const curr = emotionalMessages[i].emotions!

      // Check for significant valence changes
      const valenceChange = curr.dimensions.valence - prev.dimensions.valence

      if (Math.abs(valenceChange) > 0.3) {
        const from = valenceChange < 0 ? 'positive' : 'negative'
        const to = valenceChange < 0 ? 'negative' : 'positive'

        keyTransitions.push({
          timestamp: curr.timestamp,
          from,
          to,
          trigger: this.identifyTransitionTrigger(
            emotionalMessages[i - 1],
            emotionalMessages[i],
          ),
        })
      }
    }

    return {
      initial,
      final,
      keyTransitions,
    }
  }

  /**
   * Identify what triggered an emotional transition
   */
  private identifyTransitionTrigger(
    prevMessage: ConversationContext['messages'][0],
    currMessage: ConversationContext['messages'][0],
  ): string {
    // Analyze the content between messages to identify triggers
    const content = currMessage.content.toLowerCase()

    const triggers = {
      therapeutic_technique: [
        'breathing',
        'mindfulness',
        'reframe',
        'technique',
      ],
      insight: ['realize', 'understand', 'see', 'clarity', 'makes sense'],
      validation: ['valid', 'normal', 'understandable', 'support'],
      challenge: ['challenge', 'question', 'different', 'perspective'],
      memory: ['remember', 'past', 'childhood', 'before'],
      goal_setting: ['goal', 'plan', 'step', 'action', 'future'],
    }

    for (const [trigger, keywords] of Object.entries(triggers)) {
      if (keywords.some((keyword) => content.includes(keyword))) {
        return trigger
      }
    }

    return 'unknown'
  }

  /**
   * Analyze interventions used in the session
   */
  private analyzeInterventions(
    interventions: ConversationContext['interventions'],
  ): ConversationSummary['interventions'] {
    return interventions.map((intervention) => ({
      type: intervention.type,
      description: intervention.description,
      effectiveness: this.estimateInterventionEffectiveness(intervention),
      timestamp: intervention.timestamp,
    }))
  }

  /**
   * Estimate intervention effectiveness based on outcomes
   */
  private estimateInterventionEffectiveness(
    intervention: ConversationContext['interventions'][0],
  ): number {
    if (!intervention.outcome) {
      return 0.5 // Default neutral effectiveness
    }

    const outcome = intervention.outcome.toLowerCase()

    // Positive outcome indicators
    const positiveIndicators = [
      'better',
      'helpful',
      'improved',
      'clearer',
      'good',
      'worked',
    ]
    const negativeIndicators = [
      'worse',
      'difficult',
      'unhelpful',
      'confused',
      'bad',
      'failed',
    ]

    let score = 0.5

    positiveIndicators.forEach((indicator) => {
      if (outcome.includes(indicator)) score += 0.1
    })

    negativeIndicators.forEach((indicator) => {
      if (outcome.includes(indicator)) score -= 0.1
    })

    return Math.max(0, Math.min(1, score))
  }

  /**
   * Generate insights from conversation analysis
   */
  private generateInsights(context: ConversationContext): string[] {
    const insights: string[] = []

    // Analyze conversation patterns
    const patientMessages = context.messages.filter((m) => m.role === 'patient')
    const avgMessageLength =
      patientMessages.reduce((sum, m) => sum + m.content.length, 0) /
      patientMessages.length

    if (avgMessageLength > 200) {
      insights.push(
        'Patient demonstrates good verbal engagement with detailed responses',
      )
    } else if (avgMessageLength < 50) {
      insights.push(
        'Patient responses are brief - may indicate discomfort or disengagement',
      )
    }

    // Analyze intervention variety
    const interventionTypes = new Set(context.interventions.map((i) => i.type))
    if (interventionTypes.size > 3) {
      insights.push(
        'Multiple intervention approaches used - suggests adaptive therapeutic style',
      )
    }

    // Analyze session duration patterns
    if (context.sessionMetadata.duration > 60) {
      insights.push(
        'Extended session duration may indicate complex issues or high engagement',
      )
    }

    return insights
  }

  /**
   * Generate recommendations based on conversation analysis
   */
  private generateRecommendations(
    context: ConversationContext,
    emotionalJourney: ConversationSummary['emotionalJourney'],
  ): string[] {
    const recommendations: string[] = []

    // Emotional trajectory recommendations
    const valenceChange =
      emotionalJourney.final.dimensions.valence -
      emotionalJourney.initial.dimensions.valence

    if (valenceChange < -0.2) {
      recommendations.push(
        'Consider crisis assessment - emotional state declined during session',
      )
      recommendations.push('Schedule follow-up within 24-48 hours')
    } else if (valenceChange > 0.3) {
      recommendations.push(
        'Continue current therapeutic approach - positive emotional progress observed',
      )
    }

    // Engagement recommendations
    const patientMessages = context.messages.filter((m) => m.role === 'patient')
    if (patientMessages.length < 5) {
      recommendations.push(
        'Focus on increasing patient engagement in future sessions',
      )
    }

    // Intervention recommendations
    const effectiveInterventions = context.interventions.filter(
      (i) => i.outcome && i.outcome.toLowerCase().includes('helpful'),
    )

    if (effectiveInterventions.length > 0) {
      recommendations.push(
        `Continue using ${effectiveInterventions[0].type} interventions - showed positive results`,
      )
    }

    return recommendations
  }

  /**
   * Identify risk factors from conversation
   */
  private identifyRiskFactors(
    context: ConversationContext,
    emotionalJourney: ConversationSummary['emotionalJourney'],
  ): string[] {
    const riskFactors: string[] = []

    // High-risk keywords
    const riskKeywords = [
      'suicide',
      'self-harm',
      'hurt myself',
      'end it all',
      'no point',
      'give up',
    ]
    const conversationText = context.messages
      .map((m) => m.content)
      .join(' ')
      .toLowerCase()

    riskKeywords.forEach((keyword) => {
      if (conversationText.includes(keyword)) {
        riskFactors.push(`High-risk language detected: ${keyword}`)
      }
    })

    // Emotional risk factors
    const finalEmotion = emotionalJourney.final
    const highNegativeEmotions =
      finalEmotion.emotions.sadness +
      finalEmotion.emotions.anger +
      finalEmotion.emotions.fear

    if (highNegativeEmotions > 1.5) {
      riskFactors.push('High levels of negative emotions at session end')
    }

    if (finalEmotion.dimensions.dominance < -0.6) {
      riskFactors.push('Low sense of control/power - may indicate helplessness')
    }

    return riskFactors
  }

  /**
   * Calculate progress metrics
   */
  private calculateProgressMetrics(
    context: ConversationContext,
  ): ConversationSummary['progressMetrics'] {
    const patientMessages = context.messages.filter((m) => m.role === 'patient')
    const emotionalMessages = context.messages.filter((m) => m.emotions)

    // Overall improvement based on emotional journey
    let overallImprovement = 0.5
    if (emotionalMessages.length >= 2) {
      const initial = emotionalMessages[0].emotions!
      const final = emotionalMessages[emotionalMessages.length - 1].emotions!
      overallImprovement =
        (final.dimensions.valence - initial.dimensions.valence + 1) / 2
    }

    // Engagement level based on message frequency and length
    const engagementLevel =
      Math.min(1, patientMessages.length * 0.1) *
      Math.min(
        1,
        patientMessages.reduce((sum, m) => sum + m.content.length, 0) / 1000,
      )

    // Stability based on emotional variance
    let stabilityScore = 0.5
    if (emotionalMessages.length > 2) {
      const valences = emotionalMessages.map(
        (m) => m.emotions!.dimensions.valence,
      )
      const variance = this.calculateVariance(valences)
      stabilityScore = Math.max(0, 1 - variance)
    }

    return {
      overallImprovement: Math.max(0, Math.min(1, overallImprovement)),
      engagementLevel: Math.max(0, Math.min(1, engagementLevel)),
      stabilityScore: Math.max(0, Math.min(1, stabilityScore)),
    }
  }

  /**
   * Calculate variance for stability metrics
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
  }

  /**
   * Generate narrative summary
   */
  private generateNarrativeSummary(
    context: ConversationContext,
    keyTopics: string[],
    emotionalJourney: ConversationSummary['emotionalJourney'],
    interventions: ConversationSummary['interventions'],
  ): string {
    const sessionDuration = Math.round(context.sessionMetadata.duration)
    const topicsList =
      keyTopics.length > 0 ? keyTopics.join(', ') : 'general discussion'

    const valenceChange =
      emotionalJourney.final.dimensions.valence -
      emotionalJourney.initial.dimensions.valence
    const emotionalDirection =
      valenceChange > 0.1
        ? 'improved'
        : valenceChange < -0.1
          ? 'declined'
          : 'remained stable'

    const effectiveInterventions = interventions.filter(
      (i) => i.effectiveness > 0.6,
    )
    const interventionSummary =
      effectiveInterventions.length > 0
        ? `Effective interventions included ${effectiveInterventions.map((i) => i.type).join(', ')}.`
        : 'Interventions showed mixed results.'

    return (
      `${sessionDuration}-minute session focusing on ${topicsList}. ` +
      `Patient's emotional state ${emotionalDirection} throughout the session. ` +
      `${interventionSummary} ` +
      `${emotionalJourney.keyTransitions.length} significant emotional transitions were observed.`
    )
  }

  /**
   * Select optimization strategy based on context
   */
  private selectOptimizationStrategy(
    context: PromptOptimization['therapeuticContext'],
  ): string {
    const { sessionPhase, patientState, _primaryConcern } = context

    // Strategy selection logic
    if (patientState === 'distressed') {
      return 'stabilization_focused'
    } else if (patientState === 'defensive') {
      return 'non_confrontational'
    } else if (sessionPhase === 'opening') {
      return 'rapport_building'
    } else if (sessionPhase === 'intervention') {
      return 'technique_focused'
    } else if (sessionPhase === 'closure') {
      return 'consolidation_focused'
    } else {
      return 'adaptive_exploration'
    }
  }

  /**
   * Apply optimization to prompt
   */
  private applyOptimization(
    prompt: string,
    strategy: string,
    context: PromptOptimization['therapeuticContext'],
  ): string {
    let optimized = prompt

    switch (strategy) {
      case 'stabilization_focused':
        optimized = this.addStabilizationElements(prompt)
        break
      case 'non_confrontational':
        optimized = this.softenLanguage(prompt)
        break
      case 'rapport_building':
        optimized = this.addRapportElements(prompt)
        break
      case 'technique_focused':
        optimized = this.emphasizeTechniques(prompt, context.primaryConcern)
        break
      case 'consolidation_focused':
        optimized = this.addConsolidationElements(prompt)
        break
      default:
        optimized = this.addGeneralOptimizations(prompt)
    }

    return optimized
  }

  /**
   * Add stabilization elements to prompt
   */
  private addStabilizationElements(prompt: string): string {
    const stabilizingPhrases = [
      'Take your time with this',
      "There's no pressure to get this perfect",
      "Let's go at a pace that feels comfortable for you",
    ]

    const randomPhrase =
      stabilizingPhrases[Math.floor(Math.random() * stabilizingPhrases.length)]
    return `${randomPhrase}. ${prompt}`
  }

  /**
   * Soften confrontational language
   */
  private softenLanguage(prompt: string): string {
    return prompt
      .replace(/\byou should\b/gi, 'you might consider')
      .replace(/\byou need to\b/gi, 'it could be helpful to')
      .replace(/\byou must\b/gi, 'you might want to')
      .replace(/\bwhy did you\b/gi, "I'm curious about what led you to")
  }

  /**
   * Add rapport building elements
   */
  private addRapportElements(prompt: string): string {
    const rapportPhrases = [
      'I appreciate you sharing that with me',
      'Thank you for being open about this',
      'I can see this is important to you',
    ]

    const randomPhrase =
      rapportPhrases[Math.floor(Math.random() * rapportPhrases.length)]
    return `${randomPhrase}. ${prompt}`
  }

  /**
   * Emphasize therapeutic techniques
   */
  private emphasizeTechniques(prompt: string, primaryConcern: string): string {
    const techniqueMap: Record<string, string> = {
      anxiety: "Let's try a grounding technique together",
      depression: 'What would be one small step you could take?',
      relationships: 'How might you communicate this differently?',
      trauma: "Let's make sure you feel safe as we explore this",
    }

    const techniquePrompt =
      techniqueMap[primaryConcern] ||
      'What strategies have worked for you before?'
    return `${prompt} ${techniquePrompt}`
  }

  /**
   * Add consolidation elements
   */
  private addConsolidationElements(prompt: string): string {
    const consolidationPhrases = [
      'As we wrap up today',
      'Before we finish',
      "To summarize what we've discussed",
    ]

    const randomPhrase =
      consolidationPhrases[
        Math.floor(Math.random() * consolidationPhrases.length)
      ]
    return `${randomPhrase}, ${prompt.toLowerCase()}`
  }

  /**
   * Add general optimizations
   */
  private addGeneralOptimizations(prompt: string): string {
    // Add person-centered language
    return prompt
      .replace(/\bthe patient\b/gi, 'you')
      .replace(/\bpatients\b/gi, 'people')
      .replace(/\bdisorder\b/gi, 'experience')
  }

  /**
   * Generate reasoning for optimization
   */
  private generateOptimizationReasoning(
    original: string,
    optimized: string,
    context: PromptOptimization['therapeuticContext'],
  ): string[] {
    const reasoning: string[] = []

    if (optimized.length > original.length) {
      reasoning.push(
        'Added supportive language to increase therapeutic rapport',
      )
    }

    if (context.patientState === 'distressed') {
      reasoning.push(
        'Incorporated stabilization techniques for distressed patient state',
      )
    }

    if (context.sessionPhase === 'opening') {
      reasoning.push('Enhanced rapport-building elements for session opening')
    }

    if (
      optimized.includes('take your time') ||
      optimized.includes('no pressure')
    ) {
      reasoning.push('Reduced pressure and time constraints to improve comfort')
    }

    return reasoning.length > 0
      ? reasoning
      : ['Applied general therapeutic communication principles']
  }

  /**
   * Calculate optimization confidence
   */
  private calculateOptimizationConfidence(
    context: PromptOptimization['therapeuticContext'],
    reasoning: string[],
  ): number {
    let confidence = 0.5 // Base confidence

    // Increase confidence based on context specificity
    if (context.primaryConcern && context.primaryConcern !== 'unknown') {
      confidence += 0.2
    }

    // Note: recentEmotions not available in current context interface
    // This could be added in future iterations

    // Increase confidence based on reasoning quality
    confidence += reasoning.length * 0.05

    return Math.min(1, confidence)
  }

  /**
   * Clear cache for memory management
   */
  clearCache(): void {
    this.summaryCache.clear()
    this.optimizationHistory.clear()
    logger.info('PromptOptimizerService cache cleared')
  }
}

// Export singleton instance
export const promptOptimizerService = PromptOptimizerService.getInstance()
