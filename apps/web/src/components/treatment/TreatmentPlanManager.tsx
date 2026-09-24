import { format, addDays, differenceInDays } from 'date-fns'
import { Target, Dumbbell } from 'lucide-react'
import React, { useState, useEffect, useMemo, useRef } from 'react'

interface TreatmentGoal {
  id: string
  title: string
  description: string
  targetDate: Date
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'not-started' | 'in-progress' | 'completed' | 'on-hold'
  progress: number // 0-100
  milestones: Milestone[]
  category: 'behavioral' | 'cognitive' | 'emotional' | 'social' | 'physical'
}

interface Milestone {
  id: string
  title: string
  completed: boolean
  completedDate?: Date
  notes?: string
}

interface TreatmentPlan {
  id: string
  clientName: string
  therapistName: string
  createdDate: Date
  lastModified: Date
  duration: number // weeks
  goals: TreatmentGoal[]
  notes: string
  status: 'active' | 'completed' | 'paused' | 'draft'
}

interface TreatmentPlanManagerProps {
  plan?: TreatmentPlan
  onSave?: (plan: TreatmentPlan) => void
  onGoalUpdate?: (goalId: string, updates: Partial<TreatmentGoal>) => void
  className?: string
  readOnly?: boolean
}

// Performance optimization: Extract static maps outside component to prevent recreation on every render and enable O(1) lookups
const PRIORITY_COLORS_MAP: Record<TreatmentGoal['priority'], string> = {
  urgent: 'bg-primary text-primary-foreground font-semibold',
  high: 'bg-secondary border border-ring text-foreground font-semibold',
  medium: 'bg-secondary border border-ring text-foreground font-medium',
  low: 'bg-secondary border border-input text-foreground',
}

const STATUS_COLORS_MAP: Record<TreatmentGoal['status'], string> = {
  'completed': 'bg-secondary border border-input text-foreground',
  'in-progress': 'bg-secondary border border-ring text-foreground font-medium',
  'on-hold': 'bg-secondary border border-input text-muted-foreground',
  'not-started': 'bg-secondary border border-border text-muted-foreground',
}

const TreatmentPlanManager: React.FC<TreatmentPlanManagerProps> = ({
  plan,
  onSave,
  onGoalUpdate,
  className = '',
  readOnly = false,
}) => {
  const [currentPlan, setCurrentPlan] = useState<TreatmentPlan | null>(null)
  const goalCounterRef = useRef(0)
  const [activeTab, setActiveTab] = useState<
    'overview' | 'goals' | 'progress' | 'notes'
  >('overview')
  const [_editingGoal, _setEditingGoal] = useState<string | null>(null)
  const [newGoal, setNewGoal] = useState<Partial<TreatmentGoal>>({})
  const [showAddGoal, setShowAddGoal] = useState(false)

  // Default sample plan
  const defaultPlan: TreatmentPlan = {
    id: 'plan-1',
    clientName: 'Anonymous Client',
    therapistName: 'Dr. Smith',
    createdDate: new Date('2026-08-27T00:00:00Z'),
    lastModified: new Date('2026-09-03T00:00:00Z'),
    duration: 12,
    status: 'active',
    notes:
      'Initial assessment shows moderate anxiety and depression symptoms. Client is motivated for change.',
    goals: [
      {
        id: 'goal-1',
        title: 'Reduce Anxiety Symptoms',
        description:
          'Learn and practice anxiety management techniques to reduce daily anxiety levels',
        targetDate: new Date('2026-10-03T00:00:00Z'),
        priority: 'high',
        status: 'in-progress',
        progress: 65,
        category: 'emotional',
        milestones: [
          {
            id: 'm1',
            title: 'Learn breathing techniques',
            completed: true,
            completedDate: new Date('2026-08-29T00:00:00Z'),
          },
          {
            id: 'm2',
            title: 'Practice daily meditation',
            completed: true,
            completedDate: new Date('2026-08-31T00:00:00Z'),
          },
          { id: 'm3', title: 'Identify anxiety triggers', completed: false },
          { id: 'm4', title: 'Develop coping strategies', completed: false },
        ],
      },
      {
        id: 'goal-2',
        title: 'Improve Sleep Quality',
        description:
          'Establish healthy sleep patterns and improve sleep duration and quality',
        targetDate: new Date('2026-09-24T00:00:00Z'),
        priority: 'medium',
        status: 'in-progress',
        progress: 40,
        category: 'physical',
        milestones: [
          {
            id: 'm5',
            title: 'Create bedtime routine',
            completed: true,
            completedDate: new Date('2026-08-30T00:00:00Z'),
          },
          { id: 'm6', title: 'Limit screen time before bed', completed: false },
          { id: 'm7', title: 'Track sleep patterns', completed: false },
        ],
      },
      {
        id: 'goal-3',
        title: 'Enhance Social Connections',
        description:
          'Build and maintain meaningful relationships and social support networks',
        targetDate: new Date('2026-10-17T00:00:00Z'),
        priority: 'medium',
        status: 'not-started',
        progress: 0,
        category: 'social',
        milestones: [
          { id: 'm8', title: 'Join support group', completed: false },
          { id: 'm9', title: 'Reconnect with old friends', completed: false },
          { id: 'm10', title: 'Practice social skills', completed: false },
        ],
      },
    ],
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCurrentPlan(plan ?? defaultPlan)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [plan, defaultPlan])

  // ⚡ Bolt: Memoize O(N) progress calculation to prevent recalculation on tab changes
  // Moved before early return to comply with Rules of Hooks
  const overallProgress = useMemo(() => {
    if (!currentPlan?.goals.length) return 0
    return Math.round(
      currentPlan.goals.reduce((sum, goal) => sum + goal.progress, 0) /
        currentPlan.goals.length,
    )
  }, [currentPlan])

  const getPriorityColor = (priority: TreatmentGoal['priority']) => {
    return (
      PRIORITY_COLORS_MAP[priority] ??
      'bg-secondary border border-border text-muted-foreground'
    )
  }

  const getStatusColor = (status: TreatmentGoal['status']) => {
    return (
      STATUS_COLORS_MAP[status] ??
      'bg-secondary border border-border text-muted-foreground'
    )
  }

  const getCategoryIcon = (category: TreatmentGoal['category']) => {
    switch (category) {
      case 'behavioral':
        return <Target className="h-4 w-4" />
      case 'cognitive':
        return '🧠'
      case 'emotional':
        return '❤️'
      case 'social':
        return '👥'
      case 'physical':
        return <Dumbbell className="h-4 w-4" />
      default:
        return '📋'
    }
  }

  const updateGoal = (goalId: string, updates: Partial<TreatmentGoal>) => {
    if (!currentPlan) return

    const updatedPlan = {
      ...currentPlan,
      goals: currentPlan.goals.map((goal) =>
        goal.id === goalId ? { ...goal, ...updates } : goal,
      ),
      lastModified: new Date('2026-09-03T00:00:00Z'),
    }

    setCurrentPlan(updatedPlan)
    onGoalUpdate?.(goalId, updates)
    onSave?.(updatedPlan)
  }

  const toggleMilestone = (goalId: string, milestoneId: string) => {
    if (!currentPlan || readOnly) return

    const goal = currentPlan.goals.find((g) => g.id === goalId)
    if (!goal) return

    const updatedMilestones = goal.milestones.map((milestone) =>
      milestone.id === milestoneId
        ? {
            ...milestone,
            completed: !milestone.completed,
            completedDate: !milestone.completed ? new Date() : undefined,
          }
        : milestone,
    )

    const completedCount = updatedMilestones.filter((m) => m.completed).length
    const progress = Math.round(
      (completedCount / updatedMilestones.length) * 100,
    )

    updateGoal(goalId, { milestones: updatedMilestones, progress })
  }

  const addNewGoal = () => {
    if (!currentPlan || !newGoal.title) return

    const goal: TreatmentGoal = {
      id: `goal-${++goalCounterRef.current}`,
      title: newGoal.title || '',
      description: newGoal.description ?? '',
      targetDate: newGoal.targetDate ?? new Date('2026-10-03T00:00:00Z'),
      priority: newGoal.priority ?? 'medium',
      status: 'not-started',
      progress: 0,
      category: newGoal.category ?? 'behavioral',
      milestones: [],
    }

    const updatedPlan = {
      ...currentPlan,
      goals: [...currentPlan.goals, goal],
      lastModified: new Date('2026-09-03T00:00:00Z'),
    }

    setCurrentPlan(updatedPlan)
    setNewGoal({})
    setShowAddGoal(false)
    onSave?.(updatedPlan)
  }

  if (!currentPlan) {
    return (
      <div className={`flex h-64 items-center justify-center ${className}`}>
        <div className="h-8 w-8 animate-spin rounded-none border-b-2 border-ring"></div>
        <span className="ml-2 text-muted-foreground">
          Loading treatment plan...
        </span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-none border border-border bg-card p-6 ${className}`}
    >
      {/* Header */}
      <div className="mb-6 border-b border-border">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Treatment Plan
            </h2>
            <p className="text-muted-foreground">
              Client: {currentPlan.clientName}
            </p>
            <p className="text-muted-foreground">
              Therapist: {currentPlan.therapistName}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              Overall Progress
            </div>
            <div className="text-3xl font-bold text-foreground">
              {overallProgress}%
            </div>
            <div className="mt-1 h-2 w-32 rounded-none bg-secondary">
              <div
                className="h-2 rounded-none bg-primary transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4">
          {(['overview', 'goals', 'progress', 'notes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 py-2 capitalize transition-colors ${
                activeTab === tab
                  ? 'border-ring text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-none bg-secondary p-4">
              <div className="text-lg font-semibold text-foreground">
                Duration
              </div>
              <div className="text-2xl font-bold">
                {currentPlan.duration} weeks
              </div>
            </div>
            <div className="rounded-none bg-secondary p-4">
              <div className="text-lg font-semibold text-foreground">
                Active Goals
              </div>
              <div className="text-2xl font-bold">
                {currentPlan.goals.length}
              </div>
            </div>
            <div className="rounded-none bg-secondary p-4">
              <div className="text-lg font-semibold text-foreground">
                Status
              </div>
              <div className="text-2xl font-bold capitalize">
                {currentPlan.status}
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-semibold">Goal Categories</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {[
                'behavioral',
                'cognitive',
                'emotional',
                'social',
                'physical',
              ].map((category) => {
                const count = currentPlan.goals.filter(
                  (g) => g.category === category,
                ).length
                return (
                  <div
                    key={category}
                    className="rounded-none bg-secondary p-3 text-center"
                  >
                    <div className="mb-1 text-2xl">
                      {getCategoryIcon(category as TreatmentGoal['category'])}
                    </div>
                    <div className="text-sm capitalize text-muted-foreground">
                      {category}
                    </div>
                    <div className="font-bold">{count}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'goals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Treatment Goals</h3>
            {!readOnly && (
              <button
                onClick={() => setShowAddGoal(true)}
                className="rounded-none bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-accent"
              >
                Add Goal
              </button>
            )}
          </div>

          {/* Add Goal Form */}
          {showAddGoal && (
            <div className="space-y-3 rounded-none bg-secondary p-4">
              <input
                type="text"
                placeholder="Goal title"
                value={newGoal.title ?? ''}
                onChange={(e) =>
                  setNewGoal({ ...newGoal, title: e.target.value })
                }
                className="w-full rounded border p-2"
              />
              <textarea
                placeholder="Goal description"
                value={newGoal.description ?? ''}
                onChange={(e) =>
                  setNewGoal({ ...newGoal, description: e.target.value })
                }
                className="h-20 w-full rounded border p-2"
              />
              <div className="flex gap-4">
                <select
                  value={newGoal.priority ?? 'medium'}
                  onChange={(e) =>
                    setNewGoal({
                      ...newGoal,
                      priority: e.target.value as TreatmentGoal['priority'],
                    })
                  }
                  className="rounded border p-2"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
                <select
                  value={newGoal.category ?? 'behavioral'}
                  onChange={(e) =>
                    setNewGoal({
                      ...newGoal,
                      category: e.target.value as TreatmentGoal['category'],
                    })
                  }
                  className="rounded border p-2"
                >
                  <option value="behavioral">Behavioral</option>
                  <option value="cognitive">Cognitive</option>
                  <option value="emotional">Emotional</option>
                  <option value="social">Social</option>
                  <option value="physical">Physical</option>
                </select>
                <input
                  type="date"
                  value={
                    newGoal.targetDate
                      ? format(newGoal.targetDate, 'yyyy-MM-dd')
                      : format(new Date('2026-10-03T00:00:00Z'), 'yyyy-MM-dd')
                  }
                  onChange={(e) =>
                    setNewGoal({
                      ...newGoal,
                      targetDate: new Date(e.target.value),
                    })
                  }
                  className="rounded border p-2"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addNewGoal}
                  className="rounded-none bg-primary px-4 py-2 text-primary-foreground hover:bg-accent"
                >
                  Add Goal
                </button>
                <button
                  onClick={() => setShowAddGoal(false)}
                  className="rounded-none border border-border bg-secondary px-4 py-2 text-foreground hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Goals List */}
          <div className="space-y-4">
            {currentPlan.goals.map((goal) => (
              <div
                key={goal.id}
                className="rounded-none border border-border bg-card p-4"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="text-xl">
                        {getCategoryIcon(goal.category)}
                      </span>
                      <h4 className="text-lg font-semibold">{goal.title}</h4>
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${getPriorityColor(goal.priority)}`}
                      >
                        {goal.priority}
                      </span>
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${getStatusColor(goal.status)}`}
                      >
                        {goal.status.replace('-', ' ')}
                      </span>
                    </div>
                    <p className="mb-2 text-muted-foreground">
                      {goal.description}
                    </p>
                    <div className="text-sm text-muted-foreground">
                      Target: {format(goal.targetDate, 'MMM dd, yyyy')}(
                      {differenceInDays(goal.targetDate, new Date())} days
                      remaining)
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-2xl font-bold text-foreground">
                      {goal.progress}%
                    </div>
                    <div className="mt-1 h-2 w-24 rounded-none bg-secondary">
                      <div
                        className="h-2 rounded-none bg-primary transition-all duration-300"
                        style={{ width: `${goal.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Milestones */}
                <div className="space-y-2">
                  <h5 className="font-medium text-foreground">Milestones:</h5>
                  {goal.milestones.map((milestone) => (
                    <div key={milestone.id} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={milestone.completed}
                        onChange={() => toggleMilestone(goal.id, milestone.id)}
                        disabled={readOnly}
                        className="h-4 w-4 rounded-none text-foreground"
                      />
                      <span
                        className={
                          milestone.completed
                            ? 'text-muted-foreground line-through'
                            : ''
                        }
                      >
                        {milestone.title}
                      </span>
                      {milestone.completed && milestone.completedDate && (
                        <span className="text-xs text-foreground">
                          ✓ {format(milestone.completedDate, 'MMM dd')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'progress' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Progress Overview</h3>
          <div className="space-y-4">
            {currentPlan.goals.map((goal) => (
              <div key={goal.id} className="rounded-none bg-secondary p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-medium">{goal.title}</h4>
                  <span className="text-lg font-bold text-foreground">
                    {goal.progress}%
                  </span>
                </div>
                <div className="mb-2 h-3 w-full rounded-none bg-secondary">
                  <div
                    className="h-3 rounded-none bg-primary transition-all duration-500"
                    style={{ width: `${goal.progress}%` }}
                  ></div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {goal.milestones.filter((m) => m.completed).length} of{' '}
                  {goal.milestones.length} milestones completed
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Treatment Notes</h3>
          <textarea
            value={currentPlan.notes}
            onChange={(e) => {
              if (!readOnly) {
                const updatedPlan = {
                  ...currentPlan,
                  notes: e.target.value,
                  lastModified: new Date('2026-09-03T00:00:00Z'),
                }
                setCurrentPlan(updatedPlan)
                onSave?.(updatedPlan)
              }
            }}
            readOnly={readOnly}
            className="h-40 w-full resize-none rounded-none border border-input p-3"
            placeholder="Add treatment notes, observations, and recommendations..."
          />
          <div className="text-sm text-muted-foreground">
            Last modified:{' '}
            {format(currentPlan.lastModified, 'MMM dd, yyyy at h:mm a')}
          </div>
        </div>
      )}
    </div>
  )
}

export default TreatmentPlanManager
