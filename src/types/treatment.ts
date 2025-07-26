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
  goalId: string
  userId: string
  description: string
  targetDate?: string | null
  status: TreatmentObjectiveStatus
  interventions: string[]
  progressNotes?: string | null
  createdAt: string
  updatedAt: string
}

export interface NewTreatmentObjectiveData {
  description: string
  targetDate?: string | null
  status?: TreatmentObjectiveStatus
  interventions?: string[]
  progressNotes?: string | null
}

// Treatment Goal
export interface TreatmentGoal {
  id: string
  planId: string
  userId: string
  description: string
  targetDate?: string | null
  status: TreatmentGoalStatus
  objectives: TreatmentObjective[]
  createdAt: string
  updatedAt: string
}

export interface NewTreatmentGoalData {
  description: string
  targetDate?: string | null
  status?: TreatmentGoalStatus
  objectives?: NewTreatmentObjectiveData[]
}

// Treatment Plan
export interface TreatmentPlan {
  id: string
  userId: string
  clientId?: string | null
  therapistId?: string | null
  title: string
  diagnosis?: string | null
  startDate: string
  endDate?: string | null
  status: TreatmentPlanStatus
  generalNotes?: string | null
  goals: TreatmentGoal[]
  createdAt: string
  updatedAt: string
}

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
