import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'

import type { PatientProfile, ConversationMessage } from '../models/patient'
import type {
  CognitiveModel,
  CoreBelief,
  TherapeuticProgress,
} from '../types/CognitiveModel'
import { BeliefConsistencyService } from './BeliefConsistencyService'
import { PatientProfileService } from './PatientProfileService'
import {
  PatientResponseService,
  type ResponseContext,
  type PatientResponseStyleConfig,
  createPatientResponseService,
  createTestPatientResponseService,
} from './PatientResponseService'
import { EmotionSynthesizer } from '../emotions/EmotionSynthesizer'
import { KVStore } from '../../db/KVStore'

type ProfileServiceSpy = MockInstance<
  typeof PatientProfileService.prototype.getProfileById
>
type ConsistencyServiceSpy = MockInstance<
  typeof BeliefConsistencyService.prototype.checkBeliefConsistency
>

let getProfileByIdSpy!: ProfileServiceSpy
let checkBeliefConsistencySpy!: ConsistencyServiceSpy

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
    ] as TherapeuticProgress['skillsAcquired'],
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

describe('PatientResponseService', () => {
  let responseService: PatientResponseService
  let testEmotionSynthesizer: EmotionSynthesizer

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

  let serviceProfileService: PatientProfileService
  let serviceConsistencyService: BeliefConsistencyService

  beforeEach(() => {
    vi.restoreAllMocks()
    serviceProfileService = new PatientProfileService(new KVStore('test-profile-store'))
    serviceConsistencyService = new BeliefConsistencyService()
    getProfileByIdSpy = vi.spyOn(serviceProfileService, 'getProfileById')
    checkBeliefConsistencySpy = vi.spyOn(
      serviceConsistencyService,
      'checkBeliefConsistency',
    )

    // Use a fresh test instance to avoid singleton state pollution
    testEmotionSynthesizer = EmotionSynthesizer.createTestInstance()
    responseService = new PatientResponseService(
      serviceProfileService,
      serviceConsistencyService,
      testEmotionSynthesizer,
    )
  })

  describe('createResponseContext', () => {
    it('should create a response context successfully', async () => {
      const profile = createTestPatientProfile('ctx1', 'Context User')
      getProfileByIdSpy.mockResolvedValue(profile)

      const context = await responseService.createResponseContext(
        'ctx1',
        baseStyleConfig,
        ['anxiety'],
        2,
      )

      expect(getProfileByIdSpy).toHaveBeenCalledWith('ctx1')
      expect(context).not.toBeNull()
      expect(context?.profile).toEqual(profile)
      expect(context?.styleConfig).toEqual(baseStyleConfig)
      expect(context?.therapeuticFocus).toEqual(['anxiety'])
      expect(context?.sessionNumber).toBe(2)
    })

    it('should return null if profile not found for response context', async () => {
      getProfileByIdSpy.mockResolvedValue(null)
      const context = await responseService.createResponseContext(
        'nonexistent',
        baseStyleConfig,
      )
      expect(getProfileByIdSpy).toHaveBeenCalledWith(
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
      getProfileByIdSpy.mockResolvedValue(profileData)

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
      getProfileByIdSpy.mockResolvedValue(profileDataNoLog)
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

      checkBeliefConsistencySpy.mockResolvedValue({
        isConsistent: true,
        contradictionsFound: [],
        confidence: 1.0,
      })

      const response = await responseService.generateConsistentResponse(
        context,
        () => candidateResponse,
      )

      expect(
        checkBeliefConsistencySpy,
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

      checkBeliefConsistencySpy.mockResolvedValue({
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
        checkBeliefConsistencySpy,
      ).toHaveBeenCalledWith(profile, candidateResponse)
      expect(response).toContain('I find myself wanting to say')
      expect(response).toContain(candidateResponse)
      expect(response).toContain(coreBeliefText)
      expect(response).toContain('It feels a bit conflicting')
    })

    it('should handle missing profile in context gracefully for generateConsistentResponse', async () => {
      const candidateResponse = 'This should just return.'
      // Intentionally create a bad context (profile is missing)
      const context: Parameters<
        typeof responseService.generateConsistentResponse
      >[0] = {
        styleConfig: baseStyleConfig,
        sessionNumber: 1,
      }

      // No need to mock consistencyService here as it shouldn't be called if context.profile is falsy
      const response = await responseService.generateConsistentResponse(
        context,
        () => candidateResponse,
      )
      expect(response).toBe(candidateResponse)
      // checkBeliefConsistency should not have been called
      expect(
        checkBeliefConsistencySpy,
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

    it('should include basic patient info and style in prompt', async () => {
      const context: ResponseContext = {
        profile: patientProfile,
        styleConfig: baseStyleConfig,
        sessionNumber: 3,
        therapeuticFocus: ['managing anxiety'],
      }
      const prompt = await responseService.generatePatientPrompt(context)

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

    it('should correctly include new emotional authenticity parameters in prompt', async () => {
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
      const prompt = await responseService.generatePatientPrompt(context)

      expect(prompt).toContain('Your emotional expression should be subtle.')
      expect(prompt).toMatch(/The intensity of your expressed emotion should be around 3(?:\.0)?\/10\./)
      expect(prompt).toContain('Focus on conveying sadness.')
      expect(prompt).toContain(
        'Include textual descriptions of non-verbal cues (e.g., *sighs*, *looks away*, *nods slowly*) in a style that is descriptive.',
      )
    })

    it('should correctly include new resistance and defensive mechanism parameters in prompt', async () => {
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
      const prompt = await responseService.generatePatientPrompt(context)

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

    it('should include specific instruction for intellectualization defense', async () => {
      const specificStyle: PatientResponseStyleConfig = {
        ...baseStyleConfig,
        activeDefensiveMechanism: 'intellectualization',
      }
      const context: ResponseContext = {
        profile: patientProfile,
        styleConfig: specificStyle,
        sessionNumber: 1,
      }
      const prompt = await responseService.generatePatientPrompt(context)
      expect(prompt).toContain(
        'Focus on abstract concepts and avoid expressing direct feelings.',
      )
    })

    it('should include specific instruction for minimization defense', async () => {
      const specificStyle: PatientResponseStyleConfig = {
        ...baseStyleConfig,
        activeDefensiveMechanism: 'minimization',
      }
      const context: ResponseContext = {
        profile: patientProfile,
        styleConfig: specificStyle,
        sessionNumber: 1,
      }
      const prompt = await responseService.generatePatientPrompt(context)
      expect(prompt).toContain('Downplay the importance of concerns raised.')
    })

    it('should include instruction for emotional transitions', async () => {
      const context: ResponseContext = {
        profile: patientProfile,
        styleConfig: baseStyleConfig,
        sessionNumber: 1,
      }
      const prompt = await responseService.generatePatientPrompt(context)
      expect(prompt).toContain(
        "Consider your previous emotional state and the therapist's last statement when forming your response, allowing for natural emotional shifts or intensifications.",
      )
      expect(prompt).toContain(
        'Maintain consistency with your established beliefs and history, but allow for emotional evolution within the conversation.',
      )
    })

    it('should handle "none" for nonVerbalIndicatorStyle and activeDefensiveMechanism', async () => {
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
      const prompt = await responseService.generatePatientPrompt(context)

      expect(prompt).not.toContain(
        'Include textual descriptions of non-verbal cues',
      )
      expect(prompt).not.toContain('You are currently employing')
    })
  })

  describe('updateTherapeuticAllianceMetrics - Therapist Utterance Analysis', () => {
    const testProfile = createTestPatientProfile('alliance1', 'Alliance User')

    it('should boost trust/rapport on therapist validation', () => {
      const updated = responseService['updateTherapeuticAllianceMetrics'](
        testProfile,
        'I understand how you feel, that makes sense.',
        'Thank you.',
      )
      expect(
        updated.cognitiveModel.therapeuticProgress.trustLevel,
      ).toBeGreaterThan(5)
      expect(
        updated.cognitiveModel.therapeuticProgress.rapportScore,
      ).toBeGreaterThan(5)
    })

    it('should penalize trust/rapport on dismissive therapist language', () => {
      const updated = responseService['updateTherapeuticAllianceMetrics'](
        testProfile,
        "Don't worry, it's not a big deal.",
        'Okay...',
      )
      expect(
        updated.cognitiveModel.therapeuticProgress.trustLevel,
      ).toBeLessThan(5)
      expect(
        updated.cognitiveModel.therapeuticProgress.rapportScore,
      ).toBeLessThan(5)
    })

    it('should set therapist perception to dismissive on dismissive language', () => {
      const updated = responseService['updateTherapeuticAllianceMetrics'](
        testProfile,
        "Don't worry, it's not a big deal.",
        'Okay.',
      )
      expect(
        updated.cognitiveModel.therapeuticProgress.therapistPerception,
      ).toBe('dismissive')
    })

    it('should detect confrontation language', () => {
      const updated = responseService['updateTherapeuticAllianceMetrics'](
        testProfile,
        "But isn't it true that you need to accept this?",
        'I guess so.',
      )
      expect(
        updated.cognitiveModel.therapeuticProgress.therapistPerception,
      ).toBe('challenging')
    })

    it('should detect reflective statements', () => {
      const updated = responseService['updateTherapeuticAllianceMetrics'](
        testProfile,
        "So you're saying that things have been difficult.",
        'Yes, exactly, that really resonates with me.',  // >= 15 chars to avoid short-response defensive penalty
      )
      // Reflective statements boost rapport
      expect(
        updated.cognitiveModel.therapeuticProgress.rapportScore,
      ).toBeGreaterThan(5)
    })

    it('should detect gentle challenge', () => {
      const updated = responseService['updateTherapeuticAllianceMetrics'](
        testProfile,
        'Have you considered looking at it differently?',
        'Not really.',
      )
      expect(
        updated.cognitiveModel.therapeuticProgress.trustLevel,
      ).toBeLessThan(5)
    })
  })

  describe('updateTherapeuticAllianceMetrics - Patient Utterance Analysis', () => {
    const testProfile = createTestPatientProfile('alliance2', 'Alliance Patient')

    it('should boost trust/rapport on patient agreement', () => {
      const updated = responseService['updateTherapeuticAllianceMetrics'](
        testProfile,
        'How does that sound?',
        "That's right, I feel understood.",
      )
      expect(
        updated.cognitiveModel.therapeuticProgress.trustLevel,
      ).toBeGreaterThan(5)
    })

    it('should penalize trust on patient disagreement and change perception to confusing', () => {
      const updated = responseService['updateTherapeuticAllianceMetrics'](
        testProfile,
        'Do you agree?',
        "No but I don't think so.",
      )
      expect(
        updated.cognitiveModel.therapeuticProgress.trustLevel,
      ).toBeLessThan(5)
      expect(
        updated.cognitiveModel.therapeuticProgress.therapistPerception,
      ).toBe('confusing')
    })

    it('should penalize trust on defensive short response', () => {
      const updated = responseService['updateTherapeuticAllianceMetrics'](
        testProfile,
        'Can you tell me more?',
        'Fine.', // Short response triggers defensiveness
      )
      expect(
        updated.cognitiveModel.therapeuticProgress.trustLevel,
      ).toBeLessThan(5)
    })

    it('should update perception to supportive when patient agrees with challenge', () => {
      // First set perception to challenging
      const afterChallenge = responseService['updateTherapeuticAllianceMetrics'](
        testProfile,
        'Have you considered this might be a pattern?',
        'I guess so.',
      )
      expect(
        afterChallenge.cognitiveModel.therapeuticProgress.therapistPerception,
      ).toBe('challenging')

      // Now patient agrees, perception should become supportive
      const afterAgreement = responseService['updateTherapeuticAllianceMetrics'](
        afterChallenge,
        'How does that make you feel?',
        "I agree, that's right.",
      )
      expect(
        afterAgreement.cognitiveModel.therapeuticProgress.therapistPerception,
      ).toBe('supportive')
    })
  })

  describe('updateTherapeuticAllianceMetrics - Transference State', () => {
    const testProfile = createTestPatientProfile('trans1', 'Transference User')

    it('should detect maternal transference trigger', () => {
      const updated = responseService['updateTherapeuticAllianceMetrics'](
        testProfile,
        'Tell me about your mother.',
        "She's just like my mother.",
      )
      expect(
        updated.cognitiveModel.therapeuticProgress.transferenceState,
      ).toBe('maternal')
    })

    it('should detect paternal transference trigger', () => {
      const updated = responseService['updateTherapeuticAllianceMetrics'](
        testProfile,
        'Tell me about your father.',
        "He's just like my father.",
      )
      expect(
        updated.cognitiveModel.therapeuticProgress.transferenceState,
      ).toBe('paternal')
    })

    it('should detect positive-idealizing transference', () => {
      // Set high trust, high rapport, supportive perception
      const profileHigh = createTestPatientProfile('trans2', 'High Rapport')
      profileHigh.cognitiveModel.therapeuticProgress.trustLevel = 8
      profileHigh.cognitiveModel.therapeuticProgress.rapportScore = 9
      profileHigh.cognitiveModel.therapeuticProgress.therapistPerception =
        'supportive'

      const updated = responseService['updateTherapeuticAllianceMetrics'](
        profileHigh,
        'That was really helpful.',
        'I feel so much better.',
      )
      expect(
        updated.cognitiveModel.therapeuticProgress.transferenceState,
      ).toBe('positive-idealizing')
    })

    it('should detect negative-critical transference', () => {
      const profileLow = createTestPatientProfile('trans3', 'Low Trust')
      profileLow.cognitiveModel.therapeuticProgress.trustLevel = 2
      profileLow.cognitiveModel.therapeuticProgress.therapistPerception =
        'dismissive'

      const updated = responseService['updateTherapeuticAllianceMetrics'](
        profileLow,
        'Good morning.',  // Neutral — doesn't match validation/confrontation/dismissive patterns
        'Whatever.',
      )
      expect(
        updated.cognitiveModel.therapeuticProgress.transferenceState,
      ).toBe('negative-critical')
    })

    it('should keep transference as none when no triggers match', () => {
      const updated = responseService['updateTherapeuticAllianceMetrics'](
        testProfile,
        'How was your week?',
        'It was okay.',
      )
      expect(
        updated.cognitiveModel.therapeuticProgress.transferenceState,
      ).toBe('none')
    })
  })

  describe('updateTherapeuticAllianceMetrics - NaN Handling', () => {
    it('should handle unset trust level and rapport score', () => {
      const profile = createTestPatientProfile('nan1', 'NaN User')
      ;(profile.cognitiveModel.therapeuticProgress.trustLevel as unknown) =
        undefined
      ;(profile.cognitiveModel.therapeuticProgress.rapportScore as unknown) =
        undefined

      const updated = responseService['updateTherapeuticAllianceMetrics'](
        profile,
        'Hello',
        'Hi',
      )
      expect(
        updated.cognitiveModel.therapeuticProgress.trustLevel,
      ).toBeGreaterThanOrEqual(0)
      expect(
        updated.cognitiveModel.therapeuticProgress.rapportScore,
      ).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Basic Emotional State Methods', () => {
    it('getDefaultEmotionalProfile should return a valid profile', () => {
      const profile = responseService.getDefaultEmotionalProfile()
      expect(profile).toHaveProperty('emotions')
      expect(profile).toHaveProperty('id')
      expect(profile.emotions['neutral']).toBeGreaterThanOrEqual(0)
    })

    it('getCurrentEmotionalProfile should return null initially', () => {
      const profile = responseService.getCurrentEmotionalProfile()
      expect(profile).toBeNull()
    })

    it('resetEmotionalState should not throw', () => {
      expect(() => responseService.resetEmotionalState()).not.toThrow()
    })
  })

  describe('synthesizeEmotionalContext', () => {
    it('should synthesize emotional context for subtle nuance', async () => {
      const profile = createTestPatientProfile('synth1', 'Synth User')
      const context: ResponseContext = {
        profile,
        styleConfig: { ...baseStyleConfig, emotionalNuance: 'subtle', emotionalIntensity: 0.5 },
        sessionNumber: 1,
      }
      const result = await responseService.synthesizeEmotionalContext(
        context,
        'sadness',
      )
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should synthesize emotional context for overt nuance', async () => {
      const profile = createTestPatientProfile('synth2', 'Synth Overt')
      const context: ResponseContext = {
        profile,
        styleConfig: {
          ...baseStyleConfig,
          emotionalNuance: 'overt',
          emotionalIntensity: 0.8,
          primaryEmotion: 'joy',
        },
        sessionNumber: 1,
      }
      const result = await responseService.synthesizeEmotionalContext(
        context,
        'joy',
      )
      expect(typeof result).toBe('string')
    })

    it('should synthesize emotional context for suppressed nuance', async () => {
      const profile = createTestPatientProfile('synth3', 'Synth Suppressed')
      const context: ResponseContext = {
        profile,
        styleConfig: { ...baseStyleConfig, emotionalNuance: 'suppressed', emotionalIntensity: 0.4 },
        sessionNumber: 1,
      }
      const result = await responseService.synthesizeEmotionalContext(
        context,
        'anger',
      )
      expect(typeof result).toBe('string')
    })
  })

  describe('Factory Functions', () => {
    it('createPatientResponseService should throw without profileService', () => {
      expect(() => createPatientResponseService()).toThrow('profileService')
    })

    it('createPatientResponseService should create service with dependencies', () => {
      const ps = new PatientProfileService(new KVStore('factory-test'))
      const svc = createPatientResponseService({ profileService: ps })
      expect(svc).toBeInstanceOf(PatientResponseService)
    })

    it('createTestPatientResponseService should throw without profileService', () => {
      expect(() => createTestPatientResponseService()).toThrow('profileService')
    })

    it('createTestPatientResponseService should create service with dependencies', () => {
      const ps = new PatientProfileService(new KVStore('test-factory'))
      const svc = createTestPatientResponseService({ profileService: ps })
      expect(svc).toBeInstanceOf(PatientResponseService)
    })
  })
})
