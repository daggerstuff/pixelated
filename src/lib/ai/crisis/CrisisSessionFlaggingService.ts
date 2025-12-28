import { createBuildSafeLogger } from '@lib/logging/build-safe-logger'
import { createAuditLog, AuditEventType } from '@lib/audit'
import mongodb from '@lib/db/mongoClient'
import { ObjectId } from 'mongodb'

const logger = createBuildSafeLogger('crisis-session-flagging')

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

interface CrisisSessionFlagDbData {
  _id?: ObjectId
  id?: string
  user_id: string
  session_id: string
  crisis_id: string
  reason: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  detected_risks: string[]
  text_sample?: string
  status:
    | 'pending'
    | 'under_review'
    | 'reviewed'
    | 'resolved'
    | 'escalated'
    | 'dismissed'
  flagged_at: string
  reviewed_at?: string
  resolved_at?: string
  assigned_to?: string
  reviewer_notes?: string
  resolution_notes?: string
  routing_decision?: unknown
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
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

      // Insert crisis session flag into MongoDB, ensuring a string 'id' field is created
      const db = await mongodb.connect()
      const now = new Date().toISOString()
      const tempId = new ObjectId()
      // Sanitize and validate all request fields before insert to prevent injection
      if (
        typeof request.userId !== 'string' ||
        !/^[a-zA-Z0-9-_]+$/.test(request.userId)
      ) {
        throw new Error('Invalid userId')
      }
      if (
        typeof request.sessionId !== 'string' ||
        !/^[a-zA-Z0-9-_]+$/.test(request.sessionId)
      ) {
        throw new Error('Invalid sessionId')
      }
      if (
        typeof request.crisisId !== 'string' ||
        !/^[a-zA-Z0-9-_]+$/.test(request.crisisId)
      ) {
        throw new Error('Invalid crisisId')
      }
      if (
        !['low', 'medium', 'high', 'critical'].includes(
          String(request.severity),
        )
      ) {
        throw new Error('Invalid severity')
      }
      if (typeof request.reason !== 'string') {
        throw new Error('Invalid reason')
      }
      if (
        typeof request.confidence !== 'number' ||
        request.confidence < 0 ||
        request.confidence > 1
      ) {
        throw new Error('Invalid confidence')
      }

      const safeDetectedRisks = Array.isArray(request.detectedRisks)
        ? request.detectedRisks.filter((risk) => typeof risk === 'string')
        : []
      const safeTextSample =
        request.textSample !== undefined
          ? typeof request.textSample === 'string'
            ? request.textSample
            : ''
          : undefined
      const safeRoutingDecision =
        request.routingDecision !== undefined &&
        typeof request.routingDecision === 'object'
          ? request.routingDecision
          : undefined
      const safeMetadata =
        request.metadata !== undefined &&
        typeof request.metadata === 'object' &&
        !Array.isArray(request.metadata)
          ? request.metadata
          : {}
      const safeTimestamp =
        typeof request.timestamp === 'string' && request.timestamp.length < 50
          ? request.timestamp
          : now

      const insertDoc = {
        _id: tempId,
        id: tempId.toString(),
        user_id: request.userId,
        session_id: request.sessionId,
        crisis_id: request.crisisId,
        reason: request.reason,
        severity: request.severity,
        confidence: request.confidence,
        detected_risks: safeDetectedRisks,
        text_sample: safeTextSample,
        routing_decision: safeRoutingDecision,
        metadata: safeMetadata,
        status: 'pending',
        flagged_at: safeTimestamp,
        created_at: now,
        updated_at: now,
      }
      const insertResult = await db
        .collection('crisis_session_flags')
        .insertOne(insertDoc)

      if (!insertResult.insertedId) {
        throw new Error('Failed to insert crisis session flag')
      }

      // To prevent any potential NoSQL injection, we query using the ObjectId
      // generated in this function scope, rather than the result from the insert operation.
      const flagData = await db
        .collection('crisis_session_flags')
        .findOne({ _id: tempId })

      if (!flagData) {
        throw new Error('Failed to retrieve inserted crisis session flag')
      }

      // Create audit log, including string ID
      await createAuditLog(
        AuditEventType.SECURITY_ALERT,
        'crisis_session_flagged',
        request.userId,
        request.sessionId,
        {
          crisisId: request.crisisId,
          flagId: flagData['id'],
          severity: request.severity,
          reason: request.reason,
          confidence: request.confidence,
          detectedRisks: request.detectedRisks,
        },
      )

      logger.info('Session flagged successfully', {
        flagId: flagData['id'],
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

      if (request.status === 'resolved') {
        updateData.resolved_at = new Date().toISOString()
      }

      if (request.reviewerNotes) {
        updateData.reviewer_notes = request.reviewerNotes
      }

      if (request.resolutionNotes) {
        updateData.resolution_notes = request.resolutionNotes
      }

      if (request.metadata) {
        updateData.metadata = request.metadata
      }

      const db = await mongodb.connect()
      // Validate flagId as a sanitized string and attempt ObjectId construction
      if (
        typeof request.flagId !== 'string' ||
        !/^[a-f\d]{24}$/i.test(request.flagId)
      ) {
        throw new Error('Invalid flagId provided.')
      }
      let objectId: ObjectId
      try {
        objectId = new ObjectId(request.flagId)
      } catch (_e) {
        throw new Error('flagId is not a valid ObjectId.', { cause: _e })
      }
      const updateResult = await db
        .collection('crisis_session_flags')
        .findOneAndUpdate(
          { _id: objectId },
          { $set: updateData },
          { returnDocument: 'after' },
        )

      if (!updateResult?.['value']) {
        logger.error('Failed to update crisis flag status', {
          flagId: request.flagId,
        })
        throw new Error(`Failed to update flag status: flag not found`)
      }

      logger.info('Crisis flag status updated successfully', {
        flagId: request.flagId,
        status: request.status,
      })

      return this.mapFlagFromDb(updateResult['value'])
    } catch (error: unknown) {
      logger.error('Error updating flag status', {
        error: error instanceof Error ? String(error) : String(error),
        flagId: request.flagId,
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
      const db = await mongodb.connect()

      if (typeof userId !== 'string' || !/^[a-zA-Z0-9-_]+$/.test(userId)) {
        throw new Error('Invalid userId provided.')
      }
      const query: Record<string, unknown> = { user_id: userId }

      if (!includeResolved) {
        query.status = { $nin: ['resolved', 'dismissed'] }
      }

      const flags = await db
        .collection('crisis_session_flags')
        .find(query)
        .sort({ flagged_at: -1 })
        .toArray()

      return flags.map((flag) => this.mapFlagFromDb(flag))
    } catch (error: unknown) {
      logger.error('Error getting user crisis flags', {
        error: error instanceof Error ? String(error) : String(error),
        userId,
      })
      throw error
    }
  }

  private mapFlagFromDb(flagData: CrisisSessionFlagDbData): CrisisSessionFlag {
    return {
      id: flagData.id || (flagData._id ? flagData._id.toString() : ''),
      userId: flagData.user_id,
      sessionId: flagData.session_id,
      crisisId: flagData.crisis_id,
      reason: flagData.reason,
      severity: flagData.severity,
      confidence: flagData.confidence,
      detectedRisks: flagData.detected_risks,
      textSample: flagData.text_sample,
      status: flagData.status,
      flaggedAt: flagData.flagged_at,
      reviewedAt: flagData.reviewed_at,
      resolvedAt: flagData.resolved_at,
      assignedTo: flagData.assigned_to,
      reviewerNotes: flagData.reviewer_notes,
      resolutionNotes: flagData.resolution_notes,
      routingDecision: flagData.routing_decision,
      metadata: flagData.metadata,
      createdAt: flagData.created_at,
      updatedAt: flagData.updated_at,
    }
  }
}
