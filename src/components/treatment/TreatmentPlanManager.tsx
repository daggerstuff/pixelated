import { format, addDays, differenceInDays } from 'date-fns'
import React, { useState, useEffect } from 'react'

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

const TreatmentPlanManager: React.FC<TreatmentPlanManagerProps> = ({
  plan,
  onSave,
  onGoalUpdate,
  className = '',
  readOnly = false,
}) => {
  const [currentPlan, setCurrentPlan] = useState<TreatmentPlan | null>(null)
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
    createdDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    lastModified: new Date(),
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
        targetDate: addDays(new Date(), 30),
        priority: 'high',
        status: 'in-progress',
        progress: 65,
        category: 'emotional',
        milestones: [
          {
            id: 'm1',
            title: 'Learn breathing techniques',
            completed: true,
            completedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          },
          {
            id: 'm2',
            title: 'Practice daily meditation',
            completed: true,
            completedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
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
        targetDate: addDays(new Date(), 21),
        priority: 'medium',
        status: 'in-progress',
        progress: 40,
        category: 'physical',
        milestones: [
          {
            id: 'm5',
            title: 'Create bedtime routine',
            completed: true,
            completedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
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
        targetDate: addDays(new Date(), 45),
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
    setCurrentPlan(plan || defaultPlan)
  }, [plan, defaultPlan])

  const getPriorityColor = (priority: TreatmentGoal['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500 text-white'
      case 'high':
        return 'bg-orange-500 text-white'
      case 'medium':
        return 'bg-yellow-500 text-white'
      case 'low':
        return 'bg-green-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getStatusColor = (status: TreatmentGoal['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in-progress':
        return 'bg-blue-100 text-blue-800'
      case 'on-hold':
        return 'bg-yellow-100 text-yellow-800'
      case 'not-started':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryIcon = (category: TreatmentGoal['category']) => {
    switch (category) {
      case 'behavioral':
        return '🎯'
      case 'cognitive':
        return '🧠'
      case 'emotional':
        return '❤️'
      case 'social':
        return '👥'
      case 'physical':
        return '💪'
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
      lastModified: new Date(),
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
      id: `goal-${Date.now()}`,
      title: newGoal.title || '',
      description: newGoal.description || '',
      targetDate: newGoal.targetDate || addDays(new Date(), 30),
      priority: newGoal.priority || 'medium',
      status: 'not-started',
      progress: 0,
      category: newGoal.category || 'behavioral',
      milestones: [],
    }

    const updatedPlan = {
      ...currentPlan,
      goals: [...currentPlan.goals, goal],
      lastModified: new Date(),
    }

    setCurrentPlan(updatedPlan)
    setNewGoal({})
    setShowAddGoal(false)
    onSave?.(updatedPlan)
  }

  if (!currentPlan) {
    return (
      <div className={`flex h-64 items-center justify-center ${className}`}>
        <div className='border-blue-500 h-8 w-8 animate-spin rounded-full border-b-2'></div>
        <span className='text-gray-600 ml-2'>Loading treatment plan...</span>
      </div>
    )
  }

  const overallProgress = Math.round(
    currentPlan.goals.reduce((sum, goal) => sum + goal.progress, 0) /
      currentPlan.goals.length,
  )

  return (
    <div className={`bg-white rounded-lg p-6 shadow-lg ${className}`}>
      {/* Header */}
      <div className='border-gray-200 mb-6 border-b'>
        <div className='mb-4 flex items-center justify-between'>
          <div>
            <h2 className='text-gray-900 text-2xl font-bold'>Treatment Plan</h2>
            <p className='text-gray-600'>Client: {currentPlan.clientName}</p>
            <p className='text-gray-600'>
              Therapist: {currentPlan.therapistName}
            </p>
          </div>
          <div className='text-right'>
            <div className='text-gray-500 text-sm'>Overall Progress</div>
            <div className='text-blue-600 text-3xl font-bold'>
              {overallProgress}%
            </div>
            <div className='bg-gray-200 mt-1 h-2 w-32 rounded-full'>
              <div
                className='bg-blue-600 h-2 rounded-full transition-all duration-300'
                style={{ width: `${overallProgress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className='flex space-x-4'>
          {(['overview', 'goals', 'progress', 'notes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-4 py-2 capitalize transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className='space-y-6'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
            <div className='bg-blue-50 rounded-lg p-4'>
              <div className='text-blue-600 text-lg font-semibold'>
                Duration
              </div>
              <div className='text-2xl font-bold'>
                {currentPlan.duration} weeks
              </div>
            </div>
            <div className='bg-green-50 rounded-lg p-4'>
              <div className='text-green-600 text-lg font-semibold'>
                Active Goals
              </div>
              <div className='text-2xl font-bold'>
                {currentPlan.goals.length}
              </div>
            </div>
            <div className='bg-purple-50 rounded-lg p-4'>
              <div className='text-purple-600 text-lg font-semibold'>
                Status
              </div>
              <div className='text-2xl font-bold capitalize'>
                {currentPlan.status}
              </div>
            </div>
          </div>

          <div>
            <h3 className='mb-3 text-lg font-semibold'>Goal Categories</h3>
            <div className='grid grid-cols-2 gap-2 md:grid-cols-5'>
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
                    className='bg-gray-50 rounded-lg p-3 text-center'
                  >
                    <div className='mb-1 text-2xl'>
                      {getCategoryIcon(category as TreatmentGoal['category'])}
                    </div>
                    <div className='text-gray-600 text-sm capitalize'>
                      {category}
                    </div>
                    <div className='font-bold'>{count}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'goals' && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg font-semibold'>Treatment Goals</h3>
            {!readOnly && (
              <button
                onClick={() => setShowAddGoal(true)}
                className='bg-blue-500 text-white hover:bg-blue-600 rounded px-4 py-2 transition-colors'
              >
                Add Goal
              </button>
            )}
          </div>

          {/* Add Goal Form */}
          {showAddGoal && (
            <div className='bg-gray-50 space-y-3 rounded-lg p-4'>
              <input
                type='text'
                placeholder='Goal title'
                value={newGoal.title || ''}
                onChange={(e) =>
                  setNewGoal({ ...newGoal, title: e.target.value })
                }
                className='w-full rounded border p-2'
              />
              <textarea
                placeholder='Goal description'
                value={newGoal.description || ''}
                onChange={(e) =>
                  setNewGoal({ ...newGoal, description: e.target.value })
                }
                className='h-20 w-full rounded border p-2'
              />
              <div className='flex gap-4'>
                <select
                  value={newGoal.priority || 'medium'}
                  onChange={(e) =>
                    setNewGoal({
                      ...newGoal,
                      priority: e.target.value as TreatmentGoal['priority'],
                    })
                  }
                  className='rounded border p-2'
                >
                  <option value='low'>Low Priority</option>
                  <option value='medium'>Medium Priority</option>
                  <option value='high'>High Priority</option>
                  <option value='urgent'>Urgent</option>
                </select>
                <select
                  value={newGoal.category || 'behavioral'}
                  onChange={(e) =>
                    setNewGoal({
                      ...newGoal,
                      category: e.target.value as TreatmentGoal['category'],
                    })
                  }
                  className='rounded border p-2'
                >
                  <option value='behavioral'>Behavioral</option>
                  <option value='cognitive'>Cognitive</option>
                  <option value='emotional'>Emotional</option>
                  <option value='social'>Social</option>
                  <option value='physical'>Physical</option>
                </select>
                <input
                  type='date'
                  value={
                    newGoal.targetDate
                      ? format(newGoal.targetDate, 'yyyy-MM-dd')
                      : format(addDays(new Date(), 30), 'yyyy-MM-dd')
                  }
                  onChange={(e) =>
                    setNewGoal({
                      ...newGoal,
                      targetDate: new Date(e.target.value),
                    })
                  }
                  className='rounded border p-2'
                />
              </div>
              <div className='flex gap-2'>
                <button
                  onClick={addNewGoal}
                  className='bg-green-500 text-white hover:bg-green-600 rounded px-4 py-2'
                >
                  Add Goal
                </button>
                <button
                  onClick={() => setShowAddGoal(false)}
                  className='bg-gray-500 text-white hover:bg-gray-600 rounded px-4 py-2'
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Goals List */}
          <div className='space-y-4'>
            {currentPlan.goals.map((goal) => (
              <div
                key={goal.id}
                className='bg-white rounded-lg border p-4 shadow-sm'
              >
                <div className='mb-3 flex items-start justify-between'>
                  <div className='flex-1'>
                    <div className='mb-2 flex items-center gap-3'>
                      <span className='text-xl'>
                        {getCategoryIcon(goal.category)}
                      </span>
                      <h4 className='text-lg font-semibold'>{goal.title}</h4>
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
                    <p className='text-gray-600 mb-2'>{goal.description}</p>
                    <div className='text-gray-500 text-sm'>
                      Target: {format(goal.targetDate, 'MMM dd, yyyy')}(
                      {differenceInDays(goal.targetDate, new Date())} days
                      remaining)
                    </div>
                  </div>
                  <div className='ml-4 text-right'>
                    <div className='text-blue-600 text-2xl font-bold'>
                      {goal.progress}%
                    </div>
                    <div className='bg-gray-200 mt-1 h-2 w-24 rounded-full'>
                      <div
                        className='bg-blue-600 h-2 rounded-full transition-all duration-300'
                        style={{ width: `${goal.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Milestones */}
                <div className='space-y-2'>
                  <h5 className='text-gray-700 font-medium'>Milestones:</h5>
                  {goal.milestones.map((milestone) => (
                    <div key={milestone.id} className='flex items-center gap-3'>
                      <input
                        type='checkbox'
                        checked={milestone.completed}
                        onChange={() => toggleMilestone(goal.id, milestone.id)}
                        disabled={readOnly}
                        className='text-blue-600 h-4 w-4 rounded'
                      />
                      <span
                        className={
                          milestone.completed
                            ? 'text-gray-500 line-through'
                            : ''
                        }
                      >
                        {milestone.title}
                      </span>
                      {milestone.completed && milestone.completedDate && (
                        <span className='text-green-600 text-xs'>
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
        <div className='space-y-6'>
          <h3 className='text-lg font-semibold'>Progress Overview</h3>
          <div className='space-y-4'>
            {currentPlan.goals.map((goal) => (
              <div key={goal.id} className='bg-gray-50 rounded-lg p-4'>
                <div className='mb-2 flex items-center justify-between'>
                  <h4 className='font-medium'>{goal.title}</h4>
                  <span className='text-blue-600 text-lg font-bold'>
                    {goal.progress}%
                  </span>
                </div>
                <div className='bg-gray-200 mb-2 h-3 w-full rounded-full'>
                  <div
                    className='bg-blue-600 h-3 rounded-full transition-all duration-500'
                    style={{ width: `${goal.progress}%` }}
                  ></div>
                </div>
                <div className='text-gray-600 text-sm'>
                  {goal.milestones.filter((m) => m.completed).length} of{' '}
                  {goal.milestones.length} milestones completed
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className='space-y-4'>
          <h3 className='text-lg font-semibold'>Treatment Notes</h3>
          <textarea
            value={currentPlan.notes}
            onChange={(e) => {
              if (!readOnly) {
                const updatedPlan = {
                  ...currentPlan,
                  notes: e.target.value,
                  lastModified: new Date(),
                }
                setCurrentPlan(updatedPlan)
                onSave?.(updatedPlan)
              }
            }}
            readOnly={readOnly}
            className='h-40 w-full resize-none rounded-lg border p-3'
            placeholder='Add treatment notes, observations, and recommendations...'
          />
          <div className='text-gray-500 text-sm'>
            Last modified:{' '}
            {format(currentPlan.lastModified, 'MMM dd, yyyy at h:mm a')}
          </div>
        </div>
      )}
    </div>
  )
}

export default TreatmentPlanManager
