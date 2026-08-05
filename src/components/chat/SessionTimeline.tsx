import { useId, useMemo, useState } from 'react'

export type SessionTimelineEvent = {
  turn: number
  type: 'intervention' | 'emotion-shift' | 'trust-change' | 'alliance-change'
  label: string
  detail?: string
  trustDelta?: number
  allianceScore?: number
}

export type BeliefChange = {
  belief: string
  confidence: number
  turn: number
  interventionCorrelated?: boolean
}

export type DefenseMechanismReading = {
  mechanism: string
  intensity: number
  turn: number
}

export type SessionGoal = {
  id: string
  label: string
  score: -2 | -1 | 0 | 1 | 2
}

export type SessionProgressData = {
  id: string
  label: string
  completed?: boolean
  events: SessionTimelineEvent[]
  beliefs: BeliefChange[]
  defenses: DefenseMechanismReading[]
  goals: SessionGoal[]
  allianceScore?: number
  milestones?: string[]
}

type SessionTimelineProps = {
  sessions: SessionProgressData[]
  activeSessionId?: string
  onGoalsChange?: (sessionId: string, goals: SessionGoal[]) => void
  className?: string
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const scoreLabel: Record<SessionGoal['score'], string> = {
  [-2]: 'Much worse',
  [-1]: 'Below expected',
  0: 'Expected',
  1: 'Above expected',
  2: 'Much better',
}

const eventColor: Record<SessionTimelineEvent['type'], string> = {
  'intervention': 'bg-[#ff8533]',
  'emotion-shift': 'bg-[#8fb8a2]',
  'trust-change': 'bg-sky-400',
  'alliance-change': 'bg-violet-400',
}

const formatScore = (score: number) => (score > 0 ? `+${score}` : String(score))

function MetricTrend({
  label,
  readings,
  value,
  max = 10,
}: {
  label: string
  readings: Array<{ turn: number; value: number }>
  value?: number
  max?: number
}) {
  const chartId = useId()
  const points = readings
    .map((reading, index) => {
      const x =
        readings.length === 1 ? 50 : (index / (readings.length - 1)) * 100
      const y = 100 - (clamp(reading.value, 0, max) / max) * 100
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="border-white/10 border bg-[#121212] p-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h4 className="font-mono text-xs uppercase tracking-wide text-[#b0b0b0]">
          {label}
        </h4>
        {value !== undefined && (
          <span className="font-mono text-sm text-[#f6f1e8]">
            {value.toFixed(1)}/{max}
          </span>
        )}
      </div>
      {readings.length > 0 ? (
        <svg
          className="h-16 w-full"
          viewBox="0 0 100 100"
          role="img"
          aria-labelledby={chartId}
          preserveAspectRatio="none"
        >
          <title id={chartId}>{label} by turn</title>
          <line
            x1="0"
            y1="50"
            x2="100"
            y2="50"
            stroke="rgba(255,255,255,0.12)"
            strokeDasharray="3 3"
          />
          <polyline
            fill="none"
            points={points}
            stroke="#8fb8a2"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <p className="text-sm text-[#b0b0b0]">No readings recorded.</p>
      )}
    </div>
  )
}

export function SessionTimeline({
  sessions,
  activeSessionId,
  onGoalsChange,
  className,
}: SessionTimelineProps) {
  const [selectedSessionId, setSelectedSessionId] = useState(
    activeSessionId ?? sessions[0]?.id,
  )
  const [newGoal, setNewGoal] = useState('')
  const session = useMemo(
    () =>
      sessions.find((candidate) => candidate.id === selectedSessionId) ??
      sessions[0],
    [selectedSessionId, sessions],
  )

  if (!session) {
    return (
      <section className={className} aria-labelledby="session-progress-heading">
        <h2
          id="session-progress-heading"
          className="text-lg font-semibold text-[#f6f1e8]"
        >
          Session progress
        </h2>
        <p className="mt-2 text-sm text-[#b0b0b0]">
          Complete a simulation session to review its progress.
        </p>
      </section>
    )
  }

  const defenseReadings = session.defenses.map((defense) => ({
    turn: defense.turn,
    value: defense.intensity,
  }))
  const beliefReadings = session.beliefs.map((belief) => ({
    turn: belief.turn,
    value: belief.confidence * 10,
  }))
  const updateGoals = (goals: SessionGoal[]) =>
    onGoalsChange?.(session.id, goals)

  const addGoal = () => {
    const label = newGoal.trim()
    if (!label || session.goals.length >= 3) return
    updateGoals([
      ...session.goals,
      { id: `${session.id}-${Date.now()}`, label, score: 0 },
    ])
    setNewGoal('')
  }

  return (
    <section className={className} aria-labelledby="session-progress-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#ff8533]">
            Simulation review
          </p>
          <h2
            id="session-progress-heading"
            className="text-xl font-semibold text-[#f6f1e8]"
          >
            Session progress
          </h2>
        </div>
        {sessions.length > 1 && (
          <label className="font-mono text-xs text-[#b0b0b0]">
            Compare session
            <select
              value={session.id}
              onChange={(event) => setSelectedSessionId(event.target.value)}
              className="border-white/20 ml-2 border bg-[#121212] px-2 py-1 text-sm text-[#f6f1e8] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#ff8533]"
            >
              {sessions.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <MetricTrend
          label="Belief confidence"
          readings={beliefReadings}
          value={
            session.beliefs.at(-1)?.confidence
              ? session.beliefs.at(-1)!.confidence * 10
              : undefined
          }
        />
        <MetricTrend
          label="Defense intensity"
          readings={defenseReadings}
          value={session.defenses.at(-1)?.intensity}
          max={5}
        />
      </div>

      <div className="border-white/10 mb-5 border bg-[#121212] p-4">
        <h3 className="font-mono text-sm uppercase tracking-wide text-[#f6f1e8]">
          Turn timeline
        </h3>
        {session.events.length > 0 ? (
          <ol
            className="border-white/15 relative mt-4 border-l pl-5"
            aria-label={`${session.label} events by turn`}
          >
            {session.events.map((event) => (
              <li
                key={`${event.type}-${event.turn}-${event.label}`}
                className="relative mb-4 last:mb-0"
              >
                <span
                  className={`absolute -left-[1.55rem] top-1 h-3 w-3 border-2 border-[#121212] ${eventColor[event.type]}`}
                  aria-hidden="true"
                />
                <p className="font-mono text-xs text-[#b0b0b0]">
                  Turn {event.turn} · {event.type.replace('-', ' ')}
                </p>
                <p className="text-sm text-[#f6f1e8]">{event.label}</p>
                {event.detail && (
                  <p className="mt-1 text-sm text-[#b0b0b0]">{event.detail}</p>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-[#b0b0b0]">
            No meaningful events were detected in this session.
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="border-white/10 border bg-[#121212] p-4">
          <h3 className="font-mono text-sm uppercase tracking-wide text-[#f6f1e8]">
            Belief changes
          </h3>
          <ul className="mt-3 space-y-3">
            {session.beliefs.map((belief) => (
              <li
                key={`${belief.belief}-${belief.turn}`}
                className="border-l-2 border-[#8fb8a2] pl-3"
              >
                <p className="text-sm text-[#f6f1e8]">{belief.belief}</p>
                <p className="font-mono text-xs text-[#b0b0b0]">
                  Turn {belief.turn} · {Math.round(belief.confidence * 100)}%
                  confidence
                  {belief.interventionCorrelated
                    ? ' · follows an intervention'
                    : ''}
                </p>
              </li>
            ))}
            {session.beliefs.length === 0 && (
              <li className="text-sm text-[#b0b0b0]">
                No beliefs available from the simulation context.
              </li>
            )}
          </ul>
        </div>
        <div className="border-white/10 border bg-[#121212] p-4">
          <h3 className="font-mono text-sm uppercase tracking-wide text-[#f6f1e8]">
            Goal attainment scaling
          </h3>
          <p className="mt-1 text-sm text-[#b0b0b0]">
            Set up to three goals and score each from −2 to +2.
          </p>
          <ul className="mt-3 space-y-3">
            {session.goals.map((goal) => (
              <li
                key={goal.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-sm text-[#f6f1e8]">{goal.label}</span>
                <label className="sr-only" htmlFor={`goal-${goal.id}`}>
                  Score for {goal.label}
                </label>
                <select
                  id={`goal-${goal.id}`}
                  value={goal.score}
                  onChange={(event) =>
                    updateGoals(
                      session.goals.map((candidate) =>
                        candidate.id === goal.id
                          ? {
                              ...candidate,
                              score: Number(
                                event.target.value,
                              ) as SessionGoal['score'],
                            }
                          : candidate,
                      ),
                    )
                  }
                  className="border-white/20 border bg-[#0a0a0a] px-2 py-1 font-mono text-xs text-[#f6f1e8] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#ff8533]"
                >
                  {([-2, -1, 0, 1, 2] as const).map((score) => (
                    <option key={score} value={score}>
                      {formatScore(score)} {scoreLabel[score]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          {session.goals.length < 3 && (
            <div className="mt-4 flex gap-2">
              <label className="sr-only" htmlFor={`new-goal-${session.id}`}>
                New session goal
              </label>
              <input
                id={`new-goal-${session.id}`}
                value={newGoal}
                onChange={(event) => setNewGoal(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addGoal()
                  }
                }}
                placeholder="Add a session goal"
                className="border-white/20 min-w-0 flex-1 border bg-[#0a0a0a] px-2 py-1 text-sm text-[#f6f1e8] placeholder:text-[#b0b0b0] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#ff8533]"
              />
              <button
                type="button"
                onClick={addGoal}
                className="border border-[#ff8533] px-3 py-1 font-mono text-xs text-[#ff8533] transition-transform duration-150 hover:-translate-y-px focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#ff8533]"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {sessions.length > 1 && (
        <div className="border-white/10 mt-5 border bg-[#121212] p-4">
          <h3 className="font-mono text-sm uppercase tracking-wide text-[#f6f1e8]">
            Multi-session progression
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sessions.map((candidate) => (
              <article
                key={candidate.id}
                className="border-white/10 border p-3"
              >
                <h4 className="text-sm font-medium text-[#f6f1e8]">
                  {candidate.label}
                </h4>
                <p className="mt-1 font-mono text-xs text-[#b0b0b0]">
                  Alliance {candidate.allianceScore?.toFixed(1) ?? '—'}/10 ·
                  Defense {candidate.defenses.at(-1)?.intensity ?? '—'}/5
                </p>
                {candidate.milestones?.map((milestone) => (
                  <p key={milestone} className="mt-2 text-xs text-[#8fb8a2]">
                    {milestone}
                  </p>
                ))}
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
