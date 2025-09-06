import {
  PatientResponseService,
  type ResponseContext,
  type PatientResponseStyleConfig,
} from './PatientResponseService'
import { PatientProfileService } from './PatientProfileService'
import { BeliefConsistencyService } from './BeliefConsistencyService'
import type { PatientProfile, ConversationMessage } from '../models/patient'
import type {
  CognitiveModel,
  CoreBelief,
  DemographicInfo,
  DiagnosisInfo,
  TherapeuticProgress,
  ConversationalStyle,
} from '../types/CognitiveModel'
import { vi } from 'vitest'

// Mock dependencies
vi.mock('./PatientProfileService')
vi.mock('./BeliefConsistencyService')

const MockPatientProfileService = PatientProfileService as vi.MockedClass<
  typeof PatientProfileService
>
const MockBeliefConsistencyService = BeliefConsistencyService as vi.MockedClass<
  typeof BeliefConsistencyService
>

// Helper to create a basic CognitiveModel for testing
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

describe('PatientResponseService', () => {
  let mockProfileService: vi.Mocked<PatientProfileService>
  let mockConsistencyService: vi.Mocked<BeliefConsistencyService>
  let responseService: PatientResponseService

  // Base style config for tests, specific tests will override parts of this
  const baseStyleConfig: PatientResponseStyleConfig = {
    openness: 5,
    coherence: 7,
    defenseLevel: 3,
    disclosureStyle: 'selective',
    challengeResponses: 'curious',
    // New fields with defaults
    emotionalNuance: 'overt',
    emotionalIntensity: 0.7,
    nonVerbalIndicatorStyle: 'minimal',
    activeDefensiveMechanism: 'none',
    resistanceLevel: 2,
  }

  beforeEach(() => {
    // Reset mocks for each test
    MockPatientProfileService.mockClear()
    MockBeliefConsistencyService.mockClear()

    // Create new instances of mocks for each test
    // It's important that the constructor of the actual service gets *instances* of the mocked services.
    // Vitest's vi.mock() replaces the original class with a mock constructor.
    // So, new MockPatientProfileService() creates an instance of the mock.
    mockProfileService = new MockPatientProfileService(null as unknown) // Pass null or valid mock for KVStore if its constructor is called
    mockConsistencyService = new MockBeliefConsistencyService()

    responseService = new PatientResponseService(
      mockProfileService,
      mockConsistencyService,
    )
  })

  describe('createResponseContext', () => {
    it('should create a response context successfully', async () => {
      const profile = createTestPatientProfile('ctx1', 'Context User')
      mockProfileService.getProfileById.mockResolvedValue(profile)

      const context = await responseService.createResponseContext(
        'ctx1',
        baseStyleConfig,
        ['anxiety'],
        2,
      )

      expect(mockProfileService.getProfileById).toHaveBeenCalledWith('ctx1')
      expect(context).not.toBeNull()
      expect(context?.profile).toEqual(profile)
      expect(context?.styleConfig).toEqual(baseStyleConfig)
      expect(context?.therapeuticFocus).toEqual(['anxiety'])
      expect(context?.sessionNumber).toBe(2)
    })

    it('should return null if profile not found for response context', async () => {
      mockProfileService.getProfileById.mockResolvedValue(null)
      const context = await responseService.createResponseContext(
        'nonexistent',
        baseStyleConfig,
      )
      expect(mockProfileService.getProfileById).toHaveBeenCalledWith(
        'nonexistent',
      )
      expect(context).toBeNull()
    })

    it('should derive session number if not provided in createResponseContext', async () => {
      const profileData = createTestPatientProfile('ctx2', 'Session Deriver')
      profileData.cognitiveModel.therapeuticProgress.sessionProgressLog = [
        { sessionNumber: 1, keyInsights: [], resistanceShift: 0 },
        { sessionNumber: 2, keyInsights: [], resistanceShift: 0 },
      ]
      mockProfileService.getProfileById.mockResolvedValue(profileData)

      const context = await responseService.createResponseContext(
        'ctx2',
        baseStyleConfig,
      )
      expect(context?.sessionNumber).toBe(2)

      const profileDataNoLog = createTestPatientProfile(
        'ctx3',
        'Session Deriver No Log',
      )
      profileDataNoLog.conversationHistory.push({
        role: 'patient',
        content: 'hi',
        timestamp: '',
      }) // Ensure logLength > 0
      mockProfileService.getProfileById.mockResolvedValue(profileDataNoLog)
      // When sessionProgressLog is empty, derivedSessionNumber defaults to 1
      const context3 = await responseService.createResponseContext(
        'ctx3',
        baseStyleConfig,
      )
      expect(context3?.sessionNumber).toBe(1) // Was 1, should remain 1
    })
  })

  describe('generateConsistentResponse', () => {
    it('should return candidate response if it is consistent', async () => {
      const profile = createTestPatientProfile('gen1', 'Consistent Gen')
      const context: ResponseContext = {
        profile,
        styleConfig: baseStyleConfig,
        sessionNumber: 1,
      }
      const candidateResponse = 'I think I can do this.'

      mockConsistencyService.checkBeliefConsistency.mockResolvedValue({
        isConsistent: true,
        contradictionsFound: [],
        confidence: 1.0,
      })

      const response = await responseService.generateConsistentResponse(
        context,
        () => candidateResponse,
      )

      expect(
        mockConsistencyService.checkBeliefConsistency,
      ).toHaveBeenCalledWith(profile, candidateResponse)
      expect(response).toBe(candidateResponse)
    })

    it('should return a therapeutic response if candidate is inconsistent', async () => {
      const coreBeliefText = 'I am a failure'
      const profile = createTestPatientProfile('gen2', 'Inconsistent Gen', [
        {
          belief: coreBeliefText,
          strength: 0.9,
          evidence: [],
          formationContext: '',
          relatedDomains: [],
        },
      ])
      const context: ResponseContext = {
        profile,
        styleConfig: baseStyleConfig,
        sessionNumber: 1,
      }
      const candidateResponse = 'I am a great success!'

      mockConsistencyService.checkBeliefConsistency.mockResolvedValue({
        isConsistent: false,
        contradictionsFound: [
          {
            type: 'belief',
            conflictingText: coreBeliefText,
            explanation: 'Direct negation',
          },
        ],
        confidence: 0.4,
      })

      const response = await responseService.generateConsistentResponse(
        context,
        () => candidateResponse,
      )

      expect(
        mockConsistencyService.checkBeliefConsistency,
      ).toHaveBeenCalledWith(profile, candidateResponse)
      expect(response).toContain('I find myself wanting to say')
      expect(response).toContain(candidateResponse)
      expect(response).toContain(coreBeliefText)
      expect(response).toContain('It feels a bit conflicting')
    })

    it('should handle missing profile in context gracefully for generateConsistentResponse', async () => {
      const candidateResponse = 'This should just return.'
      // Intentionally create a bad context (profile is missing)
      const context = {
        styleConfig: baseStyleConfig,
        sessionNumber: 1,
      } as ResponseContext

      // No need to mock consistencyService here as it shouldn't be called if context.profile is falsy
      const response = await responseService.generateConsistentResponse(
        context,
        () => candidateResponse,
      )
      expect(response).toBe(candidateResponse)
      // checkBeliefConsistency should not have been called
      expect(
        mockConsistencyService.checkBeliefConsistency,
      ).not.toHaveBeenCalled()
    })
  })

  describe('generatePatientPrompt', () => {
    const patientProfile = createTestPatientProfile(
      'promptUser1',
      'Prompt User',
      [
        {
          belief: 'I must be perfect',
          strength: 0.9,
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
      ],
    )
    patientProfile.conversationHistory = [
      {
        role: 'therapist',
        content: 'How are you feeling today?',
        timestamp: new Date().toISOString(),
      },
      {
        role: 'patient',
        content: 'A bit anxious.',
        timestamp: new Date().toISOString(),
      },
    ]

    it('should include basic patient info and style in prompt', () => {
      const context: ResponseContext = {
        profile: patientProfile,
        styleConfig: baseStyleConfig,
        sessionNumber: 3,
        therapeuticFocus: ['managing anxiety'],
      }
      const prompt = responseService.generatePatientPrompt(context)

      expect(prompt).toContain('You are roleplaying as Prompt User')
      expect(prompt).toContain(
        'Your core beliefs include: I must be perfect, The world is dangerous.',
      )
      expect(prompt).toContain(
        `Your openness level is ${baseStyleConfig.openness}/10.`,
      )
      expect(prompt).toContain(
        `Your coherence level is ${baseStyleConfig.coherence}/10.`,
      )
      expect(prompt).toContain(
        `Your defense level is ${baseStyleConfig.defenseLevel}/10.`,
      )
      expect(prompt).toContain(
        `Your disclosure style is ${baseStyleConfig.disclosureStyle}.`,
      )
      expect(prompt).toContain(
        `You respond to challenges in a ${baseStyleConfig.challengeResponses} way.`,
      )
      expect(prompt).toContain(
        'The current therapeutic focus areas are: managing anxiety.',
      )
      expect(prompt).toContain('This is session number 3.')
      expect(prompt).toContain('Therapist: How are you feeling today?')
      expect(prompt).toContain('Prompt User: A bit anxious.')
      expect(prompt).toContain('Respond as Prompt User:')
    })

    it('should correctly include new emotional authenticity parameters in prompt', () => {
      const specificStyle: PatientResponseStyleConfig = {
        ...baseStyleConfig,
        emotionalNuance: 'subtle',
        emotionalIntensity: 0.3,
        primaryEmotion: 'sadness',
        nonVerbalIndicatorStyle: 'descriptive',
      }
      const context: ResponseContext = {
        profile: patientProfile,
        styleConfig: specificStyle,
        sessionNumber: 1,
      }
      const prompt = responseService.generatePatientPrompt(context)

      expect(prompt).toContain('Your emotional expression should be subtle.')
      expect(prompt).toContain(
        'The intensity of your expressed emotion should be around 3/10.',
      )
      expect(prompt).toContain('Focus on conveying sadness.')
      expect(prompt).toContain(
        'Include textual descriptions of non-verbal cues (e.g., *sighs*, *looks away*, *nods slowly*) in a style that is descriptive.',
      )
    })

    it('should correctly include new resistance and defensive mechanism parameters in prompt', () => {
      const specificStyle: PatientResponseStyleConfig = {
        ...baseStyleConfig,
        resistanceLevel: 8,
        activeDefensiveMechanism: 'deflection',
      }
      const context: ResponseContext = {
        profile: patientProfile,
        styleConfig: specificStyle,
        sessionNumber: 1,
      }
      const prompt = responseService.generatePatientPrompt(context)

      expect(prompt).toContain(
        'Your resistance to therapeutic suggestions is 8/10.',
      )
      expect(prompt).toContain(
        'You are currently employing deflection as a defensive mechanism.',
      )
      expect(prompt).toContain(
        'Try to subtly change the subject or avoid direct answers if the topic feels uncomfortable.',
      )
    })

    it('should include specific instruction for intellectualization defense', () => {
      const specificStyle: PatientResponseStyleConfig = {
        ...baseStyleConfig,
        activeDefensiveMechanism: 'intellectualization',
      }
      const context: ResponseContext = {
        profile: patientProfile,
        styleConfig: specificStyle,
        sessionNumber: 1,
      }
      const prompt = responseService.generatePatientPrompt(context)
      expect(prompt).toContain(
        'Focus on abstract concepts and avoid expressing direct feelings.',
      )
    })

    it('should include specific instruction for minimization defense', () => {
      const specificStyle: PatientResponseStyleConfig = {
        ...baseStyleConfig,
        activeDefensiveMechanism: 'minimization',
      }
      const context: ResponseContext = {
        profile: patientProfile,
        styleConfig: specificStyle,
        sessionNumber: 1,
      }
      const prompt = responseService.generatePatientPrompt(context)
      expect(prompt).toContain('Downplay the importance of concerns raised.')
    })

    it('should include instruction for emotional transitions', () => {
      const context: ResponseContext = {
        profile: patientProfile,
        styleConfig: baseStyleConfig,
        sessionNumber: 1,
      }
      const prompt = responseService.generatePatientPrompt(context)
      expect(prompt).toContain(
        "Consider your previous emotional state and the therapist's last statement when forming your response, allowing for natural emotional shifts or intensifications.",
      )
      expect(prompt).toContain(
        'Maintain consistency with your established beliefs and history, but allow for emotional evolution within the conversation.',
      )
    })

    it('should handle "none" for nonVerbalIndicatorStyle and activeDefensiveMechanism', () => {
      const specificStyle: PatientResponseStyleConfig = {
        ...baseStyleConfig,
        nonVerbalIndicatorStyle: 'none',
        activeDefensiveMechanism: 'none',
      }
      const context: ResponseContext = {
        profile: patientProfile,
        styleConfig: specificStyle,
        sessionNumber: 1,
      }
      const prompt = responseService.generatePatientPrompt(context)

      expect(prompt).not.toContain(
        'Include textual descriptions of non-verbal cues',
      )
      expect(prompt).not.toContain('You are currently employing')
    })
  })
})
