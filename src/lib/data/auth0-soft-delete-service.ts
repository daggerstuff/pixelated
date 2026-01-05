/**
 * Auth0 Soft Delete Service
 * Implements soft delete functionality with data retention policies
 */

import { ManagementClient } from 'auth0'
import { Db, ObjectId } from 'mongodb'
import { mongodb } from '../../config/mongodb.config'
import { logSecurityEvent, SecurityEventType } from '../security/index'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'

// Auth0 Configuration
const AUTH0_CONFIG = {
  domain: process.env.AUTH0_DOMAIN || '',
  managementClientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID || '',
  managementClientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET || '',
}

// Initialize Auth0 management client
let auth0Management: ManagementClient | null = null

/**
 * Initialize Auth0 management client
 */
function initializeAuth0Management() {
  if (!AUTH0_CONFIG.domain || !AUTH0_CONFIG.managementClientId || !AUTH0_CONFIG.managementClientSecret) {
    throw new Error('Auth0 management configuration is incomplete. Please check environment variables.')
  }

  if (!auth0Management) {
    auth0Management = new ManagementClient({
      domain: AUTH0_CONFIG.domain,
      clientId: AUTH0_CONFIG.managementClientId,
      clientSecret: AUTH0_CONFIG.managementClientSecret,
      audience: `https://${AUTH0_CONFIG.domain}/api/v2/`,
      scope: 'read:users update:users delete:users'
    })
  }
}

// Initialize the management client
initializeAuth0Management()

// Types
export interface SoftDeletePolicy {
  retentionPeriod: number // in days
  purgeAfter: number // in days (after retention period)
  archiveBeforePurge: boolean
  notifyBeforePurge: boolean
  notificationDays: number // days before purge to notify
}

export interface DeletedUserRecord {
  _id: ObjectId
  auth0UserId: string
  email: string
  deletedAt: Date
  deletedBy: string
  reason: string
  retentionUntil: Date
  purgeScheduledAt: Date
  archived: boolean
  archivedAt?: Date
  notified: boolean
  userData: any // Archived user data
}

export interface SoftDeleteRequest {
  userId: string
  deletedBy: string
  reason: string
}

export interface PurgeSchedule {
  userId: string
  scheduledPurgeDate: Date
  retentionPeriod: number
  purgeAfter: number
}

/**
 * Auth0 Soft Delete Service
 * Implements soft delete functionality with data retention policies
 */
export class Auth0SoftDeleteService {
  private db: Db | null = null
  private collectionName = 'deleted_users'
  private defaultPolicy: SoftDeletePolicy

  constructor() {
    if (!AUTH0_CONFIG.domain) {
      throw new Error('Auth0 is not properly configured')
    }

    // Default retention policy
    this.defaultPolicy = {
      retentionPeriod: 30, // 30 days
      purgeAfter: 365, // 1 year after retention
      archiveBeforePurge: true,
      notifyBeforePurge: true,
      notificationDays: 30 // Notify 30 days before purge
    }

    // Periodically check for users to purge
    setInterval(() => {
      this.checkAndPurgeUsers().catch(error => {
        console.error('Error during periodic purge check:', error)
      })
    }, 86400000) // Every 24 hours
  }

  /**
   * Connect to MongoDB
   */
  private async connectToDatabase(): Promise<Db> {
    if (!this.db) {
      this.db = await mongodb.connect()
    }
    return this.db
  }

  /**
   * Soft delete a user
   */
  async softDeleteUser(deleteRequest: SoftDeleteRequest): Promise<boolean> {
    try {
      if (!auth0Management) {
        throw new Error('Auth0 management client not initialized')
      }

      // Get user information before deletion
      const user = await auth0Management.getUser({ id: deleteRequest.userId })
      if (!user) {
        throw new Error('User not found')
      }

      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<DeletedUserRecord>(this.collectionName)

      // Calculate retention and purge dates
      const now = new Date()
      const retentionUntil = new Date(now.getTime() + (this.defaultPolicy.retentionPeriod * 24 * 60 * 60 * 1000))
      const purgeScheduledAt = new Date(retentionUntil.getTime() + (this.defaultPolicy.purgeAfter * 24 * 60 * 60 * 1000))

      // Create deleted user record
      const deletedUserRecord: DeletedUserRecord = {
        _id: new ObjectId(),
        auth0UserId: user.user_id,
        email: user.email,
        deletedAt: now,
        deletedBy: deleteRequest.deletedBy,
        reason: deleteRequest.reason,
        retentionUntil,
        purgeScheduledAt,
        archived: false,
        notified: false,
        userData: {
          // Store relevant user data for compliance and audit purposes
          user_id: user.user_id,
          email: user.email,
          email_verified: user.email_verified,
          name: user.name,
          nickname: user.nickname,
          picture: user.picture,
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_login: user.last_login,
          logins_count: user.logins_count,
          app_metadata: user.app_metadata,
          user_metadata: user.user_metadata,
          identities: user.identities,
          roles: user.roles,
          permissions: user.permissions
        }
      }

      // Insert deleted user record
      await collection.insertOne(deletedUserRecord)

      // Update user in Auth0 to mark as deleted
      // We don't actually delete the user from Auth0, but mark them as inactive
      await auth0Management.updateUser(
        { id: deleteRequest.userId },
        {
          blocked: true,
          app_metadata: {
            ...user.app_metadata,
            deleted: true,
            deleted_at: now.toISOString(),
            deleted_by: deleteRequest.deletedBy,
            deletion_reason: deleteRequest.reason
          }
        }
      )

      // Log soft delete event
      await logSecurityEvent(SecurityEventType.USER_SOFT_DELETED, deleteRequest.userId, {
        deletedBy: deleteRequest.deletedBy,
        reason: deleteRequest.reason,
        retentionUntil: retentionUntil.toISOString(),
        purgeScheduledAt: purgeScheduledAt.toISOString(),
        timestamp: now.toISOString()
      })

      // Update Phase 6 MCP server with soft delete progress
      await updatePhase6AuthenticationProgress(deleteRequest.userId, 'user_soft_deleted')

      return true
    } catch (error) {
      console.error('Failed to soft delete user:', error)

      // Log soft delete error
      await logSecurityEvent(SecurityEventType.USER_SOFT_DELETE_ERROR, deleteRequest.userId, {
        deletedBy: deleteRequest.deletedBy,
        reason: deleteRequest.reason,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })

      return false
    }
  }

  /**
   * Restore a soft deleted user
   */
  async restoreUser(userId: string, restoredBy: string): Promise<boolean> {
    try {
      if (!auth0Management) {
        throw new Error('Auth0 management client not initialized')
      }

      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<DeletedUserRecord>(this.collectionName)

      // Find deleted user record
      const deletedUserRecord = await collection.findOne({ auth0UserId: userId })
      if (!deletedUserRecord) {
        throw new Error('Deleted user record not found')
      }

      // Restore user in Auth0
      await auth0Management.updateUser(
        { id: userId },
        {
          blocked: false,
          app_metadata: {
            ...deletedUserRecord.userData.app_metadata,
            deleted: undefined,
            deleted_at: undefined,
            deleted_by: undefined,
            deletion_reason: undefined
          }
        }
      )

      // Remove deleted user record
      await collection.deleteOne({ auth0UserId: userId })

      // Log user restore event
      await logSecurityEvent(SecurityEventType.USER_RESTORED, userId, {
        restoredBy: restoredBy,
        timestamp: new Date().toISOString()
      })

      // Update Phase 6 MCP server with restore progress
      await updatePhase6AuthenticationProgress(userId, 'user_restored')

      return true
    } catch (error) {
      console.error('Failed to restore user:', error)

      // Log restore error
      await logSecurityEvent(SecurityEventType.USER_RESTORE_ERROR, userId, {
        restoredBy: restoredBy,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })

      return false
    }
  }

  /**
   * Get soft deleted users
   */
  async getSoftDeletedUsers(limit: number = 100, offset: number = 0): Promise<DeletedUserRecord[]> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<DeletedUserRecord>(this.collectionName)

      // Get deleted users with pagination
      const deletedUsers = await collection
        .find({})
        .sort({ deletedAt: -1 })
        .skip(offset)
        .limit(limit)
        .toArray()

      return deletedUsers
    } catch (error) {
      console.error('Failed to get soft deleted users:', error)
      return []
    }
  }

  /**
   * Get soft deleted user by ID
   */
  async getSoftDeletedUserById(userId: string): Promise<DeletedUserRecord | null> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<DeletedUserRecord>(this.collectionName)

      // Find deleted user record
      const deletedUserRecord = await collection.findOne({ auth0UserId: userId })
      return deletedUserRecord
    } catch (error) {
      console.error('Failed to get soft deleted user:', error)
      return null
    }
  }

  /**
   * Check and purge users whose retention period has expired
   */
  async checkAndPurgeUsers(): Promise<void> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<DeletedUserRecord>(this.collectionName)

      const now = new Date()

      // Find users ready for purge
      const usersToPurge = await collection.find({
        purgeScheduledAt: { $lte: now },
        archived: this.defaultPolicy.archiveBeforePurge
      }).toArray()

      // Purge users
      for (const userRecord of usersToPurge) {
        await this.purgeUser(userRecord.auth0UserId)
      }

      // Find users to notify before purge
      if (this.defaultPolicy.notifyBeforePurge) {
        const notificationDate = new Date(now.getTime() + (this.defaultPolicy.notificationDays * 24 * 60 * 60 * 1000))
        const usersToNotify = await collection.find({
          purgeScheduledAt: { $lte: notificationDate, $gt: now },
          notified: false
        }).toArray()

        // Notify users
        for (const userRecord of usersToNotify) {
          await this.notifyUserBeforePurge(userRecord)
        }
      }
    } catch (error) {
      console.error('Failed to check and purge users:', error)
    }
  }

  /**
   * Purge a user completely
   */
  private async purgeUser(userId: string): Promise<boolean> {
    try {
      if (!auth0Management) {
        throw new Error('Auth0 management client not initialized')
      }

      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<DeletedUserRecord>(this.collectionName)

      // Get user record before purging
      const userRecord = await collection.findOne({ auth0UserId: userId })
      if (!userRecord) {
        return false
      }

      // Archive user data if policy requires it
      if (this.defaultPolicy.archiveBeforePurge) {
        await collection.updateOne(
          { auth0UserId: userId },
          {
            $set: {
              archived: true,
              archivedAt: new Date()
            }
          }
        )
      }

      // Completely delete user from Auth0
      await auth0Management.deleteUser({ id: userId })

      // Log user purge event
      await logSecurityEvent(SecurityEventType.USER_PURGED, userId, {
        retentionPeriod: this.defaultPolicy.retentionPeriod,
        purgeAfter: this.defaultPolicy.purgeAfter,
        timestamp: new Date().toISOString()
      })

      // Update Phase 6 MCP server with purge progress
      await updatePhase6AuthenticationProgress(userId, 'user_purged')

      return true
    } catch (error) {
      console.error('Failed to purge user:', error)

      // Log purge error
      await logSecurityEvent(SecurityEventType.USER_PURGE_ERROR, userId, {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })

      return false
    }
  }

  /**
   * Notify user before purge
   */
  private async notifyUserBeforePurge(userRecord: DeletedUserRecord): Promise<void> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<DeletedUserRecord>(this.collectionName)

      // In a real implementation, we would send an email notification
      // For now, we'll just mark the user as notified

      await collection.updateOne(
        { auth0UserId: userRecord.auth0UserId },
        { $set: { notified: true } }
      )

      // Log notification event
      await logSecurityEvent(SecurityEventType.USER_PURGE_NOTIFICATION_SENT, userRecord.auth0UserId, {
        notificationDays: this.defaultPolicy.notificationDays,
        purgeScheduledAt: userRecord.purgeScheduledAt.toISOString(),
        timestamp: new Date().toISOString()
      })

      // Update Phase 6 MCP server with notification progress
      await updatePhase6AuthenticationProgress(userRecord.auth0UserId, 'user_purge_notification_sent')
    } catch (error) {
      console.error('Failed to notify user before purge:', error)
    }
  }

  /**
   * Update retention policy
   */
  async updateRetentionPolicy(newPolicy: Partial<SoftDeletePolicy>): Promise<void> {
    this.defaultPolicy = { ...this.defaultPolicy, ...newPolicy }

    // Log policy update
    await logSecurityEvent(SecurityEventType.DATA_RETENTION_POLICY_UPDATED, null, {
      updatedPolicy: this.defaultPolicy,
      timestamp: new Date().toISOString()
    })

    console.log('Data retention policy updated:', this.defaultPolicy)
  }

  /**
   * Get current retention policy
   */
  getRetentionPolicy(): SoftDeletePolicy {
    return { ...this.defaultPolicy }
  }

  /**
   * Check if user is soft deleted
   */
  async isUserSoftDeleted(userId: string): Promise<boolean> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<DeletedUserRecord>(this.collectionName)

      // Check if user exists in deleted users collection
      const deletedUserRecord = await collection.findOne({ auth0UserId: userId })
      return !!deletedUserRecord
    } catch (error) {
      console.error('Failed to check if user is soft deleted:', error)
      return false
    }
  }

  /**
   * Get purge schedule for a user
   */
  async getUserPurgeSchedule(userId: string): Promise<PurgeSchedule | null> {
    try {
      const userRecord = await this.getSoftDeletedUserById(userId)
      if (!userRecord) {
        return null
      }

      return {
        userId: userRecord.auth0UserId,
        scheduledPurgeDate: userRecord.purgeScheduledAt,
        retentionPeriod: this.defaultPolicy.retentionPeriod,
        purgeAfter: this.defaultPolicy.purgeAfter
      }
    } catch (error) {
      console.error('Failed to get user purge schedule:', error)
      return null
    }
  }

  /**
   * Extend retention period for a user
   */
  async extendUserRetention(userId: string, additionalDays: number, extendedBy: string): Promise<boolean> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<DeletedUserRecord>(this.collectionName)

      // Get current user record
      const userRecord = await collection.findOne({ auth0UserId: userId })
      if (!userRecord) {
        throw new Error('User not found in deleted users collection')
      }

      // Extend retention period
      const newPurgeDate = new Date(userRecord.purgeScheduledAt.getTime() + (additionalDays * 24 * 60 * 60 * 1000))

      // Update user record
      await collection.updateOne(
        { auth0UserId: userId },
        {
          $set: {
            purgeScheduledAt: newPurgeDate
          }
        }
      )

      // Log retention extension
      await logSecurityEvent(SecurityEventType.USER_RETENTION_EXTENDED, userId, {
        extendedBy: extendedBy,
        additionalDays: additionalDays,
        newPurgeDate: newPurgeDate.toISOString(),
        timestamp: new Date().toISOString()
      })

      // Update Phase 6 MCP server with retention extension progress
      await updatePhase6AuthenticationProgress(userId, `user_retention_extended_${additionalDays}_days`)

      return true
    } catch (error) {
      console.error('Failed to extend user retention:', error)

      // Log retention extension error
      await logSecurityEvent(SecurityEventType.USER_RETENTION_EXTENSION_ERROR, userId, {
        extendedBy: extendedBy,
        additionalDays: additionalDays,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })

      return false
    }
  }
}

// Export singleton instance
export const auth0SoftDeleteService = new Auth0SoftDeleteService()
export default auth0SoftDeleteService