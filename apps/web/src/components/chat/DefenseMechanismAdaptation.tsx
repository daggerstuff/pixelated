import { useId } from 'react'

type DefenseMechanism = {
  name: string
  baselineIntensity: number
  currentIntensity: number
  trend: 'increasing' | 'decreasing' | 'stable'
  adaptationScore: number
}

type DefenseMechanismAdaptationProps = {
  defenses: DefenseMechanism[]
  className?: string
}

function DefenseBar({ defense }: { defense: DefenseMechanism }) {
  const baselinePercentage = (defense.baselineIntensity / 5) * 100
  const currentPercentage = (defense.currentIntensity / 5) * 100

  const trendColor =
    defense.trend === 'increasing'
      ? 'text-[#ff8533]'
      : defense.trend === 'decreasing'
        ? 'text-[#8fb8a2]'
        : 'text-[#b0b0b0]'

  const trendSymbol =
    defense.trend === 'increasing'
      ? '↑'
      : defense.trend === 'decreasing'
        ? '↓'
        : '→'

  return (
    <div className="border-white/10 border bg-[#121212] p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-medium capitalize text-[#f6f1e8]">
          {defense.name.replace('-', ' ')}
        </h4>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-xs ${trendColor}`}>
            {trendSymbol} {defense.trend}
          </span>
          <span className="font-mono text-xs text-[#b0b0b0]">
            Adaptation: {defense.adaptationScore.toFixed(1)}/10
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-mono text-xs text-[#b0b0b0]">Baseline</span>
            <span className="font-mono text-xs text-[#b0b0b0]">
              {defense.baselineIntensity.toFixed(1)}/5
            </span>
          </div>
          <div className="bg-white/10 h-2 w-full">
            <div
              className="h-full bg-[#b0b0b0]"
              style={{ width: `${baselinePercentage}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-mono text-xs text-[#b0b0b0]">Current</span>
            <span className="font-mono text-xs text-[#f6f1e8]">
              {defense.currentIntensity.toFixed(1)}/5
            </span>
          </div>
          <div className="bg-white/10 h-2 w-full">
            <div
              className="h-full bg-[#8fb8a2] transition-all duration-300"
              style={{ width: `${currentPercentage}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function DefenseRadar({ defenses }: { defenses: DefenseMechanism[] }) {
  const chartId = useId()

  if (defenses.length === 0) {
    return null
  }

  const centerX = 100
  const centerY = 100
  const maxRadius = 80
  const angleStep = (2 * Math.PI) / defenses.length

  const baselinePoints = defenses
    .map((defense, index) => {
      const angle = angleStep * index - Math.PI / 2
      const radius = (defense.baselineIntensity / 5) * maxRadius
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      return `${x},${y}`
    })
    .join(' ')

  const currentPoints = defenses
    .map((defense, index) => {
      const angle = angleStep * index - Math.PI / 2
      const radius = (defense.currentIntensity / 5) * maxRadius
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      return `${x},${y}`
    })
    .join(' ')

  const labels = defenses.map((defense, index) => {
    const angle = angleStep * index - Math.PI / 2
    const labelRadius = maxRadius + 15
    const x = centerX + labelRadius * Math.cos(angle)
    const y = centerY + labelRadius * Math.sin(angle)
    return {
      name: defense.name.replace('-', ' '),
      x,
      y,
      anchor:
        Math.abs(Math.cos(angle)) < 0.1
          ? 'middle'
          : Math.cos(angle) > 0
            ? 'start'
            : 'end',
    }
  })

  return (
    <div className="border-white/10 border bg-[#121212] p-4">
      <h3 className="mb-3 font-mono text-sm uppercase tracking-wide text-[#f6f1e8]">
        Defense pattern overview
      </h3>
      <svg
        className="mx-auto h-64 w-64"
        viewBox="0 0 200 200"
        role="img"
        aria-labelledby={chartId}
      >
        <title id={chartId}>Defense mechanism radar chart</title>
        {/* Grid circles */}
        {[0.2, 0.4, 0.6, 0.8, 1].map((scale) => (
          <circle
            key={scale}
            cx={centerX}
            cy={centerY}
            r={maxRadius * scale}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
        ))}
        {/* Grid lines */}
        {defenses.map((_, index) => {
          const angle = angleStep * index - Math.PI / 2
          const x = centerX + maxRadius * Math.cos(angle)
          const y = centerY + maxRadius * Math.sin(angle)
          return (
            <line
              key={index}
              x1={centerX}
              y1={centerY}
              x2={x}
              y2={y}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />
          )
        })}
        {/* Baseline polygon */}
        <polygon
          points={baselinePoints}
          fill="rgba(176,176,176,0.2)"
          stroke="#b0b0b0"
          strokeWidth="2"
        />
        {/* Current polygon */}
        <polygon
          points={currentPoints}
          fill="rgba(143,184,162,0.3)"
          stroke="#8fb8a2"
          strokeWidth="2"
        />
        {/* Labels */}
        {labels.map((label, index) => (
          <text
            key={index}
            x={label.x}
            y={label.y}
            textAnchor={label.anchor as 'start' | 'middle' | 'end'}
            dominantBaseline="middle"
            className="fill-[#b0b0b0] text-[8px]"
          >
            {label.name}
          </text>
        ))}
      </svg>
      <div className="mt-3 flex justify-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 bg-[#b0b0b0]" />
          <span className="text-[#b0b0b0]">Baseline</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 bg-[#8fb8a2]" />
          <span className="text-[#b0b0b0]">Current</span>
        </div>
      </div>
    </div>
  )
}

export function DefenseMechanismAdaptation({
  defenses,
  className,
}: DefenseMechanismAdaptationProps) {
  if (defenses.length === 0) {
    return (
      <section
        className={className}
        aria-labelledby="defense-adaptation-heading"
      >
        <h2
          id="defense-adaptation-heading"
          className="text-lg font-semibold text-[#f6f1e8]"
        >
          Defense mechanism adaptation
        </h2>
        <p className="mt-2 text-sm text-[#b0b0b0]">
          No defense mechanisms tracked yet. Defense patterns are analyzed
          during therapy sessions.
        </p>
      </section>
    )
  }

  const averageAdaptation =
    defenses.reduce((sum, d) => sum + d.adaptationScore, 0) / defenses.length

  return (
    <section className={className} aria-labelledby="defense-adaptation-heading">
      <div className="mb-4">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#ff8533]">
          Psychological defenses
        </p>
        <h2
          id="defense-adaptation-heading"
          className="text-xl font-semibold text-[#f6f1e8]"
        >
          Defense mechanism adaptation
        </h2>
        <p className="mt-1 text-sm text-[#b0b0b0]">
          {defenses.length} mechanisms tracked · Average adaptation:{' '}
          {averageAdaptation.toFixed(1)}
          /10
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DefenseRadar defenses={defenses} />

        <div className="space-y-3">
          {defenses.map((defense) => (
            <DefenseBar key={defense.name} defense={defense} />
          ))}
        </div>
      </div>
    </section>
  )
}
