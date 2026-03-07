import type { PatientProfile } from '../models/patient'
import type {
  CoreBelief,
  TherapeuticInsight,
  SkillAcquired,
} from '../types/CognitiveModel'
import { createBuildSafeLogger } from '../../logging/build-safe-logger' // Assuming a logger setup

const appLogger = createBuildSafeLogger('app')

/**
 * Service for managing and updating therapeutic progress for a patient.
 */
export class TherapeuticProgressService {
  constructor() {
    // Potential future dependencies: BeliefLinkingService, InsightGenerationRules, etc.
    appLogger.info('TherapeuticProgressService initialized')
  }

  private nextTimestamp(prevIso?: string): string {
    const now = Date.now()
    const prev = prevIso ? Date.parse(prevIso) : 0
    const ts = now <= prev ? prev + 1 : now
    return new Date(ts).toISOString()
  }

  /**
   * Adds a new insight to the patient's therapeutic progress.
   * @param profile The patient's profile.
   * @param insightText The textual description of the insight.
   * @param relatedBeliefId Optional ID or text of a core belief this insight relates to.
   *                        If an ID is provided, it's preferred. For now, storing as text.
   * @returns The updated PatientProfile.
   */
  public addInsight(
    profile: PatientProfile,
    insightText: string,
    relatedBeliefText?: string,
  ): PatientProfile {
    if (
      !profile ||
      !profile.cognitiveModel ||
      !profile.cognitiveModel.therapeuticProgress
    ) {
      appLogger.warn('addInsight: Invalid profile provided.', {
        profileId: profile?.id,
      })
      throw new Error('Invalid patient profile provided.')
    }
    if (!insightText || insightText.trim() === '') {
      appLogger.warn('addInsight: Insight text cannot be empty.', {
        profileId: profile?.id,
      })
      throw new Error('Insight text cannot be empty.')
    }

    const newInsight: TherapeuticInsight = {
      insight: insightText.trim(),
      belief: relatedBeliefText || 'General Insight', // Link to a belief text or mark as general
      dateAchieved: new Date().toISOString(),
    }

    const updatedProgress = {
      ...profile.cognitiveModel.therapeuticProgress,
      insights: [
        ...profile.cognitiveModel.therapeuticProgress.insights,
        newInsight,
      ],
    }

    appLogger.info(`addInsight: New insight added for profile ${profile.id}`, {
      insight: newInsight.insight,
    })

    return {
      ...profile,
      cognitiveModel: {
        ...profile.cognitiveModel,
        therapeuticProgress: updatedProgress,
      },
      lastUpdatedAt: this.nextTimestamp(profile.lastUpdatedAt),
    }
  }

  /**
   * Updates the strength of a specific core belief.
   * Strength is clamped between 0 and 1.
   * @param profile The patient's profile.
   * @param beliefText The exact text of the core belief to update.
   * @param changeFactor A number indicating how much to change the strength.
   *                     Positive to increase, negative to decrease.
   *                     E.g., 0.1 to increase strength, -0.1 to decrease.
   * @returns The updated PatientProfile.
   */
  public updateBeliefStrength(
    profile: PatientProfile,
    beliefText: string,
    changeFactor: number,
  ): PatientProfile {
    if (
      !profile ||
      !profile.cognitiveModel ||
      !profile.cognitiveModel.coreBeliefs
    ) {
      appLogger.warn(
        'updateBeliefStrength: Invalid profile or coreBeliefs missing.',
        { profileId: profile?.id },
      )
      throw new Error('Invalid patient profile or core beliefs missing.')
    }
    if (!beliefText || beliefText.trim() === '') {
      appLogger.warn('updateBeliefStrength: Belief text cannot be empty.', {
        profileId: profile.id,
      })
      throw new Error('Belief text cannot be empty.')
    }

    let beliefFound = false
    const updatedCoreBeliefs = profile.cognitiveModel.coreBeliefs.map(
      (belief: CoreBelief) => {
        if (belief.belief === beliefText) {
          beliefFound = true
          const newStrength = Math.max(
            0,
            Math.min(1, belief.strength + changeFactor),
          )
          appLogger.info(
            `updateBeliefStrength: Belief "${beliefText}" strength changed from ${belief.strength} to ${newStrength}`,
            { profileId: profile.id, changeFactor },
          )
          return { ...belief, strength: newStrength }
        }
        return belief
      },
    )

    if (!beliefFound) {
      appLogger.warn(
        `updateBeliefStrength: Belief "${beliefText}" not found for profile ${profile.id}.`,
      )
      // Optionally, throw an error or handle as a no-op. For now, returning profile unchanged.
      // For robustness, let's throw an error if the belief is not found,
      // as this indicates a potential logic error in the calling code.
      throw new Error(`Belief "${beliefText}" not found.`)
    }

    return {
      ...profile,
      cognitiveModel: {
        ...profile.cognitiveModel,
        coreBeliefs: updatedCoreBeliefs,
      },
      lastUpdatedAt: this.nextTimestamp(profile.lastUpdatedAt),
    }
  }

  /**
   * Adds a new skill to the patient's list of acquired skills or updates proficiency if it exists.
   * @param profile The patient's profile.
   * @param skillName The name of the skill.
   * @param initialProficiency The initial proficiency of the skill (0-1). Defaults to 0.1.
   * @param applicationContext Optional array of contexts where the skill applies.
   * @returns The updated PatientProfile.
   */
  public acquireSkill(
    profile: PatientProfile,
    skillName: string,
    initialProficiency: number = 0.1,
    applicationContext?: string[],
  ): PatientProfile {
    if (
      !profile ||
      !profile.cognitiveModel ||
      !profile.cognitiveModel.therapeuticProgress
    ) {
      appLogger.warn('acquireSkill: Invalid profile provided.', {
        profileId: profile?.id,
      })
      throw new Error('Invalid patient profile provided.')
    }
    if (!skillName || skillName.trim() === '') {
      appLogger.warn('acquireSkill: Skill name cannot be empty.', {
        profileId: profile.id,
      })
      throw new Error('Skill name cannot be empty.')
    }
    // Clamping is handled by Math.max/min below, so no error throw for out-of-bounds proficiency.
    // if (initialProficiency < 0 || initialProficiency > 1) {
    //   appLogger.warn('acquireSkill: Initial proficiency must be between 0 and 1.', { profileId: profile.id, skillName, initialProficiency });
    //   throw new Error('Initial proficiency must be between 0 and 1.');
    // }

    const progress = profile.cognitiveModel.therapeuticProgress
    // Ensure skillsAcquired array exists
    const skills = progress.skillsAcquired ? [...progress.skillsAcquired] : []

    const existingSkillIndex = skills.findIndex(
      (s) => s.skillName === skillName,
    )

    if (existingSkillIndex !== -1) {
      // Skill already exists, update proficiency and context if provided
      const existingSkill = skills[existingSkillIndex]!
      skills[existingSkillIndex] = {
        ...existingSkill,
        // We take the higher of existing or new initial proficiency if skill exists
        // Or let updateSkillProficiency handle finer-grained updates.
        // For acquireSkill, if it exists, we are essentially "re-acquiring" or noting it again.
        // Let's just update the date and use the new proficiency if higher, or simply log.
        // A dedicated updateSkillProficiency is better for incremental changes.
        // This method primarily adds if not present.
        // If it exists, let's just ensure date is updated and use new proficiency.
        proficiency: Math.max(0, Math.min(1, initialProficiency)), // Use the new proficiency directly
        dateAchieved: new Date().toISOString(),
        applicationContext:
          applicationContext || existingSkill.applicationContext || [],
      }
      appLogger.info(
        `acquireSkill: Skill "${skillName}" already existed, updated details.`,
        { profileId: profile.id },
      )
    } else {
      const newSkill: SkillAcquired = {
        skillName,
        proficiency: Math.max(0, Math.min(1, initialProficiency)),
        dateAchieved: new Date().toISOString(),
        applicationContext: applicationContext || [],
      }
      skills.push(newSkill)
      appLogger.info(
        `acquireSkill: New skill "${skillName}" acquired for profile ${profile.id}.`,
      )
    }

    const updatedProgress = { ...progress, skillsAcquired: skills }

    return {
      ...profile,
      cognitiveModel: {
        ...profile.cognitiveModel,
        therapeuticProgress: updatedProgress,
      },
      lastUpdatedAt: this.nextTimestamp(profile.lastUpdatedAt),
    }
  }

  /**
   * Updates the proficiency of an already acquired skill.
   * Proficiency is clamped between 0 and 1.
   * @param profile The patient's profile.
   * @param skillName The name of the skill to update.
   * @param newProficiency The new proficiency level (0-1).
   * @returns The updated PatientProfile.
   */
  public updateSkillProficiency(
    profile: PatientProfile,
    skillName: string,
    newProficiency: number,
  ): PatientProfile {
    if (
      !profile ||
      !profile.cognitiveModel ||
      !profile.cognitiveModel.therapeuticProgress ||
      !profile.cognitiveModel.therapeuticProgress.skillsAcquired
    ) {
      appLogger.warn(
        'updateSkillProficiency: Invalid profile or skillsAcquired missing.',
        { profileId: profile?.id },
      )
      throw new Error('Invalid patient profile or skills not initialized.')
    }
    // Clamping is handled by Math.max/min below, so no error throw for out-of-bounds proficiency.
    //  if (newProficiency < 0 || newProficiency > 1) {
    //   appLogger.warn('updateSkillProficiency: New proficiency must be between 0 and 1.', { profileId: profile.id, skillName, newProficiency });
    //   throw new Error('New proficiency must be between 0 and 1.');
    // }

    let skillFound = false
    const updatedSkills =
      profile.cognitiveModel.therapeuticProgress.skillsAcquired.map((skill) => {
        if (skill.skillName === skillName) {
          skillFound = true
          const clampedProficiency = Math.max(0, Math.min(1, newProficiency))
          appLogger.info(
            `updateSkillProficiency: Skill "${skillName}" proficiency changed from ${skill.proficiency} to ${clampedProficiency}`,
            { profileId: profile.id },
          )
          return {
            ...skill,
            proficiency: clampedProficiency,
            dateAchieved: new Date().toISOString(),
          } // Update date on proficiency change
        }
        return skill
      })

    if (!skillFound) {
      appLogger.warn(
        `updateSkillProficiency: Skill "${skillName}" not found for profile ${profile.id}. Cannot update proficiency.`,
      )
      throw new Error(
        `Skill "${skillName}" not found. Cannot update proficiency.`,
      )
    }

    const updatedProgress = {
      ...profile.cognitiveModel.therapeuticProgress,
      skillsAcquired: updatedSkills,
    }

    return {
      ...profile,
      cognitiveModel: {
        ...profile.cognitiveModel,
        therapeuticProgress: updatedProgress,
      },
      lastUpdatedAt: new Date().toISOString(),
    }
  }
}
