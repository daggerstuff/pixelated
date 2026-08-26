import { useState } from 'react'

export type BeliefEntry = {
  id: string
  belief: string
  category: 'core' | 'intermediate' | 'automatic'
  initialStrength: number
  currentStrength: number
  history: Array<{
    sessionId: string
    sessionLabel: string
    strength: number
    date: string
  }>
}

export type BeliefChangeTrackerProps = {
  beliefs: BeliefEntry[]
  className?: string
}

function BeliefSlider({ belief }: { belief: BeliefEntry }) {
  const [expanded, setExpanded] = useState(false)

  const change = belief.currentStrength - belief.initialStrength
  const changeLabel =
    change > 0
      ? `+${change.toFixed(1)} stronger`
      : change < 0
        ? `${change.toFixed(1)} weaker`
        : 'No change'

  const changeColor =
    change > 0
      ? 'text-[#ff8533]'
      : change < 0
        ? 'text-[#8fb8a2]'
        : 'text-[#b0b0b0]'

  const percentage = (belief.currentStrength / 10) * 100

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
                {belief.category}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#f6f1e8]">{belief.belief}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm text-[#f6f1e8]">
              {belief.currentStrength.toFixed(1)}/10
            </p>
            <p className={`font-mono text-xs ${changeColor}`}>{changeLabel}</p>
          </div>
        </div>

        <div className="mt-3">
          <div className="bg-white/10 h-2 w-full">
            <div
              className="h-full bg-[#8fb8a2] transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </button>

      {expanded && belief.history.length > 0 && (
        <div className="border-white/10 mt-4 border-t pt-3">
          <h4 className="font-mono text-xs uppercase tracking-wide text-[#b0b0b0]">
            Change history
          </h4>
          <div className="mt-2 space-y-2">
            {belief.history.map((entry) => (
              <div
                key={entry.sessionId}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-[#f6f1e8]">{entry.sessionLabel}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[#b0b0b0]">
                    {entry.strength.toFixed(1)}/10
                  </span>
                  <span className="font-mono text-[#b0b0b0]">
                    {new Date(entry.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function BeliefChangeTracker({
  beliefs,
  className,
}: BeliefChangeTrackerProps) {
  if (beliefs.length === 0) {
    return (
      <section className={className} aria-labelledby="belief-tracker-heading">
        <h2
          id="belief-tracker-heading"
          className="text-lg font-semibold text-[#f6f1e8]"
        >
          Belief change tracker
        </h2>
        <p className="mt-2 text-sm text-[#b0b0b0]">
          No beliefs tracked yet. Beliefs are identified during therapy
          sessions.
        </p>
      </section>
    )
  }

  const coreBeliefs = beliefs.filter((b) => b.category === 'core')
  const intermediateBeliefs = beliefs.filter(
    (b) => b.category === 'intermediate',
  )
  const automaticThoughts = beliefs.filter((b) => b.category === 'automatic')

  return (
    <section className={className} aria-labelledby="belief-tracker-heading">
      <div className="mb-4">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#ff8533]">
          Cognitive restructuring
        </p>
        <h2
          id="belief-tracker-heading"
          className="text-xl font-semibold text-[#f6f1e8]"
        >
          Belief change tracker
        </h2>
        <p className="mt-1 text-sm text-[#b0b0b0]">
          {beliefs.length} beliefs tracked across sessions
        </p>
      </div>

      <div className="space-y-6">
        {coreBeliefs.length > 0 && (
          <div>
            <h3 className="mb-3 font-mono text-sm uppercase tracking-wide text-[#f6f1e8]">
              Core beliefs ({coreBeliefs.length})
            </h3>
            <div className="space-y-3">
              {coreBeliefs.map((belief) => (
                <BeliefSlider key={belief.id} belief={belief} />
              ))}
            </div>
          </div>
        )}

        {intermediateBeliefs.length > 0 && (
          <div>
            <h3 className="mb-3 font-mono text-sm uppercase tracking-wide text-[#f6f1e8]">
              Intermediate beliefs ({intermediateBeliefs.length})
            </h3>
            <div className="space-y-3">
              {intermediateBeliefs.map((belief) => (
                <BeliefSlider key={belief.id} belief={belief} />
              ))}
            </div>
          </div>
        )}

        {automaticThoughts.length > 0 && (
          <div>
            <h3 className="mb-3 font-mono text-sm uppercase tracking-wide text-[#f6f1e8]">
              Automatic thoughts ({automaticThoughts.length})
            </h3>
            <div className="space-y-3">
              {automaticThoughts.map((belief) => (
                <BeliefSlider key={belief.id} belief={belief} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
