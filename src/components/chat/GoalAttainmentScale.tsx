import { useState } from 'react'

export type TherapeuticGoal = {
  id: string
  label: string
  category:
    | 'symptom_reduction'
    | 'cognitive_restructuring'
    | 'behavioral_activation'
    | 'relationship_improvement'
    | 'skill_development'
  targetScore: number
  currentScore: number
  checkpoints: Array<{
    id: string
    label: string
    completed: boolean
  }>
  createdAt: string
  lastUpdated: string
}

export type GoalAttainmentScaleProps = {
  goals: TherapeuticGoal[]
  onCheckpointToggle?: (goalId: string, checkpointId: string) => void
  className?: string
}

const categoryLabels: Record<TherapeuticGoal['category'], string> = {
  symptom_reduction: 'Symptom Reduction',
  cognitive_restructuring: 'Cognitive Restructuring',
  behavioral_activation: 'Behavioral Activation',
  relationship_improvement: 'Relationship Improvement',
  skill_development: 'Skill Development',
}

function GoalCard({
  goal,
  onCheckpointToggle,
}: {
  goal: TherapeuticGoal
  onCheckpointToggle?: (goalId: string, checkpointId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const progressPercentage = (goal.currentScore / goal.targetScore) * 100
  const completedCheckpoints = goal.checkpoints.filter(
    (c) => c.completed,
  ).length
  const totalCheckpoints = goal.checkpoints.length

  return (
    <div className="border-white/10 border bg-[#121212] p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#ff8533]"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wide text-[#b0b0b0]">
                {categoryLabels[goal.category]}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#f6f1e8]">{goal.label}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm text-[#f6f1e8]">
              {goal.currentScore.toFixed(1)}/{goal.targetScore.toFixed(1)}
            </p>
            <p className="font-mono text-xs text-[#b0b0b0]">
              {progressPercentage.toFixed(0)}% complete
            </p>
          </div>
        </div>

        <div className="mt-3">
          <div className="bg-white/10 h-2 w-full">
            <div
              className="h-full bg-[#8fb8a2] transition-all duration-300"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            />
          </div>
        </div>

        {totalCheckpoints > 0 && (
          <p className="mt-2 font-mono text-xs text-[#b0b0b0]">
            {completedCheckpoints}/{totalCheckpoints} checkpoints
          </p>
        )}
      </button>

      {expanded && totalCheckpoints > 0 && (
        <div className="border-white/10 mt-4 border-t pt-3">
          <h4 className="mb-2 font-mono text-xs uppercase tracking-wide text-[#b0b0b0]">
            Checkpoints
          </h4>
          <ul className="space-y-2">
            {goal.checkpoints.map((checkpoint) => (
              <li key={checkpoint.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id={`checkpoint-${checkpoint.id}`}
                  checked={checkpoint.completed}
                  onChange={() => onCheckpointToggle?.(goal.id, checkpoint.id)}
                  className="border-white/20 mt-0.5 h-4 w-4 border bg-[#0a0a0a] accent-[#8fb8a2] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#ff8533]"
                />
                <label
                  htmlFor={`checkpoint-${checkpoint.id}`}
                  className={`flex-1 text-sm ${
                    checkpoint.completed
                      ? 'text-[#b0b0b0] line-through'
                      : 'text-[#f6f1e8]'
                  }`}
                >
                  {checkpoint.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function GoalAttainmentScale({
  goals,
  onCheckpointToggle,
  className,
}: GoalAttainmentScaleProps) {
  if (goals.length === 0) {
    return (
      <section className={className} aria-labelledby="goal-attainment-heading">
        <h2
          id="goal-attainment-heading"
          className="text-lg font-semibold text-[#f6f1e8]"
        >
          Goal attainment scale
        </h2>
        <p className="mt-2 text-sm text-[#b0b0b0]">
          No therapeutic goals set yet. Goals are defined collaboratively during
          therapy sessions.
        </p>
      </section>
    )
  }

  const completedGoals = goals.filter(
    (g) => g.currentScore >= g.targetScore,
  ).length
  const averageProgress =
    goals.reduce((sum, g) => sum + (g.currentScore / g.targetScore) * 100, 0) /
    goals.length

  return (
    <section className={className} aria-labelledby="goal-attainment-heading">
      <div className="mb-4">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#ff8533]">
          Therapeutic objectives
        </p>
        <h2
          id="goal-attainment-heading"
          className="text-xl font-semibold text-[#f6f1e8]"
        >
          Goal attainment scale
        </h2>
        <p className="mt-1 text-sm text-[#b0b0b0]">
          {completedGoals}/{goals.length} goals achieved · Average progress:{' '}
          {averageProgress.toFixed(0)}%
        </p>
      </div>

      <div className="space-y-3">
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onCheckpointToggle={onCheckpointToggle}
          />
        ))}
      </div>
    </section>
  )
}
