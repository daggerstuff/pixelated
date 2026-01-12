/**
 * Auth0 Activity Tracking Service
 * Implements real-time user activity tracking using Auth0 Logs API
 */

import { ManagementClient } from 'auth0'
import { Db } from 'mongodb'
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
    })
  }
}

// Initialize the management client
initializeAuth0Management()

// Types
export interface UserActivity {
  userId: string
  eventType: string
  timestamp: Date
  ipAddress: string
  userAgent: string
  location?: {
    country?: string
    city?: string
  }
  details?: any
}

export interface ActivityFilter {
  userId?: string
  eventType?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

export interface RealTimeActivityConfig {
  pollInterval: number // in milliseconds
  batchSize: number
  enableRealTime: boolean
  logRetentionDays: number
}

export interface ActivitySummary {
  userId: string
  totalActivities: number
  lastActivity: Date
  mostCommonEventType: string
  activeDays: number
  ipAddressCount: number
}

export interface SecurityEvent {
  id: string
  type: SecurityEventType
  userId?: string
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  ipAddress?: string
  userAgent?: string
  details?: any
}

/**
 * Auth0 Activity Tracking Service
 * Implements real-time user activity tracking using Auth0 Logs API
 */
export class Auth0ActivityTrackingService {
  private db: Db | null = null
  private collectionName = 'user_activities'
  private securityEventsCollectionName = 'security_events'
  private config: RealTimeActivityConfig
  private pollingInterval: NodeJS.Timeout | null = null
  private lastLogId: string | null = null

  constructor() {
    if (!AUTH0_CONFIG.domain) {
      throw new Error('Auth0 is not properly configured')
    }

    // Default configuration
    this.config = {
      pollInterval: 30000, // 30 seconds
      batchSize: 100,
      enableRealTime: true,
      logRetentionDays: 90 // 90 days
    }

    // Start real-time tracking if enabled
    if (this.config.enableRealTime) {
      this.startRealTimeTracking()
    }

    // Periodically clean up old logs
    setInterval(() => {
      this.cleanupOldLogs().catch(error => {
        console.error('Error during log cleanup:', error)
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
   * Start real-time activity tracking
   */
  startRealTimeTracking(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
    }

    this.pollingInterval = setInterval(() => {
      this.fetchAndStoreRecentActivities().catch(error => {
        console.error('Error fetching recent activities:', error)
      })
    }, this.config.pollInterval)

    console.log('Started real-time activity tracking')
  }

  /**
   * Stop real-time activity tracking
   */
  stopRealTimeTracking(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
      console.log('Stopped real-time activity tracking')
    }
  }

  /**
   * Fetch and store recent activities from Auth0 Logs
   */
  private async fetchAndStoreRecentActivities(): Promise<void> {
    try {
      if (!auth0Management) {
        throw new Error('Auth0 management client not initialized')
      }

      // Build query parameters
      const queryParams: any = {
        per_page: this.config.batchSize,
        sort: 'date:1', // Sort by date ascending
        include_totals: false
      }

      // If we have a last log ID, fetch logs after that ID
      if (this.lastLogId) {
        queryParams.from = this.lastLogId
      }

      // Fetch logs from Auth0
      const response = await auth0Management.logs.list(queryParams)
      const logs = response.data

      if (logs.length === 0) {
        return
      }

      // Update last log ID to the ID of the last log fetched
      this.lastLogId = logs[logs.length - 1].log_id || null

      // Transform and store logs
      const activities: UserActivity[] = logs
        .filter(log => log.user_id) // Only logs with user ID
        .map(log => ({
          userId: log.user_id!,
          eventType: log.type || 'unknown',
          timestamp: new Date(String(log.date || '')),
          ipAddress: log.ip || '',
          userAgent: log.user_agent || '',
          location: log.location_info ? {
            country: log.location_info.country_name,
            city: log.location_info.city_name
          } : undefined,
          details: {
            description: log.description,
            client_id: log.client_id,
            connection: log.connection,
            connection_id: log.connection_id,
            hostname: log.hostname,
            audience: log.audience
          }
        }))

      // Store activities in database
      if (activities.length > 0) {
        await this.storeActivities(activities)
      }

      // Process security events
      await this.processSecurityEvents(logs)

    } catch (error) {
      console.error('Failed to fetch and store recent activities:', error)
    }
  }

  /**
   * Store activities in database
   */
  private async storeActivities(activities: UserActivity[]): Promise<void> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<UserActivity>(this.collectionName)

      // Insert activities
      if (activities.length > 0) {
        await collection.insertMany(activities)
      }
    } catch (error) {
      console.error('Failed to store activities:', error)
    }
  }

  /**
   * Process security events from Auth0 logs
   */
  private async processSecurityEvents(logs: any[]): Promise<void> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<SecurityEvent>(this.securityEventsCollectionName)

      // Process each log for security events
      for (const log of logs) {
        let securityEvent: SecurityEvent | null = null

        // Map Auth0 log types to security event types
        switch (log.type) {
          case 'f': // Failed login
            securityEvent = {
              id: log.log_id,
              type: SecurityEventType.AUTHENTICATION_FAILED,
              userId: log.user_id,
              timestamp: new Date(log.date),
              severity: 'medium',
              description: log.description || 'Failed login attempt',
              ipAddress: log.ip,
              userAgent: log.user_agent,
              details: {
                connection: log.connection,
                client_id: log.client_id
              }
            }
            break

          case 'fp': // Failed login (password)
            securityEvent = {
              id: log.log_id,
              type: SecurityEventType.AUTHENTICATION_FAILED,
              userId: log.user_id,
              timestamp: new Date(log.date),
              severity: 'medium',
              description: log.description || 'Failed password login attempt',
              ipAddress: log.ip,
              userAgent: log.user_agent,
              details: {
                connection: log.connection,
                client_id: log.client_id
              }
            }
            break

          case 'fs': // Failed login (signup)
            securityEvent = {
              id: log.log_id,
              type: SecurityEventType.AUTHENTICATION_FAILED,
              userId: log.user_id,
              timestamp: new Date(log.date),
              severity: 'medium',
              description: log.description || 'Failed signup attempt',
              ipAddress: log.ip,
              userAgent: log.user_agent,
              details: {
                connection: log.connection,
                client_id: log.client_id
              }
            }
            break

          case 'limit_wc': // Too many failed attempts
            securityEvent = {
              id: log.log_id,
              type: SecurityEventType.RATE_LIMIT_EXCEEDED,
              userId: log.user_id,
              timestamp: new Date(log.date),
              severity: 'high',
              description: log.description || 'Rate limit exceeded',
              ipAddress: log.ip,
              userAgent: log.user_agent,
              details: {
                connection: log.connection,
                client_id: log.client_id
              }
            }
            break

          case 'limit_ui': // Too many signups
            securityEvent = {
              id: log.log_id,
              type: SecurityEventType.RATE_LIMIT_EXCEEDED,
              userId: log.user_id,
              timestamp: new Date(log.date),
              severity: 'high',
              description: log.description || 'Signup rate limit exceeded',
              ipAddress: log.ip,
              userAgent: log.user_agent,
              details: {
                connection: log.connection,
                client_id: log.client_id
              }
            }
            break

          case 's': // Success login
            // Log successful authentication
            await logSecurityEvent(SecurityEventType.AUTHENTICATION_SUCCESS, {
              userId: log.user_id,
              logId: log.log_id,
              ipAddress: log.ip,
              userAgent: log.user_agent,
              timestamp: new Date(String(log.date || '')).toISOString()
            })
            break
        }

        // Store security event if we created one
        if (securityEvent) {
          await collection.insertOne(securityEvent)

          // Also log to the main security event system
          await logSecurityEvent(securityEvent.type, {
            userId: securityEvent.userId,
            logId: securityEvent.id,
            severity: securityEvent.severity,
            description: securityEvent.description,
            ipAddress: securityEvent.ipAddress,
            userAgent: securityEvent.userAgent,
            details: securityEvent.details,
            timestamp: securityEvent.timestamp.toISOString()
          })
        }
      }
    } catch (error) {
      console.error('Failed to process security events:', error)
    }
  }

  /**
   * Get user activities with filtering
   */
  async getUserActivities(filter: ActivityFilter = {}): Promise<UserActivity[]> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<UserActivity>(this.collectionName)

      // Build query
      const query: any = {}

      if (filter.userId) {
        query.userId = filter.userId
      }

      if (filter.eventType) {
        query.eventType = filter.eventType
      }

      if (filter.startDate || filter.endDate) {
        query.timestamp = {}
        if (filter.startDate) {
          query.timestamp.$gte = filter.startDate
        }
        if (filter.endDate) {
          query.timestamp.$lte = filter.endDate
        }
      }

      // Build options
      const options: any = {}

      if (filter.limit) {
        options.limit = filter.limit
      }

      if (filter.offset) {
        options.skip = filter.offset
      }

      options.sort = { timestamp: -1 } // Sort by timestamp descending

      // Execute query
      const activities = await collection.find(query, options).toArray()
      return activities
    } catch (error) {
      console.error('Failed to get user activities:', error)
      return []
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(userId: string): Promise<ActivitySummary | null> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<UserActivity>(this.collectionName)

      // Get all activities for user
      const activities = await collection.find({ userId }).sort({ timestamp: -1 }).toArray()

      if (activities.length === 0) {
        return null
      }

      // Calculate summary statistics
      const eventTypes = activities.reduce((acc: Record<string, number>, activity) => {
        acc[activity.eventType] = (acc[activity.eventType] || 0) + 1
        return acc
      }, {})

      const mostCommonEventType = Object.keys(eventTypes).reduce((a, b) =>
        eventTypes[a] > eventTypes[b] ? a : b
      )

      const ipAddresses = Array.from(new Set(activities.map(a => a.ipAddress)))

      // Calculate active days
      const activeDays = new Set(
        activities.map(a => a.timestamp.toISOString().split('T')[0])
      ).size

      return {
        userId,
        totalActivities: activities.length,
        lastActivity: activities[0].timestamp,
        mostCommonEventType,
        activeDays,
        ipAddressCount: ipAddresses.length
      }
    } catch (error) {
      console.error('Failed to get user activity summary:', error)
      return null
    }
  }

  /**
   * Get security events
   */
  async getSecurityEvents(limit: number = 100, severity?: 'low' | 'medium' | 'high' | 'critical'): Promise<SecurityEvent[]> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<SecurityEvent>(this.securityEventsCollectionName)

      // Build query
      const query: any = {}

      if (severity) {
        query.severity = severity
      }

      // Execute query
      const events = await collection
        .find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()

      return events
    } catch (error) {
      console.error('Failed to get security events:', error)
      return []
    }
  }

  /**
   * Get real-time activity stream
   */
  async getRealTimeActivityStream(limit: number = 50): Promise<UserActivity[]> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<UserActivity>(this.collectionName)

      // Get most recent activities
      const activities = await collection
        .find({})
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()

      return activities
    } catch (error) {
      console.error('Failed to get real-time activity stream:', error)
      return []
    }
  }

  /**
   * Get user session information
   */
  async getUserSessions(userId: string): Promise<any[]> {
    try {
      if (!auth0Management) {
        throw new Error('Auth0 management client not initialized')
      }

      // Get user's sessions from Auth0
      const response = await auth0Management.users.sessions.list(userId)
      const sessions = response.data

      return sessions.map(session => ({
        id: session.id,
        clientId: session.clients?.[0]?.client_id,
        ipAddress: session.clients?.[0]?.last_ip || '',
        userAgent: session.device?.user_agent || '',
        startedAt: session.created_at ? new Date(String(session.created_at)) : undefined,
        lastUpdatedAt: session.updated_at ? new Date(String(session.updated_at)) : undefined,
        expiresAt: session.expires_at ? new Date(String(session.expires_at)) : undefined,
        location: undefined // Location is not directly available in the same way
      }))
    } catch (error) {
      console.error('Failed to get user sessions:', error)
      return []
    }
  }

  /**
   * Terminate user session
   */
  async terminateUserSession(userId: string, sessionId: string): Promise<boolean> {
    try {
      if (!auth0Management) {
        throw new Error('Auth0 management client not initialized')
      }

      // Terminate session in Auth0
      await auth0Management.sessions.delete(sessionId)

      // Log session termination
      await logSecurityEvent(SecurityEventType.SESSION_TERMINATED, {
        userId: userId,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      })

      // Update Phase 6 MCP server with session termination
      await updatePhase6AuthenticationProgress(userId, `session_terminated_${sessionId}`)

      return true
    } catch (error) {
      console.error('Failed to terminate user session:', error)

      // Log session termination error
      await logSecurityEvent(SecurityEventType.SESSION_TERMINATION_ERROR, {
        userId: userId,
        sessionId: sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })

      return false
    }
  }

  /**
   * Update real-time tracking configuration
   */
  async updateConfiguration(newConfig: Partial<RealTimeActivityConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig }

    // Restart tracking if interval changed
    if (newConfig.pollInterval && this.config.enableRealTime) {
      this.startRealTimeTracking()
    }

    // Log configuration update
    await logSecurityEvent(SecurityEventType.CONFIGURATION_CHANGED, {
      configType: 'activity_tracking',
      changes: Object.keys(newConfig),
      timestamp: new Date().toISOString()
    })

    console.log('Activity tracking configuration updated:', this.config)
  }

  /**
   * Get current configuration
   */
  getConfiguration(): RealTimeActivityConfig {
    return { ...this.config }
  }

  /**
   * Cleanup old logs based on retention policy
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<UserActivity>(this.collectionName)

      // Calculate cutoff date
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.logRetentionDays)

      // Delete old activities
      const result = await collection.deleteMany({
        timestamp: { $lt: cutoffDate }
      })

      console.log(`Cleaned up ${result.deletedCount} old activity logs`)
    } catch (error) {
      console.error('Failed to cleanup old logs:', error)
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStatistics(): Promise<{
    totalActivities: number
    activeUsers: number
    recentActivity: number
    securityEvents: number
  }> {
    try {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 3600000) // 1 hour ago

      // Connect to database
      const db = await this.connectToDatabase()
      const activitiesCollection = db.collection<UserActivity>(this.collectionName)
      const securityEventsCollection = db.collection<SecurityEvent>(this.securityEventsCollectionName)

      // Get statistics
      const totalActivities = await activitiesCollection.countDocuments()
      const activeUsers = (await activitiesCollection.distinct('userId')).length
      const recentActivity = await activitiesCollection.countDocuments({
        timestamp: { $gte: oneHourAgo }
      })
      const securityEvents = await securityEventsCollection.countDocuments()

      return {
        totalActivities,
        activeUsers,
        recentActivity,
        securityEvents
      }
    } catch (error) {
      console.error('Failed to get activity statistics:', error)
      return {
        totalActivities: 0,
        activeUsers: 0,
        recentActivity: 0,
        securityEvents: 0
      }
    }
  }

  /**
   * Search activities by keyword
   */
  async searchActivities(keyword: string, limit: number = 50): Promise<UserActivity[]> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection<UserActivity>(this.collectionName)

      // Search for activities containing the keyword
      const activities = await collection
        .find({
          $or: [
            { 'details.description': { $regex: keyword, $options: 'i' } },
            { eventType: { $regex: keyword, $options: 'i' } },
            { ipAddress: { $regex: keyword, $options: 'i' } }
          ]
        })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()

      return activities
    } catch (error) {
      console.error('Failed to search activities:', error)
      return []
    }
  }
}

// Export singleton instance
export const auth0ActivityTrackingService = new Auth0ActivityTrackingService()
export default auth0ActivityTrackingService