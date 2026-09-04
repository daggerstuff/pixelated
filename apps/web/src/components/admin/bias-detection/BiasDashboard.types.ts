/**
 * Shared types and constants for BiasDashboard component tree.
 *
 * Extracted from BiasDashboard.tsx to reduce monolith size.
 */

import type { BiasDashboardData, BiasAnalysisResult, DashboardRecommendation, BiasAlert } from '@/lib/ai/bias-detection'

export interface BiasDashboardProps {
  className?: string
  refreshInterval?: number // milliseconds
  enableRealTimeUpdates?: boolean
}

export interface NotificationSettings {
  emailEnabled: boolean
  smsEnabled: boolean
  inAppEnabled: boolean
  criticalAlerts: boolean
  highAlerts: boolean
  mediumAlerts: boolean
  lowAlerts: boolean
}

export interface AlertAction {
  id: string
  type: 'acknowledge' | 'dismiss' | 'escalate' | 'archive'
  timestamp: string
  userId?: string
  notes?: string
}

export interface BaseFilterableItem {
  timestamp?: string | Date
  date?: string | Date
}

export interface BiasAnalysisItem extends BaseFilterableItem {
  sessionId: string
  overallBiasScore: number
  alertLevel: string
}

export interface AlertItem extends BaseFilterableItem {
  alertId: string
  type?: string
  message: string
  level: string
  sessionId?: string
  timestamp: string | Date
  acknowledged?: boolean
  status?: string
}

export interface TrendItem extends BaseFilterableItem {
  date: string
  time?: string
  biasScore: number
  sessionCount: number
  alertCount: number
}

export type FilterableData =
  | BaseFilterableItem[]
  | BiasAnalysisItem[]
  | AlertItem[]
  | TrendItem[]

export interface TooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    color: string
    payload: {
      percent: number
    }
  }>
  label?: string
}

export const timeRangeOptions = [
  { value: '1h', label: 'Last Hour' },
  { value: '6h', label: 'Last 6 Hours' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' },
]

export const demographicFilterOptions = [
  { value: 'all', label: 'All Demographics' },
  { value: 'age', label: 'Filter by Age' },
  { value: 'gender', label: 'Filter by Gender' },
  { value: 'ethnicity', label: 'Filter by Ethnicity' },
]

export type {
  BiasDashboardData,
  BiasAnalysisResult,
  DashboardRecommendation,
  BiasAlert,
}
