import { useId } from 'react'

export type SessionTrend = {
  sessionId: string
  label: string
  date: string
  messageCount: number
  durationMinutes: number
  distressRating?: number
  cbtExercisesCompleted: number
  allianceScore?: number
}

export type MultiSessionProgressionProps = {
  sessions: SessionTrend[]
  className?: string
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

function Sparkline({
  data,
  max,
  color,
  label,
}: {
  data: number[]
  max: number
  color: string
  label: string
}) {
  const chartId = useId()

  if (data.length === 0) {
    return (
      <div className="border border-white/10 bg-[#121212] p-3">
        <h4 className="font-mono text-xs uppercase tracking-wide text-[#b0b0b0]">
          {label}
        </h4>
        <p className="mt-2 text-sm text-[#b0b0b0]">No data available.</p>
      </div>
    )
  }

  const points = data
    .map((value, index) => {
      const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100
      const y = 100 - (clamp(value, 0, max) / max) * 100
      return `${x},${y}`
    })
    .join(' ')

  const latest = data[data.length - 1] ?? 0

  return (
    <div className="border border-white/10 bg-[#121212] p-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h4 className="font-mono text-xs uppercase tracking-wide text-[#b0b0b0]">
          {label}
        </h4>
        <span className="font-mono text-sm text-[#f6f1e8]">
          {latest.toFixed(1)}
        </span>
      </div>
      <svg
        className="h-16 w-full"
        viewBox="0 0 100 100"
        role="img"
        aria-labelledby={chartId}
        preserveAspectRatio="none"
      >
        <title id={chartId}>{label} trend across sessions</title>
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
          stroke={color}
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

export function MultiSessionProgression({
  sessions,
  className,
}: MultiSessionProgressionProps) {
  if (sessions.length === 0) {
    return (
      <section className={className} aria-labelledby="multi-session-heading">
        <h2
          id="multi-session-heading"
          className="text-lg font-semibold text-[#f6f1e8]"
        >
          Multi-session progression
        </h2>
        <p className="mt-2 text-sm text-[#b0b0b0]">
          Complete multiple sessions to see progression trends.
        </p>
      </section>
    )
  }

  const messageCounts = sessions.map((s) => s.messageCount)
  const durations = sessions.map((s) => s.durationMinutes)
  const distressRatings = sessions
    .map((s) => s.distressRating)
    .filter((r): r is number => r !== undefined)
  const cbtCounts = sessions.map((s) => s.cbtExercisesCompleted)
  const allianceScores = sessions
    .map((s) => s.allianceScore)
    .filter((s): s is number => s !== undefined)

  return (
    <section className={className} aria-labelledby="multi-session-heading">
      <div className="mb-4">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#ff8533]">
          Longitudinal view
        </p>
        <h2
          id="multi-session-heading"
          className="text-xl font-semibold text-[#f6f1e8]"
        >
          Multi-session progression
        </h2>
        <p className="mt-1 text-sm text-[#b0b0b0]">
          {sessions.length} sessions tracked
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Sparkline
          data={messageCounts}
          max={Math.max(...messageCounts, 50)}
          color="#8fb8a2"
          label="Message count"
        />
        <Sparkline
          data={durations}
          max={Math.max(...durations, 60)}
          color="#8fb8a2"
          label="Duration (min)"
        />
        {distressRatings.length > 0 && (
          <Sparkline
            data={distressRatings}
            max={10}
            color="#ff8533"
            label="Distress rating"
          />
        )}
        <Sparkline
          data={cbtCounts}
          max={Math.max(...cbtCounts, 10)}
          color="#8fb8a2"
          label="CBT exercises"
        />
        {allianceScores.length > 0 && (
          <Sparkline
            data={allianceScores}
            max={10}
            color="#8fb8a2"
            label="Alliance score"
          />
        )}
      </div>

      <div className="mt-5 border border-white/10 bg-[#121212] p-4">
        <h3 className="font-mono text-sm uppercase tracking-wide text-[#f6f1e8]">
          Session timeline
        </h3>
        <div className="mt-3 space-y-2">
          {sessions.map((session) => (
            <div
              key={session.sessionId}
              className="flex items-center justify-between border-l-2 border-[#8fb8a2] pl-3"
            >
              <div>
                <p className="text-sm text-[#f6f1e8]">{session.label}</p>
                <p className="font-mono text-xs text-[#b0b0b0]">
                  {new Date(session.date).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right font-mono text-xs text-[#b0b0b0]">
                <p>{session.messageCount} msgs</p>
                <p>{session.durationMinutes} min</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}