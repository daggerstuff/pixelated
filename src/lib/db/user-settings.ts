// Use server-only helper for MongoDB types
import type { ObjectId } from '../server-only/mongodb-types'
import { mongoClient } from './mongoClient'

let ObjectId: unknown

// MongoDB-based user settings types

export interface UserSettings {
  _id?: ObjectId
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
  const settings = await mongoClient.db
    .collection('user_settings')
    .findOne({ user_id: userId })

  return settings as unknown as UserSettings | null
}

/**
 * Create user settings
 */
export async function createUserSettings(
  settings: NewUserSettings,
  _request?: Request,
): Promise<UserSettings> {
  await ensureUserSettingsIndex()
  const now = new Date()
  const result = await mongoClient.db
    .collection('user_settings')
    .findOneAndUpdate(
      { user_id: settings.user_id },
      {
        $setOnInsert: {
          ...settings,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' },
    )

  return result as unknown as UserSettings
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  userId: string,
  updates: UpdateUserSettings,
  _request?: Request,
): Promise<UserSettings> {
  const set: Record<string, unknown> = { updatedAt: new Date() }
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'preferences' && value && typeof value === 'object') {
      for (const [pkey, pval] of Object.entries(
        value as Record<string, unknown>,
      )) {
        set[`preferences.${pkey}`] = pval
      }
    } else {
      set[key] = value
    }
  }

  const result = await mongoClient.db
    .collection('user_settings')
    .findOneAndUpdate(
      { user_id: userId },
      { $set: set },
      { returnDocument: 'after' },
    )

  if (!result) {
    throw new Error('Failed to update user settings')
  }

  return result as unknown as UserSettings
}

let userSettingsIndexEnsured = false

async function ensureUserSettingsIndex(): Promise<void> {
  if (userSettingsIndexEnsured) return
  await mongoClient.db
    .collection('user_settings')
    .createIndex({ user_id: 1 }, { unique: true })
  userSettingsIndexEnsured = true
}

/**
 * Get or create user settings
 *
 * Uses an atomic findOneAndUpdate with upsert so concurrent callers cannot
 * create duplicate documents for the same user. A unique index on `user_id`
 * enforces the invariant at the database level.
 */
export async function getOrCreateUserSettings(
  userId: string,
  _request?: Request,
): Promise<UserSettings> {
  await ensureUserSettingsIndex()

  const now = new Date()
  const result = await mongoClient.db
    .collection('user_settings')
    .findOneAndUpdate(
      { user_id: userId },
      {
        $setOnInsert: {
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
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' },
    )

  if (!result) {
    throw new Error('Failed to get or create user settings')
  }

  return result as unknown as UserSettings
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
