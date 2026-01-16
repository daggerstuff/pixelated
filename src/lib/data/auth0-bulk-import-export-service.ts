/**
 * Auth0 Bulk Import/Export Service
 * Implements bulk user import/export capabilities for administrators
 */

import { ManagementClient } from 'auth0'
import { Db } from 'mongodb'
import { createObjectCsvWriter } from 'csv-writer'
import { parse } from 'csv-parse'
import { mongodb } from '../../config/mongodb.config'
import { logSecurityEvent, SecurityEventType } from '../security/index'
import { updatePhase6AuthenticationProgress } from '../mcp/phase6-integration'
import { auth0UserService } from '../../services/auth0.service'

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
export interface BulkImportOptions {
  sendInvitationEmail?: boolean
  verifyEmail?: boolean
  persistUsers?: boolean
  connection?: string
}

export interface BulkExportOptions {
  format: 'json' | 'csv'
  includeMetadata?: boolean
  includeIdentities?: boolean
  includeRoles?: boolean
  filter?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface ImportResult {
  totalProcessed: number
  successfulImports: number
  failedImports: number
  errors: Array<{
    row: number
    email: string
    error: string
  }>
  jobId?: string
}

export interface ExportResult {
  totalExported: number
  format: 'json' | 'csv'
  fileSize: number
  downloadUrl?: string
  fileName: string
}

export interface UserImportData {
  email: string
  name?: string
  user_id?: string
  email_verified?: boolean
  app_metadata?: any
  user_metadata?: any
  password?: string
  connection?: string
  roles?: string[]
}

export interface UserExportData {
  user_id: string
  email: string
  email_verified: boolean
  name?: string
  nickname?: string
  picture?: string
  created_at: string
  updated_at: string
  last_login?: string
  logins_count: number
  app_metadata?: any
  user_metadata?: any
  identities?: any[]
  roles?: string[]
  permissions?: string[]
}

/**
 * Auth0 Bulk Import/Export Service
 * Implements bulk user import/export capabilities for administrators
 */
export class Auth0BulkImportExportService {
  private db: Db | null = null

  constructor() {
    if (!AUTH0_CONFIG.domain) {
      throw new Error('Auth0 is not properly configured')
    }
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
   * Import users from JSON data
   */
  async importUsersFromJson(users: UserImportData[], options: BulkImportOptions = {}, initiatedBy: string): Promise<ImportResult> {
    try {
      if (!auth0Management) {
        throw new Error('Auth0 management client not initialized')
      }

      const result: ImportResult = {
        totalProcessed: users.length,
        successfulImports: 0,
        failedImports: 0,
        errors: []
      }

      // Process users in batches to avoid rate limiting
      const batchSize = 50
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize)

        // Process batch
        for (let j = 0; j < batch.length; j++) {
          const user = batch[j]
          const rowIndex = i + j + 1

          try {
            // Create user in Auth0
            const auth0User = await auth0Management.users.create({
              email: user.email,
              name: user.name,
              user_id: user.user_id,
              email_verified: user.email_verified,
              app_metadata: user.app_metadata,
              user_metadata: user.user_metadata,
              password: user.password,
              connection: user.connection || options.connection || 'Username-Password-Authentication',
              verify_email: options.verifyEmail !== false, // Default to true
            })

            // Assign roles if provided
            if (user.roles && user.roles.length > 0 && auth0User.user_id) {
              // Map roles to Auth0 roles and assign them
              for (const role of user.roles) {
                try {
                  await auth0UserService.assignRoleToUser(auth0User.user_id, role as any)
                } catch (roleError) {
                  console.warn(`Failed to assign role ${role} to user ${auth0User.user_id}:`, roleError)
                }
              }
            }

            result.successfulImports++

            // Log successful import
            await logSecurityEvent(SecurityEventType.USER_BULK_IMPORT_SUCCESS, {
              auth0UserId: auth0User.user_id,
              importedBy: initiatedBy,
              email: user.email,
              rowIndex: rowIndex,
              timestamp: new Date().toISOString()
            })
          } catch (error) {
            result.failedImports++
            result.errors.push({
              row: rowIndex,
              email: user.email,
              error: error instanceof Error ? error.message : 'Unknown error'
            })

            // Log import error
            await logSecurityEvent(SecurityEventType.USER_BULK_IMPORT_ERROR, {
              importedBy: initiatedBy,
              email: user.email,
              rowIndex: rowIndex,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            })
          }
        }

        // Add small delay between batches to avoid rate limiting
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      // Log bulk import completion
      await logSecurityEvent(SecurityEventType.BULK_IMPORT_COMPLETED, {
        importedBy: initiatedBy,
        totalProcessed: result.totalProcessed,
        successfulImports: result.successfulImports,
        failedImports: result.failedImports,
        timestamp: new Date().toISOString()
      })

      // Update Phase 6 MCP server with import progress
      await updatePhase6AuthenticationProgress(initiatedBy, `bulk_import_completed_${result.successfulImports}_success`)

      return result
    } catch (error) {
      console.error('Failed to import users from JSON:', error)

      // Log bulk import error
      await logSecurityEvent(SecurityEventType.BULK_IMPORT_ERROR, {
        importedBy: initiatedBy,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })

      throw new Error(`Failed to import users: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Import users from CSV data
   */
  async importUsersFromCsv(csvData: string, options: BulkImportOptions = {}, initiatedBy: string): Promise<ImportResult> {
    try {
      // Parse CSV data
      const records = await new Promise<any[]>((resolve, reject) => {
        parse(csvData, {
          columns: true,
          skip_empty_lines: true
        }, (err, output) => {
          if (err) reject(err)
          else resolve(output)
        })
      })

      // Convert CSV records to UserImportData format
      const users: UserImportData[] = records.map(record => ({
        email: record.email,
        name: record.name,
        user_id: record.user_id,
        email_verified: record.email_verified === 'true' || record.email_verified === true,
        app_metadata: record.app_metadata ? JSON.parse(record.app_metadata) : undefined,
        user_metadata: record.user_metadata ? JSON.parse(record.user_metadata) : undefined,
        password: record.password,
        connection: record.connection,
        roles: record.roles ? record.roles.split(',').map((role: string) => role.trim()) : undefined
      }))

      // Import users
      return await this.importUsersFromJson(users, options, initiatedBy)
    } catch (error) {
      console.error('Failed to import users from CSV:', error)

      // Log CSV import error
      await logSecurityEvent(SecurityEventType.BULK_IMPORT_ERROR, {
        importedBy: initiatedBy,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })

      throw new Error(`Failed to import users from CSV: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Export users to JSON format
   */
  async exportUsersToJson(options: Partial<BulkExportOptions> = {}, initiatedBy: string): Promise<ExportResult> {
    try {
      if (!auth0Management) {
        throw new Error('Auth0 management client not initialized')
      }

      // Build query parameters
      const queryParams: any = {
        per_page: 100,
        page: 0,
        include_totals: true
      }

      const exportOptions = { ...options, format: 'json' as const }

      if (exportOptions.filter) {
        queryParams.q = exportOptions.filter
      }

      if (exportOptions.sortBy) {
        queryParams.sort = exportOptions.sortBy
      }

      // Get all users (paginate through results)
      const allUsers: UserExportData[] = []
      let total = 0
      let page = 0

      do {
        queryParams.page = page
        const { data } = await auth0Management.users.list(queryParams)

        // When include_totals is true, data is an object { users, total, ... }
        const usersPage = (data as any).users || data
        const totalCount = (data as any).total || (Array.isArray(data) ? (data as any).length : 0)

        // Transform users to export format
        const transformedUsers = usersPage.map((user: any) => ({
          user_id: user.user_id || '',
          email: user.email || '',
          email_verified: !!user.email_verified,
          name: user.name,
          nickname: user.nickname,
          picture: user.picture,
          created_at: String(user.created_at || ''),
          updated_at: String(user.updated_at || ''),
          last_login: user.last_login ? String(user.last_login) : undefined,
          logins_count: user.logins_count || 0,
          app_metadata: exportOptions.includeMetadata ? user.app_metadata : undefined,
          user_metadata: exportOptions.includeMetadata ? user.user_metadata : undefined,
          identities: exportOptions.includeIdentities ? user.identities : undefined,
          roles: exportOptions.includeRoles ? user.roles : undefined,
          permissions: exportOptions.includeRoles ? user.permissions : undefined
        }))

        allUsers.push(...transformedUsers)
        total = totalCount
        page++
      } while (allUsers.length < total)

      // Convert to JSON
      const jsonData = JSON.stringify(allUsers, null, 2)
      const fileSize = Buffer.byteLength(jsonData, 'utf8')

      // Log export completion
      await logSecurityEvent(SecurityEventType.BULK_EXPORT_COMPLETED, {
        exportedBy: initiatedBy,
        format: 'json',
        totalExported: allUsers.length,
        fileSize: fileSize,
        timestamp: new Date().toISOString()
      })

      // Update Phase 6 MCP server with export progress
      await updatePhase6AuthenticationProgress(initiatedBy, `bulk_export_completed_json_${allUsers.length}_users`)

      return {
        totalExported: allUsers.length,
        format: 'json',
        fileSize: fileSize,
        fileName: `users-export-${new Date().toISOString().slice(0, 10)}.json`
      }
    } catch (error) {
      console.error('Failed to export users to JSON:', error)

      // Log export error
      await logSecurityEvent(SecurityEventType.BULK_EXPORT_ERROR, {
        exportedBy: initiatedBy,
        format: 'json',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })

      throw new Error(`Failed to export users to JSON: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Export users to CSV format
   */
  async exportUsersToCsv(options: Partial<BulkExportOptions> = {}, initiatedBy: string): Promise<ExportResult> {
    try {
      if (!auth0Management) {
        throw new Error('Auth0 management client not initialized')
      }

      // Build query parameters
      const queryParams: any = {
        per_page: 100,
        page: 0,
        include_totals: true
      }

      const exportOptions = { ...options, format: 'csv' as const }

      if (exportOptions.filter) {
        queryParams.q = exportOptions.filter
      }

      if (exportOptions.sortBy) {
        queryParams.sort = exportOptions.sortBy
      }

      // Get all users (paginate through results)
      const allUsers: any[] = []
      let total = 0
      let page = 0

      do {
        queryParams.page = page
        const { data } = await auth0Management.users.list(queryParams)

        // When include_totals is true, data is an object { users, total, ... }
        const usersPage = (data as any).users || data
        const totalCount = (data as any).total || (Array.isArray(data) ? (data as any).length : 0)

        // Transform users to export format
        const transformedUsers = usersPage.map((user: any) => ({
          user_id: user.user_id || '',
          email: user.email || '',
          email_verified: !!user.email_verified,
          name: user.name,
          nickname: user.nickname,
          picture: user.picture,
          created_at: String(user.created_at || ''),
          updated_at: String(user.updated_at || ''),
          last_login: user.last_login ? String(user.last_login) : undefined,
          logins_count: user.logins_count || 0,
          app_metadata: exportOptions.includeMetadata ? JSON.stringify(user.app_metadata) : undefined,
          user_metadata: exportOptions.includeMetadata ? JSON.stringify(user.user_metadata) : undefined,
          identities: exportOptions.includeIdentities ? JSON.stringify(user.identities) : undefined,
          roles: exportOptions.includeRoles ? JSON.stringify(user.roles) : undefined,
          permissions: exportOptions.includeRoles ? JSON.stringify(user.permissions) : undefined
        }))

        allUsers.push(...transformedUsers)
        total = totalCount
        page++
      } while (allUsers.length < total)

      // Convert to CSV
      const csvWriter = createObjectCsvWriter({
        path: `/tmp/users-export-${Date.now()}.csv`,
        header: [
          { id: 'user_id', title: 'User ID' },
          { id: 'email', title: 'Email' },
          { id: 'email_verified', title: 'Email Verified' },
          { id: 'name', title: 'Name' },
          { id: 'nickname', title: 'Nickname' },
          { id: 'picture', title: 'Picture' },
          { id: 'created_at', title: 'Created At' },
          { id: 'updated_at', title: 'Updated At' },
          { id: 'last_login', title: 'Last Login' },
          { id: 'logins_count', title: 'Logins Count' },
          { id: 'app_metadata', title: 'App Metadata' },
          { id: 'user_metadata', title: 'User Metadata' },
          { id: 'identities', title: 'Identities' },
          { id: 'roles', title: 'Roles' },
          { id: 'permissions', title: 'Permissions' }
        ].filter(header => {
          // Only include headers for fields that we're actually exporting
          if (header.id === 'app_metadata' || header.id === 'user_metadata') {
            return options.includeMetadata
          }
          if (header.id === 'identities') {
            return options.includeIdentities
          }
          if (header.id === 'roles' || header.id === 'permissions') {
            return options.includeRoles
          }
          return true
        })
      })

      await csvWriter.writeRecords(allUsers)

      // In a real implementation, we would return the CSV data or a download URL
      // For now, we'll just return metadata
      const fileSize = allUsers.length * 200 // Approximate size

      // Log export completion
      await logSecurityEvent(SecurityEventType.BULK_EXPORT_COMPLETED, {
        exportedBy: initiatedBy,
        format: 'csv',
        totalExported: allUsers.length,
        fileSize: fileSize,
        timestamp: new Date().toISOString()
      })

      // Update Phase 6 MCP server with export progress
      await updatePhase6AuthenticationProgress(initiatedBy, `bulk_export_completed_csv_${allUsers.length}_users`)

      return {
        totalExported: allUsers.length,
        format: 'csv',
        fileSize: fileSize,
        fileName: `users-export-${new Date().toISOString().slice(0, 10)}.csv`
      }
    } catch (error) {
      console.error('Failed to export users to CSV:', error)

      // Log export error
      await logSecurityEvent(SecurityEventType.BULK_EXPORT_ERROR, {
        exportedBy: initiatedBy,
        format: 'csv',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })

      throw new Error(`Failed to export users to CSV: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get import job status
   */
  async getImportJobStatus(jobId: string, initiatedBy: string): Promise<any> {
    try {
      if (!auth0Management) {
        throw new Error('Auth0 management client not initialized')
      }

      // In a real implementation, we would query Auth0 for the job status
      // For now, we'll return a simulated response

      // Log job status check
      await logSecurityEvent(SecurityEventType.BULK_IMPORT_JOB_STATUS_CHECK, {
        jobId: jobId,
        checkedBy: initiatedBy,
        timestamp: new Date().toISOString()
      })

      // Update Phase 6 MCP server with job status check
      await updatePhase6AuthenticationProgress(initiatedBy, `bulk_import_job_status_check_${jobId}`)

      return {
        status: 'completed',
        jobId: jobId,
        progress: 100,
        summary: {
          total: 100,
          completed: 100,
          failed: 0
        }
      }
    } catch (error) {
      console.error('Failed to get import job status:', error)

      // Log job status check error
      await logSecurityEvent(SecurityEventType.BULK_IMPORT_JOB_STATUS_ERROR, {
        jobId: jobId,
        checkedBy: initiatedBy,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })

      throw new Error(`Failed to get import job status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate import data
   */
  async validateImportData(users: UserImportData[]): Promise<{
    isValid: boolean
    errors: Array<{
      row: number
      field: string
      error: string
    }>
  }> {
    const errors: Array<{
      row: number
      field: string
      error: string
    }> = []

    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      const rowIndex = i + 1

      // Validate email
      if (!user.email) {
        errors.push({
          row: rowIndex,
          field: 'email',
          error: 'Email is required'
        })
      } else if (!/\S+@\S+\.\S+/.test(user.email)) {
        errors.push({
          row: rowIndex,
          field: 'email',
          error: 'Invalid email format'
        })
      }

      // Validate roles if provided
      if (user.roles) {
        for (const role of user.roles) {
          if (!['admin', 'therapist', 'patient', 'researcher', 'support', 'guest'].includes(role)) {
            errors.push({
              row: rowIndex,
              field: 'roles',
              error: `Invalid role: ${role}`
            })
          }
        }
      }

      // Validate connection if provided
      if (user.connection) {
        const validConnections = [
          'Username-Password-Authentication',
          'google-oauth2',
          'facebook',
          'twitter',
          'github'
        ]
        if (!validConnections.includes(user.connection)) {
          errors.push({
            row: rowIndex,
            field: 'connection',
            error: `Invalid connection: ${user.connection}`
          })
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Generate sample import template
   */
  generateImportTemplate(format: 'json' | 'csv' = 'csv'): string | object {
    const sampleUsers: UserImportData[] = [
      {
        email: 'user1@example.com',
        name: 'User One',
        email_verified: true,
        app_metadata: { department: 'IT' },
        user_metadata: { age: 30, location: 'New York' },
        connection: 'Username-Password-Authentication',
        roles: ['patient']
      },
      {
        email: 'user2@example.com',
        name: 'User Two',
        email_verified: false,
        app_metadata: { department: 'HR' },
        user_metadata: { age: 25, location: 'California' },
        connection: 'google-oauth2',
        roles: ['therapist']
      }
    ]

    if (format === 'json') {
      return sampleUsers
    } else {
      // For CSV, return as string
      return `email,name,email_verified,app_metadata,user_metadata,connection,roles,password
user1@example.com,User One,true,"{""department"": ""IT""}","{""age"": 30, ""location"": ""New York""}",Username-Password-Authentication,patient,mypassword123
user2@example.com,User Two,false,"{""department"": ""HR""}","{""age"": 25, ""location"": ""California""}",google-oauth2,therapist,`
    }
  }

  /**
   * Get export history
   */
  async getExportHistory(limit: number = 50): Promise<any[]> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection('export_history')

      // Get recent exports
      const exports = await collection
        .find({})
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()

      return exports
    } catch (error) {
      console.error('Failed to get export history:', error)
      return []
    }
  }

  /**
   * Schedule recurring export
   */
  async scheduleRecurringExport(cronExpression: string, options: BulkExportOptions, initiatedBy: string): Promise<boolean> {
    try {
      // Connect to database
      const db = await this.connectToDatabase()
      const collection = db.collection('scheduled_exports')

      // Create scheduled export record
      await collection.insertOne({
        cronExpression,
        options,
        createdBy: initiatedBy,
        createdAt: new Date(),
        active: true
      })

      // Log scheduled export creation
      await logSecurityEvent(SecurityEventType.RECURRING_EXPORT_SCHEDULED, {
        scheduledBy: initiatedBy,
        cronExpression: cronExpression,
        options: options,
        timestamp: new Date().toISOString()
      })

      // Update Phase 6 MCP server with scheduled export
      await updatePhase6AuthenticationProgress(initiatedBy, `recurring_export_scheduled_${cronExpression}`)

      return true
    } catch (error) {
      console.error('Failed to schedule recurring export:', error)

      // Log scheduled export error
      await logSecurityEvent(SecurityEventType.RECURRING_EXPORT_SCHEDULE_ERROR, {
        scheduledBy: initiatedBy,
        cronExpression: cronExpression,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })

      return false
    }
  }
}

// Export singleton instance
export const auth0BulkImportExportService = new Auth0BulkImportExportService()
export default auth0BulkImportExportService