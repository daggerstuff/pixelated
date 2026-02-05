import { mongoClient } from './mongoClient'
import { createAuditLog } from '../audit'
import type { WithId, Document } from 'mongodb'

// User settings types
export interface UserSettings {
  _id?: string
  user_id: string
  theme: string
  notifications_enabled: boolean
  email_notifications: boolean
  language: string
  preferences: {
    showWelcomeScreen: boolean
    autoSave: boolean
    fontSize: string
    [key: string]: unknown
  }
  createdAt?: Date
  updatedAt?: Date
}

export interface NewUserSettings {
  user_id: string
  theme: string
  notifications_enabled: boolean
  email_notifications: boolean
  language: string
  preferences: {
    showWelcomeScreen: boolean
    autoSave: boolean
    fontSize: string
    [key: string]: unknown
  }
}

export interface UpdateUserSettings {
  theme?: string
  notifications_enabled?: boolean
  email_notifications?: boolean
  language?: string
  preferences?: {
    showWelcomeScreen?: boolean
    autoSave?: boolean
    fontSize?: string
    [key: string]: unknown
  }
}

/**
 * Get user settings
 */
export async function getUserSettings(
  userId: string,
): Promise<UserSettings | null> {
  await mongoClient.connect()
  const settings = await mongoClient.db
    .collection<UserSettings>('user_settings')
    .findOne({ user_id: userId }) as WithId<UserSettings> | null

  if (settings) {
    return {
      ...settings,
      _id: settings._id.toString(),
    }
  }

  return null
}

/**
 * Create user settings
 */
export async function createUserSettings(
  settings: NewUserSettings,
  request?: Request,
): Promise<UserSettings> {
  await mongoClient.connect()
  const collection = mongoClient.db.collection<UserSettings>('user_settings')

  const now = new Date()
  const newSettings = {
    ...settings,
    createdAt: now,
    updatedAt: now,
  }

  // Use Omit to satisfy insertOne typing if needed, or cast to any for simplicity in this heterogeneous codebase
  const result = await collection.insertOne(newSettings as any)

  const createdSettings = {
    ...newSettings,
    _id: result.insertedId.toString(),
  } as UserSettings

  // Log the event for HIPAA compliance
  const auditParams = {
    userId: settings.user_id,
    action: 'user_settings_created',
    resource: 'user_settings',
    metadata: {
      ipAddress: request?.headers.get('x-forwarded-for'),
      userAgent: request?.headers.get('user-agent'),
    },
  }
  await (createAuditLog as any)(auditParams)

  return createdSettings
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  userId: string,
  updates: UpdateUserSettings,
  request?: Request,
): Promise<UserSettings> {
  await mongoClient.connect()
  const collection = mongoClient.db.collection<UserSettings>('user_settings')

  const now = new Date()

  // Use findOneAndUpdate to get the updated document
  const result = await collection.findOneAndUpdate(
    { user_id: userId },
    {
      $set: {
        ...updates,
        updatedAt: now,
      },
    },
    { returnDocument: 'after', upsert: true }
  ) as any

  // Handle both ModifyResult (Node driver 4.x/5.x) and direct document (Node driver 6.x+)
  const updatedSettings = (result && 'value' in result ? result.value : result) as WithId<UserSettings> | null

  if (!updatedSettings) {
    throw new Error('Failed to update/create user settings')
  }

  const settingsWithId = {
    ...updatedSettings,
    _id: updatedSettings._id.toString(),
  } as UserSettings

  // Log the event for HIPAA compliance
  const auditParams = {
    userId,
    action: 'user_settings_updated',
    resource: 'user_settings',
    metadata: {
      updates,
      ipAddress: request?.headers.get('x-forwarded-for'),
      userAgent: request?.headers.get('user-agent'),
    },
  }
  await (createAuditLog as any)(auditParams)

  return settingsWithId
}

/**
 * Get or create user settings
 */
export async function getOrCreateUserSettings(
  userId: string,
  request?: Request,
): Promise<UserSettings> {
  // Try to get existing settings
  const settings = await getUserSettings(userId)

  // If settings exist, return them
  if (settings) {
    return settings
  }

  // Otherwise, create default settings
  const defaultSettings: NewUserSettings = {
    user_id: userId,
    theme: 'system',
    notifications_enabled: true,
    email_notifications: true,
    language: 'en',
    preferences: {
      showWelcomeScreen: true,
      autoSave: true,
      fontSize: 'medium',
    },
  }

  return createUserSettings(defaultSettings, request)
}

/**
 * Update theme preference
 */
export async function updateTheme(
  userId: string,
  theme: string,
  request?: Request,
): Promise<UserSettings> {
  return updateUserSettings(userId, { theme }, request)
}

/**
 * Update language preference
 */
export async function updateLanguage(
  userId: string,
  language: string,
  request?: Request,
): Promise<UserSettings> {
  return updateUserSettings(userId, { language }, request)
}

/**
 * Toggle notification settings
 */
export async function toggleNotifications(
  userId: string,
  enabled: boolean,
  request?: Request,
): Promise<UserSettings> {
  return updateUserSettings(userId, { notifications_enabled: enabled }, request)
}

/**
 * Toggle email notification settings
 */
export async function toggleEmailNotifications(
  userId: string,
  enabled: boolean,
  request?: Request,
): Promise<UserSettings> {
  return updateUserSettings(userId, { email_notifications: enabled }, request)
}
