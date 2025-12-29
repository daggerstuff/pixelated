import {
  SessionContext,
  TherapeuticProgress,
  InterventionContext,
} from '../types/context'
import { EmotionState, CrisisLevel } from '../types/emotional'
import { PatientPsiProfile } from '../types/patient-psi'
import { RealTimeAnalyzer } from './real-time-analyzer'
import { Logger } from '../../utils/logger'

export class ContextualEnhancer {
  private sessionHistory: Map<string, SessionContext[]> = new Map()
  private progressTracker: Map<string, TherapeuticProgress> = new Map()
  private analyzer: RealTimeAnalyzer
  private logger: Logger

  constructor() {
    this.analyzer = new RealTimeAnalyzer()
    this.logger = new Logger('ContextualEnhancer')
  }

  /**
   * Enhanced contextual analysis for real-time therapy adaptation
   */
  async enhanceContext(
    sessionId: string,
    currentState: EmotionState,
    patientProfile: PatientPsiProfile,
    conversationHistory: string[],
  ): Promise<InterventionContext> {
    try {
      // Build comprehensive context
      const context = await this.buildContext(
        sessionId,
        currentState,
        patientProfile,
        conversationHistory,
      )

      // Analyze therapeutic progress
      const progress = await this.analyzeProgress(sessionId, patientProfile)

      // Determine optimal intervention timing
      const interventionTiming = this.calculateInterventionTiming(
        context,
        progress,
      )

      // Generate contextual recommendations
      const recommendations = await this.generateRecommendations(
        context,
        progress,
        interventionTiming,
      )

      return {
        sessionId,
        context,
        progress,
        interventionTiming,
        recommendations,
        confidence: this.calculateConfidence(context, progress),
        timestamp: new Date(),
      }
    } catch (error) {
      this.logger.error('Context enhancement failed', {
        sessionId,
        error: error.message,
      })
      throw new Error(
        `Failed to enhance context for session ${sessionId}: ${error.message}`,
      )
    }
  }

  /**
   * Build comprehensive session context
   */
  private async buildContext(
    sessionId: string,
    currentState: EmotionState,
    patientProfile: PatientPsiProfile,
    conversationHistory: string[],
  ): Promise<SessionContext> {
    const historicalContext = this.getSessionHistory(sessionId)
    const baselineState = await this.getBaselineState(patientProfile.id)

    return {
      currentState,
      patientProfile,
      conversationHistory,
      historicalContext,
      baselineState,
      sessionDuration: this.calculateSessionDuration(sessionId),
      therapeuticAlliance: this.assessTherapeuticAlliance(historicalContext),
      crisisIndicators: this.identifyCrisisIndicators(
        currentState,
        conversationHistory,
      ),
      culturalContext: patientProfile.culturalFactors,
      previousInterventions: this.getPreviousInterventions(sessionId),
    }
  }

  /**
   * Analyze therapeutic progress over time
   */
  private async analyzeProgress(
    sessionId: string,
    patientProfile: PatientPsiProfile,
  ): Promise<TherapeuticProgress> {
    const history = this.getSessionHistory(sessionId)
    const baseline =
      this.progressTracker.get(patientProfile.id) ||
      this.createBaselineProgress(patientProfile)

    const currentProgress = {
      emotionalRegulation: this.calculateEmotionalProgress(history, baseline),
      therapeuticAlliance: this.calculateAllianceProgress(history),
      treatmentEngagement: this.calculateEngagementProgress(
        history,
        patientProfile,
      ),
      crisisFrequency: this.calculateCrisisFrequency(history),
      goalAchievement: this.calculateGoalProgress(history, baseline.goals),
      sessionConsistency: this.calculateSessionConsistency(history),
    }

    // Update progress tracker
    this.progressTracker.set(patientProfile.id, {
      ...baseline,
      ...currentProgress,
    })

    return currentProgress
  }

  /**
   * Calculate optimal intervention timing based on context and progress
   */
  private calculateInterventionTiming(
    context: SessionContext,
    progress: TherapeuticProgress,
  ): {
    shouldIntervene: boolean
    urgency: 'immediate' | 'soon' | 'routine' | 'monitor'
    recommendedApproach: string
    rationale: string
  } {
    const crisisLevel = this.assessCrisisLevel(
      context.currentState,
      context.crisisIndicators,
    )
    const allianceStrength = progress.therapeuticAlliance
    const sessionPhase = this.determineSessionPhase(context.sessionDuration)

    // Crisis intervention logic
    if (crisisLevel >= CrisisLevel.HIGH) {
      return {
        shouldIntervene: true,
        urgency: 'immediate',
        recommendedApproach: 'crisis_intervention',
        rationale: 'High crisis indicators detected',
      }
    }

    // Therapeutic timing logic
    if (allianceStrength < 0.5 && sessionPhase === 'mid_session') {
      return {
        shouldIntervene: true,
        urgency: 'soon',
        recommendedApproach: 'alliance_building',
        rationale: 'Weak therapeutic alliance needs attention',
      }
    }

    // Progress-based timing
    if (progress.emotionalRegulation < 0.3 && sessionPhase === 'late_session') {
      return {
        shouldIntervene: true,
        urgency: 'routine',
        recommendedApproach: 'skill_building',
        rationale: 'Low emotional regulation progress',
      }
    }

    return {
      shouldIntervene: false,
      urgency: 'monitor',
      recommendedApproach: 'continue_monitoring',
      rationale: 'No immediate intervention needed',
    }
  }

  /**
   * Generate contextual recommendations
   */
  private async generateRecommendations(
    context: SessionContext,
    progress: TherapeuticProgress,
    timing: any,
  ): Promise<string[]> {
    const recommendations: string[] = []

    // Crisis-specific recommendations
    if (timing.urgency === 'immediate') {
      recommendations.push('Activate crisis intervention protocol')
      recommendations.push('Provide immediate emotional support')
      recommendations.push('Connect with crisis resources')
    }

    // Therapeutic alliance recommendations
    if (progress.therapeuticAlliance < 0.5) {
      recommendations.push('Focus on building trust and rapport')
      recommendations.push('Use patient-preferred communication style')
      recommendations.push('Validate patient experiences and emotions')
    }

    // Skill-building recommendations
    if (progress.emotionalRegulation < 0.5) {
      recommendations.push('Introduce emotion regulation techniques')
      recommendations.push('Practice grounding exercises')
      recommendations.push('Develop coping strategy toolkit')
    }

    // Cultural sensitivity recommendations
    if (context.culturalContext) {
      recommendations.push(
        `Consider cultural factors: ${context.culturalContext.primaryFactors.join(', ')}`,
      )
    }

    return recommendations
  }

  /**
   * Calculate confidence score for context analysis
   */
  private calculateConfidence(
    context: SessionContext,
    progress: TherapeuticProgress,
  ): number {
    const factors = [
      context.conversationHistory.length > 5 ? 1.0 : 0.7,
      progress.sessionConsistency > 0.8 ? 1.0 : 0.8,
      context.historicalContext.length > 3 ? 1.0 : 0.6,
      context.therapeuticAlliance ? 0.9 : 0.5,
    ]

    return factors.reduce((sum, factor) => sum + factor, 0) / factors.length
  }

  /**
   * Session history management
   */
  private getSessionHistory(sessionId: string): SessionContext[] {
    return this.sessionHistory.get(sessionId) || []
  }

  private addToSessionHistory(
    sessionId: string,
    context: SessionContext,
  ): void {
    const history = this.getSessionHistory(sessionId)
    history.push(context)

    // Keep last 10 sessions for context
    if (history.length > 10) {
      history.shift()
    }

    this.sessionHistory.set(sessionId, history)
  }

  /**
   * Utility methods for calculations
   */
  private calculateSessionDuration(sessionId: string): number {
    // Implementation based on session start time
    return Date.now() - this.getSessionStartTime(sessionId)
  }

  private getSessionStartTime(_sessionId: string): number {
    // Store session start times
    return Date.now() - 1800000 // Default 30 minutes for now
  }

  private async getBaselineState(_patientId: string): Promise<EmotionState> {
    // Retrieve patient's baseline emotional state
    return {
      primary: 'neutral',
      intensity: 0.3,
      valence: 0.0,
      arousal: 0.2,
    }
  }

  private createBaselineProgress(
    patientProfile: PatientPsiProfile,
  ): TherapeuticProgress {
    return {
      emotionalRegulation: 0.3,
      therapeuticAlliance: 0.5,
      treatmentEngagement: 0.7,
      crisisFrequency: 0.2,
      goalAchievement: 0.1,
      sessionConsistency: 0.8,
      goals: patientProfile.therapeuticGoals || [],
    }
  }

  // Additional calculation methods would be implemented here...
  private calculateEmotionalProgress(
    history: SessionContext[],
    baseline: TherapeuticProgress,
  ): number {
    return Math.min(1.0, baseline.emotionalRegulation + history.length * 0.05)
  }

  private calculateAllianceProgress(history: SessionContext[]): number {
    return Math.min(
      1.0,
      0.5 + history.filter((h) => h.therapeuticAlliance > 0.7).length * 0.1,
    )
  }

  private calculateEngagementProgress(
    history: SessionContext[],
    profile: PatientPsiProfile,
  ): number {
    return Math.min(1.0, 0.7 + history.length * 0.03)
  }

  private calculateCrisisFrequency(history: SessionContext[]): number {
    const crisisSessions = history.filter(
      (h) => h.crisisIndicators.length > 0,
    ).length
    return Math.max(0, crisisSessions / Math.max(history.length, 1))
  }

  private calculateGoalProgress(
    history: SessionContext[],
    goals: string[],
  ): number {
    return Math.min(1.0, goals.length > 0 ? 0.1 + history.length * 0.02 : 0.1)
  }

  private calculateSessionConsistency(history: SessionContext[]): number {
    return history.length > 5 ? 0.9 : 0.7 + history.length * 0.04
  }

  private assessTherapeuticAlliance(history: SessionContext[]): number {
    return history.length > 0
      ? history.reduce((sum, h) => sum + (h.therapeuticAlliance || 0.5), 0) /
          history.length
      : 0.5
  }

  private identifyCrisisIndicators(
    state: EmotionState,
    conversation: string[],
  ): string[] {
    const indicators: string[] = []

    if (state.intensity > 0.8 && state.valence < -0.7) {
      indicators.push('high_negative_intensity')
    }

    const crisisWords = ['suicide', 'kill', 'end', 'worthless', 'hopeless']
    const hasCrisisLanguage = conversation.some((text) =>
      crisisWords.some((word) => text.toLowerCase().includes(word)),
    )

    if (hasCrisisLanguage) {
      indicators.push('crisis_language_detected')
    }

    return indicators
  }

  private assessCrisisLevel(state: EmotionState, indicators: string[]): number {
    let level = 0

    if (state.intensity > 0.8) level += 2
    if (state.valence < -0.7) level += 2
    if (indicators.includes('crisis_language_detected')) level += 3

    return Math.min(level, 5) // Max crisis level 5
  }

  private determineSessionPhase(
    duration: number,
  ): 'early' | 'mid_session' | 'late_session' {
    if (duration < 300000) return 'early' // < 5 minutes
    if (duration < 1200000) return 'mid_session' // < 20 minutes
    return 'late_session'
  }

  private getPreviousInterventions(sessionId: string): any[] {
    const history = this.getSessionHistory(sessionId)
    return history.map((h) => ({
      type: h.currentState.primary,
      timestamp: h.timestamp,
      effectiveness: Math.random(), // Placeholder for actual effectiveness scoring
    }))
  }
}
