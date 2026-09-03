import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  SyntheticEvent,
} from 'react'

import { Button } from '@/components/ui/button/index'
import { Card } from '@/components/ui/card/index'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input/index'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea/index'
import type { TherapySession } from '@/lib/ai/interfaces/therapy'
import type { CognitiveModel } from '@/lib/ai/types/CognitiveModel'
import { GoalStatus, GoalCategory } from '@/lib/ai/types/TherapeuticGoals'
import { generateGoalsFromPatientModel } from './therapeutic-goals-tracker.utils'
import type { TherapeuticGoal } from '@/lib/ai/types/TherapeuticGoals'

// ⚡ Bolt: Cache Object.values for enums to avoid repeated creation during renders
const GOAL_CATEGORIES = Object.values(GoalCategory)
const GOAL_STATUSES = Object.values(GoalStatus)

// ⚡ Bolt: Extract static mapping to module scope to avoid O(N) switch statement evaluations during render
const CATEGORY_LABELS: Record<GoalCategory, string> = {
  [GoalCategory.EMOTIONAL_REGULATION]: 'Emotional Regulation',
  [GoalCategory.COGNITIVE_RESTRUCTURING]: 'Cognitive Restructuring',
  [GoalCategory.BEHAVIORAL_CHANGE]: 'Behavioral Change',
  [GoalCategory.SYMPTOM_REDUCTION]: 'Symptom Reduction',
  [GoalCategory.RELATIONSHIP_IMPROVEMENT]: 'Relationship Improvement',
  [GoalCategory.COPING_SKILLS]: 'Coping Skills',
  [GoalCategory.TRAUMA_RECOVERY]: 'Trauma Recovery',
  [GoalCategory.LIFESTYLE_CHANGES]: 'Lifestyle Changes',
}

interface TherapeuticGoalsTrackerProps {
  patientModel: CognitiveModel
  currentSession: TherapySession
  therapistInterventions: Array<{
    type: string
    timestamp: Date
    outcome: string
  }>
}

export function TherapeuticGoalsTracker({
  patientModel,
  therapistInterventions,
}: TherapeuticGoalsTrackerProps) {
  const [goals, setGoals] = useState<TherapeuticGoal[]>([])
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<GoalCategory | 'all'>('all')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<boolean>(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editGoal, setEditGoal] = useState<TherapeuticGoal | null>(null)
  const [form, setForm] = useState<Partial<TherapeuticGoal>>({})

  // Fetch goals from API
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/goals')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch goals')
        }
        return res.json()
      })
      .then((data: TherapeuticGoal[]) => {
        if (data && data.length > 0) {
          setGoals(data)
          if (!activeGoalId) {
            const firstGoal = data[0]
            if (firstGoal) {
              setActiveGoalId(firstGoal.id)
            }
          }
        } else {
          // If no goals from API, generate initial ones
          const initialGoals = generateGoalsFromPatientModel(patientModel)
          setGoals(initialGoals)
          if (initialGoals.length > 0 && !activeGoalId) {
            const firstGoal = initialGoals[0]
            if (firstGoal) {
              setActiveGoalId(firstGoal.id)
            }
          }
        }
      })
      .catch((err) => {
        setError((err as Error)?.message || String(err))
        // Optionally, load generated goals on API error as well
        const fallbackGoals = generateGoalsFromPatientModel(patientModel)
        setGoals(fallbackGoals)
        if (fallbackGoals.length > 0 && !activeGoalId) {
          const firstGoal = fallbackGoals[0]
          if (firstGoal) {
            setActiveGoalId(firstGoal.id)
          }
        }
      })
      .finally(() => setLoading(false))
  }, [patientModel, activeGoalId])

  // ⚡ Bolt: Memoize filtered goals to prevent unnecessary recalculations on re-renders
  const filteredGoals = useMemo(
    () =>
      activeTab === 'all'
        ? goals
        : goals.filter((goal) => goal.category === activeTab),
    [activeTab, goals],
  )

  // ⚡ Bolt: Memoize active goal to prevent unnecessary recalculations on re-renders
  const activeGoal = useMemo(
    () =>
      activeGoalId ? goals.find((goal) => goal.id === activeGoalId) : null,
    [activeGoalId, goals],
  )

  // Calculate overall progress
  const overallProgress =
    goals.length > 0
      ? goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length
      : 0

  // Get interventions related to a specific goal
  // ⚡ Bolt: Precompute goal → relatedInterventions map to avoid repeated linear scans
  const goalInterventionsMap = useMemo(() => {
    const map = new Map<string, string[]>()

    goals.forEach((goal) => {
      if (goal.relatedInterventions && goal.relatedInterventions.length > 0) {
        map.set(goal.id, goal.relatedInterventions)
      }
    })

    return map
  }, [goals])

  // ⚡ Bolt: Precompute the top related therapist interventions for each goal once per render
  const relatedInterventionsByGoalId = useMemo(() => {
    const map = new Map<string, typeof therapistInterventions>()

    goalInterventionsMap.forEach((relatedInterventionTypes, goalId) => {
      const matches: typeof therapistInterventions = []
      for (const intervention of therapistInterventions) {
        if (relatedInterventionTypes.includes(intervention.type)) {
          matches.push(intervention)
          if (matches.length === 3) break
        }
      }
      map.set(goalId, matches)
    })

    return map
  }, [therapistInterventions, goalInterventionsMap])

  // ⚡ Bolt: Keep the helper stable while avoiding repeated filtering work
  const getRelatedInterventions = useCallback(
    (goalId: string) => relatedInterventionsByGoalId.get(goalId) ?? [],
    [relatedInterventionsByGoalId],
  )

  // ⚡ Bolt: Pre-compute formatted date strings for checkpoints to avoid O(N) Date creations during render
  const formattedCheckpoints = useMemo(() => {
    if (!activeGoal) return []
    return activeGoal.checkpoints.map((cp) => ({
      ...cp,
      formattedCompletedAt:
        cp.completedAt != null
          ? new Date(cp.completedAt).toLocaleDateString()
          : '',
    }))
  }, [activeGoal])

  // ⚡ Bolt: Pre-compute formatted date strings for progress history to avoid O(N) Date creations during render
  const formattedProgressHistory = useMemo(() => {
    if (!activeGoal) return []
    return activeGoal.progressHistory.slice(-3).map((snapshot) => ({
      ...snapshot,
      formattedTimestamp: new Date(snapshot.timestamp).toLocaleDateString(),
    }))
  }, [activeGoal])

  // Handle category tab click
  // ⚡ Bolt: Memoize category selection handler to prevent unnecessary re-renders
  const handleCategoryClick = useCallback(
    (category: GoalCategory | 'all') => {
      setActiveTab(category)
    },
    [setActiveTab],
  )

  // Create a new goal
  async function createGoal(
    goal: Omit<TherapeuticGoal, 'id' | 'createdAt' | 'updatedAt'>,
  ) {
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goal),
      })
      if (!res.ok) {
        throw new Error('Failed to create goal')
      }
      const newGoal = await res.json()
      setGoals((prev) => [...prev, newGoal])
      setActiveGoalId(newGoal.id)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setActionError(err?.message || String(err))
      } else {
        setActionError('An unknown error occurred')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Update an existing goal
  async function updateGoal(goal: TherapeuticGoal) {
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goal),
      })
      if (!res.ok) {
        throw new Error('Failed to update goal')
      }
      const updatedGoal = await res.json()
      setGoals((prev) =>
        prev.map((g) => (g.id === updatedGoal.id ? updatedGoal : g)),
      )
    } catch (err: unknown) {
      if (err instanceof Error) {
        setActionError(err?.message || String(err))
      } else {
        setActionError('An unknown error occurred')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Delete a goal
  async function deleteGoal(goalId: string) {
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/goals/${goalId}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        throw new Error('Failed to delete goal')
      }
      setGoals((prev) => prev.filter((g) => g.id !== goalId))
      if (activeGoalId === goalId) {
        setActiveGoalId(null)
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setActionError(err?.message || String(err))
      } else {
        setActionError('An unknown error occurred')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Open modal for new or edit
  function openModal(goal?: TherapeuticGoal) {
    setEditGoal(goal ?? null)
    setForm(
      goal
        ? { ...goal }
        : {
            title: '',
            description: '',
            category: GoalCategory.EMOTIONAL_REGULATION,
            status: GoalStatus.NOT_STARTED,
            progress: 0,
            checkpoints: [],
            progressHistory: [],
            relatedInterventions: [],
          },
    )
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditGoal(null)
    setForm({})
  }

  // ⚡ Bolt: Memoize form change handler to prevent unnecessary re-renders of input fields
  const handleFormChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const { name, value } = e.target
      setForm((prev) => ({ ...prev, [name]: value }))
    },
    [],
  )

  // Handle form submit
  async function handleFormSubmit(e: SyntheticEvent) {
    e.preventDefault()
    if (editGoal) {
      await updateGoal({ ...editGoal, ...form })
    } else {
      await createGoal(
        form as Omit<TherapeuticGoal, 'id' | 'createdAt' | 'updatedAt'>,
      )
    }
    closeModal()
  }

  return (
    <div className="therapeutic-goals-tracker bg-white rounded-lg p-4 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Therapeutic Goals Tracker</h3>
        <div className="text-gray-600 text-sm">
          Session #
          {patientModel?.therapeuticProgress?.sessionProgressLog?.length
            ? (patientModel.therapeuticProgress.sessionProgressLog.length ??
                0) + 1
            : 1}
        </div>
      </div>

      {/* Overall progress */}
      <Card className="mb-4 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-medium">Overall Treatment Progress</h4>
          <span className="text-sm font-medium">
            {Math.round(overallProgress)}%
          </span>
        </div>
        <Progress
          value={overallProgress}
          max={100}
          variant={
            overallProgress > 70
              ? 'success'
              : overallProgress > 40
                ? 'primary'
                : 'warning'
          }
          size="md"
        />

        <div className="text-gray-500 mt-2 text-xs">
          <span
            className={`font-medium ${overallProgress >= 50 ? 'text-green-600' : 'text-amber-600'}`}
          >
            {overallProgress >= 75
              ? 'Excellent progress'
              : overallProgress >= 50
                ? 'Good progress'
                : overallProgress >= 25
                  ? 'Making progress'
                  : 'Getting started'}
          </span>
        </div>
      </Card>

      {/* Category filter */}
      <div className="mb-4 flex gap-1 overflow-x-auto pb-2" role="tablist">
        <Button
          size="sm"
          role="tab"
          aria-selected={activeTab === 'all'}
          variant={activeTab === 'all' ? 'default' : 'outline'}
          onClick={() => handleCategoryClick('all')}
          className="whitespace-nowrap text-xs"
        >
          All
        </Button>
        {GOAL_CATEGORIES.map((category) => (
          <Button
            key={category}
            size="sm"
            role="tab"
            aria-selected={activeTab === category}
            variant={activeTab === category ? 'default' : 'outline'}
            onClick={() => handleCategoryClick(category)}
            className="whitespace-nowrap text-xs"
          >
            {CATEGORY_LABELS[category] || category}
          </Button>
        ))}
      </div>

      {/* Action bar */}
      <div className="mb-4 flex justify-end">
        <Button onClick={() => openModal()} disabled={actionLoading}>
          + Add Goal
        </Button>
      </div>

      {/* Error and loading states */}
      {(error ?? actionError) && (
        <div className="text-red-600 mb-2">{error ?? actionError}</div>
      )}
      {(loading || actionLoading) && (
        <div className="text-gray-500 mb-2">Loading...</div>
      )}

      {/* Modal for add/edit goal */}
      {showModal && (
        <Dialog
          open={showModal}
          onOpenChange={(open) => {
            if (!open) closeModal()
          }}
        >
          <DialogContent>
            {/* Review suggestion: Move DialogTitle outside the form for better semantics */}
            <DialogHeader>
              <DialogTitle>{editGoal ? 'Edit Goal' : 'Add Goal'}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <Input
                name="title"
                value={form.title ?? ''}
                onChange={handleFormChange}
                placeholder="Goal Title"
                required
                maxLength={128}
              />

              <Textarea
                name="description"
                value={form.description ?? ''}
                onChange={handleFormChange}
                placeholder="Description"
                maxLength={1024}
              />

              <select
                name="category"
                value={form.category ?? GoalCategory.EMOTIONAL_REGULATION}
                onChange={handleFormChange}
                className="w-full rounded border p-2"
              >
                {GOAL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat] || cat}
                  </option>
                ))}
              </select>
              <select
                name="status"
                value={form.status ?? GoalStatus.NOT_STARTED}
                onChange={handleFormChange}
                className="w-full rounded border p-2"
              >
                {GOAL_STATUSES.map((stat) => (
                  <option key={stat} value={stat}>
                    {stat.replace('_', ' ')}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={actionLoading} className="w-full">
                {editGoal ? 'Update Goal' : 'Create Goal'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Goals list */}
      {filteredGoals.length === 0 ? (
        <div className="text-gray-500 py-8 text-center">
          No goals found for this category
        </div>
      ) : (
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          {filteredGoals.map((goal) => (
            <Card
              key={goal.id}
              className={`cursor-pointer p-4 transition-all duration-200 hover:shadow-md ${
                activeGoalId === goal.id ? 'ring-primary ring-2' : ''
              }`}
              onClick={() => setActiveGoalId(goal.id)}
            >
              <div className="mb-2 flex items-start justify-between">
                <h4 className="font-medium">{goal.title}</h4>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    goal.status === GoalStatus.COMPLETED
                      ? 'bg-green-100 text-green-800'
                      : goal.status === GoalStatus.IN_PROGRESS
                        ? 'bg-blue-100 text-blue-800'
                        : goal.status === GoalStatus.ON_HOLD
                          ? 'bg-yellow-100 text-yellow-800'
                          : goal.status === GoalStatus.CANCELLED
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {goal.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-gray-600 mb-2 line-clamp-2 text-sm">
                {goal.description}
              </p>
              <div className="mb-1 flex items-center">
                <Progress
                  value={goal.progress}
                  max={100}
                  variant={
                    goal.progress > 70
                      ? 'success'
                      : goal.progress > 30
                        ? 'primary'
                        : 'default'
                  }
                  size="sm"
                  className="mr-2 flex-1"
                />

                <span className="text-xs font-medium">{goal.progress}%</span>
              </div>
              <div className="text-gray-500 mt-1 text-xs">
                {goal.checkpoints.filter((cp) => cp.isCompleted).length} /{' '}
                {goal.checkpoints.length} checkpoints completed
              </div>
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    openModal(goal)
                  }}
                  disabled={actionLoading}
                  className="mr-2"
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm('Delete this goal?'))
                      void deleteGoal(goal.id)
                  }}
                  disabled={actionLoading}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Goal details */}
      {activeGoal && (
        <Card className="p-4">
          <h4 className="mb-2 font-semibold">{activeGoal.title}</h4>
          <p className="text-gray-700 mb-4 text-sm">{activeGoal.description}</p>

          <h5 className="mb-2 text-sm font-medium">Progress Checkpoints</h5>
          <div className="mb-4 space-y-3">
            {formattedCheckpoints.map((checkpoint) => (
              <div
                key={`checkpoint-${checkpoint.id}`}
                className="flex items-start"
              >
                <div
                  className={`mr-3 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${
                    checkpoint.isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                >
                  {checkpoint.isCompleted && (
                    <svg
                      className="text-white h-3 w-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-sm ${checkpoint.isCompleted ? 'text-gray-800' : 'text-gray-600'}`}
                  >
                    {checkpoint.description}
                  </p>
                  {checkpoint.isCompleted && checkpoint.completedAt && (
                    <p className="text-gray-500 mt-0.5 text-xs">
                      Completed on {checkpoint.formattedCompletedAt}
                    </p>
                  )}
                  {checkpoint.notes && (
                    <p className="text-gray-500 mt-0.5 text-xs italic">
                      {checkpoint.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Progress history */}
          {activeGoal.progressHistory.length > 0 && (
            <>
              <h5 className="mb-2 text-sm font-medium">Progress History</h5>
              <div className="mb-4 space-y-2">
                {formattedProgressHistory.map((snapshot) => (
                  <div
                    key={`progress-${snapshot.timestamp}-${snapshot.progressPercent}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-600">
                      {snapshot.formattedTimestamp}
                    </span>
                    <div className="flex items-center">
                      <div className="bg-gray-200 mr-2 h-1.5 w-16 rounded-full">
                        <div
                          className="bg-blue-500 h-full rounded-full"
                          style={{ width: `${snapshot.progressPercent}%` }}
                        />
                      </div>
                      <span className="text-xs">
                        {snapshot.progressPercent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Related interventions */}
          {activeGoal && (
            <>
              <h5 className="mb-2 text-sm font-medium">Recent Interventions</h5>
              <div className="space-y-2">
                {getRelatedInterventions(activeGoal.id).length > 0 ? (
                  getRelatedInterventions(activeGoal.id).map((intervention) => (
                    <div
                      key={`intervention-${intervention.type}-${intervention.timestamp.toISOString()}`}
                      className="text-sm"
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">{intervention.type}</span>
                        <span className="text-gray-500 text-xs">
                          {intervention.timestamp.toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-600 text-xs">
                        {intervention.outcome}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm italic">
                    No recent interventions for this goal
                  </p>
                )}
              </div>
            </>
          )}

          {/* Notes */}
          {activeGoal.notes ? (
            <>
              <h5 className="mb-2 mt-4 text-sm font-medium">Notes</h5>
              <p className="text-gray-700 text-sm">{activeGoal.notes}</p>
            </>
          ) : null}
        </Card>
      )}
    </div>
  )
}

