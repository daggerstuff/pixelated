import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PatientResponseService } from '../PatientResponseService'
import type { PatientResponseStyleConfig } from '../PatientResponseService'
import { PatientProfileService } from '../PatientProfileService'
import { BeliefConsistencyService } from '../BeliefConsistencyService'
import type { PatientProfile } from '../../models/patient'
import type { TherapeuticProgress } from '../../types/CognitiveModel'
// KVStore is needed for PatientProfileService

import { EmotionSynthesizer } from '../../emotions/EmotionSynthesizer' // Corrected path

// Mocks
vi.mock('../PatientProfileService')
vi.mock('../BeliefConsistencyService')
vi.mock('../../../db/KVStore')
vi.mock('../../emotions/EmotionSynthesizer') // Corrected path for mock

describe('PatientResponseService', () => {
  let mockPatientProfileService: PatientProfileService // Use actual type for clarity if needed for type casting mocks
  let mockBeliefConsistencyService: BeliefConsistencyService
  let mockEmotionSynthesizer: vi.Mocked<EmotionSynthesizer> // Use vi.Mocked for typed mocks
  let patientResponseService: PatientResponseService
  let sampleProfile: PatientProfile

  beforeEach(() => {
    // Reset mocks for each test
    vi.clearAllMocks() // Clear all mocks, including EmotionSynthesizer

    // We are mocking the service classes, so we don't need their actual instances for these tests,
    // but rather their mocked constructor or instances.
    // However, if methods of these services are called by PatientResponseService, they need to be mocked on the instances.
    mockPatientProfileService = new (PatientProfileService as unknown)() // Keep as is if only used for constructor typing
    mockBeliefConsistencyService = new (BeliefConsistencyService as unknown)()

    // Create a mocked instance of EmotionSynthesizer
    mockEmotionSynthesizer =
      new (EmotionSynthesizer as unknown)() as vi.Mocked<EmotionSynthesizer>

    // Setup default mock implementations for EmotionSynthesizer methods if needed globally
    // For example, if every call to generatePatientPrompt will invoke synthesizeEmotion:
    mockEmotionSynthesizer.synthesizeEmotion.mockResolvedValue({
      success: true,
      profile: {
        id: 'default-mock-emotion',
        emotions: { neutral: 0.8, joy: 0.1 }, // Default mock emotional state
        timestamp: Date.now(),
        confidence: 0.85,
      },
      message: 'Successfully synthesized mock emotion',
    })
    mockEmotionSynthesizer.getCurrentProfile.mockReturnValue(null) // Default for getCurrentProfile

    patientResponseService = new PatientResponseService(
      mockPatientProfileService,
      mockBeliefConsistencyService,
      mockEmotionSynthesizer, // Pass the mocked synthesizer
    )

    // Base sample cognitive model part for therapeutic progress
    const initialTherapeuticProgress: TherapeuticProgress = {
      insights: [],
      resistanceLevel: 5,
      changeReadiness: 'contemplation',
      sessionProgressLog: [],
      trustLevel: 5,
      rapportScore: 5,
      therapistPerception: 'neutral',
      transferenceState: 'none',
      skillsAcquired: ['basic coping skills'], // Required property
    }

    // Sample Patient Profile
    sampleProfile = {
      id: 'test-patient-1',
      cognitiveModel: {
        id: 'cm-test-1',
        name: 'Test Patient',
        demographicInfo: {
          age: 30,
          gender: 'Other',
          occupation: 'Tester',
          familyStatus: 'Single',
          culturalFactors: [],
        },
        presentingIssues: ['testing anxiety'],
        diagnosisInfo: {
          primaryDiagnosis: 'Test Disorder',
          secondaryDiagnoses: [],
          durationOfSymptoms: '1 week',
          severity: 'mild',
        },
        coreBeliefs: [
          {
            belief: 'I must test everything',
            strength: 8,
            evidence: [],
            formationContext: '',
            relatedDomains: [],
          },
        ],
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
        goalsForTherapy: ['pass tests'],
        therapeuticProgress: { ...initialTherapeuticProgress }, // Use a copy
      },
      conversationHistory: [],
      lastUpdatedAt: new Date().toISOString(),
    }
  })

  describe('updateTherapeuticAllianceMetrics', () => {
    it('should increase trust and rapport with validating therapist utterance and agreeing patient', () => {
      const therapistUtterance =
        "I understand that you're feeling anxious. That makes sense."
      const patientUtterance = 'Yes, exactly! Thank you for understanding.'

      const updatedProfile =
        patientResponseService.updateTherapeuticAllianceMetrics(
          {
            ...sampleProfile, // Ensure a fresh profile object for each test
            cognitiveModel: {
              ...sampleProfile.cognitiveModel,
              therapeuticProgress: {
                ...sampleProfile.cognitiveModel.therapeuticProgress,
              },
            },
          },
          therapistUtterance,
          patientUtterance,
        )

      const tp = updatedProfile.cognitiveModel.therapeuticProgress
      expect(tp.trustLevel).toBeCloseTo(5 + 0.5 + 0.7) // Initial + therapist_validate + patient_agree
      expect(tp.rapportScore).toBeCloseTo(5 + 0.5 + 0.5)
      expect(tp.therapistPerception).toBe('understanding') // then supportive due to patient agreement
    })

    it('should decrease trust and rapport with dismissive therapist utterance', () => {
      const therapistUtterance = "You shouldn't feel that way, just relax."
      const patientUtterance = "But I can't just relax!"

      const profileCopy = JSON.parse(JSON.stringify(sampleProfile) as unknown) // Deep copy
      const updatedProfile =
        patientResponseService.updateTherapeuticAllianceMetrics(
          profileCopy,
          therapistUtterance,
          patientUtterance,
        )

      const tp = updatedProfile.cognitiveModel.therapeuticProgress
      expect(tp.trustLevel).toBeCloseTo(5 - 1.0 - 0.3) // Initial + therapist_dismissive + patient_disagree
      expect(tp.rapportScore).toBeCloseTo(5 - 1.0 - 0.5)
      expect(tp.therapistPerception).toBe('dismissive')
    })

    it('should perceive therapist as challenging with questioning utterance', () => {
      const therapistUtterance = 'I wonder if that belief is truly serving you?'
      const patientUtterance = "Hmm, I'm not sure. Maybe not."

      const profileCopy = JSON.parse(JSON.stringify(sampleProfile) as unknown)
      const updatedProfile =
        patientResponseService.updateTherapeuticAllianceMetrics(
          profileCopy,
          therapistUtterance,
          patientUtterance,
        )

      const tp = updatedProfile.cognitiveModel.therapeuticProgress
      expect(tp.trustLevel).toBeCloseTo(5 - 0.1) // Slight dip for challenge
      expect(tp.therapistPerception).toBe('challenging')
    })

    it('should handle patient withdrawal or very short answers', () => {
      const therapistUtterance = 'Can you tell me more about that feeling?'
      const patientUtterance = 'Fine.' // Very short, indicative of withdrawal

      const profileCopy = JSON.parse(JSON.stringify(sampleProfile) as unknown)
      profileCopy.cognitiveModel.therapeuticProgress.therapistPerception =
        'supportive' // Start positive

      const updatedProfile =
        patientResponseService.updateTherapeuticAllianceMetrics(
          profileCopy,
          therapistUtterance,
          patientUtterance,
        )

      const tp = updatedProfile.cognitiveModel.therapeuticProgress
      expect(tp.trustLevel).toBeCloseTo(5 - 0.5)
      expect(tp.rapportScore).toBeCloseTo(5 - 0.7)
      // Perception might not change from 'supportive' if therapist was supportive and patient just withdrew
      expect(tp.therapistPerception).toBe('supportive')
    })

    it('should update transference state based on keywords (simplified)', () => {
      const therapistUtterance = 'How did your mother react to that?'
      const patientUtterance =
        'She was just like my mother always is, critical.'

      const profileCopy = JSON.parse(JSON.stringify(sampleProfile) as unknown)
      const updatedProfile =
        patientResponseService.updateTherapeuticAllianceMetrics(
          profileCopy,
          therapistUtterance,
          patientUtterance,
        )
      const tp = updatedProfile.cognitiveModel.therapeuticProgress
      expect(tp.transferenceState).toBe('maternal')
    })

    it('should cap trust and rapport scores at 0 and 10', () => {
      const therapistUtterance = "That's perfectly understandable."
      const patientUtterance = 'Thank you, I feel very understood.'

      const profileCopy = JSON.parse(JSON.stringify(sampleProfile) as unknown)
      profileCopy.cognitiveModel.therapeuticProgress.trustLevel = 9.8
      profileCopy.cognitiveModel.therapeuticProgress.rapportScore = 9.9

      const updatedProfile =
        patientResponseService.updateTherapeuticAllianceMetrics(
          profileCopy,
          therapistUtterance,
          patientUtterance,
        )
      const tp = updatedProfile.cognitiveModel.therapeuticProgress
      expect(tp.trustLevel).toBe(10) // 9.8 + 0.5 (therapist) + 0.7 (patient) = 11 -> capped at 10
      expect(tp.rapportScore).toBe(10) // 9.9 + 0.5 + 0.5 = 10.9 -> capped at 10

      const profileCopy2 = JSON.parse(JSON.stringify(sampleProfile) as unknown)
      profileCopy2.cognitiveModel.therapeuticProgress.trustLevel = 0.2
      profileCopy2.cognitiveModel.therapeuticProgress.rapportScore = 0.1
      const updatedProfile2 =
        patientResponseService.updateTherapeuticAllianceMetrics(
          profileCopy2,
          "You shouldn't worry.", // Dismissive
          'I guess.', // Non-committal
        )
      const tp2 = updatedProfile2.cognitiveModel.therapeuticProgress
      expect(tp2.trustLevel).toBe(0) // 0.2 - 1.0 = -0.8 -> capped at 0
      expect(tp2.rapportScore).toBe(0) // 0.1 - 1.0 = -0.9 -> capped at 0
    })

    it('should correctly update therapistPerception from challenging to supportive if patient agrees with challenge', () => {
      const therapistUtterance =
        'I wonder if avoiding that is actually making it harder?' // Challenging
      const patientUtterance = "You know, that's right. I think it is." // Agreeing with challenge

      const profileCopy = JSON.parse(JSON.stringify(sampleProfile) as unknown)
      // Set initial perception to neutral to see it change to challenging then supportive
      profileCopy.cognitiveModel.therapeuticProgress.therapistPerception =
        'neutral'

      // First, let the therapist's challenge set the perception
      let updatedProfile =
        patientResponseService.updateTherapeuticAllianceMetrics(
          profileCopy,
          therapistUtterance,
          'I need to think about that.', // A neutral patient response that doesn't immediately agree
        )
      expect(
        updatedProfile.cognitiveModel.therapeuticProgress.therapistPerception,
      ).toBe('challenging')

      // Now, the patient agrees in the next turn (simulated by calling again with the agreeing utterance)
      // We use the profile that already has 'challenging' perception
      updatedProfile = patientResponseService.updateTherapeuticAllianceMetrics(
        updatedProfile, // Pass the already updated profile
        therapistUtterance, // Therapist utterance can be the same or different
        patientUtterance, // Patient now agrees
      )

      const tp = updatedProfile.cognitiveModel.therapeuticProgress
      expect(tp.therapistPerception).toBe('supportive')
      expect(tp.trustLevel).toBeCloseTo(5 - 0.1 - 0.1 + 0.7) // Initial + first_challenge + second_challenge + patient_agree_boost
      expect(tp.rapportScore).toBeCloseTo(5 + 0.5) // Initial + patient_agree_rapport_boost
    })
  })

  // TODO: Add tests for generatePatientPrompt to check if new alliance metrics are in the prompt.
  // TODO: Add tests for createResponseContext if any logic was added there (currently it's straightforward).

  describe('generatePatientPrompt', () => {
    it('should include trustLevel, rapportScore, therapistPerception, and transferenceState in the prompt', async () => {
      sampleProfile.cognitiveModel.therapeuticProgress.trustLevel = 7
      sampleProfile.cognitiveModel.therapeuticProgress.rapportScore = 8
      sampleProfile.cognitiveModel.therapeuticProgress.therapistPerception =
        'supportive'
      sampleProfile.cognitiveModel.therapeuticProgress.transferenceState =
        'positive-idealizing'
      sampleProfile.cognitiveModel.therapeuticProgress.resistanceLevel = 3 // Ensure this is also used

      const styleConfig: PatientResponseStyleConfig = {
        openness: 7,
        coherence: 8,
        defenseLevel: 2,
        disclosureStyle: 'open',
        challengeResponses: 'curious',
        emotionalNuance: 'overt',
        emotionalIntensity: 0.7,
        nonVerbalIndicatorStyle: 'minimal',
        activeDefensiveMechanism: 'none',
        resistanceLevel: 3, // This should match the one in therapeuticProgress for consistency in prompt
      }

      const responseContext = {
        profile: sampleProfile,
        styleConfig,
        sessionNumber: 5,
        therapeuticFocus: ['self-esteem'],
      }

      // Override default mock for this specific test if needed for emotional content,
      // or rely on the default mock from beforeEach.
      // For this test, the focus is on alliance metrics, so default emotion mock is fine.

      const prompt =
        await patientResponseService.generatePatientPrompt(responseContext)

      expect(prompt).toContain(
        'Your current trust level in the therapist is 7/10.',
      )
      expect(prompt).toContain('Your rapport score with the therapist is 8/10.')
      expect(prompt).toContain(
        'You perceive the therapist as generally supportive.',
      )
      expect(prompt).toContain(
        'You are experiencing a positive-idealizing transference towards the therapist.',
      )
      expect(prompt).toContain(
        'Your resistance to therapeutic suggestions is 3/10.',
      )
      expect(prompt).toContain(
        'Let these factors influence your willingness to share',
      )

      // Check for default mocked emotion content
      expect(prompt).toContain('Focus on conveying neutral.') // From default mock: { neutral: 0.8, joy: 0.1 } -> primary is neutral
      expect(prompt).toContain(
        'The intensity of your expressed emotion should be around 8.0/10.',
      ) // 0.8 * 10
    })

    it('should correctly reflect "none" transferenceState', async () => {
      sampleProfile.cognitiveModel.therapeuticProgress.transferenceState =
        'none'
      const styleConfig: PatientResponseStyleConfig = {
        openness: 5,
        coherence: 5,
        defenseLevel: 5,
        disclosureStyle: 'selective',
        challengeResponses: 'curious',
        emotionalNuance: 'subtle',
        emotionalIntensity: 0.5,
        nonVerbalIndicatorStyle: 'none',
        activeDefensiveMechanism: 'none',
        resistanceLevel:
          sampleProfile.cognitiveModel.therapeuticProgress.resistanceLevel,
      }
      const responseContext = {
        profile: sampleProfile,
        styleConfig,
        sessionNumber: 1,
      }
      const prompt =
        await patientResponseService.generatePatientPrompt(responseContext)
      expect(prompt).not.toContain('You are experiencing a none transference') // Should not explicitly state "none" in that sentence
      expect(prompt).not.toContain('This may strongly color your reactions.') // This part is conditional on transferenceState !== 'none'

      // Check for default mocked emotion content
      expect(prompt).toContain('Focus on conveying neutral.')
      expect(prompt).toContain(
        'The intensity of your expressed emotion should be around 8.0/10.',
      )
    })
  })
})
