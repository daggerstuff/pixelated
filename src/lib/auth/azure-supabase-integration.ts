import type { Db, ObjectId as MongoObjectIdType } from 'mongodb'
import {
  azureADAuth,
  type AzureADUser,
  type AzureADAuthResult,
} from './azure-ad'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('azure-mongodb-integration')

// Define a reusable mock for ObjectId
class MockObjectId {
  private id: string
  constructor(id?: string) {
    this.id = id || 'mock-object-id'
  }
  toString() {
    return this.id
  }
  toHexString() {
    return this.id
  }
  static isValid() {
    return true
  }
}

// Type definitions for dynamically loaded modules
type MongoConnection = {
  connect: () => Promise<Db>
  getDb: () => Db
  client?: unknown
}

type MongoAuthService = {
  signIn: (
    email: string,
    password_placeholder: string,
  ) => Promise<{ accessToken: string; refreshToken: string }>
}

let mongodb: MongoConnection | null = null
let mongoAuthService: MongoAuthService | null = null
let ObjectId: typeof MongoObjectIdType | typeof MockObjectId | null = null

let serverDepsPromise: Promise<void> | null = null

function initializeDependencies() {
  if (serverDepsPromise) {
    return serverDepsPromise
  }

  if (typeof window === 'undefined') {
    // Server-side: dynamically import dependencies
    serverDepsPromise = (async () => {
      try {
        mongodb = (await import('@/config/mongodb.config')).default
        mongoAuthService = (await import('@/services/mongoAuth.service'))
          .mongoAuthService
        const mongodbLib = await import('mongodb')
        ObjectId = mongodbLib.ObjectId
      } catch (err) {
        // Fallback for server-side if imports fail
        logger.error('Failed to load server-side MongoDB dependencies', err)
        mongodb = null
        mongoAuthService = null
        ObjectId = MockObjectId
      }
    })()
  } else {
    // Client-side: use mock implementations
    mongodb = null
    mongoAuthService = null
    ObjectId = MockObjectId
    serverDepsPromise = Promise.resolve()
  }
  return serverDepsPromise
}

// Utility to validate ObjectId strings
function isValidObjectId(id: string): boolean {
  if (typeof id !== 'string') {
    return false;
  }
  // 24 hex chars or 12 bytes
  return /^[a-fA-F0-9]{24}$/.test(id);
}

/**
 * Utility to strictly validate Azure AD IDs (UUID or 32 hex chars)
 */
function isValidAzureId(id: string): boolean {
  if (typeof id !== 'string') {
    return false;
  }
  // UUID v4 or 32 hex chars
  return /^[a-fA-F0-9]{32}$/.test(id) || /^[0-9a-fA-F-]{36}$/.test(id);
}

export interface IntegratedUser {
  id: string
  email: string
  name: string
  azureId: string
  mongoId: string
  roles: string[]
  metadata: {
    azureAD: AzureADUser
    lastLogin: string
    provider: 'azure-ad'
  }
}

export interface AuthSession {
  user: IntegratedUser
  accessToken: string
  refreshToken: string
  expiresAt: number
}

/**
 * Azure AD + MongoDB Integration Service
 * Manages authentication flow between Azure AD and MongoDB Atlas
 */
export class AzureMongoIntegration {
  // MongoDB connection is handled by the mongodb config singleton

  /**
   * Authenticate user with Azure AD and create/update MongoDB user
   */
  async authenticateWithAzureAD(
    code: string,
    redirectUri?: string,
  ): Promise<AuthSession> {
    await initializeDependencies()
    try {
      // Authenticate with Azure AD
      const azureResult = await azureADAuth.authenticate(code, redirectUri)

      // Create or update user in MongoDB
      const integratedUser = await this.createOrUpdateMongoUser(azureResult)

      // Create MongoDB session
      const session = await this.createMongoSession(
        integratedUser,
        azureResult,
      )

      logger.info('Azure AD + MongoDB authentication successful', {
        azureId: azureResult.user.id,
        mongoId: integratedUser.mongoId,
        email: integratedUser.email,
      })

      return session
    } catch (error: unknown) {
      logger.error('Azure AD + MongoDB authentication failed', {
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  /**
   * Create or update user in MongoDB based on Azure AD user
   */
  private async createOrUpdateMongoUser(
    azureResult: AzureADAuthResult,
  ): Promise<IntegratedUser> {
    const { user: azureUser } = azureResult

    try {
      if (!mongodb || !ObjectId) {
        throw new Error('MongoDB not available')
      }
      
      const db = await mongodb.connect()
      const usersCollection = db.collection('users')

      // Check if user already exists in MongoDB
      // Validate azureUser.id is a string and matches expected format (UUID or Azure AD ID pattern)
      // SECURITY: Validate Azure AD user id with explicit utility
      const safeAzureId = isValidAzureId(azureUser.id) ? azureUser.id : '';
      if (!safeAzureId) {
        throw new Error('Invalid Azure AD user id');
      }

      // SECURITY: Only a validated, locally-scoped value is used in the query. No user input is passed directly.
      const queryAzureId = safeAzureId;
      const existingUser = await usersCollection.findOne({
        azure_id: queryAzureId,
      });
      
      const userData = {
        email: typeof azureUser.email === 'string' ? azureUser.email : '',
        name: typeof azureUser.name === 'string' ? azureUser.name : '',
        azure_id: safeAzureId,
        metadata: {
          azureAD: azureUser,
          lastLogin: new Date().toISOString(),
          provider: 'azure-ad' as const,
        },
        updatedAt: new Date(),
      }
      
      let mongoUser
      
      if (existingUser) {
        // Validate _id is a valid ObjectId
        // Strictly validate and convert _id to ObjectId
        const rawMongoId = existingUser._id;
        const safeMongoId = (rawMongoId && ObjectId.isValid(rawMongoId)) ? new ObjectId(rawMongoId) : null;
        if (!safeMongoId) {
          throw new Error('Invalid MongoDB user _id');
        }
        // SECURITY: Only a validated, locally-scoped ObjectId is used in the query. No user input is passed directly.
        const queryMongoId = safeMongoId;
        await usersCollection.updateOne(
          { _id: queryMongoId },
          { $set: userData }
        );
        // SECURITY: Only a validated, locally-scoped ObjectId is used in the query. No user input is passed directly.
        mongoUser = await usersCollection.findOne({ _id: queryMongoId });
      } else {
        // Create new user
        const insertResult = await usersCollection.insertOne({
          ...userData,
          createdAt: new Date(),
          role: 'user', // Default role
        })
        // Validate insertedId is a valid ObjectId
        // Strictly validate and convert insertedId to ObjectId
        const rawInsertedId = insertResult.insertedId;
        const safeInsertedId = (rawInsertedId && ObjectId.isValid(rawInsertedId)) ? new ObjectId(rawInsertedId) : null;
        if (!safeInsertedId) {
          throw new Error('Invalid insertedId for new MongoDB user');
        }
        // SECURITY: Only a validated, locally-scoped ObjectId is used in the query. No user input is passed directly.
        const queryInsertedId = safeInsertedId;
        mongoUser = await usersCollection.findOne({ _id: queryInsertedId });
      }

      if (!mongoUser) {
        throw new Error('Failed to create or update user')
      }

      // Get user roles (for this example, we'll use the role field directly)
      const roles = [mongoUser['role'] || 'user']

      return {
        id: mongoUser._id.toString(),
        email: mongoUser['email'],
        name: mongoUser['name'],
        azureId: azureUser.id,
        mongoId: mongoUser._id.toString(),
        roles,
        metadata: mongoUser['metadata'],
      }
    } catch (error: unknown) {
      logger.error('Error creating/updating MongoDB user', {
        azureId: azureUser.id,
        email: azureUser.email,
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  /**
   * Create MongoDB session for the integrated user
   */
  private async createMongoSession(
    user: IntegratedUser,
    azureResult: AzureADAuthResult,
  ): Promise<AuthSession> {
    try {
      if (!mongoAuthService) {
        throw new Error('MongoDB auth service not available')
      }
      
      // Create session using MongoDB auth service
      const authResult = await mongoAuthService.signIn(user.email, 'azure-ad-placeholder')
      
      return {
        user,
        accessToken: authResult.accessToken,
        refreshToken: azureResult.tokens.refreshToken || '',
        expiresAt: azureResult.tokens.expiresAt,
      }
    } catch (error: unknown) {
      logger.error('Error creating MongoDB session', {
        userId: user.id,
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  /**
   * Refresh authentication session
   */
  async refreshSession(refreshToken: string): Promise<AuthSession> {
    await initializeDependencies()
    try {
      // Refresh Azure AD token
      const newTokens = await azureADAuth.refreshAccessToken(refreshToken)

      // Get updated user info
      const azureUser = await azureADAuth.getUserInfo(newTokens.accessToken)

      // Update user in MongoDB
      if (!mongodb) {
        throw new Error('MongoDB not available')
      }
      const db = await mongodb.connect()
      const usersCollection = db.collection('users')
      
      const mongoUser = await usersCollection.findOneAndUpdate(
        { azure_id: azureUser.id },
        {
          $set: {
            metadata: {
              azureAD: azureUser,
              lastLogin: new Date().toISOString(),
              provider: 'azure-ad',
            },
            updatedAt: new Date(),
          }
        },
        { returnDocument: 'after' }
      )

      if (!mongoUser) {
        throw new Error('User not found')
      }

      // Get user roles
      const roles = [mongoUser['role'] || 'user']

      const integratedUser: IntegratedUser = {
        id: mongoUser._id.toString(),
        email: mongoUser['email'],
        name: mongoUser['name'],
        azureId: azureUser.id,
        mongoId: mongoUser._id.toString(),
        roles,
        metadata: mongoUser['metadata'],
      }

      return {
        user: integratedUser,
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken || refreshToken,
        expiresAt: newTokens.expiresAt,
      }
    } catch (error: unknown) {
      logger.error('Error refreshing session', {
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  /**
   * Sign out user from both Azure AD and MongoDB
   */
  async signOut(
    userId: string,
    postLogoutRedirectUri?: string,
  ): Promise<string> {
    await initializeDependencies()
    try {
      // Update last logout in MongoDB
      if (!mongodb) {
        throw new Error('MongoDB not available')
      }
      const db = await mongodb.connect()
      const usersCollection = db.collection('users')
      
      if (!ObjectId) {
        throw new Error('ObjectId not available')
      }
      await usersCollection.updateOne(
        { _id: isValidObjectId(userId) ? new ObjectId(userId) : undefined },
        {
          $set: {
            'metadata.lastLogout': new Date().toISOString(),
            updatedAt: new Date(),
          }
        }
      )

      // Get Azure AD logout URL
      const logoutUrl = azureADAuth.getLogoutUrl(postLogoutRedirectUri)

      logger.info('User signed out', { userId })

      return logoutUrl
    } catch (error: unknown) {
      logger.error('Error during sign out', {
        userId,
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  /**
   * Get user by MongoDB ID
   */
  /**
   * Fetches a user by their MongoDB ObjectId.
   * Validates the ObjectId before querying to prevent NoSQL injection.
   */
  async getUserById(userId: string): Promise<IntegratedUser | null> {
    await initializeDependencies()
    try {
      if (!isValidObjectId(userId)) {
        logger.warn('Attempted to fetch user with invalid ObjectId', { userId });
        return null;
      }
      if (!mongodb) {
        throw new Error('MongoDB not available')
      }
      const db = await mongodb.connect()
      const usersCollection = db.collection('users')
      
      if (!ObjectId) {
        throw new Error('ObjectId not available')
      }
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) })
  
      if (!user) {
        return null
      }
  
      // Get user roles
      const roles = [user['role'] || 'user']
  
      return {
        id: user._id.toString(),
        email: user['email'],
        name: user['name'],
        azureId: user['azure_id'],
        mongoId: user._id.toString(),
        roles,
        metadata: user['metadata'],
      }
    } catch (error: unknown) {
      logger.error('Error getting user by ID', {
        userId,
        error: error instanceof Error ? String(error) : String(error),
      })
      return null
    }
  }

  /**
   * Validate session
   */
  async validateSession(accessToken: string): Promise<boolean> {
    return await azureADAuth.validateToken(accessToken)
  }
}

// Export singleton instance
export const azureMongoIntegration = new AzureMongoIntegration()
export default azureMongoIntegration
