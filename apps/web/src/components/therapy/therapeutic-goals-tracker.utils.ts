/**
 * Helper functions for TherapeuticGoalsTracker.
 * Extracted from TherapeuticGoalsTracker.tsx.
 */

import type { CognitiveModel } from '@/lib/ai/types/CognitiveModel'
import { GoalStatus, GoalCategory } from '@/lib/ai/types/TherapeuticGoals'
import type { TherapeuticGoal } from '@/lib/ai/types/TherapeuticGoals'

// Helper function to generate goals from patient model
export function generateGoalsFromPatientModel(
  patientModel: Partial<CognitiveModel> | undefined,
): TherapeuticGoal[] {
  const goals: TherapeuticGoal[] = []
  const now = Date.now()
  const sixMonthsFromNow = now + 15768000000 // 6 months in milliseconds

  const presentingIssues = patientModel?.presentingIssues ?? []
  const goalsForTherapy = patientModel?.goalsForTherapy ?? []
  const distortionPatterns = patientModel?.distortionPatterns ?? []
  const sessionProgressLog =
    patientModel?.therapeuticProgress?.sessionProgressLog ?? []

  // Generate goals based on presenting issues
  presentingIssues.forEach((issue, index) => {
    if (index < 3) {
      // Limit to 3 goals from presenting issues
      goals.push({
        id: `goal-issue-${index}`,
        title: `Address ${issue}`,
        description: `Work on developing skills and insights to better manage ${issue.toLowerCase()}.`,
        category: issueToCategory(issue),
        status: GoalStatus.IN_PROGRESS,
        createdAt: now - index * 604800000, // Stagger creation dates by a week
        updatedAt: now,
        targetDate: sixMonthsFromNow,
        progress: 20 + Math.random() * 40, // Random progress between 20-60%
        checkpoints: generateCheckpoints(issue, 4, now),
        progressHistory: generateProgressHistory(now, 3),
        relatedInterventions: generateInterventionTypes(issue),
        relevantDistortions: distortionPatterns.slice(0, 2).map((d) => d.type),
        notes:
          index === 0
            ? `Patient shows good understanding of how ${issue.toLowerCase()} impacts daily life. Working on practical coping strategies.`
            : undefined,
      })
    }
  })

  // Generate goals based on therapy goals
  goalsForTherapy.forEach((goal, index) => {
    if (index < 2) {
      // Limit to 2 goals from therapy goals
      goals.push({
        id: `goal-therapy-${index}`,
        title: goal,
        description: `Focus on achieving the patient's stated goal to ${goal.toLowerCase()}.`,
        category: goalToCategory(goal),
        status: index === 0 ? GoalStatus.IN_PROGRESS : GoalStatus.NOT_STARTED,
        createdAt: now - index * 604800000,
        updatedAt: now,
        targetDate: sixMonthsFromNow,
        progress: index === 0 ? 35 : 0,
        checkpoints: generateCheckpoints(goal, 3, now),
        progressHistory: index === 0 ? generateProgressHistory(now, 2) : [],
        relatedInterventions: generateInterventionTypes(goal),
        notes:
          index === 0
            ? `This goal aligns with the patient's strongest motivation for therapy.`
            : undefined,
      })
    }
  })

  // Add a completed goal if there are enough sessions
  if (sessionProgressLog.length > 5) {
    goals.push({
      id: `goal-completed-1`,
      title: 'Develop Emotion Recognition Skills',
      description:
        'Learn to identify and name emotions accurately as they arise.',
      category: GoalCategory.EMOTIONAL_REGULATION,
      status: GoalStatus.COMPLETED,
      createdAt: now - 7776000000, // 90 days ago
      updatedAt: now - 604800000, // 1 week ago
      targetDate: now - 1209600000, // 2 weeks ago
      progress: 100,
      checkpoints: [
        {
          id: 'cp-1',
          description: 'Keep daily emotion log',
          isCompleted: true,
          completedAt: now - 5184000000,
        },
        {
          id: 'cp-2',
          description:
            'Identify physical sensations associated with key emotions',
          isCompleted: true,
          completedAt: now - 3456000000,
        },
        {
          id: 'cp-3',
          description: 'Practice mindful emotion labeling',
          isCompleted: true,
          completedAt: now - 1728000000,
        },
        {
          id: 'cp-4',
          description: 'Share emotions in therapy without judgment',
          isCompleted: true,
          completedAt: now - 604800000,
        },
      ],

      progressHistory: [
        {
          timestamp: now - 6048000000,
          progressPercent: 25,
          notes: 'Started daily emotion log',
        },
        {
          timestamp: now - 4320000000,
          progressPercent: 50,
          notes: 'Making good progress with emotion recognition',
        },
        {
          timestamp: now - 2592000000,
          progressPercent: 75,
          notes: 'Significant improvement in emotion vocabulary',
        },
        {
          timestamp: now - 604800000,
          progressPercent: 100,
          notes: 'Goal successfully completed',
        },
      ],

      relatedInterventions: [
        'Emotion Naming Exercise',
        'Mindfulness Training',
        'Emotion Regulation Skills',
      ],

      notes:
        'Patient has made excellent progress and can now reliably identify and name emotions as they arise.',
    })
  }

  return goals
}

// Helper function to map issues to categories
function issueToCategory(issue: string): GoalCategory {
  const lowerIssue = issue.toLowerCase()
  if (
    lowerIssue.includes('anxiet') ||
    lowerIssue.includes('depress') ||
    lowerIssue.includes('mood') ||
    lowerIssue.includes('emotion')
  ) {
    return GoalCategory.EMOTIONAL_REGULATION
  } else if (
    lowerIssue.includes('thought') ||
    lowerIssue.includes('belief') ||
    lowerIssue.includes('think')
  ) {
    return GoalCategory.COGNITIVE_RESTRUCTURING
  } else if (
    lowerIssue.includes('relation') ||
    lowerIssue.includes('social') ||
    lowerIssue.includes('communicat')
  ) {
    return GoalCategory.RELATIONSHIP_IMPROVEMENT
  } else if (
    lowerIssue.includes('behavior') ||
    lowerIssue.includes('habit') ||
    lowerIssue.includes('action')
  ) {
    return GoalCategory.BEHAVIORAL_CHANGE
  } else if (
    lowerIssue.includes('physic') ||
    lowerIssue.includes('health') ||
    lowerIssue.includes('sleep')
  ) {
    return GoalCategory.LIFESTYLE_CHANGES
  } else if (lowerIssue.includes('coping') || lowerIssue.includes('skills')) {
    return GoalCategory.COPING_SKILLS
  } else if (lowerIssue.includes('trauma')) {
    return GoalCategory.TRAUMA_RECOVERY
  } else if (lowerIssue.includes('symptom')) {
    return GoalCategory.SYMPTOM_REDUCTION
  } else {
    // Default to emotional regulation if we can't determine
    return GoalCategory.EMOTIONAL_REGULATION
  }
}

// Helper function to map therapy goals to categories
function goalToCategory(goal: string): GoalCategory {
  return issueToCategory(goal) // Reuse the same logic for now
}

// Helper function to generate checkpoints
function generateCheckpoints(
  topic: string,
  count: number,
  now: number,
): Array<{
  id: string
  description: string
  isCompleted: boolean
  completedAt?: number
  notes?: string
}> {
  const checkpoints: Array<{
    id: string
    description: string
    isCompleted: boolean
    completedAt?: number
    notes?: string
  }> = []
  const lowerTopic = topic.toLowerCase()

  // Common checkpoints based on therapy frameworks
  let possibleCheckpoints = [
    `Identify triggers related to ${lowerTopic}`,
    `Track patterns of ${lowerTopic} for one week`,
    `Learn 3 techniques to manage ${lowerTopic}`,
    `Practice cognitive reframing for ${lowerTopic}`,
    `Develop awareness of early warning signs`,
    `Implement one coping strategy each day`,
    `Share experiences with ${lowerTopic} in session`,
    `Create a self-care plan addressing ${lowerTopic}`,
    `Reduce avoidance behaviors related to ${lowerTopic}`,
    `Practice mindfulness when experiencing ${lowerTopic}`,
  ]

  // Random selection of count checkpoints
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * possibleCheckpoints.length)
    const description = possibleCheckpoints[randomIndex] ?? ''
    possibleCheckpoints = possibleCheckpoints.filter(
      (_, index) => index !== randomIndex,
    )

    const isCompleted = i === 0 // Make only the first checkpoint completed

    checkpoints.push({
      id: `cp-${i + 1}`,
      description,
      isCompleted,
      ...(isCompleted ? { completedAt: now - 604800000 } : {}), // Completed 1 week ago if completed
      ...(isCompleted ? { notes: 'Good progress on this checkpoint' } : {}),
    })
  }

  return checkpoints
}

// Helper function to generate progress history
function generateProgressHistory(
  now: number,
  count: number,
): Array<{
  timestamp: number
  progressPercent: number
  notes: string
}> {
  const history: Array<{
    timestamp: number
    progressPercent: number
    notes: string
  }> = []

  for (let i = 0; i < count; i++) {
    const weeksAgo = count - i
    history.push({
      timestamp: now - weeksAgo * 604800000,
      progressPercent: 10 + i * 15, // Progressively increase
      notes:
        i === 0
          ? 'Initial baseline assessment'
          : `Continued progress on goal implementation, session ${i}`,
    })
  }

  return history
}

// Helper function to generate intervention types
function generateInterventionTypes(_topic: string): string[] {
  // Common therapy interventions
  const commonInterventions = [
    'Cognitive Restructuring',
    'Mindfulness Exercise',
    'Behavioral Activation',
    'Exposure Therapy',
    'Problem-Solving Therapy',
    'Interpersonal Skills Training',
    'Emotion Regulation Skills',
    'Dialectical Behavior Skills',
    'Acceptance Techniques',
    'Motivational Interviewing',
  ]

  // Pick 2-3 random interventions
  const count = 2 + Math.floor(Math.random() * 2)
  const interventions: string[] = []

  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * commonInterventions.length)
    const intervention = commonInterventions[randomIndex]
    if (intervention) {
      interventions.push(intervention)
    }
    commonInterventions.splice(randomIndex, 1) // Ensure unique interventions
  }

  return interventions
}

