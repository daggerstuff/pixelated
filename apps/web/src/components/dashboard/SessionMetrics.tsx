interface SessionMetricsProps {
  metrics: { label: string; value: number | string }[]
}

export function SessionMetrics({ metrics }: SessionMetricsProps) {
  return (
    <div
      className="grid grid-cols-2 gap-4"
      role="list"
      aria-label="Session Metrics"
    >
      {metrics.map((m, i) => (
        <div
          key={i}
          className="flex flex-col items-center rounded-md bg-muted p-2"
          role="listitem"
        >
          <span className="text-xs text-muted-foreground">{m.label}</span>
          <span className="text-lg font-bold">{m.value}</span>
        </div>
      ))}
    </div>
  )
}

export default SessionMetrics
