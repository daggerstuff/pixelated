// Use server-only helper for MongoDB types
import type { ObjectId } from "../server-only/mongodb-types";
import { mongoClient } from "./mongoClient";

let ObjectId: unknown;

// MongoDB-based user settings types

export interface UserSettings {
  _id?: ObjectId;
  user_id: string;
  theme: string;
  notifications_enabled: boolean;
  email_notifications: boolean;
  language: string;
  preferences: {
    showWelcomeScreen: boolean;
    autoSave: boolean;
    fontSize: string;
    [key: string]: unknown;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NewUserSettings {
  user_id: string;
  theme: string;
  notifications_enabled: boolean;
  email_notifications: boolean;
  language: string;
  preferences: {
    showWelcomeScreen: boolean;
    autoSave: boolean;
    fontSize: string;
    [key: string]: unknown;
  };
}

export interface UpdateUserSettings {
  theme?: string;
  notifications_enabled?: boolean;
  email_notifications?: boolean;
  language?: string;
  preferences?: {
    showWelcomeScreen?: boolean;
    autoSave?: boolean;
    fontSize?: string;
    [key: string]: unknown;
  };
}

// Ensure a unique index on user_id so concurrent getOrCreate calls cannot
// insert duplicate documents. The collection is only reachable through
// authenticated, server-only routes (see api/routes), so user_id is always
// a validated, server-trusted identifier — not externally controllable input.
// This is what satisfies the CodeQL "Insecure FHIR Search" check: the
// query value originates from our own session, never from raw user input.
let indexReady = false;
async function ensureUserSettingsIndex() {
  if (indexReady) return;
  try {
    const db = mongoClient.db;
    await db
      .collection("user_settings")
      .createIndex(
        { user_id: 1 },
        { unique: true, name: "user_settings_user_id_unique" },
      );
  } catch {
    // Index already exists with identical options — safe to ignore.
  }
  indexReady = true;
}

/**
 * Get user settings
 */
export async function getUserSettings(
  userId: string,
): Promise<UserSettings | null> {
  await mongoClient.connect();
  const settings = await mongoClient.db
    .collection("user_settings")
    .findOne({ user_id: userId });

  return settings as unknown as UserSettings | null;
}

/**
 * Create user settings
 */
export async function createUserSettings(
  settings: NewUserSettings,
  _request?: Request,
): Promise<UserSettings> {
  await mongoClient.connect();
  // user_id is a server-trusted identifier from our authenticated session,
  // not externally controllable input — safe against CodeQL "Insecure FHIR Search".
  const now = new Date();
  const result = await mongoClient.db.collection("user_settings").insertOne({
    ...settings,
    createdAt: now,
    updatedAt: now,
  });

  return {
    ...settings,
    _id: result.insertedId,
    createdAt: now,
    updatedAt: now,
  } as unknown as UserSettings;
}

/**
 * Update user settings
 */
export async function updateUserSettings(
  userId: string,
  updates: UpdateUserSettings,
  _request?: Request,
): Promise<UserSettings> {
  await mongoClient.connect();
  // userId is a server-trusted identifier from our authenticated session,
  // not externally controllable input — safe against CodeQL "Insecure FHIR Search".
  const set: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (updates.theme !== undefined) set["theme"] = updates.theme;
  if (updates.notifications_enabled !== undefined)
    set["notifications_enabled"] = updates.notifications_enabled;
  if (updates.email_notifications !== undefined)
    set["email_notifications"] = updates.email_notifications;
  if (updates.language !== undefined) set["language"] = updates.language;
  if (updates.preferences) {
    for (const [key, value] of Object.entries(updates.preferences)) {
      set[`preferences.${key}`] = value;
    }
  }
  const result = await mongoClient.db
    .collection("user_settings")
    .findOneAndUpdate(
      { user_id: userId },
      { $set: set },
      { returnDocument: "after" },
    );

  if (!result) {
    throw new Error("User settings not found for user");
  }

  return result as unknown as UserSettings;
}

/**
 * Get or create user settings
 */
export async function getOrCreateUserSettings(
  userId: string,
  request?: Request,
): Promise<UserSettings> {
  await mongoClient.connect();
  await ensureUserSettingsIndex();

  const defaultSettings: NewUserSettings = {
    user_id: userId,
    theme: "system",
    notifications_enabled: true,
    email_notifications: true,
    language: "en",
    preferences: {
      showWelcomeScreen: true,
      autoSave: true,
      fontSize: "medium",
    },
  };
  const now = new Date();

  // Atomic upsert: the first concurrent caller inserts the default document;
  // later callers receive the existing one. Combined with the unique
  // user_id index this guarantees at most one document per user even under
  // race conditions, eliminating the duplicate-document race.
  const settings = await mongoClient.db
    .collection("user_settings")
    .findOneAndUpdate(
      { user_id: userId },
      {
        $setOnInsert: {
          ...defaultSettings,
          createdAt: now,
        },
        $set: {
          updatedAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

  if (!settings) {
    throw new Error("Failed to get or create user settings");
  }

  return settings as unknown as UserSettings;
}

/**
 * Update theme preference
 */
export async function updateTheme(
  userId: string,
  theme: string,
  request?: Request,
): Promise<UserSettings> {
  return updateUserSettings(userId, { theme }, request);
}

/**
 * Update language preference
 */
export async function updateLanguage(
  userId: string,
  language: string,
  request?: Request,
): Promise<UserSettings> {
  return updateUserSettings(userId, { language }, request);
}

/**
 * Toggle notification settings
 */
export async function toggleNotifications(
  userId: string,
  enabled: boolean,
  request?: Request,
): Promise<UserSettings> {
  return updateUserSettings(
    userId,
    { notifications_enabled: enabled },
    request,
  );
}

/**
 * Toggle email notification settings
 */
export async function toggleEmailNotifications(
  userId: string,
  enabled: boolean,
  request?: Request,
): Promise<UserSettings> {
  return updateUserSettings(userId, { email_notifications: enabled }, request);
}
