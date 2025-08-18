import React, { useState, useEffect, useCallback, useId } from 'react'
import type {
  TreatmentPlan,
  NewTreatmentPlanData,
  UpdateTreatmentPlanData,
  TreatmentGoal,
  NewTreatmentGoalData,
  TreatmentObjective,
  NewTreatmentObjectiveData,
} from '@/types/treatment'
import { FC, Button } from '@/components/ui/button'
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FC, DialogModal } from '@/components/ui/dialog'
import { FC, Input } from '@/components/ui/input'
import { FC, Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { FC, toast } from 'sonner'
import { FC, PlusCircle, Trash2 } from 'lucide-react'

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

interface ClientSideNewObjective extends Required<Pick<NewTreatmentObjectiveData, 'description' | 'status'>>, 
  Omit<NewTreatmentObjectiveData, 'description' | 'status'> {
  tempId: string
}

interface ClientSideNewGoal extends Required<Pick<NewTreatmentGoalData, 'description' | 'status'>>, 
  Omit<NewTreatmentGoalData, 'description' | 'status'> {
  tempId: string
  objectives: ClientSideNewObjective[]
}

interface FormNewPlanData extends Omit<NewTreatmentPlanData, 'goals' | 'startDate'> {
  userId: string
  startDate?: string
  goals: ClientSideNewGoal[]
}

type EditableObjective =
  | (TreatmentObjective & { tempId?: undefined })
  | ClientSideNewObjective

type EditableGoal =
  | (Omit<TreatmentGoal, 'objectives' | 'id'> & {
      id?: string
      objectives: EditableObjective[]
      tempId?: string
    })
  | ClientSideNewGoal

interface FormUpdatePlanData
  extends Omit<UpdateTreatmentPlanData, 'goals' | 'startDate'> {
  id: string
  startDate?: string
  goals?: EditableGoal[]
}

const initialNewPlanData: FormNewPlanData = {
  title: '',
  clientId: '',
  userId: '',
  status: 'Draft',
  startDate: new Date().toISOString().split('T')[0],
  goals: [],
}

const TreatmentPlanManager: FC = () => {
  const [plans, setPlans] = useState<TreatmentPlan[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newPlanData, setNewPlanData] = useState<FormNewPlanData>(
    JSON.parse(JSON.stringify(initialNewPlanData) as any),
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
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch treatment plans')
      }
      const data: TreatmentPlan[] = await response.json()
      setPlans(data)
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? (err as Error)?.message || String(err) : 'An unknown error occurred'
      setError(errorMessage)
      toast.error(`Failed to load plans: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
    isEdit = false,
  ) => {
    const target = e.target as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
    const { name, value } = target
    if (isEdit && editingPlanData) {
      setEditingPlanData((prev: FormUpdatePlanData | null) =>
        prev ? { ...prev, [name]: value } : null,
      )
    } else {
      setNewPlanData((prev: FormNewPlanData) => ({ ...prev, [name]: value }))
    }
  }

  const handleSelectChange = (name: string, value: string, isEdit = false) => {
    if (isEdit && editingPlanData) {
      setEditingPlanData((prev: FormUpdatePlanData | null) =>
        prev ? { ...prev, [name]: value } : null,
      )
    } else {
      setNewPlanData((prev: FormNewPlanData) => ({ ...prev, [name]: value }))
    }
  }

  // --- Goal Management Functions ---
  const addGoal = (isEdit = false) => {
    const newGoal: ClientSideNewGoal = {
      description: '',
      status: 'Not Started',
      objectives: [],
      tempId: `goal-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    }
    if (isEdit && editingPlanData) {
      setEditingPlanData((prev: FormUpdatePlanData | null) => {
        if (!prev) {
          return null
        }
        const currentGoals = prev.goals || []
        return { ...prev, goals: [...currentGoals, newGoal] }
      })
    } else {
      setNewPlanData((prev: FormNewPlanData) => ({
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
    if (isEdit && editingPlanData) {
      const updatedGoals = [...(editingPlanData.goals || [])]
      if (updatedGoals[index]) {
        ;(updatedGoals[index] as EditableGoal)[field as keyof EditableGoal] = value as never // Type-safe cast for EditableGoal union
        setEditingPlanData((prev: FormUpdatePlanData | null) =>
          prev ? { ...prev, goals: updatedGoals } : null,
        )
      }
    } else {
      const updatedGoals = [...newPlanData.goals]
      if (updatedGoals[index]) {
        ;(updatedGoals[index] as ClientSideNewGoal)[field as keyof ClientSideNewGoal] = value as never // ClientSideNewGoal is more straightforward
        setNewPlanData((prev: FormNewPlanData) => ({
          ...prev,
          goals: updatedGoals,
        }))
      }
    }
  }

  const removeGoal = (index: number, isEdit = false) => {
    if (isEdit && editingPlanData) {
      const updatedGoals = [...(editingPlanData.goals || [])]
      updatedGoals.splice(index, 1)
      setEditingPlanData((prev: FormUpdatePlanData | null) =>
        prev ? { ...prev, goals: updatedGoals } : null,
      )
    } else {
      const updatedGoals = [...newPlanData.goals]
      updatedGoals.splice(index, 1)
      setNewPlanData((prev: FormNewPlanData) => ({
        ...prev,
        goals: updatedGoals,
      }))
    }
  }
  // --- End Goal Management ---

  // --- Objective Management Functions ---
  const addObjective = (goalIndex: number, isEdit = false) => {
    const newObjective: ClientSideNewObjective = {
      description: '',
      status: 'Not Started',
      tempId: `obj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    }

    if (isEdit && editingPlanData) {
      const updatedGoals = JSON.parse(
        JSON.stringify(editingPlanData.goals || []),
      ) as EditableGoal[]
      if (updatedGoals[goalIndex]) {
        updatedGoals[goalIndex].objectives = [
          ...(updatedGoals[goalIndex].objectives || []),
          newObjective,
        ]
        setEditingPlanData((prev: FormUpdatePlanData | null) =>
          prev ? { ...prev, goals: updatedGoals } : null,
        )
      }
    } else {
      const updatedGoals = JSON.parse(
        JSON.stringify(newPlanData.goals),
      ) as ClientSideNewGoal[]
      if (updatedGoals[goalIndex]) {
        updatedGoals[goalIndex].objectives = [
          ...updatedGoals[goalIndex].objectives,
          newObjective,
        ]
        setNewPlanData((prev: FormNewPlanData) => ({
          ...prev,
          goals: updatedGoals,
        }))
      }
    }
  }

  const handleObjectiveChange = (
    goalIndex: number,
    objIndex: number,
    field: keyof ClientSideNewObjective | keyof EditableObjective,
    value: string,
    isEdit = false,
  ) => {
    if (isEdit && editingPlanData) {
      const updatedGoals = JSON.parse(
        JSON.stringify(editingPlanData.goals || []),
      ) as EditableGoal[]
      if (
        updatedGoals[goalIndex] &&
        updatedGoals[goalIndex].objectives[objIndex]
      ) {
        ;(updatedGoals[goalIndex].objectives[objIndex] as EditableObjective)[field as keyof EditableObjective] = value as never
        setEditingPlanData((prev: FormUpdatePlanData | null) =>
          prev ? { ...prev, goals: updatedGoals } : null,
        )
      }
    } else {
      const updatedNewGoals = JSON.parse(
        JSON.stringify(newPlanData.goals),
      ) as ClientSideNewGoal[]
      if (
        updatedNewGoals[goalIndex] &&
        updatedNewGoals[goalIndex].objectives[objIndex]
      ) {
        ;(updatedNewGoals[goalIndex].objectives[objIndex] as ClientSideNewObjective)[field as keyof ClientSideNewObjective] = value as never
        setNewPlanData((prev: FormNewPlanData) => ({
          ...prev,
          goals: updatedNewGoals,
        }))
      }
    }
  }

  const removeObjective = (
    goalIndex: number,
    objIndex: number,
    isEdit = false,
  ) => {
    if (isEdit && editingPlanData) {
      const updatedGoals = JSON.parse(
        JSON.stringify(editingPlanData.goals || []),
      ) as EditableGoal[]
      if (updatedGoals[goalIndex] && updatedGoals[goalIndex].objectives) {
        updatedGoals[goalIndex].objectives.splice(objIndex, 1)
        setEditingPlanData((prev: FormUpdatePlanData | null) =>
          prev ? { ...prev, goals: updatedGoals } : null,
        )
      }
    } else {
      const updatedNewGoals = JSON.parse(
        JSON.stringify(newPlanData.goals),
      ) as ClientSideNewGoal[]
      if (updatedNewGoals[goalIndex] && updatedNewGoals[goalIndex].objectives) {
        updatedNewGoals[goalIndex].objectives.splice(objIndex, 1)
        setNewPlanData((prev: FormNewPlanData) => ({
          ...prev,
          goals: updatedNewGoals,
        }))
      }
    }
  }
  // --- End Objective Management ---

  const stripTempIds = (goals: (ClientSideNewGoal | EditableGoal)[]) => {
    return goals.map((g) => {
      // tempId might exist on g if it's ClientSideNewGoal or a newly added EditableGoal
      const { objectives, ...goalDetails } = g as (
        | ClientSideNewGoal
        | EditableGoal
      ) & { tempId?: string }
      return {
        ...goalDetails,
        objectives: (objectives || []).map(
          (obj: ClientSideNewObjective | EditableObjective) => {
            // tempId might exist on obj if it's ClientSideNewObjective or a newly added EditableObjective
            const { ...objDetails } = obj as (
              | ClientSideNewObjective
              | EditableObjective
            ) & { tempId?: string }
            return objDetails
          },
        ),
      }
    })
  }

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    const payload = {
      ...newPlanData,
      goals: stripTempIds(newPlanData.goals || []), // Ensure goals is an array
    }
    try {
      const response = await fetch('/api/treatment-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create treatment plan')
      }
      await fetchPlans()
      setIsCreateModalOpen(false)
      setNewPlanData(JSON.parse(JSON.stringify(initialNewPlanData) as any))
      toast.success('Treatment plan created successfully!')
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? (err as Error)?.message || String(err) : 'An unknown error occurred'
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
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete treatment plan')
      }
      await fetchPlans() // Refresh list
      setPlanToDelete(null) // Close dialog
      toast.success('Treatment plan deleted successfully!')
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? (err as Error)?.message || String(err) : 'An unknown error occurred'
      toast.error(`Failed to delete plan: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPlanData || !editingPlanData.id) {
      return
    }
    setIsLoading(true)

    const payload = {
      ...editingPlanData,
      goals: stripTempIds(editingPlanData.goals || []), // Ensure goals is an array
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
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update treatment plan')
      }
      await fetchPlans()
      setIsEditModalOpen(false)
      setEditingPlanData(null)
      toast.success('Treatment plan updated successfully!')
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? (err as Error)?.message || String(err) : 'An unknown error occurred'
      toast.error(`Failed to update plan: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const openEditModal = (plan: TreatmentPlan) => {
    setEditingPlanData({
      ...plan,
      id: plan.id, // ensure id is explicitly passed
      startDate: plan.startDate
        ? new Date(plan.startDate).toISOString().split('T')[0]
        : '',
      goals: plan.goals
        ? JSON.parse(
            JSON.stringify(
              plan.goals.map((g) => ({ ...g, objectives: g.objectives || [] })),
            ),
          )
        : [], // Deep copy goals, ensure objectives is array
    } as FormUpdatePlanData) // Cast to ensure type compatibility
    setIsEditModalOpen(true)
  }

  const openCreateModal = () => {
    setNewPlanData(JSON.parse(JSON.stringify(initialNewPlanData) as any)) // Reset with deep copy
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
    <div className="mt-3 ml-4 pl-4 border-l border-slate-300 dark:border-slate-700">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-md font-medium text-slate-700 dark:text-slate-300">
          Objectives
        </h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addObjective(goalIndex, isEdit)}
          className="py-1 px-2 h-auto text-xs"
        >
          <PlusCircle className="h-3 w-3 mr-1" /> Add Objective
        </Button>
      </div>
      {objectives.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No objectives added for this goal.
        </p>
      )}
      {objectives.map((obj, objIndex) => (
        <div
          key={
            obj.tempId || (obj as TreatmentObjective).id || `obj-${objIndex}`
          }
          className="p-2 mb-2 border rounded-md bg-slate-100 dark:bg-slate-700/50"
        >
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
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
              className="md:col-span-4 min-h-[40px] text-sm"
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
              <SelectTrigger className="md:col-span-1 h-9 text-sm">
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
              className="text-red-500 hover:text-red-700 md:col-span-1 place-self-center md:place-self-auto h-9 w-9"
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
    <div className="mt-4 pt-4 border-t">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">Goals</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addGoal(isEdit)}
        >
          <PlusCircle className="h-4 w-4 mr-2" /> Add Goal
        </Button>
      </div>
      {goals.length === 0 && (
        <p className="text-sm text-muted-foreground">No goals added yet.</p>
      )}
      {goals.map((goal, index) => (
        <div
          key={goal.tempId || (goal as TreatmentGoal).id || `goal-${index}`}
          className="p-3 mb-3 border rounded-md bg-background dark:bg-slate-800 shadow-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
            <Textarea
              placeholder="Goal description"
              name={`goal-description-${index}`}
              value={goal.description}
              onChange={(e) =>
                handleGoalChange(index, 'description', e.target.value, isEdit)
              }
              className="md:col-span-4 min-h-[60px]"
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
              className="text-red-500 hover:text-red-700 md:col-span-1 place-self-center md:place-self-auto"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
          {renderObjectivesSection(index, goal.objectives || [], isEdit)}
        </div>
      ))}
    </div>
  )

  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
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
                        <Trash2 className="h-4 w-4 mr-1 md:mr-2" /> Delete
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
        className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
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
          <p className="text-sm text-muted-foreground mb-4">
            Fill in the details below to create a new treatment plan.
          </p>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label
                htmlFor={`title-${formId}`}
                className="text-right col-span-1"
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
                className="text-right col-span-1"
              >
                Client ID
              </label>
              <Input
                id={`clientId-${formId}`}
                name="clientId"
                value={newPlanData.clientId || ''}
                onChange={(e) => handleInputChange(e)}
                className="col-span-3"
                placeholder="e.g., user_xyz123 or numerical ID"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label
                htmlFor={`status-${formId}`}
                className="text-right col-span-1"
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
                className="text-right col-span-1"
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
              treatment plan titled &quot;<strong>{planToDelete?.title}</strong>&quot; and
              all its associated goals and objectives.
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
        className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
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
            <p className="text-sm text-muted-foreground mb-4">
              Update the details for &quot;{editingPlanData.title}&quot;.
            </p>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label
                  htmlFor={`edit-title-${formId}`}
                  className="text-right col-span-1"
                >
                  Title
                </label>
                <Input
                  id={`edit-title-${formId}`}
                  name="title"
                  value={editingPlanData.title || ''}
                  onChange={(e) => handleInputChange(e, true)}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label
                  htmlFor={`edit-clientId-${formId}`}
                  className="text-right col-span-1"
                >
                  Client ID
                </label>
                <Input
                  id={`edit-clientId-${formId}`}
                  name="clientId"
                  value={editingPlanData.clientId || ''}
                  onChange={(e) => handleInputChange(e, true)}
                  className="col-span-3"
                  placeholder="e.g., user_xyz123 or numerical ID"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label
                  htmlFor={`edit-status-${formId}`}
                  className="text-right col-span-1"
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
                  className="text-right col-span-1"
                >
                  Start Date
                </label>
                <Input
                  id={`edit-startDate-${formId}`}
                  name="startDate"
                  type="date"
                  value={
                    editingPlanData.startDate
                      ? editingPlanData.startDate.toString().split('T')[0]
                      : ''
                  }
                  onChange={(e) => handleInputChange(e, true)}
                  className="col-span-3"
                  required
                />
              </div>
              {renderGoalsSection(editingPlanData.goals || [], true)}
            </div>
          </form>
        )}
      </DialogModal>
    </div>
  )
}

export default TreatmentPlanManager
