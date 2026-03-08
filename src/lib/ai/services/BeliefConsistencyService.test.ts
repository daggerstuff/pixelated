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

describe('BeliefConsistencyService', () => {
  let service: BeliefConsistencyService

  beforeEach(() => {
    service = new BeliefConsistencyService()
  })

  describe('checkBeliefConsistency', () => {
    const belief1: CoreBelief = {
      belief: 'I am worthless',
      strength: 0.8,
      evidence: [],
      formationContext: '',
      relatedDomains: [],
    }
    // Note: The 'belief2' was unused in the original tests for this block, so it's omitted here.

    it('should be consistent if new statement does not contradict core beliefs or recent history', async () => {
      const profile = createTestPatientProfile(
        'consist1',
        'Consistent Connie',
        [belief1],
        [
          {
            role: 'patient',
            content: 'I had a good day',
            timestamp: new Date().toISOString(),
          },
        ],
      )
      const result = await service.checkBeliefConsistency(
        profile,
        'I feel okay today',
      )
      expect(result.isConsistent).toBe(true)
      expect(result.contradictionsFound).toHaveLength(0)
    })

    it('should detect inconsistency with a core belief (simple negation: "i am not worthless" vs "I am worthless")', async () => {
      const profile = createTestPatientProfile(
        'consist2',
        'Contradictory Chris',
        [belief1],
      )
      const result = await service.checkBeliefConsistency(
        profile,
        'I am not worthless',
      )
      expect(result.isConsistent).toBe(false)
      expect(result.contradictionsFound).toHaveLength(1)
      const contradiction = result.contradictionsFound[0]
      if (contradiction) {
        expect(contradiction.type).toBe('belief')
        expect(contradiction.conflictingText).toBe(belief1.belief)
      }
    })

    it('should detect inconsistency with a core belief (negation: "i am never failing" vs "I am always failing")', async () => {
      const profile = createTestPatientProfile('consistNever', 'Never Nancy', [
        {
          belief: 'I am always failing',
          strength: 0.9,
          evidence: [],
          formationContext: '',
          relatedDomains: [],
        },
      ])
      const result = await service.checkBeliefConsistency(
        profile,
        'I am never failing',
      )
      expect(result.isConsistent).toBe(false)
      expect(result.contradictionsFound).toHaveLength(1)
      const contradiction = result.contradictionsFound[0]
      if (contradiction) {
        expect(contradiction.type).toBe('belief')
      }
    })

    it('should detect inconsistency with recent patient statement (negation: "i do not hate pizza" vs "I hate pizza")', async () => {
      const profile = createTestPatientProfile(
        'consist3',
        'Forgetful Fred',
        [],
        [
          {
            role: 'patient',
            content: 'I hate pizza',
            timestamp: new Date().toISOString(),
          },
        ],
      )
      const result = await service.checkBeliefConsistency(
        profile,
        'I do not hate pizza',
      )
      expect(result.isConsistent).toBe(false)
      expect(result.contradictionsFound).toHaveLength(1)
      const contradiction = result.contradictionsFound[0]
      if (contradiction) {
        expect(contradiction.type).toBe('statement')
        expect(contradiction.conflictingText).toBe('I hate pizza')
      }
    })

    it('should only check against N recent patient statements', async () => {
      const oldStatement = 'I love Mondays'
      const newStatementContradictingOld = 'I do not love Mondays'
      const history: ConversationMessage[] = [
        {
          role: 'patient',
          content: 'This is too old',
          timestamp: new Date(Date.now() - 200000).toISOString(),
        },
        {
          role: 'patient',
          content: oldStatement,
          timestamp: new Date(Date.now() - 100000).toISOString(),
        },
        {
          role: 'patient',
          content: 'Today is Tuesday',
          timestamp: new Date(Date.now() - 50000).toISOString(),
        },
        {
          role: 'patient',
          content: 'I need coffee',
          timestamp: new Date().toISOString(),
        },
      ] // Total 4 patient statements
      const profile = createTestPatientProfile(
        'consist4',
        'Recent Rachel',
        [],
        history,
      )

      // Check against last 2 statements (Tuesday, coffee) - should be consistent with "I do not love Mondays"
      let result = await service.checkBeliefConsistency(
        profile,
        newStatementContradictingOld,
        2,
      )
      expect(result.isConsistent).toBe(true)

      // Check against last 3 statements (Mondays, Tuesday, coffee) - should be inconsistent
      result = await service.checkBeliefConsistency(
        profile,
        newStatementContradictingOld,
        3,
      )
      expect(result.isConsistent).toBe(false)
      const contradiction = result.contradictionsFound[0]
      if (contradiction) {
        expect(contradiction.type).toBe('statement')
        expect(contradiction.conflictingText).toBe(oldStatement)
      }
    })
  })
})
