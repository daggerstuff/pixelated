import React, { useState, useEffect } from 'react'
import { format, addDays, differenceInDays } from 'date-fns'

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
  const [editingGoal, setEditingGoal] = useState<string | null>(null)
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
  }, [plan])

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
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading treatment plan...</span>
      </div>
    )
  }

  const overallProgress = Math.round(
    currentPlan.goals.reduce((sum, goal) => sum + goal.progress, 0) /
      currentPlan.goals.length,
  )

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Treatment Plan</h2>
            <p className="text-gray-600">Client: {currentPlan.clientName}</p>
            <p className="text-gray-600">
              Therapist: {currentPlan.therapistName}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Overall Progress</div>
            <div className="text-3xl font-bold text-blue-600">
              {overallProgress}%
            </div>
            <div className="w-32 bg-gray-200 rounded-full h-2 mt-1">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
              className={`px-4 py-2 border-b-2 transition-colors capitalize ${
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-blue-600 text-lg font-semibold">
                Duration
              </div>
              <div className="text-2xl font-bold">
                {currentPlan.duration} weeks
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-green-600 text-lg font-semibold">
                Active Goals
              </div>
              <div className="text-2xl font-bold">
                {currentPlan.goals.length}
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-purple-600 text-lg font-semibold">
                Status
              </div>
              <div className="text-2xl font-bold capitalize">
                {currentPlan.status}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3">Goal Categories</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
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
                    className="text-center p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="text-2xl mb-1">
                      {getCategoryIcon(category as TreatmentGoal['category'])}
                    </div>
                    <div className="text-sm text-gray-600 capitalize">
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
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Treatment Goals</h3>
            {!readOnly && (
              <button
                onClick={() => setShowAddGoal(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Add Goal
              </button>
            )}
          </div>

          {/* Add Goal Form */}
          {showAddGoal && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <input
                type="text"
                placeholder="Goal title"
                value={newGoal.title || ''}
                onChange={(e) =>
                  setNewGoal({ ...newGoal, title: e.target.value })
                }
                className="w-full p-2 border rounded"
              />
              <textarea
                placeholder="Goal description"
                value={newGoal.description || ''}
                onChange={(e) =>
                  setNewGoal({ ...newGoal, description: e.target.value })
                }
                className="w-full p-2 border rounded h-20"
              />
              <div className="flex gap-4">
                <select
                  value={newGoal.priority || 'medium'}
                  onChange={(e) =>
                    setNewGoal({
                      ...newGoal,
                      priority: e.target.value as TreatmentGoal['priority'],
                    })
                  }
                  className="p-2 border rounded"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
                <select
                  value={newGoal.category || 'behavioral'}
                  onChange={(e) =>
                    setNewGoal({
                      ...newGoal,
                      category: e.target.value as TreatmentGoal['category'],
                    })
                  }
                  className="p-2 border rounded"
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
                      : format(addDays(new Date(), 30), 'yyyy-MM-dd')
                  }
                  onChange={(e) =>
                    setNewGoal({
                      ...newGoal,
                      targetDate: new Date(e.target.value),
                    })
                  }
                  className="p-2 border rounded"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addNewGoal}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Add Goal
                </button>
                <button
                  onClick={() => setShowAddGoal(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
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
                className="border rounded-lg p-4 bg-white shadow-sm"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">
                        {getCategoryIcon(goal.category)}
                      </span>
                      <h4 className="text-lg font-semibold">{goal.title}</h4>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(goal.priority)}`}
                      >
                        {goal.priority}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(goal.status)}`}
                      >
                        {goal.status.replace('-', ' ')}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-2">{goal.description}</p>
                    <div className="text-sm text-gray-500">
                      Target: {format(goal.targetDate, 'MMM dd, yyyy')}(
                      {differenceInDays(goal.targetDate, new Date())} days
                      remaining)
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {goal.progress}%
                    </div>
                    <div className="w-24 bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${goal.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Milestones */}
                <div className="space-y-2">
                  <h5 className="font-medium text-gray-700">Milestones:</h5>
                  {goal.milestones.map((milestone) => (
                    <div key={milestone.id} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={milestone.completed}
                        onChange={() => toggleMilestone(goal.id, milestone.id)}
                        disabled={readOnly}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span
                        className={
                          milestone.completed
                            ? 'line-through text-gray-500'
                            : ''
                        }
                      >
                        {milestone.title}
                      </span>
                      {milestone.completed && milestone.completedDate && (
                        <span className="text-xs text-green-600">
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
              <div key={goal.id} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium">{goal.title}</h4>
                  <span className="text-lg font-bold text-blue-600">
                    {goal.progress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${goal.progress}%` }}
                  ></div>
                </div>
                <div className="text-sm text-gray-600">
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
                  lastModified: new Date(),
                }
                setCurrentPlan(updatedPlan)
                onSave?.(updatedPlan)
              }
            }}
            readOnly={readOnly}
            className="w-full h-40 p-3 border rounded-lg resize-none"
            placeholder="Add treatment notes, observations, and recommendations..."
          />
          <div className="text-sm text-gray-500">
            Last modified:{' '}
            {format(currentPlan.lastModified, 'MMM dd, yyyy at h:mm a')}
          </div>
        </div>
      )}
    </div>
  )
}

export default TreatmentPlanManager
