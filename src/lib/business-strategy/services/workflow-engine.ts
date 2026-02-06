/**
 * Workflow Engine Service
 * 
 * Provides functionality for defining and executing business
 * workflows, approvals, and automated tasks.
 */

import type {
    WorkflowDefinition,
    WorkflowExecution,
    WorkflowStep,
    Approval
} from '../types/workflow-engine'
import type { UserId, DocumentId } from '../types/common'
import { BaseService } from './base-service'

export class WorkflowEngineService extends BaseService {
    private readonly tableNames: any

    constructor() {
        super()
        this.tableNames = this.db.postgresql.tables
    }

    /**
     * Start a workflow for a document
     */
    async startWorkflow(userId: UserId, workflowId: string, documentId: DocumentId): Promise<WorkflowExecution> {
        await this.validatePermissions(userId, 'workflow', 'start')

        const timestamp = new Date()
        const executionId = this.generateId()

        const execution: WorkflowExecution = {
            id: executionId,
            workflowId,
            documentId,
            status: 'running',
            currentStepId: 'step-1', // Default first step
            startedAt: timestamp,
            startedBy: userId,
            context: {
                triggeredBy: userId,
                documentId
            },
            history: [{
                stepId: 'start',
                action: 'triggered',
                userId,
                timestamp,
                details: { workflowId }
            }]
        }

        try {
            await this.db.mongodb.database.collection(this.db.mongodb.collections.workflows).insertOne(execution)

            await this.logAudit({
                userId,
                action: 'start-workflow',
                entityType: 'workflow',
                entityId: executionId,
                result: 'success'
            })

            return execution
        } catch (error) {
            return this.handleError(error, 'startWorkflow')
        }
    }

    /**
     * Approve a workflow step
     */
    async approveStep(userId: UserId, executionId: string, stepId: string, feedback?: string): Promise<void> {
        try {
            const timestamp = new Date()

            // Update MongoDB execution record
            await this.db.mongodb.database.collection(this.db.mongodb.collections.workflows).updateOne(
                { id: executionId },
                {
                    $push: {
                        history: {
                            stepId,
                            action: 'approved',
                            userId,
                            timestamp,
                            details: { feedback }
                        }
                    }
                }
            )

            // Update PostgreSQL approval record if any
            await this.db.postgresql.pool.query(
                `UPDATE ${this.db.postgresql.schema}.${this.tableNames.approvals} 
                 SET status = 'approved', decision = 'approve', feedback = $1, decided_at = $2
                 WHERE workflow_execution_id = $3 AND step_id = $4 AND approver_id = $5`,
                [feedback, timestamp, executionId, stepId, userId]
            )

            await this.logAudit({
                userId,
                action: 'approve-step',
                entityType: 'workflow',
                entityId: executionId,
                result: 'success',
                details: { stepId }
            })
        } catch (error) {
            return this.handleError(error, 'approveStep')
        }
    }
}
