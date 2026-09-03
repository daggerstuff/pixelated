/**
 * Treatment plan manager helpers and types.
 * Extracted from TreatmentPlanManager.tsx.
 */

import type {
  TreatmentPlan,
  NewTreatmentPlanData,
  UpdateTreatmentPlanData,
  TreatmentGoal,
  NewTreatmentGoalData,
  TreatmentObjective,
  NewTreatmentObjectiveData,
} from '@/types/treatment'

export const formatDate = (dateString?: string | Date) => {
  if (!dateString) {
    return 'N/A'
  }
  try {
    if (
      typeof dateString === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ) {
      return new Date(dateString + 'T00:00:00').toLocaleDateString()
    }
    return new Date(dateString).toLocaleDateString()
  } catch {
    return String(dateString)
  }
}

export interface ClientSideNewObjective
  extends
    Required<Pick<NewTreatmentObjectiveData, 'description' | 'status'>>,
    Omit<NewTreatmentObjectiveData, 'description' | 'status'> {
  tempId: string
}

export interface ClientSideNewGoal
  extends
    Required<Pick<NewTreatmentGoalData, 'description' | 'status'>>,
    Omit<NewTreatmentGoalData, 'description' | 'status'> {
  tempId: string
  objectives: ClientSideNewObjective[]
}

export interface FormNewPlanData extends Omit<
  NewTreatmentPlanData,
  'goals' | 'startDate'
> {
  userId: string
  startDate?: string
  goals: ClientSideNewGoal[]
}

export type EditableObjective = ClientSideNewObjective & {
  id?: string
  treatmentGoalId?: string
  interventions?: string[]
  targetDate?: string | null
  progressNotes?: string | null
  createdAt?: string
  updatedAt?: string
}

export type EditableGoal = ClientSideNewGoal & {
  id?: string
  treatmentPlanId?: string
  targetDate?: string | null
  objectives: EditableObjective[]
  createdAt?: string
  updatedAt?: string
}

export interface FormUpdatePlanData extends Omit<
  UpdateTreatmentPlanData,
  'goals' | 'startDate'
> {
  id: string
  startDate?: string
  goals?: EditableGoal[]
}

/**
 * Factory to create a fresh new plan data object.
 * Fixes stale startDate issue by computing it at call time. (Review suggestion)
 */
export const createEmptyNewPlanData = (): FormNewPlanData => ({
  title: '',
  clientId: '',
  userId: '',
  status: 'Draft',
  startDate: new Date().toISOString().split('T')[0],
  goals: [],
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const getResponseErrorMessage = (payload: unknown, fallback: string) => {
  if (!isRecord(payload)) {
    return fallback
  }

  const error = payload['error']
  return typeof error === 'string' && error.length > 0 ? error : fallback
}

const isTreatmentObjective = (value: unknown): value is TreatmentObjective => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value['id'] === 'string' &&
    typeof value['treatmentGoalId'] === 'string' &&
    typeof value['description'] === 'string' &&
    Array.isArray(value['interventions'])
  )
}

const isTreatmentGoal = (value: unknown): value is TreatmentGoal => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value['id'] === 'string' &&
    typeof value['treatmentPlanId'] === 'string' &&
    typeof value['description'] === 'string' &&
    Array.isArray(value['objectives']) &&
    value['objectives'].every(isTreatmentObjective)
  )
}

const isTreatmentPlan = (value: unknown): value is TreatmentPlan => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value['id'] === 'string' &&
    typeof value['clientId'] === 'string' &&
    typeof value['title'] === 'string' &&
    typeof value['status'] === 'string' &&
    Array.isArray(value['goals']) &&
    value['goals'].every(isTreatmentGoal)
  )
}

export const isTreatmentPlanList = (value: unknown): value is TreatmentPlan[] =>
  Array.isArray(value) && value.every(isTreatmentPlan)
