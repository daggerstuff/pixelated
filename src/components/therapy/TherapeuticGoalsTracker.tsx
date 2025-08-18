import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { GoalStatus, GoalCategory } from '@/lib/ai/types/TherapeuticGoals'
import type { TherapeuticGoal } from '@/lib/ai/types/TherapeuticGoals'
import type { CognitiveModel } from '@/lib/ai/types/CognitiveModel'
import type { TherapySession } from '@/lib/ai/interfaces/therapy'
import { Textarea } from '@/components/ui/textarea'
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
            setActiveGoalId(data[0].id)
          }
        } else {
          // If no goals from API, generate initial ones
          const initialGoals = generateGoalsFromPatientModel(patientModel)
          setGoals(initialGoals)
          if (initialGoals.length > 0 && !activeGoalId) {
            setActiveGoalId(initialGoals[0].id)
          }
        }
      })
      .catch((err) => {
        setError((err as Error)?.message || String(err))
        // Optionally, load generated goals on API error as well
        const fallbackGoals = generateGoalsFromPatientModel(patientModel)
        setGoals(fallbackGoals)
        if (fallbackGoals.length > 0 && !activeGoalId) {
          setActiveGoalId(fallbackGoals[0].id)
        }
      })
      .finally(() => setLoading(false))
  }, [patientModel, activeGoalId])

  // Filter goals by category
  const filteredGoals =
    activeTab === 'all'
      ? goals
      : goals.filter((goal) => goal.category === activeTab)

  // Get the active goal
  const activeGoal = activeGoalId
    ? goals.find((goal) => goal.id === activeGoalId)
    : null

  // Calculate overall progress
  const overallProgress =
    goals.length > 0
      ? goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length
      : 0

  // Get interventions related to a specific goal
  const getRelatedInterventions = (goalId: string) => {
    return therapistInterventions
      .filter((intervention) => {
        const goal = goals.find((g) => g.id === goalId)
        return goal?.relatedInterventions.includes(intervention.type)
      })
      .slice(0, 3) // Show only most recent 3
  }

  // Handle category tab click
  const handleCategoryClick = (category: GoalCategory | 'all') => {
    setActiveTab(category)
  }

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
        setActionError((err as Error)?.message || String(err))
      } else {
        setActionError('An unknown error occurred')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Update an existing goal
  async function updateGoal(goal: TherapeuticGoal): void {
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
        setActionError((err as Error)?.message || String(err))
      } else {
        setActionError('An unknown error occurred')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Delete a goal
  async function deleteGoal(goalId: string): void {
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
        setActionError((err as Error)?.message || String(err))
      } else {
        setActionError('An unknown error occurred')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Open modal for new or edit
  function openModal(goal?: TherapeuticGoal): void {
    setEditGoal(goal || null)
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

  // Handle form changes
  function handleFormChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // Handle form submit
  async function handleFormSubmit(e: React.FormEvent): void {
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
    <div className="therapeutic-goals-tracker bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Therapeutic Goals</h3>
        <div className="text-sm text-gray-600">
          Session #
          {patientModel.therapeuticProgress.sessionProgressLog.length + 1}
        </div>
      </div>

      {/* Overall progress */}
      <Card className="p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
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

        <div className="mt-2 text-xs text-gray-500">
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
      <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
        <Button
          size="sm"
          variant={activeTab === 'all' ? 'default' : 'outline'}
          onClick={() => handleCategoryClick('all')}
          className="text-xs whitespace-nowrap"
        >
          All
        </Button>
        {Object.values(GoalCategory).map((category) => (
          <Button
            key={category}
            size="sm"
            variant={activeTab === category ? 'default' : 'outline'}
            onClick={() => handleCategoryClick(category)}
            className="text-xs whitespace-nowrap"
          >
            {(() => {
              switch (category) {
                case GoalCategory.EMOTIONAL_REGULATION: return 'Emotional Regulation';
                case GoalCategory.COGNITIVE_RESTRUCTURING: return 'Cognitive Restructuring';
                case GoalCategory.BEHAVIORAL_CHANGE: return 'Behavioral Change';
                case GoalCategory.SYMPTOM_REDUCTION: return 'Symptom Reduction';
                case GoalCategory.RELATIONSHIP_IMPROVEMENT: return 'Relationship Improvement';
                case GoalCategory.COPING_SKILLS: return 'Coping Skills';
                case GoalCategory.TRAUMA_RECOVERY: return 'Trauma Recovery';
                case GoalCategory.LIFESTYLE_CHANGES: return 'Lifestyle Changes';
                default: return category;
              }
            })()}
          </Button>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex justify-end mb-4">
        <Button onClick={() => openModal()} disabled={actionLoading}>
          + Add Goal
        </Button>
      </div>

      {/* Error and loading states */}
      {(error || actionError) && (
        <div className="text-red-600 mb-2">{error || actionError}</div>
      )}
      {(loading || actionLoading) && (
        <div className="text-gray-500 mb-2">Loading...</div>
      )}

      {/* Modal for add/edit goal */}
      {showModal && (
        <Dialog
          open={showModal}
          onOpenChange={(open) => { if (!open) closeModal() }}
        >
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <DialogTitle>
              {editGoal ? 'Edit Goal' : 'Add Goal'}
            </DialogTitle>
            <Input
              name="title"
              value={form.title || ''}
              onChange={handleFormChange}
              placeholder="Goal Title"
              required
              maxLength={128}
            />

            <Textarea
              name="description"
              value={form.description || ''}
              onChange={handleFormChange}
              placeholder="Description"
              maxLength={1024}
            />

            <select
              name="category"
              value={form.category || GoalCategory.EMOTIONAL_REGULATION}
              onChange={handleFormChange}
              className="w-full border rounded p-2"
            >
              {Object.values(GoalCategory).map((cat) => (
                <option key={cat} value={cat}>
                  {(() => {
                    switch (cat) {
                      case GoalCategory.EMOTIONAL_REGULATION: return 'Emotional Regulation';
                      case GoalCategory.COGNITIVE_RESTRUCTURING: return 'Cognitive Restructuring';
                      case GoalCategory.BEHAVIORAL_CHANGE: return 'Behavioral Change';
                      case GoalCategory.SYMPTOM_REDUCTION: return 'Symptom Reduction';
                      case GoalCategory.RELATIONSHIP_IMPROVEMENT: return 'Relationship Improvement';
                      case GoalCategory.COPING_SKILLS: return 'Coping Skills';
                      case GoalCategory.TRAUMA_RECOVERY: return 'Trauma Recovery';
                      case GoalCategory.LIFESTYLE_CHANGES: return 'Lifestyle Changes';
                      default: return cat;
                    }
                  })()}
                </option>
              ))}
            </select>
            <select
              name="status"
              value={form.status || GoalStatus.NOT_STARTED}
              onChange={handleFormChange}
              className="w-full border rounded p-2"
            >
              {Object.values(GoalStatus).map((stat) => (
                <option key={stat} value={stat}>
                  {stat.replace('_', ' ')}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={actionLoading} className="w-full">
              {editGoal ? 'Update Goal' : 'Create Goal'}
            </Button>
          </form>
        </Dialog>
      )}

      {/* Goals list */}
      {filteredGoals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No goals found for this category
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {filteredGoals.map((goal) => (
            <Card
              key={goal.id}
              className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                activeGoalId === goal.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setActiveGoalId(goal.id)}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium">{goal.title}</h4>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
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
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                {goal.description}
              </p>
              <div className="flex items-center mb-1">
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
                  className="flex-1 mr-2"
                />

                <span className="text-xs font-medium">{goal.progress}%</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
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
                    if (window.confirm('Delete this goal?')) deleteGoal(goal.id)
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
          <h4 className="font-semibold mb-2">{activeGoal.title}</h4>
          <p className="text-sm text-gray-700 mb-4">{activeGoal.description}</p>

          <h5 className="font-medium mb-2 text-sm">Progress Checkpoints</h5>
          <div className="space-y-3 mb-4">
            {activeGoal.checkpoints.map((checkpoint) => (
              <div key={`checkpoint-${checkpoint.id}`} className="flex items-start">
                <div
                  className={`h-5 w-5 mt-0.5 rounded-full mr-3 flex items-center justify-center ${
                    checkpoint.isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                >
                  {checkpoint.isCompleted && (
                    <svg
                      className="h-3 w-3 text-white"
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
                    <p className="text-xs text-gray-500 mt-0.5">
                      Completed on{' '}
                      {new Date(checkpoint.completedAt).toLocaleDateString()}
                    </p>
                  )}
                  {checkpoint.notes && (
                    <p className="text-xs text-gray-500 mt-0.5 italic">
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
              <h5 className="font-medium mb-2 text-sm">Progress History</h5>
              <div className="space-y-2 mb-4">
                {activeGoal.progressHistory.slice(-3).map((snapshot) => (
                  <div
                    key={`progress-${snapshot.timestamp}-${snapshot.progressPercent}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-600">
                      {new Date(snapshot.timestamp).toLocaleDateString()}
                    </span>
                    <div className="flex items-center">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full mr-2">
                        <div
                          className="h-full bg-blue-500 rounded-full"
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
              <h5 className="font-medium mb-2 text-sm">Recent Interventions</h5>
              <div className="space-y-2">
                {getRelatedInterventions(activeGoal.id).length > 0 ? (
                  getRelatedInterventions(activeGoal.id).map(
                    (intervention) => (
                      <div key={`intervention-${intervention.type}-${intervention.timestamp.toISOString()}`} className="text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">
                            {intervention.type}
                          </span>
                          <span className="text-xs text-gray-500">
                            {intervention.timestamp.toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">
                          {intervention.outcome}
                        </p>
                      </div>
                    ),
                  )
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    No recent interventions for this goal
                  </p>
                )}
              </div>
            </>
          )}

          {/* Notes */}
          {activeGoal.notes && (
            <>
              <h5 className="font-medium mt-4 mb-2 text-sm">Notes</h5>
              <p className="text-sm text-gray-700">{activeGoal.notes}</p>
            </>
          )}
        </Card>
      )}
    </div>
  )
}

// Helper function to generate goals from patient model
// In a real application, these would be stored in the database
function generateGoalsFromPatientModel(
  patientModel: CognitiveModel,
): TherapeuticGoal[] {
  const goals: TherapeuticGoal[] = []
  const now = Date.now()
  const sixMonthsFromNow = now + 15768000000 // 6 months in milliseconds

  // Generate goals based on presenting issues
  patientModel.presentingIssues.forEach((issue, index) => {
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
        relevantDistortions: patientModel.distortionPatterns
          .slice(0, 2)
          .map((d) => d.type),
        notes:
          index === 0
            ? `Patient shows good understanding of how ${issue.toLowerCase()} impacts daily life. Working on practical coping strategies.`
            : undefined,
      })
    }
  })

  // Generate goals based on therapy goals
  patientModel.goalsForTherapy.forEach((goal, index) => {
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
  if (patientModel.therapeuticProgress.sessionProgressLog.length > 5) {
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
  } else if (
    lowerIssue.includes('coping') ||
    lowerIssue.includes('skills')
  ) {
    return GoalCategory.COPING_SKILLS
  } else if (
    lowerIssue.includes('trauma')
  ) {
    return GoalCategory.TRAUMA_RECOVERY
  } else if (
    lowerIssue.includes('symptom')
  ) {
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
  const checkpoints = []
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
    const description = possibleCheckpoints[randomIndex]
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
  const history = []

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
  const interventions = []

  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * commonInterventions.length)
    interventions.push(commonInterventions[randomIndex])
    commonInterventions.splice(randomIndex, 1) // Ensure unique interventions
  }

  return interventions
}
