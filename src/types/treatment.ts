// src/types/treatment.ts

// Status enums (should match your DB enums)
export type TreatmentPlanStatus =
  | 'Draft'
  | 'Active'
  | 'Completed'
  | 'Discontinued'
  | 'Archived'
export type TreatmentGoalStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Achieved'
  | 'Partially Achieved'
  | 'Not Achieved'
export type TreatmentObjectiveStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Completed'
  | 'On Hold'
  | 'Cancelled'

// Treatment Objective
export interface TreatmentObjective {
  id: string
  treatmentGoalId: string
  description: string
  targetDate: string | null
  status: TreatmentObjectiveStatus
  interventions: string[]
  progressNotes: string | null
  createdAt: string
  updatedAt: string
}

// Treatment Goal
export interface TreatmentGoal {
  id: string
  treatmentPlanId: string
  description: string
  targetDate: string | null
  status: TreatmentGoalStatus
  createdAt: string
  updatedAt: string
  objectives: TreatmentObjective[]
}

// Treatment Plan
export interface TreatmentPlan {
  id: string
  clientId: string
  therapistId: string
  title: string
  diagnosis: string | null
  startDate: string
  endDate?: string | null
  status: TreatmentPlanStatus
  generalNotes?: string | null
  createdAt: string
  updatedAt: string
  goals: TreatmentGoal[]
}

export interface NewTreatmentObjectiveData {
  description: string
  targetDate?: string | null
  status?: TreatmentObjectiveStatus
  interventions?: string[]
  progressNotes?: string | null
}

// Treatment Goal
export interface NewTreatmentGoalData {
  description: string
  targetDate?: string | null
  status?: TreatmentGoalStatus
  objectives?: NewTreatmentObjectiveData[]
}

// Treatment Plan
export interface NewTreatmentPlanData {
  userId: string
  clientId?: string | null
  therapistId?: string | null
  title: string
  diagnosis?: string | null
  startDate: string
  endDate?: string | null
  status?: TreatmentPlanStatus
  generalNotes?: string | null
  goals?: NewTreatmentGoalData[]
}

export interface UpdateTreatmentPlanData extends Partial<NewTreatmentPlanData> {
  id: string
  goals?: (NewTreatmentGoalData | TreatmentGoal)[]
}
