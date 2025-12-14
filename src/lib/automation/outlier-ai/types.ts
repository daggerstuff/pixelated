/**
 * Outlier AI Automation Types
 * 
 * Type definitions for Outlier AI task automation system
 */

export interface OutlierTask {
  id: string
  title: string
  description: string
  type: TaskType
  url: string
  status: TaskStatus
  assignedAt?: Date
  completedAt?: Date
  payment?: number
  instructions?: string
  requirements?: string[]
}

export type TaskType =
  | 'prompt_design'
  | 'output_evaluation'
  | 'content_moderation'
  | 'data_labeling'
  | 'ranking'
  | 'rewriting'
  | 'fact_checking'
  | 'unknown'

export type TaskStatus =
  | 'available'
  | 'claimed'
  | 'in_progress'
  | 'completed'
  | 'submitted'
  | 'rejected'
  | 'paid'

export interface TaskExecutionResult {
  taskId: string
  success: boolean
  submitted: boolean
  error?: string
  executionTime: number
  qualityScore?: number
}

export interface OutlierConfig {
  loginUrl: string
  dashboardUrl: string
  username: string
  password: string
  checkInterval: number // milliseconds
  maxConcurrentTasks: number
  humanLikeDelays: {
    min: number
    max: number
  }
  retryAttempts: number
  qualityThreshold: number // 0-1
}

export interface BrowserSession {
  pageId?: string
  isActive: boolean
  lastActivity: Date
}

export interface TaskAgent {
  name: string
  type: TaskType
  canHandle: (task: OutlierTask) => boolean
  execute: (task: OutlierTask, browser: BrowserSession) => Promise<TaskExecutionResult>
}
