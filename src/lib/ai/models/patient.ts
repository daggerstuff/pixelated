import type { CognitiveModel } from '../types/CognitiveModel'

/**
 * Represents a single message in a conversation.
 */
export type ConversationMessage = {
  role: 'therapist' | 'patient' | 'system' // Added 'system' for potential future use (e.g., summaries, notes)
  content: string
  timestamp: string // ISO 8601 date-time string
  sessionId?: string // Optional: to group messages by session
  metadata?: Record<string, unknown> // Optional: for additional context like emotional tone, detected themes, etc.
}

/**
 * Defines the structure for a patient's profile, including their
 * cognitive model and a comprehensive history of their conversations.
 */
export type PatientProfile = {
  id: string // Unique identifier for the patient profile, could be same as CognitiveModel.id
  cognitiveModel: CognitiveModel
  conversationHistory: ConversationMessage[]
  // Optional: Add other patient-specific data not directly part of the cognitive model here
  // e.g., preferences, administrative notes, etc.
  lastUpdatedAt: string // ISO 8601 date-time string to track when the profile was last modified
}

// Potentially, we can add utility functions here in the future,
// e.g., function to add a message to history, function to get recent statements, etc.

/**
 * Creates a new patient profile.
 * @param id The unique identifier for the patient.
 * @param cognitiveModel The initial cognitive model for the patient.
 * @returns A new PatientProfile object.
 */
export function createPatientProfile(
  id: string,
  cognitiveModel: CognitiveModel,
): PatientProfile {
  return {
    id,
    cognitiveModel,
    conversationHistory: [],
    lastUpdatedAt: new Date().toISOString(),
  }
}

/**
 * Adds a message to the patient's conversation history.
 * @param profile The patient profile to update.
 * @param message The message to add.
 * @returns The updated patient profile.
 */
export function addMessageToHistory(
  profile: PatientProfile,
  message: Omit<ConversationMessage, 'timestamp'>,
): PatientProfile {
  const newMessage: ConversationMessage = {
    ...message,
    timestamp: new Date().toISOString(),
  }
  return {
    ...profile,
    conversationHistory: [...profile.conversationHistory, newMessage],
    lastUpdatedAt: new Date().toISOString(),
  }
}

/**
 * Retrieves the most recent 'n' messages from the conversation history.
 * @param profile The patient profile.
 * @param count The number of recent messages to retrieve.
 * @returns An array of the most recent ConversationMessage objects.
 */
export function getRecentMessages(
  profile: PatientProfile,
  count: number,
): ConversationMessage[] {
  if (count <= 0) {
    return []
  }
  return profile.conversationHistory.slice(-count)
}
