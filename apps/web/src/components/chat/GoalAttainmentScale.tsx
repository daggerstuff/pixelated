import { useState } from 'react'

type TherapeuticGoal = {
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
    <div className="border border-border bg-card p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ring"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                {categoryLabels[goal.category]}
              </span>
            </div>
            <p className="mt-1 text-sm text-foreground">{goal.label}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm text-foreground">
              {goal.currentScore.toFixed(1)}/{goal.targetScore.toFixed(1)}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {progressPercentage.toFixed(0)}% complete
            </p>
          </div>
        </div>

        <div className="mt-3">
          <div className="h-2 w-full bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            />
          </div>
        </div>

        {totalCheckpoints > 0 && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {completedCheckpoints}/{totalCheckpoints} checkpoints
          </p>
        )}
      </button>

      {expanded && totalCheckpoints > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <h4 className="mb-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
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
                  className="mt-0.5 h-4 w-4 border border-input bg-background accent-primary focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-ring"
                />
                <label
                  htmlFor={`checkpoint-${checkpoint.id}`}
                  className={`flex-1 text-sm ${
                    checkpoint.completed
                      ? 'text-muted-foreground line-through'
                      : 'text-foreground'
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
          className="text-lg font-semibold text-foreground"
        >
          Goal attainment scale
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
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
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-foreground">
          Therapeutic objectives
        </p>
        <h2
          id="goal-attainment-heading"
          className="text-xl font-semibold text-foreground"
        >
          Goal attainment scale
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
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
