import { TreatmentPlanService } from '../TreatmentPlanService'
import type { PatientProfile, ConversationMessage } from '../../models/patient'
import type {
  CognitiveModel,
  CoreBelief,
  TherapeuticProgress,
  SkillAcquired,
  DemographicInfo,
  DiagnosisInfo,
} from '../../types/CognitiveModel'

describe('TreatmentPlanService', () => {
  let service: TreatmentPlanService
  let mockPatientProfile: PatientProfile

  beforeEach(() => {
    service = new TreatmentPlanService()
    vi.clearAllMocks()

    const initialDemographics: DemographicInfo = {
      age: 35,
      gender: 'male',
      occupation: 'artist',
      familyStatus: 'married',
      culturalFactors: ['urban'],
    }
    const initialDiagnosis: DiagnosisInfo = {
      primaryDiagnosis: 'Major Depressive Disorder',
      secondaryDiagnoses: ['Generalized Anxiety Disorder'],
      durationOfSymptoms: '5 years',
      severity: 'moderate',
    }
    const initialCoreBeliefs: CoreBelief[] = [
      {
        belief: 'I am a failure',
        strength: 0.9,
        evidence: [],
        formationContext: 'childhood',
        relatedDomains: ['work', 'relationships'],
      },
      {
        belief: 'Nothing will ever work out for me',
        strength: 0.75,
        evidence: [],
        formationContext: 'past disappointments',
        relatedDomains: ['future'],
      },
      {
        belief: 'I am unlovable',
        strength: 0.4,
        evidence: [],
        formationContext: 'past relationships',
        relatedDomains: ['relationships'],
      }, // Lower strength
    ]
    const initialGoals: string[] = [
      'Improve mood',
      'Increase engagement in enjoyable activities',
      'Challenge negative thought patterns',
    ]
    const initialSkills: SkillAcquired[] = [
      {
        skillName: 'Mindful Breathing',
        dateAchieved: new Date().toISOString(),
        proficiency: 0.6,
        applicationContext: ['when anxious'],
      },
    ]
    const initialTherapeuticProgress: TherapeuticProgress = {
      insights: [
        {
          insight: 'My negative thoughts are not always facts.',
          belief: 'I am a failure',
          dateAchieved: new Date().toISOString(),
        },
      ],
      skillsAcquired: initialSkills,
      resistanceLevel: 3,
      changeReadiness: 'action',
      sessionProgressLog: [],
      trustLevel: 7,
      rapportScore: 8,
      therapistPerception: 'supportive',
      transferenceState: 'none',
    }
    const initialCognitiveModel: CognitiveModel = {
      id: 'patient001',
      name: 'John Doe',
      demographicInfo: initialDemographics,
      presentingIssues: [
        'Persistent sadness',
        'Loss of interest',
        'Excessive worry',
        'Difficulty sleeping',
      ],
      diagnosisInfo: initialDiagnosis,
      coreBeliefs: initialCoreBeliefs,
      distortionPatterns: [
        {
          type: 'Catastrophizing',
          examples: ['If I fail this, my life is over.'],
          triggerThemes: ['work'],
          frequency: 'frequent',
        },
      ],
      behavioralPatterns: [
        {
          trigger: 'Feeling overwhelmed',
          response: 'Avoidance',
          reinforcers: ['Temporary relief'],
          consequences: ['Increased anxiety later'],
          alternateTried: ['Talking to wife'],
        },
      ],
      emotionalPatterns: [
        {
          emotion: 'Sadness',
          intensity: 0.8,
          triggers: ['Mornings', 'Work stress'],
          physicalManifestations: ['Fatigue'],
          copingMechanisms: ['Sleeping'],
        },
      ],
      relationshipPatterns: [],
      formativeExperiences: [],
      therapyHistory: {
        previousApproaches: ['SSRI (limited success)'],
        helpfulInterventions: [],
        unhelpfulInterventions: [],
        insights: [],
        progressMade: 'Some improvement in sleep',
        remainingChallenges: ['Motivation', 'Negative thoughts'],
      },
      conversationalStyle: {
        verbosity: 0.6,
        emotionalExpressiveness: 0.4,
        insightLevel: 0.5,
        preferredCommunicationModes: ['face-to-face'],
      },
      goalsForTherapy: initialGoals,
      therapeuticProgress: initialTherapeuticProgress,
    }
    mockPatientProfile = {
      id: 'patient001',
      cognitiveModel: initialCognitiveModel,
      conversationHistory: [] as ConversationMessage[],
      lastUpdatedAt: new Date().toISOString(),
    }
  })

  describe('generateTreatmentPlan', () => {
    it('should generate a non-empty Markdown string for a valid profile', () => {
      const plan = service.generateTreatmentPlan(mockPatientProfile)
      expect(typeof plan).toBe('string')
      expect(plan.length).toBeGreaterThan(0)
      expect(plan).toContain('# Treatment Plan for John Doe')
    })

    it('should include patient information', () => {
      const plan = service.generateTreatmentPlan(mockPatientProfile)
      expect(plan).toMatch(/## Patient Information/)
      expect(plan).toMatch(/- \*\*ID:\*\* patient001/)
      expect(plan).toMatch(/- \*\*Name:\*\* John Doe/)
      expect(plan).toMatch(/- \*\*Age:\*\* 35/)
      expect(plan).toMatch(/- \*\*Gender:\*\* male/)
      expect(plan).toMatch(/- \*\*Occupation:\*\* artist/)
    })

    it('should include presenting issues', () => {
      const plan = service.generateTreatmentPlan(mockPatientProfile)
      expect(plan).toMatch(/## Presenting Issues/)
      mockPatientProfile.cognitiveModel.presentingIssues.forEach((issue) => {
        expect(plan).toContain(`- ${issue}`)
      })
    })

    it('should include diagnosis information', () => {
      const plan = service.generateTreatmentPlan(mockPatientProfile)
      expect(plan).toMatch(/## Diagnosis Information/)
      expect(plan).toContain(
        `- **Primary Diagnosis:** ${mockPatientProfile.cognitiveModel.diagnosisInfo.primaryDiagnosis}`,
      )
      expect(plan).toContain(
        `- **Secondary Diagnoses:** ${mockPatientProfile.cognitiveModel.diagnosisInfo.secondaryDiagnoses.join(', ')}`,
      )
      expect(plan).toContain(
        `- **Severity:** ${mockPatientProfile.cognitiveModel.diagnosisInfo.severity}`,
      )
      expect(plan).toContain(
        `- **Duration of Symptoms:** ${mockPatientProfile.cognitiveModel.diagnosisInfo.durationOfSymptoms}`,
      )
    })

    it('should include key core beliefs to address (strength > 0.5)', () => {
      const plan = service.generateTreatmentPlan(mockPatientProfile)
      expect(plan).toMatch(/## Key Areas of Focus \(Core Beliefs\)/)
      expect(plan).toContain('- **I am a failure** (Strength: 0.90)')
      expect(plan).toContain(
        '- **Nothing will ever work out for me** (Strength: 0.75)',
      )
      expect(plan).not.toContain('- **I am unlovable**') // Strength 0.4
    })

    it('should include therapeutic goals', () => {
      const plan = service.generateTreatmentPlan(mockPatientProfile)
      expect(plan).toMatch(/## Therapeutic Goals/)
      mockPatientProfile.cognitiveModel.goalsForTherapy.forEach((goal) => {
        expect(plan).toContain(`- ${goal}`)
      })
    })

    it('should include proposed interventions with some tailoring', () => {
      const plan = service.generateTreatmentPlan(mockPatientProfile)
      expect(plan).toMatch(/## Proposed Interventions/)
      expect(plan).toContain('- **Cognitive Behavioral Therapy (CBT):**')
      expect(plan).toContain(
        'Specific focus on identifying and challenging negative self-talk and core beliefs related to self-worth.',
      ) // Due to "I am a failure"
      expect(plan).toContain(
        '- **Relaxation and Mindfulness Techniques:** To manage anxiety symptoms',
      ) // Due to "Excessive worry" (anxiety)
    })

    it('should include key skills to develop, including acquired and suggested', () => {
      const plan = service.generateTreatmentPlan(mockPatientProfile)
      expect(plan).toMatch(/## Key Skills to Develop\/Strengthen/)
      expect(plan).toContain('- Mindful Breathing (Current Proficiency: 60%)')
      // Suggested based on goals/issues (MDD -> Improve mood, negative thoughts)
      expect(plan).toContain(
        '- Positive Self-Talk and Self-Compassion Exercises',
      )
      // Suggested based on GAD -> excessive worry / anxiety
      expect(plan).toContain(
        '- Grounding Techniques and Progressive Muscle Relaxation',
      )
    })

    it('should handle profiles with no existing skills gracefully', () => {
      mockPatientProfile.cognitiveModel.therapeuticProgress.skillsAcquired = []
      const plan = service.generateTreatmentPlan(mockPatientProfile)
      expect(plan).toMatch(/## Key Skills to Develop\/Strengthen/)
      expect(plan).not.toContain('Current Proficiency')
      expect(plan).toContain(
        '- Positive Self-Talk and Self-Compassion Exercises',
      ) // Still suggests new ones
    })

    it('should handle profiles with minimal data', () => {
      const minimalProfile: PatientProfile = {
        id: 'min001',
        cognitiveModel: {
          id: 'min001',
          name: 'Minimal Patient',
          demographicInfo: {
            age: 0,
            gender: '',
            occupation: '',
            familyStatus: '',
            culturalFactors: [],
          },
          presentingIssues: [],
          diagnosisInfo: {
            primaryDiagnosis: 'Unspecified',
            secondaryDiagnoses: [],
            durationOfSymptoms: '',
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
            verbosity: 0,
            emotionalExpressiveness: 0,
            insightLevel: 0,
            preferredCommunicationModes: [],
          },
          goalsForTherapy: [],
          therapeuticProgress: {
            insights: [],
            skillsAcquired: [],
            resistanceLevel: 0,
            changeReadiness: 'precontemplation',
            sessionProgressLog: [],
            trustLevel: 0,
            rapportScore: 0,
            therapistPerception: 'neutral',
            transferenceState: 'none',
          },
        },
        conversationHistory: [],
        lastUpdatedAt: new Date().toISOString(),
      }
      const plan = service.generateTreatmentPlan(minimalProfile)
      expect(plan).toContain('# Treatment Plan for Minimal Patient')
      expect(plan).toContain('## Patient Information')
      expect(plan).toContain('## Diagnosis Information')
      expect(plan).toContain('## Proposed Interventions') // Generic interventions should still appear
      expect(plan).toContain(
        '- General coping strategies and emotional regulation.',
      ) // Default skill text
      expect(plan).toContain('## Progress Monitoring')
    })

    it('should throw an error for an invalid profile', () => {
      expect(() =>
        service.generateTreatmentPlan(null as unknown as PatientProfile),
      ).toThrow('Invalid patient profile or cognitive model missing.')
      const invalidProfile = { id: 'bad' } as PatientProfile // Missing cognitiveModel
      expect(() => service.generateTreatmentPlan(invalidProfile)).toThrow(
        'Invalid patient profile or cognitive model missing.',
      )
    })
  })
})
