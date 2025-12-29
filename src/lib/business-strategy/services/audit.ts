/**
 * Audit Service
 * 
 * Handles audit logging for all business strategy system activities
 * Ensures compliance and traceability
 */

import type { AuditLog, UserId } from '../types'
import type { Collection } from 'mongodb'
import { getDatabaseConfig } from '../config/database'

export interface AuditEventInput {
    userId?: UserId
    type: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'system'
    action: string
    resource?: string
    resourceId?: string
    result: 'success' | 'failure' | 'error'
    details?: Record<string, unknown>
    timestamp: Date
    ipAddress?: string
    userAgent?: string
    sessionId?: string
    riskScore?: number
}

export class AuditService {
    private auditCollection: Collection<AuditLog>

    constructor() {
        const db = getDatabaseConfig()
        this.auditCollection = db.mongodb.database.collection(db.mongodb.collections.auditLogs)
    }

    /**
     * Log an audit event
     */
    async logEvent(event: AuditEventInput): Promise<void> {
        try {
            const auditLog: AuditLog = {
                id: crypto.randomUUID(),
                entityId: event.resourceId || '',
                entityType: event.resource || 'system',
                action: event.action,
                userId: event.userId,
                timestamp: event.timestamp,
                changes: event.details ? { details: { from: null, to: event.details } } : undefined,
                metadata: {
                    type: event.type,
                    result: event.result,
                    ipAddress: event.ipAddress,
                    userAgent: event.userAgent,
                    sessionId: event.sessionId,
                    riskScore: event.riskScore,
                },
            }

            await this.auditCollection.insertOne(auditLog)
        } catch (error) {
            // Don't throw on audit failures to avoid breaking main operations
            console.error('Failed to log audit event:', error)
        }
    }

    /**
     * Log document access
     */
    async logDocumentAccess(params: {
        userId: UserId
        documentId: string
        action: 'view' | 'edit' | 'delete' | 'share' | 'export'
        ipAddress?: string
        userAgent?: string
        sessionId?: string
    }): Promise<void> {
        await this.logEvent({
            userId: params.userId,
            type: 'data_access',
            action: `document_${params.action}`,
            resource: 'document',
            resourceId: params.documentId,
            result: 'success',
            timestamp: new Date(),
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
            sessionId: params.sessionId,
        })
    }

    /**
     * Log document modification
     */
    async logDocumentModification(params: {
        userId: UserId
        documentId: string
        action: 'create' | 'update' | 'delete'
        changes?: Record<string, { from: unknown; to: unknown }>
        ipAddress?: string
        userAgent?: string
        sessionId?: string
    }): Promise<void> {
        await this.logEvent({
            userId: params.userId,
            type: 'data_modification',
            action: `document_${params.action}`,
            resource: 'document',
            resourceId: params.documentId,
            result: 'success',
            details: params.changes,
            timestamp: new Date(),
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
            sessionId: params.sessionId,
        })
    }

    /**
     * Log user authentication
     */
    async logAuthentication(params: {
        userId?: UserId
        action: 'login' | 'logout' | 'login_failed' | 'password_reset' | 'account_locked'
        result: 'success' | 'failure' | 'error'
        ipAddress?: string
        userAgent?: string
        details?: Record<string, unknown>
    }): Promise<void> {
        await this.logEvent({
            userId: params.userId,
            type: 'authentication',
            action: params.action,
            resource: 'user',
            resourceId: params.userId,
            result: params.result,
            details: params.details,
            timestamp: new Date(),
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
            riskScore: this.calculateAuthRiskScore(params),
        })
    }

    /**
     * Log authorization events
     */
    async logAuthorization(params: {
        userId: UserId
        action: string
        resource: string
        resourceId?: string
        result: 'success' | 'failure'
        reason?: string
        ipAddress?: string
        sessionId?: string
    }): Promise<void> {
        await this.logEvent({
            userId: params.userId,
            type: 'authorization',
            action: params.action,
            resource: params.resource,
            resourceId: params.resourceId,
            result: params.result,
            details: params.reason ? { reason: params.reason } : undefined,
            timestamp: new Date(),
            ipAddress: params.ipAddress,
            sessionId: params.sessionId,
            riskScore: params.result === 'failure' ? 75 : 25,
        })
    }

    /**
     * Get audit logs for an entity
     */
    async getEntityAuditLogs(
        entityType: string,
        entityId: string,
        options?: {
            limit?: number
            skip?: number
            startDate?: Date
            endDate?: Date
        }
    ): Promise<AuditLog[]> {
        const filter: Record<string, unknown> = {
            entityType,
            entityId,
        }

        if (options?.startDate || options?.endDate) {
            filter.timestamp = {}
            if (options.startDate) {
                filter.timestamp.$gte = options.startDate
            }
            if (options.endDate) {
                filter.timestamp.$lte = options.endDate
            }
        }

        const cursor = this.auditCollection
            .find(filter)
            .sort({ timestamp: -1 })

        if (options?.skip) {
            cursor.skip(options.skip)
        }

        if (options?.limit) {
            cursor.limit(options.limit)
        }

        return await cursor.toArray()
    }

    /**
     * Get audit logs for a user
     */
    async getUserAuditLogs(
        userId: UserId,
        options?: {
            limit?: number
            skip?: number
            startDate?: Date
            endDate?: Date
            actions?: string[]
        }
    ): Promise<AuditLog[]> {
        const filter: Record<string, unknown> = {
            userId,
        }

        if (options?.actions) {
            filter.action = { $in: options.actions }
        }

        if (options?.startDate || options?.endDate) {
            filter.timestamp = {}
            if (options.startDate) {
                filter.timestamp.$gte = options.startDate
            }
            if (options.endDate) {
                filter.timestamp.$lte = options.endDate
            }
        }

        const cursor = this.auditCollection
            .find(filter)
            .sort({ timestamp: -1 })

        if (options?.skip) {
            cursor.skip(options.skip)
        }

        if (options?.limit) {
            cursor.limit(options.limit)
        }

        return await cursor.toArray()
    }

    /**
     * Get security events (high-risk audit logs)
     */
    async getSecurityEvents(options?: {
        limit?: number
        skip?: number
        startDate?: Date
        endDate?: Date
        minRiskScore?: number
    }): Promise<AuditLog[]> {
        const filter: Record<string, unknown> = {
            'metadata.riskScore': { $gte: options?.minRiskScore || 50 },
        }

        if (options?.startDate || options?.endDate) {
            filter.timestamp = {}
            if (options.startDate) {
                filter.timestamp.$gte = options.startDate
            }
            if (options.endDate) {
                filter.timestamp.$lte = options.endDate
            }
        }

        const cursor = this.auditCollection
            .find(filter)
            .sort({ timestamp: -1, 'metadata.riskScore': -1 })

        if (options?.skip) {
            cursor.skip(options.skip)
        }

        if (options?.limit) {
            cursor.limit(options.limit)
        }

        return await cursor.toArray()
    }

    /**
     * Calculate risk score for authentication events
     */
    private calculateAuthRiskScore(params: {
        action: string
        result: string
        ipAddress?: string
        details?: Record<string, unknown>
    }): number {
        let score = 0

        // Base score by action and result
        if (params.result === 'failure') {
            score += 50
        }

        if (params.action === 'login_failed') {
            score += 30
        } else if (params.action === 'account_locked') {
            score += 80
        }

        // Additional factors from details
        if (params.details?.suspiciousActivity) {
            score += 40
        }

        if (params.details?.newDevice) {
            score += 20
        }

        if (params.details?.unusualLocation) {
            score += 30
        }

        return Math.min(score, 100)
    }

    /**
     * Clean up old audit logs (for compliance with retention policies)
     */
    async cleanupOldLogs(retentionDays: number = 2190): Promise<number> { // 6 years default
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

        const result = await this.auditCollection.deleteMany({
            timestamp: { $lt: cutoffDate },
        })

        return result.deletedCount || 0
    }
}