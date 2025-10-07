// Use server-only helper for MongoDB types
import type { ObjectId } from '@/lib/server-only/mongodb-types'

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
  _userId: string,
): Promise<UserSettings | null> {
  // TODO: Replace with MongoDB implementation
  return null
}

/**
 * Create user settings
 */
export async function createUserSettings(
  settings: NewUserSettings,
  _request?: Request,
): Promise<UserSettings> {
  // TODO: Replace with MongoDB implementation
  return settings as UserSettings
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  userId: string,
  updates: UpdateUserSettings,
  _request?: Request,
): Promise<UserSettings> {
  // TODO: Replace with MongoDB implementation
  return { ...updates, user_id: userId } as UserSettings
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
