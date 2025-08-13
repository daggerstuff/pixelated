import { mongoClient } from '../../supabase'
import { createBuildSafeLogger } from '../../../logging/build-safe-logger'
import { createAuditLog, AuditEventType } from '../../audit'

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
    } catch (error) {
      logger.error('Error flagging session for review', {
        error: error instanceof Error ? error.message : String(error),
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

      const { data, error } = await mongoClient
        .from('crisis_session_flags')
        .update(updateData)
        .eq('id', request.flagId)
        .select()
        .single()

      if (error) {
        logger.error('Failed to update crisis flag status', {
          error,
          flagId: request.flagId,
        })
        throw new Error(`Failed to update flag status: ${error.message}`)
      }

      logger.info('Crisis flag status updated successfully', {
        flagId: request.flagId,
        status: request.status,
      })

      return this.mapFlagFromDb(data)
    } catch (error) {
      logger.error('Error updating flag status', {
        error: error instanceof Error ? error.message : String(error),
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
      let query = mongoClient
        .from('crisis_session_flags')
        .select('*')
        .eq('user_id', userId)
        .order('flagged_at', { ascending: false })

      if (!includeResolved) {
        query = query.not('status', 'in', '(resolved,dismissed)')
      }

      const { data, error } = await query

      if (error) {
        logger.error('Failed to get user crisis flags', {
          error,
          userId,
        })
        throw new Error(`Failed to get crisis flags: ${error.message}`)
      }

      return data.map((flag) => this.mapFlagFromDb(flag))
    } catch (error) {
      logger.error('Error getting user crisis flags', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      })
      throw error
    }
  }

  /**
   * Get user session status
   */
  async getUserSessionStatus(
    userId: string,
  ): Promise<UserSessionStatus | null> {
    try {
      const { data, error } = await mongoClient
        .from('user_session_status')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No record found
          return null
        }
        logger.error('Failed to get user session status', {
          error,
          userId,
        })
        throw new Error(`Failed to get session status: ${error.message}`)
      }

      return this.mapStatusFromDb(data)
    } catch (error) {
      logger.error('Error getting user session status', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      })
      throw error
    }
  }

  /**
   * Get all pending crisis flags for review
   */
  async getPendingCrisisFlags(
    limit: number = 50,
  ): Promise<CrisisSessionFlag[]> {
    try {
      const { data, error } = await mongoClient
        .from('crisis_session_flags')
        .select('*')
        .in('status', ['pending', 'under_review'])
        .order('flagged_at', { ascending: true })
        .limit(limit)

      if (error) {
        logger.error('Failed to get pending crisis flags', { error })
        throw new Error(`Failed to get pending flags: ${error.message}`)
      }

      return data.map((flag) => this.mapFlagFromDb(flag))
    } catch (error) {
      logger.error('Error getting pending crisis flags', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Map database record to CrisisSessionFlag interface
   */
  private mapFlagFromDb(data: unknown): CrisisSessionFlag {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid database record for crisis session flag')
    }

    const record = data as Record<string, unknown>

    const result: CrisisSessionFlag = {
      id: String(record['id']),
      userId: String(record['user_id']),
      sessionId: String(record['session_id']),
      crisisId: String(record['crisis_id']),
      reason: String(record['reason']),
      severity: String(record['severity']) as
        | 'low'
        | 'medium'
        | 'high'
        | 'critical',
      confidence: Number(record['confidence']),
      detectedRisks: Array.isArray(record['detected_risks'])
        ? (record['detected_risks'] as string[])
        : [],
      status: String(record['status']) as
        | 'pending'
        | 'under_review'
        | 'reviewed'
        | 'resolved'
        | 'escalated'
        | 'dismissed',
      flaggedAt: String(record['flagged_at']),
      routingDecision: record['routing_decision'],
      metadata:
        record['metadata'] && typeof record['metadata'] === 'object'
          ? (record['metadata'] as Record<string, unknown>)
          : {},
      createdAt: String(record['created_at']),
      updatedAt: String(record['updated_at']),
    }

    // Only set optional properties if they have values
    if (record['text_sample']) {
      result.textSample = String(record['text_sample'])
    }
    if (record['reviewed_at']) {
      result.reviewedAt = String(record['reviewed_at'])
    }
    if (record['resolved_at']) {
      result.resolvedAt = String(record['resolved_at'])
    }
    if (record['assigned_to']) {
      result.assignedTo = String(record['assigned_to'])
    }
    if (record['reviewer_notes']) {
      result.reviewerNotes = String(record['reviewer_notes'])
    }
    if (record['resolution_notes']) {
      result.resolutionNotes = String(record['resolution_notes'])
    }

    return result
  }

  /**
   * Map database record to UserSessionStatus interface
   */
  private mapStatusFromDb(data: unknown): UserSessionStatus {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid database record for user session status')
    }

    const record = data as Record<string, unknown>

    const result: UserSessionStatus = {
      id: String(record['id']),
      userId: String(record['user_id']),
      isFlaggedForReview: Boolean(record['is_flagged_for_review']),
      currentRiskLevel: String(record['current_risk_level']) as
        | 'low'
        | 'medium'
        | 'high'
        | 'critical',
      totalCrisisFlags: Number(record['total_crisis_flags']),
      activeCrisisFlags: Number(record['active_crisis_flags']),
      resolvedCrisisFlags: Number(record['resolved_crisis_flags']),
      metadata:
        record['metadata'] && typeof record['metadata'] === 'object'
          ? (record['metadata'] as Record<string, unknown>)
          : {},
      createdAt: String(record['created_at']),
      updatedAt: String(record['updated_at']),
    }

    // Only set optional properties if they have values
    if (record['last_crisis_event_at']) {
      result.lastCrisisEventAt = String(record['last_crisis_event_at'])
    }

    return result
  }
}
