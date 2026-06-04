import { PatternReport } from './pattern-detection'
// Action Pipeline — Sprint 4, Task 5 (TypeScript mirror)
import { SessionSummary } from './session-consolidation'

export enum ActionPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface ActionRecommendation {
  recommendationId: string
  title: string
  description: string
  priority: ActionPriority
  measurable: boolean
  relatedTopics: string[]
  source: string
}

export interface TherapistNotification {
  notificationId: string
  severity: string
  message: string
  sessionId: string
  tenantId: string
  timestampMs: number
  requiresResponse: boolean
}

export interface UserReflectionSummary {
  sessionId: string
  summaryText: string
  keyInsights: string[]
  suggestedActions: string[]
  therapistApproved: boolean
}

export interface UserFeedback {
  summaryId: string
  usefulnessRating: number
  helpfulAspects: string[]
  unhelpfulAspects: string[]
  timestampMs: number
}

export interface ActionResult {
  recommendations: ActionRecommendation[]
  notifications: TherapistNotification[]
  userSummary: UserReflectionSummary
  elapsedMs: number
}

export class ActionPipeline {
  private readonly notificationThreshold: number
  private readonly feedbackStore: Map<string, UserFeedback> = new Map()
  private counter = 0

  constructor(notificationThreshold = 0.8, _minConfidence = 0.6) {
    this.notificationThreshold = notificationThreshold
  }

  execute(
    sessionSummary: SessionSummary,
    patternReport?: PatternReport,
  ): ActionResult {
    const recommendations = this.generateRecommendations(
      sessionSummary,
      patternReport,
    )
    const notifications = this.generateNotifications(sessionSummary)
    const userSummary = this.generateUserSummary(
      sessionSummary,
      recommendations,
    )

    return {
      recommendations,
      notifications,
      userSummary,
      elapsedMs: 0,
    }
  }

  private generateRecommendations(
    summary: SessionSummary,
    patternReport?: PatternReport,
  ): ActionRecommendation[] {
    const recommendations: ActionRecommendation[] = []

    for (const topic of summary.unresolvedTopics) {
      this.counter++
      const priority = topic.includes('crisis')
        ? ActionPriority.CRITICAL
        : topic.includes('high_arousal')
          ? ActionPriority.HIGH
          : ActionPriority.MEDIUM

      recommendations.push({
        recommendationId: `rec_${this.counter}`,
        title: `Follow up on: ${topic}`,
        description: `Session ended with unresolved topic: ${topic}. Schedule follow-up discussion.`,
        priority,
        measurable: true,
        relatedTopics: [topic],
        source: 'session_consolidation',
      })
    }

    if (patternReport) {
      for (const trend of patternReport.progressTrends) {
        if (trend.direction === 'declining') {
          this.counter++
          recommendations.push({
            recommendationId: `rec_${this.counter}`,
            title: `Address declining trend: ${trend.metric}`,
            description: `Detected declining trend in ${trend.metric} (slope: ${trend.slope.toFixed(4)}, confidence: ${trend.confidence.toFixed(2)}). Consider intervention adjustment.`,
            priority: ActionPriority.HIGH,
            measurable: true,
            relatedTopics: [trend.metric],
            source: 'pattern_detection',
          })
        }
      }

      for (const trigger of patternReport.triggerPatterns) {
        if (trigger.confidence >= this.notificationThreshold) {
          this.counter++
          recommendations.push({
            recommendationId: `rec_${this.counter}`,
            title: `Monitor trigger: ${trigger.trigger}`,
            description: `High-confidence trigger pattern: '${trigger.trigger}' → '${trigger.response}' (${trigger.confidence.toFixed(2)}). Prepare coping strategies.`,
            priority: ActionPriority.HIGH,
            measurable: true,
            relatedTopics: [trigger.trigger],
            source: 'pattern_detection',
          })
        }
      }
    }

    if (summary.emotionalArc.trend === 'declining') {
      this.counter++
      recommendations.push({
        recommendationId: `rec_${this.counter}`,
        title: 'Address declining emotional trajectory',
        description: `Emotional valence declined from ${summary.emotionalArc.startValence} to ${summary.emotionalArc.endValence}. Review session approach.`,
        priority: ActionPriority.HIGH,
        measurable: true,
        relatedTopics: ['emotional_trajectory'],
        source: 'emotional_arc',
      })
    }

    return recommendations
  }

  private generateNotifications(
    summary: SessionSummary,
  ): TherapistNotification[] {
    const notifications: TherapistNotification[] = []

    if (
      summary.emotionalArc.trend === 'declining' &&
      summary.emotionalArc.endValence < -0.3
    ) {
      this.counter++
      notifications.push({
        notificationId: `notif_${this.counter}`,
        severity: 'high',
        message: `Session ${summary.sessionId} ended with declining emotional trajectory (valence: ${summary.emotionalArc.endValence}). ${summary.unresolvedTopics.length} unresolved topics.`,
        sessionId: summary.sessionId,
        tenantId: summary.tenantId,
        timestampMs: Date.now(),
        requiresResponse: true,
      })
    }

    const crisisTopics = summary.unresolvedTopics.filter((t) =>
      t.includes('crisis'),
    )
    if (crisisTopics.length > 0) {
      this.counter++
      notifications.push({
        notificationId: `notif_${this.counter}`,
        severity: 'critical',
        message: `Crisis content unresolved in session ${summary.sessionId}: ${crisisTopics.join(', ')}`,
        sessionId: summary.sessionId,
        tenantId: summary.tenantId,
        timestampMs: Date.now(),
        requiresResponse: true,
      })
    }

    return notifications
  }

  private generateUserSummary(
    summary: SessionSummary,
    recommendations: ActionRecommendation[],
  ): UserReflectionSummary {
    const keyInsights: string[] = summary.themes
      .slice(0, 3)
      .map((t) => `Theme: ${t}`)
    if (summary.emotionalArc.trend !== 'stable') {
      keyInsights.push(`Emotional trend: ${summary.emotionalArc.trend}`)
    }

    const suggestedActions = recommendations
      .filter((r) => r.priority !== ActionPriority.LOW)
      .map((r) => r.title)

    return {
      sessionId: summary.sessionId,
      summaryText: summary.summaryText,
      keyInsights,
      suggestedActions,
      therapistApproved: false,
    }
  }

  recordFeedback(feedback: UserFeedback): void {
    this.feedbackStore.set(feedback.summaryId, feedback)
  }

  getFeedback(summaryId: string): UserFeedback | undefined {
    return this.feedbackStore.get(summaryId)
  }

  get feedbackCount(): number {
    return this.feedbackStore.size
  }
}
