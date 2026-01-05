import { TherapeuticProgressService } from '../TherapeuticProgressService'
import type { PatientProfile, ConversationMessage } from '../../models/patient'
import type {
  CognitiveModel,
  CoreBelief,
  TherapeuticProgress,
  SkillAcquired,
  TherapeuticInsight,
} from '../../types/CognitiveModel'

import { vi } from 'vitest'

// Mock logger to prevent console noise during tests and allow assertions if needed
vi.mock('../../../logging', () => ({
  getAppLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('TherapeuticProgressService', () => {
  let service: TherapeuticProgressService
  let mockPatientProfile: PatientProfile

  beforeEach(() => {
    service = new TherapeuticProgressService()
    // Reset mock logger calls before each test
    vi.clearAllMocks() // Or vi.resetAllMocks() / vi.restoreAllMocks()

    // Setup a baseline mock patient profile for each test
    const initialCoreBeliefs: CoreBelief[] = [
      {
        belief: 'I am worthless',
        strength: 0.8,
        evidence: [],
        formationContext: '',
        relatedDomains: [],
      },
      {
        belief: 'The world is dangerous',
        strength: 0.7,
        evidence: [],
        formationContext: '',
        relatedDomains: [],
      },
    ]
    const initialInsights: TherapeuticInsight[] = []
    const initialSkills: SkillAcquired[] = []
    const initialTherapeuticProgress: TherapeuticProgress = {
      insights: initialInsights,
      skillsAcquired: initialSkills,
      resistanceLevel: 5,
      changeReadiness: 'contemplation',
      sessionProgressLog: [],
      trustLevel: 5,
      rapportScore: 5,
      therapistPerception: 'neutral',
      transferenceState: 'none',
    }
    const initialCognitiveModel: CognitiveModel = {
      id: 'patient123',
      name: 'Test Patient',
      demographicInfo: {
        age: 30,
        gender: 'female',
        occupation: 'engineer',
        familyStatus: 'single',
        culturalFactors: [],
      },
      presentingIssues: ['Anxiety', 'Low self-esteem'],
      diagnosisInfo: {
        primaryDiagnosis: 'GAD',
        secondaryDiagnoses: [],
        durationOfSymptoms: '2 years',
        severity: 'moderate',
      },
      coreBeliefs: initialCoreBeliefs,
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
        verbosity: 0.5,
        emotionalExpressiveness: 0.5,
        insightLevel: 0.5,
        preferredCommunicationModes: [],
      },
      goalsForTherapy: ['Reduce anxiety', 'Improve self-worth'],
      therapeuticProgress: initialTherapeuticProgress,
    }
    mockPatientProfile = {
      id: 'patient123',
      cognitiveModel: initialCognitiveModel,
      conversationHistory: [] as ConversationMessage[],
      lastUpdatedAt: new Date().toISOString(),
    }
  })

  describe('addInsight', () => {
    it('should add a new insight to the profile', () => {
      const insightText =
        'Realizing that my fear of failure is linked to childhood experiences.'
      const relatedBelief = 'I am worthless'
      const originalInsightCount =
        mockPatientProfile.cognitiveModel.therapeuticProgress.insights.length

      const updatedProfile = service.addInsight(
        mockPatientProfile,
        insightText,
        relatedBelief,
      )
      const newProgress = updatedProfile.cognitiveModel.therapeuticProgress

      expect(newProgress.insights.length).toBe(originalInsightCount + 1)
      const addedInsight = newProgress.insights[newProgress.insights.length - 1]
      expect(addedInsight?.insight).toBe(insightText)
      expect(addedInsight?.belief).toBe(relatedBelief)
      expect(addedInsight?.dateAchieved).toBeDefined()
      expect(Date.parse(addedInsight!.dateAchieved)).toBeCloseTo(Date.now(), -3) // Check if date is recent
      expect(updatedProfile.lastUpdatedAt).not.toBe(
        mockPatientProfile.lastUpdatedAt,
      )
    })

    it('should add a general insight if no related belief is provided', () => {
      const insightText = 'Meditation helps calm my mind.'
      const updatedProfile = service.addInsight(mockPatientProfile, insightText)
      const newProgress = updatedProfile.cognitiveModel.therapeuticProgress
      const addedInsight = newProgress.insights[newProgress.insights.length - 1]

      expect(addedInsight?.belief).toBe('General Insight')
    })

    it('should throw an error if insight text is empty', () => {
      expect(() => service.addInsight(mockPatientProfile, '')).toThrow(
        'Insight text cannot be empty.',
      )
    })

    it('should throw an error if profile is invalid', () => {
      expect(() => service.addInsight(null as unknown, 'insight')).toThrow(
        'Invalid patient profile provided.',
      )
      const incompleteProfile = {
        ...mockPatientProfile,
        cognitiveModel: {
          ...mockPatientProfile.cognitiveModel,
          therapeuticProgress: undefined as unknown,
        },
      }
      expect(() => service.addInsight(incompleteProfile, 'insight')).toThrow(
        'Invalid patient profile provided.',
      )
    })
  })

  describe('updateBeliefStrength', () => {
    const targetBelief = 'I am worthless'
    const nonExistentBelief = 'I am a superhero'

    it('should update the strength of an existing core belief', async () => {
      const originalBelief = mockPatientProfile.cognitiveModel.coreBeliefs.find(
        (b) => b.belief === targetBelief,
      )
      const originalStrength = originalBelief!.strength // Should be 0.8
      const changeFactor = -0.2 // Decrease strength
      const originalTimestamp = mockPatientProfile.lastUpdatedAt

      // Wait a moment to ensure timestamp changes if operations are very fast
      await new Promise((resolve) => setTimeout(resolve, 5))

      const updatedProfile = service.updateBeliefStrength(
        mockPatientProfile,
        targetBelief,
        changeFactor,
      )
      const updatedBelief = updatedProfile.cognitiveModel.coreBeliefs.find(
        (b) => b.belief === targetBelief,
      )

      expect(updatedBelief).toBeDefined()
      expect(updatedBelief!.strength).toBeCloseTo(
        originalStrength + changeFactor,
      )
      expect(updatedProfile.lastUpdatedAt).not.toBe(originalTimestamp)
    })

    it('should clamp belief strength between 0 and 1', () => {
      let updatedProfile = service.updateBeliefStrength(
        mockPatientProfile,
        targetBelief,
        0.5,
      ) // 0.8 + 0.5 = 1.3 -> 1.0
      let updatedBelief = updatedProfile.cognitiveModel.coreBeliefs.find(
        (b) => b.belief === targetBelief,
      )
      expect(updatedBelief!.strength).toBe(1)

      updatedProfile = service.updateBeliefStrength(
        mockPatientProfile,
        targetBelief,
        -1.0,
      ) // 0.8 - 1.0 = -0.2 -> 0.0
      updatedBelief = updatedProfile.cognitiveModel.coreBeliefs.find(
        (b) => b.belief === targetBelief,
      )
      expect(updatedBelief!.strength).toBe(0)
    })

    it('should throw an error if the belief to update is not found', () => {
      expect(() =>
        service.updateBeliefStrength(
          mockPatientProfile,
          nonExistentBelief,
          0.1,
        ),
      ).toThrow(`Belief "${nonExistentBelief}" not found.`)
    })

    it('should throw an error if belief text is empty', () => {
      expect(() =>
        service.updateBeliefStrength(mockPatientProfile, '', 0.1),
      ).toThrow('Belief text cannot be empty.')
    })

    it('should throw an error if profile or coreBeliefs are invalid', () => {
      expect(() =>
        service.updateBeliefStrength(null as unknown, targetBelief, 0.1),
      ).toThrow('Invalid patient profile or core beliefs missing.')
      const incompleteProfile = {
        ...mockPatientProfile,
        cognitiveModel: {
          ...mockPatientProfile.cognitiveModel,
          coreBeliefs: undefined as unknown,
        },
      }
      expect(() =>
        service.updateBeliefStrength(incompleteProfile, targetBelief, 0.1),
      ).toThrow('Invalid patient profile or core beliefs missing.')
    })
  })

  describe('acquireSkill', () => {
    const skillName = 'Deep Breathing'
    const initialProficiency = 0.3

    it('should add a new skill to the profile if it does not exist', () => {
      const originalSkillCount =
        mockPatientProfile.cognitiveModel.therapeuticProgress.skillsAcquired
          .length
      const updatedProfile = service.acquireSkill(
        mockPatientProfile,
        skillName,
        initialProficiency,
      )
      const newSkills =
        updatedProfile.cognitiveModel.therapeuticProgress.skillsAcquired

      expect(newSkills.length).toBe(originalSkillCount + 1)
      const addedSkill = newSkills.find((s) => s.skillName === skillName)
      expect(addedSkill).toBeDefined()
      expect(addedSkill!.skillName).toBe(skillName)
      expect(addedSkill!.proficiency).toBe(initialProficiency)
      expect(addedSkill!.dateAchieved).toBeDefined()
      expect(Date.parse(addedSkill!.dateAchieved)).toBeCloseTo(Date.now(), -3)
      expect(updatedProfile.lastUpdatedAt).not.toBe(
        mockPatientProfile.lastUpdatedAt,
      )
    })

    it('should update an existing skill if acquireSkill is called again for it', async () => {
      // First acquisition
      let profileWithSkill = service.acquireSkill(
        mockPatientProfile,
        skillName,
        0.2,
      )
      const firstSkill =
        profileWithSkill.cognitiveModel.therapeuticProgress.skillsAcquired.find(
          (s) => s.skillName === skillName,
        )
      const firstDate = firstSkill!.dateAchieved

      // Wait a moment to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Second acquisition with different proficiency
      const newProficiency = 0.5
      profileWithSkill = service.acquireSkill(
        profileWithSkill,
        skillName,
        newProficiency,
        ['during meetings'],
      )

      const updatedSkills =
        profileWithSkill.cognitiveModel.therapeuticProgress.skillsAcquired
      expect(updatedSkills.length).toBe(1) // Still only one skill entry
      const updatedSkill = updatedSkills.find((s) => s.skillName === skillName)
      expect(updatedSkill!.proficiency).toBe(newProficiency)
      expect(updatedSkill!.dateAchieved).not.toBe(firstDate) // Date should be updated
      expect(updatedSkill!.applicationContext).toEqual(['during meetings'])
    })

    it('should default proficiency to 0.1 if not provided', () => {
      const updatedProfile = service.acquireSkill(
        mockPatientProfile,
        'Another Skill',
      )
      const addedSkill =
        updatedProfile.cognitiveModel.therapeuticProgress.skillsAcquired.find(
          (s) => s.skillName === 'Another Skill',
        )
      expect(addedSkill!.proficiency).toBe(0.1)
    })

    it('should clamp initial proficiency between 0 and 1', () => {
      let updatedProfile = service.acquireSkill(
        mockPatientProfile,
        'Skill A',
        1.5,
      )
      let skill =
        updatedProfile.cognitiveModel.therapeuticProgress.skillsAcquired.find(
          (s) => s.skillName === 'Skill A',
        )
      expect(skill!.proficiency).toBe(1)

      updatedProfile = service.acquireSkill(mockPatientProfile, 'Skill B', -0.5)
      skill =
        updatedProfile.cognitiveModel.therapeuticProgress.skillsAcquired.find(
          (s) => s.skillName === 'Skill B',
        )
      expect(skill!.proficiency).toBe(0)
    })

    it('should throw error for empty skill name', () => {
      // Renamed and modified
      expect(() => service.acquireSkill(mockPatientProfile, '')).toThrow(
        'Skill name cannot be empty.',
      )
      // Out-of-bounds proficiency no longer throws, it clamps. Clamping is tested in 'should clamp initial proficiency'.
    })
  })

  describe('updateSkillProficiency', () => {
    const skillName = 'Cognitive Reframing'

    beforeEach(() => {
      // Ensure the skill exists before trying to update its proficiency
      mockPatientProfile = service.acquireSkill(
        mockPatientProfile,
        skillName,
        0.2,
      )
    })

    it('should update the proficiency of an existing skill', async () => {
      const newProficiency = 0.6
      const originalSkill =
        mockPatientProfile.cognitiveModel.therapeuticProgress.skillsAcquired.find(
          (s) => s.skillName === skillName,
        )
      const originalDate = originalSkill!.dateAchieved

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 10))

      const updatedProfile = service.updateSkillProficiency(
        mockPatientProfile,
        skillName,
        newProficiency,
      )
      const updatedSkill =
        updatedProfile.cognitiveModel.therapeuticProgress.skillsAcquired.find(
          (s) => s.skillName === skillName,
        )

      expect(updatedSkill).toBeDefined()
      expect(updatedSkill!.proficiency).toBe(newProficiency)
      expect(updatedSkill!.dateAchieved).not.toBe(originalDate) // dateAchieved should be updated
      expect(updatedProfile.lastUpdatedAt).not.toBe(
        mockPatientProfile.lastUpdatedAt,
      )
    })

    it('should clamp new proficiency between 0 and 1', () => {
      let updatedProfile = service.updateSkillProficiency(
        mockPatientProfile,
        skillName,
        1.5,
      )
      let skill =
        updatedProfile.cognitiveModel.therapeuticProgress.skillsAcquired.find(
          (s) => s.skillName === skillName,
        )
      expect(skill!.proficiency).toBe(1)

      updatedProfile = service.updateSkillProficiency(
        mockPatientProfile,
        skillName,
        -0.5,
      )
      skill =
        updatedProfile.cognitiveModel.therapeuticProgress.skillsAcquired.find(
          (s) => s.skillName === skillName,
        )
      expect(skill!.proficiency).toBe(0)
    })

    it('should throw an error if the skill to update is not found', () => {
      const nonExistentSkill = 'Time Travel'
      expect(() =>
        service.updateSkillProficiency(
          mockPatientProfile,
          nonExistentSkill,
          0.5,
        ),
      ).toThrow(
        `Skill "${nonExistentSkill}" not found. Cannot update proficiency.`,
      )
    })

    // This test becomes redundant as out-of-bounds proficiency is clamped, not an error.
    // Clamping is tested in 'should clamp new proficiency between 0 and 1'.
    // it('should throw error for invalid new proficiency', () => {
    //     // These conditions no longer throw an error.
    // });
  })
})
