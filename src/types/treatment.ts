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
  treatment_goal_id: string
  description: string
  target_date: string | null
  status: TreatmentObjectiveStatus
  interventions: string[]
  progress_notes: string | null
  created_at: string
  updated_at: string
}

// Treatment Goal
export interface TreatmentGoal {
  id: string
  treatment_plan_id: string
  description: string
  target_date: string | null
  status: TreatmentGoalStatus
  created_at: string
  updated_at: string
  objectives: TreatmentObjective[]
}

// Treatment Plan
export interface TreatmentPlan {
  id: string
  client_id: string
  therapist_id: string
  title: string
  diagnosis: string | null
  start_date: string
  end_date?: string | null
  status: TreatmentPlanStatus
  general_notes?: string | null
  created_at: string
  updated_at: string
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
