import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockedClass, Mocked } from 'vitest'

import { KVStore } from '../../db/KVStore'
import type { PatientProfile, ConversationMessage } from '../models/patient'
import type {
  CognitiveModel,
  CoreBelief,
} from '../types/CognitiveModel'
import { PatientProfileService } from './PatientProfileService' // Updated import

// Mock KVStore
vi.mock('../../db/KVStore')

const MockKVStore = KVStore as MockedClass<typeof KVStore>

// Helper to create a basic CognitiveModel for testing (can remain the same)
const createTestCognitiveModel = (
  id: string,
  name: string,
  coreBeliefs: CoreBelief[] = [],
): CognitiveModel => ({
  id,
  name,
  demographicInfo: {
    age: 30,
    gender: 'female',
    occupation: 'artist',
    familyStatus: 'single',
    culturalFactors: [],
  },
  presentingIssues: ['anxiety', 'low self-esteem'],
  diagnosisInfo: {
    primaryDiagnosis: 'Generalized Anxiety Disorder',
    secondaryDiagnoses: [],
    durationOfSymptoms: '2 years',
    severity: 'moderate',
  },
  coreBeliefs,
  distortionPatterns: [],
  behavioralPatterns: [],
  emotionalPatterns: [],
  relationshipPatterns: [],
  formativeExperiences: [],
  therapyHistory: {
    previousApproaches: [],
    helpfulInterventions: [],
    unhelpfulInterventions: [],
    insights: [],
    progressMade: '',
    remainingChallenges: [],
  },
  conversationalStyle: {
    verbosity: 5,
    emotionalExpressiveness: 5,
    resistance: 3,
    insightLevel: 4,
    preferredCommunicationModes: ['verbal'],
  },
  goalsForTherapy: ['reduce anxiety', 'improve self-esteem'],
  therapeuticProgress: {
    insights: [],
    resistanceLevel: 3,
    changeReadiness: 'contemplation',
    sessionProgressLog: [],
    skillsAcquired: [
      {
        skillName: 'basic coping skills',
        dateAchieved: new Date().toISOString(),
        proficiency: 0.5,
      },
    ],
    trustLevel: 5,
    rapportScore: 5,
    therapistPerception: 'neutral',
    transferenceState: 'none',
  },
})

// Helper to create a basic PatientProfile
const createTestPatientProfile = (
  id: string,
  name: string,
  coreBeliefs: CoreBelief[] = [],
  history: ConversationMessage[] = [],
): PatientProfile => ({
  id,
  cognitiveModel: createTestCognitiveModel(id, name, coreBeliefs),
  conversationHistory: history,
  lastUpdatedAt: new Date().toISOString(),
})

describe('PatientProfileService', () => {
  // Updated describe block
  let mockKvStoreInstance: Mocked<KVStore> // Changed to Mocked
  let service: PatientProfileService // Updated service type

  beforeEach(() => {
    MockKVStore.mockClear()
    mockKvStoreInstance = new MockKVStore() as Mocked<KVStore> // Changed to Mocked
    service = new PatientProfileService(mockKvStoreInstance) // Instantiate new service
  })

  // Test basic CRUD operations (These tests should remain largely the same)
  describe('Profile CRUD', () => {
    it('should save a patient profile', async () => {
      const profile = createTestPatientProfile('test1', 'Jane Doe')
      mockKvStoreInstance.set.mockResolvedValue(undefined)
      const result = await service.saveProfile(profile)
      expect(result).toBe(true)
      expect(mockKvStoreInstance.set).toHaveBeenCalledWith(
        `profile_${profile.id}`,
        expect.objectContaining({ id: 'test1' }),
      )
    })

    it('should get a patient profile by ID', async () => {
      const profile = createTestPatientProfile('test2', 'John Smith')
      mockKvStoreInstance.get.mockResolvedValue(profile)
      const result = await service.getProfileById('test2')
      expect(result).toEqual(profile)
      expect(mockKvStoreInstance.get).toHaveBeenCalledWith('profile_test2')
    })

    it('should return null if profile not found', async () => {
      mockKvStoreInstance.get.mockResolvedValue(null)
      const result = await service.getProfileById('nonexistent')
      expect(result).toBeNull()
    })

    it('should get available profiles', async () => {
      const profile1 = createTestPatientProfile('p1', 'Alice')
      const profile2 = createTestPatientProfile('p2', 'Bob')
      mockKvStoreInstance.keys.mockResolvedValue([
        'profile_p1',
        'profile_p2',
        'some_other_key',
      ])
      mockKvStoreInstance.get.mockImplementation(async (key: string) => {
        if (key === 'profile_p1') {
          return profile1
        }
        if (key === 'profile_p2') {
          return profile2
        }
        return null
      })

      const result = await service.getAvailableProfiles()
      expect(result).toEqual([
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ])
      expect(mockKvStoreInstance.keys).toHaveBeenCalled()
      expect(mockKvStoreInstance.get).toHaveBeenCalledWith('profile_p1')
      expect(mockKvStoreInstance.get).toHaveBeenCalledWith('profile_p2')
    })

    it('should delete a profile', async () => {
      mockKvStoreInstance.delete.mockResolvedValue(true)
      const result = await service.deleteProfile('testDelete')
      expect(result).toBe(true)
      expect(mockKvStoreInstance.delete).toHaveBeenCalledWith(
        'profile_testDelete',
      )
    })
  })

  describe('addMessageToPatientHistory', () => {
    it('should add a message and save the profile', async () => {
      const initialProfile = createTestPatientProfile('hist1', 'History User')
      mockKvStoreInstance.get.mockResolvedValue(initialProfile)
      mockKvStoreInstance.set.mockResolvedValue(undefined)

      const updatedProfile = await service.addMessageToPatientHistory(
        'hist1',
        'Hello there',
        'patient',
      )

      expect(updatedProfile).not.toBeNull()
      expect(updatedProfile?.conversationHistory).toHaveLength(1)
      const firstMessage = updatedProfile?.conversationHistory[0]
      if (firstMessage) {
        expect(firstMessage.content).toBe('Hello there')
        expect(firstMessage.role).toBe('patient')
      }
      expect(mockKvStoreInstance.set).toHaveBeenCalledWith(
        `profile_hist1`,
        expect.objectContaining({
          conversationHistory: expect.arrayContaining([
            expect.objectContaining({ content: 'Hello there' }),
          ]),
        }),
      )
    })

    it('should return null if profile not found when adding message', async () => {
      mockKvStoreInstance.get.mockResolvedValue(null)
      const result = await service.addMessageToPatientHistory(
        'nonexistent',
        'test msg',
        'patient',
      )
      expect(result).toBeNull()
    })
  })

  describe('Error Handling', () => {
    it('should handle KVStore error in getProfileById', async () => {
      mockKvStoreInstance.get.mockRejectedValue(new Error('KVStore error'))
      const result = await service.getProfileById('error-id')
      expect(result).toBeNull()
    })

    it('should handle KVStore error in saveProfile', async () => {
      mockKvStoreInstance.set.mockRejectedValue(new Error('KVStore error'))
      const profile = createTestPatientProfile('err-save', 'Error Save')
      const result = await service.saveProfile(profile)
      expect(result).toBe(false)
    })

    it('should handle KVStore error in deleteProfile', async () => {
      mockKvStoreInstance.delete.mockRejectedValue(
        new Error('KVStore error'),
      )
      const result = await service.deleteProfile('err-delete')
      expect(result).toBe(false)
    })

    it('should handle KVStore error in getAvailableProfiles', async () => {
      mockKvStoreInstance.keys.mockRejectedValue(
        new Error('KVStore error'),
      )
      const result = await service.getAvailableProfiles()
      expect(result).toEqual([])
    })

    it('should handle null profiles in getAvailableProfiles', async () => {
      mockKvStoreInstance.keys.mockResolvedValue([
        'profile_existing',
        'profile_deleted',
      ])
      mockKvStoreInstance.get.mockImplementation(async (key: string) => {
        if (key === 'profile_existing') {
          return createTestPatientProfile('existing', 'Existing User')
        }
        // profile_deleted returns null (simulating race condition or stale key)
        return null
      })

      const result = await service.getAvailableProfiles()
      expect(result).toEqual([{ id: 'existing', name: 'Existing User' }])
    })
  })

  describe('addMessageToPatientHistory - Edge Cases', () => {
    it('should add message with sessionId and metadata', async () => {
      const initialProfile = createTestPatientProfile(
        'edge1',
        'Edge Case User',
      )
      mockKvStoreInstance.get.mockResolvedValue(initialProfile)
      mockKvStoreInstance.set.mockResolvedValue(undefined)

      const updated = await service.addMessageToPatientHistory(
        'edge1',
        'Message with context',
        'therapist',
        'session-123',
        { source: 'test', confidence: 0.9 },
      )

      expect(updated).not.toBeNull()
      expect(updated?.conversationHistory).toHaveLength(1)
      expect(updated?.conversationHistory[0]).toMatchObject({
        content: 'Message with context',
        role: 'therapist',
        sessionId: 'session-123',
        metadata: { source: 'test', confidence: 0.9 },
      })
    })

    it('should return null when saveProfile fails', async () => {
      const initialProfile = createTestPatientProfile('edge2', 'Save Fail')
      mockKvStoreInstance.get.mockResolvedValue(initialProfile)
      mockKvStoreInstance.set.mockRejectedValue(new Error('Save failed'))

      const result = await service.addMessageToPatientHistory(
        'edge2',
        'This will fail to save',
        'patient',
      )
      expect(result).toBeNull()
    })

    it('should handle system role messages', async () => {
      const initialProfile = createTestPatientProfile('edge3', 'System Msg')
      mockKvStoreInstance.get.mockResolvedValue(initialProfile)
      mockKvStoreInstance.set.mockResolvedValue(undefined)

      const updated = await service.addMessageToPatientHistory(
        'edge3',
        'System initialized',
        'system',
      )
      expect(updated).not.toBeNull()
      expect(updated?.conversationHistory[0].role).toBe('system')
    })
  })
})
