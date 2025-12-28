import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PatientProfileService,
  type ProfileIdentifier,
} from '../PatientProfileService'
import type { PatientProfile } from '../../models/patient'
import type { TherapeuticProgress } from '../../types/CognitiveModel'
import { KVStore } from '../../../db/KVStore'

// Mock KVStore
vi.mock('../../../db/KVStore')

describe('PatientProfileService', () => {
  let mockKvStore: vi.Mocked<KVStore>
  let patientProfileService: PatientProfileService
  let sampleProfile: PatientProfile
  const profilePrefix = 'profile_'

  beforeEach(() => {
    mockKvStore = new KVStore('test_profiles', false) as jest.Mocked<KVStore>
    patientProfileService = new PatientProfileService(mockKvStore)

    const initialTherapeuticProgress: TherapeuticProgress = {
      insights: [],
      resistanceLevel: 5,
      changeReadiness: 'contemplation',
      sessionProgressLog: [],
      trustLevel: 5, // Initial test value
      rapportScore: 6, // Initial test value
      therapistPerception: 'neutral', // Initial test value
      transferenceState: 'none', // Initial test value
      skillsAcquired: ['basic coping skills'], // Required property
    }

    sampleProfile = {
      id: 'test-profile-1',
      cognitiveModel: {
        id: 'cm-test-1',
        name: 'Test Patient Profile',
        // ... other cognitive model fields can be minimal for this test focus
        demographicInfo: {
          age: 30,
          gender: 'NB',
          occupation: 'Artist',
          familyStatus: 'Single',
          culturalFactors: [],
        },
        presentingIssues: ['existential dread'],
        diagnosisInfo: {
          primaryDiagnosis: 'Adjustment Disorder',
          secondaryDiagnoses: [],
          durationOfSymptoms: '2 months',
          severity: 'mild',
        },
        coreBeliefs: [],
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
          insightLevel: 5,
          preferredCommunicationModes: [],
        },
        goalsForTherapy: ['understand self'],
        therapeuticProgress: initialTherapeuticProgress,
      },
      conversationHistory: [],
      lastUpdatedAt: new Date().toISOString(),
    }

    // Clear all mock implementations and calls
    mockKvStore.get.mockReset()
    mockKvStore.set.mockReset()
    mockKvStore.delete.mockReset()
    mockKvStore.keys.mockReset()
  })

  describe('saveProfile and getProfileById', () => {
    it('should save and retrieve a profile including new therapeutic alliance metrics', async () => {
      mockKvStore.set.mockResolvedValue(undefined) // Simulate successful save
      mockKvStore.get.mockResolvedValue(sampleProfile) // Simulate retrieval

      await patientProfileService.saveProfile(sampleProfile)
      const retrievedProfile = await patientProfileService.getProfileById(
        sampleProfile.id,
      )

      expect(mockKvStore.set).toHaveBeenCalledWith(
        `${profilePrefix}${sampleProfile.id}`,
        expect.objectContaining({
          // ensure lastUpdatedAt is handled by saveProfile
          ...sampleProfile,
          lastUpdatedAt: expect.any(String),
        }),
      )
      expect(retrievedProfile).toEqual(sampleProfile)
      expect(
        retrievedProfile?.cognitiveModel.therapeuticProgress.trustLevel,
      ).toBe(5)
      expect(
        retrievedProfile?.cognitiveModel.therapeuticProgress.rapportScore,
      ).toBe(6)
      expect(
        retrievedProfile?.cognitiveModel.therapeuticProgress
          .therapistPerception,
      ).toBe('neutral')
      expect(
        retrievedProfile?.cognitiveModel.therapeuticProgress.transferenceState,
      ).toBe('none')
    })

    it('should update lastUpdatedAt when saving a profile', async () => {
      const oldTimestamp = new Date(Date.now() - 100000).toISOString()
      const profileToSave = { ...sampleProfile, lastUpdatedAt: oldTimestamp }

      mockKvStore.set.mockResolvedValue(undefined)

      await patientProfileService.saveProfile(profileToSave)

      expect(mockKvStore.set).toHaveBeenCalledWith(
        `${profilePrefix}${sampleProfile.id}`,
        expect.objectContaining({
          lastUpdatedAt: expect.not.stringMatching(oldTimestamp), // Should be a new timestamp
        }),
      )
    })
  })

  describe('addMessageToPatientHistory', () => {
    it('should add a message and save the profile, preserving new alliance metrics', async () => {
      // Arrange
      const initialTrust = 7
      sampleProfile.cognitiveModel.therapeuticProgress.trustLevel = initialTrust
      mockKvStore.get.mockResolvedValue(sampleProfile) // For the initial getProfileById call
      mockKvStore.set.mockResolvedValue(undefined) // For the saveProfile call

      // Act
      const updatedProfile =
        await patientProfileService.addMessageToPatientHistory(
          sampleProfile.id,
          'Hello therapist',
          'patient',
        )

      // Assert
      expect(mockKvStore.get).toHaveBeenCalledWith(
        `${profilePrefix}${sampleProfile.id}`,
      )
      expect(mockKvStore.set).toHaveBeenCalledTimes(1)

      const savedProfileArgument = mockKvStore.set.mock
        .calls[0][1] as PatientProfile
      expect(savedProfileArgument.conversationHistory.length).toBe(1)
      const firstMessage = savedProfileArgument.conversationHistory[0]
      if (firstMessage) {
        expect(firstMessage.content).toBe('Hello therapist')
      }
      // Crucially, check if the alliance metric is preserved
      expect(
        savedProfileArgument.cognitiveModel.therapeuticProgress.trustLevel,
      ).toBe(initialTrust)

      expect(
        updatedProfile?.cognitiveModel.therapeuticProgress.trustLevel,
      ).toBe(initialTrust)
      expect(updatedProfile?.conversationHistory.length).toBe(1)
    })
  })

  describe('getAvailableProfiles', () => {
    it('should retrieve identifiers including names from cognitive models', async () => {
      const profile2: PatientProfile = {
        ...sampleProfile,
        id: 'test-profile-2',
        cognitiveModel: {
          ...sampleProfile.cognitiveModel,
          id: 'cm-test-2',
          name: 'Another Patient',
        },
      }
      mockKvStore.keys.mockResolvedValue([
        `${profilePrefix}test-profile-1`,
        `${profilePrefix}test-profile-2`,
      ])
      mockKvStore.get
        .mockResolvedValueOnce(sampleProfile)
        .mockResolvedValueOnce(profile2)

      const availableProfiles =
        await patientProfileService.getAvailableProfiles()

      expect(availableProfiles).toHaveLength(2)
      expect(availableProfiles).toContainEqual<ProfileIdentifier>({
        id: 'test-profile-1',
        name: 'Test Patient Profile',
      })
      expect(availableProfiles).toContainEqual<ProfileIdentifier>({
        id: 'test-profile-2',
        name: 'Another Patient',
      })
    })
  })
})
