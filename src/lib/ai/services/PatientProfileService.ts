import { KVStore } from '../../db/KVStore'
import type { PatientProfile, ConversationMessage } from '../models/patient' // Assuming createPatientProfile might be used or relevant
// For ProfileIdentifier name

/**
 * Profile identifier type
 */
export type ProfileIdentifier = {
  id: string // Profile ID, likely same as CognitiveModel ID
  name: string // Patient's name from CognitiveModel
}

/**
 * Service for managing patient profiles (CRUD operations and history).
 */
export class PatientProfileService {
  private kvStore: KVStore
  private readonly PROFILE_PREFIX = 'profile_'

  constructor(kvStore: KVStore) {
    this.kvStore = kvStore
  }

  /**
   * Get all available patient profiles
   * @returns Promise<ProfileIdentifier[]> List of available profiles
   */
  async getAvailableProfiles(): Promise<ProfileIdentifier[]> {
    try {
      const keys = await this.kvStore.keys()
      const profileKeys = keys.filter((key) =>
        key.startsWith(this.PROFILE_PREFIX),
      )
      const profiles: ProfileIdentifier[] = []

      for (const key of profileKeys) {
        const profile = await this.kvStore.get<PatientProfile>(key)
        if (profile) {
          profiles.push({
            id: profile.id,
            name: profile.cognitiveModel.name,
          })
        }
      }
      return profiles
    } catch (error: unknown) {
      console.error('Failed to get available profiles:', error)
      // In a real app, consider more specific error handling or re-throwing
      return []
    }
  }

  /**
   * Get a patient profile by ID
   * @param id Profile ID
   * @returns Promise<PatientProfile | null> The patient profile or null if not found
   */
  async getProfileById(id: string): Promise<PatientProfile | null> {
    try {
      return await this.kvStore.get<PatientProfile>(
        `${this.PROFILE_PREFIX}${id}`,
      )
    } catch (error: unknown) {
      console.error(`Failed to get profile with ID ${id}:`, error)
      return null
    }
  }

  /**
   * Save a patient profile. If it's a new profile, ensure `createPatientProfile` was used.
   * This method ensures `lastUpdatedAt` is set/updated.
   * @param profile The patient profile to save
   * @returns Promise<boolean> True if successful, false otherwise
   */
  async saveProfile(profile: PatientProfile): Promise<boolean> {
    try {
      const profileToSave: PatientProfile = {
        ...profile,
        lastUpdatedAt: new Date().toISOString(), // Ensure lastUpdatedAt is current
      }
      await this.kvStore.set(
        `${this.PROFILE_PREFIX}${profile.id}`,
        profileToSave,
      )
      return true
    } catch (error: unknown) {
      console.error(`Failed to save profile ${profile.id}:`, error)
      return false
    }
  }

  /**
   * Delete a patient profile
   * @param id Profile ID
   * @returns Promise<boolean> True if successful, false otherwise
   */
  async deleteProfile(id: string): Promise<boolean> {
    try {
      await this.kvStore.delete(`${this.PROFILE_PREFIX}${id}`)
      return true
    } catch (error: unknown) {
      console.error(`Failed to delete profile ${id}:`, error)
      return false
    }
  }

  /**
   * Adds a message to a patient's conversation history and saves the profile.
   * @param profileId The ID of the patient profile.
   * @param messageContent The content of the message.
   * @param role The role of the sender ('therapist', 'patient', or 'system').
   * @param sessionId Optional session identifier.
   * @param metadata Optional additional context for the message.
   * @returns Promise<PatientProfile | null> The updated profile or null if an error occurs (e.g., profile not found).
   */
  async addMessageToPatientHistory(
    profileId: string,
    messageContent: string,
    role: 'therapist' | 'patient' | 'system',
    sessionId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<PatientProfile | null> {
    const profile = await this.getProfileById(profileId)
    if (!profile) {
      console.error(
        `Profile with ID ${profileId} not found when trying to add message.`,
      )
      return null
    }

    const newMessage: ConversationMessage = {
      role,
      content: messageContent,
      timestamp: new Date().toISOString(),
      sessionId,
      metadata,
    }

    // Create a new profile object with the updated history to ensure immutability
    const updatedProfile: PatientProfile = {
      ...profile,
      conversationHistory: [...profile.conversationHistory, newMessage],
      // lastUpdatedAt will be updated by saveProfile
    }

    const success = await this.saveProfile(updatedProfile)
    return success ? updatedProfile : null
  }
}
