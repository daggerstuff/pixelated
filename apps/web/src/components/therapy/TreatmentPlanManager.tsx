import { PlusCircle, Trash2 } from 'lucide-react'
import React, {
  useState,
  useEffect,
  useCallback,
  useId,
  useRef,
  FC,
  SyntheticEvent,
} from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button/index'
import { DialogModal } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import type {
  TreatmentPlan,
  NewTreatmentPlanData,
  UpdateTreatmentPlanData,
  TreatmentGoal,
  NewTreatmentGoalData,
  TreatmentObjective,
  NewTreatmentObjectiveData,
} from '@/types/treatment'

const formatDate = (dateString?: string | Date) => {
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

interface ClientSideNewObjective
  extends
    Required<Pick<NewTreatmentObjectiveData, 'description' | 'status'>>,
    Omit<NewTreatmentObjectiveData, 'description' | 'status'> {
  tempId: string
}

interface ClientSideNewGoal
  extends
    Required<Pick<NewTreatmentGoalData, 'description' | 'status'>>,
    Omit<NewTreatmentGoalData, 'description' | 'status'> {
  tempId: string
  objectives: ClientSideNewObjective[]
}

interface FormNewPlanData extends Omit<
  NewTreatmentPlanData,
  'goals' | 'startDate'
> {
  userId: string
  startDate?: string
  goals: ClientSideNewGoal[]
}

type EditableObjective = ClientSideNewObjective & {
  id?: string
  treatmentGoalId?: string
  interventions?: string[]
  targetDate?: string | null
  progressNotes?: string | null
  createdAt?: string
  updatedAt?: string
}

type EditableGoal = ClientSideNewGoal & {
  id?: string
  treatmentPlanId?: string
  targetDate?: string | null
  objectives: EditableObjective[]
  createdAt?: string
  updatedAt?: string
}

interface FormUpdatePlanData extends Omit<
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
const createEmptyNewPlanData = (): FormNewPlanData => ({
  title: '',
  clientId: '',
  userId: '',
  status: 'Draft',
  startDate: new Date().toISOString().split('T')[0],
  goals: [],
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getResponseErrorMessage = (payload: unknown, fallback: string) => {
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

const isTreatmentPlanList = (value: unknown): value is TreatmentPlan[] =>
  Array.isArray(value) && value.every(isTreatmentPlan)

const TreatmentPlanManager: FC = () => {
  const [plans, setPlans] = useState<TreatmentPlan[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tempIdRef = useRef(0)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newPlanData, setNewPlanData] = useState<FormNewPlanData>(
    createEmptyNewPlanData(),
  )

  const [planToDelete, setPlanToDelete] = useState<TreatmentPlan | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingPlanData, setEditingPlanData] =
    useState<FormUpdatePlanData | null>(null)
  const formId = useId()

  const fetchPlans = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/treatment-plans')
      if (!response.ok) {
        const errorData: unknown = await response.json()
        throw new Error(
          getResponseErrorMessage(errorData, 'Failed to fetch treatment plans'),
        )
      }
      const data: unknown = await response.json()
      if (!isTreatmentPlanList(data)) {
        throw new Error('Invalid treatment plan response')
      }
      setPlans(data)
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unknown error occurred'
      setError(errorMessage)
      toast.error(`Failed to load plans: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPlans()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchPlans])

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
    isEdit = false,
  ) => {
    const target = e.target
    const { name, value } = target
    if (isEdit) {
      setEditingPlanData((prev) => (prev ? { ...prev, [name]: value } : null))
    } else {
      setNewPlanData((prev) => ({ ...prev, [name]: value }))
    }
  }

  const handleSelectChange = (name: string, value: string, isEdit = false) => {
    if (isEdit) {
      setEditingPlanData((prev) => (prev ? { ...prev, [name]: value } : null))
    } else {
      setNewPlanData((prev) => ({ ...prev, [name]: value }))
    }
  }

  // --- Goal Management Functions ---
  const addGoal = (isEdit = false) => {
    const newGoal: ClientSideNewGoal = {
      description: '',
      status: 'Not Started',
      objectives: [],
      tempId: `goal-${++tempIdRef.current}`,
    }
    if (isEdit) {
      setEditingPlanData((prev) => {
        if (!prev) return null
        return { ...prev, goals: [...(prev.goals ?? []), newGoal] }
      })
    } else {
      setNewPlanData((prev) => ({
        ...prev,
        goals: [...prev.goals, newGoal],
      }))
    }
  }

  const handleGoalChange = (
    index: number,
    field: keyof ClientSideNewGoal | keyof EditableGoal,
    value: string,
    isEdit = false,
  ) => {
    if (isEdit) {
      setEditingPlanData((prev) => {
        if (!prev?.goals) return prev
        const updatedGoals = [...prev.goals]
        if (updatedGoals[index]) {
          updatedGoals[index] = { ...updatedGoals[index], [field]: value }
          return { ...prev, goals: updatedGoals }
        }
        return prev
      })
    } else {
      setNewPlanData((prev) => {
        const updatedGoals = [...prev.goals]
        if (updatedGoals[index]) {
          updatedGoals[index] = { ...updatedGoals[index], [field]: value }
          return { ...prev, goals: updatedGoals }
        }
        return prev
      })
    }
  }

  const removeGoal = (index: number, isEdit = false) => {
    if (isEdit) {
      setEditingPlanData((prev) => {
        if (!prev?.goals) return prev
        const updatedGoals = [...prev.goals]
        updatedGoals.splice(index, 1)
        return { ...prev, goals: updatedGoals }
      })
    } else {
      setNewPlanData((prev) => {
        const updatedGoals = [...prev.goals]
        updatedGoals.splice(index, 1)
        return { ...prev, goals: updatedGoals }
      })
    }
  }
  // --- End Goal Management ---

  // --- Objective Management Functions ---
  const addObjective = (goalIndex: number, isEdit = false) => {
    const baseObjective: ClientSideNewObjective = {
      description: '',
      status: 'Not Started',
      tempId: `obj-${++tempIdRef.current}`,
    }

    if (isEdit) {
      const newObjective: EditableObjective = {
        ...baseObjective,
      }
      setEditingPlanData((prev) => {
        if (!prev?.goals) return prev
        const updatedGoals = [...prev.goals]
        const goal = updatedGoals[goalIndex]
        if (goal) {
          const newObjectives: EditableObjective[] = [
            ...goal.objectives,
            newObjective,
          ]
          updatedGoals[goalIndex] = {
            ...goal,
            objectives: newObjectives,
          }
          return { ...prev, goals: updatedGoals }
        }
        return prev
      })
    } else {
      setNewPlanData((prev) => {
        const updatedGoals = [...prev.goals]
        if (updatedGoals[goalIndex]) {
          updatedGoals[goalIndex] = {
            ...updatedGoals[goalIndex],
            objectives: [...updatedGoals[goalIndex].objectives, baseObjective],
          }
          return { ...prev, goals: updatedGoals }
        }
        return prev
      })
    }
  }

  const handleObjectiveChange = (
    goalIndex: number,
    objIndex: number,
    field: keyof Pick<
      ClientSideNewObjective,
      | 'description'
      | 'interventions'
      | 'progressNotes'
      | 'status'
      | 'targetDate'
    >,
    value: string,
    isEdit = false,
  ) => {
    if (isEdit) {
      setEditingPlanData((prev) => {
        if (!prev?.goals) return prev
        const updatedGoals = [...prev.goals]
        const goal = updatedGoals[goalIndex]
        const objective = goal?.objectives[objIndex]
        if (goal && objective) {
          const updatedObjectives: EditableObjective[] = [...goal.objectives]
          updatedObjectives[objIndex] = {
            ...objective,
            [field]: value,
          }
          updatedGoals[goalIndex] = { ...goal, objectives: updatedObjectives }
          return { ...prev, goals: updatedGoals }
        }
        return prev
      })
    } else {
      setNewPlanData((prev) => {
        const updatedGoals = [...prev.goals]
        const goal = updatedGoals[goalIndex]
        if (goal) {
          const updatedObjectives: ClientSideNewObjective[] = [
            ...goal.objectives,
          ]
          const existingObjective = goal.objectives[objIndex]
          if (!existingObjective) {
            return prev
          }
          updatedObjectives[objIndex] = {
            ...existingObjective,
            [field]: value,
          }
          updatedGoals[goalIndex] = { ...goal, objectives: updatedObjectives }
          return { ...prev, goals: updatedGoals }
        }
        return prev
      })
    }
  }

  const removeObjective = (
    goalIndex: number,
    objIndex: number,
    isEdit = false,
  ) => {
    if (isEdit) {
      setEditingPlanData((prev) => {
        if (!prev?.goals) return prev
        const updatedGoals = [...prev.goals]
        const goal = updatedGoals[goalIndex]
        if (goal) {
          const updatedObjectives: EditableObjective[] = [...goal.objectives]
          updatedObjectives.splice(objIndex, 1)
          updatedGoals[goalIndex] = { ...goal, objectives: updatedObjectives }
          return { ...prev, goals: updatedGoals }
        }
        return prev
      })
    } else {
      setNewPlanData((prev) => {
        const updatedGoals = [...prev.goals]
        const goal = updatedGoals[goalIndex]
        const objective = goal?.objectives[objIndex]
        if (goal && objective) {
          const updatedObjectives: ClientSideNewObjective[] = [
            ...goal.objectives,
          ]
          updatedObjectives.splice(objIndex, 1)
          updatedGoals[goalIndex] = { ...goal, objectives: updatedObjectives }
          return { ...prev, goals: updatedGoals }
        }
        return prev
      })
    }
  }
  // --- End Objective Management ---

  const stripTempIds = (goals: (ClientSideNewGoal | EditableGoal)[]) => {
    return goals.map((g) => {
      const { tempId: _tempId, objectives, ...goalDetails } = g
      return {
        ...goalDetails,
        objectives: objectives.map(
          ({ tempId: _objectiveTempId, ...objDetails }) => {
            return objDetails
          },
        ),
      }
    })
  }

  const handleCreatePlan = async (e: SyntheticEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const payload = {
      ...newPlanData,
      goals: stripTempIds(newPlanData.goals),
    }
    try {
      const response = await fetch('/api/treatment-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const errorData: unknown = await response.json()
        throw new Error(
          getResponseErrorMessage(errorData, 'Failed to create treatment plan'),
        )
      }
      await fetchPlans()
      setIsCreateModalOpen(false)
      setNewPlanData(createEmptyNewPlanData())
      toast.success('Treatment plan created successfully!')
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unknown error occurred'
      toast.error(`Failed to create plan: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeletePlan = async () => {
    if (!planToDelete) {
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch(`/api/treatment-plans/${planToDelete.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const errorData: unknown = await response.json()
        throw new Error(
          getResponseErrorMessage(errorData, 'Failed to delete treatment plan'),
        )
      }
      await fetchPlans()
      setPlanToDelete(null)
      toast.success('Treatment plan deleted successfully!')
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unknown error occurred'
      toast.error(`Failed to delete plan: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdatePlan = async (e: SyntheticEvent) => {
    e.preventDefault()
    if (!editingPlanData?.id) {
      return
    }
    setIsLoading(true)

    const payload = {
      ...editingPlanData,
      goals: stripTempIds(editingPlanData.goals ?? []),
    }

    try {
      const { id, ...updateData } = payload
      if (updateData.startDate && typeof updateData.startDate === 'string') {
        updateData.startDate = new Date(updateData.startDate + 'T00:00:00')
          .toISOString()
          .split('T')[0]
      }

      const response = await fetch(`/api/treatment-plans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })
      if (!response.ok) {
        const errorData: unknown = await response.json()
        throw new Error(
          getResponseErrorMessage(errorData, 'Failed to update treatment plan'),
        )
      }
      await fetchPlans()
      setIsEditModalOpen(false)
      setEditingPlanData(null)
      toast.success('Treatment plan updated successfully!')
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unknown error occurred'
      toast.error(`Failed to update plan: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const openEditModal = (plan: TreatmentPlan) => {
    const goals: EditableGoal[] = plan.goals.map((g) => ({
      ...g,
      tempId: g.id,
      objectives: g.objectives.map((o) => ({ ...o, tempId: o.id })),
    }))
    const editablePlan: FormUpdatePlanData = {
      ...plan,
      id: plan.id,
      startDate: plan.startDate
        ? new Date(plan.startDate).toISOString().split('T')[0]
        : '',
      goals,
    }
    setEditingPlanData(editablePlan)
    setIsEditModalOpen(true)
  }

  const openCreateModal = () => {
    setNewPlanData(createEmptyNewPlanData())
    setIsCreateModalOpen(true)
  }

  if (isLoading && plans.length === 0) {
    return <p>Loading treatment plans...</p>
  }

  if (error) {
    return <p className="text-red-500">Error: {error}</p>
  }

  const renderObjectivesSection = (
    goalIndex: number,
    objectives: EditableObjective[],
    isEdit = false,
  ) => (
    <div className="border-slate-300 dark:border-slate-700 ml-4 mt-3 border-l pl-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-md text-slate-700 dark:text-slate-300 font-medium">
          Objectives
        </h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addObjective(goalIndex, isEdit)}
          className="h-auto px-2 py-1 text-xs"
        >
          <PlusCircle className="mr-1 h-3 w-3" /> Add Objective
        </Button>
      </div>
      {objectives.length === 0 && (
        <p className="text-muted-foreground text-xs">
          No objectives added for this goal.
        </p>
      )}
      {objectives.map((obj, objIndex) => (
        <div
          key={obj.tempId}
          className="bg-slate-100 dark:bg-slate-700/50 mb-2 rounded-md border p-2"
        >
          <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-6">
            <Textarea
              placeholder={`Objective ${objIndex + 1} description`}
              value={obj.description}
              onChange={(e) =>
                handleObjectiveChange(
                  goalIndex,
                  objIndex,
                  'description',
                  e.target.value,
                  isEdit,
                )
              }
              className="min-h-[40px] text-sm md:col-span-4"
              required
            />
            <Select
              value={obj.status}
              onValueChange={(value) =>
                handleObjectiveChange(
                  goalIndex,
                  objIndex,
                  'status',
                  value,
                  isEdit,
                )
              }
            >
              <SelectTrigger className="h-9 text-sm md:col-span-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Not Started">Not Started</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="On Hold">On Hold</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeObjective(goalIndex, objIndex, isEdit)}
              className="text-red-500 hover:text-red-700 h-9 w-9 place-self-center md:col-span-1 md:place-self-auto"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )

  const renderGoalsSection = (
    goals: (ClientSideNewGoal | EditableGoal)[],
    isEdit = false,
  ) => (
    <div className="mt-4 border-t pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-medium">Goals</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addGoal(isEdit)}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Add Goal
        </Button>
      </div>
      {goals.length === 0 && (
        <p className="text-muted-foreground text-sm">No goals added yet.</p>
      )}
      {goals.map((goal, index) => (
        <div
          key={goal.tempId}
          className="dark:bg-slate-800 mb-3 rounded-md border bg-background p-3 shadow-sm"
        >
          <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-6">
            <Textarea
              placeholder="Goal description"
              name={`goal-description-${index}`}
              value={goal.description}
              onChange={(e) =>
                handleGoalChange(index, 'description', e.target.value, isEdit)
              }
              className="min-h-[60px] md:col-span-4"
              required
            />
            <Select
              value={goal.status}
              onValueChange={(value) =>
                handleGoalChange(index, 'status', value, isEdit)
              }
            >
              <SelectTrigger className="md:col-span-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Not Started">Not Started</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="On Hold">On Hold</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeGoal(index, isEdit)}
              className="text-red-500 hover:text-red-700 place-self-center md:col-span-1 md:place-self-auto"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
          {renderObjectivesSection(index, goal.objectives, isEdit)}
        </div>
      ))}
    </div>
  )

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Treatment Plan Management</h1>
        <Button onClick={openCreateModal}>Create New Plan</Button>
      </div>

      {plans.length === 0 && !isLoading && (
        <p>No treatment plans found. Get started by creating a new one!</p>
      )}

      {plans.length > 0 && (
        <div className="rounded-md border">
          <table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Client ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>{plan.title}</TableCell>
                  <TableCell>{plan.clientId}</TableCell>
                  <TableCell>{plan.status}</TableCell>
                  <TableCell>{formatDate(plan.startDate)}</TableCell>
                  <TableCell>{formatDate(plan.updatedAt)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="mr-2">
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mr-2"
                      onClick={() => openEditModal(plan)}
                    >
                      Edit
                    </Button>

                    <AlertDialogTrigger>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setPlanToDelete(plan)}
                      >
                        <Trash2 className="mr-1 h-4 w-4 md:mr-2" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      )}
      <DialogModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Treatment Plan"
        showCloseButton={true}
        className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              form={`create-plan-form-${formId}`}
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Plan'}
            </Button>
          </>
        }
      >
        <form id={`create-plan-form-${formId}`} onSubmit={handleCreatePlan}>
          <p className="text-muted-foreground mb-4 text-sm">
            Fill in the details below to create a new treatment plan.
          </p>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label
                htmlFor={`title-${formId}`}
                className="col-span-1 text-right"
              >
                Title
              </label>
              <Input
                id={`title-${formId}`}
                name="title"
                value={newPlanData.title}
                onChange={(e) => handleInputChange(e)}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label
                htmlFor={`clientId-${formId}`}
                className="col-span-1 text-right"
              >
                Client ID
              </label>
              <Input
                id={`clientId-${formId}`}
                name="clientId"
                value={newPlanData.clientId ?? ''}
                onChange={(e) => handleInputChange(e)}
                className="col-span-3"
                placeholder="e.g., user_xyz123 or numerical ID"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label
                htmlFor={`status-${formId}`}
                className="col-span-1 text-right"
              >
                Status
              </label>
              <Select
                value={newPlanData.status}
                onValueChange={(value) => handleSelectChange('status', value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label
                htmlFor={`startDate-${formId}`}
                className="col-span-1 text-right"
              >
                Start Date
              </label>
              <Input
                id={`startDate-${formId}`}
                name="startDate"
                type="date"
                value={newPlanData.startDate}
                onChange={(e) => handleInputChange(e)}
                className="col-span-3"
                required
              />
            </div>
            {renderGoalsSection(newPlanData.goals, false)}
          </div>
        </form>
      </DialogModal>

      <AlertDialog
        open={!!planToDelete}
        onOpenChange={(isOpen) => !isOpen && setPlanToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              treatment plan titled &quot;<strong>{planToDelete?.title}</strong>
              &quot; and all its associated goals and objectives.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setPlanToDelete(null)}
              disabled={isLoading}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlan}
              disabled={isLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isLoading ? 'Deleting...' : 'Yes, delete plan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Plan Modal */}
      <DialogModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingPlanData(null)
        }}
        title="Edit Treatment Plan"
        showCloseButton={true}
        className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsEditModalOpen(false)
                setEditingPlanData(null)
              }}
            >
              Cancel
            </Button>
            <Button
              form={`edit-plan-form-${formId}`}
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      >
        {editingPlanData && (
          <form id={`edit-plan-form-${formId}`} onSubmit={handleUpdatePlan}>
            <p className="text-muted-foreground mb-4 text-sm">
              Update the details for &quot;{editingPlanData.title}&quot;.
            </p>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label
                  htmlFor={`edit-title-${formId}`}
                  className="col-span-1 text-right"
                >
                  Title
                </label>
                <Input
                  id={`edit-title-${formId}`}
                  name="title"
                  value={editingPlanData.title ?? ''}
                  onChange={(e) => handleInputChange(e, true)}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label
                  htmlFor={`edit-clientId-${formId}`}
                  className="col-span-1 text-right"
                >
                  Client ID
                </label>
                <Input
                  id={`edit-clientId-${formId}`}
                  name="clientId"
                  value={editingPlanData.clientId ?? ''}
                  onChange={(e) => handleInputChange(e, true)}
                  className="col-span-3"
                  placeholder="e.g., user_xyz123 or numerical ID"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label
                  htmlFor={`edit-status-${formId}`}
                  className="col-span-1 text-right"
                >
                  Status
                </label>
                <Select
                  value={editingPlanData.status}
                  onValueChange={(value) =>
                    handleSelectChange('status', value, true)
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label
                  htmlFor={`edit-startDate-${formId}`}
                  className="col-span-1 text-right"
                >
                  Start Date
                </label>
                <Input
                  id={`edit-startDate-${formId}`}
                  name="startDate"
                  type="date"
                  value={editingPlanData.startDate ?? ''}
                  onChange={(e) => handleInputChange(e, true)}
                  className="col-span-3"
                  required
                />
              </div>
              {renderGoalsSection(editingPlanData.goals ?? [], true)}
            </div>
          </form>
        )}
      </DialogModal>
    </div>
  )
}

export default TreatmentPlanManager
