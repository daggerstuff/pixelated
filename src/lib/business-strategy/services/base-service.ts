/**
 * Base Service Class
 * 
 * Provides common functionality for all business strategy services
 */

import type { DatabaseConfig } from '../config/database'
import type { UserId } from '../types/common'
import { getDatabaseConfig } from '../config/database'
import { AuditService } from './audit'

export abstract class BaseService {
    protected db: DatabaseConfig
    protected auditService: AuditService

    constructor() {
        this.db = getDatabaseConfig()
        this.auditService = new AuditService()
    }

    /**
     * Log an audit event
     */
    protected async logAudit(params: {
        userId?: UserId
        action: string
        entityType: string
        entityId?: string
        result: 'success' | 'failure' | 'error'
        details?: Record<string, unknown>
        riskScore?: number
    }): Promise<void> {
        await this.auditService.logEvent({
            ...params,
            timestamp: new Date(),
        })
    }

    /**
     * Validate user permissions for an action
     */
    protected async validatePermissions(
        userId: UserId,
        resource: string,
        action: string,
        conditions?: Record<string, unknown>
    ): Promise<boolean> {
        // Implementation will be added when UserManagementService is complete
        // For now, return true to allow development to continue
        return true
    }

    /**
     * Generate a unique ID
     */
    protected generateId(): string {
        return crypto.randomUUID()
    }

    /**
     * Validate required fields
     */
    protected validateRequired<T extends Record<string, unknown>>(
        data: T,
        requiredFields: (keyof T)[]
    ): void {
        const missing = requiredFields.filter(field =>
            data[field] === undefined || data[field] === null || data[field] === ''
        )

        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`)
        }
    }

    /**
     * Sanitize input data
     */
    protected sanitizeInput<T extends Record<string, unknown>>(data: T): T {
        const sanitized = { ...data }

        // Remove any potential XSS or injection attempts
        for (const [key, value] of Object.entries(sanitized)) {
            if (typeof value === 'string') {
                // Basic sanitization - remove script tags and dangerous characters
                sanitized[key] = value
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/javascript:/gi, '')
                    .replace(/on\w+\s*=/gi, '')
                    .trim() as T[Extract<keyof T, string>]
            }
        }

        return sanitized
    }

    /**
     * Handle service errors consistently
     */
    protected handleError(error: unknown, context: string): never {
        console.error(`Error in ${context}:`, error)

        if (error instanceof Error) {
            throw error
        }

        throw new Error(`Unexpected error in ${context}`)
    }

    /**
     * Create pagination metadata
     */
    protected createPaginationMeta(
        page: number,
        limit: number,
        total: number
    ) {
        const totalPages = Math.ceil(total / limit)

        return {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        }
    }

    /**
     * Build MongoDB filter from search parameters
     */
    protected buildMongoFilter(filters?: Record<string, unknown>): Record<string, unknown> {
        if (!filters) return {}

        const mongoFilter: Record<string, unknown> = {}

        for (const [key, value] of Object.entries(filters)) {
            if (value === undefined || value === null) continue

            if (Array.isArray(value)) {
                mongoFilter[key] = { $in: value }
            } else if (typeof value === 'string' && value.includes('*')) {
                // Convert wildcard to regex
                const regex = value.replace(/\*/g, '.*')
                mongoFilter[key] = { $regex: regex, $options: 'i' }
            } else {
                mongoFilter[key] = value
            }
        }

        return mongoFilter
    }

    /**
     * Build sort object for MongoDB
     */
    protected buildMongoSort(
        sortBy?: string,
        sortOrder: 'asc' | 'desc' = 'desc'
    ): Record<string, 1 | -1> {
        if (!sortBy) {
            return { createdAt: -1 }
        }

        return { [sortBy]: sortOrder === 'asc' ? 1 : -1 }
    }
}