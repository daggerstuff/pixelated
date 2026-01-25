/**
 * Defines the structure for a single snapshot of a user's progress on a specific metric.
 */
export interface ProgressSnapshot {
  anonymizedUserId: string // Anonymized identifier for the user
  date: string // ISO 8601 date string (e.g., "2025-05-20")
  metricName: string // Name of the metric (e.g., "gad7_score", "phq9_score", "session_engagement_rating")
  metricValue: number // Numerical value of the metric
  sessionId?: string // Optional session ID if the metric is tied to a specific session
  progressSnapshots?: Array<{ timestamp: string; value: number }> // Session milestone snapshots
}

/**
 * Defines the structure for benchmark data related to a specific metric and cohort.
 */
export interface Benchmark {
  cohortId: string // Identifier for the comparison cohort (e.g., "all_users_phq9", "female_25_35_gad7")
  metricName: string // Name of the metric this benchmark applies to
  averageValue: number // Average value for this metric in the cohort
  percentile25: number // 25th percentile value
  percentile75: number // 75th percentile value
  standardDeviation?: number // Optional standard deviation for more detailed analysis
  sampleSize: number // Number of data points used to derive this benchmark
  benchmarkDescription?: string // Optional description of the cohort (e.g., "Users aged 25-35 with GAD-7 scores")
}

/**
 * Defines the structure for the result of a comparative progress analysis.
 */
export interface ComparativeProgressResult {
  userProgressSnapshots: ProgressSnapshot[] // Array of the user's progress snapshots for the metric
  benchmarkData: Benchmark | null // Benchmark data used for comparison (null if not available for the cohort/metric)
  comparisonInsights: {
    trend: 'improving' | 'declining' | 'stable' | 'insufficient_data' // User's progress trend
    relativeToAverage?: 'above' | 'below' | 'at' | 'not_applicable' // User's current position relative to benchmark average
    percentileRank?: number // User's estimated percentile rank within the benchmark cohort (0-100)
    narrativeSummary?: string // A brief textual summary of the comparison (e.g., "Consistently improving and now above average for this cohort.")
  }
  error?: string // Optional error message if analysis could not be completed
}

/**
 * Input parameters for requesting a comparative progress analysis.
 */
export interface ComparativeProgressParams {
  anonymizedUserId: string
  metricName: string
  cohortId: string
  dateRange: {
    startDate: string // ISO 8601 date string
    endDate: string // ISO 8601 date string
  }
}

// Additional types for production-grade analytics charts

export interface SessionData {
  date: string
  sessions: number
  newUsers?: number
  returningUsers?: number
  averageDuration?: number
  therapistSessions?: number // Number of therapist training sessions
  averageSessionProgress?: number // Average progress completion
  skillImprovementRate?: number // Overall skill improvement rate
}

export interface SkillProgressData {
  skill: string
  score: number
  previousScore?: number
  trend: 'up' | 'down' | 'stable'
  category: 'therapeutic' | 'technical' | 'interpersonal'
  sessionsPracticed?: number // Number of sessions this skill was practiced
  averageImprovement?: number // Average improvement per session
}

export interface MetricSummary {
  value: number
  label: string
  trend?: {
    value: number
    direction: 'up' | 'down' | 'stable'
    period: string
  }
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
}

// Therapist-specific analytics data
export interface TherapistSessionData extends SessionData {
  sessionId: string
  therapistId: string
  clientComplexity?: number // 1-10 scale of client difficulty
  sessionQualityScore?: number // 1-100 quality assessment
  milestonesAchieved?: number // Number of milestones reached
  averageResponseTime?: number // Average therapist response time (seconds)
}

export interface TherapistSkillProgressData extends SkillProgressData {
  skillId: string
  practiceHours?: number // Total hours practicing this skill
  certificationLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  competencyAssessment?: number // 1-100 competency score
  lastAssessed?: string // ISO date of last assessment
}

export interface TherapistMetricSummary extends MetricSummary {
  therapistId: string
  benchmarkComparison?: {
    userScore: number
    benchmarkAverage: number
    percentileRank: number
    improvementNeeded: number
  }
}

export interface TherapistAnalyticsChartData {
  sessionMetrics: TherapistSessionData[]
  skillProgress: TherapistSkillProgressData[]
  summaryStats: TherapistMetricSummary[]
  progressSnapshots?: Array<{ timestamp: string; value: number }> // Session milestone snapshots
  comparativeData?: {
    currentSession: TherapistSessionData
    previousSession?: TherapistSessionData
    trend: 'improving' | 'declining' | 'stable'
  }
}

export interface AnalyticsChartData {
  sessionMetrics: SessionData[]
  skillProgress: SkillProgressData[]
  summaryStats: MetricSummary[]
  therapistData?: TherapistAnalyticsChartData // Optional therapist-specific data
}

export interface IAnalyticsError {
  code: string
  message: string
  details?: unknown
}
/**
 * AnalyticsError class for error handling in analytics hooks/services.
 */
export class AnalyticsError implements IAnalyticsError {
  code: string
  message: string
  details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    this.code = code
    this.message = message
    this.details = details
  }
}

export interface AnalyticsServiceConfig {
  apiBaseUrl: string
  refreshInterval: number
  retryAttempts: number
  timeoutMs: number
}

export type TimeRange = '7d' | '30d' | '90d' | '1y'

export interface AnalyticsFilters {
  timeRange: TimeRange
  userSegment?: 'all' | 'new' | 'returning'
  skillCategory?: 'all' | 'therapeutic' | 'technical' | 'interpersonal'
  config?: {
    enableAutoRefresh?: boolean
    refreshInterval?: number
  }
}
