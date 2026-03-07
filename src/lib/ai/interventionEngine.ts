/**
 * Advanced Intervention Suggestion Engine for Pixelated Empathy
 * Provides intelligent, personalized therapeutic interventions
 */

import type { SessionData, PatientProfile, Intervention } from '@/types/ai'

export interface InterventionRule {
  id: string
  name: string
  description: string
  condition: (
    sessionData: SessionData,
    patientProfile: PatientProfile,
  ) => boolean
  suggestions: Intervention[]
  priority: 'low' | 'medium' | 'high' | 'critical'
  evidence: string[]
  confidence: number // 0-1
}

export interface InterventionContext {
  patientHistory: PatientProfile[]
  currentSession: SessionData
  therapistPreferences: Record<string, any>
  clinicalGuidelines: string[]
  riskFactors: string[]
}

export interface InterventionResult {
  interventions: Intervention[]
  reasoning: string[]
  confidence: number
  alternatives: Intervention[]
  followUp: string[]
}

/**
 * Advanced Intervention Suggestion Engine
 */
class InterventionEngine {
  private rules: InterventionRule[] = []
  private context: InterventionContext | null = null

  constructor() {
    this.initializeRules()
  }

  private initializeRules(): void {
    this.rules = [
      // Crisis intervention rule
      {
        id: 'crisis_detection',
        name: 'Crisis Detection',
        description: 'Immediate intervention for crisis situations',
        condition: (session, _patient) => {
          const crisisKeywords = [
            'suicide',
            'kill myself',
            'end it all',
            'hurt myself',
            'die',
          ]
          const transcript = session.transcript?.toLowerCase() || ''
          return crisisKeywords.some((keyword) => transcript.includes(keyword))
        },
        suggestions: [
          {
            type: 'immediate',
            category: 'crisis',
            title: 'Crisis Intervention Protocol',
            description:
              'Immediate safety assessment and intervention required',
            actions: [
              'Assess immediate risk',
              'Contact emergency services if needed',
              'Implement safety planning',
              'Schedule follow-up within 24 hours',
            ],
            priority: 'critical',
          },
        ],
        priority: 'critical',
        evidence: ['Crisis intervention literature', 'Clinical guidelines'],
        confidence: 0.95,
      },

      // Anxiety management rule
      {
        id: 'anxiety_elevation',
        name: 'Anxiety Management',
        description: 'Interventions for elevated anxiety levels',
        condition: (session, patient) => {
          const anxietyIndicators = session.emotionAnalysis?.anxiety || 0
          const baseline = patient.baselineMetrics?.anxiety || 0.3
          return anxietyIndicators > baseline * 1.5
        },
        suggestions: [
          {
            type: 'immediate',
            category: 'technique',
            title: 'Grounding Techniques',
            description: 'Help patient return to present moment',
            actions: [
              '5-4-3-2-1 grounding exercise',
              'Progressive muscle relaxation',
              'Deep breathing techniques',
              'Mindfulness anchoring',
            ],
            priority: 'high',
          },
        ],
        priority: 'high',
        evidence: ['CBT research', 'Anxiety management protocols'],
        confidence: 0.85,
      },

      // Depression indicators rule
      {
        id: 'depression_patterns',
        name: 'Depression Pattern Recognition',
        description: 'Long-term depression pattern interventions',
        condition: (session, patient) => {
          const sessionCount = patient.sessionHistory?.length || 0
          const recentSessions = patient.sessionHistory?.slice(-5) || []

          if (sessionCount < 5) return false

          const depressedMoodCount = recentSessions.filter(
            (s) =>
              s.emotionAnalysis?.dominantEmotion === 'sad' ||
              s.emotionAnalysis?.dominantEmotion === 'depressed',
          ).length

          return depressedMoodCount >= 3
        },
        suggestions: [
          {
            type: 'strategic',
            category: 'therapy',
            title: 'Depression Treatment Protocol',
            description: 'Evidence-based depression intervention',
            actions: [
              'Behavioral activation planning',
              'Cognitive restructuring exercises',
              'Medication review if applicable',
              'Social support enhancement',
            ],
            priority: 'high',
          },
        ],
        priority: 'high',
        evidence: ['Depression treatment guidelines', 'Longitudinal studies'],
        confidence: 0.8,
      },

      // Therapeutic alliance building
      {
        id: 'alliance_building',
        name: 'Therapeutic Alliance Enhancement',
        description: 'Strengthen therapist-patient relationship',
        condition: (session, patient) => {
          const rapportScore = session.therapeuticMetrics?.rapport || 0.5
          const sessionNumber = patient.sessionHistory?.length || 0

          return rapportScore < 0.6 && sessionNumber > 2
        },
        suggestions: [
          {
            type: 'immediate',
            category: 'relationship',
            title: 'Alliance Building Techniques',
            description: 'Enhance therapeutic relationship',
            actions: [
              'Validate patient experience',
              'Demonstrate empathy and understanding',
              'Collaborate on treatment goals',
              'Address any ruptures in alliance',
            ],
            priority: 'medium',
          },
        ],
        priority: 'medium',
        evidence: ['Therapeutic alliance research', 'Patient outcomes studies'],
        confidence: 0.75,
      },

      // Progress monitoring rule
      {
        id: 'progress_celebration',
        name: 'Progress Recognition',
        description: 'Acknowledge and reinforce therapeutic progress',
        condition: (session, patient) => {
          const currentMood = session.emotionAnalysis?.moodScore || 0.5
          const recentAverage = this.calculateRecentMoodAverage(patient)

          return currentMood > recentAverage * 1.2 // 20% improvement
        },
        suggestions: [
          {
            type: 'immediate',
            category: 'reinforcement',
            title: 'Progress Celebration',
            description: 'Recognize and reinforce positive changes',
            actions: [
              'Acknowledge specific improvements',
              'Explore what contributed to progress',
              'Reinforce positive coping strategies',
              'Set new achievable goals',
            ],
            priority: 'medium',
          },
        ],
        priority: 'medium',
        evidence: ['Positive psychology research', 'Motivational interviewing'],
        confidence: 0.7,
      },
    ]
  }

  private calculateRecentMoodAverage(patient: PatientProfile): number {
    const recentSessions = patient.sessionHistory?.slice(-5) || []
    if (recentSessions.length === 0) return 0.5

    const sum = recentSessions.reduce(
      (acc, session) => acc + (session.emotionAnalysis?.moodScore || 0.5),
      0,
    )
    return sum / recentSessions.length
  }

  /**
   * Generate intervention suggestions based on session data
   */
  async generateInterventions(
    sessionData: SessionData,
    patientProfile: PatientProfile,
    context?: Partial<InterventionContext>,
  ): Promise<InterventionResult> {
    this.context = {
      patientHistory: [patientProfile],
      currentSession: sessionData,
      therapistPreferences: {},
      clinicalGuidelines: [],
      riskFactors: [],
      ...context,
    }

    const applicableRules = this.rules.filter((rule) =>
      rule.condition(sessionData, patientProfile),
    )

    // Sort by priority and confidence
    applicableRules.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      return priorityDiff !== 0 ? priorityDiff : b.confidence - a.confidence
    })

    const selectedInterventions: Intervention[] = []
    const reasoning: string[] = []
    const alternatives: Intervention[] = []

    // Select top interventions (max 3)
    for (let i = 0; i < Math.min(3, applicableRules.length); i++) {
      const rule = applicableRules[i]
      selectedInterventions.push(...rule.suggestions)

      reasoning.push(
        `${rule.name}: ${rule.description} (confidence: ${(rule.confidence * 100).toFixed(1)}%)`,
      )

      // Add alternative interventions
      if (i === 0 && applicableRules.length > 1) {
        alternatives.push(
          ...applicableRules.slice(1, 3).flatMap((r) => r.suggestions),
        )
      }
    }

    const overallConfidence =
      applicableRules.length > 0
        ? applicableRules
            .slice(0, 3)
            .reduce((sum, rule) => sum + rule.confidence, 0) /
          Math.min(3, applicableRules.length)
        : 0

    return {
      interventions: selectedInterventions,
      reasoning,
      confidence: overallConfidence,
      alternatives,
      followUp: this.generateFollowUpRecommendations(
        sessionData,
        patientProfile,
      ),
    }
  }

  private generateFollowUpRecommendations(
    sessionData: SessionData,
    patientProfile: PatientProfile,
  ): string[] {
    const recommendations: string[] = []

    // Check homework completion
    if (sessionData.homeworkAssigned && !sessionData.homeworkCompleted) {
      recommendations.push(
        'Follow up on assigned homework and address barriers to completion',
      )
    }

    // Check medication adherence if applicable
    if (patientProfile.medication && sessionData.medicationAdherence < 0.8) {
      recommendations.push(
        'Review medication adherence and address any concerns or side effects',
      )
    }

    // Check session frequency
    const daysSinceLastSession = patientProfile.daysSinceLastSession || 0
    if (daysSinceLastSession > 14) {
      recommendations.push(
        'Consider increasing session frequency for more intensive support',
      )
    }

    // Check for emerging patterns
    const recentEmotions =
      patientProfile.sessionHistory
        ?.slice(-3)
        .map((s) => s.emotionAnalysis?.dominantEmotion) || []
    if (recentEmotions.every((emotion) => emotion === 'anxious')) {
      recommendations.push(
        'Consider anxiety-focused interventions in next session',
      )
    }

    return recommendations
  }

  /**
   * Add custom intervention rule
   */
  addRule(rule: InterventionRule): void {
    this.rules.push(rule)
    this.sortRules()
  }

  /**
   * Remove intervention rule
   */
  removeRule(ruleId: string): boolean {
    const initialLength = this.rules.length
    this.rules = this.rules.filter((rule) => rule.id !== ruleId)
    return this.rules.length < initialLength
  }

  private sortRules(): void {
    this.rules.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      return priorityDiff !== 0 ? priorityDiff : b.confidence - a.confidence
    })
  }

  /**
   * Update rule based on effectiveness
   */
  updateRuleEffectiveness(ruleId: string, effectiveness: number): boolean {
    const rule = this.rules.find((r) => r.id === ruleId)
    if (!rule) return false

    // Adjust confidence based on effectiveness feedback
    rule.confidence = Math.max(
      0.1,
      Math.min(0.99, rule.confidence + (effectiveness - 0.5) * 0.1),
    )
    return true
  }

  /**
   * Get all available rules
   */
  getRules(): InterventionRule[] {
    return [...this.rules]
  }

  /**
   * Analyze intervention effectiveness over time
   */
  async analyzeEffectiveness(): Promise<{
    rulePerformance: Record<string, { usage: number; effectiveness: number }>
    recommendations: string[]
  }> {
    const performance: Record<
      string,
      { usage: number; effectiveness: number }
    > = {}

    this.rules.forEach((rule) => {
      performance[rule.id] = {
        usage: Math.floor(Math.random() * 50), // Mock usage data
        effectiveness: rule.confidence + (Math.random() - 0.5) * 0.2, // Mock effectiveness
      }
    })

    const recommendations: string[] = []

    // Identify low-performing rules
    Object.entries(performance).forEach(([ruleId, stats]) => {
      if (stats.effectiveness < 0.6) {
        recommendations.push(
          `Review rule ${ruleId}: low effectiveness (${(stats.effectiveness * 100).toFixed(1)}%)`,
        )
      }
    })

    // Identify underused high-confidence rules
    Object.entries(performance).forEach(([ruleId, stats]) => {
      const rule = this.rules.find((r) => r.id === ruleId)
      if (rule && rule.confidence > 0.8 && stats.usage < 5) {
        recommendations.push(
          `Consider promoting rule ${ruleId}: high confidence but low usage`,
        )
      }
    })

    return { rulePerformance: performance, recommendations }
  }
}

// Export singleton instance
export const interventionEngine = new InterventionEngine()

// Export class for custom instances
export { InterventionEngine }
export default interventionEngine
