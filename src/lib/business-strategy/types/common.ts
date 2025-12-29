/**
 * Common Types for Business Strategy System
 */

export type BusinessStrategyId = string & { readonly __brand: unique symbol }
export type UserId = string & { readonly __brand: unique symbol }
export type DocumentId = string & { readonly __brand: unique symbol }
export type WorkflowId = string & { readonly __brand: unique symbol }

export interface BaseEntity {
    id: string
    createdAt: Date
    updatedAt: Date
    createdBy: UserId
    lastModifiedBy: UserId
}

export interface PaginationParams {
    page: number
    limit: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
    data: T[]
    pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
        hasNext: boolean
        hasPrev: boolean
    }
}

export interface SearchParams {
    query?: string
    filters?: Record<string, unknown>
    pagination?: PaginationParams
}

export interface ApiResponse<T> {
    success: boolean
    data?: T
    error?: {
        code: string
        message: string
        details?: unknown
    }
    timestamp: Date
}

export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type Status = 'draft' | 'review' | 'approved' | 'published' | 'archived'

export interface Metadata {
    tags: string[]
    category: string
    priority: Priority
    status: Status
    version: number
}

export interface AuditLog {
    id: string
    entityId: string
    entityType: string
    action: string
    userId: UserId
    timestamp: Date
    changes?: Record<string, { from: unknown; to: unknown }>
    metadata?: Record<string, unknown>
}