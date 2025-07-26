/**
 * Security Breach Data Management
 *
 * Handles storage and retrieval of security breach data using Supabase
 */

import { createClient } from '@supabase/supabase-js'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { SecurityError } from '../security/errors'
// Import shared types to avoid circular dependencies
import type { SecurityBreach, BreachSeverity } from './types'

const logger = createBuildSafeLogger('breach-data')

// Initialize Supabase client
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing required Supabase configuration for breach data management',
  )
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

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
  return {
    id: breach.id,
    severity: breach.severity,
    timestamp: breach.timestamp.toISOString(),
    affected_users: breach.affectedUsers,
    data_types: breach.dataTypes,
    attack_vector: breach.attackVector || null,
    detection_time: breach.detectionTime.toISOString(),
    response_time: breach.responseTime.toISOString(),
    remediation_status: breach.remediationStatus,
    description: breach.description,
    metadata: breach.metadata || null,
  }
}

/**
 * Converts a StoredBreach to SecurityBreach format
 */
function fromStoredBreach(stored: StoredBreach): SecurityBreach {
  return {
    id: stored.id,
    severity: stored.severity,
    timestamp: new Date(stored.timestamp),
    affectedUsers: stored.affected_users,
    dataTypes: stored.data_types,
    attackVector: stored.attack_vector || undefined,
    detectionTime: new Date(stored.detection_time),
    responseTime: new Date(stored.response_time),
    remediationStatus: stored.remediation_status,
    description: stored.description,
    metadata: stored.metadata || undefined,
  }
}

/**
 * Store a new security breach
 */
export async function createBreach(breach: SecurityBreach): Promise<void> {
  try {
    const { error } = await supabase
      .from('security_breaches')
      .insert(toStoredBreach(breach))

    if (error) {
      throw error
    }

    logger.info('Security breach recorded', { breachId: breach.id })
  } catch (error) {
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
    const { data, error } = await supabase
      .from('security_breaches')
      .select('*')
      .gte('timestamp', date.toISOString())
      .order('timestamp', { ascending: false })

    if (error) {
      throw error
    }

    return (data as StoredBreach[]).map(fromStoredBreach)
  } catch (error) {
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
    const { error } = await supabase
      .from('security_breaches')
      .update({
        remediation_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', breachId)

    if (error) {
      throw error
    }

    logger.info('Updated breach remediation status', { breachId, status })
  } catch (error) {
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
    const { data, error } = await supabase
      .from('security_breaches')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      throw error
    }
    if (!data) {
      return null
    }

    return fromStoredBreach(data as StoredBreach)
  } catch (error) {
    logger.error('Failed to retrieve security breach', {
      error,
      breachId: id,
    })
    throw new SecurityError('Failed to retrieve security breach', {
      cause: error,
    })
  }
}

/**
 * Delete a breach record (for compliance with data retention policies)
 */
export async function deleteBreach(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('security_breaches')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    logger.info('Deleted security breach record', { breachId: id })
  } catch (error) {
    logger.error('Failed to delete security breach', { error, breachId: id })
    throw new SecurityError('Failed to delete security breach', {
      cause: error,
    })
  }
}
