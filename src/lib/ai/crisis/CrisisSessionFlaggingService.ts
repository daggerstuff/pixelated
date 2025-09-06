import { createBuildSafeLogger } from '@lib/logging/build-safe-logger';
import { createAuditLog, AuditEventType } from '@lib/audit';
import { mongodb } from '@lib/db/mongoClient';

const logger = createBuildSafeLogger('crisis-session-flagging');


export interface FlagSessionRequest {
  userId: string
  sessionId: string
  crisisId: string
  timestamp: string
  reason: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  detectedRisks: string[]
  confidence: number
  textSample?: string
  routingDecision?: unknown
  metadata?: Record<string, unknown>
}

export interface CrisisSessionFlag {
  id: string
  userId: string
  sessionId: string
  crisisId: string
  reason: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  detectedRisks: string[]
  textSample?: string
  status:
    | 'pending'
    | 'under_review'
    | 'reviewed'
    | 'resolved'
    | 'escalated'
    | 'dismissed'
  flaggedAt: string
  reviewedAt?: string
  resolvedAt?: string
  assignedTo?: string
  reviewerNotes?: string
  resolutionNotes?: string
  routingDecision?: unknown
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface UserSessionStatus {
  id: string
  userId: string
  isFlaggedForReview: boolean
  currentRiskLevel: 'low' | 'medium' | 'high' | 'critical'
  lastCrisisEventAt?: string
  totalCrisisFlags: number
  activeCrisisFlags: number
  resolvedCrisisFlags: number
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface UpdateFlagStatusRequest {
  flagId: string
  status: 'under_review' | 'reviewed' | 'resolved' | 'escalated' | 'dismissed'
  assignedTo?: string
  reviewerNotes?: string
  resolutionNotes?: string
  metadata?: Record<string, unknown>
}

interface CrisisSessionFlagUpdateData {
  status: 'under_review' | 'reviewed' | 'resolved' | 'escalated' | 'dismissed'
  updated_at: string
  assigned_to?: string
  reviewed_at?: string
  resolved_at?: string
  reviewer_notes?: string
  resolution_notes?: string
  metadata?: Record<string, unknown>
}

export class CrisisSessionFlaggingService {
  /**
   * Flag a user session for immediate review due to crisis detection
   */
  async flagSessionForReview(
    request: FlagSessionRequest,
  ): Promise<CrisisSessionFlag> {
    try {
      logger.info('Flagging session for review', {
        userId: request.userId,
        sessionId: request.sessionId,
        crisisId: request.crisisId,
        severity: request.severity,
      })

      // Validate input
      if (!request.userId || !request.sessionId || !request.crisisId) {
        throw new Error(
          'Missing required fields: userId, sessionId, or crisisId',
        )
      }

      if (request.confidence < 0 || request.confidence > 1) {
        throw new Error('Confidence must be between 0 and 1')
      }

      // Insert crisis session flag into MongoDB
      const db = await mongodb.connect();
      const insertResult = await db.collection('crisis_session_flags').insertOne({
        user_id: request.userId,
        session_id: request.sessionId,
        crisis_id: request.crisisId,
        reason: request.reason,
        severity: request.severity,
        confidence: request.confidence,
        detected_risks: request.detectedRisks,
        text_sample: request.textSample,
        routing_decision: request.routingDecision,
        metadata: request.metadata || {},
        status: 'pending',
        flagged_at: request.timestamp,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (!insertResult.insertedId) {
        throw new Error('Failed to insert crisis session flag')
      }

      const flagData = await db
        .collection('crisis_session_flags')
        .findOne({ _id: insertResult.insertedId })

      if (!flagData) {
        throw new Error('Failed to retrieve inserted crisis session flag')
      }

      // Create audit log
      await createAuditLog(
        AuditEventType.SECURITY_ALERT,
        'crisis_session_flagged',
        request.userId,
        request.sessionId,
        {
          crisisId: request.crisisId,
          severity: request.severity,
          reason: request.reason,
          confidence: request.confidence,
          detectedRisks: request.detectedRisks,
        },
      )

      logger.info('Session flagged successfully', {
        flagId: flagData.id,
        userId: request.userId,
        sessionId: request.sessionId,
        crisisId: request.crisisId,
      })

      return this.mapFlagFromDb(flagData)
    } catch (error: unknown) {
      logger.error('Error flagging session for review', {
        error: error instanceof Error ? String(error) : String(error),
        userId: request.userId,
        sessionId: request.sessionId,
      })
      throw error
    }
  }

  /**
   * Update the status of a crisis session flag
   */
  async updateFlagStatus(
    request: UpdateFlagStatusRequest,
  ): Promise<CrisisSessionFlag> {
    try {
      logger.info('Updating crisis flag status', {
        flagId: request.flagId,
        status: request.status,
      })

      const updateData: CrisisSessionFlagUpdateData = {
        status: request.status,
        updated_at: new Date().toISOString(),
      }

      // Set timestamps based on status
      if (request.status === 'under_review' && request.assignedTo) {
        updateData.assigned_to = request.assignedTo
      }

      if (request.status === 'reviewed' || request.status === 'resolved') {
        updateData.reviewed_at = new Date().toISOString()
      }

      if (request && request.status === 'resolved') {
        updateData.resolved_at = new Date().toISOString()
      }

      if (request && request.reviewerNotes) {
        updateData.reviewer_notes = request.reviewerNotes
      }

      if (request && request.resolutionNotes) {
        updateData.resolution_notes = request.resolutionNotes
      }

      if (request && request.metadata) {
        updateData.metadata = request.metadata
      }

      const db = await mongodb.connect();
      const updateResult = await db.collection('crisis_session_flags').findOneAndUpdate(
        { id: request.flagId },
        { $set: updateData },
        { returnDocument: 'after' }
      );


      if (!updateResult.value) {
        logger.error('Failed to update crisis flag status', {
          flagId: request && request.flagId,
        })
        throw new Error(`Failed to update flag status: flag not found`)
      }

      logger.info('Crisis flag status updated successfully', {
        flagId: request && request.flagId,
        status: request && request.status,
      })

      return this.mapFlagFromDb(updateResult.value)
    } catch (error: unknown) {
      logger.error('Error updating flag status', {
        error: error instanceof Error ? String(error) : String(error),
        flagId: request && request.flagId,
      })
      throw error
    }
  }

  /**
   * Get crisis flags for a specific user
   */
  async getUserCrisisFlags(
    userId: string,
    includeResolved: boolean = false,
  ): Promise<CrisisSessionFlag[]> {
    try {
      const db = await mongodb.connect();
      const query: any = { user_id: userId };

      if (!includeResolved) {
        query.status = { $nin: ['resolved', 'dismissed'] };
      }

      const flags = await db.collection('crisis_session_flags').find(query).sort({ flagged_at: -1 }).toArray();

      return flags.map((flag) => this.mapFlagFromDb(flag))
    } catch
