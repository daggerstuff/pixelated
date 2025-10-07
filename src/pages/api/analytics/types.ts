import type { APIError } from '@/lib/types/api'

// Base analytics event interface
export interface BaseAnalyticsEvent {
  event: string
  timestamp: number
  session_id: string
  ab_variant: string
  page: string
  url: string
  referrer: string
  user_agent: string
}

// Demo analytics event interface
export interface DemoAnalyticsEvent extends BaseAnalyticsEvent {
  time_to_click?: number
  depth_percent?: number
  [key: string]: unknown
}

// Server-enriched analytics event
export interface EnrichedAnalyticsEvent extends DemoAnalyticsEvent {
  server_timestamp: number
  ip_address: string
}

// Analytics summary interfaces
export interface ConversionFunnel {
  page_views: number
  demo_interactions: number
  cta_clicks: number
  conversion_rate: number
}

export interface AnalyticsSummary {
  total_events: number
  unique_sessions: number
  ab_variants: Record<string, number>
  event_types: Record<string, number>
  conversion_funnel: ConversionFunnel
  avg_time_to_cta: number
  scroll_depth_avg: number
}

// Response interfaces
export interface DemoAnalyticsSuccessResponse {
  success: true
  event_id: string
}

export interface DemoAnalyticsGetResponse {
  total_events: number
  events: EnrichedAnalyticsEvent[]
  summary: AnalyticsSummary
}

// Engagement metrics interfaces
export interface ChartSeries {
  name: string
  data: number[]
  color?: string
}

export interface ChartData {
  labels: string[]
  series: ChartSeries[]
}

export interface InteractionMetric {
  label: string
  value: number
}

export interface ActivityEntry {
  user: string
  action: string
  duration: number
  timestamp: number
  sessionScore: number
}

export interface EngagementMetrics {
  totalSessions: number
  engagementRate: number
  avgSessionDuration: number
  activeUsers: number
  sessionTrends: ChartData
  engagementRateTrend: ChartData
  sessionDurationTrend: ChartData
  interactionBreakdown: InteractionMetric[]
  recentActivity: ActivityEntry[]
}

// Error handling interfaces
export interface AnalyticsValidationError extends APIError {
  code: 'VALIDATION_ERROR'
  details: {
    field: string
    message: string
  }[]
}

export interface AnalyticsProcessingError extends APIError {
  code: 'PROCESSING_ERROR'
  details: {
    source: string
    message: string
  }
}

export type AnalyticsError = AnalyticsValidationError | AnalyticsProcessingError

// External analytics service interfaces
export interface GA4Event {
  name: string
  parameters: {
    ab_variant: string
    page_title: string
    page_location: string
    custom_parameter_1: string
    custom_parameter_2: string
    [key: string]: string | number | boolean
  }
}

export interface MixpanelEvent {
  event: string
  properties: {
    token: string
    distinct_id: string
    ab_variant: string
    page: string
    time: number
    [key: string]: unknown
  }
}
