import { PatientProfileService } from './PatientProfileService' // Updated import
import type { PatientProfile, ConversationMessage } from '../models/patient'
import type {
  CognitiveModel,
  CoreBelief,
  DemographicInfo,
  DiagnosisInfo,
  TherapeuticProgress,
  ConversationalStyle,
} from '../types/CognitiveModel'
import { KVStore } from '../../db/KVStore'
import { vi } from 'vitest'

// Mock KVStore
vi.mock('../../db/KVStore')

const MockKVStore = KVStore as vi.MockedClass<typeof KVStore>

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
  } as DemographicInfo,
  presentingIssues: ['anxiety', 'low self-esteem'],
  diagnosisInfo: {
    primaryDiagnosis: 'Generalized Anxiety Disorder',
    secondaryDiagnoses: [],
    durationOfSymptoms: '2 years',
    severity: 'moderate',
  } as DiagnosisInfo,
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
  } as ConversationalStyle,
  goalsForTherapy: ['reduce anxiety', 'improve self-esteem'],
  therapeuticProgress: {
    insights: [],
    resistanceLevel: 3,
    changeReadiness: 'contemplation',
    sessionProgressLog: [],
    skillsAcquired: ['basic coping skills'],
    trustLevel: 5,
    rapportScore: 5,
    therapistPerception: 'neutral',
    transferenceState: 'none',
  } as TherapeuticProgress,
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
  let mockKvStoreInstance: vi.Mocked<KVStore> // Changed to vi.Mocked
  let service: PatientProfileService // Updated service type

  beforeEach(() => {
    MockKVStore.mockClear()
    mockKvStoreInstance = new MockKVStore() as vi.Mocked<KVStore> // Changed to vi.Mocked
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
      mockKvStoreInstance.delete.mockResolvedValue(undefined)
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

  // Removed describe blocks for 'checkBeliefConsistency', 'generateConsistentResponse', and 'createResponseContext'
  // as they belong to other services now.
})
