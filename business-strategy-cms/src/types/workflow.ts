import { User } from './user'
import { Document } from './document'

export enum WorkflowStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum WorkflowAction {
  SUBMIT_FOR_REVIEW = 'submit_for_review',
  APPROVE = 'approve',
  REJECT = 'reject',
  REQUEST_CHANGES = 'request_changes',
  PUBLISH = 'publish',
  ARCHIVE = 'archive',
  ASSIGN_REVIEWER = 'assign_reviewer',
  ADD_COMMENT = 'add_comment',
}

export enum ReviewPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export interface WorkflowStep {
  id: string
  name: string
  description: string
  order: number
  requiredRole: string[]
  requiredApprovals: number
  timeoutHours: number
  autoApprove: boolean
  conditions?: {
    minWordCount?: number
    requiredSections?: string[]
    mandatoryReviewers?: string[]
  }
}

export interface WorkflowInstance {
  id: string
  documentId: string
  workflowTemplateId: string
  currentStep: number
  status: WorkflowStatus
  assignedReviewers: string[]
  approvals: Approval[]
  comments: WorkflowComment[]
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  dueDate?: Date
  priority: ReviewPriority
  metadata: Record<string, any>
}

export interface Approval {
  id: string
  workflowInstanceId: string
  reviewerId: string
  action: WorkflowAction
  comment?: string
  timestamp: Date
  step: number
  metadata?: Record<string, any>
}

export interface WorkflowComment {
  id: string
  workflowInstanceId: string
  authorId: string
  content: string
  timestamp: Date
  step: number
  isPrivate: boolean
  attachments?: string[]
  mentions?: string[]
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  documentCategory: string
  steps: WorkflowStep[]
  isActive: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
  version: number
}

export interface WorkflowNotification {
  id: string
  userId: string
  workflowInstanceId: string
  type: 'assigned' | 'overdue' | 'approved' | 'rejected' | 'comment'
  message: string
  isRead: boolean
  createdAt: Date
  metadata?: Record<string, any>
}

export interface WorkflowSearchFilters {
  documentId?: string
  status?: WorkflowStatus
  assignedTo?: string
  createdBy?: string
  priority?: ReviewPriority
  dueBefore?: Date
  dueAfter?: Date
  category?: string
}

export interface WorkflowAnalytics {
  totalWorkflows: number
  activeWorkflows: number
  completedWorkflows: number
  averageReviewTime: number
  approvalRate: number
  rejectionRate: number
  mostActiveReviewers: Array<{
    userId: string
    name: string
    reviewCount: number
    averageResponseTime: number
  }>
  bottlenecks: Array<{
    step: string
    averageTime: number
    rejectionRate: number
  }>
}
