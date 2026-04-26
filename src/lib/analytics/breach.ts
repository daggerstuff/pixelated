/**
 * Security Breach Data Management
 *
 * Handles storage and retrieval of security breach data using MongoDB Atlas
 */

import mongodb from '@/config/mongodb.config'

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { SecurityError } from '../security/errors'
import { type BreachSeverity } from './types'

const logger = createBuildSafeLogger('breach-data')

// Initialize MongoDB client
const mongoUri = process.env['MONGODB_URI']
const mongoDbName = process.env.MONGODB_DB_NAME

if (!mongoUri || !mongoDbName) {
  throw new Error(
    'Missing required MongoDB configuration for breach data management',
  )
}

// MongoDB connection will be handled by the mongodb config singleton

export interface SecurityBreach {
  id: string
  severity: BreachSeverity
  timestamp: Date
  type: string
  description: string
  affectedUsers: string[]
  dataTypes: string[]
  attackVector?: string
  detectionTime: Date
  responseTime: Date
  remediationStatus: 'pending' | 'in_progress' | 'completed'
  metadata: Record<string, unknown>
}

/**
 * Interface for breach data storage
 */
interface StoredBreach {
  id: string
  severity: BreachSeverity
  timestamp: string
  affected_users: string[]
  data_types: string[]
  attack_vector: string | null
  detection_time: string
  response_time: string
  remediation_status: 'pending' | 'in_progress' | 'completed'
  description: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/**
 * Converts a SecurityBreach object to StoredBreach format
 */
function toStoredBreach(
  breach: SecurityBreach,
): Omit<StoredBreach, 'created_at' | 'updated_at'> {
  const detectionTime =
    breach.detectionTime instanceof Date
      ? breach.detectionTime
      : new Date(breach.timestamp)
  const responseTime =
    breach.responseTime instanceof Date ? breach.responseTime : new Date()
  const remediationStatus =
    breach.remediationStatus ?? ('pending' as const)

  return {
    id: breach.id,
    severity: breach.severity,
    timestamp: breach.timestamp.toISOString(),
    affected_users: Array.isArray(breach.affectedUsers)
      ? breach.affectedUsers
      : [],
    data_types: Array.isArray(breach.dataTypes) ? breach.dataTypes : [],
    attack_vector: breach.attackVector || null,
    detection_time: detectionTime.toISOString(),
    response_time: responseTime.toISOString(),
    remediation_status: remediationStatus,
    description: breach.description,
    metadata: breach.metadata ?? null,
  }
}

/**
 * Converts a StoredBreach to SecurityBreach format
 */
function fromStoredBreach(stored: StoredBreach): SecurityBreach {
  const detected = new Date(stored.detection_time || stored.timestamp)
  const responded = new Date(stored.response_time || stored.timestamp)
  return {
    id: stored.id,
    severity: stored.severity,
    timestamp: new Date(stored.timestamp),
    affectedUsers: stored.affected_users || [],
    dataTypes: stored.data_types || [],
    type: 'unknown',
    description: stored.description,
    attackVector: stored.attack_vector || undefined,
    detectionTime: detected,
    responseTime: responded,
    remediationStatus: stored.remediation_status ?? 'pending',
    metadata: stored.metadata ?? {},
  }
}

/**
 * Store a new security breach
 */
export async function createBreach(breach: SecurityBreach): Promise<void> {
  try {
    const db = await mongodb.connect()
    const collection = db.collection<StoredBreach>('security_breaches')

    await collection.insertOne({
      ...toStoredBreach(breach),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    logger.info('Security breach recorded', { breachId: breach.id })
  } catch (error: unknown) {
    logger.error('Failed to store security breach', {
      error,
      breachId: breach.id,
    })
    throw new SecurityError('Failed to store security breach', {
      cause: error,
    })
  }
}

/**
 * Retrieve breaches that occurred after the specified date
 */
export async function getBreachesSince(date: Date): Promise<SecurityBreach[]> {
  try {
    const db = await mongodb.connect()
    const collection = db.collection<StoredBreach>('security_breaches')

    const data = await collection
      .find({ timestamp: { $gte: date.toISOString() } })
      .sort({ timestamp: -1 })
      .toArray()

    return data.map(fromStoredBreach)
  } catch (error: unknown) {
    logger.error('Failed to retrieve security breaches', {
      error,
      since: date,
    })
    throw new SecurityError('Failed to retrieve security breaches', {
      cause: error,
    })
  }
}

/**
 * Update breach remediation status
 */
export async function updateRemediationStatus(
  breachId: string,
  status: 'pending' | 'in_progress' | 'completed',
): Promise<void> {
  try {
    const db = await mongodb.connect()
    const collection = db.collection<StoredBreach>('security_breaches')

    const result = await collection.updateOne(
      { id: breachId },
      {
        $set: {
          remediation_status: status,
          updated_at: new Date().toISOString(),
        },
      },
    )

    if (result.matchedCount === 0) {
      throw new Error(`Breach with id ${breachId} not found`)
    }

    logger.info('Updated breach remediation status', { breachId, status })
  } catch (error: unknown) {
    logger.error('Failed to update breach status', { error, breachId })
    throw new SecurityError('Failed to update breach status', {
      cause: error,
    })
  }
}

/**
 * Get breach by ID
 */
export async function getBreachById(
  id: string,
): Promise<SecurityBreach | null> {
  try {
    const db = await mongodb.connect()
    const collection = db.collection<StoredBreach>('security_breaches')

    const data = await collection.findOne({ id })

    if (!data) {
      return null
    }

    return fromStoredBreach(data)
  } catch (error: unknown) {
    logger.error('Failed to retrieve security breach', {
      error,
      breachId: id,
    })
    throw new SecurityError('Failed to retrieve security breach', {
      cause: error,
    })
  }
}

// Backward-compatible facade for modules expecting a service object
export const BreachDataService = {
  createBreach,
  getBreachesSince,
  updateRemediationStatus,
  getBreachById,
  deleteBreach,
}

/**
 * Delete a breach record (for compliance with data retention policies)
 */
export async function deleteBreach(id: string): Promise<void> {
  try {
    const db = await mongodb.connect()
    const collection = db.collection<StoredBreach>('security_breaches')

    const result = await collection.deleteOne({ id })

    if (result.deletedCount === 0) {
      throw new Error(`Breach with id ${id} not found`)
    }

    logger.info('Deleted security breach record', { breachId: id })
  } catch (error: unknown) {
    logger.error('Failed to delete security breach', { error, breachId: id })
    throw new SecurityError('Failed to delete security breach', {
      cause: error,
    })
  }
}
