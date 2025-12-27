import { SessionContext, TherapeuticProgress } from '../types/context'
import { EmotionState } from '../types/emotional'

export class RealTimeAnalyzer {
  /**
   * Real-time analysis of therapeutic progress
   */
  async analyzeProgress(
    sessionContext: SessionContext,
  ): Promise<TherapeuticProgress> {
    try {
      const emotionalProgress = this.analyzeEmotionalRegulation(sessionContext)
      const allianceProgress = this.analyzeTherapeuticAlliance(sessionContext)
      const engagementProgress = this.analyzeEngagement(sessionContext)
      const crisisFrequency = this.analyzeCrisisPatterns(sessionContext)
      const goalProgress = this.analyzeGoalAchievement(sessionContext)
      const consistency = this.analyzeSessionConsistency(sessionContext)

      return {
        emotionalRegulation: emotionalProgress,
        therapeuticAlliance: allianceProgress,
        treatmentEngagement: engagementProgress,
        crisisFrequency,
        goalAchievement: goalProgress,
        sessionConsistency: consistency,
        goals: sessionContext.patientProfile.therapeuticGoals || [],
      }
    } catch (error) {
      console.error('Progress analysis failed:', error)
      throw new Error(`Failed to analyze progress: ${error}`)
    }
  }

  /**
   * Analyze emotional regulation progress
   */
  private analyzeEmotionalRegulation(context: SessionContext): number {
    const { currentState, baselineState, historicalContext } = context

    // Calculate emotional stability over time
    const stability = this.calculateEmotionalStability(historicalContext)
    const intensityReduction = this.calculateIntensityReduction(
      currentState,
      baselineState,
    )
    const valenceImprovement = this.calculateValenceImprovement(
      currentState,
      baselineState,
    )

    return Math.min(
      1.0,
      (stability + intensityReduction + valenceImprovement) / 3,
    )
  }

  /**
   * Analyze therapeutic alliance strength
   */
  private analyzeTherapeuticAlliance(context: SessionContext): number {
    const { conversationHistory, historicalContext } = context

    // Analyze communication patterns
    const rapportIndicators =
      this.identifyRapportIndicators(conversationHistory)
    const trustSignals = this.identifyTrustSignals(conversationHistory)
    const collaborationLevel = this.assessCollaboration(historicalContext)

    return Math.min(
      1.0,
      (rapportIndicators + trustSignals + collaborationLevel) / 3,
    )
  }

  /**
   * Analyze treatment engagement
   */
  private analyzeEngagement(context: SessionContext): number {
    const { conversationHistory, sessionDuration } = context

    const participationLevel =
      this.calculateParticipationLevel(conversationHistory)
    const sessionCompletion = Math.min(sessionDuration / 3600000, 1.0) // Normalize to 1 hour
    const responsiveness = this.calculateResponsiveness(conversationHistory)

    return Math.min(
      1.0,
      (participationLevel + sessionCompletion + responsiveness) / 3,
    )
  }

  /**
   * Analyze crisis patterns
   */
  private analyzeCrisisPatterns(context: SessionContext): number {
    const { historicalContext } = context

    if (historicalContext.length === 0) return 0.2 // Default baseline

    const crisisSessions = historicalContext.filter(
      (hc) => hc.crisisIndicators && hc.crisisIndicators.length > 0,
    ).length

    return Math.min(1.0, crisisSessions / historicalContext.length)
  }

  /**
   * Analyze goal achievement progress
   */
  private analyzeGoalAchievement(context: SessionContext): number {
    const { patientProfile, historicalContext } = context
    const goals = patientProfile.therapeuticGoals || []

    if (goals.length === 0) return 0.1 // Default if no goals set

    const achievedGoals = goals.filter((goal) =>
      this.checkGoalProgress(goal, historicalContext),
    ).length

    return Math.min(1.0, achievedGoals / goals.length)
  }

  /**
   * Analyze session consistency
   */
  private analyzeSessionConsistency(context: SessionContext): number {
    const { historicalContext } = context

    if (historicalContext.length < 2) return 0.8 // Default for new patients

    const intervals = this.calculateSessionIntervals(historicalContext)
    const consistency = this.assessConsistencyPattern(intervals)

    return Math.min(1.0, consistency)
  }

  /**
   * Calculate emotional stability over time
   */
  private calculateEmotionalStability(
    historicalContext: SessionContext[],
  ): number {
    if (historicalContext.length === 0) return 0.5

    const intensities = historicalContext.map((hc) => hc.currentState.intensity)
    const valences = historicalContext.map((hc) => hc.currentState.valence)

    const intensityVariance = this.calculateVariance(intensities)
    const valenceVariance = this.calculateVariance(valences)

    // Lower variance = higher stability
    const stability = 1.0 - (intensityVariance + valenceVariance) / 2
    return Math.max(0, stability)
  }

  /**
   * Calculate intensity reduction
   */
  private calculateIntensityReduction(
    current: EmotionState,
    baseline: EmotionState,
  ): number {
    const reduction = baseline.intensity - current.intensity
    return Math.max(0, Math.min(1, reduction + 0.5))
  }

  /**
   * Calculate valence improvement
   */
  private calculateValenceImprovement(
    current: EmotionState,
    baseline: EmotionState,
  ): number {
    const improvement = current.valence - baseline.valence
    return Math.max(0, Math.min(1, (improvement + 1) / 2))
  }

  /**
   * Identify rapport indicators in conversation
   */
  private identifyRapportIndicators(conversation: string[]): number {
    const rapportWords = [
      'understand',
      'help',
      'support',
      'together',
      'we',
      'us',
    ]
    const totalWords = conversation.join(' ').toLowerCase()

    const matches = rapportWords.filter((word) =>
      totalWords.includes(word),
    ).length
    return Math.min(1.0, matches / rapportWords.length)
  }

  /**
   * Identify trust signals in conversation
   */
  private identifyTrustSignals(conversation: string[]): number {
    const trustIndicators = [
      'trust',
      'believe',
      'confide',
      'honest',
      'real',
      'true',
    ]
    const totalWords = conversation.join(' ').toLowerCase()

    const matches = trustIndicators.filter((indicator) =>
      totalWords.includes(indicator),
    ).length
    return Math.min(1.0, matches / trustIndicators.length)
  }

  /**
   * Assess collaboration level
   */
  private assessCollaboration(historicalContext: SessionContext[]): number {
    if (historicalContext.length === 0) return 0.5

    const collaborativeIndicators = historicalContext.filter(
      (hc) => this.identifyCollaborationSignals(hc.conversationHistory) > 0.5,
    ).length

    return Math.min(1.0, collaborativeIndicators / historicalContext.length)
  }

  /**
   * Calculate participation level
   */
  private calculateParticipationLevel(conversation: string[]): number {
    if (conversation.length === 0) return 0.0

    const avgMessageLength =
      conversation.reduce((sum, msg) => sum + msg.length, 0) /
      conversation.length
    const responseCount = conversation.length

    // Normalize participation metrics
    const lengthScore = Math.min(1.0, avgMessageLength / 100)
    const countScore = Math.min(1.0, responseCount / 20)

    return (lengthScore + countScore) / 2
  }

  /**
   * Calculate responsiveness
   */
  private calculateResponsiveness(conversation: string[]): number {
    if (conversation.length < 2) return 0.5

    const questionResponses = conversation.filter(
      (msg) =>
        msg.includes('?') ||
        msg.toLowerCase().includes('what') ||
        msg.toLowerCase().includes('how') ||
        msg.toLowerCase().includes('why'),
    ).length

    return Math.min(1.0, questionResponses / (conversation.length / 2))
  }

  /**
   * Check goal progress
   */
  private checkGoalProgress(
    goal: string,
    historicalContext: SessionContext[],
  ): boolean {
    const goalKeywords = goal.toLowerCase().split(' ')

    return historicalContext.some((hc) =>
      goalKeywords.some((keyword) =>
        hc.conversationHistory.some((msg) =>
          msg.toLowerCase().includes(keyword),
        ),
      ),
    )
  }

  /**
   * Calculate session intervals
   */
  private calculateSessionIntervals(
    historicalContext: SessionContext[],
  ): number[] {
    if (historicalContext.length < 2) return [86400000] // 24 hours default

    const intervals: number[] = []
    for (let i = 1; i < historicalContext.length; i++) {
      const prevTime = new Date(
        historicalContext[i - 1].timestamp || Date.now(),
      ).getTime()
      const currTime = new Date(
        historicalContext[i].timestamp || Date.now(),
      ).getTime()
      intervals.push(currTime - prevTime)
    }

    return intervals
  }

  /**
   * Assess consistency pattern
   */
  private assessConsistencyPattern(intervals: number[]): number {
    if (intervals.length === 0) return 0.8

    const avgInterval =
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    const variance = this.calculateVariance(intervals)

    // Lower variance relative to average = higher consistency
    const consistency = 1.0 - variance / avgInterval ** 2
    return Math.max(0, consistency)
  }

  /**
   * Identify collaboration signals
   */
  private identifyCollaborationSignals(conversation: string[]): number {
    const collaborationWords = [
      'together',
      'collaborate',
      'work',
      'plan',
      'strategy',
      'agree',
    ]
    const totalText = conversation.join(' ').toLowerCase()

    const matches = collaborationWords.filter((word) =>
      totalText.includes(word),
    ).length
    return Math.min(1.0, matches / collaborationWords.length)
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map((val) => (val - mean) ** 2)
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
  }
}
