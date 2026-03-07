/**
 * Workflow Engine Types
 */

import type { BaseEntity, Priority, UserId, DocumentId, WorkflowId } from './common'

export type StepType =
    | 'approval'
    | 'review'
    | 'notification'
    | 'automation'
    | 'condition'
    | 'parallel'
    | 'sequential'

export type WorkflowStatus =
    | 'pending'
    | 'in-progress'
    | 'completed'
    | 'rejected'
    | 'cancelled'
    | 'error'

export type StepStatus =
    | 'pending'
    | 'in-progress'
    | 'approved'
    | 'rejected'
    | 'skipped'
    | 'error'

export interface Condition {
    id: string
    field: string
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'exists'
    value: unknown
    logicalOperator?: 'and' | 'or'
}

export interface Action {
    id: string
    type: 'email' | 'webhook' | 'update_field' | 'create_task' | 'assign_user' | 'move_document'
    config: Record<string, unknown>
    conditions?: Condition[]
}

export interface WorkflowTrigger {
    id: string
    type: 'manual' | 'document_created' | 'document_updated' | 'status_changed' | 'scheduled' | 'webhook'
    conditions?: Condition[]
    config?: Record<string, unknown>
}

export interface WorkflowStep {
    id: string
    name: string
    description?: string
    type: StepType
    order: number

    // Approval/Review specific
    approvers?: UserId[]
    requiredApprovals?: number // minimum approvals needed
    allowDelegation?: boolean
    autoApprove?: boolean
    autoApproveConditions?: Condition[]

    // Timing
    timeoutDays?: number
    reminderDays?: number[]
    escalationDays?: number
    escalationTo?: UserId[]

    // Conditions and actions
    conditions?: Condition[]
    actions?: Action[]

    // Parallel/Sequential specific
    childSteps?: WorkflowStep[]

    // UI configuration
    formFields?: {
        name: string
        type: 'text' | 'textarea' | 'select' | 'checkbox' | 'date' | 'number'
        label: string
        required: boolean
        options?: string[]
        defaultValue?: unknown
    }[]

    // Notifications
    notifications?: {
        onStart?: string[]
        onComplete?: string[]
        onTimeout?: string[]
        onEscalation?: string[]
    }
}

export interface WorkflowDefinition extends BaseEntity {
    name: string
    description?: string
    version: number
    isActive: boolean

    // Triggers
    triggers: WorkflowTrigger[]

    // Steps
    steps: WorkflowStep[]

    // Configuration
    config: {
        allowParallelExecution: boolean
        maxConcurrentExecutions?: number
        priority: Priority
        category: string
        tags: string[]
    }

    // Permissions
    permissions: {
        canStart: string[] // user IDs or role names
        canView: string[]
        canEdit: string[]
        canDelete: string[]
    }

    // Analytics
    analytics: {
        executionCount: number
        averageDuration: number // minutes
        successRate: number // 0-100
        lastExecuted?: Date
    }

    // Versioning
    parentId?: WorkflowId
    changelog?: string
}

export interface WorkflowExecution extends BaseEntity {
    workflowId: WorkflowId
    workflowVersion: number
    documentId?: DocumentId

    // Status
    status: WorkflowStatus
    currentStep?: string

    // Execution data
    data: Record<string, unknown>
    context: {
        triggeredBy: UserId
        triggerType: string
        triggerData?: Record<string, unknown>
    }

    // Steps execution
    steps: {
        stepId: string
        status: StepStatus
        assignedTo: UserId[]
        startedAt?: Date
        completedAt?: Date
        completedBy?: UserId
        timeoutAt?: Date

        // Approval specific
        decision?: 'approve' | 'reject' | 'request-changes'
        feedback?: string
        attachments?: string[]

        // Delegation
        delegatedTo?: UserId
        delegatedAt?: Date
        delegatedBy?: UserId
        delegationReason?: string

        // Automation results
        automationResults?: {
            success: boolean
            output?: unknown
            error?: string
            executedAt: Date
        }

        // Form data
        formData?: Record<string, unknown>
    }[]

    // Timing
    startedAt: Date
    completedAt?: Date
    duration?: number // minutes

    // Error handling
    error?: {
        code: string
        message: string
        step?: string
        timestamp: Date
        retryCount: number
    }

    // Notifications sent
    notifications: {
        type: string
        recipient: UserId
        sentAt: Date
        delivered: boolean
    }[]

    // Comments and communication
    comments: {
        id: string
        userId: UserId
        stepId?: string
        content: string
        createdAt: Date
        isInternal: boolean
    }[]
}

export interface WorkflowTemplate extends BaseEntity {
    name: string
    description: string
    category: string
    tags: string[]

    // Template definition
    definition: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'lastModifiedBy'>

    // Usage
    usageCount: number
    rating?: number // 0-5
    reviews?: {
        userId: UserId
        rating: number
        comment: string
        createdAt: Date
    }[]

    // Customization
    customizableFields: string[]
    variables: {
        name: string
        type: 'text' | 'number' | 'boolean' | 'select' | 'user' | 'role'
        description: string
        required: boolean
        defaultValue?: unknown
        options?: string[]
    }[]
}

export interface WorkflowMetrics {
    workflowId: WorkflowId
    period: {
        start: Date
        end: Date
    }

    // Execution metrics
    totalExecutions: number
    completedExecutions: number
    failedExecutions: number
    cancelledExecutions: number

    // Performance metrics
    averageDuration: number // minutes
    medianDuration: number
    minDuration: number
    maxDuration: number

    // Step metrics
    stepMetrics: {
        stepId: string
        stepName: string
        averageDuration: number
        approvalRate: number // 0-100
        timeoutRate: number // 0-100
        escalationRate: number // 0-100
    }[]

    // User metrics
    userMetrics: {
        userId: UserId
        executionsStarted: number
        approvalsGiven: number
        averageApprovalTime: number
        timeoutCount: number
    }[]

    // Bottlenecks
    bottlenecks: {
        stepId: string
        stepName: string
        averageWaitTime: number
        frequency: number
    }[]
}

export interface ApprovalDecision {
    decision: 'approve' | 'reject' | 'request-changes' | 'delegate'
    feedback?: string
    attachments?: string[]
    delegateTo?: UserId
    delegationReason?: string
    conditions?: {
        field: string
        value: unknown
    }[]
}

export interface WorkflowNotification {
    id: string
    workflowExecutionId: string
    type: 'assignment' | 'reminder' | 'escalation' | 'completion' | 'timeout' | 'error'
    recipient: UserId
    subject: string
    message: string
    data?: Record<string, unknown>
    scheduledAt: Date
    sentAt?: Date
    delivered: boolean
    readAt?: Date
    actions?: {
        label: string
        action: string
        url?: string
    }[]
}