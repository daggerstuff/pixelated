import {
  ScenarioDifficulty,
  TherapeuticDomain,
  TherapeuticTechnique,
} from '../types'
import type { Scenario } from '../types'

/**
 * Example predefined scenarios for the simulation
 * In a real implementation, these would come from an API
 */
const exampleScenarios: Scenario[] = [
  {
    id: 'anxiety-001',
    title: 'Anxiety Management Session',
    description:
      'Practice helping a patient with anxiety disorder develop coping strategies.',
    domain: TherapeuticDomain.ANXIETY,
    difficulty: ScenarioDifficulty.INTERMEDIATE,
    techniques: [
      TherapeuticTechnique.ACTIVE_LISTENING,
      TherapeuticTechnique.COGNITIVE_RESTRUCTURING,
      TherapeuticTechnique.VALIDATION,
    ],
    contextDescription:
      'The patient has been experiencing increasing anxiety over the past 6 months, affecting work and relationships.',
    clientBackground:
      'Alex, 32, software engineer with history of generalized anxiety disorder. Recently promoted at work with increased responsibilities.',
    presentingIssue:
      'Panic attacks, sleep disturbance, worry about job performance, social withdrawal',
    objectives: [
      'Develop coping strategies for anxiety',
      'Identify triggers for panic attacks',
      'Improve sleep hygiene',
    ],
  },
  {
    id: 'depression-001',
    title: 'Depression Initial Assessment',
    description:
      'Conduct an initial assessment for a patient experiencing symptoms of depression.',
    domain: TherapeuticDomain.DEPRESSION,
    difficulty: ScenarioDifficulty.BEGINNER,
    techniques: [
      TherapeuticTechnique.ACTIVE_LISTENING,
      TherapeuticTechnique.OPEN_ENDED_QUESTIONS,
      TherapeuticTechnique.VALIDATION,
    ],
    contextDescription:
      'First session with a patient who was referred by their primary care physician due to symptoms of depression.',
    clientBackground:
      'Jamie, 45, recently divorced, working in finance, reporting low mood and loss of interest for several months.',
    presentingIssue:
      'Persistent low mood, loss of interest, sleep disruption, decreased appetite, difficulty concentrating at work',
    objectives: [
      'Complete initial assessment',
      'Build therapeutic alliance',
      'Develop preliminary treatment plan',
    ],
  },
  {
    id: 'trauma-001',
    title: 'Trauma-Informed Care Session',
    description:
      'Practice a trauma-informed approach with a patient who has experienced a recent traumatic event.',
    domain: TherapeuticDomain.TRAUMA,
    difficulty: ScenarioDifficulty.ADVANCED,
    techniques: [
      TherapeuticTechnique.VALIDATION,
      TherapeuticTechnique.ACTIVE_LISTENING,
      TherapeuticTechnique.GROUNDING_TECHNIQUES,
    ],
    contextDescription:
      'Third session with a patient who recently experienced a car accident resulting in physical injuries and psychological distress.',
    clientBackground:
      'Taylor, 29, teacher, involved in a serious car accident 2 months ago, developing symptoms of acute stress disorder.',
    presentingIssue:
      'Flashbacks, hypervigilance, sleep disturbance, avoidance behaviors, physical tension',
    objectives: [
      'Provide emotional support and validation',
      'Teach grounding techniques',
      'Address avoidance behaviors',
    ],
  },
  {
    id: 'family-001',
    title: 'Family Conflict Resolution',
    description:
      'Help family members improve communication and resolve ongoing conflicts.',
    domain: TherapeuticDomain.RELATIONSHIP,
    difficulty: ScenarioDifficulty.ADVANCED,
    techniques: [
      TherapeuticTechnique.OPEN_ENDED_QUESTIONS,
      TherapeuticTechnique.REFLECTIVE_STATEMENTS,
      TherapeuticTechnique.VALIDATION,
    ],
    contextDescription:
      'Second session with a family experiencing communication breakdowns and frequent conflicts.',
    clientBackground:
      'The Johnson family: parents (mid-40s) and two teenagers (15, 17), reporting increased conflict and communication difficulties after the eldest child started college preparation.',
    presentingIssue:
      'Communication breakdowns, frequent arguments, power struggles between parents and teenagers, parental disagreements about discipline',
    objectives: [
      'Improve family communication patterns',
      'Identify underlying needs in conflicts',
      'Develop shared problem-solving strategies',
    ],
  },
  {
    id: 'addiction-001',
    title: 'Substance Use Motivational Interview',
    description:
      'Practice motivational interviewing techniques with a patient experiencing substance use issues.',
    domain: TherapeuticDomain.SUBSTANCE_USE,
    difficulty: ScenarioDifficulty.INTERMEDIATE,
    techniques: [
      TherapeuticTechnique.MOTIVATIONAL_INTERVIEWING,
      TherapeuticTechnique.REFLECTIVE_STATEMENTS,
      TherapeuticTechnique.OPEN_ENDED_QUESTIONS,
    ],
    contextDescription:
      'Second session with a patient who has been referred for alcohol use concerns but is ambivalent about making changes.',
    clientBackground:
      'Morgan, 38, marketing executive, drinking has increased over the past year to "manage stress," spouse concerned about impact on relationship.',
    presentingIssue:
      'Increased alcohol consumption, work stress, relationship difficulties, sleep issues, ambivalence about change',
    objectives: [
      'Explore ambivalence about changing alcohol use',
      'Identify discrepancies between values and behaviors',
      'Support autonomous decision-making',
    ],
  },
]

/**
 * Get all available scenarios
 */
export const getScenarios = async (): Promise<Scenario[]> => {
  // In a real implementation, this would fetch scenarios from an API
  // For now, we'll return the example scenarios with a simulated delay
  await new Promise((resolve) => setTimeout(resolve, 500))
  return exampleScenarios
}

/**
 * Get a specific scenario by ID
 */
export const getScenarioById = async (id: string): Promise<Scenario | null> => {
  // In a real implementation, this would fetch a specific scenario from an API
  // For now, we'll find it in our example scenarios
  await new Promise((resolve) => setTimeout(resolve, 300))
  return exampleScenarios.find((scenario) => scenario.id === id) || null
}

/**
 * Filter scenarios by domain and difficulty
 */
export const filterScenarios = async (
  domain?: TherapeuticDomain,
  difficulty?: ScenarioDifficulty,
): Promise<Scenario[]> => {
  // In a real implementation, this would use API filters
  // For now, we'll filter the examples
  await new Promise((resolve) => setTimeout(resolve, 400))

  return exampleScenarios.filter((scenario) => {
    if (domain && scenario.domain !== domain) {
      return false
    }
    if (difficulty && scenario.difficulty !== difficulty) {
      return false
    }
    return true
  })
}

/**
 * Get recommended next scenario based on user performance
 */
export const getRecommendedScenario = async (
  completedScenarioIds: string[],
  performanceLevel: 'beginner' | 'intermediate' | 'advanced',
): Promise<Scenario | null> => {
  // In a real implementation, this would use a recommendation algorithm
  // For now, we'll just pick a scenario the user hasn't completed yet

  await new Promise((resolve) => setTimeout(resolve, 600))

  // Find scenarios not yet completed
  const availableScenarios = exampleScenarios.filter(
    (scenario) => !completedScenarioIds.includes(scenario.id),
  )

  if (availableScenarios.length === 0) {
    return null
  }

  // Convert string performance level to enum
  const difficultyMap = {
    beginner: ScenarioDifficulty.BEGINNER,
    intermediate: ScenarioDifficulty.INTERMEDIATE,
    advanced: ScenarioDifficulty.ADVANCED,
  } as const

  const targetDifficulty = difficultyMap[performanceLevel]

  // Find scenarios at the appropriate difficulty level
  const matchingDifficulty = availableScenarios.filter(
    (scenario) => scenario.difficulty === targetDifficulty,
  )

  // Return a matching difficulty scenario if available, otherwise any available scenario
  return matchingDifficulty.length > 0
    ? matchingDifficulty[Math.floor(Math.random() * matchingDifficulty.length)]
    : availableScenarios[Math.floor(Math.random() * availableScenarios.length)]
}

// Example PHI audit logging - uncomment and customize as needed
// logger.info('Accessing PHI data', {
//   userId: 'user-id-here',
//   action: 'read',
//   dataType: 'patient-record',
//   recordId: 'record-id-here'
// });
