export enum GoalCategory {
  SYMPTOM_REDUCTION = 'symptom_reduction',
  BEHAVIORAL_CHANGE = 'behavioral_change',
  EMOTIONAL_REGULATION = 'emotional_regulation',
  RELATIONSHIP_IMPROVEMENT = 'relationship_improvement',
  COPING_SKILLS = 'coping_skills',
  TRAUMA_RECOVERY = 'trauma_recovery',
  LIFESTYLE_CHANGES = 'lifestyle_changes',
  COGNITIVE_RESTRUCTURING = 'cognitive_restructuring',
}

export enum GoalStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface Checkpoint {
  id: string
  description: string
  isCompleted: boolean
  completedAt?: number
  notes?: string
}

export interface ProgressSnapshot {
  timestamp: number
  progressPercent: number
  notes: string
}

export interface TherapeuticGoal {
  id: string
  title: string
  description: string
  category: GoalCategory
  status: GoalStatus
  targetDate?: number | undefined
  progress: number
  checkpoints: Checkpoint[]
  progressHistory: ProgressSnapshot[]
  relatedInterventions: string[]
  relevantDistortions?: string[] | undefined
  notes?: string | undefined
  createdAt: number
  updatedAt: number
}
