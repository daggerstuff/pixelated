import type { AnalyticsChartData, SessionData } from './analytics'

export interface SessionProgressMetrics {
  // Conversation metrics
  totalMessages: number
  therapistMessages: number
  clientMessages: number

  // Time-based metrics
  sessionDuration: number // in seconds
  activeTime: number // in seconds

  // Skill development metrics
  skillScores: Record<string, number> // skill name -> score (0-100)

  // Engagement metrics
  responseTime: number // average response time in seconds
  conversationFlow: number // conversation quality score (0-100)

  // Milestones
  milestonesReached: string[] // milestone identifiers
  lastMilestoneTime?: string // ISO timestamp
}

export interface TherapistSession {
  id: string
  clientId: string
  therapistId: string
  startTime: string
  endTime?: string
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  progress: number // 0-100
  progressSnapshots?: Array<{ timestamp: string; value: number }>
  analyticsData?: AnalyticsChartData
  sessionMetrics?: SessionData[]
  progressMetrics?: SessionProgressMetrics
}

export interface TherapistDashboardProps {
  sessions: TherapistSession[]
  onSessionControl?: (
    sessionId: string,
    action: 'start' | 'pause' | 'resume' | 'end',
  ) => void
  children?: React.ReactNode}
