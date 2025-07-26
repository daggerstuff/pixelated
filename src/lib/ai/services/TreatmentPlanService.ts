import type { PatientProfile } from '../models/patient'
import type { SkillAcquired } from '../types/CognitiveModel'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const appLogger = createBuildSafeLogger('app')

/**
 * Configuration for intervention rules
 */
interface InterventionRule {
  id: string
  name: string
  keywords: string[]
  intervention: string
  conditions?: {
    checkCoreBeliefs?: boolean
    checkPresentingIssues?: boolean
    checkGoals?: boolean
    beliefStrengthThreshold?: number
  }
}

interface SkillRule {
  id: string
  skillName: string
  keywords: string[]
  conditions?: {
    checkGoals?: boolean
    checkPresentingIssues?: boolean
    checkCoreBeliefs?: boolean
    beliefStrengthThreshold?: number
  }
  exclusionKeywords?: string[]
}

/**
 * Intervention rules configuration
 */
const INTERVENTION_RULES: InterventionRule[] = [
  {
    id: 'self-worth',
    name: 'Self-Worth Focus',
    keywords: ['worthless', 'failure'],
    intervention:
      '  - Specific focus on identifying and challenging negative self-talk and core beliefs related to self-worth.\n',
    conditions: {
      checkCoreBeliefs: true,
      beliefStrengthThreshold: 0.5,
    },
  },
  {
    id: 'anxiety-management',
    name: 'Anxiety Management',
    keywords: ['anxiety', 'worry'],
    intervention:
      '- **Relaxation and Mindfulness Techniques:** To manage anxiety symptoms (e.g., deep breathing, grounding exercises).\n',
    conditions: {
      checkPresentingIssues: true,
    },
  },
  {
    id: 'trauma-informed',
    name: 'Trauma-Informed Care',
    keywords: ['trauma'],
    intervention:
      '- **Trauma-Informed Care:** Approaches tailored to addressing past traumatic experiences (if applicable and patient is ready).\n',
    conditions: {
      checkPresentingIssues: true,
    },
  },
]

/**
 * Skill development rules configuration
 */
const SKILL_RULES: SkillRule[] = [
  {
    id: 'self-compassion',
    skillName: 'Positive Self-Talk and Self-Compassion Exercises',
    keywords: [
      'self-esteem',
      'self-worth',
      'worthless',
      'failure',
      'not good enough',
    ],
    conditions: {
      checkGoals: true,
      checkCoreBeliefs: true,
      beliefStrengthThreshold: 0.5,
    },
    exclusionKeywords: ['positive self-talk', 'self-compassion'],
  },
  {
    id: 'communication-skills',
    skillName: 'Assertiveness and Communication Skills',
    keywords: ['social anxiety', 'relationship difficulties'],
    conditions: {
      checkPresentingIssues: true,
    },
    exclusionKeywords: ['assertiveness', 'communication skills'],
  },
  {
    id: 'anxiety-coping',
    skillName: 'Grounding Techniques and Progressive Muscle Relaxation',
    keywords: ['anxiety', 'worry'],
    conditions: {
      checkPresentingIssues: true,
    },
    exclusionKeywords: [
      'grounding techniques',
      'progressive muscle relaxation',
    ],
  },
]

/**
 * Service for generating a treatment plan document based on a patient's profile.
 */
export class TreatmentPlanService {
  constructor() {
    appLogger.info('TreatmentPlanService initialized')
  }

  /**
   * Evaluates intervention rules against patient data
   */
  private evaluateInterventionRules(
    presentingIssues: string[],
    coreBeliefs: Array<{ belief: string; strength: number }>,
  ): string[] {
    const interventions: string[] = []

    for (const rule of INTERVENTION_RULES) {
      const { keywords, intervention, conditions } = rule
      let matched = false

      // Check core beliefs if specified
      if (conditions?.checkCoreBeliefs) {
        const threshold = conditions.beliefStrengthThreshold || 0.5
        matched = coreBeliefs.some(
          (belief) =>
            belief.strength > threshold &&
            keywords.some((keyword) =>
              belief.belief.toLowerCase().includes(keyword),
            ),
        )
      }

      // Check presenting issues if specified
      if (conditions?.checkPresentingIssues && !matched) {
        matched = presentingIssues.some((issue) =>
          keywords.some((keyword) => issue.toLowerCase().includes(keyword)),
        )
      }

      if (matched) {
        interventions.push(intervention)
        appLogger.debug(`Intervention rule '${rule.id}' matched`, {
          rule: rule.name,
        })
      }
    }

    return interventions
  }

  /**
   * Evaluates skill rules against patient data
   */
  private evaluateSkillRules(
    presentingIssues: string[],
    goalsForTherapy: string[],
    coreBeliefs: Array<{ belief: string; strength: number }>,
    existingSkills: string[],
  ): string[] {
    const skills: string[] = []

    for (const rule of SKILL_RULES) {
      const { keywords, skillName, conditions, exclusionKeywords } = rule
      let matched = false

      // Check if skill already exists (case-insensitive)
      const skillExists = existingSkills.some((skill) =>
        exclusionKeywords?.some((exclusion) =>
          skill.toLowerCase().includes(exclusion),
        ),
      )

      if (skillExists) {
        continue
      }

      // Check goals if specified
      if (conditions?.checkGoals) {
        matched = goalsForTherapy.some((goal) =>
          keywords.some((keyword) => goal.toLowerCase().includes(keyword)),
        )
      }

      // Check presenting issues if specified
      if (conditions?.checkPresentingIssues && !matched) {
        matched = presentingIssues.some((issue) =>
          keywords.some((keyword) => issue.toLowerCase().includes(keyword)),
        )
      }

      // Check core beliefs if specified
      if (conditions?.checkCoreBeliefs && !matched) {
        const threshold = conditions.beliefStrengthThreshold || 0.5
        matched = coreBeliefs.some(
          (belief) =>
            belief.strength > threshold &&
            keywords.some((keyword) =>
              belief.belief.toLowerCase().includes(keyword),
            ),
        )
      }

      if (matched) {
        skills.push(skillName)
        appLogger.debug(`Skill rule '${rule.id}' matched`, { skill: skillName })
      }
    }

    return skills
  }

  /**
   * Generates a treatment plan in Markdown format.
   * @param profile The patient's profile.
   * @returns A string containing the treatment plan in Markdown format.
   */
  public generateTreatmentPlan(profile: PatientProfile): string {
    if (!profile || !profile.cognitiveModel) {
      appLogger.warn(
        'generateTreatmentPlan: Invalid profile or cognitive model missing.',
        { profileId: profile?.id },
      )
      throw new Error('Invalid patient profile or cognitive model missing.')
    }

    const { cognitiveModel } = profile
    const {
      demographicInfo,
      presentingIssues,
      diagnosisInfo,
      coreBeliefs,
      goalsForTherapy,
      therapeuticProgress,
    } = cognitiveModel

    let plan = `# Treatment Plan for ${cognitiveModel.name || 'Patient ' + profile.id}\n\n`

    // Patient Information
    plan += `## Patient Information\n`
    plan += `- **ID:** ${profile.id}\n`
    if (cognitiveModel.name) {
      plan += `- **Name:** ${cognitiveModel.name}\n`
    }
    plan += `- **Age:** ${demographicInfo.age}\n`
    plan += `- **Gender:** ${demographicInfo.gender}\n`
    if (demographicInfo.occupation) {
      plan += `- **Occupation:** ${demographicInfo.occupation}\n\n`
    }

    // Presenting Issues
    if (presentingIssues && presentingIssues.length > 0) {
      plan += `## Presenting Issues\n`
      presentingIssues.forEach((issue) => {
        plan += `- ${issue}\n`
      })
      plan += `\n`
    }

    // Diagnosis
    plan += `## Diagnosis Information\n`
    plan += `- **Primary Diagnosis:** ${diagnosisInfo.primaryDiagnosis}\n`
    if (
      diagnosisInfo.secondaryDiagnoses &&
      diagnosisInfo.secondaryDiagnoses.length > 0
    ) {
      plan += `- **Secondary Diagnoses:** ${diagnosisInfo.secondaryDiagnoses.join(', ')}\n`
    }
    plan += `- **Severity:** ${diagnosisInfo.severity}\n`
    plan += `- **Duration of Symptoms:** ${diagnosisInfo.durationOfSymptoms}\n\n`

    // Core Beliefs to Address
    if (coreBeliefs && coreBeliefs.length > 0) {
      plan += `## Key Areas of Focus (Core Beliefs)\n`
      coreBeliefs
        .filter((b) => b.strength > 0.5) // Example: Focus on beliefs with strength > 0.5
        .forEach((belief) => {
          plan += `- **${belief.belief}** (Strength: ${belief.strength.toFixed(2)})\n`
        })
      plan += `\n`
    }

    // Therapeutic Goals
    if (goalsForTherapy && goalsForTherapy.length > 0) {
      plan += `## Therapeutic Goals\n`
      goalsForTherapy.forEach((goal) => {
        plan += `- ${goal}\n`
      })
      plan += `\n`
    }

    // Proposed Interventions - Using rule-based system
    plan += `## Proposed Interventions\n`
    plan += `- **Cognitive Behavioral Therapy (CBT):** Techniques such as cognitive restructuring, behavioral activation.\n`

    // Apply intervention rules
    const tailoredInterventions = this.evaluateInterventionRules(
      presentingIssues,
      coreBeliefs,
    )
    tailoredInterventions.forEach((intervention) => {
      plan += intervention
    })

    plan += `- **Psychoeducation:** Understanding symptoms, diagnosis, and treatment rationale.\n`
    plan += `- **Skill-Building:** Focusing on developing coping mechanisms and emotional regulation skills.\n\n`

    // Key Skills to Develop - Using rule-based system
    plan += `## Key Skills to Develop/Strengthen\n`
    const skillsToDevelop: string[] = []

    // Add existing skills from therapeutic progress
    if (therapeuticProgress?.skillsAcquired?.length > 0) {
      therapeuticProgress.skillsAcquired.forEach((skill: SkillAcquired) => {
        skillsToDevelop.push(
          `${skill.skillName} (Current Proficiency: ${(skill.proficiency * 100).toFixed(0)}%)`,
        )
      })
    }

    // Apply skill rules to suggest new skills
    const suggestedSkills = this.evaluateSkillRules(
      presentingIssues,
      goalsForTherapy,
      coreBeliefs,
      skillsToDevelop,
    )

    skillsToDevelop.push(...suggestedSkills)

    if (skillsToDevelop.length > 0) {
      skillsToDevelop.forEach((skill) => {
        plan += `- ${skill}\n`
      })
    } else {
      plan += `- General coping strategies and emotional regulation.\n`
    }
    plan += `\n`

    // Progress Monitoring
    plan += `## Progress Monitoring\n`
    plan += `- Regular review of therapeutic goals.\n`
    plan += `- Monitoring of symptom changes (e.g., using standardized scales or subjective reports).\n`
    plan += `- Tracking of belief strength modification and skill acquisition.\n`
    plan += `- Patient feedback on therapeutic alliance and session effectiveness.\n\n`

    plan += `## Plan Review\n`
    plan += `- This treatment plan is a dynamic document and will be reviewed and updated collaboratively with the patient on a regular basis (e.g., every 4-6 sessions or as needed).\n`

    appLogger.info(
      `generateTreatmentPlan: Treatment plan generated for profile ${profile.id}`,
    )
    return plan
  }
}
